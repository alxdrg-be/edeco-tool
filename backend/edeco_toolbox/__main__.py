"""Run all tools in one local server and desktop window."""

from nova_legend.__main__ import main as run_desktop

from . import APP_NAME, APP_VERSION
from .app import create_app


def main(argv=None):
    return run_desktop(argv, app_factory=create_app,
                       window_title=f"{APP_NAME} {APP_VERSION}", launch_updates=False)


if __name__ == "__main__":
    raise SystemExit(main())
