from pathlib import Path
import pytest

FIXTURES = Path(__file__).parent / "fixtures"
SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schema" / "videos.schema.json"


@pytest.fixture
def fixtures_dir() -> Path:
    return FIXTURES


@pytest.fixture
def schema_path() -> Path:
    return SCHEMA_PATH
