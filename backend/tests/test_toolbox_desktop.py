import sys
from types import SimpleNamespace

from edeco_toolbox import __main__ as desktop


def test_native_probe_requires_rendered_tiles_and_records_success(tmp_path):
    events = []
    window = SimpleNamespace(evaluate_js=lambda script: True, destroy=lambda: events.append("closed"))
    desktop.probe_desktop(window, tmp_path)
    import json
    assert json.loads((tmp_path / "desktop-smoke.json").read_text())["ok"] is True
    assert events == ["closed"]


def test_native_probe_reports_renderer_errors_as_failures(tmp_path):
    def broken(script):
        raise RuntimeError("Renderer initialization failed")
    events = []
    desktop.probe_desktop(SimpleNamespace(evaluate_js=broken, destroy=lambda: events.append("closed")), tmp_path)
    import json
    assert json.loads((tmp_path / "desktop-smoke.json").read_text())["ok"] is False
    assert events == ["closed"]


def test_failed_native_start_does_not_pass_smoke_test_or_launch_setup(tmp_path, monkeypatch):
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path))
    events = []
    updates = SimpleNamespace(desktop=False, launch_pending=lambda: events.append("setup"))
    app = SimpleNamespace(state=SimpleNamespace(updates=updates))
    monkeypatch.setattr(desktop, "create_app", lambda: app)
    monkeypatch.setattr(desktop, "free_port", lambda port: 8765)
    monkeypatch.setattr(desktop, "wait_until_up", lambda url: True)
    monkeypatch.setattr(desktop.uvicorn, "Server", lambda *a, **k: SimpleNamespace(run=lambda: None, should_exit=False))
    monkeypatch.setattr(desktop.dialogs, "attach", lambda window: None)
    def start(**kwargs):
        raise RuntimeError("Failed to resolve Python.Runtime.Loader.Initialize")
    monkeypatch.setitem(sys.modules, "webview", SimpleNamespace(settings={}, create_window=lambda *a, **k: SimpleNamespace(destroy=lambda: None), start=start))
    assert desktop.main(["--desktop-smoke-test"]) == 1
    assert not events


def test_desktop_keeps_profile_and_port_and_defers_setup_until_window_exit(tmp_path, monkeypatch):
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path))
    desktop.save_port(tmp_path, 8777)
    profile = desktop.desktop_profile(tmp_path)
    (profile / "saved-data").write_text("keep")
    assert desktop.preferred_port(tmp_path) == 8777
    assert (desktop.desktop_profile(tmp_path) / "saved-data").read_text() == "keep"
    events, options = [], {}
    updates = SimpleNamespace(desktop=False, launch_pending=lambda: events.append("setup"))
    app = SimpleNamespace(state=SimpleNamespace(updates=updates))
    monkeypatch.setattr(desktop, "create_app", lambda: app)
    monkeypatch.setattr(desktop, "free_port", lambda port: port)
    monkeypatch.setattr(desktop, "wait_until_up", lambda url: True)
    monkeypatch.setattr(desktop.uvicorn, "Server", lambda *a, **k: SimpleNamespace(run=lambda: None, should_exit=False))
    monkeypatch.setattr(desktop.dialogs, "attach", lambda window: None)
    window = SimpleNamespace(destroy=lambda: None)
    def start(**kwargs):
        options.update(kwargs)
        assert not events
        events.append("window-closed")
    monkeypatch.setitem(sys.modules, "webview", SimpleNamespace(settings={}, create_window=lambda *a, **k: window, start=start))
    assert desktop.main([]) == 0
    assert options["private_mode"] is False
    assert options["storage_path"] == str(profile)
    assert updates.desktop is True
    assert events == ["window-closed", "setup"]
