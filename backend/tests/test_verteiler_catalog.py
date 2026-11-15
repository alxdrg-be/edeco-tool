"""Source-backed catalogue facts and honest editable draft templates."""

import re

import pytest

from edeco_toolbox.tools.verteiler_dispo.catalog import build_document, get_catalog
from edeco_toolbox.tools.verteiler_dispo.models import DistributionDocument


def test_every_template_is_structurally_valid_with_frozen_source_references():
    catalog = get_catalog()
    ids = set()
    for template in catalog['templates']:
        value = build_document(template['id'])
        document = DistributionDocument.model_validate(value)
        assert document.revision == 0 and document.id not in ids
        ids.add(document.id)
        assert document.ratings.icw_ka is None
        assert document.ratings.rated_current_a is None
        assert document.cabinet.usable_depth_mm is None
        assert all(profile.power_loss_w is None for profile in document.profiles)
        assert template['status'] != 'freigegeben'


def test_vnb_profiles_keep_operator_differences_and_never_force_rse():
    catalog = get_catalog()
    operators = {profile['id']: profile for profile in catalog['vnb_profiles']}
    assert set(operators) == {'iwb', 'primeo', 'ebl'}
    assert 'iwb-remote' in operators['iwb']['source_ids']
    assert 'primeo-load' in operators['primeo']['source_ids']
    assert any('EBL geliefert' in note for note in operators['ebl']['notes'])
    for operator in operators:
        document = DistributionDocument.model_validate(build_document('hv-' + operator))
        assert document.vnb_id == operator
        assert document.vnb_profile_version == operators[operator]['edition']
        assert all('RSE' not in placement.label for placement in document.cabinet.placements)
    with pytest.raises(ValueError, match='widersprechen'):
        build_document('hv-iwb', 'primeo')


def test_primary_source_dimensions_are_not_confused_with_system_approval():
    catalog = get_catalog()
    profiles = {profile['id']: profile for profile in catalog['profiles']}
    assert (profiles['meter-plate-250x400']['width_mm'], profiles['meter-plate-250x400']['height_mm']) == (250, 400)
    assert (profiles['meter-plate-250x450']['width_mm'], profiles['meter-plate-250x450']['height_mm']) == (250, 450)
    assert profiles['phoenix-pt25']['article'] == '3209510'
    assert (profiles['phoenix-pt25']['width_mm'], profiles['phoenix-pt25']['height_mm'], profiles['phoenix-pt25']['depth_mm']) == (5.2, 48.6, 36.8)
    assert profiles['phoenix-ut25']['depth_mm'] == 47.5
    assert profiles['phoenix-pt25pe']['height_mm'] == 48.5
    assert profiles['generic-busbar-30x5']['rated_current_a'] is None
    for profile in profiles.values():
        if profile['geometry_status'] == 'documented':
            assert profile['source_ids']
        else:
            assert profile['manufacturer'] == ''
    for source in catalog['sources']:
        assert source['url'].startswith('https://')
        if source['sha256']:
            assert re.fullmatch('[0-9a-f]{64}', source['sha256'])


def test_drafts_and_catalogue_edits_do_not_mutate_another_document():
    first = build_document()
    second = build_document()
    first['sources'][0]['edition'] = 'changed'
    first['profiles'][0]['width_mm'] = 123
    assert second['sources'][0]['edition'] != 'changed'
    assert second['profiles'][0]['width_mm'] == 72
    catalog = get_catalog()
    catalog['profiles'][0]['width_mm'] = 999
    assert get_catalog()['profiles'][0]['width_mm'] == 72


def test_unknown_catalogue_choices_are_not_silently_replaced():
    with pytest.raises(ValueError, match='Vorlage'):
        build_document('does-not-exist')
    with pytest.raises(ValueError, match='VNB'):
        build_document('uv-basic', 'other')
