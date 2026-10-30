"""Catalogue lookup and quantity logic. All storage is local."""
import json,re,sqlite3,threading,unicodedata
from contextlib import contextmanager
from decimal import Decimal
from functools import cached_property
from pathlib import Path

DATA=Path(__file__).resolve().parent/'data'
def normalize(value):
    value=str(value).casefold().replace('ß','ss')
    return ''.join(c for c in unicodedata.normalize('NFKD',value) if not unicodedata.combining(c))

def compact_identifier(value):
    """Search formatting only; original identifiers remain unchanged in storage."""
    return re.sub(r'[\s.\-/]','',normalize(value or ''))
def key(number,va,year=2026):return f'{year}:{number}:{va}'
def catalogue_editions(installed_year):
    """The installed year is usable. The following year stays reserved until its own data exists."""
    year=int(installed_year)
    return [
        {'year':year,'status':'available','label':f'Steiger-Katalog {year}'},
        {'year':year+1,'status':'reserved','label':f'Steiger-Katalog {year+1}',
         'note':'Vorgemerkt. Die Artikel dieses Jahrgangs sind noch nicht erfasst.'},
    ]
def material_eligible(va):return not(va.startswith('0') and va!='00') and va not in ('70','71','81')

class Catalogue:
    def __init__(self,path=None):
        self.path=Path(path or DATA/'catalogue.sqlite');self._db_lock=threading.RLock();self._db=None
    @contextmanager
    def connect(self):
        with self._db_lock:
            if self._db is None:
                db=sqlite3.connect(self.path,check_same_thread=False);db.row_factory=sqlite3.Row
                db.execute('PRAGMA query_only=ON');db.execute('PRAGMA temp_store=MEMORY');db.execute('PRAGMA cache_size=-32000')
                self._db=db
            yield self._db
    def metadata(self):
        with self.connect() as db:return {r['key']:json.loads(r['value']) for r in db.execute('SELECT * FROM metadata')}
    @cached_property
    def navigation(self):
        """Lightweight catalogue tree; no recipes or second persistent index."""
        with self.connect() as db:
            rows=db.execute("""SELECT json_extract(data,'$.number') AS number,json_extract(data,'$.name') AS name,
                json_extract(data,'$.complete_position') AS complete_position,json_extract(data,'$.source_kind') AS source_kind,
                json_extract(data,'$.vas') AS vas,json_extract(data,'$.locations') AS locations FROM articles ORDER BY number""").fetchall()
        return [{'number':row['number'],'name':row['name'],'complete_position':bool(row['complete_position']),
                 'source_kind':row['source_kind'],'vas':json.loads(row['vas'] or '[]'),
                 'chapters':[loc['chapter'] for loc in json.loads(row['locations'] or '[]')]} for row in rows]
    @cached_property
    def identifier_observations(self):
        """Identifiers belong to the exact article/VA observed, never its parent."""
        observations={}
        with self.connect() as db:
            for row in db.execute('SELECT data FROM recipes ORDER BY id'):
                recipe=json.loads(row[0])
                for item in recipe['items']+([recipe['atomic']] if recipe.get('atomic') else []):
                    e,b=item.get('eldas'),item.get('manufacturer_number')
                    if not e and not b:continue
                    entries=observations.setdefault((item['number'],item['va']),{})
                    pair=(e,b)
                    entry=entries.setdefault(pair,{'e_nr':e,'b_nr':b,'sources':[]})
                    source={'recipe':recipe['id'],'number':recipe['number'],'va':recipe['va']}
                    if source not in entry['sources']:entry['sources'].append(source)
        return {identity:list(entries.values()) for identity,entries in observations.items()}
    @cached_property
    def identifier_search(self):
        compact=compact_identifier
        result={}
        for (number,va),entries in self.identifier_observations.items():
            result.setdefault(number,set()).update(compact(entry[field]) for entry in entries
                                                  for field in ('e_nr','b_nr') if entry[field])
        with self.connect() as db:
            for row in db.execute("SELECT number,data FROM articles WHERE json_type(data,'$.basic_data')='array'"):
                fields=json.loads(row['data'])['basic_data']
                result.setdefault(row['number'],set()).update(compact(f['value']) for f in fields
                    if f['label'] in ('E-Nr','Bestellnummer') and f['value'])
            for row in db.execute("SELECT number,data FROM variants WHERE json_type(data,'$.basic_data')='array'"):
                fields=json.loads(row['data'])['basic_data']
                result.setdefault(row['number'],set()).update(compact(f['value']) for f in fields
                    if f['label'] in ('E-Nr','Bestellnummer') and f['value'])
        return result
    def identifiers(self,article,selected,root):
        basic=(root or {}).get('basic_data') or selected.get('basic_data') or article.get('basic_data',[])
        fields={r['label']:r['value'] for r in basic}
        observed=[{**entry,'source':'Gleicher Artikel und gleiche VA in erfassten Kalkulationen'}
                  for entry in self.identifier_observations.get((article['number'],selected['va']),[])]
        entries=[]
        if 'E-Nr' in fields or 'Bestellnummer' in fields:
            entries.append({'e_nr':fields.get('E-Nr') or None,'b_nr':fields.get('Bestellnummer') or None,
                            'source':'Grunddaten dieser Position','sources':[]})
        entries.extend(observed)
        return merge_identifiers(entries)
    def search(self,query='',kind='all',limit=60,va=''):
        stamp=(self.path.stat().st_mtime_ns,self.path.stat().st_size)
        if getattr(self,'_identifier_stamp',None)!=stamp:
            self.__dict__.pop('identifier_search',None);self.__dict__.pop('identifier_observations',None)
            self._identifier_stamp=stamp
        limit=max(1,min(int(limit),200));q=normalize(query.strip());params=[];terms=[]
        if kind=='complete':terms.append('a.complete_position=1')
        elif kind=='single':terms.append('a.complete_position=0')
        if re.fullmatch(r'[\d\s]+',q or '!'):
            digits=re.sub(r'\s','',q)
            if len(digits)>=7:
                terms.append('EXISTS(SELECT 1 FROM variants v WHERE v.number=a.number AND v.number||v.va=?)');params.append(digits)
            else:
                terms.append('(a.number LIKE ? OR EXISTS(SELECT 1 FROM variants v WHERE v.number=a.number AND v.number||v.va=?) OR a.number IN (SELECT number FROM articles_fts WHERE articles_fts MATCH ?))');params.extend([digits+'%',digits,'"'+digits+'"*'])
        elif q:
            tokens=re.findall(r'[\w]+',q,flags=re.UNICODE)
            if tokens:
                match=' AND '.join('"'+t.replace('"','')+'"*' for t in tokens)
                terms.append('a.number IN (SELECT number FROM articles_fts WHERE articles_fts MATCH ?)');params.append(match)
        # Keep FTS behaviour and add literal E-/B-number matching from original fields.
        compact=compact_identifier
        identifier_numbers=set()
        if q:
            needle=compact(q)
            identifier_numbers={number for number,values in self.identifier_search.items()
                                if any(needle in value for value in values)}
        if identifier_numbers:
            text_term=terms.pop() if len(terms)>(1 if kind in ('complete','single') else 0) else None
            # The query condition is last; kind restrictions remain outside the OR.
            if text_term:
                terms.append('('+text_term+' OR a.number IN ('+','.join('?' for _ in identifier_numbers)+'))')
                params.extend(sorted(identifier_numbers))
        if kind=='assembly':terms.append("json_extract(a.data,'$.source_kind')='composition_only'")
        elif kind=='single':terms.append("json_extract(a.data,'$.source_kind')='catalogue'")
        if va:terms.append('EXISTS(SELECT 1 FROM variants v WHERE v.number=a.number AND v.va=?)');params.append(str(va))
        # Own E-/B-number matches must not disappear behind many parent positions
        # whose searchable composition happens to contain that identifier.
        order='CASE WHEN a.number=? THEN 0 ELSE 1 END';params.append(re.sub(r'\s','',q))
        if identifier_numbers:
            order+=',CASE WHEN a.number IN ('+','.join('?' for _ in identifier_numbers)+') THEN 0 ELSE 1 END'
            params.extend(sorted(identifier_numbers))
        sql='SELECT a.* FROM articles a'+(' WHERE '+' AND '.join(terms) if terms else '')+' ORDER BY '+order+',a.complete_position DESC,a.number LIMIT ?';params.append(limit)
        with self.connect() as db:
            result=[]
            for r in db.execute(sql,params):
                a=json.loads(r['data']);vs=[json.loads(v['data']) for v in db.execute('SELECT data FROM variants WHERE number=? ORDER BY va',(a['number'],))]
                matches=[]
                if q:
                    for variant in vs:
                        for entry in self.identifiers(a,variant,None):
                            if any(needle in compact(entry.get(field)) for field in ('e_nr','b_nr') if entry.get(field)):
                                matches.append({'va':variant['va'],'e_nr':entry.get('e_nr'),'b_nr':entry.get('b_nr'),'source':entry['source']})
                result.append({'number':a['number'],'name':a['name'],'text':a['text'],'complete_position':a['complete_position'],'source_kind':a['source_kind'],'vas':[{'va':v['va'],'status':v['status'],'has_recipe':bool(v['recipes'])} for v in vs],'chapter':a['locations'][0]['chapter'] if a['locations'] else [],'identifier_matches':matches})
            return result
    def recipe(self,rid):
        with self.connect() as db:r=db.execute('SELECT data FROM recipes WHERE id=?',(rid,)).fetchone()
        if not r:raise ValueError('Zusammensetzung nicht vorhanden')
        return json.loads(r[0])
    def article(self,number,va=None,recipe_id=None):
        with self.connect() as db:
            row=db.execute('SELECT data FROM articles WHERE number=?',(str(number),)).fetchone()
            if not row:raise ValueError('Artikel nicht vorhanden')
            article=json.loads(row[0]);variants=[json.loads(r[0]) for r in db.execute('SELECT data FROM variants WHERE number=? ORDER BY va',(str(number),))]
            selected=next((v for v in variants if v['va']==va),variants[0] if va is None and variants else None)
            if not selected:raise ValueError('Diese VA ist nicht erfasst')
            rootrow=db.execute('SELECT data FROM roots WHERE id=?',(selected['id'],)).fetchone();root=json.loads(rootrow[0]) if rootrow else None
            if recipe_id and recipe_id not in selected['recipes']:raise ValueError('Zusammensetzung gehört nicht zu dieser Artikel-/VA-Kombination')
            rid=recipe_id or (root['recipe'] if root else next(iter(selected['recipes']),None))
            recipe=self.recipe(rid) if rid else None
            # Reachable recipe definitions only, preserving version/context selection.
            graph={};todo=[rid] if rid else []
            while todo:
                r=todo.pop()
                if r in graph:continue
                graph[r]=self.recipe(r)
                todo.extend(i['recipe'] for i in graph[r]['items'] if i.get('recipe'))
            portal_details=None
            if re.fullmatch(r'\d+',str(number)) and re.fullmatch(r'\d+',selected['va']):
                source=self.path.parent/'portal_capture/details'/f"{number}-{selected['va']}.json"
                if source.is_file():
                    candidate=json.loads(source.read_text(encoding='utf-8-sig'))
                    if candidate.get('number')==str(number) and candidate.get('va')==selected['va'] and candidate.get('year')==2026:portal_details=candidate
            identity_variant={**selected,'basic_data':portal_details['basic_data']} if portal_details and portal_details.get('basic_data') else selected
            return {'article':article,'variants':variants,'selected':selected,'root':root,'recipe':recipe,'graph':graph,'recipe_alternatives':selected['recipes'],'portal_details':portal_details,
                    'identifiers':self.identifiers(article,identity_variant,root)}
    def expand(self,number,va,quantity,recipe_id=None):
        quantity=Decimal(str(quantity))
        if not quantity.is_finite() or quantity<0:raise ValueError('Menge muss eine endliche Zahl ab null sein')
        detail=self.article(number,va);rid=recipe_id or (detail['recipe']['id'] if detail['recipe'] else None)
        if not rid:raise ValueError('Für diese VA ist noch keine Zusammensetzung erfasst')
        if rid not in detail['recipe_alternatives']:raise ValueError('Zusammensetzung gehört nicht zu dieser Artikel-/VA-Kombination')
        return expand_recipe(rid,quantity,self.recipe)

def merge_identifiers(entries):
    """Same E-Nr. and B-Nr. stay one choice; spacing does not create a second source."""
    merged=[]
    for entry in entries:
        identity=(compact_identifier(entry.get('e_nr')),compact_identifier(entry.get('b_nr')))
        match=next((item for item in merged if (compact_identifier(item.get('e_nr')),compact_identifier(item.get('b_nr')))==identity),None)
        if not match:
            merged.append({**entry,'sources':list(entry.get('sources') or [])})
            continue
        for source in entry.get('sources') or []:
            if source not in match['sources']:match['sources'].append(source)
        origins=match.setdefault('origins',[match['source']] if match.get('source') else [])
        if entry.get('source') and entry['source'] not in origins:origins.append(entry['source'])
    return merged

def expand_recipe(recipe_id,quantity,lookup):
    """Keep intermediate recipes out of leaf totals; multiply every ancestor."""
    leaves=[]
    def visit(rid,multiplier,path,material=True,time=True):
        if rid in path:raise ValueError('Zyklus in der Zusammensetzung')
        recipe=lookup(rid)
        root_va=recipe.get('va','00')
        material=material and not(root_va.startswith('0') and root_va!='00')
        time=time and recipe.get('va')!='100'
        items=recipe['items'] or ([recipe['atomic']] if recipe.get('atomic') else [])
        for ordinal,item in enumerate(items):
            q=multiplier*Decimal(str(item.get('quantity_raw',item['quantity'])))
            mat=material and item.get('material_counted',material_eligible(item['va']))
            labour=time and item['va']!='100'
            current=path+[rid]
            if item.get('recipe'):
                nested_material=material and not(item['va'].startswith('0') and item['va']!='00')
                visit(item['recipe'],q,current,nested_material,labour)
            else:
                raw_net=item.get('net_unit_raw') if item.get('net_unit_raw') is not None else item.get('net_unit')
                raw_time=item.get('time_h_unit_raw') if item.get('time_h_unit_raw') is not None else item.get('time_h_unit')
                net=None if raw_net is None else Decimal(str(raw_net))
                hours=None if raw_time is None else Decimal(str(raw_time))
                leaves.append({**item,'quantity':float(q),'material_counted':mat,'material_net_total':0.0 if not mat else None if net is None else float(q*net),'time_h_total':0.0 if not labour else None if hours is None else float(q*hours),'path':current,'ordinal':ordinal,'unit':None})
    visit(recipe_id,Decimal(str(quantity)),[])
    return leaves

def aggregate_tender(lines):
    """Never merge different BKP/room/system/placement/unit/recipe contexts."""
    result=[];groups={}
    fields=('bkp','storey','room','system','placement','number','va','unit','recipe_id','catalogue_year','rule_id')
    for line in lines:
        q=Decimal(str(line.get('quantity','')))
        if not q.is_finite() or q<0:raise ValueError('Ungültige Menge in der Ausschreibung')
        if not line.get('bkp') or not line.get('unit'):raise ValueError('BKP und Einheit müssen festgelegt sein')
        item={**line,'quantity':float(q),'sources':list(line.get('sources',[]))}
        # No room means no proven common context: keep the line separate.
        if not line.get('room'):
            result.append(item);continue
        identity=tuple(str(line.get(f,'')) for f in fields)
        if identity not in groups:groups[identity]=item;result.append(item)
        else:
            target=groups[identity];target['quantity']=float(Decimal(str(target['quantity']))+q)
            target['sources']+=item['sources']
    return result
