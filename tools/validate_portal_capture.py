"""Check original asset hashes, article/VA identity and catalogue-page coverage."""
import hashlib,json,struct
from pathlib import Path
from import_portal_details import validate_record

ROOT=Path(__file__).resolve().parents[1]

def image_size(data):
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return struct.unpack('>II',data[16:24])
    if data[:6] in (b'GIF87a',b'GIF89a'):
        return struct.unpack('<HH',data[6:10])
    if data[:2]==b'\xff\xd8':
        offset=2
        while offset<len(data):
            if data[offset]!=255:offset+=1;continue
            while data[offset]==255:offset+=1
            marker=data[offset];offset+=1
            if marker in (0x01,*range(0xD0,0xDA)):continue
            length=int.from_bytes(data[offset:offset+2],'big')
            if marker in (0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF):
                height,width=struct.unpack('>HH',data[offset+3:offset+7]);return width,height
            if length<2:break
            offset+=length
    if data[:4]==b'RIFF' and data[8:12]==b'WEBP':
        chunk,payload=data[12:16],data[20:]
        if chunk==b'VP8 ' and payload[3:6]==b'\x9d\x01\x2a':
            return int.from_bytes(payload[6:8],'little')&0x3fff,int.from_bytes(payload[8:10],'little')&0x3fff
        if chunk==b'VP8L' and payload[0]==0x2f:
            bits=int.from_bytes(payload[1:5],'little')
            return (bits&0x3fff)+1,((bits>>14)&0x3fff)+1
        if chunk==b'VP8X':
            return int.from_bytes(payload[4:7],'little')+1,int.from_bytes(payload[7:10],'little')+1
    raise ValueError('Unbekanntes oder beschädigtes Bildformat')

def validate(root=ROOT):
    root=Path(root);web=(root/'web').resolve();folder=root/'data/portal_capture'
    load=lambda path:json.loads(path.read_text(encoding='utf-8-sig'))
    inventory=load(web/'images/inventory.json');chapters=load(web/'images/chapters.json')
    files={};assignments={(e['number'],e['file'],va) for e in inventory for va in (e.get('vas') or [e.get('va')])}
    for entry in inventory+chapters:
        path=(web/entry['file']).resolve()
        if not path.is_relative_to(web/'images'):raise ValueError('Bildpfad ausserhalb des Inventars')
        if path not in files:
            content=path.read_bytes();files[path]=(hashlib.sha256(content).hexdigest(),image_size(content))
        digest,size=files[path]
        if digest!=entry['sha256'] or size!=(entry['width'],entry['height']):
            raise ValueError('Hash oder Originalauflösung stimmt nicht: '+entry['file'])
        if entry.get('catalogue_year')!=2026:raise ValueError('Falsches Bild-Katalogjahr')
    plans=load(folder/'plan.json');page_numbers={}
    for plan in plans:
        page=load(folder/'pages'/f"{plan['index']}.json")
        numbers={article['number'] for article in page['articles']}
        if page['year']!=2026 or page['page']!=plan['index'] or numbers!=set(plan['numbers']):
            raise ValueError('Katalogseite unvollständig oder falsch zugeordnet: '+plan['index'])
        page_numbers[plan['index']]=numbers
    targets={(t['number'],t['va']) for page in load(folder/'details-plan.json') for t in page['targets']}
    records=list((folder/'details').glob('*.json'));dialogs=0
    for path in records:
        record=load(path);number,va=record.get('number'),record.get('va')
        if path.stem!=f'{number}-{va}' or (number,va) not in targets:
            raise ValueError('Unbekannte Artikel-/VA-Quelle: '+path.name)
        if number not in page_numbers.get(record['portal_page'],set()):
            raise ValueError('Artikel gehört nicht zur Quellseite: '+path.name)
        dialogs+=int(validate_record(record))
        for image in record.get('images',[]):
            if image['number']!=number or image.get('va')!=va or (number,image['file'],va) not in assignments or (web/image['file']).resolve() not in files:
                raise ValueError('Grunddatenbild falsch zugeordnet: '+path.name)
    return {'catalogue_pages':len(plans),'image_articles':len({e['number'] for e in inventory}),
            'image_mappings':len(inventory),'original_files':len(files),'chapter_illustrations':len(chapters),
            'detail_records':len(records),'article_dialogs':dialogs,'planned_details':len(targets),
            'details_complete':len(records)==len(targets)}

if __name__=='__main__':print(json.dumps(validate(),ensure_ascii=False))
