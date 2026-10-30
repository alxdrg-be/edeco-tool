"""Index verified article/VA source fields; keep raw calculations separate from checked recipes."""
import argparse,json,sqlite3
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]

def validate_record(record):
    number,va=record.get('number'),record.get('va')
    if record.get('year')!=2026 or not isinstance(number,str) or not number.isdigit() or not isinstance(va,str) or not va.isdigit():
        raise ValueError('Ungültiges Katalogjahr oder Artikel-/VA-Kennung')
    if record.get('capture_kind')=='catalogue_text_no_calculation':return False
    fields=record.get('basic_data',[])
    if not isinstance(fields,list) or any(not isinstance(f.get('label'),str) or not isinstance(f.get('value'),str) for f in fields):
        raise ValueError('Grunddaten müssen Original-Zeichenketten enthalten')
    if next((f['value'] for f in fields if f['label']=='Artikelnummer'),None)!=number:
        raise ValueError('Grunddaten gehören zu einem anderen Artikel')
    rows=record.get('rows',[])
    if rows and (rows[0]['cells'][1]!=number or rows[0]['cells'][2]!=va):
        raise ValueError('Kalkulationsquelle gehört zu einer anderen Artikel-/VA-Kombination')
    return True

def import_details(data_dir,publish_json=False):
    data_dir=Path(data_dir);folder=data_dir/'portal_capture/details';records=[]
    for path in sorted(folder.glob('*.json')):
        record=json.loads(path.read_text(encoding='utf-8-sig'))
        if path.stem!=record.get('number','')+'-'+record.get('va',''):raise ValueError('Quell-Dateiname passt nicht zur Artikel-/VA-Kennung')
        if validate_record(record):records.append(record)
    updates={};unknown=[]
    with sqlite3.connect(data_dir/'catalogue.sqlite') as db:
        for record in records:
            identity=f"2026:{record['number']}:{record['va']}"
            row=db.execute('SELECT data FROM variants WHERE id=?',(identity,)).fetchone()
            if not row:unknown.append(identity);continue
            variant=json.loads(row[0]);variant['basic_data']=record['basic_data']
            variant['portal_source']={'source':record['source'],'captured_at':record['captured_at'],'file':'portal_capture/details/'+record['number']+'-'+record['va']+'.json'}
            updates[identity]=variant
            db.execute('UPDATE variants SET data=? WHERE id=?',(json.dumps(variant,ensure_ascii=False,separators=(',',':')),identity))
        db.execute('INSERT OR REPLACE INTO metadata(key,value) VALUES(?,?)',('additional_portal_details',json.dumps(len(updates))))
    if publish_json:
        package=json.loads((data_dir/'assemblies.json').read_text(encoding='utf8'))
        for identity,variant in updates.items():package['variants'][identity]=variant
        package['metadata']['additional_portal_details']=len(updates)
        (data_dir/'assemblies.json').write_text(json.dumps(package,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    return {'indexed':len(updates),'unknown_variants':unknown,'raw_calculations':'Quellenarchiv; bestehende geprüfte Rezepte bleiben unverändert'}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--publish-json',action='store_true');args=parser.parse_args()
    print(json.dumps(import_details(ROOT/'data',args.publish_json),ensure_ascii=False))
