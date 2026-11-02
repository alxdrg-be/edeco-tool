import unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from elda_export import bkp_nodes,calculation_line,chapter_lines,export_messerli,titles_from_navigation


# Layout locked to the 2026 Messerli exchange file. These lines carry no client data.
GA_15 = 'GAE000D0026K            155006                                      +0000000015000N+000000000000+00000000000020'
GA_DEDUCTION = 'GAE000D0026K            125252                                      -0000000000200N+000000000000+00000000000030'
GA_VA100 = 'GAE000D0026K            700843                                      +0000000001000N+000000000000+000000000000100'
GF_ROOT = 'GF         LA:23                 001Elektroanlagen                                T             +000000000000001'
GF_DEEP = 'GF         LA:231.21.1           001Anpassungsarbeiten HV                         T             +000000000000005'


class EldaExportTests(unittest.TestCase):
    def test_calculation_line_matches_the_exchange_file(self):
        self.assertEqual(calculation_line('155006', 15, '20'), GA_15)
        self.assertEqual(calculation_line('125252', '-0,2', '30'), GA_DEDUCTION)
        self.assertEqual(calculation_line('700843', 1, '100'), GA_VA100)
        self.assertEqual(len(GA_15), 111)
        self.assertEqual(len(GA_VA100), 112)

    def test_chapter_line_matches_the_exchange_file(self):
        self.assertEqual(chapter_lines('23', 'Elektroanlagen', 1), [GF_ROOT])
        self.assertEqual(chapter_lines('231.21.1', 'Anpassungsarbeiten HV', 5), [GF_DEEP])

    def test_bkp_path_follows_the_file(self):
        self.assertEqual(bkp_nodes('231.21.1'), ['23', '231', '231.2', '231.21', '231.21.1'])
        self.assertEqual(bkp_nodes('232.5'), ['23', '232', '232.5'])
        self.assertEqual(bkp_nodes('23'), ['23'])

    def test_export_writes_cp850_without_prices_or_client_data(self):
        payload, warnings = export_messerli([
            {'bkp': '232.5', 'number': '155006', 'va': '20', 'quantity': 15, 'name': 'Schaltgerät', 'storey': 'UG02', 'room': '1.126', 'catalogue_year': 2026},
            {'bkp': '232.51', 'number': '700843', 'va': '100', 'quantity': 1, 'name': 'Abzweigdose', 'catalogue_year': 2026},
            {'bkp': '', 'number': '122273', 'va': '00', 'quantity': 1, 'name': 'ohne BKP'},
        ], project='Probeprojekt', chapter_titles={'232.5': 'Licht', '232.51': 'Leuchten'})
        text = payload.decode('cp850')
        self.assertTrue(text.startswith('A 3ASCII-8 0041E000D2626K'))
        self.assertTrue(text.endswith('BKP\r\n') or '\r\nZ    ' in text)
        self.assertIn('\r\n', text)
        self.assertNotIn('\n\n', text.replace('\r\n', ''))
        self.assertIn('Probeprojekt', text)
        self.assertNotIn('Stiftung', text)
        self.assertIn('LA:232.5', text)
        self.assertIn('001Licht', text)
        self.assertIn('Schaltgerät, UG02, 1.126', text)
        self.assertEqual(text.count('LA:23 '), 1)
        self.assertIn(GA_15, text)
        self.assertIn(GA_VA100, text)
        self.assertNotIn('+000000000001', text)
        self.assertEqual(text.count('GK' + (' ' * 111) + 'U'), 2)
        lines = text.split('\r\n')
        lines = [line for line in lines if line]
        self.assertEqual(lines[-1], f'Z    {len(lines) - 3:010d}')
        self.assertEqual(warnings, ['1 Position ohne BKP, Artikelnummer oder VA steht nicht in der Messerli-Datei.'])
        self.assertIn('Schaltgerät'.encode('cp850'), payload)
        self.assertNotIn('Schaltgerät'.encode('utf-8'), payload)

    def test_va_keeps_its_digits_and_a_long_title_wraps(self):
        self.assertTrue(calculation_line('122273', '1.5', '09').endswith('+0000000001500N+000000000000+00000000000009'))
        lines = chapter_lines('232.5', 'A' * 50, 3)
        self.assertEqual(len(lines[0]), 112)
        self.assertTrue(lines[1].startswith('GF'.ljust(33) + '002'))
        self.assertEqual(len(lines[1]), 33 + 3 + 5)

    def test_outline_titles_and_texts_go_into_the_file(self):
        payload, _ = export_messerli([
            {'bkp': '232.5', 'number': '155006', 'va': '20', 'quantity': 15, 'name': 'Leuchte', 'storey': '1', 'room': 'Büro', 'export_text': 'Leuchte nach Plan'},
        ], chapter_titles={'232.5': 'Licht', '23': 'Falsch'}, outline=[
            {'code': '23', 'title': 'Elektroanlagen', 'texts': ['Vorbemerkung zur Anlage']},
            {'code': '232.5', 'title': 'Beleuchtung', 'texts': ['Titel Leuchten']},
            {'code': '239', 'title': 'Übriges', 'texts': ['Reserve']},
        ])
        text = payload.decode('cp850')
        self.assertIn('001Elektroanlagen', text)
        self.assertIn('001Beleuchtung', text)
        self.assertNotIn('001Licht', text)
        self.assertNotIn('Falsch', text)
        self.assertLess(text.index('Vorbemerkung zur Anlage'), text.index('LA:232.5'))
        self.assertLess(text.index('Titel Leuchten'), text.index('155006'))
        self.assertIn('Leuchte nach Plan', text)
        self.assertNotIn('Büro', text)
        self.assertIn('LA:239', text)
        self.assertIn('Reserve', text)
        blank, _ = export_messerli([
            {'bkp': '232.5', 'number': '155006', 'va': '20', 'quantity': 1, 'name': 'Leuchte', 'export_text': ''},
        ])
        self.assertNotIn('Leuchte', blank.decode('cp850'))
        only, _ = export_messerli([], outline=[{'code': '232.5', 'title': 'Licht', 'texts': ['Nur Text']}])
        self.assertIn('Nur Text', only.decode('cp850'))
        self.assertIn('LA:23 ', only.decode('cp850'))

    def test_empty_tender_is_refused(self):
        with self.assertRaisesRegex(ValueError, 'Keine Position'):
            export_messerli([{'bkp': '232.5', 'number': '', 'va': '00', 'quantity': 1}])

    def test_sample_calculation_lines_round_trip(self):
        sample = Path('/home/ubuntu/.cursor/projects/workspace/uploads/ELDA14980000_f93f.DAT')
        try:
            if not sample.is_file():
                self.skipTest('Optional Messerli sample is unavailable on this machine')
            sample_bytes = sample.read_bytes()
        except OSError as error:
            self.skipTest(f'Optional Messerli sample is unavailable or unreadable: {error}')
        text = sample_bytes.decode('cp850')
        checked = 0
        for line in text.split('\r\n'):
            if not line.startswith('GAE000D0026K') or len(line) < 68 + 14 + 1 + 26:
                continue
            number = line[24:68].strip()
            rest = line[68:]
            quantity, flag, prices, va = int(rest[:14]), rest[14], rest[15:41], rest[41:]
            if flag != 'N' or prices != '+000000000000+000000000000':
                continue
            self.assertEqual(calculation_line(number, quantity / 1000, va), line)
            checked += 1
        self.assertGreater(checked, 300)

    def test_chapter_titles_come_from_the_catalogue_path(self):
        titles = titles_from_navigation([{'chapters': [['Komplett-Installationen', '232.5 Licht', '1.8 Kabeltrassen GFK U23X']]}])
        self.assertEqual(titles['232.5'], 'Licht')
        self.assertNotIn('23', titles)
        payload, _ = export_messerli([{'bkp': 'A:232.5', 'number': '155006', 'va': '20', 'quantity': 1, 'name': 'Leuchte'}], chapter_titles=titles)
        self.assertIn('001Licht', payload.decode('cp850'))
        self.assertNotIn('001X', payload.decode('cp850'))


if __name__ == '__main__':
    unittest.main()
