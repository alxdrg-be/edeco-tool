"""Keep native application chrome fixed while JavaScript viewers zoom documents."""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def lock_desktop_zoom(window) -> bool:
    native = getattr(window, "native", None)
    if native is None:
        return False

    def apply():
        try:
            view = native.browser.webview
            core = view.CoreWebView2
            if core is None:
                return False
            core.Settings.IsZoomControlEnabled = False
            if hasattr(core.Settings, "IsPinchZoomEnabled"):
                core.Settings.IsPinchZoomEnabled = False
            view.ZoomFactor = 1.0
            return True
        except Exception:  # Renderer/COM integration must not prevent startup.
            log.debug("Dieser Renderer bietet keine WebView2-Zoomsteuerung.", exc_info=True)
            return False

    if getattr(native, "InvokeRequired", False):
        try:
            from System import Action
            native.BeginInvoke(Action(apply))
            return True
        except Exception:
            log.debug("Native Zoomsteuerung konnte nicht auf dem UI-Thread gesetzt werden.", exc_info=True)
            return False
    return apply()


def attach_desktop_zoom_guard(window):
    events = getattr(window, "events", None)
    if events is not None:
        events.loaded += lambda: lock_desktop_zoom(window)
