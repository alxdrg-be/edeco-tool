import unittest
from tools.import_portal_details import validate_record

class PortalSourceTests(unittest.TestCase):
    def record(self):
        return {'year':2026,'number':'123','va':'030','basic_data':[{'label':'Artikelnummer','value':'123'},{'label':'E-Nr','value':'001234567'}],
                'rows':[{'cells':['Artikel','123','030','1']}]}

    def test_original_strings_and_source_identity_are_required(self):
        self.assertTrue(validate_record(self.record()))
        for changed in [{'va':'30'},{'number':'124'},{'year':2022}]:
            with self.subTest(changed=changed),self.assertRaises(ValueError):validate_record({**self.record(),**changed})

    def test_numeric_identifier_is_not_silently_converted(self):
        record=self.record();record['basic_data'][1]['value']=1234567
        with self.assertRaises(ValueError):validate_record(record)
