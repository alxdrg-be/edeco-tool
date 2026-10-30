"""Match imported objects to a Steiger article and VA.

A rule is unused until its target names both an article number and a VA.
Every listed criterion has to match. The more specific rule wins.
"""
if __package__:
    from .core import normalize
else:
    from core import normalize


def _text(value):
    return str(value or '').strip()


def _fold(value):
    return normalize(_text(value))


def _criteria(rule):
    raw=rule.get('match_criteria') or {}
    if not isinstance(raw,dict):raise ValueError('Die Merkmale einer Regel sind ungültig.')
    name=[_text(item) for item in raw.get('name_contains') or [] if _text(item)]
    return {'ifc_class':_text(raw.get('ifc_class')),'nova_item':_text(raw.get('nova_item')),'layer':_text(raw.get('layer')),'name_contains':name}


def prepare_rule(rule,order):
    if not isinstance(rule,dict):raise ValueError('Eine Regel muss ein Objekt sein.')
    rule_id=_text(rule.get('rule_id'))
    if not rule_id:raise ValueError('Jede Regel braucht eine rule_id.')
    target=rule.get('target') or {}
    if not isinstance(target,dict):raise ValueError('Das Ziel der Regel ist ungültig.')
    number=_text(target.get('article_number'))
    va=_text(target.get('va'))
    if not number or not va:raise ValueError('Eine Regel braucht Artikelnummer und VA.')
    criteria=_criteria(rule)
    if not any(criteria.values()):raise ValueError('Eine Regel braucht mindestens ein Merkmal.')
    source=_fold(rule.get('source_type'))
    if source in ('nova','n4','n4d','n4m'):source='nova'
    elif source=='ifc':source='ifc'
    elif source:raise ValueError('source_type ist IFC oder NOVA.')
    return {'rule_id':rule_id,'order':order,'source':source,'criteria':criteria,'target':{
        'article_number':number,'va':va,'bkp':_text(target.get('bkp')),'unit':_text(target.get('unit')),
        'description':_text(target.get('description')),'default_catalog_year':target.get('default_catalog_year')}}


def _kind(element):
    props=element.get('properties') or {}
    if element.get('ifc_class')=='NovaSymbol' or props.get('nova_item'):return 'nova'
    if str(element.get('ifc_class') or '').upper().startswith('IFC'):return 'ifc'
    return ''


def rule_matches(rule,element):
    if rule['source'] and rule['source']!=_kind(element):return False
    criteria=rule['criteria'];props=element.get('properties') or {}
    if criteria['ifc_class'] and _fold(criteria['ifc_class'])!=_fold(element.get('ifc_class')):return False
    if criteria['nova_item'] and criteria['nova_item']!=_text(props.get('nova_item')):return False
    layer=_text(props.get('layer') or element.get('placement'))
    if criteria['layer'] and criteria['layer']!=layer:return False
    name=_fold(element.get('name'))
    if any(_fold(token) not in name for token in criteria['name_contains']):return False
    return True


def specificity(rule):
    criteria=rule['criteria']
    return (100 if criteria['nova_item'] else 0)+(40 if criteria['ifc_class'] else 0)+(20 if criteria['layer'] else 0)+10*len(criteria['name_contains'])


def _catalogue_target(catalogue,number,va):
    detail=catalogue.article(number,va)
    recipe=detail.get('recipe') or {}
    return {'name':detail['article']['name'],'recipe_id':recipe.get('id'),'year':detail['article'].get('year') or 2026}


def match_assignments(elements,rules,catalogue=None):
    """Return one match per element. None where no valid rule fits."""
    if not isinstance(elements,list) or not isinstance(rules,list):raise ValueError('Elemente und Regeln müssen Listen sein.')
    prepared=[];errors=[]
    for index,rule in enumerate(rules):
        try:prepared.append(prepare_rule(rule,index))
        except ValueError as exc:errors.append({'index':index,'error':str(exc)})
    cache={};matches=[]
    for element in elements:
        if not isinstance(element,dict):
            matches.append(None);continue
        hits=[rule for rule in prepared if rule_matches(rule,element)]
        if not hits:
            matches.append(None);continue
        hits.sort(key=lambda rule:(-specificity(rule),rule['order']))
        chosen=hits[0];target=chosen['target'];number,va=target['article_number'],target['va']
        match={'rule_id':chosen['rule_id'],'number':number,'va':va,'bkp':target['bkp'],'unit':target['unit'],
               'description':target['description'],'recipe_id':None,'catalogue_year':target.get('default_catalog_year') or None}
        if catalogue is not None:
            key=(number,va)
            if key not in cache:
                try:cache[key]=_catalogue_target(catalogue,number,va)
                except ValueError as exc:cache[key]={'error':str(exc)}
            found=cache[key]
            if found.get('error'):match['catalogue_error']=found['error']
            else:
                match['description']=found['name'];match['recipe_id']=found.get('recipe_id');match['catalogue_year']=found['year']
        matches.append(match)
    return {'matches':matches,'errors':errors}
