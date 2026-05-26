from pathlib import Path


PACKAGE_ROOT = Path(__file__).resolve().parent
ML_ROOT = PACKAGE_ROOT.parents[1]
DATA_DIR = ML_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
INTERIM_DATA_DIR = DATA_DIR / "interim"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
ARTIFACTS_DIR = ML_ROOT / "artifacts"
CONFIG_DIR = ML_ROOT / "config"


def ensure_directories() -> None:
    """Create the standard project directories if they do not exist yet."""
    for path in (DATA_DIR, RAW_DATA_DIR, INTERIM_DATA_DIR, PROCESSED_DATA_DIR, ARTIFACTS_DIR, CONFIG_DIR):
        path.mkdir(parents=True, exist_ok=True)
