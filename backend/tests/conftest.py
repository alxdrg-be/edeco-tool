import sys
from pathlib import Path

# Make the package importable without installation
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def pytest_configure(config):
    config.addinivalue_line("markers", "browser: drives the built UI in Chromium; slow")


def pytest_collection_modifyitems(config, items):
    """Mark every test of a module that uses Playwright, so `-m "not browser"` gives a fast run."""
    uses_browser: dict[Path, bool] = {}
    for item in items:
        path = Path(str(item.fspath))
        if path not in uses_browser:
            uses_browser[path] = "playwright" in path.read_text(encoding="utf-8", errors="ignore")
        if uses_browser[path]:
            item.add_marker("browser")
