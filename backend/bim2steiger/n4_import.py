"""Read placed Nova symbols from an N4D plan or an N4M model drawing.

The record layout is the one checked in NOVA-Legenden: dataset, sheet,
catalogue code, graphic and layer. Geschoss, Raum and Raumnummer are read
from the Bauteileigenschaften when that block is stored with the symbol.
Empty fields stay empty. Text elsewhere in the file is not used as a room.
"""
import io,re,struct
from collections import Counter

DATASET_PREFIXES=('Trimble.','Plancal.')
PICTURE_PATH=re.compile(r'^(elektro|novaleiste)[\\/]',re.I)
LAYER_NAME=re.compile(r'^(E_|X_)[\w.\-äöüÄÖÜ ]+$')


class _String:
    def __init__(self,offset,text):self.offset=offset;self.text=text


def read_cstrings(buf):
    out=[];start=0
    while True:
        mark=buf.find(b'\xff\xfe\xff',start)
        if mark<0:break
        pos=mark+3
        if pos>=len(buf):break
        length=buf[pos];pos+=1
        if length==0xFF:
            if pos+2>len(buf):break
            length=struct.unpack_from('<H',buf,pos)[0];pos+=2
        raw=buf[pos:pos+2*length]
        if len(raw)!=2*length:start=mark+1;continue
        out.append(_String(mark,raw.decode('utf-16le','replace')))
        start=pos+2*length
    return out


def _strip_guid(text):
    if len(text)>8 and any(ord(char)>0x2FF for char in text[-8:]):return text[:-8]
    return text


def symbols_from_elements(elements):
    strings=read_cstrings(elements)
    objects=[];current=None;last_name='';last_name_at=-1;used_name_at=-2;current_name_at=-3
    for index,item in enumerate(strings):
        text=item.text
        if index+1<len(strings) and PICTURE_PATH.match(strings[index+1].text):
            last_name=_strip_guid(text);last_name_at=item.offset
        if text.startswith(DATASET_PREFIXES) and index+2<len(strings):
            sheet,code=strings[index+1].text,strings[index+2].text
            nxt=strings[index+3].text if index+3<len(strings) else ''
            if nxt.startswith('2D-'):
                if current and current['item']==code and not current['graphic_id']:
                    current['graphic_id']=nxt
                    current['graphic_name']=strings[index+4].text if index+4<len(strings) else ''
                continue
            if current and not current['graphic_id'] and current['item']==code and current_name_at==last_name_at and item.offset-current['offset']<3000:
                continue
            name=last_name if last_name_at!=used_name_at else ''
            used_name_at=current_name_at=last_name_at
            current={'name':name,'dataset':text,'sheet':sheet,'item':code,'graphic_id':'','graphic_name':'','layer':'','offset':item.offset}
            objects.append(current)
        elif current and not current['layer'] and LAYER_NAME.match(text):
            current['layer']=text
    objects=[item for item in objects if not item['sheet'].startswith('Label_')]
    _attach_properties(objects,_property_blocks(strings))
    return objects


# The property block always starts with this key/value sequence. Later keys
# stay on the same alternating stride until the next block.
_PROPERTY_PREFIX=('Gebäude','Raumnummer','PosNr','Bez','Bem','Raum','Geschoss')
_PROPERTY_KEYS=set(_PROPERTY_PREFIX)|{
    'GlobalID','Schaltkreis','Schutzart','Schutzart IP','Spannung in V','Leistung in kW',
    'Länge in mm','Breite in mm','Höhe in mm','Anlage','System','eBKP-H','Kurzzeichen',
    'Bemerkung','Typname','Wohneinheit','Anschlussart',
}
_PROPERTY_BLANKS={'','nicht_definiert','jjjj-mm-dd','Link','CHF','Lieferantenfirma','Herstellerfirma','Servicefirma','AKSID','Serial','RFx','D1.x','Etappe_x','Text','?!'}


def _clean_property(value):
    text=str(value or '').strip()
    return '' if text in _PROPERTY_BLANKS else text


def _property_blocks(strings):
    texts=[item.text for item in strings]
    starts=[];limit=len(strings)-(2*len(_PROPERTY_PREFIX))
    for index in range(max(0,limit)):
        if all(texts[index+2*step]==key for step,key in enumerate(_PROPERTY_PREFIX)):starts.append(index)
    blocks=[]
    for pos,start in enumerate(starts):
        end=starts[pos+1] if pos+1<len(starts) else min(len(strings),start+360)
        values={}
        for index in range(start,end-1,2):
            key=texts[index]
            if key in _PROPERTY_KEYS:
                cleaned=_clean_property(texts[index+1])
                values[key]='' if cleaned==key else cleaned
        values['_offset']=strings[start].offset
        blocks.append(values)
    return blocks


def _room_label(number,name):
    if number and name and number!=name:return f'{number} · {name}'
    return number or name


def _attach_properties(symbols,blocks):
    """Bind a property block to the symbol it precedes. Same Bezeichnung, within 12'000 bytes."""
    grouped={}
    for block in blocks:grouped.setdefault(block.get('Bez') or '',[]).append(block)
    used=set()
    for symbol in symbols:
        chosen=None
        for block in grouped.get(symbol['name'],()):
            if id(block) in used:continue
            delta=symbol['offset']-block['_offset']
            if 0<delta<12000 and (chosen is None or delta<chosen[0]):chosen=(delta,block)
        if not chosen:continue
        block=chosen[1];used.add(id(block))
        symbol['room_number']=block.get('Raumnummer') or ''
        symbol['room_name']=block.get('Raum') or ''
        symbol['room']=_room_label(symbol['room_number'],symbol['room_name'])
        symbol['storey']=block.get('Geschoss') or ''
        symbol['system']=block.get('Anlage') or block.get('System') or ''
        symbol['nova_properties']={key:value for key,value in {
            'global_id':block.get('GlobalID') or '','circuit':block.get('Schaltkreis') or '',
            'protection':block.get('Schutzart') or '','ip':block.get('Schutzart IP') or '',
            'voltage_v':block.get('Spannung in V') or '','power_kw':block.get('Leistung in kW') or '',
            'length_mm':block.get('Länge in mm') or '','width_mm':block.get('Breite in mm') or '',
            'height_mm':block.get('Höhe in mm') or '','ebkp':block.get('eBKP-H') or '',
            'short_sign':block.get('Kurzzeichen') or '','note':block.get('Bemerkung') or block.get('Bem') or '',
            'type_name':block.get('Typname') or '','dwelling':block.get('Wohneinheit') or '',
            'connection':block.get('Anschlussart') or '','position':block.get('PosNr') or '',
        }.items() if value}


def _elements_stream(raw):
    try:import olefile
    except ImportError as exc:
        raise ValueError('Für N4D/N4M fehlt das Paket olefile. pip install olefile') from exc
    try:ole=olefile.OleFileIO(io.BytesIO(raw))
    except Exception as exc:
        raise ValueError('Die Datei ist kein Nova-N4D/N4M (OLE). Es wird keine Struktur geraten.') from exc
    try:
        if not ole.exists('Elements'):raise ValueError('Die Nova-Datei enthält keinen Elements-Strom.')
        return ole.openstream('Elements').read()
    finally:ole.close()


def import_n4(filename,raw):
    if not isinstance(raw,(bytes,bytearray)):raise ValueError('N4D/N4M müssen als Binärdatei gelesen werden.')
    symbols=symbols_from_elements(_elements_stream(bytes(raw)))
    if not symbols:raise ValueError('Keine Nova-Apparate mit Datensatzkennung gefunden.')
    elements=[]
    for index,symbol in enumerate(symbols,1):
        props=dict(symbol.get('nova_properties') or {})
        elements.append({'id':f'{filename}:{symbol["offset"]}:{index}','guid':'','ifc_class':'NovaSymbol','name':symbol['name'] or symbol['item'],
            'room':symbol.get('room') or '','room_number':symbol.get('room_number') or '','room_name':symbol.get('room_name') or '',
            'storey':symbol.get('storey') or '','system':symbol.get('system') or '','placement':symbol['layer'],'quantity':1,'unit':'','number':'','va':'','bkp':'',
            'source_file':filename,'source_row':index,
            'properties':{'dataset':symbol['dataset'],'sheet':symbol['sheet'],'nova_item':symbol['item'],'graphic_id':symbol['graphic_id'],
                'graphic_name':symbol['graphic_name'],'layer':symbol['layer'],
                'quantity_basis':'1 je platziertes Nova-Objekt. Keine gemessene Leitungslänge.',
                'room_source':'Bauteileigenschaft' if symbol.get('room') or symbol.get('storey') else '',**props}})
    layers=sorted({item['placement'] for item in elements if item['placement']})
    with_storey=sum(1 for item in elements if item['storey']);with_room=sum(1 for item in elements if item['room'])
    warnings=[
        'N4D/N4M: Apparate werden wie in NOVA-Legenden gelesen (Datensatz, Kennung, Layer). Geschoss, Raum und Raumnummer kommen aus den Bauteileigenschaften, wenn sie gefüllt sind.',
        f'{with_storey} von {len(elements)} Apparaten haben ein Geschoss, {with_room} einen Raum. Leere Felder bleiben leer.',
        f'{len(elements)} platzierte Apparate'+(f' auf {len(layers)} Layern.' if layers else '.'),
    ]
    counts=Counter(item['properties']['nova_item'] for item in elements)
    warnings.append('Nova-Kennungen sind keine Steiger-Artikelnummern. Die häufigste Kennung ist '+counts.most_common(1)[0][0]+'.')
    return elements,warnings
