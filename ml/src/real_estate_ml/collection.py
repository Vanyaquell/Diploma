from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from .paths import RAW_DATA_DIR, ensure_directories


DEFAULT_ROOM_GROUPS: list[Any] = ["studio", 1, 2, 3, 4, 5]
DEFAULT_ADDITIONAL_SETTINGS = {
    "start_page": 1,
    "end_page": 5,
    "only_flat": True,
}


@dataclass(slots=True)
class CityConfig:
    name: str
    slug: str


@dataclass(slots=True)
class CollectionConfig:
    cities: list[CityConfig]
    room_groups: list[Any] = field(default_factory=lambda: list(DEFAULT_ROOM_GROUPS))
    deal_type: str = "sale"
    with_extra_data: bool = True
    additional_settings: dict[str, Any] = field(default_factory=lambda: dict(DEFAULT_ADDITIONAL_SETTINGS))
    proxies: list[str] = field(default_factory=list)
    request_timeout_seconds: int = 30


def load_collection_config(config_path: Path) -> CollectionConfig:
    payload = json.loads(config_path.read_text(encoding="utf-8"))
    cities = [CityConfig(name=city["name"], slug=city["slug"]) for city in payload["cities"]]
    return CollectionConfig(
        cities=cities,
        room_groups=payload.get("room_groups", list(DEFAULT_ROOM_GROUPS)),
        deal_type=payload.get("deal_type", "sale"),
        with_extra_data=payload.get("with_extra_data", True),
        additional_settings=payload.get("additional_settings", dict(DEFAULT_ADDITIONAL_SETTINGS)),
        proxies=payload.get("proxies", []),
        request_timeout_seconds=payload.get("request_timeout_seconds", 30),
    )


def room_group_to_slug(room_group: Any) -> str:
    return str(room_group).replace("+", "plus").replace(" ", "_")


def _build_parser(city_name: str, proxies: list[str]):
    try:
        from cianparser import CianParser
    except ImportError as exc:
        raise RuntimeError(
            "cianparser is not installed. Install dependencies from ml/requirements.txt before data collection."
        ) from exc

    return CianParser(location=city_name, proxies=proxies or None)


def _add_request_timeout(parser, request_timeout_seconds: int) -> None:
    session = parser.__session__
    original_get = session.get

    def get_with_timeout(*args, **kwargs):
        kwargs.setdefault("timeout", request_timeout_seconds)
        return original_get(*args, **kwargs)

    session.get = get_with_timeout


def _build_list_url(parser, room_group: Any, config: CollectionConfig) -> str:
    import cianparser.cianparser as cianparser_module

    deal_type, rent_period_type = cianparser_module.__define_deal_type__(config.deal_type)
    start_page = int(config.additional_settings.get("start_page", 1))
    url_template = cianparser_module.__build_url_list__(
        location_id=parser.__location_id__,
        deal_type=deal_type,
        accommodation_type="flat",
        rooms=(room_group,),
        rent_period_type=rent_period_type,
        additional_settings=config.additional_settings,
    )
    return url_template.format(start_page)


def _run_preflight_check(parser, room_group: Any, config: CollectionConfig) -> None:
    import requests

    url = _build_list_url(parser, room_group, config)
    try:
        response = parser.__session__.get(url)
        response.raise_for_status()
    except requests.RequestException as exc:
        raise RuntimeError(
            f"Failed to access CIAN list page for city '{parser.__location_name__}' and rooms '{room_group}': {exc}"
        ) from exc

    body = response.text.lower()
    if "are you not a robot?" in body or "captcha" in body:
        raise RuntimeError(
            "CIAN returned an anti-bot page instead of listings. "
            "Add working HTTPS proxies to ml/config/collection_config.json or run collection from another network."
        )


def collect_city_room_group(city: CityConfig, room_group: Any, config: CollectionConfig) -> pd.DataFrame:
    parser = _build_parser(city.name, config.proxies)
    _add_request_timeout(parser, config.request_timeout_seconds)
    _run_preflight_check(parser, room_group, config)
    additional_settings = dict(config.additional_settings)
    records = parser.get_flats(
        deal_type=config.deal_type,
        rooms=(room_group,),
        additional_settings=additional_settings,
        with_saving_csv=False,
        with_extra_data=config.with_extra_data,
    )
    frame = pd.DataFrame.from_records(records)
    if frame.empty:
        return frame

    timestamp = datetime.utcnow().isoformat(timespec="seconds")
    frame["requested_city"] = city.name
    frame["city_slug"] = city.slug
    frame["requested_rooms"] = str(room_group)
    frame["collected_at"] = timestamp
    return frame


def check_collection_access(config: CollectionConfig) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    for city in config.cities:
        parser = _build_parser(city.name, config.proxies)
        _add_request_timeout(parser, config.request_timeout_seconds)
        for room_group in config.room_groups:
            try:
                _run_preflight_check(parser, room_group, config)
                results.append(
                    {
                        "city": city.name,
                        "room_group": str(room_group),
                        "status": "ok",
                        "message": "Listings page is accessible.",
                    }
                )
            except Exception as exc:
                results.append(
                    {
                        "city": city.name,
                        "room_group": str(room_group),
                        "status": "error",
                        "message": str(exc),
                    }
                )
    return results


def collect_dataset(config: CollectionConfig, output_dir: Path | None = None) -> tuple[pd.DataFrame, list[Path], Path]:
    ensure_directories()
    output_dir = output_dir or RAW_DATA_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    collected_frames: list[pd.DataFrame] = []
    saved_files: list[Path] = []
    errors: list[dict[str, str]] = []
    batch_stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    for city in config.cities:
        city_dir = output_dir / city.slug
        city_dir.mkdir(parents=True, exist_ok=True)

        for room_group in config.room_groups:
            try:
                frame = collect_city_room_group(city, room_group, config)
            except Exception as exc:
                errors.append(
                    {
                        "city": city.name,
                        "room_group": str(room_group),
                        "error": str(exc),
                    }
                )
                continue
            if frame.empty:
                continue

            room_slug = room_group_to_slug(room_group)
            file_path = city_dir / f"{batch_stamp}_{city.slug}_rooms_{room_slug}.csv"
            frame.to_csv(file_path, index=False, encoding="utf-8")
            collected_frames.append(frame)
            saved_files.append(file_path)

    if not collected_frames:
        if errors:
            error_summary = "; ".join(
                f"{item['city']} rooms={item['room_group']}: {item['error']}" for item in errors[:5]
            )
            raise RuntimeError(f"No listings were collected. First errors: {error_summary}")
        raise RuntimeError("No listings were collected. Check the parser settings, city names, and network access.")

    combined = pd.concat(collected_frames, ignore_index=True)
    combined_path = output_dir / f"{batch_stamp}_all_cities_raw.csv"
    combined.to_csv(combined_path, index=False, encoding="utf-8")

    report_path = output_dir / f"{batch_stamp}_collection_report.json"
    report = {
        "batch_stamp": batch_stamp,
        "cities": [city.name for city in config.cities],
        "room_groups": [str(room_group) for room_group in config.room_groups],
        "rows_collected": int(len(combined)),
        "files": [str(path) for path in saved_files],
        "combined_file": str(combined_path),
        "errors": errors,
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    return combined, saved_files, combined_path
