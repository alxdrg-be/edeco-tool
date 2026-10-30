import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from rules import match_assignments,prepare_rule


def rule(**changes):
    value={'rule_id':'r_socket','source_type':'NOVA','match_criteria':{'nova_item':'112-01'},'target':{'article_number':'122104','va':'00','bkp':'232.5','unit':'Stk'}}
    value.update(changes)
    return value


def element(**changes):
    value={'name':'Steckdose T13, UP, 3-fach','ifc_class':'NovaSymbol','placement':'E_Licht','properties':{'nova_item':'112-01','layer':'E_Licht'}}
    value.update(changes)
    return value


class RuleTests(unittest.TestCase):
    def test_article_and_va_are_required(self):
        with self.assertRaisesRegex(ValueError,'Artikelnummer und VA'):prepare_rule(rule(target={'article_number':'122104'}),'0')
        with self.assertRaisesRegex(ValueError,'Artikelnummer und VA'):prepare_rule(rule(target={'article_number':'122104','va':''}),'0')
        with self.assertRaisesRegex(ValueError,'rule_id'):prepare_rule(rule(rule_id=''),'0')
        with self.assertRaisesRegex(ValueError,'Merkmal'):prepare_rule(rule(match_criteria={}),'0')

    def test_va_keeps_leading_zero(self):
        prepared=prepare_rule(rule(target={'article_number':'122104','va':'00','bkp':'232.5','unit':'Stk'}),'0')
        self.assertEqual(prepared['target']['va'],'00')

    def test_nova_item_beats_a_broader_name_rule(self):
        broad=rule(rule_id='r_name',match_criteria={'name_contains':['Steckdose']},target={'article_number':'100000','va':'01','bkp':'232.6','unit':'Stk'})
        result=match_assignments([element()],[broad,rule()])
        self.assertEqual(result['errors'],[])
        self.assertEqual(result['matches'][0]['rule_id'],'r_socket')
        self.assertEqual(result['matches'][0]['number'],'122104')
        self.assertEqual(result['matches'][0]['va'],'00')
        self.assertEqual(result['matches'][0]['bkp'],'232.5')

    def test_name_tokens_must_all_match(self):
        narrow=rule(rule_id='r_t23',source_type='IFC',match_criteria={'ifc_class':'IfcOutlet','name_contains':['T23','3-fach']},target={'article_number':'122104','va':'00','bkp':'232.5','unit':'Stk'})
        outlet={'name':'Steckdose T23 UP 3-fach','ifc_class':'IfcOutlet','properties':{}}
        other={'name':'Steckdose T23 UP','ifc_class':'IfcOutlet','properties':{}}
        nova=element()
        result=match_assignments([outlet,other,nova],[narrow])
        self.assertEqual(result['matches'][0]['rule_id'],'r_t23')
        self.assertIsNone(result['matches'][1])
        self.assertIsNone(result['matches'][2])

    def test_layer_is_optional_and_exact(self):
        layered=rule(match_criteria={'nova_item':'112-01','layer':'E_Kraft'})
        result=match_assignments([element(),element(placement='E_Kraft',properties={'nova_item':'112-01','layer':'E_Kraft'})],[layered])
        self.assertIsNone(result['matches'][0])
        self.assertEqual(result['matches'][1]['rule_id'],'r_socket')

    def test_unknown_rule_is_reported_without_dropping_the_others(self):
        result=match_assignments([element()],[rule(target={'article_number':'1'}),rule()])
        self.assertEqual(len(result['errors']),1)
        self.assertEqual(result['matches'][0]['va'],'00')

    def test_catalogue_rejects_an_unknown_article(self):
        class Missing:
            def article(self,number,va):raise ValueError('Artikel nicht vorhanden')
        result=match_assignments([element()],[rule()],Missing())
        self.assertEqual(result['matches'][0]['catalogue_error'],'Artikel nicht vorhanden')
        self.assertEqual(result['matches'][0]['va'],'00')


if __name__=='__main__':unittest.main()
