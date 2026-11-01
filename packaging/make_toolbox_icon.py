"""Render the real edeco wordmark into the common icon and installer artwork."""

import io
import os
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "packaging"
ET.register_namespace("", "http://www.w3.org/2000/svg")


def font(size, bold=False):
    for name in (["arialbd.ttf", "DejaVuSans-Bold.ttf"] if bold else ["arial.ttf", "DejaVuSans.ttf"]):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            pass
    return ImageFont.load_default(size=size)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get("NOVA_TEST_CHROMIUM") or None)
        page = browser.new_page(viewport={"width": 1024, "height": 1024})

        def render(svg, width, height):
            page.set_viewport_size({"width": width, "height": height})
            page.set_content(f'<style>html,body{{margin:0;background:transparent}}svg{{display:block;width:{width}px;height:{height}px}}</style>{svg}')
            return Image.open(io.BytesIO(page.screenshot(omit_background=True))).convert("RGBA")

        icon = render((ROOT / "ui/src/assets/toolbox-icon.svg").read_text(), 1024, 1024)
        icon = icon.resize((256, 256), Image.Resampling.LANCZOS)
        icon.save(OUT / "toolbox.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
        icon.save(OUT / "toolbox-icon.png")
        logo = ET.parse(ROOT / "ui/src/assets/edeco-logo.svg").getroot()
        for item in logo.iter():
            if item.get("class") in {"cls-1", "cls-2", "cls-3"}:
                item.set("style", "fill:white")
        mark = render(ET.tostring(logo, encoding="unicode"), 520, 224)
        for scale in (1, 2):
            image = Image.new("RGB", (164 * scale, 314 * scale), "#017c92")
            brand = mark.resize((132 * scale, 57 * scale), Image.Resampling.LANCZOS)
            image.paste(brand, (16 * scale, 88 * scale), brand)
            draw = ImageDraw.Draw(image)
            draw.text((82 * scale, 163 * scale), "edeco", anchor="mt", font=font(17 * scale), fill="white")
            draw.text((82 * scale, 186 * scale), "Toolbox", anchor="mt", font=font(23 * scale, True), fill="white")
            draw.text((82 * scale, 259 * scale), "Alle Werkzeuge.", anchor="mt", font=font(10 * scale), fill="white")
            draw.text((82 * scale, 276 * scale), "Ein Programm.", anchor="mt", font=font(10 * scale), fill="white")
            image.save(OUT / ("toolbox-wizard-image.png" if scale == 1 else "toolbox-wizard-image-2x.png"))
            image.save(OUT / ("toolbox-wizard-image.bmp" if scale == 1 else "toolbox-wizard-image-2x.bmp"))
        small = Image.new("RGB", (55, 55), "white")
        miniature = icon.resize((55, 55), Image.Resampling.LANCZOS)
        small.paste(miniature, (0, 0), miniature)
        small.save(OUT / "toolbox-wizard-small.png")
        small.save(OUT / "toolbox-wizard-small.bmp")
        browser.close()
    print("Toolbox-Icon und edeco-Installerbilder erstellt.")


if __name__ == "__main__":
    main()
