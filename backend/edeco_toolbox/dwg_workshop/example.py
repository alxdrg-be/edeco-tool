"""Small schematic office model used when opening the beta workshop."""

import ezdxf
from ezdxf import units, xref
from ezdxf.enums import TextEntityAlignment


def example_plan():
    doc = ezdxf.new("R2013", units=units.MM)
    colors = {"A_WAND": 5, "A_TUER": 30, "A_FENSTER": 4, "A_MOEB": 3, "A_SCHRAFF": 8, "A_TEXT": 1}
    for name, color in colors.items():
        doc.layers.new(name, dxfattribs={"color": color})
    model = doc.modelspace()

    def line(p, q, layer):
        model.add_line(p, q, dxfattribs={"layer": layer})

    def rectangle(x, y, w, h, layer, layout=model):
        return layout.add_lwpolyline([(x, y), (x+w, y), (x+w, y+h), (x, y+h)], close=True, dxfattribs={"layer": layer})

    rectangle(0, 0, 16000, 9500, "A_WAND")
    rectangle(220, 220, 15560, 9060, "A_WAND")
    for y in (3350, 5250):
        for a, b in ((220, 1700), (2700, 6750), (7750, 10250), (11250, 15780)):
            rectangle(a, y, b-a, 135, "A_WAND")
        for x in (1700, 6750, 10250):
            direction = -1 if y == 3350 else 1
            line((x, y), (x, y+direction*1000), "A_TUER")
            start, end = (270, 360) if direction < 0 else (0, 90)
            model.add_arc((x, y), 1000, start, end, dxfattribs={"layer": "A_TUER"})
    for x in (5650, 9875):
        rectangle(x, 220, 135, 3130, "A_WAND")
        rectangle(x, 5385, 135, 3895, "A_WAND")
    for x in (750, 3250, 6500, 10500, 13250):
        for y in (85, 9350):
            rectangle(x, y, 1850, 75, "A_FENSTER")

    desk = doc.blocks.new("Tisch")
    rectangle(0, 0, 1450, 800, "A_MOEB", desk)
    rectangle(450, -370, 550, 300, "A_MOEB", desk)
    for x, y in ((1150, 7400), (3400, 7400), (6600, 7400), (11300, 7400), (13600, 7400), (1200, 1950), (3500, 1950)):
        model.add_blockref("Tisch", (x, y), dxfattribs={"layer": "A_MOEB"})
    for x in range(10700, 14601, 300):
        line((x, 600), (x+1250, 1850), "A_SCHRAFF")
    for label, x, y in (("Büro 01", 3250, 6250), ("Sitzung", 7850, 6250), ("Büro 03", 13300, 6250),
                         ("Korridor", 8000, 4350), ("Büro 02", 3500, 1050), ("Archiv", 7900, 1600),
                         ("Technik", 13300, 2650)):
        model.add_text(label, dxfattribs={"height": 225, "layer": "A_TEXT"}).set_placement((x, y), align=TextEntityAlignment.MIDDLE_CENTER)
    symbol = doc.blocks.new("Planvermerk")
    symbol.add_wipeout([(0, 0), (1750, 0), (1750, 430), (0, 430)], dxfattribs={"layer": "A_TEXT"})
    symbol.add_mtext("Anschluss", dxfattribs={"char_height": 170, "layer": "A_TEXT", "insert": (110, 320)}).set_bg_color("canvas")
    model.add_blockref("Planvermerk", (12800, 1050))
    xref.define(doc, "Fassade", "Fassade.dwg")
    model.add_blockref("Fassade", (0, 0))
    return doc
