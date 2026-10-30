import hashlib
import io
import threading

import pytest
from urllib.request import Request

from edeco_toolbox import updater


def release(payload=b"MZ-test-setup", **changes):
    return {"tag_name": "v9.0.0-build.5", "html_url": updater.RELEASES_URL + "/tag/v9.0.0-build.5",
            "assets": [{"name": "edeco-Toolbox-Setup-9.0.0.exe", "state": "uploaded", "size": len(payload),
                        "url": updater.API + "/releases/assets/123", "digest": "sha256:" + hashlib.sha256(payload).hexdigest()}], **changes}


def test_versions_use_numeric_version_and_build():
    assert updater.version_key("v0.2.0-build.10") > updater.version_key("v0.2.0-build.9")
    assert updater.version_key("v0.3.0-build.1") > updater.version_key("v0.2.0-build.100")
    for tag in ["../../setup.exe", "v0.2.0", "v0.2.0-build.1-beta"]:
        with pytest.raises(ValueError):
            updater.version_key(tag)


def test_only_a_unique_official_asset_with_digest_can_install(tmp_path):
    manager = updater.UpdateManager(tmp_path)
    manager.installed = manager.desktop = True
    manager.state = manager._apply_release(release())
    assert manager.public()["can_install"]
    for field, value in [("name", "NOVA-Legenden-Setup-9.0.0.exe"), ("digest", ""),
                         ("url", "https://example.com/setup.exe"), ("size", updater.MAX_SETUP + 1)]:
        data = release()
        data["assets"][0][field] = value
        manager.state = manager._apply_release(data)
        assert not manager.public()["can_install"]
    data = release()
    data["assets"] *= 2
    manager.state = manager._apply_release(data)
    assert not manager.public()["can_install"]
    with pytest.raises(ValueError):
        manager._apply_release(release(prerelease=True))
    with pytest.raises(ValueError):
        manager._apply_release(release(html_url="https://github.com/other/repo/releases/tag/v9.0.0-build.5"))


def test_redirects_never_send_credentials_to_the_asset_host():
    handler = updater.ReleaseRedirect()
    request = Request(updater.API + "/releases/assets/123", headers={"Authorization": "Bearer test-only"})
    target = handler.redirect_request(request, None, 302, "Found", {}, "https://release-assets.githubusercontent.com/test")
    assert target.get_header("Authorization") is None
    for url in ["http://github.com/file", "https://example.com/setup", "https://api.github.com.evil.test/file"]:
        with pytest.raises(ValueError):
            handler.redirect_request(request, None, 302, "Found", {}, url)


@pytest.mark.parametrize("content,size,digest", [(b"bad", 4, "0" * 64), (b"bad", 3, "0" * 64), (b"too-long", 2, "0" * 64)])
def test_failed_verification_removes_the_download(tmp_path, content, size, digest):
    target = tmp_path / "setup.exe"
    with pytest.raises(ValueError):
        updater.download_verified(io.BytesIO(content), target, digest, size)
    assert not target.exists()


def test_existing_files_are_not_overwritten_or_deleted(tmp_path):
    target = tmp_path / "setup.exe"
    target.write_bytes(b"keep")
    with pytest.raises(FileExistsError):
        updater.download_verified(io.BytesIO(b"new"), target, "0" * 64, 3)
    assert target.read_bytes() == b"keep"


def test_install_downloads_then_closes_and_launches_only_after_exit(tmp_path, monkeypatch):
    payload = b"MZ-test-setup"
    manager = updater.UpdateManager(tmp_path)
    manager.installed = manager.desktop = True
    manager.state = manager._apply_release(release(payload))
    monkeypatch.setattr(manager, "_request", lambda url, binary=False: io.BytesIO(payload))
    closed = threading.Event()
    calls = []
    monkeypatch.setattr(updater, "launch_setup", lambda *args: calls.append(args))
    assert manager.install(closed.set)["status"] == "installing"
    assert not calls
    assert closed.wait(2)
    manager.launch_pending()
    assert len(calls) == 1
    assert calls[0][0].read_bytes() == payload
    assert manager.pending is None


def test_an_altered_pending_setup_is_never_launched(tmp_path, monkeypatch):
    manager = updater.UpdateManager(tmp_path)
    target = tmp_path / "setup.exe"
    target.write_bytes(b"changed")
    manager.pending = (target, hashlib.sha256(b"original").hexdigest(), 8)
    monkeypatch.setattr(updater, "launch_setup", lambda *args: pytest.fail("Unverified setup was launched"))
    with pytest.raises(ValueError):
        manager.launch_pending()


def test_private_auth_failure_has_a_browser_fallback_and_no_token_in_status(tmp_path, monkeypatch):
    manager = updater.UpdateManager(tmp_path)
    monkeypatch.setattr(updater, "github_credential", lambda: "test-credential")
    def denied(*args, **kwargs):
        raise updater.HTTPError(updater.API + "/releases/latest", 404, "Not Found", {}, None)
    monkeypatch.setattr(manager, "_request", denied)
    state = manager.check()
    assert state["status"] == "unavailable" and "GitHub-Anmeldung" in state["message"]
    assert "test-credential" not in str(state)
