"""Read electrical IFC objects and the room stored on their IfcSpace.

Room number is the IFC Name of the space. Room name is its LongName.
That is the usual split in IFC. Both values stay visible, so a swapped
export is still readable. No length, area or Steiger article is invented.
"""
import re

ELECTRICAL={
    'IFCOUTLET','IFCLIGHTFIXTURE','IFCSWITCHINGDEVICE','IFCLAMP','IFCELECTRICAPPLIANCE',
    'IFCELECTRICDISTRIBUTIONBOARD','IFCELECTRICDISTRIBUTIONPOINT','IFCELECTRICFLOWSTORAGEDEVICE',
    'IFCELECTRICGENERATOR','IFCELECTRICMOTOR','IFCELECTRICTIMECONTROL','IFCJUNCTIONBOX',
    'IFCCABLECARRIERFITTING','IFCCABLECARRIERSEGMENT','IFCCABLEFITTING','IFCCABLESEGMENT',
    'IFCPROTECTIVEDEVICE','IFCPROTECTIVEDEVICETRIPPINGUNIT','IFCSENSOR','IFCALARM','IFCACTUATOR',
    'IFCCONTROLLER','IFCFLOWINSTRUMENT','IFCUNITARYCONTROLELEMENT','IFCCOMMUNICATIONSAPPLIANCE',
    'IFCAUDIOVISUALAPPLIANCE','IFCFLOWTERMINAL','IFCDISTRIBUTIONELEMENT','IFCBUILDINGELEMENTPROXY',
}
SPATIAL={'IFCSPACE','IFCBUILDINGSTOREY','IFCBUILDING','IFCSITE','IFCPROJECT','IFCSPATIALZONE'}


def _decode_ifc_text(value):
    if not value:return ''
    def hex_chars(blob,width):
        return ''.join(chr(int(blob[i:i+width],16)) for i in range(0,len(blob)-len(blob)%width,width))
    value=re.sub(r'\\X2\\([0-9A-Fa-f]+)\\X0\\',lambda m:hex_chars(m.group(1),4),value)
    value=re.sub(r'\\X4\\([0-9A-Fa-f]+)\\X0\\',lambda m:hex_chars(m.group(1),8),value)
    value=re.sub(r'\\X\\([0-9A-Fa-f]{2})',lambda m:chr(int(m.group(1),16)),value)
    return value.replace("\\'","'").strip()


def _parse_args(text):
    args=[];i=0;n=len(text)
    def skip():
        nonlocal i
        while i<n and text[i] in ' \r\n\t':i+=1
    while i<n:
        skip()
        if i>=n:break
        ch=text[i]
        if ch==')':break
        if ch==',':i+=1;continue
        if ch in '$*':args.append(None);i+=1
        elif ch=="'":
            i+=1;buf=[]
            while i<n:
                if text[i]=="'" and i+1<n and text[i+1]=="'":buf.append("'");i+=2
                elif text[i]=="'":i+=1;break
                else:buf.append(text[i]);i+=1
            args.append(''.join(buf))
        elif ch=='#':
            i+=1;start=i
            while i<n and text[i].isdigit():i+=1
            args.append(int(text[start:i]))
        elif ch=='(':
            depth=0;start=i
            while i<n:
                if text[i]=="'":
                    i+=1
                    while i<n:
                        if text[i]=="'" and i+1<n and text[i+1]=="'":i+=2
                        elif text[i]=="'":i+=1;break
                        else:i+=1
                    continue
                if text[i]=='(':depth+=1
                elif text[i]==')':
                    depth-=1
                    if depth==0:i+=1;break
                i+=1
            args.append(_parse_args(text[start+1:i-1]))
        elif ch=='.':
            end=text.find('.',i+1)
            if end<0:break
            args.append(text[i:end+1]);i=end+1
        else:
            start=i
            while i<n and text[i] not in ',)':i+=1
            args.append(text[start:i].strip())
    return args


def _entities(text):
    start=text.upper().find('DATA;')
    if start<0:raise ValueError('Die Datei enthält keinen IFC-DATA-Abschnitt.')
    body=text[start+5:]
    end=body.upper().find('ENDSEC;')
    if end>=0:body=body[:end]
    i=0;n=len(body)
    while i<n:
        if body[i]!='#':i+=1;continue
        j=i+1
        while j<n and body[j].isdigit():j+=1
        if j==i+1 or j>=n or body[j]!='=':i+=1;continue
        eid=int(body[i+1:j]);j+=1
        while j<n and body[j].isspace():j+=1
        k=j
        while k<n and (body[k].isalnum() or body[k]=='_'):k+=1
        kind=body[j:k].upper()
        if k>=n or body[k]!='(':i=k;continue
        depth=0;p=k
        while p<n:
            if body[p]=="'":
                p+=1
                while p<n:
                    if body[p]=="'" and p+1<n and body[p+1]=="'":p+=2
                    elif body[p]=="'":p+=1;break
                    else:p+=1
                continue
            if body[p]=='(':depth+=1
            elif body[p]==')':
                depth-=1
                if depth==0:p+=1;break
            p+=1
        yield eid,kind,_parse_args(body[k+1:p-1])
        i=p


def _text(args,index):
    if index>=len(args) or not isinstance(args[index],str):return ''
    return _decode_ifc_text(args[index])


def _refs(value):
    if isinstance(value,int):return [value]
    if isinstance(value,list):
        out=[]
        for item in value:out.extend(_refs(item))
        return out
    return []


def _label(number,name):
    if number and name and number!=name:return f'{number} · {name}'
    return number or name


def import_ifc(filename,text):
    rows={}
    for eid,kind,args in _entities(text):rows[eid]=(kind,args)
    if not rows:raise ValueError('Die IFC-Datei enthält keine lesbaren Objekte.')
    spaces={};storeys={};contained={};boundaries={};referenced={};parent={}
    for eid,(kind,args) in rows.items():
        if kind=='IFCSPACE':spaces[eid]=(_text(args,2),_text(args,7))
        elif kind=='IFCBUILDINGSTOREY':storeys[eid]=_text(args,2)
        elif kind in ('IFCRELCONTAINEDINSPATIALSTRUCTURE','IFCRELREFERENCEDINSPATIALSTRUCTURE'):
            target=contained if kind=='IFCRELCONTAINEDINSPATIALSTRUCTURE' else referenced
            structure=args[5] if len(args)>5 and isinstance(args[5],int) else None
            if structure is None:continue
            for ref in _refs(args[4] if len(args)>4 else None):target.setdefault(ref,[]).append(structure)
        elif kind=='IFCRELSPACEBOUNDARY' and len(args)>5 and isinstance(args[4],int) and isinstance(args[5],int):
            boundaries.setdefault(args[5],[]).append(args[4])
        elif kind=='IFCRELAGGREGATES' and len(args)>5 and isinstance(args[4],int):
            for child in _refs(args[5]):parent.setdefault(child,args[4])
    def ancestors(start):
        seen=[];current=start
        while isinstance(current,int) and current not in seen:
            seen.append(current);current=parent.get(current)
        return seen
    def storey_name(ids):
        for eid in ids:
            if eid in storeys and storeys[eid]:return storeys[eid]
            for older in ancestors(eid):
                if older in storeys and storeys[older]:return storeys[older]
        return ''
    elements=[];ambiguous=0
    for eid,(kind,args) in rows.items():
        if kind not in ELECTRICAL:continue
        guid=_text(args,0)
        name=_text(args,2) or _text(args,4) or kind
        space_ids=[]
        for source in (contained.get(eid,[]),boundaries.get(eid,[]),referenced.get(eid,[])):
            found=[ref for ref in source if ref in spaces]
            if found:space_ids=found;break
        unique=[]
        for ref in space_ids:
            if ref not in unique:unique.append(ref)
        room_number=room_name=room=source=''
        candidates=[]
        if len(unique)==1:
            room_number,room_name=spaces[unique[0]]
            room=_label(room_number,room_name)
            source='IfcSpace'
        elif len(unique)>1:
            ambiguous+=1
            candidates=[_label(*spaces[ref]) for ref in unique]
        storey=storey_name(contained.get(eid,[])+unique)
        elements.append({'id':guid or f'{filename}:#{eid}','guid':guid,'ifc_class':kind,'name':name,
            'room':room,'room_number':room_number,'room_name':room_name,'storey':storey,'system':'','placement':'',
            'quantity':1,'unit':'','number':'','va':'','bkp':'','source_file':filename,'source_row':len(elements)+1,
            'properties':{'quantity_basis':'1 je IFC-Objekt. Keine gemessene Länge oder Fläche.','room_source':source,
                'room_candidates':candidates,'object_type':_text(args,4)}})
    if not elements:raise ValueError('Keine elektrischen IFC-Bauteile oder IfcBuildingElementProxy gefunden. Wände und Räume selbst werden nicht als Apparate übernommen.')
    warnings=[]
    if ambiguous:warnings.append(f'{ambiguous} Bauteil{"e" if ambiguous!=1 else ""} {"sind" if ambiguous!=1 else "ist"} mehreren Räumen zugeordnet. Deren Raum bleibt offen, die Kandidaten stehen am Objekt.')
    open_rooms=sum(1 for item in elements if not item['room'] and not item['properties']['room_candidates'])
    if open_rooms:warnings.append(f'{open_rooms} Bauteil{"e" if open_rooms!=1 else ""} ohne eindeutigen IfcSpace. Raumnummer und Raumname bleiben dort offen.')
    return elements,warnings
