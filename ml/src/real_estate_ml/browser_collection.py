from __future__ import annotations

import json
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd
from selenium import webdriver
from selenium.common.exceptions import TimeoutException, WebDriverException
from selenium.webdriver.chrome.options import Options as ChromeOptions
from selenium.webdriver.chrome.service import Service as ChromeService
from selenium.webdriver.common.by import By
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.edge.service import Service as EdgeService

from .collection import CollectionConfig, CityConfig, room_group_to_slug
from .paths import ML_ROOT, RAW_DATA_DIR, ensure_directories


LISTING_CARD_SELECTOR = "article[data-name='CardComponent']"
ANTI_BOT_MARKERS = [
    "are you not a robot",
    "captcha",
    "подтвердите, что вы не робот",
    "подтвердите, что запросы отправляли вы",
]


@dataclass(slots=True)
class BrowserRuntimeConfig:
    browser: str = "chrome"
    page_wait_timeout_seconds: int = 30
    manual_solve_timeout_seconds: int = 300
    poll_interval_seconds: int = 2
    profile_dir: Path | None = None
    keep_browser_open: bool = False


def _default_profile_dir(browser: str) -> Path:
    return ML_ROOT / "browser_profile" / browser


def _build_browser_options(browser: str, profile_dir: Path | None):
    browser = browser.lower()
    if browser not in {"chrome", "edge"}:
        raise ValueError("Supported browsers: chrome, edge")

    profile_dir = profile_dir or _default_profile_dir(browser)
    profile_dir.mkdir(parents=True, exist_ok=True)

    common_args = [
        "--start-maximized",
        "--disable-blink-features=AutomationControlled",
        "--disable-notifications",
        "--lang=ru-RU",
        f"--user-data-dir={profile_dir}",
    ]

    if browser == "chrome":
        options = ChromeOptions()
        options.binary_location = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
        options.add_experimental_option("excludeSwitches", ["enable-automation"])
        options.add_experimental_option("useAutomationExtension", False)
        for arg in common_args:
            options.add_argument(arg)
        return options

    options = EdgeOptions()
    options.binary_location = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    options.add_experimental_option("excludeSwitches", ["enable-automation"])
    options.add_experimental_option("useAutomationExtension", False)
    for arg in common_args:
        options.add_argument(arg)
    return options


def build_driver(browser: str = "chrome", profile_dir: Path | None = None):
    options = _build_browser_options(browser, profile_dir)
    browser = browser.lower()

    try:
        if browser == "chrome":
            driver = webdriver.Chrome(service=ChromeService(), options=options)
        else:
            driver = webdriver.Edge(service=EdgeService(), options=options)
    except WebDriverException as exc:
        raise RuntimeError(
            f"Could not start {browser}. Check that the browser is installed and Selenium Manager can download a driver."
        ) from exc

    driver.set_page_load_timeout(120)
    try:
        driver.execute_cdp_cmd(
            "Page.addScriptToEvaluateOnNewDocument",
            {
                "source": """
                    Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
                    Object.defineProperty(navigator, 'language', {get: () => 'ru-RU'});
                    Object.defineProperty(navigator, 'languages', {get: () => ['ru-RU', 'ru', 'en-US', 'en']});
                """
            },
        )
    except Exception:
        pass

    return driver


def _build_list_url(city: CityConfig, room_group: Any, config: CollectionConfig) -> tuple[str, int, Any]:
    import cianparser.cianparser as cianparser_module
    from cianparser import CianParser

    parser = CianParser(location=city.name)
    deal_type, rent_period_type = cianparser_module.__define_deal_type__(config.deal_type)
    url_template = cianparser_module.__build_url_list__(
        location_id=parser.__location_id__,
        deal_type=deal_type,
        accommodation_type="flat",
        rooms=(room_group,),
        rent_period_type=rent_period_type,
        additional_settings=config.additional_settings,
    )
    return url_template, deal_type, rent_period_type


def _is_antibot_page(page_source: str, title: str | None = None) -> bool:
    haystack = " ".join([(title or "").lower(), page_source.lower()])
    return any(marker in haystack for marker in ANTI_BOT_MARKERS)


def _wait_for_listings(driver, runtime_config: BrowserRuntimeConfig) -> str:
    page_deadline = time.time() + runtime_config.page_wait_timeout_seconds
    antibot_detected = False
    antibot_deadline = None

    while True:
        current_html = driver.page_source
        try:
            title = driver.title
        except Exception:
            title = ""

        cards = driver.find_elements(By.CSS_SELECTOR, LISTING_CARD_SELECTOR)
        if cards:
            return current_html

        if _is_antibot_page(current_html, title):
            if not antibot_detected:
                antibot_detected = True
                antibot_deadline = time.time() + runtime_config.manual_solve_timeout_seconds
                print(
                    "CAPTCHA or anti-bot page detected. "
                    "Solve it manually in the browser window. "
                    f"The collector will keep checking for up to {runtime_config.manual_solve_timeout_seconds} seconds."
                )

            if antibot_deadline is not None and time.time() > antibot_deadline:
                raise RuntimeError("Timed out while waiting for manual CAPTCHA solving.")
        elif time.time() > page_deadline:
            raise RuntimeError(
                "Timed out while waiting for listing cards. The page loaded, but no offers appeared."
            )

        time.sleep(runtime_config.poll_interval_seconds)


def _create_list_parser(city: CityConfig, config: CollectionConfig, deal_type: str, rent_period_type: Any):
    import cianparser.cianparser as cianparser_module

    return cianparser_module.FlatListPageParser(
        session=None,
        accommodation_type="flat",
        deal_type=deal_type,
        rent_period_type=rent_period_type,
        location_name=city.name,
        with_saving_csv=False,
        with_extra_data=False,
        additional_settings=config.additional_settings,
    )


def _collect_room_group_with_browser(
    driver,
    city: CityConfig,
    room_group: Any,
    config: CollectionConfig,
    runtime_config: BrowserRuntimeConfig,
) -> pd.DataFrame:
    url_template, deal_type, rent_period_type = _build_list_url(city, room_group, config)
    list_parser = _create_list_parser(city, config, deal_type=deal_type, rent_period_type=rent_period_type)

    start_page = int(config.additional_settings.get("start_page", 1))
    end_page = int(config.additional_settings.get("end_page", 1))
    count_of_pages = end_page + 1 - start_page

    print(f"\nCollecting city='{city.name}', rooms='{room_group}', pages {start_page}-{end_page}")

    for page_number in range(start_page, end_page + 1):
        url = url_template.format(page_number)
        print(f"Opening {url}")
        try:
            driver.get(url)
        except TimeoutException:
            driver.execute_script("window.stop();")

        html = _wait_for_listings(driver, runtime_config=runtime_config)
        page_parsed, _, end_all_parsing = list_parser.parse_list_offers_page(
            html=html,
            page_number=page_number,
            count_of_pages=count_of_pages,
            attempt_number=0,
        )
        if not page_parsed:
            raise RuntimeError(f"Could not parse listings page {page_number} for city '{city.name}'.")
        if end_all_parsing:
            break

    frame = pd.DataFrame.from_records(list_parser.result)
    if frame.empty:
        return frame

    timestamp = datetime.utcnow().isoformat(timespec="seconds")
    frame["requested_city"] = city.name
    frame["city_slug"] = city.slug
    frame["requested_rooms"] = str(room_group)
    frame["collected_at"] = timestamp
    frame["collection_method"] = "browser"
    return frame


def collect_dataset_with_browser(
    config: CollectionConfig,
    runtime_config: BrowserRuntimeConfig,
    output_dir: Path | None = None,
) -> tuple[pd.DataFrame, list[Path], Path]:
    ensure_directories()
    output_dir = output_dir or RAW_DATA_DIR
    output_dir.mkdir(parents=True, exist_ok=True)

    driver = build_driver(browser=runtime_config.browser, profile_dir=runtime_config.profile_dir)
    collected_frames: list[pd.DataFrame] = []
    saved_files: list[Path] = []
    errors: list[dict[str, str]] = []
    batch_stamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    try:
        for city in config.cities:
            city_dir = output_dir / city.slug
            city_dir.mkdir(parents=True, exist_ok=True)

            for room_group in config.room_groups:
                try:
                    frame = _collect_room_group_with_browser(
                        driver=driver,
                        city=city,
                        room_group=room_group,
                        config=config,
                        runtime_config=runtime_config,
                    )
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
                file_path = city_dir / f"{batch_stamp}_{city.slug}_rooms_{room_slug}_browser.csv"
                frame.to_csv(file_path, index=False, encoding="utf-8")
                collected_frames.append(frame)
                saved_files.append(file_path)
    finally:
        if runtime_config.keep_browser_open:
            print("Browser is left open by configuration. Close it manually when you are done.")
        else:
            driver.quit()

    if not collected_frames:
        if errors:
            error_summary = "; ".join(
                f"{item['city']} rooms={item['room_group']}: {item['error']}" for item in errors[:5]
            )
            raise RuntimeError(f"No listings were collected with the browser collector. First errors: {error_summary}")
        raise RuntimeError("No listings were collected with the browser collector.")

    combined = pd.concat(collected_frames, ignore_index=True)
    combined_path = output_dir / f"{batch_stamp}_all_cities_raw_browser.csv"
    combined.to_csv(combined_path, index=False, encoding="utf-8")

    report_path = output_dir / f"{batch_stamp}_browser_collection_report.json"
    report = {
        "batch_stamp": batch_stamp,
        "cities": [city.name for city in config.cities],
        "room_groups": [str(room_group) for room_group in config.room_groups],
        "rows_collected": int(len(combined)),
        "files": [str(path) for path in saved_files],
        "combined_file": str(combined_path),
        "errors": errors,
        "browser": runtime_config.browser,
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return combined, saved_files, combined_path
