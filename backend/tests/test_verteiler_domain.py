"""Physical reference cases; data links never become assembly certificates."""

from copy import deepcopy

import pytest
from pydantic import ValidationError

from edeco_toolbox.tools.verteiler_dispo.checks import analyze, document_hash, placement_rect
from edeco_toolbox.tools.verteiler_dispo.models import DistributionDocument


def document_data():
    return {
        'schema_version': 1, 'id': 'doc-1', 'name': 'UV-Test', 'project_id': None,
        'project_number': 'TEST', 'project_name': 'Synthetischer Test', 'location': 'EG',
        'author': 'Test', 'drawing_number': 'T-1', 'schematic_ref': '', 'index': 'A',
        'date': '2026-11-15', 'revision': 0, 'system_profile_id': 'custom',
        'vnb_id': 'none', 'vnb_profile_version': '',
        'sources': [{'id': 'source-1', 'issuer': 'Synthetischer Test', 'title': 'Keine Herstellerfreigabe',
                     'url': 'https://example.test/source', 'edition': 'test', 'checked_on': '2026-11-15',
                     'sha256': '', 'pages': '', 'notes': 'Nur Testdaten.'}],
        'profiles': [{'id': 'mcb', 'name': 'Testgerät', 'kind': 'mcb', 'manufacturer': 'Test', 'article': 'TEST-1',
                      'width_mm': 18, 'height_mm': 85, 'depth_mm': 70, 'te': 1,
                      'mounting': 'din', 'power_loss_w': 2, 'rated_current_a': 16, 'clearance_mm': 0,
                      'source_ids': ['source-1'], 'geometry_status': 'documented', 'terminal_kind': '',
                      'busbar_section_width_mm': None, 'busbar_section_thickness_mm': None}],
        'cabinet': {'id': 'cab-1', 'name': 'UV 1', 'kind': 'UV', 'manufacturer': 'Test', 'system': 'TEST', 'article': 'T-BOX',
                    'width_mm': 400, 'height_mm': 500, 'depth_mm': 200, 'inner_width_mm': 380, 'inner_height_mm': 480,
                    'usable_depth_mm': 160, 'color_outer': '#d5d7d2', 'color_inner': '#ffffff',
                    'fields': [{'id': 'field-1', 'name': 'Geräte', 'x_mm': 0, 'y_mm': 0, 'width_mm': 380,
                                'height_mm': 480, 'role': 'equipment', 'sealed': False}],
                    'rails': [{'id': 'rail-1', 'field_id': 'field-1', 'name': 'R1', 'x_mm': 10,
                               'y_mm': 80, 'z_mm': 20, 'length_mm': 360, 'te_pitch_mm': 18}],
                    'placements': [{'id': 'p-1', 'profile_id': 'mcb', 'rail_id': 'rail-1', 'field_id': 'field-1',
                                    'label': 'F1', 'x_mm': 10, 'y_mm': 40, 'z_mm': 10, 'rotation': 0,
                                    'status': 'planned', 'source_circuit_id': None, 'notes': ''}],
                    'covers': [{'id': 'cover-1', 'name': 'Front', 'x_mm': 0, 'y_mm': 0, 'width_mm': 380,
                                'height_mm': 480, 'z_mm': 0, 'material': 'metal', 'thickness_mm': 1.5,
                                'transparent': False, 'color': '#d5d7d2', 'source_id': 'source-1',
                                'cutouts': [{'x_mm': 10, 'y_mm': 50, 'width_mm': 360, 'height_mm': 60}]}],
                    'reserved_zones': []},
        'ratings': {'rated_voltage_v': 400, 'rated_current_a': 63, 'ip_closed': 'IP30',
                    'ip_open_covered': 'IP20', 'access_protection': 'IPXXB', 'icw_ka': None,
                    'icw_duration_s': None, 'ipk_ka': None, 'icc_ka': None,
                    'protective_device_ref': '', 'source_ids': ['source-1'], 'notes': ''},
    }


def model(data=None):
    return DistributionDocument.model_validate(data or document_data())


def codes(result):
    return {issue['code'] for issue in result['issues']}


def second(data, **changes):
    placement = {**data['cabinet']['placements'][0], 'id': 'p-2', 'label': 'F2', **changes}
    data['cabinet']['placements'].append(placement)
    return placement


def test_adjacent_te_devices_fit_without_false_collision_and_union_capacity():
    data = document_data()
    second(data, x_mm=28)
    result = analyze(model(data))
    assert 'device-collision' not in codes(result)
    assert result['occupied_te'] == 2
    assert result['free_te'] == 18
    assert result['known_loss_w'] == 4
    assert result['missing_loss_count'] == 0


def test_removed_device_neither_occupies_nor_dissipates_or_collides():
    data = document_data()
    second(data, status='removed')
    result = analyze(model(data))
    assert 'device-collision' not in codes(result)
    assert result['occupied_te'] == 1
    assert result['known_loss_w'] == 2


def test_overlap_is_rated_by_actual_depth_not_projection_alone():
    data = document_data()
    second(data, z_mm=80)
    result = analyze(model(data))
    assert 'device-collision' not in codes(result)  # 10..80 and 80..150 touch, do not intersect.
    assert result['occupied_te'] == 1  # Projected intervals are a union, never double-counted.
    data['cabinet']['placements'][1]['z_mm'] = 79
    conflict = next(i for i in analyze(model(data))['issues'] if i['code'] == 'device-collision')
    assert conflict['target_id'] == 'p-1'
    assert conflict['field'] == 'placement.x_mm'
    assert conflict['remedies'] and conflict['explanation']


def test_unknown_depth_produces_open_collision_and_never_a_safe_claim():
    data = document_data()
    data['profiles'][0]['depth_mm'] = None
    second(data)
    result = analyze(model(data))
    assert 'collision-depth-open' in codes(result)
    assert 'device-depth-open' in codes(result)
    assert 'device-collision' not in codes(result)


def test_mechanical_errors_remain_loadable_and_focusable_for_repair():
    data = document_data()
    data['cabinet']['placements'][0].update(x_mm=-20, z_mm=150)
    result = analyze(model(data))
    assert {'placement-bounds', 'rail-capacity', 'device-depth'} <= codes(result)
    issue = next(i for i in result['issues'] if i['code'] == 'device-depth')
    assert issue['actual'] == '220 mm'
    assert issue['expected'] == 'höchstens 160 mm'
    assert issue['field'] == 'placement.z_mm'


def test_half_te_and_physical_body_width_are_distinct_from_the_row_pitch():
    data = document_data()
    data['profiles'][0].update(width_mm=9, te=.5)
    second(data, x_mm=19)
    result = analyze(model(data))
    assert result['occupied_te'] == 1
    assert 'te-width' not in codes(result)
    data['profiles'][0]['width_mm'] = 10
    assert 'te-width' in codes(analyze(model(data)))


def test_imported_positions_cannot_overlap_nominal_te_slots_between_narrow_bodies():
    data = document_data()
    data['profiles'][0]['width_mm'] = 17.5
    second(data, x_mm=27.6)  # Bodies leave 0.1 mm; 18-mm mounting slots overlap 0.4 mm.
    result = analyze(model(data))
    assert 'device-collision' not in codes(result)
    conflict = next(i for i in result['issues'] if i['code'] == 'rail-slot-collision')
    assert conflict['severity'] == 'error' and conflict['field'] == 'placement.x_mm'
    assert conflict['actual'] == '0.4 mm überlagerter TE-Montageplatz'
    data['cabinet']['placements'][1]['x_mm'] = 28
    assert 'rail-slot-collision' not in codes(analyze(model(data)))


def test_continuous_terminals_are_not_rounded_to_full_te_slots():
    data = document_data()
    data['profiles'][0].update(kind='terminal', te=None, width_mm=5.2, terminal_kind='Push-in')
    second(data, x_mm=15.2)
    result = analyze(model(data))
    assert 'rail-slot-collision' not in codes(result)
    assert 'device-collision' not in codes(result)
    assert result['occupied_te'] == pytest.approx(10.4 / 18, abs=1e-6)


def test_duplicate_rails_do_not_double_count_the_same_physical_capacity():
    data = document_data()
    data['cabinet']['rails'].append({**data['cabinet']['rails'][0], 'id': 'rail-copy', 'name': 'Doppelte Reihe'})
    second(data, x_mm=28, rail_id='rail-copy')
    result = analyze(model(data))
    conflict = next(i for i in result['issues'] if i['code'] == 'rail-overlap')
    assert conflict['severity'] == 'error' and conflict['field'] == 'rail.length_mm'
    assert result['occupied_te'] == 2
    assert result['free_te'] == 18


def test_collinear_rail_sections_union_but_separate_depths_keep_separate_capacity():
    data = document_data()
    data['cabinet']['rails'][0]['length_mm'] = 180
    data['cabinet']['rails'].append({**data['cabinet']['rails'][0], 'id': 'rail-next', 'name': 'Teilüberlagerung', 'x_mm': 100})
    result = analyze(model(data))  # 10..190 union 100..280 = 270 mm / 18 = 15 TE.
    assert 'rail-overlap' in codes(result)
    assert result['occupied_te'] == 1 and result['free_te'] == 14
    data['cabinet']['rails'][1]['z_mm'] = 40
    result = analyze(model(data))
    assert 'rail-overlap' not in codes(result)
    assert result['occupied_te'] == 1 and result['free_te'] == 19


def test_null_losses_are_not_reported_as_a_complete_zero_watt_budget():
    data = document_data()
    data['profiles'][0]['power_loss_w'] = None
    result = analyze(model(data))
    assert result['known_loss_w'] == 0
    assert result['missing_loss_count'] == 1
    thermal = next(i for i in result['issues'] if i['code'] == 'thermal-evidence-open')
    assert thermal['severity'] == 'open'
    assert '1 Geräte ohne' in thermal['actual']


def test_reservations_and_absolute_cover_cutouts_have_their_own_checks():
    data = document_data()
    data['cabinet']['reserved_zones'] = [{'id': 'zone-1', 'name': 'Kommunikation', 'x_mm': 10,
                                         'y_mm': 40, 'width_mm': 50, 'height_mm': 100, 'source_id': 'source-1'}]
    data['cabinet']['covers'][0]['cutouts'][0]['x_mm'] = 30
    result = analyze(model(data))
    assert {'reserved-zone', 'cover-cutout', 'cover-evidence-open'} <= codes(result)
    violation = next(i for i in result['issues'] if i['code'] == 'reserved-zone')
    assert violation['source_ids'] == ['source-1']


def test_copper_section_is_not_turned_into_ampacity_or_short_circuit_approval():
    data = document_data()
    data['profiles'][0].update(kind='busbar', mounting='plate', te=None,
                               busbar_section_width_mm=30, busbar_section_thickness_mm=5)
    data['cabinet']['placements'][0]['rail_id'] = None
    result = analyze(model(data))
    proof = next(i for i in result['issues'] if i['code'] == 'busbar-evidence-open')
    assert proof['actual'] == '150 mm² Querschnitt'
    assert proof['severity'] == 'open'
    assert 'assembly-short-circuit-open' in codes(result)


def test_supplied_ratings_and_source_links_do_not_certify_the_assembled_cabinet():
    data = document_data()
    data['ratings'].update(icw_ka=25, ipk_ka=50, icc_ka=25)
    result = analyze(model(data))
    assert {'icw-duration', 'icc-device', 'ip-evidence-open', 'assembly-verification-open',
            'din-mounting-datum-open', 'thermal-evidence-open'} <= codes(result)
    data['ratings'].update(icw_duration_s=1, protective_device_ref='Testgerät')
    result = analyze(model(data))
    assert 'icw-duration' not in codes(result) and 'icc-device' not in codes(result)
    assert {'assembly-short-circuit-open', 'ip-evidence-open'} <= codes(result)


def test_hash_and_analysis_are_deterministic_and_do_not_reposition_anything():
    doc = model()
    before = deepcopy(doc.model_dump())
    first, again = analyze(doc), analyze(doc)
    assert first == again
    assert first['document_hash'] == document_hash(doc)
    assert doc.model_dump() == before
    changed = model()
    changed.cabinet.placements[0].x_mm += 18
    assert document_hash(changed) != document_hash(doc)
    rotated = model()
    rotated.cabinet.placements[0].rotation = 90
    assert placement_rect(rotated.profiles[0], rotated.cabinet.placements[0]) == (10, 40, 85, 18)


@pytest.mark.parametrize('change', [
    lambda d: d.update(schema_version=True),
    lambda d: d['cabinet'].update(width_mm=float('nan')),
    lambda d: d['cabinet']['placements'][0].update(profile_id='missing'),
    lambda d: d['profiles'][0].update(source_ids=['missing']),
    lambda d: d['cabinet']['placements'][0].update(id='rail-1'),
    lambda d: d['cabinet']['rails'][0].update(te_pitch_mm=0),
    lambda d: d['sources'][0].update(url='javascript:alert(1)'),
    lambda d: d.update(extra='not permitted'),
])
def test_structural_corruption_rejected_without_coercing_or_guessing(change):
    data = document_data()
    change(data)
    with pytest.raises(ValidationError):
        model(data)


def test_large_but_valid_loss_totals_and_many_conflicts_remain_bounded():
    data = document_data()
    data['profiles'][0]['power_loss_w'] = 10_000_000
    for index in range(1, 70):
        data['cabinet']['placements'].append({**data['cabinet']['placements'][0], 'id': f'p-{index + 1}', 'label': 'L' * 2000})
    result = analyze(model(data))
    assert result['known_loss_w'] == 700_000_000
    assert len(result['issues']) <= 2001
    assert 'issue-limit' in codes(result)
    assert max(len(i['message']) for i in result['issues']) <= 2000
    assert len({i['id'] for i in result['issues']}) == len(result['issues'])
