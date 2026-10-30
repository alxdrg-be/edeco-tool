"""Regression cases for the full catalogue adapter, using the shipped source data."""
import unittest
from core import Catalogue


class CatalogueAdapterTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalogue=Catalogue()

    def test_navigation_covers_catalogue_and_marked_components(self):
        meta=self.catalogue.metadata()
        self.assertEqual(len(self.catalogue.navigation),meta['catalogue_articles']+meta['component_only_articles'])
        self.assertTrue(next(a for a in self.catalogue.navigation if a['number']=='112001')['chapters'])

    def test_product_identifiers_find_exact_articles_without_transferring_to_parent(self):
        for query in ['219 070 000','7563.GMI.A.61']:
            with self.subTest(query=query):
                numbers={a['number'] for a in self.catalogue.search(query)}
                self.assertIn('998123',numbers)
                self.assertNotIn('112001',numbers)
        ids=self.catalogue.article('112001','00')['identifiers']
        self.assertEqual([(i['e_nr'],i['b_nr']) for i in ids],[(None,None)])

    def test_identifier_search_respects_source_kind(self):
        single=self.catalogue.search('219070000','single')
        self.assertIn('42241',{a['number'] for a in single})
        self.assertTrue(all(a['source_kind']=='catalogue' and not a['complete_position'] for a in single))
        self.assertEqual({a['number'] for a in self.catalogue.search('219070000','assembly')},{'998123'})
        self.assertFalse(self.catalogue.search('219070000','complete'))

    def test_formatted_identifier_search_returns_original_pair_and_exact_va(self):
        for query in ['219.070.000','219-070-000','7563GMIA61']:
            with self.subTest(query=query):
                result=next(a for a in self.catalogue.search(query) if a['number']=='998123')
                self.assertNotIn('112001',{a['number'] for a in self.catalogue.search(query)})
                self.assertTrue(any(m['va']=='048' and m['e_nr']=='219070000' and m['b_nr']=='7563.GMI.A.61' for m in result['identifier_matches']))

    def test_search_filters_by_exact_va(self):
        result=self.catalogue.search('','all',200,'048')
        self.assertIn('998123',{a['number'] for a in result})
        self.assertTrue(all(any(v['va']=='048' for v in a['vas']) for a in result))
        self.assertFalse(self.catalogue.search('998123','all',60,'99999'))

    def test_leading_zero_va_and_combined_number_search(self):
        d=self.catalogue.article('998123','048')
        self.assertEqual(d['selected']['va'],'048')
        self.assertEqual(d['identifiers'][0]['e_nr'],'219070000')
        self.assertIn('998123',{a['number'] for a in self.catalogue.search('998123048')})
        self.assertIsNone(d['recipe'])

    def test_own_order_number_is_ranked_before_containing_positions(self):
        result=self.catalogue.search('9951',limit=1)
        self.assertEqual(result[0]['number'],'2730')
        self.assertTrue(any(entry['b_nr']=='9951' for entry in result[0]['identifier_matches']))

    def test_default_complete_position_and_negative_deduction(self):
        parts=self.catalogue.expand('112001','00','1')
        self.assertEqual(len(parts),8)
        self.assertEqual(next(p for p in parts if p['number']=='35120')['quantity'],19.2)
        deduction=next(p for p in self.catalogue.expand('112002','00','2') if p['number']=='2670')
        self.assertEqual(deduction['quantity'],-2)
        self.assertIsNone(deduction['unit'])

    def test_nested_leaf_quantities_multiply_and_parents_are_not_added(self):
        parts=self.catalogue.expand('122104','00','3')
        self.assertNotIn('8911',{p['number'] for p in parts})
        tape=next(p for p in parts if p['number']=='999014')
        self.assertEqual(tape['quantity'],0.03)
        self.assertEqual(len(tape['path']),2)

    def test_recipe_must_belong_to_exact_article_and_va(self):
        with self.assertRaisesRegex(ValueError,'gehört nicht'):
            self.catalogue.article('112001','00',self.catalogue.article('122104','00')['recipe']['id'])

    def test_conflicting_same_article_identifiers_retain_source_context(self):
        c=Catalogue()
        c.identifier_observations={('A','030'):[{'e_nr':'001','b_nr':'0002','sources':[{'recipe':'r1'}]},
                                               {'e_nr':'003','b_nr':'0004','sources':[{'recipe':'r2'}]}]}
        ids=c.identifiers({'number':'A'},{'va':'030'},None)
        self.assertEqual([i['b_nr'] for i in ids],['0002','0004'])
        self.assertEqual([i['sources'][0]['recipe'] for i in ids],['r1','r2'])
        self.assertFalse(c.identifiers({'number':'A'},{'va':'30'},None))

    def test_selected_va_own_basic_data_does_not_leak_into_other_va(self):
        c=Catalogue();c.identifier_observations={}
        article={'number':'A'}
        selected={'va':'030','basic_data':[{'label':'E-Nr','value':'001234567'},{'label':'Bestellnummer','value':'0002.X'}]}
        self.assertEqual(c.identifiers(article,selected,None)[0]['b_nr'],'0002.X')
        self.assertFalse(c.identifiers(article,{'va':'30'},None))
        root={'basic_data':[{'label':'E-Nr','value':''},{'label':'Bestellnummer','value':''}]}
        self.assertIsNone(c.identifiers(article,selected,root)[0]['e_nr'])

    def test_same_identifier_with_different_spacing_stays_one_entry(self):
        c=Catalogue();c.identifier_observations={('155003','20'):[{'e_nr':'125061499','b_nr':None,'sources':[{'recipe':'r1','number':'122270','va':'00'}]}]}
        ids=c.identifiers({'number':'155003'},{'va':'20','basic_data':[{'label':'E-Nr','value':'125 061 499'},{'label':'Bestellnummer','value':''}]},None)
        self.assertEqual(len(ids),1)
        self.assertEqual(ids[0]['e_nr'],'125 061 499')
        self.assertIsNone(ids[0]['b_nr'])
        self.assertEqual(ids[0]['sources'][0]['number'],'122270')
        self.assertIn('Grunddaten dieser Position',ids[0]['origins'])
        live=self.catalogue.article('155003','20')['identifiers']
        self.assertEqual(len(live),1)
        self.assertEqual(live[0]['e_nr'],'125 061 499')
        self.assertTrue(any(source['number']=='122270' and source['va']=='00' for source in live[0]['sources']))

    def test_own_basic_identifier_keeps_other_exact_article_va_contexts_available(self):
        c=Catalogue();c.identifier_observations={('A','030'):[{'e_nr':'0002','b_nr':'B.02','sources':[{'recipe':'other-context'}]}]}
        identifiers=c.identifiers({'number':'A'},{'va':'030','basic_data':[{'label':'E-Nr','value':'0001'},{'label':'Bestellnummer','value':'B.01'}]},None)
        self.assertEqual([(entry['e_nr'],entry['b_nr']) for entry in identifiers],[('0001','B.01'),('0002','B.02')])
        self.assertEqual(identifiers[1]['sources'][0]['recipe'],'other-context')


if __name__=='__main__':unittest.main()
