"""Small desktop helpers shared by the host and the legacy NOVA entry point."""

import socket


def free_port(preferred: int = 8765) -> int:
    """Find a loopback port, falling back to an ephemeral port if occupied.

    This selects a port; the caller still binds its own server socket.
    """
    for port in (preferred, 0):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as candidate:
            try:
                candidate.bind(("127.0.0.1", port))
                return candidate.getsockname()[1]
            except OSError:
                continue
    raise RuntimeError("Kein freier Port gefunden")
