"""OS identity shared by host and tools; authorization policies stay separate."""

import ctypes
import getpass
import sys


def windows_identity() -> tuple[str, bool]:
    """Read the account from Windows, never from a browser-supplied user name."""
    if sys.platform != "win32":
        return getpass.getuser(), False
    try:
        size = ctypes.c_ulong(512)
        value = ctypes.create_unicode_buffer(size.value)
        if ctypes.windll.secur32.GetUserNameExW(2, value, ctypes.byref(size)):
            return value.value, True
        size = ctypes.c_ulong(512)
        value = ctypes.create_unicode_buffer(size.value)
        if ctypes.windll.advapi32.GetUserNameW(value, ctypes.byref(size)):
            return value.value, True
    except (AttributeError, OSError):
        pass
    # Fail closed for configured Windows roles if the OS identity is unavailable.
    return "", True


def is_admin(identity: str, admins: list[str]) -> bool:
    account = identity.strip().casefold()
    short = account.rsplit("\\", 1)[-1]
    return any(name.strip().casefold() == account or
               "\\" not in name and name.strip().casefold() == short
               for name in admins) if account else False


def current_user() -> str:
    """Preserve NOVA short account labels, reading Windows identity from the OS."""
    try:
        name, _ = windows_identity()
        return name.rsplit("\\", 1)[-1] or "unbekannt"
    except Exception:
        return "unbekannt"
