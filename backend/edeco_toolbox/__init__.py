"""Shared application host for the edeco tools."""

APP_NAME = "edeco Toolbox"
APP_VERSION = "0.4.0"

from ._build import BUILD, COMMIT


def version_label() -> str:
    return f"{APP_VERSION} · Build {BUILD}" if BUILD else f"{APP_VERSION} · Quellcode"
