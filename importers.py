"""Model import: CSV/JSON, IFC rooms, and Nova N4D/N4M symbols."""
import csv,io,json,math
from pathlib import Path

from ifc_import import import_ifc
from n4_import import import_n4

ALIASES={'artikelnummer':'number','artikel':'number','article_number':'number','bezeichnung':'name','raum':'room','geschoss':'storey','anlage':'system','menge':'quantity','anzahl':'quantity','einheit':'unit','verlegeart':'va','bkp_nummer':'bkp','globalid':'guid','ifcclass':'ifc_class'}
def normalize_record(record,index,filename):
    row={ALIASES.get(str(k).strip().lower(),str(k).strip().lower()):v for k,v in record.items()}
    quantity=row.get('quantity',1)
    if quantity in ('',None):raise ValueError(f'Zeile {index}: Menge fehlt')
    try:quantity=float(str(quantity).replace(',','.'))
    except ValueError:raise ValueError(f'Zeile {index}: Menge ist keine Zahl')
    if not math.isfinite(quantity) or quantity<0:raise ValueError(f'Zeile {index}: Menge muss endlich und mindestens null sein')
    def text(k):return str(row.get(k,'') or '').strip()
    return {'id':text('id') or text('guid') or f'{filename}:row:{index}','guid':text('guid'),'ifc_class':text('ifc_class'),'name':text('name'),'room':text('room'),'storey':text('storey'),'system':text('system'),'placement':text('placement'),'quantity':quantity,'unit':text('unit'),'number':text('number').replace(' ',''),'va':text('va'),'bkp':text('bkp'),'source_file':filename,'source_row':index,'properties':row.get('properties',{})}
def import_neutral(filename,text):
    text=text.lstrip('\ufeff')
    ext=Path(filename).suffix.lower()
    if ext in ('.n4d','.n4m','.ifc'):
        raise ValueError('Diese Datei ist binär oder STEP. import_model verwenden, nicht den CSV/JSON-Leser.')
    if ext=='.json':
        obj=json.loads(text);records=obj if isinstance(obj,list) else obj.get('elements',obj.get('objects'))
        if not isinstance(records,list):raise ValueError('JSON benötigt eine Liste oder ein Objekt mit elements/objects als Liste')
    elif ext=='.csv':
        try:dialect=csv.Sniffer().sniff(text[:8192],delimiters=',;\t')
        except csv.Error:dialect=csv.excel
        records=list(csv.DictReader(io.StringIO(text),dialect=dialect))
    else:raise ValueError('Unterstützt werden CSV, JSON, IFC, N4D und N4M.')
    out=[];ids=set()
    for i,r in enumerate(records,1):
        if not isinstance(r,dict):raise ValueError(f'Zeile {i}: Objekt erwartet')
        item=normalize_record(r,i,filename)
        if item['id'] in ids:raise ValueError(f'Doppelte Objekt-ID: {item["id"]}. Eindeutige IDs sind für nachvollziehbare Mengen erforderlich.')
        ids.add(item['id']);out.append(item)
    return out
def _decode_text(payload):
    if isinstance(payload,str):return payload
    for encoding in ('utf-8-sig','cp1252','latin-1'):
        try:return payload.decode(encoding)
        except UnicodeDecodeError:continue
    return payload.decode('latin-1')
def import_model(filename,payload):
    """Return (elements, warnings). CSV and JSON produce no warnings."""
    ext=Path(filename).suffix.lower()
    if ext in ('.n4d','.n4m'):
        raw=payload if isinstance(payload,(bytes,bytearray)) else None
        if raw is None:raise ValueError('N4D/N4M müssen als Binärdatei gesendet werden.')
        return import_n4(filename,raw)
    text=_decode_text(payload) if not isinstance(payload,str) else payload
    if ext=='.ifc':return import_ifc(filename,text)
    if ext in ('','.csv','.json'):return import_neutral(filename,text),[]
    raise ValueError('Unterstützt werden CSV, JSON, IFC, N4D und N4M.')
