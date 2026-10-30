import sys
from types import SimpleNamespace

from edeco_toolbox import __main__ as desktop


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
