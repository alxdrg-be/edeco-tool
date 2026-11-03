"""Executable selection must stay inside a local, protected ODA installation."""

from pathlib import Path
from types import SimpleNamespace

import pytest

from nova_legend import config
from nova_legend.importer import dwg
from nova_legend.legend import export
from test_phase3 import env  # noqa: F401 - isolated settings/API


@pytest.fixture()
def installation(tmp_path, monkeypatch):
    root = tmp_path / "Program Files"
    monkeypatch.setenv("ProgramFiles", str(root))
    monkeypatch.delenv("ProgramW6432", raising=False)
    monkeypatch.delenv("ProgramFiles(x86)", raising=False)
    exe = root / "ODA" / "ODAFileConverter 25.12.0" / "ODAFileConverter.exe"
    exe.parent.mkdir(parents=True)
    exe.write_bytes(b"MZ-test-only-not-executed")
    return exe


def test_standard_local_installation_is_discovered_and_canonicalized(installation):
    expected = str(installation.resolve())
    assert config.validate_oda_converter(installation) == expected
    assert config.find_oda_converter() == expected
    assert config.resolve_oda_converter() == expected


@pytest.mark.parametrize("kind", ["renamed", "other-program", "relative", "missing", "directory"])
def test_filename_alone_or_existing_file_is_not_enough(installation, tmp_path, kind):
    if kind == "renamed":
        candidate = tmp_path / "Downloads" / "ODAFileConverter.exe"
        candidate.parent.mkdir()
        candidate.write_bytes(b"not-ODA")
    elif kind == "other-program":
        candidate = installation.with_name("other.exe")
        candidate.write_bytes(b"not-ODA")
    elif kind == "relative":
        candidate = Path("ODA") / installation.parent.name / installation.name
    elif kind == "directory":
        candidate = installation.with_name("ODAFileConverter.exe.old") / "ODAFileConverter.exe"
        candidate.mkdir(parents=True)
    else:
        candidate = installation.parent.parent / "ODAFileConverter 99" / installation.name
    with pytest.raises(config.InvalidODAPath, match="lokal im Standardordner"):
        config.validate_oda_converter(candidate)


@pytest.mark.parametrize("candidate", [
    r"\\server\share\ODAFileConverter.exe",
    "//server/share/ODAFileConverter.exe",
    r"\\?\C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe",
    r"\\.\C:\Program Files\ODA\ODAFileConverter\ODAFileConverter.exe",
])
def test_network_and_device_paths_are_rejected_before_filesystem_lookup(monkeypatch, candidate):
    def filesystem_lookup(*_args, **_kwargs):
        pytest.fail("Network/device executable path caused a filesystem lookup")
    with monkeypatch.context() as guarded:
        guarded.setattr(Path, "resolve", filesystem_lookup)
        guarded.setattr(Path, "exists", filesystem_lookup)
        with pytest.raises(config.InvalidODAPath):
            config.validate_oda_converter(candidate)


def test_mapped_network_drive_is_rejected_before_lookup(installation, monkeypatch):
    monkeypatch.setattr(config, "_nonlocal_drive", lambda _path: True)
    with pytest.raises(config.InvalidODAPath):
        config.validate_oda_converter(installation)
    assert config.find_oda_converter() == ""


@pytest.mark.parametrize("drive_type,nonlocal_drive", [(4, True), (0, True), (1, True), (3, False)])
def test_windows_drive_type_rejects_remote_and_unknown_drives(monkeypatch, drive_type, nonlocal_drive):
    import ctypes
    calls = []
    def get_drive_type(anchor):
        calls.append(anchor)
        return drive_type
    with monkeypatch.context() as windows:
        windows.setattr(config.sys, "platform", "win32")
        windows.setattr(ctypes, "windll", SimpleNamespace(kernel32=SimpleNamespace(GetDriveTypeW=get_drive_type)), raising=False)
        assert config._nonlocal_drive(Path("/local/ODA")) is nonlocal_drive
    assert calls == [Path("/local/ODA").anchor]


def test_symlink_cannot_escape_the_vendor_directory(installation, tmp_path):
    outside = tmp_path / "untrusted" / "ODAFileConverter.exe"
    outside.parent.mkdir()
    outside.write_bytes(b"not-ODA")
    installation.unlink()
    try:
        installation.symlink_to(outside)
    except OSError:
        pytest.skip("This Windows account cannot create symbolic links")
    with pytest.raises(config.InvalidODAPath):
        config.validate_oda_converter(installation)
    assert config.find_oda_converter() == ""


def test_vendor_directory_itself_cannot_be_redirected_to_a_writable_location(installation, tmp_path):
    vendor = installation.parent.parent
    outside = tmp_path / "untrusted-ODA"
    vendor.rename(outside)
    try:
        vendor.symlink_to(outside, target_is_directory=True)
    except OSError:
        pytest.skip("This Windows account cannot create symbolic links")
    with pytest.raises(config.InvalidODAPath):
        config.validate_oda_converter(installation)
    assert config.find_oda_converter() == ""


def test_unsafe_legacy_setting_is_ignored_in_favour_of_safe_autodiscovery(installation, tmp_path):
    outside = tmp_path / "ODAFileConverter.exe"
    outside.write_bytes(b"not-ODA")
    assert config.resolve_oda_converter(str(outside)) == str(installation.resolve())
    installation.unlink()
    assert config.resolve_oda_converter(str(outside)) == ""


@pytest.mark.parametrize("convert,suffix", [(dwg.convert_dwg_to_dxf, ".dwg"), (export.dxf_to_dwg, ".dxf")])
def test_both_conversion_paths_reject_unsafe_executable_before_launch(convert, suffix, tmp_path, monkeypatch):
    outside = tmp_path / "ODAFileConverter.exe"
    outside.write_bytes(b"not-ODA")
    monkeypatch.setattr(dwg.subprocess, "run", lambda *_args, **_kwargs: pytest.fail("Untrusted executable was launched"))
    with pytest.raises(dwg.ConverterMissing, match="Netzwerkpfade und andere Programme"):
        convert(tmp_path / ("plan" + suffix), str(outside), tmp_path / "out")


@pytest.mark.parametrize("convert,input_suffix,output_suffix", [
    (dwg.convert_dwg_to_dxf, ".dwg", ".dxf"),
    (export.dxf_to_dwg, ".dxf", ".dwg"),
])
def test_both_conversion_paths_launch_the_validated_canonical_converter(
        convert, input_suffix, output_suffix, installation, tmp_path, monkeypatch):
    source = tmp_path / ("plan" + input_suffix)
    source.write_bytes(b"test input")
    out = tmp_path / "out"
    out.mkdir()
    calls = []
    def run(command, **_kwargs):
        calls.append(command)
        (Path(command[2]) / ("plan" + output_suffix)).write_bytes(b"converted")
        return SimpleNamespace(returncode=0)
    monkeypatch.setattr(dwg.subprocess, "run", run)
    result = convert(source, str(installation), out)
    assert result.read_bytes() == b"converted"
    assert len(calls) == 1
    assert calls[0][0] == str(installation.resolve())


def test_settings_reject_unsafe_executable_and_allow_clearing_legacy_value(env, installation, tmp_path):
    client, _ = env
    outside = tmp_path / "ODAFileConverter.exe"
    outside.write_bytes(b"not-ODA")
    response = client.put("/api/settings", json={"oda_path": str(outside)})
    assert response.status_code == 400
    assert "lokal im Standardordner" in response.json()["detail"]
    assert client.app.state.nova.settings.oda_path == ""
    valid = client.put("/api/settings", json={"oda_path": str(installation)})
    assert valid.status_code == 200
    assert valid.json()["oda"] == str(installation.resolve())
    # A stale manually edited settings file is never presented as a usable program.
    client.app.state.nova.settings.oda_path = str(outside)
    installation.unlink()
    assert client.get("/api/status").json()["oda"] == ""
    cleared = client.put("/api/settings", json={"oda_path": ""})
    assert cleared.status_code == 200
    assert config.load_settings().oda_path == ""
