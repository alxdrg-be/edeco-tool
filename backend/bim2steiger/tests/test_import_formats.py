import io,struct,unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from importers import import_model
from n4_import import symbols_from_elements
from server import MAX_IMPORT_BODY,MAX_IMPORT_FILE

IFC=r"""ISO-10303-21;
HEADER;
FILE_DESCRIPTION(('View'),'2;1');
ENDSEC;
DATA;
#2=IFCBUILDINGSTOREY('storey',$,'1. OG',$,$,$,$,$,.ELEMENT.,$);
#3=IFCSPACE('space-101',$,'101',$,$,$,$,'B\X2\00FC\X0\ro',.ELEMENT.,$,$);
#4=IFCOUTLET('outlet-a',$,'Steckdose B\X2\00FC\X0\ro',$,'UP',$,$,$);
#5=IFCLIGHTFIXTURE('light-a',$,'Leuchte',$,$,$,$,$);
#7=IFCRELAGGREGATES('agg',$,$,$,#2,(#3,#8));
#8=IFCSPACE('space-102',$,'102',$,$,$,$,'Korridor',.ELEMENT.,$,$);
#9=IFCOUTLET('outlet-b',$,'Steckdose Flur',$,$,$,$,$);
#10=IFCRELSPACEBOUNDARY('bound',$,$,$,#8,#9,$,.PHYSICAL.,.INTERNAL.);
#11=IFCOUTLET('outlet-c',$,'Steckdose ohne Raum',$,$,$,$,$);
#12=IFCWALL('wall',$,'Wand',$,$,$,$,$);
#13=IFCRELCONTAINEDINSPATIALSTRUCTURE('cont',$,$,$,(#4,#5),#3);
#14=IFCBUILDINGELEMENTPROXY('proxy-1',$,'Fremdobjekt',$,$,$,$,$);
#15=IFCRELREFERENCEDINSPATIALSTRUCTURE('ref',$,$,$,(#14),#8);
#16=IFCOUTLET('outlet-d',$,'Zwischen zwei R\X2\00E4umen\X0\',$,$,$,$,$);
#17=IFCRELCONTAINEDINSPATIALSTRUCTURE('cont-a',$,$,$,(#16),#3);
#18=IFCRELCONTAINEDINSPATIALSTRUCTURE('cont-b',$,$,$,(#16),#8);
ENDSEC;
END-ISO-10303-21;
"""


def _cstring(text):
    raw=text.encode('utf-16le')
    return b'\xff\xfe\xff'+bytes([len(text)])+raw


def _elements(*texts):
    return b''.join(_cstring(text) for text in texts)


def _ole(stream):
    if len(stream)<4096:stream=stream+b'\x00'*(4096-len(stream))
    sector=512
    data_sectors=(len(stream)+sector-1)//sector
    fat_sector=0
    dir_sector=1
    first_data=2
    total=2+data_sectors
    fat=[0xFFFFFFFF]*128
    fat[fat_sector]=0xFFFFFFFD
    fat[dir_sector]=0xFFFFFFFE
    for index in range(data_sectors):
        sector_id=first_data+index
        fat[sector_id]=sector_id+1 if index+1<data_sectors else 0xFFFFFFFE
    header=bytearray(512)
    header[0:8]=bytes.fromhex('D0CF11E0A1B11AE1')
    struct.pack_into('<H',header,0x18,0x003E)
    struct.pack_into('<H',header,0x1A,0x0003)
    struct.pack_into('<H',header,0x1C,0xFFFE)
    struct.pack_into('<H',header,0x1E,9)
    struct.pack_into('<H',header,0x20,6)
    struct.pack_into('<I',header,0x2C,1)
    struct.pack_into('<I',header,0x30,dir_sector)
    struct.pack_into('<I',header,0x38,4096)
    struct.pack_into('<I',header,0x3C,0xFFFFFFFE)
    struct.pack_into('<I',header,0x44,0xFFFFFFFE)
    struct.pack_into('<I',header,0x4C,0)
    for index in range(109):struct.pack_into('<I',header,0x4C+4*index,0 if index==0 else 0xFFFFFFFF)
    def entry(name,kind,child,start,size):
        raw=bytearray(128)
        encoded=(name+'\0').encode('utf-16le')
        raw[0:len(encoded)]=encoded
        struct.pack_into('<H',raw,0x40,len(encoded))
        raw[0x42]=kind
        raw[0x43]=1
        for offset in (0x44,0x48,0x4C):struct.pack_into('<I',raw,offset,0xFFFFFFFF)
        if child is not None:struct.pack_into('<I',raw,0x4C,child)
        struct.pack_into('<I',raw,0x74,start)
        struct.pack_into('<Q',raw,0x78,size)
        return raw
    directory=entry('Root Entry',5,1,0xFFFFFFFE,0)+entry('Elements',2,None,first_data,len(stream))
    directory=directory+b'\x00'*(sector-len(directory))
    fat_bytes=b''.join(struct.pack('<I',value) for value in fat)
    return bytes(header)+fat_bytes+bytes(directory)+stream


class FormatTests(unittest.TestCase):
    def test_ifc_reads_room_number_name_and_storey(self):
        elements,warnings=import_model('plan.ifc',IFC)
        by_id={item['id']:item for item in elements}
        room=by_id['outlet-a']
        self.assertEqual(room['room_number'],'101')
        self.assertEqual(room['room_name'],'Büro')
        self.assertEqual(room['room'],'101 · Büro')
        self.assertEqual(room['storey'],'1. OG')
        self.assertEqual(room['name'],'Steckdose Büro')
        self.assertEqual(room['quantity'],1)
        self.assertEqual(room['unit'],'')
        self.assertEqual(room['number'],'')
        self.assertEqual(room['va'],'')
        self.assertEqual(by_id['light-a']['room'],'101 · Büro')
        self.assertEqual(by_id['outlet-b']['room_number'],'102')
        self.assertEqual(by_id['outlet-b']['room_name'],'Korridor')
        self.assertEqual(by_id['outlet-b']['storey'],'1. OG')
        self.assertEqual(by_id['outlet-c']['room'],'')
        self.assertEqual(by_id['proxy-1']['room'],'102 · Korridor')
        self.assertNotIn('wall',by_id)
        self.assertEqual(by_id['outlet-d']['room'],'')
        self.assertEqual(by_id['outlet-d']['properties']['room_candidates'],['101 · Büro','102 · Korridor'])
        self.assertTrue(any('mehreren Räumen' in warning for warning in warnings))
        self.assertTrue(any('ohne eindeutigen IfcSpace' in warning for warning in warnings))

    def test_ifc_without_electrical_objects_is_rejected(self):
        text="ISO-10303-21;\nDATA;\n#1=IFCWALL('w',$,'Wand',$,$,$,$,$);\nENDSEC;\n"
        with self.assertRaisesRegex(ValueError,'Keine elektrischen'):import_model('leer.ifc',text)

    def test_csv_import_has_no_warnings(self):
        elements,warnings=import_model('x.csv','id;raum;menge\na;Büro;2\n')
        self.assertEqual(elements[0]['room'],'Büro')
        self.assertEqual(warnings,[])

    def test_nova_symbols_keep_name_item_and_layer(self):
        blob=_elements(
            'CO-Fühler, UP','elektro\\picture.png','Trimble.Nova.Elektro','Schalter','110-30','platz',
            'Trimble.Nova.Elektro','Schalter','110-30','2D-ST01','Fuehler','E_Installationen',
            'Hinweis','Label_Text','999',
        )
        symbols=symbols_from_elements(blob)
        self.assertEqual(len(symbols),1)
        self.assertEqual(symbols[0]['name'],'CO-Fühler, UP')
        self.assertEqual(symbols[0]['item'],'110-30')
        self.assertEqual(symbols[0]['graphic_id'],'2D-ST01')
        self.assertEqual(symbols[0]['graphic_name'],'Fuehler')
        self.assertEqual(symbols[0]['layer'],'E_Installationen')

    def test_n4_file_reads_appliances_without_a_room(self):
        blob=_elements(
            'Steckdose','elektro/sym.png','Trimble.Nova.Elektro','Dosen','112-01','platz',
            'Trimble.Nova.Elektro','Dosen','112-01','2D-DOSE','Dose','E_Starkstrom',
        )
        elements,warnings=import_model('1og.n4d',_ole(blob))
        self.assertEqual(len(elements),1)
        item=elements[0]
        self.assertEqual(item['name'],'Steckdose')
        self.assertEqual(item['room'],'')
        self.assertEqual(item['room_number'],'')
        self.assertEqual(item['room_name'],'')
        self.assertEqual(item['placement'],'E_Starkstrom')
        self.assertEqual(item['quantity'],1)
        self.assertEqual(item['unit'],'')
        self.assertEqual(item['number'],'')
        self.assertEqual(item['properties']['nova_item'],'112-01')
        self.assertTrue(any('Raumnummer' in warning for warning in warnings))
        self.assertTrue(any('Leere Felder bleiben leer' in warning for warning in warnings))
        self.assertTrue(any('keine Steiger-Artikelnummern' in warning for warning in warnings))

    def test_nova_properties_supply_room_and_storey_when_filled(self):
        blob=_elements(
            'Gebäude','GHN','Raumnummer','1.126','PosNr','','Bez','Steckdose T13','Bem','','Raum','Gesprächszimmer','Geschoss','1',
            'GlobalID','ABC123456789','Schaltkreis','Licht UG',
            'Steckdose T13','elektro/sym.png','Trimble.Nova.Elektro','Dosen','112-01','platz',
            'Trimble.Nova.Elektro','Dosen','112-01','2D-DOSE','Dose','E_Starkstrom',
            'Gebäude','GHN','Raumnummer','','PosNr','','Bez','Leuchte','Bem','','Raum','','Geschoss','',
            'Leuchte','elektro/sym.png','Trimble.Nova.Elektro','Leuchten','130-10','platz',
            'Trimble.Nova.Elektro','Leuchten','130-10','2D-LEU','Leuchte','E_Licht',
        )
        elements,warnings=import_model('ug.n4m',_ole(blob))
        by_name={item['name']:item for item in elements}
        socket=by_name['Steckdose T13']
        self.assertEqual(socket['room_number'],'1.126')
        self.assertEqual(socket['room_name'],'Gesprächszimmer')
        self.assertEqual(socket['room'],'1.126 · Gesprächszimmer')
        self.assertEqual(socket['storey'],'1')
        self.assertEqual(socket['properties']['room_source'],'Bauteileigenschaft')
        self.assertEqual(socket['properties']['global_id'],'ABC123456789')
        self.assertEqual(socket['properties']['circuit'],'Licht UG')
        self.assertEqual(socket['properties']['nova_item'],'112-01')
        self.assertEqual(socket['quantity'],1)
        self.assertEqual(socket['unit'],'')
        light=by_name['Leuchte']
        self.assertEqual(light['room'],'')
        self.assertEqual(light['storey'],'')
        self.assertEqual(light['properties']['room_source'],'')
        self.assertTrue(any('1 von 2' in warning or 'haben ein Geschoss' in warning for warning in warnings))

    def test_recorded_nova_model_keeps_empty_rooms_and_reads_storey(self):
        source=Path('/home/ubuntu/.cursor/projects/workspace/uploads/ELT_GRU_UG02_1dca.n4m')
        try:
            if not source.is_file():
                self.skipTest('Optionale externe Nova-Beispieldatei ist nicht vorhanden')
            source_bytes=source.read_bytes()
        except OSError as error:
            self.skipTest(f'Optionale externe Nova-Beispieldatei ist nicht zugänglich: {error}')
        elements,warnings=import_model(source.name,source_bytes)
        self.assertEqual(len(elements),211)
        self.assertEqual(sum(1 for item in elements if item['room']),0)
        self.assertEqual(sum(1 for item in elements if item['storey']=='UG02'),101)
        self.assertEqual(sum(1 for item in elements if item['properties'].get('circuit')=='Schaltkreis'),0)
        self.assertGreater(sum(1 for item in elements if item['properties'].get('global_id')),150)
        self.assertTrue(any('0 einen Raum' in warning for warning in warnings))

    def test_import_limit_accepts_a_200_mb_ifc_after_base64(self):
        self.assertGreaterEqual(MAX_IMPORT_FILE,200_000_000)
        self.assertGreaterEqual(MAX_IMPORT_BODY,(MAX_IMPORT_FILE+2)//3*4+1000)

    def test_plain_bytes_are_not_treated_as_nova(self):
        with self.assertRaisesRegex(ValueError,'kein Nova-N4D/N4M'):import_model('x.n4m',b'kein ole')

if __name__=='__main__':unittest.main()
