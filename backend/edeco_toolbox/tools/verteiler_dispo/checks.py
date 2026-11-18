"""Mechanical checks and explicit evidence gaps; never a conformity certificate.

The millimetre document is authoritative. Views cannot change these results.
Values supplied by a user are declarations; a source link alone is not proof of
an assembled cabinet's IP, temperature rise or short-circuit withstand.
"""

from __future__ import annotations

import hashlib
import json
import math
import re
from itertools import combinations

from .models import Analysis, DistributionDocument

EPSILON = 1e-6
MAX_ISSUES = 2000


def document_hash(document: DistributionDocument) -> str:
    payload = json.dumps(document.model_dump(mode='json'), ensure_ascii=False,
                         sort_keys=True, separators=(',', ':'), allow_nan=False)
    return hashlib.sha256(payload.encode('utf-8')).hexdigest()


def placement_rect(profile, placement) -> tuple[float, float, float, float]:
    """Top-left bounding rectangle in the inner mounting plane, after rotation."""
    width, height = profile.width_mm, profile.height_mm
    if placement.rotation in (90, 270):
        width, height = height, width
    return placement.x_mm, placement.y_mm, width, height


def _rect(record) -> tuple[float, float, float, float]:
    return record.x_mm, record.y_mm, record.width_mm, record.height_mm


def _inside(inner, outer) -> bool:
    x, y, w, h = inner
    ox, oy, ow, oh = outer
    return x >= ox - EPSILON and y >= oy - EPSILON and x + w <= ox + ow + EPSILON and y + h <= oy + oh + EPSILON


def _overlap(a, b, gap=0.0) -> bool:
    x, y, w, h = a
    xx, yy, ww, hh = b
    return x < xx + ww + gap - EPSILON and xx < x + w + gap - EPSILON and y < yy + hh + gap - EPSILON and yy < y + h + gap - EPSILON


def _union_length(intervals) -> float:
    total, end = 0.0, None
    for start, stop in sorted(intervals):
        if end is None or start > end:
            total += max(0, stop - start)
            end = stop
        elif stop > end:
            total += stop - end
            end = stop
    return total


def _rail_capacity(rails, occupied) -> tuple[float, float]:
    """Count each collinear physical rail section once, including occupied space.

    Overlapping rails are reported as conflicts separately. If contradictory
    pitches cover the same section, use the coarser pitch conservatively rather
    than inventing additional usable slots from an invalid duplicated rail.
    """
    groups = []
    for rail in rails:
        group = next((items for items in groups
                      if abs(items[0].y_mm - rail.y_mm) <= EPSILON
                      and abs(items[0].z_mm - rail.z_mm) <= EPSILON), None)
        if group is None:
            groups.append([rail])
        else:
            group.append(rail)
    capacity, used = 0.0, 0.0
    for group in groups:
        edges = sorted({x for rail in group for x in (rail.x_mm, rail.x_mm + rail.length_mm)})
        for start, stop in zip(edges, edges[1:]):
            if stop - start <= EPSILON:
                continue
            middle = (start + stop) / 2
            covering = [rail for rail in group if rail.x_mm <= middle <= rail.x_mm + rail.length_mm]
            if not covering:
                continue
            pitch = max(rail.te_pitch_mm for rail in covering)
            capacity += (stop - start) / pitch
            intervals = [(max(start, a), min(stop, b)) for rail in covering
                         for a, b in occupied[rail.id] if min(stop, b) > max(start, a)]
            used += _union_length(intervals) / pitch
    return capacity, used


def _n(value) -> str:
    return f'{value:g}'


def analyze(document: DistributionDocument) -> dict:
    if not isinstance(document, DistributionDocument):
        document = DistributionDocument.model_validate(document)
    cabinet = document.cabinet
    profiles = {profile.id: profile for profile in document.profiles}
    fields = {field.id: field for field in cabinet.fields}
    rails = {rail.id: rail for rail in cabinet.rails}
    active = [p for p in cabinet.placements if p.status != 'removed']
    issues, suppressed = [], 0
    placement_ids = {p.id for p in cabinet.placements}
    rail_ids = set(rails)
    field_ids = set(fields)
    cover_ids = {c.id for c in cabinet.covers}
    zone_ids = {z.id for z in cabinet.reserved_zones}

    def issue(code, severity, message, explanation, target=None, field='', actual='', expected='', sources=(), remedies=(), context=''):
        nonlocal suppressed
        if len(issues) >= MAX_ISSUES:
            suppressed += 1
            return
        target_id = target or cabinet.id
        if field and '.' not in field:
            if target_id in placement_ids:
                field = 'placement.' + field
            elif target_id in rail_ids:
                field = 'rail.' + field
            elif target_id in field_ids:
                field = 'field.' + field
            elif target_id in cover_ids:
                field = 'cover.' + field
            elif target_id in zone_ids:
                field = 'reserved_zone.' + field
            elif target_id == cabinet.id and field not in ('vnb_id',):
                field = 'cabinet.' + field
        issue_id = f'{code}:{target_id}:{field}' + (f':{context}' if context else '')
        issues.append({'id': issue_id, 'code': code, 'severity': severity,
                       'message': message[:2000], 'explanation': explanation[:2000], 'target_id': target_id,
                       'field': field, 'actual': str(actual)[:2000], 'expected': str(expected)[:2000],
                       'source_ids': list(dict.fromkeys(sources))[:30], 'remedies': list(remedies)})

    inner = (0.0, 0.0, cabinet.inner_width_mm, cabinet.inner_height_mm)
    if cabinet.inner_width_mm > cabinet.width_mm + EPSILON or cabinet.inner_height_mm > cabinet.height_mm + EPSILON:
        issue('cabinet-interior', 'error', 'Innenraum ist grösser als das Gehäuse.',
              'Aussenmasse und tatsächlich nutzbarer Innenraum müssen zusammenpassen.',
              field='inner_width_mm', actual=f'{_n(cabinet.inner_width_mm)} × {_n(cabinet.inner_height_mm)} mm',
              expected=f'höchstens {_n(cabinet.width_mm)} × {_n(cabinet.height_mm)} mm',
              remedies=['Innenmasse mit dem konkreten Gehäusedatenblatt abgleichen.'])
    if cabinet.usable_depth_mm is None:
        issue('cabinet-depth-open', 'open', 'Nutzbare Einbautiefe fehlt.',
              'Die Aussen-Gehäusetiefe ist nicht automatisch als Einbautiefe verfügbar.', field='usable_depth_mm',
              expected='Herstellerangabe zum nutzbaren Einbauraum', remedies=['Einbautiefe einschliesslich Tür- und Kabelraum dokumentieren.'])
    elif cabinet.usable_depth_mm > cabinet.depth_mm + EPSILON:
        issue('cabinet-depth', 'error', 'Einbautiefe übersteigt die Gehäusetiefe.',
              'Eine Montageebene kann nicht mehr nutzbare Tiefe als das Aussengehäuse bieten.', field='usable_depth_mm',
              actual=f'{_n(cabinet.usable_depth_mm)} mm', expected=f'höchstens {_n(cabinet.depth_mm)} mm',
              remedies=['Aussen- und Einbaumasse anhand derselben Herstellerzeichnung prüfen.'])
    if not cabinet.article or not cabinet.manufacturer:
        issue('cabinet-system-open', 'open', 'Herstellersystem ist noch nicht vollständig zugeordnet.',
              'Eine freie Geometrie ist ein Entwurf; Zubehör- und Systemkompatibilität sind damit nicht nachgewiesen.',
              field='article', remedies=['Konkreten Hersteller, System und Artikel mit Unterlagen hinterlegen.'])

    for field in cabinet.fields:
        if not _inside(_rect(field), inner):
            issue('field-bounds', 'error', f'Feld «{field.name}» liegt ausserhalb des Innenraums.',
                  'Feldkonturen beziehen sich auf den nutzbaren Innenraum, nicht auf das Aussengehäuse.',
                  field.id, 'x_mm', expected='vollständig innerhalb des Innenraums', remedies=['Feld verschieben oder Masse korrigieren.'])
    for rail in cabinet.rails:
        field = fields[rail.field_id]
        if (rail.x_mm < field.x_mm - EPSILON or rail.x_mm + rail.length_mm > field.x_mm + field.width_mm + EPSILON
                or rail.y_mm < field.y_mm - EPSILON or rail.y_mm > field.y_mm + field.height_mm + EPSILON):
            issue('rail-bounds', 'error', f'Schiene «{rail.name}» passt nicht in ihr Feld.',
                  'Schienenanfang, nutzbare Länge und Höhenlage müssen im zugehörigen Montagefeld liegen.',
                  rail.id, 'length_mm', remedies=['Schienenlänge und Lage oder Feldzuordnung korrigieren.'])
        if rail.z_mm < -EPSILON or (cabinet.usable_depth_mm is not None and rail.z_mm > cabinet.usable_depth_mm + EPSILON):
            issue('rail-depth', 'error', f'Schiene «{rail.name}» liegt ausserhalb der Einbautiefe.',
                  'Die z-Koordinate beschreibt die Montageebene von vorne nach hinten.', rail.id, 'z_mm',
                  actual=f'{_n(rail.z_mm)} mm', expected='innerhalb der nutzbaren Tiefe', remedies=['Montageebene korrigieren.'])

    for a, b in combinations(cabinet.rails, 2):
        overlap_mm = min(a.x_mm + a.length_mm, b.x_mm + b.length_mm) - max(a.x_mm, b.x_mm)
        if abs(a.y_mm - b.y_mm) <= EPSILON and abs(a.z_mm - b.z_mm) <= EPSILON and overlap_mm > EPSILON:
            issue('rail-overlap', 'error', f'Schienen «{a.name}» und «{b.name}» überlagern sich.',
                  'Gleiche Höhen- und Tiefenlage beansprucht denselben physischen Schienenabschnitt. Dieser Platz wird nicht doppelt als freie TE gezählt.',
                  a.id, 'length_mm', actual=f'{_n(overlap_mm)} mm Überlagerung',
                  expected='getrennte oder aneinander anschliessende Schienenabschnitte',
                  remedies=['Doppelte Schiene entfernen oder ihre Lage/Länge korrigieren.'], context=b.id)

    occupied = {rail.id: [] for rail in cabinet.rails}
    known_loss, missing_loss = 0.0, 0
    rectangles = {}
    for p in active:
        profile = profiles[p.profile_id]
        rect = placement_rect(profile, p)
        rectangles[p.id] = rect
        x, y, width, height = rect
        sources = profile.source_ids
        if profile.kind != 'reserve':
            if profile.power_loss_w is None:
                missing_loss += 1
            else:
                known_loss += profile.power_loss_w
        if not _inside(rect, inner):
            issue('placement-bounds', 'error', f'«{p.label or profile.name}» passt nicht in den Innenraum.',
                  'Die gesamte Gerätehülle muss innerhalb des nutzbaren Montagebereichs liegen.', p.id, 'x_mm',
                  actual=f'x={_n(x)}, y={_n(y)}, B={_n(width)}, H={_n(height)} mm',
                  expected=f'0…{_n(cabinet.inner_width_mm)} × 0…{_n(cabinet.inner_height_mm)} mm', sources=sources,
                  remedies=['Gerät in einen freien Montagebereich verschieben.', 'Grösseres Gehäuse oder passenden Artikel prüfen.'])
        if p.field_id and not _inside(rect, _rect(fields[p.field_id])):
            issue('placement-field', 'error', f'«{p.label or profile.name}» überschreitet sein Feld.',
                  'Die Feldzuordnung und die tatsächliche Position müssen zusammenpassen.', p.id, 'field_id',
                  sources=sources, remedies=['Richtige Feldzuordnung wählen oder Gerät verschieben.'])
        if profile.geometry_status != 'documented' or not profile.source_ids:
            issue('profile-geometry-open', 'open', f'Geometrie von «{p.label or profile.name}» ist nicht vollständig belegt.',
                  'Freie beziehungsweise manuell dokumentierte Abmessungen ergeben keine Hersteller-Systemfreigabe.',
                  p.id, 'profile_id', sources=sources, remedies=['Artikelbezogenes Datenblatt mit den Abmessungen zuordnen.'])
        if profile.mounting == 'din' and p.rail_id is None:
            issue('din-rail-required', 'error', f'«{p.label or profile.name}» hat keine Schienenzuordnung.',
                  'Ein als DIN-Gerät angelegtes Profil benötigt eine konkrete Tragschiene.', p.id, 'rail_id',
                  sources=sources, remedies=['Passende Schiene auswählen.'])
        if p.rail_id:
            rail = rails[p.rail_id]
            if p.field_id is not None and p.field_id != rail.field_id:
                issue('rail-field-mismatch', 'error', 'Schiene und Gerätefeld widersprechen sich.',
                      'Die ausgewählte Schiene liegt in einem anderen Feld als das Gerät.', p.id, 'field_id',
                      remedies=['Feld- und Schienenzuordnung angleichen.'])
            reserved_width = max(width, (profile.te or 0) * rail.te_pitch_mm) if profile.mounting == 'din' else width
            if x < rail.x_mm - EPSILON or x + reserved_width > rail.x_mm + rail.length_mm + EPSILON:
                issue('rail-capacity', 'error', f'«{p.label or profile.name}» überschreitet die Schienenlänge.',
                      'Zum Platzbedarf gehört die TE-Montageteilung; der Körper allein kann schmaler sein.', p.id, 'x_mm',
                      actual=f'{_n(reserved_width)} mm benötigter Montageplatz', expected=f'innerhalb {_n(rail.length_mm)} mm Schiene',
                      sources=sources, remedies=['Gerät in einen freien Schienenabschnitt verschieben.', 'Längere oder zusätzliche Reihe prüfen.'])
            if profile.mounting == 'din':
                start, stop = max(rail.x_mm, x), min(rail.x_mm + rail.length_mm, x + reserved_width)
                if stop > start:
                    occupied[rail.id].append((start, stop))
                if profile.te is not None and width > profile.te * rail.te_pitch_mm + EPSILON:
                    issue('te-width', 'error', 'Gerätebreite übersteigt den angegebenen TE-Platz.',
                          'Modulteilung und reale Gerätebreite stammen aus unterschiedlichen oder unvollständigen Angaben.',
                          p.id, 'profile_id', actual=f'{_n(width)} mm Körperbreite',
                          expected=f'höchstens {_n(profile.te * rail.te_pitch_mm)} mm für {_n(profile.te)} TE',
                          sources=sources, remedies=['Artikelmasse und Teilung der verwendeten Reihe abgleichen.'])
                if not (y - EPSILON <= rail.y_mm <= y + height + EPSILON):
                    issue('rail-height', 'error', 'Die Tragschiene liegt ausserhalb der Gerätehülle.',
                          'Gerät und zugeordnete Schiene liegen nicht auf derselben Montagehöhe.', p.id, 'y_mm',
                          sources=sources, remedies=['Geräteposition auf die zugehörige Schiene verschieben.'])
                if p.rotation:
                    issue('din-orientation-open', 'open', 'Gedrehte DIN-Montage benötigt eine Herstellerbestätigung.',
                          'Die Grafik kann gedreht werden; daraus folgt keine zulässige Einbaulage.', p.id, 'rotation',
                          sources=sources, remedies=['Zulässige Einbaulage für den konkreten Artikel dokumentieren.'])
        if p.z_mm < -EPSILON:
            issue('placement-depth-origin', 'error', 'Gerät liegt vor der definierten Montagegrenze.',
                  'Einbauposition z wird ab der Vorderseite des nutzbaren Einbauraums gemessen.', p.id, 'z_mm',
                  actual=f'{_n(p.z_mm)} mm', expected='mindestens 0 mm', remedies=['Einbautiefe korrigieren.'])
        if profile.kind != 'reserve':
            if profile.depth_mm is None:
                issue('device-depth-open', 'open', f'Gerätetiefe von «{p.label or profile.name}» fehlt.',
                      'Tiefenkollisionen und Türfreiheit sind ohne Gerätehülle und Kabelraum nicht vollständig prüfbar.',
                      p.id, 'profile.depth_mm', sources=sources, remedies=['Tiefe und Anschluss-/Kabelraum aus dem Datenblatt ergänzen.'])
            elif profile.depth_mm <= 0:
                issue('device-depth-zero', 'error', 'Ein physisches Gerät hat keine positive Tiefe.',
                      'Unbekannte Tiefe wird als offen geführt; null Millimeter ist keine Gerätehülle.', p.id, 'profile.depth_mm',
                      remedies=['Reale Tiefe ergänzen oder unbekannten Wert leer lassen.'])
            elif cabinet.usable_depth_mm is not None and p.z_mm + profile.depth_mm > cabinet.usable_depth_mm + EPSILON:
                issue('device-depth', 'error', f'«{p.label or profile.name}» ist zu tief eingebaut.',
                      'Einbauposition plus Gerätehülle überschreitet den dokumentierten nutzbaren Raum.', p.id, 'z_mm',
                      actual=f'{_n(p.z_mm + profile.depth_mm)} mm', expected=f'höchstens {_n(cabinet.usable_depth_mm)} mm',
                      sources=sources, remedies=['Montageposition oder Gehäusetiefe prüfen; Anschlussraum zusätzlich beachten.'])
        for zone in cabinet.reserved_zones:
            if profile.kind != 'reserve' and _overlap(rect, _rect(zone)):
                issue('reserved-zone', 'error', f'«{p.label or profile.name}» belegt «{zone.name}».',
                      'Dieser Bereich ist im Dokument ausdrücklich freizuhalten; die hinterlegte Quelle bestimmt seinen Zweck.',
                      p.id, 'x_mm', sources=[zone.source_id] if zone.source_id else [],
                      remedies=['Gerät aus dem gekennzeichneten Bereich verschieben.', 'Änderung der Reservierung fachlich abgleichen.'], context=zone.id)
        effective_field = fields.get(p.field_id or (rails[p.rail_id].field_id if p.rail_id else ''))
        if effective_field and effective_field.sealed:
            issue('sealed-field-open', 'open', 'Bestückung liegt in einem plombierbaren Feld.',
                  'Zulässige Geräte und Zugriffsmöglichkeiten sind mit dem konkreten VNB-/Messplatzprofil abzugleichen.',
                  p.id, 'field_id', remedies=['Bestückung und Plombierung mit der zuständigen Stelle bestätigen.'])
        if profile.kind == 'terminal' and not profile.terminal_kind:
            issue('terminal-type-open', 'open', 'Klemmenbauart ist nicht angegeben.',
                  'Push-in, Schraube, Etagen und Zubehörbreiten müssen artikelbezogen feststehen.', p.id, 'profile_id',
                  sources=sources, remedies=['Konkrete Klemme einschliesslich Endplatten und Endhaltern zuordnen.'])
        if profile.kind == 'busbar':
            area = None
            if profile.busbar_section_width_mm is not None and profile.busbar_section_thickness_mm is not None:
                area = profile.busbar_section_width_mm * profile.busbar_section_thickness_mm
            issue('busbar-evidence-open', 'open', 'Sammelschienensystem benötigt einen Aufbau-/Kurzschlussnachweis.',
                  'Der Kupferquerschnitt allein belegt weder Stromtragfähigkeit noch Halterabstände oder Kurzschlussfestigkeit.',
                  p.id, 'profile_id', actual=f'{_n(area)} mm² Querschnitt' if area is not None else 'Querschnitt unvollständig',
                  expected='Systemdaten für Leiter, Halter, Abdeckung und Einbaubedingungen', sources=sources,
                  remedies=['Freigegebenes Sammelschienensystem und zugehörige Bedingungen dokumentieren.'])

    for a, b in combinations(active, 2):
        pa, pb = profiles[a.profile_id], profiles[b.profile_id]
        ra, rb = rectangles[a.id], rectangles[b.id]
        planar = _overlap(ra, rb)
        if not planar:
            # Bodies can be narrower than their allocated TE mounting slots.
            # Continuous terminal profiles (te=None) keep their actual widths;
            # they are not silently rounded up to the row's module pitch.
            if (a.rail_id is not None and a.rail_id == b.rail_id
                    and pa.mounting == 'din' and pb.mounting == 'din'
                    and pa.te is not None and pb.te is not None):
                rail = rails[a.rail_id]
                wa = max(ra[2], pa.te * rail.te_pitch_mm)
                wb = max(rb[2], pb.te * rail.te_pitch_mm)
                overlap_mm = min(a.x_mm + wa, b.x_mm + wb) - max(a.x_mm, b.x_mm)
                if overlap_mm > EPSILON:
                    issue('rail-slot-collision', 'error', f'TE-Montageplätze von «{a.label or pa.name}» und «{b.label or pb.name}» überlagern sich.',
                          'Der benötigte TE-Montageplatz kann breiter als der sichtbare Gerätekörper sein. Beide Geräte beanspruchen denselben Platz auf der zugeordneten Schiene.',
                          a.id, 'x_mm', actual=f'{_n(overlap_mm)} mm überlagerter TE-Montageplatz',
                          expected='überlagerungsfreie Montageplätze gemäss Profil und Reihenraster', sources=pa.source_ids + pb.source_ids,
                          remedies=['Gerät auf den nächsten freien Montageplatz verschieben.', 'TE-Angaben und Teilung des gewählten Systems abgleichen.'], context=b.id)
            clearance = max(pa.clearance_mm, pb.clearance_mm)
            if clearance > 0 and _overlap(ra, rb, clearance):
                issue('device-clearance', 'warning', f'Freiraum zwischen «{a.label or pa.name}» und «{b.label or pb.name}» prüfen.',
                      'Die im Geräteprofil hinterlegte Freiraumvorgabe wird in der Projektion unterschritten; eine andere Montageebene ist gesondert zu beurteilen.',
                      a.id, 'x_mm', expected=f'{_n(clearance)} mm Profilvorgabe', sources=pa.source_ids + pb.source_ids,
                      remedies=['Freiraum beziehungsweise die getrennten Montageebenen anhand der Herstellerdaten prüfen.'], context=b.id)
            continue
        if pa.kind == 'reserve' or pb.kind == 'reserve':
            overlap = True
        elif pa.depth_mm is None or pb.depth_mm is None or pa.depth_mm <= 0 or pb.depth_mm <= 0:
            issue('collision-depth-open', 'open', f'Überlagerung von «{a.label or pa.name}» und «{b.label or pb.name}» ist in der Tiefe offen.',
                  'Die Frontprojektionen überlagern sich. Ohne beide realen Tiefen kann die räumliche Kollision nicht abschliessend entschieden werden.',
                  a.id, 'z_mm', sources=pa.source_ids + pb.source_ids,
                  remedies=['Einbauebenen und beide Gerätetiefen ergänzen.'], context=b.id)
            continue
        else:
            overlap = a.z_mm < b.z_mm + pb.depth_mm - EPSILON and b.z_mm < a.z_mm + pa.depth_mm - EPSILON
        if overlap:
            issue('device-collision', 'error', f'«{a.label or pa.name}» kollidiert mit «{b.label or pb.name}».',
                  'Die Gerätehüllen beziehungsweise eine explizite Platzreservierung überlagern sich. Die Position wurde nicht automatisch verändert.',
                  a.id, 'x_mm', sources=pa.source_ids + pb.source_ids,
                  remedies=['Eines der Geräte in einen freien Montagebereich verschieben.', 'Andere Montageebene nur mit dokumentierter Einbautiefe verwenden.'], context=b.id)

    for zone in cabinet.reserved_zones:
        if not _inside(_rect(zone), inner):
            issue('reserved-bounds', 'error', f'Reservierung «{zone.name}» liegt ausserhalb des Innenraums.',
                  'Eine Sperrfläche muss sich auf den verfügbaren Einbauraum beziehen.', zone.id, 'x_mm',
                  remedies=['Reservierungsgrenzen korrigieren.'])
    for cover in cabinet.covers:
        if not _inside(_rect(cover), inner):
            issue('cover-bounds', 'error', f'Abdeckung «{cover.name}» passt nicht in den Innenraum.',
                  'Die hinterlegte Abdeckung überschreitet ihren verfügbaren Montagebereich.', cover.id, 'width_mm',
                  remedies=['Abdeckung oder Montagebereich korrigieren.'])
        for index, cutout in enumerate(cover.cutouts):
            if not _inside(_rect(cutout), _rect(cover)):
                issue('cover-cutout', 'error', 'Abdeckungsausschnitt liegt ausserhalb der Abdeckung.',
                      'Ausschnittkoordinaten werden wie die Abdeckung im inneren Montagebereich gemessen.',
                      cover.id, f'cutouts.{index}', remedies=['Ausschnitt in die Abdeckung verschieben oder Masse korrigieren.'])
        if cover.z_mm < -EPSILON or (cabinet.usable_depth_mm is not None and cover.z_mm > cabinet.usable_depth_mm + EPSILON):
            issue('cover-depth', 'error', 'Abdeckung liegt ausserhalb der nutzbaren Tiefe.',
                  'Eine Abdeckung gehört zu einer konkreten Montageebene.', cover.id, 'z_mm', remedies=['Abdeckungsebene korrigieren.'])
        issue('cover-evidence-open', 'open', f'Schutzwirkung von «{cover.name}» ist nachzuweisen.',
              'Material, Dicke, Befestigung und Ausschnitte müssen zum freigegebenen System passen. Transparenz oder RAL-Farbe ergeben keinen Berührungsschutz.',
              cover.id, 'source_id', sources=[cover.source_id] if cover.source_id else [],
              remedies=['Freigegebene Abdeckung und zustandsbezogenen Schutzartnachweis dokumentieren.'])

    ratings = document.ratings
    for profile_id in dict.fromkeys(p.profile_id for p in active if profiles[p.profile_id].mounting == 'din'):
        profile = profiles[profile_id]
        placement = next(p for p in active if p.profile_id == profile_id)
        issue('din-mounting-datum-open', 'open', f'Montagebezug von «{profile.name}» ist gesondert zu bestätigen.',
              'Die gezeichnete Zentrierung zur Schiene ist eine Darstellungskonvention. Körpermasse allein belegen weder die Lage des DIN-Clips noch Anschlusstiefe und zulässige Einbaulage.',
              placement.id, 'profile_id', expected='Hersteller-Montagebezug und Einbau-/Anschlussräume', sources=profile.source_ids,
              remedies=['Montagezeichnung und Anschlussräume des konkreten Artikels prüfen.'])
    for name, label in [('rated_voltage_v', 'Bemessungsspannung'), ('rated_current_a', 'Bemessungsstrom')]:
        value = getattr(ratings, name)
        if value is None:
            issue(f'{name}-open', 'open', f'{label} fehlt.',
                  'Die Schaltgerätekombination benötigt einen dokumentierten Bemessungsstand.', field=f'ratings.{name}',
                  remedies=['Angabe mit Planungsgrundlage und Herstelleraufbau ergänzen.'])
        elif value <= 0:
            issue(f'{name}-positive', 'error', f'{label} muss positiv sein.',
                  'Null ist keine Bemessungsangabe; unbekannte Werte werden offen geführt.', field=f'ratings.{name}')
    for name in ('ip_closed', 'ip_open_covered', 'access_protection'):
        value = getattr(ratings, name).strip().upper()
        if value and not re.fullmatch(r'IP[0-6X][0-9X](?:[A-D])?(?:[HMSW])?', value):
            issue('ip-format', 'warning', 'Schutzartangabe hat kein eindeutiges IP-Format.',
                  'IP-Kennzeichnung und zusätzliche Zugangsbuchstaben müssen getrennt dem tatsächlichen Betriebszustand zugeordnet sein.',
                  field=f'ratings.{name}', actual=value, expected='zum Beispiel IP30 oder IPXXB')
    issue('ip-evidence-open', 'open', 'Schutzart und Zugangsschutz sind nicht durch die Zeichnung nachgewiesen.',
          'Türstellung, Abdeckungen, Ausschnitte und gesamter Aufbau müssen dem zugrunde liegenden Hersteller-/Prüfnachweis entsprechen.',
          field='ratings.ip_closed', sources=ratings.source_ids,
          remedies=['Nachweis für den tatsächlichen Betriebszustand prüfen; Angaben allein sind keine Freigabe.'])
    if ratings.icw_ka is not None and (ratings.icw_ka <= 0 or ratings.icw_duration_s is None or ratings.icw_duration_s <= 0):
        issue('icw-duration', 'error', 'Icw benötigt einen positiven Wert und eine zugehörige Zeitdauer.',
              'Ein Kurzzeitstrom ohne Bezugsdauer beschreibt keine vollständige Kurzschlussfestigkeit.', field='ratings.icw_duration_s',
              expected='Icw in kA zusammen mit der zugehörigen Dauer in s', sources=ratings.source_ids,
              remedies=['Kurzzeitstrom und Dauer aus demselben Systemnachweis übernehmen.'])
    if ratings.icc_ka is not None and (ratings.icc_ka <= 0 or not ratings.protective_device_ref.strip()):
        issue('icc-device', 'error', 'Bedingter Kurzschlussstrom benötigt das zugehörige Schutzgerät.',
              'Die bedingte Kurzschlussfestigkeit gilt nur mit dem im Nachweis festgelegten Schutzgerät und Aufbau.',
              field='ratings.protective_device_ref', sources=ratings.source_ids,
              remedies=['Konkretes vorgeschaltetes Schutzgerät und Anwendungsbedingungen zuordnen.'])
    if ratings.ipk_ka is not None and ratings.ipk_ka <= 0:
        issue('ipk-positive', 'error', 'Ipk muss ein positiver Scheitelstrom sein.',
              'Unbekannter Scheitelstrom bleibt offen.', field='ratings.ipk_ka')
    issue('assembly-short-circuit-open', 'open', 'Kurzschlussnachweis der Kombination bleibt offen.',
          'Angegebene Icw/Ipk- oder Icc-Werte müssen mit dem konkreten Aufbau und den Einbaubedingungen belegt sein; eine Quelle allein ist keine Prüfung.',
          field='ratings.icw_ka', sources=ratings.source_ids,
          remedies=['Anwendbaren Bauart-/Systemnachweis und zugehörige Schutzbedingungen fachlich prüfen.'])
    issue('thermal-evidence-open', 'open', 'Erwärmungsnachweis bleibt offen.',
          'Die Summe bekannter Geräteverluste ist keine vollständige Wärmeberechnung; Umgebung, Einbau, Belüftung und Gleichzeitigkeit fehlen.',
          field='ratings.notes', actual=f'{_n(known_loss)} W bekannt; {missing_loss} Geräte ohne Verlustangabe',
          remedies=['Alle Verlustdaten und die thermischen Bedingungen der Kombination dokumentieren.'])
    issue('assembly-verification-open', 'open', 'Bauart-/Stücknachweis und fachliche Freigabe dokumentieren.',
          'Geometrische Passung ersetzt weder die anwendbaren Nachweise nach SN EN IEC 61439 noch Hersteller- und Installationsvorgaben.',
          field='ratings.notes', sources=[s.id for s in document.sources if '61439' in s.title],
          remedies=['Zutreffenden Produktteil und Nachweise mit dem verantwortlichen Schrankbauer abstimmen.'])

    vnb_sources = [s.id for s in document.sources if document.vnb_id != 'none' and document.vnb_id in (s.id + ' ' + s.issuer).lower()]
    if document.vnb_id != 'none':
        issue('vnb-project-review-open', 'open', 'VNB-Vorgaben projektbezogen abgleichen.',
              'Vorlagen dokumentieren den Quellenstand, bestätigen aber weder Messart noch Betreiberfreigabe. Gebiet, Ausgabe und konkrete Anwendung müssen stimmen.',
              field='vnb_id', actual=document.vnb_profile_version or 'kein Profilstand angegeben', sources=vnb_sources,
              remedies=['Aktuelle Betreiberunterlagen und Mess-/Steuerkonzept für dieses Projekt bestätigen.'])
        if document.vnb_id == 'iwb' and cabinet.kind == 'HV' and not any(f.role == 'control' for f in cabinet.fields):
            issue('iwb-control-review-open', 'open', 'IWB-Steuer-/Kommunikationsplatz prüfen.',
                  'Die IWB-Fernausleseunterlagen behandeln TRE/STG beziehungsweise Kommunikationsplätze. Ein RSE wird daraus nicht pauschal als Pflichtgerät abgeleitet.',
                  field='vnb_id', sources=['iwb-remote'] if any(s.id == 'iwb-remote' for s in document.sources) else vnb_sources,
                  remedies=['Aktuelles Mess-/Steuerkonzept und erforderlichen Platz mit IWB abstimmen.'])
    if suppressed:
        issues.append({'id': 'issue-limit:' + cabinet.id, 'code': 'issue-limit', 'severity': 'warning',
                       'message': 'Weitere Hinweise wurden zusammengefasst.',
                       'explanation': 'Zuerst die angezeigten Konflikte korrigieren und erneut prüfen.',
                       'target_id': cabinet.id, 'field': '', 'actual': str(suppressed), 'expected': '',
                       'source_ids': [], 'remedies': ['Konflikte schrittweise beheben.']})
    total_te, occupied_te = _rail_capacity(cabinet.rails, occupied)
    result = {'issues': issues, 'occupied_te': round(occupied_te, 6), 'free_te': round(max(0, total_te - occupied_te), 6),
              'known_loss_w': round(known_loss, 6), 'missing_loss_count': missing_loss,
              'document_hash': document_hash(document)}
    # Bound aggregate values even for unusually large, otherwise valid documents.
    if not all(math.isfinite(result[key]) for key in ('occupied_te', 'free_te', 'known_loss_w')):
        raise ValueError('Die aggregierten Planungswerte sind nicht endlich.')
    return Analysis.model_validate(result).model_dump(mode='json')
