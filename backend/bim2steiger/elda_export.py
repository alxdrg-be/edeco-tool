"""Messerli exchange file, written in the layout of the 2026 DAT sample.

Records are cp850, separated by CRLF. A calculation line carries the Steiger
article, the VA and the quantity in thousandths. Prices stay zero: the tender
has no contract prices. The chapter tree uses the BKP code on each line.
"""
import re
from decimal import Decimal, ROUND_HALF_UP

# Tokens taken from the 2026 exchange file. They mark the file, not a price.
_HEADER_PREFIX = 'A 3ASCII-8 0041E000D2626K'
_GA_PREFIX = 'GAE000D0026K'
_CODE = re.compile(r'(?<![A-Za-z0-9])(\d{2,3}(?:\.\d+)*)(?![A-Za-z0-9])')
_TITLE_WIDTH = 45
_TEXT_WIDTH = 70


def bkp_code(value):
    match = _CODE.search(str(value or ''))
    return match.group(1) if match else ''


def bkp_nodes(code):
    """Chapter path in the order the exchange file writes it.

    232.51.1 becomes 23, 232, 232.5, 232.51, 232.51.1. The first extra digit
    after the group is its own level, as in 231.2 above 231.21.
    """
    parts = str(code or '').split('.')
    group = parts[0]
    if not group.isdigit():
        return [code] if code else []
    nodes = [group[:2]] if len(group) >= 2 else []
    if len(group) > 2:
        nodes.append(group)
    current = nodes[-1] if nodes else group
    for segment in parts[1:]:
        if segment.isdigit() and len(segment) > 1:
            current = f'{current}.{segment[0]}'
            nodes.append(current)
            current = f'{current}{segment[1:]}'
            nodes.append(current)
        else:
            current = f'{current}.{segment}' if segment else current
            nodes.append(current)
    unique = []
    for node in nodes:
        if node not in unique:
            unique.append(node)
    return unique


def titles_from_navigation(records):
    """Map a BKP code to the catalogue chapter name, when that chapter exists."""
    titles = {}
    for record in records or []:
        for path in record.get('chapters') or []:
            if not path or path[0] != 'Komplett-Installationen':
                continue
            for label in path[1:]:
                text = str(label).strip()
                code = bkp_code(text)
                if not code or not text.startswith(code) or code in titles:
                    continue
                rest = text[len(code):].strip(' -–')
                if rest:
                    titles[code] = rest
    return titles


def _sort_key(code):
    key = []
    for segment in code.split('.'):
        key.append((0, int(segment)) if segment.isdigit() else (1, segment))
    return key


def _thousandths(value):
    text = str(value).strip().replace(' ', '')
    if ',' in text and '.' in text:
        text = text.replace('.', '').replace(',', '.')
    elif ',' in text:
        text = text.replace(',', '.')
    amount = Decimal(text)
    if not amount.is_finite():
        raise ValueError('Menge ist keine Zahl.')
    scaled = (amount * 1000).to_integral_value(rounding=ROUND_HALF_UP)
    if abs(scaled) > 10**13 - 1:
        raise ValueError('Menge passt nicht in die Messerli-Datei.')
    return int(scaled)


def chapter_lines(code, title, depth):
    title = ' '.join(str(title or code).split()) or str(code)
    chunks = [title[i:i + _TITLE_WIDTH] for i in range(0, len(title), _TITLE_WIDTH)] or [str(code)]
    first = f'GF         LA:{code}'.ljust(33) + ('001' + chunks[0]).ljust(48)
    lines = [first + ' T' + f'{depth:+016d}'.rjust(29)]
    for index, chunk in enumerate(chunks[1:], start=2):
        lines.append('GF'.ljust(33) + f'{index:03d}' + chunk)
    return lines


def text_lines(text):
    text = ' '.join(str(text or '').split())
    chunks = [text[i:i + _TEXT_WIDTH] for i in range(0, len(text), _TEXT_WIDTH)] or ['']
    return [('N ' + f'{index:03d}' + chunk).ljust(75) + 'K' for index, chunk in enumerate(chunks, start=1)]


def calculation_line(number, quantity, va):
    """One Steiger calculation line. Quantity is stored in thousandths."""
    number = str(number).strip().replace(' ', '')
    va = str(va).strip()
    if va.isdigit() and len(va) < 2:
        va = va.zfill(2)
    scaled = _thousandths(quantity)
    line = _GA_PREFIX + (' ' * 12) + number
    line = line if len(line) > 68 else line.ljust(68)
    return line + f'{scaled:+014d}' + 'N' + f'{0:+013d}' + f'{0:+013d}' + va


def _position_text(line):
    if 'export_text' in line and line.get('export_text') is not None:
        return ' '.join(str(line.get('export_text')).split())
    parts = [str(line.get('name') or '').strip()]
    for key in ('storey', 'room'):
        value = str(line.get(key) or '').strip()
        if value:
            parts.append(value)
    return ', '.join(part for part in parts if part)


def _outline(items):
    """User chapters: a title replaces the catalogue name, texts become N lines."""
    titles, texts, codes = {}, {}, []
    for item in items or []:
        if not isinstance(item, dict):
            continue
        code = bkp_code(item.get('code'))
        if not code:
            continue
        title = ' '.join(str(item.get('title') or '').split())
        raw = item.get('texts') or []
        if isinstance(raw, str):
            raw = [raw]
        blocks = [' '.join(str(block).split()) for block in raw]
        blocks = [block for block in blocks if block]
        if title:
            titles[code] = title
        if blocks:
            texts[code] = blocks
        if title or blocks:
            codes.append(code)
    return titles, texts, codes


def export_messerli(lines, project='', chapter_titles=None, catalogue_year=2026, outline=None):
    """Return the DAT bytes and warnings. Lines without BKP, article or VA are left out."""
    titles = dict(chapter_titles or {})
    outline_titles, chapter_texts, outline_codes = _outline(outline)
    titles.update(outline_titles)
    grouped = {}
    skipped = 0
    years = set()
    for line in lines or []:
        code = bkp_code(line.get('bkp'))
        number = str(line.get('number') or '').strip().replace(' ', '')
        va = str(line.get('va') or '').strip()
        if not code or not number.isdigit() or not va.isdigit() or line.get('quantity') is None:
            skipped += 1
            continue
        try:
            _thousandths(line.get('quantity'))
        except (ValueError, ArithmeticError):
            skipped += 1
            continue
        grouped.setdefault(code, []).append(line)
        if line.get('catalogue_year'):
            years.add(str(line.get('catalogue_year')))
    for code in outline_codes:
        grouped.setdefault(code, [])
    if not any(grouped.values()) and not outline_codes:
        raise ValueError('Keine Position und kein Kapitel für die Messerli-Datei.')
    warnings = []
    if skipped == 1:
        warnings.append('1 Position ohne BKP, Artikelnummer oder VA steht nicht in der Messerli-Datei.')
    elif skipped:
        warnings.append(f'{skipped} Positionen ohne BKP, Artikelnummer oder VA stehen nicht in der Messerli-Datei.')
    if years and years != {'2026'}:
        warnings.append('Die Austauschkennung stammt aus der Messerli-Datei 2026.')
    records = [
        (_HEADER_PREFIX + f'BIM2STEIGER {catalogue_year or 2026}').ljust(123) + 'BKP',
        ('CA'.ljust(76) + ' '.join(str(project or 'BIM2STEIGER').split())).ljust(122),
        'CB'.ljust(105),
    ]
    written = set()
    for code in sorted(grouped, key=_sort_key):
        for node in bkp_nodes(code):
            if node in written:
                continue
            written.add(node)
            records.extend(chapter_lines(node, titles.get(node) or node, len(bkp_nodes(node))))
            for block in chapter_texts.get(node) or []:
                records.extend(text_lines(block))
        for line in grouped[code]:
            text = _position_text(line)
            if text:
                records.extend(text_lines(text))
            records.append(calculation_line(line.get('number'), line.get('quantity'), line.get('va')))
    records.append('GK' + (' ' * 111) + 'U')
    records.append('GK' + (' ' * 111) + 'U')
    # The sample trailer equals the line count minus three. With this same
    # opening (A, CA, CB) and closing (two GK, one Z) that is also the count
    # of every line except Z and the two GK lines.
    records.append(f'Z    {len(records) - 2:010d}')
    text = '\r\n'.join(records) + '\r\n'
    try:
        payload = text.encode('cp850')
    except UnicodeEncodeError:
        payload = text.encode('cp850', errors='replace')
        warnings.append('Einzelne Zeichen gibt es in der Messerli-Kodierung nicht und wurden ersetzt.')
    return payload, warnings
