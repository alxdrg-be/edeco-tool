"""Input validation and advertised offline dependencies for the own tool views."""
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from edeco_toolbox.pdf_workshop.operations import Options, capabilities, selected_pages


def test_keep_page_format_always_resets_stale_orientation():
    assert Options(page_size='KEEP', orientation='LANDSCAPE').orientation == 'PORTRAIT'
    assert Options(page_size='A4', orientation='LANDSCAPE').orientation == 'LANDSCAPE'


def test_company_capabilities_follow_server_endpoints_without_local_java(tmp_path, monkeypatch):
    from edeco_toolbox.pdf_workshop.client import StirlingClient
    monkeypatch.setattr('edeco_toolbox.pdf_workshop.operations.runtime_root', lambda: tmp_path)
    enabled = dict.fromkeys(('merge-pdfs', 'rearrange-pages', 'rotate-pdf', 'split-pages', 'pdf-to-text', 'ocr-pdf', 'crop'), True)
    monkeypatch.setattr(StirlingClient, 'endpoint_availability', lambda self: enabled)
    monkeypatch.setattr(StirlingClient, 'ocr_languages', lambda self: ['eng'])
    config = SimpleNamespace(runtime=None, url='http://company-pdf:8088', api_key='')
    state = {item['id']: item['available'] for item in capabilities(config)}
    assert all(state[name] for name in ('organize', 'split', 'rotate', 'pdf-to-text'))
    assert not state['ocr'] and not state['crop'] and not state['compress']
    monkeypatch.setattr(StirlingClient, 'ocr_languages', lambda self: ['eng', 'deu'])
    assert next(item for item in capabilities(config) if item['id'] == 'ocr')['available']
    enabled['rotate-pdf'] = False
    assert not next(item for item in capabilities(config) if item['id'] == 'rotate')['available']
    enabled['pdf-to-img'] = True
    enabled['rearrange-pages'] = False
    assert next(item for item in capabilities(config) if item['id'] == 'pdf-to-images')['available']
    enabled['pdf-to-img'] = False
    assert not next(item for item in capabilities(config) if item['id'] == 'pdf-to-images')['available']


def test_page_ranges_are_bounded_and_keep_the_requested_order():
    assert selected_pages('3,1-2,2', 3) == [3, 1, 2]
    assert selected_pages('all', 3) == [1, 2, 3]
    for value in ('0', '4', '2-1', '1-999999999', 'one', '1,'):
        with pytest.raises(ValueError):
            selected_pages(value, 3)


@pytest.mark.parametrize('values', [{'angle': 17}, {'top': -1}, {'left': float('nan')}, {'dpi': 1200}, {'scale': 0}, {'languages': []}, {'languages': ['fra']}, {'endpoint': 'unexpected'}])
def test_invalid_options_never_reach_the_engine(values):
    with pytest.raises(ValidationError):
        Options.model_validate(values)


def test_capabilities_require_the_actual_bundled_tools(tmp_path):
    runtime = SimpleNamespace(root=tmp_path, health=lambda: {'ready': True})
    config = SimpleNamespace(runtime=runtime)
    assert not any(item['available'] for item in capabilities(config))
    for name in ('java/bin/java.exe', 'stirling.jar'):
        target = tmp_path / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(b'test')
    state = {item['id']: item['available'] for item in capabilities(config)}
    assert state['split'] and not state['crop'] and not state['resize'] and not state['compress'] and not state['ocr']
    for name in ('qpdf/bin/qpdf.exe', 'tesseract/tesseract.exe', 'tesseract/tessdata/deu.traineddata', 'tesseract/tessdata/eng.traineddata'):
        target = tmp_path / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_bytes(b'test')
    assert all(item['available'] for item in capabilities(config))
    runtime.health = lambda: {'ready': False}
    assert not any(item['available'] for item in capabilities(config))
