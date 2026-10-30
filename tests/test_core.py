import unittest,sys
from pathlib import Path
from decimal import Decimal
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from core import expand_recipe,aggregate_tender,material_eligible,catalogue_editions
from importers import import_neutral

class QuantityTests(unittest.TestCase):
    def test_parent_quantities_multiply_and_parent_prices_are_not_added(self):
        graph={'root':{'items':[{'number':'A','va':'24','quantity':2,'quantity_raw':'2','recipe':'child','net_unit':999,'time_h_unit':999}]},'child':{'items':[{'number':'B','va':'60','quantity':4,'quantity_raw':'4','recipe':None,'net_unit':5,'time_h_unit':0.1}]}}
        parts=expand_recipe('root',3,graph.__getitem__)
        self.assertEqual(len(parts),1);self.assertEqual(parts[0]['quantity'],24);self.assertEqual(parts[0]['material_net_total'],120);self.assertEqual(parts[0]['time_h_total'],2.4)
    def test_connections_do_not_deliver_cable_material_again(self):
        graph={'r':{'items':[{'number':'wire','va':'60','quantity':20,'recipe':None,'net_unit':2,'time_h_unit':0.1},{'number':'wire','va':'70','quantity':2,'recipe':None,'net_unit':2,'time_h_unit':0.2}]}}
        parts=expand_recipe('r',1,graph.__getitem__)
        self.assertEqual(sum(p['material_net_total'] for p in parts),40);self.assertAlmostEqual(sum(p['time_h_total'] for p in parts),2.4)
        self.assertTrue(material_eligible('76'));self.assertFalse(material_eligible('060'));self.assertFalse(material_eligible('81'))
    def test_labour_only_parent_suppresses_nested_material(self):
        g={'r':{'items':[{'number':'a','va':'024','quantity':2,'recipe':'c'}]},'c':{'items':[{'number':'b','va':'24','quantity':3,'recipe':None,'net_unit':10,'time_h_unit':0.1}]}}
        self.assertEqual(expand_recipe('r',1,g.__getitem__)[0]['material_net_total'],0)
    def test_connection_assembly_can_include_separate_supply(self):
        g={'r':{'items':[{'number':'plug','va':'71','quantity':1,'recipe':'plug'}]},'plug':{'va':'71','items':[{'number':'raw-plug','va':'100','quantity':1,'net_unit':15.295,'time_h_unit':0,'recipe':None},{'number':'wire','va':'71','quantity':1,'net_unit':1.79,'time_h_unit':0.37,'recipe':None}]}}
        p=expand_recipe('r',1,g.__getitem__)
        self.assertEqual(sum(x['material_net_total'] for x in p),15.295)
        self.assertEqual(sum(x['time_h_total'] for x in p),0.37)
    def test_missing_price_remains_missing(self):
        p=expand_recipe('r',1,lambda _: {'items':[{'number':'a','va':'24','quantity':1,'recipe':None,'net_unit':None,'time_h_unit':None}]})[0]
        self.assertIsNone(p['material_net_total']);self.assertIsNone(p['time_h_total'])
    def test_cycle_is_rejected(self):
        with self.assertRaises(ValueError):expand_recipe('r',1,lambda _: {'items':[{'number':'a','va':'24','quantity':1,'recipe':'r'}]})
    def test_atomic_calculation_uses_source_summary(self):
        p=expand_recipe('r',3,lambda _: {'items':[],'atomic':{'number':'a','va':'00','quantity':1,'net_unit':2.5,'time_h_unit':0.2}})[0]
        self.assertEqual(p['quantity'],3);self.assertEqual(p['material_net_total'],7.5);self.assertEqual(p['time_h_total'],0.6)

class TenderTests(unittest.TestCase):
    def base(self,**changes):return {'number':'122104','va':'00','bkp':'A:237.3','storey':'2OG','room':'R1','system':'Licht','placement':'Decke UP','unit':'Stk','recipe_id':'r','quantity':1,'sources':[{'id':'GUID-1'}],**changes}
    def test_different_contexts_never_merge(self):
        for field,value in [('bkp','A:232.52'),('room','R2'),('storey','1OG'),('system','Notlicht'),('placement','Wand AP'),('unit','m'),('recipe_id','other'),('va','10'),('rule_id','r_other')]:
            with self.subTest(field=field):self.assertEqual(len(aggregate_tender([self.base(),self.base(**{field:value})])),2)
    def test_unknown_room_does_not_merge(self):self.assertEqual(len(aggregate_tender([self.base(room=''),self.base(room='')])),2)
    def test_different_catalogue_years_stay_separate(self):
        self.assertEqual(len(aggregate_tender([self.base(catalogue_year=2026),self.base(catalogue_year=2027)])),2)
    def test_next_catalogue_year_is_only_reserved(self):
        editions=catalogue_editions(2026)
        self.assertEqual([(item['year'],item['status']) for item in editions],[(2026,'available'),(2027,'reserved')])
        self.assertIn('noch nicht erfasst',editions[1]['note'])
    def test_same_context_retains_all_source_references(self):
        r=aggregate_tender([self.base(quantity=0.1),self.base(quantity=0.2,sources=[{'id':'GUID-2'}])])
        self.assertEqual(r[0]['quantity'],0.3);self.assertEqual(len(r[0]['sources']),2)
    def test_invalid_quantity_is_rejected(self):
        for q in ['NaN','Infinity',-1]:
            with self.assertRaises(ValueError):aggregate_tender([self.base(quantity=q)])

class ImportTests(unittest.TestCase):
    def test_csv_decimal_comma_and_zero_are_preserved(self):
        a=import_neutral('x.csv','id;name;menge;einheit\na;Rohr;1,5;m\nb;Leuchte;0;Stk\n')
        self.assertEqual(a[0]['quantity'],1.5);self.assertEqual(a[1]['quantity'],0);self.assertEqual(a[0]['source_row'],1)
    def test_duplicate_ids_are_rejected(self):
        with self.assertRaises(ValueError):import_neutral('x.json','[{"id":"a"},{"id":"a"}]')
    def test_csv_bom_keeps_original_id(self):
        self.assertEqual(import_neutral('x.csv','\ufeffid;name\nOriginal-1;Leuchte\n')[0]['id'],'Original-1')
    def test_missing_unit_is_not_fabricated(self):self.assertEqual(import_neutral('x.json','[{"id":"a"}]')[0]['unit'],'')
    def test_binary_formats_do_not_go_through_the_csv_reader(self):
        with self.assertRaisesRegex(ValueError,'import_model'):import_neutral('x.n4m','[]')

if __name__=='__main__':unittest.main()
