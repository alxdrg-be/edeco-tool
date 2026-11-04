"""Load the current UI after an in-place update while keeping the browser profile."""

from pathlib import Path
from urllib.parse import urlencode

from fastapi.staticfiles import StaticFiles

from . import APP_VERSION, BUILD, COMMIT


def desktop_ui_url(origin: str) -> str:
    # Old installations cached index.html without revalidation. A new build must
    # have a new entry URL even before its no-store response can reach that cache.
    identity = f"{APP_VERSION}-{BUILD}-{COMMIT or 'source'}"
    return f"{origin.rstrip('/')}/?{urlencode({'ui': identity})}"


class CurrentUIFiles(StaticFiles):
    def file_response(self, full_path, stat_result, scope, status_code=200):
        html = Path(full_path).suffix.lower() == ".html"
        if html:
            # An old cached entry must never win a conditional request after an
            # update, including packages whose files share a build timestamp.
            scope = {**scope, "headers": [
                (name, value) for name, value in scope.get("headers", [])
                if name.lower() not in (b"if-none-match", b"if-modified-since")
            ]}
        response = super().file_response(full_path, stat_result, scope, status_code)
        if html:
            response.headers["Cache-Control"] = "no-store, max-age=0"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        return response
