"""Read-only folder synchronisation, ownership and filesystem-boundary regression tests."""
from __future__ import annotations

from contextlib import contextmanager
from pathlib import Path
import stat
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from edeco_toolbox.app import create_app
from edeco_toolbox.documents.api import PREFIX, register
from edeco_toolbox.documents import folders
from edeco_toolbox.documents.folders import Candidate, FolderSource, FolderBusyError, _read_candidate
from edeco_toolbox.documents.store import DocumentStore


def library(tmp_path):
    source = tmp_path / "source"
    source.mkdir()
    store = DocumentStore(tmp_path / "library")
    return source, store, FolderSource(store)


def symlink(target, link, *, directory=False):
    try:
        link.symlink_to(target, target_is_directory=directory)
    except OSError:
        pytest.skip("Symbolic links are unavailable for this Windows user")


def test_folder_sync_updates_removes_and_never_changes_source_files(tmp_path):
    source, store, folder = library(tmp_path)
    file = source / "Plan.txt"
    file.write_text("Schutzleiter vorher prüfen.", encoding="utf-8")
    before = file.stat().st_mtime_ns
    folder.configure(str(source), True)
    first = folder.sync()
    assert first["errors"] == []
    identifier = first["documents"][0]["id"]
    assert first["added"] == 1 and first["errors"] == []
    assert folder.sync()["unchanged"] == 1
    assert file.stat().st_mtime_ns == before
    file.write_text("Aktualisierte Prüfung des Schutzleiters.", encoding="utf-8")
    changed = folder.sync()
    assert changed["added"] == 1 and changed["removed"] == 1
    assert len(store.list()) == 1 and store.list()[0]["id"] != identifier
    assert file.read_text(encoding="utf-8") == "Aktualisierte Prüfung des Schutzleiters."
    file.unlink()
    assert folder.sync()["removed"] == 1 and not store.list()


def test_folder_keeps_manual_duplicates_before_and_after_folder_import(tmp_path):
    source, store, folder = library(tmp_path)
    old = source / "Manual.txt"
    old.write_bytes(b"Original manual report")
    manual = store.add(old.read_bytes(), "Manual.txt")["document"]["id"]
    folder.configure(str(source), True)
    folder.sync()
    old.unlink()
    assert folder.sync()["removed"] == 0 and store.get(manual)
    later = source / "Later.txt"
    later.write_bytes(b"Folder first, manual later")
    imported = folder.sync()
    assert imported["errors"] == []
    owned = imported["documents"][0]["id"]
    pinned = folder.add_manual(later.read_bytes(), "Personal copy.txt")
    assert pinned["duplicate"] and pinned["document"]["id"] == owned
    later.unlink()
    assert folder.sync()["removed"] == 0 and store.get(owned)


def test_disconnect_keeps_all_copies_and_does_not_rescan(tmp_path, monkeypatch):
    source, store, folder = library(tmp_path)
    (source / "Plan.md").write_text("Vorhandene Quelle", encoding="utf-8")
    folder.configure(str(source), True)
    folder.sync()
    documents = store.list()
    with monkeypatch.context() as patch:
        patch.setattr(folders.os, "scandir", lambda *_: pytest.fail("An implicit scan is forbidden"))
        folder.configure("", True)
        assert folder.public()["path"] == ""
        with pytest.raises(ValueError, match="zuerst"):
            folder.sync()
    assert store.list() == documents


def test_startup_status_and_configuration_never_walk_the_source(tmp_path, monkeypatch):
    source, store, _ = library(tmp_path)
    (source / "Plan.txt").write_bytes(b"Not imported yet")
    with monkeypatch.context() as patch:
        patch.setattr(folders.os, "scandir", lambda *_: pytest.fail("Explicit sync is required"))
        folder = FolderSource(store)
        assert folder.public()["linked_files"] == 0
        folder.configure(str(source), True)
        assert folder.public()["path"] == str(source.resolve())
    assert store.list() == []


def test_recursive_choice_and_digest_deduplication(tmp_path):
    source, store, folder = library(tmp_path)
    nested = source / "nested"
    nested.mkdir()
    (source / "Plan.txt").write_bytes(b"Same document")
    (nested / "Copy.md").write_bytes(b"Same document")
    folder.configure(str(source), False)
    assert folder.sync()["folder"]["linked_files"] == 1
    folder.configure(str(source), True)
    expanded = folder.sync()
    assert expanded["folder"]["linked_files"] == 2 and len(store.list()) == 1
    (source / "Plan.txt").unlink()
    assert folder.sync()["removed"] == 0 and len(store.list()) == 1


@pytest.mark.parametrize("relative_descriptors", [True, False])
def test_windows_direntry_zero_ids_are_not_used_as_file_identity(tmp_path, monkeypatch, relative_descriptors):
    """Win32 DirEntry.stat caches omit file IDs; lstat/fstat provide the real IDs."""
    source, _, folder = library(tmp_path)
    nested = source / "nested"
    nested.mkdir()
    (source / "Plan.txt").write_bytes(b"First approved document")
    (nested / "Details.md").write_bytes(b"Second approved document")
    folder.configure(str(source), True)
    real_scandir = folders.os.scandir

    class WindowsEntry:
        def __init__(self, entry):
            self.entry = entry
            self.name = entry.name

        def stat(self, *, follow_symlinks):
            info = self.entry.stat(follow_symlinks=follow_symlinks)
            fields = {name: getattr(info, name) for name in dir(info) if name.startswith("st_")}
            fields.update(st_ino=0, st_dev=0, st_nlink=0)
            return SimpleNamespace(**fields)

    @contextmanager
    def windows_scandir(path):
        with real_scandir(path) as entries:
            yield (WindowsEntry(entry) for entry in entries)

    with monkeypatch.context() as patch:
        patch.setattr(folders.os, "scandir", windows_scandir)
        if not relative_descriptors:
            patch.setattr(folders.os, "supports_dir_fd", set())
        result = folder.sync()
        assert result["errors"] == []
        assert result["added"] == 2 and len(result["documents"]) == 2
        assert folder.sync()["unchanged"] == 2


def test_preflight_limits_do_not_partially_change_an_existing_index(tmp_path, monkeypatch):
    source, store, folder = library(tmp_path)
    (source / "Plan.txt").write_bytes(b"First")
    folder.configure(str(source), True)
    folder.sync()
    before = store.list()
    for index in range(200):
        (source / f"Extra-{index}.txt").write_bytes(b"More")
    with pytest.raises(ValueError, match="200 Dokumente"):
        folder.sync()
    assert store.list() == before
    for file in source.glob("Extra-*"):
        file.unlink()
    (source / "Second.txt").write_bytes(b"Second")
    monkeypatch.setattr(folders, "MAX_FOLDER_BYTES", 10)
    with pytest.raises(ValueError, match="250 MB"):
        folder.sync()
    assert store.list() == before


def test_entry_limit_includes_unsupported_files(tmp_path, monkeypatch):
    source, store, folder = library(tmp_path)
    for index in range(4):
        (source / f"ignored-{index}.bin").write_bytes(b"ignored")
    folder.configure(str(source), True)
    monkeypatch.setattr(folders, "MAX_ENTRIES", 3)
    with pytest.raises(ValueError, match="5000"):
        folder.sync()
    assert store.list() == []


def test_file_growth_after_preflight_keeps_previous_index(tmp_path, monkeypatch):
    source, store, folder = library(tmp_path)
    file = source / "Plan.txt"
    file.write_bytes(b"First")
    folder.configure(str(source), True)
    folder.sync()
    previous = store.list()
    scan = folder._scan
    def grow_after_scan(*args):
        result = scan(*args)
        file.write_bytes(b"A much larger replacement")
        return result
    monkeypatch.setattr(folders, "MAX_FOLDER_BYTES", 10)
    monkeypatch.setattr(folder, "_scan", grow_after_scan)
    result = folder.sync()
    assert result["errors"] and store.list() == previous


def test_unreachable_source_and_own_storage_are_rejected_without_deleting_copies(tmp_path):
    source, store, folder = library(tmp_path)
    (source / "Plan.txt").write_bytes(b"Keep indexed copy")
    folder.configure(str(source), True)
    folder.sync()
    before = store.list()
    source.rename(tmp_path / "offline")
    with pytest.raises(ValueError, match="nicht erreichbar"):
        folder.sync()
    assert store.list() == before
    for value in (str(tmp_path), str(store.home), str(store.originals), "relative/folder", "\\\\.\\PhysicalDrive0"):
        with pytest.raises(ValueError):
            folder.configure(value, True)


def test_links_and_directory_loops_are_skipped(tmp_path):
    source, store, folder = library(tmp_path)
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "Secret.txt").write_bytes(b"Must not be read")
    symlink(outside / "Secret.txt", source / "External.txt")
    symlink(outside, source / "external-folder", directory=True)
    symlink(source, source / "loop", directory=True)
    folder.configure(str(source), True)
    result = folder.sync()
    assert result["documents"] == [] and result["errors"]
    with pytest.raises(ValueError, match="Verknüpfung"):
        folder.configure(str(source / "external-folder"), True)
    assert (outside / "Secret.txt").read_bytes() == b"Must not be read"


def test_windows_junction_attribute_is_not_a_normal_directory():
    reparse = getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 1024)
    assert folders._linked(SimpleNamespace(st_mode=stat.S_IFDIR, st_file_attributes=reparse))
    assert folders._linked(SimpleNamespace(st_mode=stat.S_IFREG, st_file_attributes=reparse))
    assert not folders._linked(SimpleNamespace(st_mode=stat.S_IFREG, st_file_attributes=0))


@pytest.mark.parametrize(("raw", "plain"), [
    (r"\\?\UNC\SERVER\Freigabe\Dokumente\Plan.pdf", r"\\SERVER\Freigabe\Dokumente\Plan.pdf"),
    (r"\\?\C:\Dokumente\Plan.pdf", r"C:\Dokumente\Plan.pdf"),
    (r"\\SERVER\Freigabe\Plan.pdf", r"\\SERVER\Freigabe\Plan.pdf"),
])
def test_windows_handle_paths_keep_the_unc_share_boundary(raw, plain):
    assert folders._plain_windows_path(raw) == plain
    assert not folders._same_file(SimpleNamespace(st_dev=1, st_ino=42), SimpleNamespace(st_dev=2, st_ino=42))


def test_file_replaced_by_link_after_preflight_keeps_the_old_copy(tmp_path, monkeypatch):
    source, store, folder = library(tmp_path)
    path = source / "Plan.txt"
    path.write_bytes(b"Approved original")
    outside = tmp_path / "private.txt"
    outside.write_bytes(b"Outside secret")
    folder.configure(str(source), True)
    folder.sync()
    before = store.list()
    original_scan = folder._scan
    def switch_after_scan(*args):
        result = original_scan(*args)
        path.unlink()
        symlink(outside, path)
        return result
    monkeypatch.setattr(folder, "_scan", switch_after_scan)
    result = folder.sync()
    assert result["errors"] and store.list() == before
    assert not store.search("Outside secret", [item["id"] for item in before])


def test_changed_parent_directory_is_not_followed_after_preflight(tmp_path):
    source, _, _ = library(tmp_path)
    parent = source / "sub"
    parent.mkdir()
    file = parent / "Plan.txt"
    file.write_bytes(b"Approved")
    candidate = Candidate(Path("sub/Plan.txt"), file.lstat())
    root_info = source.lstat()
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "Plan.txt").write_bytes(b"Private")
    parent.rename(source / "old")
    symlink(outside, parent, directory=True)
    with pytest.raises(ValueError, match="Verknüpfung"):
        _read_candidate(source, candidate, root_info, 100)


def test_windows_final_handle_path_must_stay_inside_the_approved_root(tmp_path, monkeypatch):
    source, _, _ = library(tmp_path)
    file = source / "Plan.txt"
    file.write_bytes(b"Approved")
    monkeypatch.setattr(folders, "IS_WINDOWS", True)
    monkeypatch.setattr(folders, "_windows_handle_path", lambda _: tmp_path / "outside.txt")
    with pytest.raises(ValueError, match="ausserhalb"):
        _read_candidate(source, Candidate(Path("Plan.txt"), file.lstat()), source.lstat(), 100)


def test_api_sessions_search_manual_pin_and_busy_sync(tmp_path, monkeypatch):
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path / "home"))
    source = tmp_path / "source"
    source.mkdir()
    content = b"Vor Inbetriebnahme ist der Schutzleiter zu pruefen."
    (source / "Plan.txt").write_bytes(content)
    app = FastAPI()
    register(app)
    with TestClient(app, base_url="http://127.0.0.1") as client:
        assert client.get(PREFIX + "/folder").status_code == 403
        assert client.post(PREFIX + "/folder/sync").status_code == 403
        headers = {"X-Edeco-Documents": client.get(PREFIX + "/state").json()["session_key"]}
        assert client.post(PREFIX + "/folder", headers=headers, json={"path": str(source)}).status_code == 200
        result = client.post(PREFIX + "/folder/sync", headers=headers).json()
        assert result["errors"] == []
        identifier = result["documents"][0]["id"]
        response = client.post(PREFIX + "/ask", headers=headers, json={"question": "Schutzleiter", "document_ids": [identifier]})
        assert response.status_code == 200 and response.json()["sources"]
        assert client.post(PREFIX + "/documents", headers=headers, files={"file": ("manual.txt", content)}).json()["duplicate"]
        (source / "Plan.txt").unlink()
        assert client.post(PREFIX + "/folder/sync", headers=headers).json()["removed"] == 0
        assert app.state.documents.get(identifier)
        with app.state.document_folders.operation():
            assert client.post(PREFIX + "/folder/sync", headers=headers).status_code == 409
            assert client.delete(PREFIX + "/documents/" + identifier, headers=headers).status_code == 409
        with app.state.document_folders.operation():
            with pytest.raises(FolderBusyError):
                app.state.document_folders.configure("", True)


def test_folder_endpoints_keep_global_session_and_origin_checks(tmp_path, monkeypatch):
    monkeypatch.setenv("EDECO_TOOLBOX_HOME", str(tmp_path / "toolhub"))
    monkeypatch.setenv("NOVA_LEGENDEN_HOME", str(tmp_path / "nova"))
    source = tmp_path / "source"
    source.mkdir()
    app = create_app(ui_dir=tmp_path / "no-ui")
    with TestClient(app, base_url="http://127.0.0.1:8765") as client:
        state = client.get(PREFIX + "/state").json()
        session = client.get("/api/toolbox/session").json()["session_key"]
        headers = {"X-Edeco-Documents": state["session_key"]}
        assert client.post(PREFIX + "/folder", headers={**headers, "Origin": "https://foreign.example"}, json={"path": str(source)}).status_code == 403
        assert client.post(PREFIX + "/folder", json={"path": str(source)}).status_code == 403
        client.cookies.clear()
        assert client.post(PREFIX + "/folder", headers=headers, json={"path": str(source)}).status_code == 403
        assert client.post(PREFIX + "/folder", headers={**headers, "X-Edeco-Session": session}, json={"path": str(source)}).status_code == 200
