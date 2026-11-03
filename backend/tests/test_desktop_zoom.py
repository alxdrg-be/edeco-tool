from types import SimpleNamespace

from edeco_toolbox.desktop_zoom import lock_desktop_zoom


def test_native_zoom_locks_only_page_zoom():
    settings = SimpleNamespace(IsZoomControlEnabled=True, IsPinchZoomEnabled=True, Other="keep")
    view = SimpleNamespace(CoreWebView2=SimpleNamespace(Settings=settings), ZoomFactor=1.5)
    window = SimpleNamespace(native=SimpleNamespace(browser=SimpleNamespace(webview=view), InvokeRequired=False))
    assert lock_desktop_zoom(window) is True
    assert (settings.IsZoomControlEnabled, settings.IsPinchZoomEnabled, view.ZoomFactor) == (False, False, 1)
    assert settings.Other == "keep"


def test_native_zoom_dispatches_to_ui_thread(monkeypatch):
    import sys
    settings = SimpleNamespace(IsZoomControlEnabled=True)
    view = SimpleNamespace(CoreWebView2=SimpleNamespace(Settings=settings), ZoomFactor=1.25)
    callbacks = []
    native = SimpleNamespace(browser=SimpleNamespace(webview=view), InvokeRequired=True, BeginInvoke=callbacks.append)
    monkeypatch.setitem(sys.modules, "System", SimpleNamespace(Action=lambda callback: callback))
    assert lock_desktop_zoom(SimpleNamespace(native=native)) is True
    assert settings.IsZoomControlEnabled is True
    assert callbacks.pop()() is True
    assert settings.IsZoomControlEnabled is False


def test_other_renderers_and_uninitialized_controls_remain_usable():
    assert lock_desktop_zoom(SimpleNamespace()) is False
    assert lock_desktop_zoom(SimpleNamespace(native=SimpleNamespace())) is False
    assert lock_desktop_zoom(SimpleNamespace(native=SimpleNamespace(browser=SimpleNamespace(webview=SimpleNamespace(CoreWebView2=None))))) is False
