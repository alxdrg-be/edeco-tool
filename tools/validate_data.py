"""Verify all recipe paths and reference totals without portal access."""
import json,sys,sqlite3
from pathlib import Path
from decimal import Decimal
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from core import expand_recipe

def main():
    package=json.loads((ROOT/'data/assemblies.json').read_text(encoding='utf-8'))
    catalogue=json.loads((ROOT/'data/catalogue.json').read_text(encoding='utf-8'))
    recipes=package['recipes'];roots=package['roots'];findings=[];checked=0;unknown_prices=[]
    for key,root in roots.items():
        if key!=f"{root['year']}:{root['number']}:{root['va']}":findings.append([key,'identity'])
        if root.get('calculation_available') is False:
            if root.get('recipe') is not None or not root.get('article_text'):findings.append([key,'invalid_text_only_record'])
            continue
        if not root['complete_detail']:findings.append([key,'missing_details'])
        parts=expand_recipe(root['recipe'],1,recipes.__getitem__)
        for field,label,tolerance in [('material_net_total','Nettomaterialpreis',Decimal('.005')),('time_h_total','Installationszeit',Decimal('.001'))]:
            expected=root['summary'].get(label)
            if expected is None:continue
            if any(p[field] is None for p in parts):
                # Missing unit prices remain unknown in the app. A missing field
                # with a zero contribution is not silently represented as zero.
                missing=[p for p in parts if p[field] is None and p['quantity']!=0]
                if missing:unknown_prices.append([key,field,'source_unit_value_missing']);continue
            total=sum(Decimal(str(p[field] or 0)) for p in parts)
            if abs(total-Decimal(str(expected)))>tolerance:findings.append([key,field,str(total),expected])
            checked+=1
    with sqlite3.connect(ROOT/'data/catalogue.sqlite') as db:
        assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        assert db.execute('SELECT count(*) FROM roots').fetchone()[0]==len(roots)
        assert db.execute('SELECT count(*) FROM recipes').fetchone()[0]==len(recipes)
        assert db.execute('SELECT count(*) FROM articles').fetchone()[0]==len(catalogue['articles'])
    report={'root_count':len(roots),'recipe_count':len(recipes),'reference_totals_checked':checked,'reference_totals_not_verifiable_due_to_missing_source_unit_value':unknown_prices,'capture_complete':package['metadata']['capture_complete'],'findings':findings}
    print(json.dumps(report,ensure_ascii=False))
    if '--write' in sys.argv:(ROOT/'data/quality_report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    return bool(findings)

if __name__=='__main__':sys.exit(main())
