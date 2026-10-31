"""Register tool APIs before mounting the shared React user interface."""

from pathlib import Path

from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from nova_legend import config
from nova_legend.api.app import AppState, create_app as create_nova_app

from . import APP_NAME, APP_VERSION, BUILD, COMMIT
from .bim import create_app as create_bim_app
from .update_api import register as register_updates
from .documents.api import register as register_documents


def create_app(state: AppState | None = None, ui_dir: Path | None = None):
    # Keep Nova's existing /api routes and data paths for compatibility.
    app = create_nova_app(state, serve_ui=False, updates_enabled=False)
    app.title = APP_NAME
    app.version = APP_VERSION
    register_updates(app)
    register_documents(app)

    @app.get("/api/toolbox/status")
    def status():
        return {"name": APP_NAME, "version": APP_VERSION, "build": BUILD, "commit": COMMIT}

    # Future tool routers belong here, under /api/tools/<tool-id>.
    app.mount("/tools/bim2steiger", create_bim_app(), name="bim2steiger")
    ui = ui_dir or config.resource_dir() / "ui" / "dist"
    if (ui / "index.html").is_file():
        app.mount("/", StaticFiles(directory=ui, html=True), name="toolbox-ui")
    else:
        @app.get("/", response_class=HTMLResponse)
        def missing_ui():
            return "<h1>edeco Toolbox</h1><p>Oberfläche im Ordner ui mit npm ci und npm run build bauen.</p>"
    return app
