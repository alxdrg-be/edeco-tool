import socket

from edeco_toolbox.desktop_support import free_port


def test_occupied_preferred_port_falls_back_to_another_loopback_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as occupied:
        occupied.bind(("127.0.0.1", 0))
        occupied.listen()
        preferred = occupied.getsockname()[1]

        selected = free_port(preferred)

        assert 1 <= selected <= 65535
        assert selected != preferred


def test_zero_requests_an_actual_ephemeral_port():
    assert 1 <= free_port(0) <= 65535


def test_standalone_nova_keeps_its_free_port_import_compatible():
    from nova_legend.__main__ import free_port as standalone_free_port

    assert standalone_free_port is free_port
