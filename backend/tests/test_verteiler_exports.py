"""Physical geometry, safe vectors and paper agreement of the new module."""

from copy import deepcopy
from io import BytesIO, StringIO
import xml.etree.ElementTree as ET

import ezdxf
from pypdf import PdfReader
import pytest

from edeco_toolbox.tools.verteiler_dispo.models import DistributionDocument
from edeco_toolbox.tools.verteiler_dispo.render import drawing_scene, export_bytes, preview_svg, _sheet_scene, _grouped_issues, _appendix_scenes


def sample_document():
    profile = {'id': 'ls', 'name': 'Leitungsschutzschalter', 'kind': 'mcb', 'manufacturer': 'Eigenes Profil', 'article': '',
               'width_mm': 18.0, 'height_mm': 80.0, 'depth_mm': 70.0, 'te': 1.0, 'mounting': 'din', 'power_loss_w': None,
               'rated_current_a': None, 'clearance_mm': 0.0, 'source_ids': [], 'geometry_status': 'generic', 'terminal_kind': '',
               'busbar_section_width_mm': None, 'busbar_section_thickness_mm': None}
    cabinet = {'id': 'uv', 'name': 'UV 01', 'kind': 'UV', 'manufacturer': '', 'system': 'Freier Aufbau', 'article': '',
               'width_mm': 600.0, 'height_mm': 1000.0, 'depth_mm': 250.0, 'inner_width_mm': 500.0, 'inner_height_mm': 850.0,
               'usable_depth_mm': 200.0, 'color_outer': '#d8dad7', 'color_inner': '#edf0ee',
               'fields': [{'id': 'field', 'name': 'Gerätefeld', 'role': 'equipment', 'sealed': False, 'x_mm': 0.0, 'y_mm': 0.0, 'width_mm': 500.0, 'height_mm': 850.0}],
               'rails': [{'id': 'rail', 'name': 'R1', 'field_id': 'field', 'x_mm': 20.0, 'y_mm': 100.0, 'z_mm': 0.0, 'length_mm': 450.0, 'te_pitch_mm': 18.0}],
               'placements': [{'id': 'q1', 'profile_id': 'ls', 'rail_id': 'rail', 'field_id': 'field', 'label': 'Q1', 'x_mm': 20.0, 'y_mm': 60.0, 'z_mm': 0.0,
                               'rotation': 0, 'status': 'planned', 'source_circuit_id': None, 'notes': ''}],
               'covers': [{'id': 'cover', 'name': 'Abdeckung', 'x_mm': 0.0, 'y_mm': 0.0, 'width_mm': 500.0, 'height_mm': 850.0, 'z_mm': 0.0,
                           'material': 'Metall', 'thickness_mm': None, 'transparent': False, 'color': '#d8dad7', 'source_id': None,
                           'cutouts': [{'x_mm': 15.0, 'y_mm': 50.0, 'width_mm': 460.0, 'height_mm': 100.0}]}], 'reserved_zones': []}
    return DistributionDocument.model_validate({'schema_version': 1, 'id': 'doc', 'name': 'Verteiler Entwurf', 'project_id': None,
        'project_number': '1294', 'project_name': 'Testprojekt', 'location': 'EG', 'author': 'AD', 'drawing_number': 'E80-01', 'schematic_ref': '', 'index': 'A', 'date': '2026-11-15',
        'revision': 1, 'system_profile_id': 'free', 'vnb_id': 'none', 'vnb_profile_version': '', 'sources': [], 'profiles': [profile], 'cabinet': cabinet,
        'ratings': {'rated_voltage_v': None, 'rated_current_a': None, 'ip_closed': '', 'ip_open_covered': '', 'access_protection': '',
                    'icw_ka': None, 'icw_duration_s': None, 'ipk_ka': None, 'icc_ka': None, 'protective_device_ref': '', 'source_ids': [], 'notes': ''}})


def test_views_keep_positions_and_click_targets_without_mutating_document():
    document = sample_document()
    original = deepcopy(document.model_dump())
    roots = [ET.fromstring(preview_svg(document, view)) for view in ('front', 'internal')]
    for root in roots:
        hits = [item for item in root.iter() if item.get('data-placement-id') == 'q1']
        assert len(hits) == 1
        assert hits[0].get('data-x-mm') == '20'
        assert hits[0].get('data-y-mm') == '60'
        assert float(root.get('data-origin-x')) == 100
        assert float(root.get('data-origin-y')) == 125
    assert drawing_scene(document, 'front').hits == drawing_scene(document, 'internal').hits
    assert document.model_dump() == original


@pytest.mark.parametrize('view', ['front', 'internal'])
def test_body_and_hit_order_follow_depth_not_import_array_order(view):
    document = sample_document()
    document.profiles[0].depth_mm = 20
    front = document.cabinet.placements[0]
    rear = front.model_copy(update={'id': 'q2', 'label': 'Q2 hinten', 'z_mm': 100.0})
    document.cabinet.placements.append(rear)
    before = drawing_scene(document, view)
    visible_bodies = [shape.target for shape in before.shapes if shape.role == 'device-body']
    assert visible_bodies == ['q2', 'q1']
    assert [hit['id'] for hit in before.hits] == ['q2', 'q1']
    svg_before = preview_svg(document, view)
    document.cabinet.placements.reverse()
    after = drawing_scene(document, view)
    assert after == before
    assert preview_svg(document, view) == svg_before


def test_cover_cutout_removes_only_its_area_and_internal_shows_rails():
    document = sample_document()
    front = drawing_scene(document, 'front')
    internal = drawing_scene(document, 'internal')
    panels = [shape for shape in front.shapes if shape.role == 'cover-panel']
    assert sum(shape.w * shape.h for shape in panels) == pytest.approx(500 * 850 - 460 * 100)
    assert not any(shape.role == 'cover-panel' for shape in internal.shapes)
    assert any(shape.role == 'rail' for shape in internal.shapes)
    assert not any(shape.role == 'rail' for shape in front.shapes)


def test_preview_untrusted_labels_remain_literal_text_and_attributes():
    document = sample_document()
    document.cabinet.placements[0].label = '"><script>alert(1)</script>'
    value = preview_svg(document, 'internal')
    root = ET.fromstring(value)
    assert not any(item.tag.endswith('script') for item in root.iter())
    assert '<script>' not in value
    assert '&lt;script&gt;' in value


def test_transparent_cover_keeps_equipment_visible_without_claiming_protection():
    document = sample_document()
    document.cabinet.covers[0].transparent = True
    scene = drawing_scene(document, 'front')
    assert any(shape.role == 'transparent-cover' for shape in scene.shapes)
    assert not any(shape.role == 'cover-panel' for shape in scene.shapes)
    assert any(shape.role == 'device-body' for shape in scene.shapes)


def test_device_kinds_have_distinct_vector_faces_without_changing_the_footprint():
    document = sample_document()
    profile = document.profiles[0]
    profile.width_mm = 72
    profile.height_mm = 90
    signatures = set()
    reference_hit = None
    for kind in ('switch', 'rcd', 'mcb', 'knx'):
        profile.kind = kind
        scene = drawing_scene(document, 'internal')
        if reference_hit is None:
            reference_hit = scene.hits[0]
        assert scene.hits[0] == reference_hit
        details = [shape for shape in scene.shapes if shape.target == 'q1' and shape.role.startswith('detail-')]
        assert details
        hit = scene.hits[0]
        for shape in details:
            assert min(shape.x, shape.x + shape.w) >= hit['x'] - .001
            assert max(shape.x, shape.x + shape.w) <= hit['x'] + hit['width'] + .001
            assert min(shape.y, shape.y + (0 if shape.kind == 'text' else shape.h)) >= hit['y'] - .001
            assert max(shape.y, shape.y + (0 if shape.kind == 'text' else shape.h)) <= hit['y'] + hit['height'] + .001
        signatures.add(tuple((shape.kind, round(shape.x, 3), round(shape.y, 3), round(shape.w, 3), round(shape.h, 3), shape.text) for shape in details))
    assert len(signatures) == 4


def test_terminal_function_colour_requires_documented_function_and_source():
    document = sample_document()
    profile = document.profiles[0]
    profile.kind = 'terminal'
    profile.terminal_kind = 'PE; Push-in'
    generic = next(shape for shape in drawing_scene(document, 'internal').shapes if shape.role == 'device-body')
    assert generic.fill == '#edf0ee'
    from edeco_toolbox.tools.verteiler_dispo.models import SourceRef
    document.sources.append(SourceRef(id='terminal-source', issuer='Test', title='Geometrie und Funktion', url='https://example.invalid/data',
                                     edition='Test', checked_on='2026-11-15', sha256='', pages='1', notes=''))
    profile.source_ids = ['terminal-source']
    profile.geometry_status = 'documented'
    documented = drawing_scene(document, 'internal')
    assert next(shape for shape in documented.shapes if shape.role == 'device-body').fill == '#e5d95c'
    assert any(shape.role == 'detail-terminal-pe' for shape in documented.shapes)


def test_dxf_has_real_millimetres_and_both_physical_views():
    payload, media, extension = export_bytes(sample_document(), 'dxf', ['front', 'internal'])
    cad = ezdxf.read(StringIO(payload.decode('utf-8')))
    assert media == 'application/dxf' and extension == 'dxf'
    assert cad.units == 4 and cad.header['$INSUNITS'] == 4
    refs = list(cad.modelspace().query('INSERT'))
    assert len(refs) == 2
    assert all(ref.dxf.xscale == 1 and ref.dxf.yscale == 1 for ref in refs)
    for ref in refs:
        cabinet = [entity for entity in ref.block().query('LWPOLYLINE') if entity.dxf.layer == 'GEHAEUSE'][0]
        xs = [point[0] for point in cabinet.get_points('xy')]
        assert max(xs) - min(xs) == pytest.approx(600)


@pytest.mark.parametrize('paper,expected', [('A4', (210, 297)), ('A3', (420, 297))])
def test_pdf_uses_requested_paper_and_readable_nachweis_appendix(paper, expected):
    payload, media, extension = export_bytes(sample_document(), 'pdf', ['front', 'internal'], paper)
    reader = PdfReader(BytesIO(payload))
    assert media == 'application/pdf' and extension == 'pdf'
    assert len(reader.pages) >= 3
    for page in reader.pages:
        assert float(page.mediabox.width) * 25.4 / 72 == pytest.approx(expected[0], abs=.05)
        assert float(page.mediabox.height) * 25.4 / 72 == pytest.approx(expected[1], abs=.05)
    text = '\n'.join(page.extract_text() or '' for page in reader.pages)
    assert 'Leitungsschutzschalter' in text
    assert 'offen' in text
    assert 'Keine automatische Norm-' in text


def test_sheet_titles_and_long_labels_do_not_overrun_their_text_budget():
    document = sample_document()
    document.project_name = 'WWWW ' * 80
    scene, scale = _sheet_scene(document.model_dump(), 'front', 'A4', None)
    assert scale in (2, 5, 10, 20, 25, 50, 100, 200, 500, 1000, 2000)
    for shape in scene.shapes:
        if shape.kind == 'text' and shape.role == 'titleblock-text':
            from edeco_toolbox.tools.rack_dispo.svgpdf import text_width_mm
            assert text_width_mm(shape.text, shape.h) <= shape.w + .001
    with pytest.raises(ValueError, match='passt nicht'):
        export_bytes(document, 'pdf', ['front'], 'A4', 1)


def test_csv_protects_text_formulas_and_json_remains_lossless():
    document = sample_document()
    document.cabinet.placements[0].label = '  =HYPERLINK("x")'
    payload, _, _ = export_bytes(document, 'bom-csv', ['front'])
    assert payload.startswith(b'\xef\xbb\xbf')
    assert '"\'  =HYPERLINK(""x"")"' in payload.decode('utf-8')
    raw, _, _ = export_bytes(document, 'json', ['front'])
    assert DistributionDocument.model_validate_json(raw) == document


def test_svg_export_uses_the_same_paper_scene_and_rejects_unknown_view():
    document = sample_document()
    payload, _, extension = export_bytes(document, 'svg', ['front', 'internal'])
    root = ET.fromstring(payload)
    assert extension == 'svg'
    assert root.get('width') == '210mm'
    pages = [item for item in root.iter() if item.get('data-page')]
    assert len(pages) >= 3
    with pytest.raises(ValueError, match='ansicht'):
        preview_svg(document, 'side')


def test_repeated_open_findings_group_targets_but_distinct_errors_and_values_remain():
    base = {'code': 'depth', 'severity': 'open', 'message': 'Tiefe fehlt', 'explanation': 'Datenblatt benötigt',
            'target_id': 'q1', 'actual': '', 'expected': '', 'source_ids': []}
    groups = _grouped_issues([base, {**base, 'target_id': 'q2'},
                              {**base, 'target_id': 'q3', 'actual': '30 mm'},
                              {**base, 'severity': 'error', 'actual': '80 mm', 'expected': '60 mm'},
                              {**base, 'severity': 'error', 'target_id': 'q2', 'actual': '80 mm', 'expected': '60 mm'}])
    assert len(groups) == 4
    assert groups[0]['targets'] == ['q1', 'q2'] and groups[0]['count'] == 2
    errors = [group for group in groups if group['issue']['severity'] == 'error']
    assert len(errors) == 2
    assert {group['targets'][0] for group in errors} == {'q1', 'q2'}
    assert all(group['issue']['actual'] == '80 mm' and group['issue']['expected'] == '60 mm' for group in errors)


def test_ordinary_uv_has_at_most_two_readable_appendix_pages():
    from edeco_toolbox.tools.verteiler_dispo.catalog import build_document
    doc = build_document('uv-basic', 'iwb')
    assert len(doc['cabinet']['placements']) == 25
    appendices = _appendix_scenes(doc, 'A4')
    assert 1 <= len(appendices) <= 2
    assert all(shape.h >= 2.4 for scene in appendices for shape in scene.shapes if shape.kind == 'text')
    data, _, _ = export_bytes(doc, 'json', ['front'])
    assert b'primeo-wv' in data  # Full source snapshots remain in the interchange file.
