"""Register tool APIs before mounting the shared React user interface."""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

from nova_legend import config
from nova_legend.api.app import AppState, register as register_nova

from . import APP_NAME, APP_VERSION, BUILD, COMMIT
from .bim import create_app as create_bim_app
from .update_api import register as register_updates
from .documents.api import register as register_documents
from .pdf_workshop.api import register as register_pdf_workshop
from .tools.file_rename.api import register as register_file_rename
from .tools.projects.api import register as register_projects
from .tools.deliveries.api import register as register_deliveries
from .tools.calculation_archive.api import register as register_archive
from .tools.rack_dispo.api import register as register_rack_dispo
from .local_security import register as register_local_security
from .presentation import register as register_presentation
from .ui_cache import CurrentUIFiles


def create_app(state: AppState | None = None, ui_dir: Path | None = None):
    app = FastAPI(title=APP_NAME, version=APP_VERSION)
    # Nova keeps its existing /api routes and data paths for compatibility.
    register_nova(app, state, serve_ui=False, updates_enabled=False)
    register_local_security(app)
    register_presentation(app)
    register_updates(app)
    register_documents(app)
    register_pdf_workshop(app)
    register_file_rename(app)
    register_projects(app)
    register_deliveries(app)
    register_archive(app)
    register_rack_dispo(app)

    @app.get("/api/toolbox/status")
    def status():
        return {"name": APP_NAME, "version": APP_VERSION, "build": BUILD, "commit": COMMIT}

    # Future tool routers belong here, under /api/tools/<tool-id>.
    app.mount("/tools/bim2steiger", create_bim_app(), name="bim2steiger")
    ui = ui_dir or config.resource_dir() / "ui" / "dist"
    if (ui / "index.html").is_file():
        app.mount("/", CurrentUIFiles(directory=ui, html=True), name="toolbox-ui")
    else:
        @app.get("/", response_class=HTMLResponse)
        def missing_ui():
            return "<h1>edeco Toolhub</h1><p>Oberfläche im Ordner ui mit npm ci und npm run build bauen.</p>"
    return app
