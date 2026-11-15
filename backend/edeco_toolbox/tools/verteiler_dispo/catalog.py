"""Offline source catalogue and deliberately unapproved distribution-board drafts.

Manufacturer dimensions are only called documented when they were read from the
primary source. Generic devices, enclosure dimensions and mounting layouts are
editable planning examples, not approved system combinations or VNB schemas.
"""

from __future__ import annotations

from copy import deepcopy
from datetime import date
from uuid import uuid4


CHECKED_ON = '2026-11-15'


def _source(identifier, issuer, title, url, edition, pages='', sha256='', notes=''):
    return dict(id=identifier, issuer=issuer, title=title, url=url, edition=edition,
                checked_on=CHECKED_ON, sha256=sha256, pages=pages, notes=notes)


SOURCES = [
    _source('iwb-wv', 'IWB / Region Basel', 'Regionale Werkvorschriften WV (TAB) 2025',
            'https://www.iwb.ch/dam/jcr:687ad484-623e-4393-a3b5-ed4d4fc302da/iwb_werksvorschriften_0526.pdf',
            'Ausgabe 2025; verlinkte Fassung 0526', 'Regionalteil S. 6–7 und 24–25; B 7.6-2 / B 7.6-10',
            'dc48787a3651890b4aaf1699e4ced92337bb5da0b2b16b9106a4b2a673f42a0b',
            'B 7.6-2 zeigt Apparateplatten 250 × 400/450 mm. Das ist kein Nachweis für ein komplettes Gehäuse. Betreiberbezogene Ausnahmen beachten.'),
    _source('primeo-wv', 'Primeo Netz AG / Region Basel', 'Regionale Werkvorschriften WV (TAB) 2025',
            'https://www.primeo-energie.ch/magnolia/dam/jcr:b33a6f9d-1c00-494f-a3cb-7d59862fe1e7/iwb_werksvorschriften_0526_v6_e.70ee9ee4f16ef6b7858638e36dd0eed6.pdf',
            'Ausgabe 2025; verlinkte Fassung 0526', 'Regionalteil S. 6–7 und 24–25',
            'bf18320ca0c06c96ebb4ec7c3b7f5bf2c93be149d7017aea0e9d96fc69ee14ee',
            'Gültigkeit für das konkrete Netzgebiet und den Auftrag prüfen. Keine pauschale SLS-/RSE-Vorgabe aus dieser Vorlage ableiten.'),
    _source('ebl-wv', 'EBL / Region Basel', 'Regionale Werkvorschriften WV (TAB) 2025',
            'https://www.ebl.ch/hubfs/Regionale%20Werkvorschriften%20TAB%202025.pdf',
            'Ausgabe 2025; Download geprüft 15.11.2026', 'Regionalteil S. 6–7 und 24–25',
            'dc48787a3651890b4aaf1699e4ced92337bb5da0b2b16b9106a4b2a673f42a0b',
            'S. 6: EBL liefert und montiert die Zählersteckklemmen. Diese Zuständigkeit unterscheidet sich von IWB/Primeo.'),
    _source('iwb-remote', 'IWB', 'Wegleitung Fernauslesung von Messeinrichtungen',
            'https://www.iwb.ch/dam/jcr:899df54d-5bcd-4d06-9545-4d3e34ca60e2/iwb_wegleitung_fernauslesung_1026.pdf',
            'Stand 26.10.2026', 'S. 7, Zähler- und Kommunikationsfeld',
            'ce6f2068404476822e0bcd936afb35b01ffb2d1fc3537ab1ecbcf90cd6a6f58a',
            'TRE/STG-Feld bleibt Kommunikations-Sternpunkt und ist in jeder HV freizuhalten. Standard-Apparateplatte mit Dreipunktbefestigung; OTO-Vorgaben sind gebietsabhängig.'),
    _source('iwb-meter', 'IWB', 'Montage Zählersteckklemme für Messapparate',
            'https://www.iwb.ch/dam/jcr:e7bb1087-0e5e-4894-a3c1-a7f653bc980e/Schema_Montage_Z%C3%A4hlersteckklemme.pdf',
            'Verlinktes Montageschema; Datum im Blatt nicht angegeben', 'S. 1',
            'f9617d4dc3a8a39a3b375cfb97ffa8ea4032b637ea530f80b49fb5c88962c820',
            'Montageschema nennt Abstand a=90 mm, Achsflucht und Reserveschlaufe mindestens 150 mm. Diese Verdrahtungs-/Befestigungsdetails werden nicht allein durch eine gezeichnete Platte nachgewiesen.'),
    _source('primeo-meter', 'Primeo Energie', 'Montage von Zählersteckklemmen / Anschlussklemmen',
            'https://www.primeo-energie.ch/magnolia/dam/jcr:d4b57517-1e28-4006-8367-2e0acbe4ca4b/PE_FS_Montage_Zaehler_Anschlussklemmen_d_2024.2024-01-10-15-51-58.pdf',
            'Factsheet 2024', 'S. 1',
            'dc438b6d31832e527d9f323e3949a40d6cc63fd0501ef3590ad21bf005f10efb',
            'Direktmessplätze bei neuen/geänderten Messungen benötigen Steckklemme und Abdeckhaube. Die Liste enthält datierte Typfreigaben; aus älteren Hager-Typen keine heutige uneingeschränkte Freigabe ableiten.'),
    _source('primeo-load', 'Primeo Energie', 'Neues Lastmanagementsystem ab 2025',
            'https://www.primeo-energie.ch/magnolia/dam/jcr:1e90903a-04df-4469-a261-a4625dd0a5c1/PE_Lastenmanagementsystem_2025.2024-01-25-14-57-13.pdf',
            'Information zur Einführung ab 2025', 'S. 1–2',
            'f1c4bec8d03b1fb5c5345e92ac51159054680837f7dac64a3def9f158ad621f9',
            'Rundsteuerung wird durch Lastmanagement abgelöst; Übergangsregelungen und netzseitige Steuerung objektspezifisch klären.'),
    _source('phoenix-pt25', 'Phoenix Contact', 'PT 2,5 / 3209510 – technische Daten',
            'https://www.phoenixcontact.com/product/pdf/api/v1/MzIwOTUxMA==?_realm=ch&_locale=de-CH&blocks=technical-data,drawings,commercial-data&action=VIEW',
            'Produktdatenblatt erzeugt 15.11.2026', 'S. 4 – Maße / Montage',
            '7d6a61fe7f2711de6cb5be73f4d43910b780bc75ad383a98783a096697b3ba6f', notes=
            'Breite 5,2 mm, Höhe 48,6 mm; Tiefe auf NS 35/7,5: 36,8 mm, auf NS 35/15: 44,3 mm. Das Profil verwendet NS 35/7,5. Endhalter/Endplatten separat berücksichtigen.'),
    _source('phoenix-ut25', 'Phoenix Contact', 'UT 2,5 / 3044076 – technische Daten',
            'https://www.phoenixcontact.com/product/pdf/api/v1/MzA0NDA3Ng==?_realm=ch&_locale=de-CH&blocks=technical-data,drawings,commercial-data&action=VIEW',
            'Produktdatenblatt erzeugt 15.11.2026', 'S. 4 – Maße / Montage',
            'c0d7c5c1c7f1d797cf6d03f6c865a81fdb6cd36d5d9eb029d7a554ec865a95f8', notes=
            'Breite 5,2 mm, Höhe 47,7 mm; Tiefe auf NS 35/7,5: 47,5 mm, auf NS 35/15: 55 mm. Das Profil verwendet NS 35/7,5.'),
    _source('phoenix-pt25pe', 'Phoenix Contact', 'PT 2,5-PE / 3209536 – technische Daten',
            'https://www.phoenixcontact.com/product/pdf/api/v1/MzIwOTUzNg==?_realm=ch&_locale=de-CH&blocks=technical-data,drawings,commercial-data&action=VIEW',
            'Produktdatenblatt erzeugt 15.11.2026', 'S. 3 – Maße / Montage',
            '2ccbeca6ef4c9a5cf70543a0d53c266d350d0a90b468139f2a512eed7d605f96', notes=
            'Breite 5,2 mm, Höhe 48,5 mm; Tiefe auf NS 35/7,5: 36,8 mm. Schutzleiterfunktion und Zubehör nach Herstelleraufbau prüfen.'),
    _source('schneider-pragma', 'Schneider Electric', 'Pragma Multi – Herstellerprogramm',
            'https://www.se.com/ch/de/product-range/61533-pragma-multi/', 'Hersteller-Programmeinstieg', notes=
            'Keine Artikelabmessungen übernommen: Produkt-/Datenblattabruf war gesperrt. Konkreten Artikel mit Datenblatt ergänzen.'),
    _source('schneider-prismaset', 'Schneider Electric', 'PrismaSeT XL – Herstellerprogramm',
            'https://www.se.com/ch/de/product-range/66444-prismaset-xl/', 'Hersteller-Programmeinstieg', notes=
            'Ein herstellerspezifischer Systemnachweis ist nicht im freien Entwurf enthalten. Artikel, Montagebausatz und Datenblatt separat übernehmen.'),
    _source('hager-field', 'Hager', 'Feldverteiler – Herstellerprogramm',
            'https://hager.com/de-ch/loesungen/feldverteiler', 'Hersteller-Programmeinstieg', notes=
            'Die Systemfamilie ist eine Auswahlhilfe. Ohne konkreten Artikel sind die Beispiel-Geometrie und elektrischen Eigenschaften nicht als Hager-Daten verifiziert.'),
    _source('feller-disposuite', 'Feller', 'DispoSuite – Hersteller-Konfigurator',
            'https://disposuite.feller.ch/#/home', 'Hersteller-Konfigurator', notes=
            'Externe Planungshilfe; der Toolhub kopiert keine geschlossene Hersteller-Freigabe. Projektbezogenen Herstellerexport als Quelle hinterlegen.'),
    _source('almatec-indoor', 'Almatec', 'Indoor-Gehäusesysteme',
            'https://www.almatec.com/produkte-und-service/produkte-indoor/', 'Hersteller-Programmeinstieg', notes=
            'Keine allgemeinen Feld- oder Höheneinheiten aus der Produktfamilie ableiten. Gewählten Gehäuseartikel und Innenausbau belegen.'),
    _source('electrosuisse-61439-design', 'Electrosuisse', 'Bauartnachweisprotokoll SN EN IEC 61439-1',
            'https://www.electrosuisse.ch/wp-content/uploads/2024/05/Bauartnachweis-SN-EN-IEC-61439-2021d_V1.pdf',
            'Edition 2021; Formular V1', 'Gesamtes Formular, insbesondere Titel und Nachweismethoden',
            '1dbdf4d40a2519d9725847f783ac239f4559325e0e2692924506b3758c1c7552',
            'Das Formular verlangt separat beizulegende Prüf-/Berechnungsergebnisse und die zutreffende Produktenorm 61439-X. Eine Zeichnung oder ein Quellenlink ersetzt den Bauartnachweis nicht.'),
    _source('electrosuisse-61439-routine', 'Electrosuisse', 'Stücknachweisprotokoll SN EN IEC 61439-1',
            'https://www.electrosuisse.ch/wp-content/uploads/2024/05/Stuecknachweis-SN-EN-IEC-61439-2021d_V1.pdf',
            'Edition 2021; Formular V1', 'Gesamtes Formular, insbesondere Abschnitt 11',
            '1b0bd8382a21f47d80a50a6bb47681b18c13d1490571aa587a7b3435e4773c30',
            'Stücknachweis mit zugehörigen Prüfungen am fertigen Aufbau separat dokumentieren. Ein geometrischer Prüfbericht ist keine Prüfung der Schutzleiterkreise, Isolation oder Schutzart.'),
]


def _profile(identifier, name, kind, width, height, *, depth=None, te=None, mounting='din',
             manufacturer='', article='', sources=(), documented=False, terminal='', current=None,
             section_width=None, section_thickness=None):
    return dict(id=identifier, name=name, kind=kind, manufacturer=manufacturer, article=article,
                width_mm=width, height_mm=height, depth_mm=depth, te=te, mounting=mounting,
                power_loss_w=None, rated_current_a=current, clearance_mm=0,
                source_ids=list(sources), geometry_status='documented' if documented else 'generic',
                terminal_kind=terminal, busbar_section_width_mm=section_width,
                busbar_section_thickness_mm=section_thickness)


PROFILES = [
    _profile('generic-switch-4', 'Hauptschalter · freie 4-TE-Geometrie', 'switch', 72, 85, te=4),
    _profile('generic-rcd-4', 'RCD · freie 4-TE-Geometrie', 'rcd', 72, 90, te=4),
    _profile('generic-mcb-1', 'LS · freie 1-TE-Geometrie', 'mcb', 18, 85, te=1),
    _profile('generic-knx-4', 'KNX-Aktor · freie 4-TE-Geometrie', 'knx', 72, 90, te=4),
    _profile('phoenix-pt25', 'PT 2,5 · NS 35/7,5', 'terminal', 5.2, 48.6, depth=36.8,
             manufacturer='Phoenix Contact', article='3209510', sources=['phoenix-pt25'],
             documented=True, terminal='Push-in; NS 35/7,5', current=24),
    _profile('phoenix-ut25', 'UT 2,5 · NS 35/7,5', 'terminal', 5.2, 47.7, depth=47.5,
             manufacturer='Phoenix Contact', article='3044076', sources=['phoenix-ut25'],
             documented=True, terminal='Schraubanschluss; NS 35/7,5', current=24),
    _profile('phoenix-pt25pe', 'PT 2,5-PE · NS 35/7,5', 'terminal', 5.2, 48.5, depth=36.8,
             manufacturer='Phoenix Contact', article='3209536', sources=['phoenix-pt25pe'],
             documented=True, terminal='PE; Push-in; NS 35/7,5'),
    _profile('generic-end-stop', 'Endhalter · freie Geometrie', 'terminal', 10, 35, terminal='Endhalter; Breite selbst prüfen'),
    _profile('generic-busbar-30x5', 'Cu 30 × 5 · freie Länge 320 mm', 'busbar', 320, 30, depth=5,
             mounting='plate', section_width=30, section_thickness=5),
    _profile('generic-block', 'Freier Geräteblock', 'custom', 90, 90, mounting='free'),
    _profile('generic-reserve', 'Reserve · freie 4-TE-Geometrie', 'reserve', 72, 90, te=4),
    _profile('meter-plate-250x400', 'Apparateplatte WV · 250 × 400', 'custom', 250, 400, mounting='plate',
             manufacturer='Regionale WV – Apparateplatz', article='B 7.6-2 / 250 × 400',
             sources=['iwb-wv', 'primeo-wv', 'ebl-wv'], documented=True),
    _profile('meter-plate-250x450', 'Apparateplatte WV · 250 × 450', 'custom', 250, 450, mounting='plate',
             manufacturer='Regionale WV – Apparateplatz', article='B 7.6-2 / 250 × 450',
             sources=['iwb-wv', 'primeo-wv', 'ebl-wv'], documented=True),
]

TEMPLATES = [
    dict(id='uv-basic', name='UV · bestückter freier Entwurf', description='Drei Reihen mit frei gewähltem 18-mm-Raster, Beispielgeräten und dokumentierten Phoenix-Klemmen. Kein Hersteller-Systemnachweis.', status='Entwurf'),
    dict(id='uv-empty', name='UV · leerer freier Aufbau', description='Freies Gehäuse und drei Reihen. Gehäusemasse und Zubehör anhand eures Artikels anpassen.', status='Entwurf'),
    dict(id='hv-basic', name='HV · freier Feldaufbau', description='Freies Gehäuse mit Apparateplatte 250 × 450 gemäss B 7.6-2 und Kommunikationsreserve. Kein freigegebenes Gesamtschema.', status='Entwurf'),
    dict(id='hv-iwb', name='HV · IWB-Quellenprofil', description='Freier Feldaufbau mit IWB-WV und Fernauslesungs-Unterlagen. Artikel-/Auftragsfreigabe offen.', status='Quellen geprüft; Aufbau offen'),
    dict(id='hv-primeo', name='HV · Primeo-Basel-Quellenprofil', description='Freier Feldaufbau mit regionalen WV, Zählerklemmen und Lastmanagement-Informationen.', status='Quellen geprüft; Aufbau offen'),
    dict(id='hv-ebl', name='HV · EBL-Quellenprofil', description='Freier Feldaufbau mit EBL-WV; Zuständigkeit für Zählersteckklemmen beachten.', status='Quellen geprüft; Aufbau offen'),
    dict(id='pragma-multi', name='Pragma Multi · Artikelprofil vorbereiten', description='Schneider-Programmeinstieg. Freie Beispielmasse ersetzen und gewählten Artikel belegen.', status='Artikelmasse offen'),
    dict(id='prismaset-xl', name='PrismaSeT XL · Artikelprofil vorbereiten', description='Schneider-Programmeinstieg. Kein erfundener Hersteller-Feldraster; konkreten Artikel übernehmen.', status='Artikelmasse offen'),
    dict(id='hager-field', name='Hager Feldverteiler · Artikelprofil vorbereiten', description='Freier Aufbau mit Hersteller-Quellenverweis; Masse und Systemteile anhand des Artikels prüfen.', status='Artikelmasse offen'),
]

VNB_PROFILES = [
    dict(id='iwb', name='IWB', edition='Regionale WV 2025 / 0526; Fernauslesung 26.10.2026',
         source_ids=['iwb-wv', 'iwb-remote', 'iwb-meter'], notes=[
             'TRE/STG-Feld als Kommunikations-Sternpunkt in jeder HV freihalten (Fernauslesung S. 7).',
             'Zählersteckklemme durch Installateur; Auftrags-/Gebietsvorgaben und Messart prüfen.',
             'Die Zeichnung prüft weder Plombierbarkeit noch Verdrahtung oder vollständige VNB-Konformität.']),
    dict(id='primeo', name='Primeo Netz AG · Region Basel', edition='Regionale WV 2025 / 0526; Factsheets 2024/2025',
         source_ids=['primeo-wv', 'primeo-meter', 'primeo-load'], notes=[
             'Konkretes Netzgebiet und aktuellen Auftrag bestätigen.',
             'Bei neuen/geänderten Direktmessplätzen Steckklemme und Abdeckhaube nach gültiger Typfreigabe vorsehen.',
             'Rundsteuerung wird durch Lastmanagement abgelöst; RSE nicht als generelle Neuanlagenpflicht übernehmen.']),
    dict(id='ebl', name='EBL', edition='Regionale WV (TAB) 2025; Download 15.11.2026',
         source_ids=['ebl-wv'], notes=[
             'Die regionalen WV enthalten betreiberspezifische Ausnahmen.',
             'Zählersteckklemmen werden durch EBL geliefert und montiert (Regionalteil S. 6).',
             'Messart, Montage-/Plombierbereiche und Anschlussbedingungen für den konkreten Auftrag freigeben lassen.']),
]


def get_catalog():
    """Return independent plain data; UI edits must not mutate the shipped catalogue."""
    return deepcopy(dict(sources=SOURCES, profiles=PROFILES, templates=TEMPLATES, vnb_profiles=VNB_PROFILES))


def build_document(template_id='uv-basic', vnb_id='none'):
    """A new editable draft with source snapshots, never a VNB/system approval."""
    if template_id not in {item['id'] for item in TEMPLATES}:
        raise ValueError('Unbekannte Verteiler-Vorlage.')
    if vnb_id not in ('none', 'iwb', 'primeo', 'ebl'):
        raise ValueError('Unbekanntes VNB-Profil.')
    forced_vnb = template_id.removeprefix('hv-') if template_id in ('hv-iwb', 'hv-primeo', 'hv-ebl') else None
    if forced_vnb and vnb_id not in ('none', forced_vnb):
        raise ValueError('Vorlage und gewähltes VNB-Profil widersprechen sich.')
    vnb_id = forced_vnb or vnb_id
    is_hv = template_id.startswith('hv-') or template_id == 'prismaset-xl'
    cabinet = _cabinet(is_hv, populated=template_id == 'uv-basic')
    if template_id in ('pragma-multi', 'prismaset-xl'):
        cabinet['manufacturer'] = 'Schneider Electric'
        cabinet['system'] = 'Pragma Multi' if template_id == 'pragma-multi' else 'PrismaSeT XL'
    elif template_id == 'hager-field':
        cabinet['manufacturer'], cabinet['system'] = 'Hager', 'Feldverteiler – Artikel noch offen'
    chosen = next((profile for profile in VNB_PROFILES if profile['id'] == vnb_id), None)
    return dict(schema_version=1, id=str(uuid4()), name='HV 01' if is_hv else 'UV 01',
                project_id=None, project_number='', project_name='', location='', author='',
                drawing_number='', schematic_ref='', index='', date=date.today().isoformat(), revision=0,
                system_profile_id=template_id, vnb_id=vnb_id,
                vnb_profile_version=chosen['edition'] if chosen else '',
                sources=deepcopy(SOURCES), profiles=deepcopy(PROFILES), cabinet=cabinet,
                ratings=dict(rated_voltage_v=None, rated_current_a=None, ip_closed='', ip_open_covered='',
                             access_protection='', icw_ka=None, icw_duration_s=None, ipk_ka=None, icc_ka=None,
                             protective_device_ref='', source_ids=[], notes='Elektrische Bemessung und Systemnachweise sind offen.'))


def _placement(identifier, profile_id, x, y, *, rail=None, field='equipment', label=''):
    return dict(id=identifier, profile_id=profile_id, rail_id=rail, field_id=field, label=label,
                x_mm=x, y_mm=y, z_mm=25, rotation=0, status='planned', source_circuit_id=None, notes='')


def _cabinet(hv, populated):
    width, height, depth, inner_w, inner_h = (1000, 1800, 400, 900, 1680) if hv else (600, 800, 250, 520, 720)
    fields, rails, placements, zones = [], [], [], []
    if hv:
        fields = [dict(id='meter', name='Messplatz · Apparateplatte', role='meter', sealed=True, x_mm=20, y_mm=30, width_mm=250, height_mm=450),
                  dict(id='communication', name='Kommunikationsreserve · Auftrag prüfen', role='control', sealed=False, x_mm=20, y_mm=510, width_mm=250, height_mm=450),
                  dict(id='equipment', name='Apparatefeld · freier Entwurf', role='equipment', sealed=False, x_mm=360, y_mm=30, width_mm=500, height_mm=1580)]
        rails = [dict(id=f'rail-{i+1}', field_id='equipment', name=f'Reihe {i+1}', x_mm=390, y_mm=y, z_mm=25, length_mm=432, te_pitch_mm=18) for i, y in enumerate((170, 390, 610, 830, 1050, 1270, 1490))]
        placements = [_placement('meter-plate', 'meter-plate-250x450', 20, 30, field='meter', label='Apparateplatte B 7.6-2')]
        zones = [dict(id='communication-zone', name='Kommunikation / TRE-STG · projektbezogen freihalten', x_mm=20, y_mm=510, width_mm=250, height_mm=450, source_id=None)]
    else:
        fields = [dict(id='equipment', name='Apparatefeld · freier Entwurf', role='equipment', sealed=False, x_mm=20, y_mm=20, width_mm=480, height_mm=650)]
        rails = [dict(id=f'rail-{i+1}', field_id='equipment', name=f'Reihe {i+1}', x_mm=44, y_mm=y, z_mm=25, length_mm=432, te_pitch_mm=18) for i, y in enumerate((140, 320, 500))]
        if populated:
            placements = [_placement('main-switch', 'generic-switch-4', 44, 97.5, rail='rail-1', label='Q1'),
                          _placement('rcd-1', 'generic-rcd-4', 116, 95, rail='rail-1', label='Q2')]
            placements += [_placement(f'mcb-{i+1}', 'generic-mcb-1', 188 + 18*i, 97.5, rail='rail-1', label=f'F{i+1}') for i in range(6)]
            placements += [_placement(f'mcb-{i+7}', 'generic-mcb-1', 44 + 18*i, 277.5, rail='rail-2', label=f'F{i+7}') for i in range(4)]
            placements += [_placement('knx-1', 'generic-knx-4', 152, 275, rail='rail-2', label='A1')]
            placements += [_placement('terminal-stop-left', 'generic-end-stop', 44, 482.5, rail='rail-3', label='Endhalter')]
            placements += [_placement(f'terminal-{i+1}', 'phoenix-pt25', 54 + 5.2*i, 475.7, rail='rail-3', label=f'X1:{i+1}') for i in range(8)]
            placements += [_placement('terminal-pe', 'phoenix-pt25pe', 95.6, 475.75, rail='rail-3', label='X1:PE'),
                           _placement('terminal-stop-right', 'generic-end-stop', 100.8, 482.5, rail='rail-3', label='Endhalter'),
                           _placement('busbar-1', 'generic-busbar-30x5', 44, 605, label='Cu 30 × 5 · Nachweis offen')]
    profile_by_id = {item['id']: item for item in PROFILES}
    cutouts = [dict(x_mm=item['x_mm']-1, y_mm=item['y_mm']+15,
                   width_mm=profile_by_id[item['profile_id']]['width_mm']+2, height_mm=48)
               for item in placements if profile_by_id[item['profile_id']]['kind'] in ('switch', 'rcd', 'mcb', 'knx')]
    covers = [] if hv else [dict(id='cover-front', name='Freie Frontabdeckung · kein Herstellernachweis',
                                x_mm=0, y_mm=0, width_mm=inner_w, height_mm=inner_h, z_mm=0,
                                material='Freier Entwurf', thickness_mm=None, transparent=False,
                                color='#d7d8d2', source_id=None, cutouts=cutouts)]
    return dict(id='cabinet-1', name='HV 01' if hv else 'UV 01', kind='HV' if hv else 'UV',
                manufacturer='', system='Freier Feldaufbau' if hv else 'Freier Reihenaufbau', article='',
                width_mm=width, height_mm=height, depth_mm=depth, inner_width_mm=inner_w, inner_height_mm=inner_h,
                usable_depth_mm=None, color_outer='#d7d8d2', color_inner='#eeeeea',
                fields=fields, rails=rails, placements=placements, covers=covers, reserved_zones=zones)
