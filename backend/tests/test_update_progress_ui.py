"""The update must remain visibly active while the installation request is pending."""

from pathlib import Path
import re

from test_editor_navigation import editor, env, playwright  # noqa: F401


def test_update_shows_live_download_progress_and_recovers_after_a_failed_download(editor):
    page, _, _, _ = editor
    snapshot = {
        "current": "v0.5.0-build.29", "latest": "v0.5.0-build.30",
        "status": "available", "message": "Ein Toolhub-Update ist verfügbar.",
        "notes": "- Kompakte Legenden und Werkzeugauswahl.", "can_install": True,
        "packaged": False, "automatic": False, "session_key": "test-update-session",
        "release_url": "https://github.com/alxdrg-be/edeco-tool/releases",
    }
    pending = []

    def route_update(route):
        if route.request.url.endswith("/install"):
            snapshot.update(status="downloading", can_install=False, progress=25,
                            downloaded_bytes=256 * 1024 * 1024, total_bytes=1024 * 1024 * 1024)
            pending.append(route)
            # Keep the POST pending just like a real large download. GET polling
            # must still update the window instead of showing an idle program.
            return
        route.fulfill(json=snapshot)

    page.route("**/api/toolbox/updates", route_update)
    page.route("**/api/toolbox/updates/*", route_update)
    page.get_by_role("button", name="Zum Toolhub", exact=True).click()
    page.get_by_role("button", name="Update verfügbar", exact=True).click()
    dialog = page.get_by_role("dialog", name="Toolhub-Updates", exact=True)
    dialog.get_by_role("button", name="Update installieren", exact=True).click()
    dialog.get_by_role("button", name="Jetzt aktualisieren", exact=True).click()
    active = page.get_by_role("dialog", name="Der Toolhub wird aktualisiert", exact=True)
    progress = active.get_by_role("progressbar", name="Update herunterladen", exact=True)
    playwright.expect(progress).to_have_attribute("value", "25")
    playwright.expect(active).to_contain_text(re.compile(r"256 MB von 1['’]024 MB"))
    page.keyboard.press("Escape")
    playwright.expect(active).to_be_visible()
    playwright.expect(active.get_by_role("button", name="Schliessen", exact=True)).to_have_count(0)

    snapshot.update(progress=62.5, downloaded_bytes=640 * 1024 * 1024)
    playwright.expect(progress).to_have_attribute("value", "62.5")
    directory = Path("/workspace/artifacts/presentation-review")
    if directory.parent.is_dir():
        directory.mkdir(exist_ok=True)
        page.screenshot(path=str(directory / "update-fortschritt.png"), full_page=True)

    snapshot.update(status="verifying", progress=100, downloaded_bytes=snapshot["total_bytes"])
    playwright.expect(active.get_by_role("status")).to_contain_text("Prüfsumme")
    snapshot.update(status="available", can_install=True, progress=0, downloaded_bytes=0,
                    message="Das Update konnte nicht vorbereitet werden. Bitte erneut versuchen.")
    assert pending
    pending[0].fulfill(status=502, json={"detail": "Download unterbrochen. Bitte erneut versuchen."})
    recovered = page.get_by_role("dialog", name="Toolhub-Updates", exact=True)
    playwright.expect(recovered.get_by_role("alert")).to_contain_text("Download unterbrochen")
    playwright.expect(recovered.get_by_role("button", name="Jetzt aktualisieren", exact=True)).to_be_enabled()
    recovered.get_by_role("button", name="Schliessen", exact=True).click()
    playwright.expect(recovered).not_to_be_visible()
