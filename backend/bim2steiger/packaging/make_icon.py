"""Draw the BIM2STEIGER icon: navy tile, blue hexagon, white cube.

Writes packaging/app.png, packaging/app.ico and web/favicon.png.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw

NAVY = (20, 34, 56, 255)
BLUE = (49, 92, 231, 255)
WHITE = (255, 255, 255, 255)


def hex_points(cx, cy, radius):
    return [
        (cx + radius * math.cos(math.radians(-90 + i * 60)),
         cy + radius * math.sin(math.radians(-90 + i * 60)))
        for i in range(6)
    ]


def draw(scale=4):
    size = 256 * scale
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pen = ImageDraw.Draw(image)
    margin = 16 * scale
    pen.rounded_rectangle(
        (margin, margin, size - margin - 1, size - margin - 1),
        radius=58 * scale,
        fill=NAVY,
    )
    cx = size / 2
    cy = size / 2 + 1 * scale
    pen.polygon(hex_points(cx, cy, 80 * scale), fill=BLUE)

    span = 44 * scale
    cy += 3 * scale
    top = (cx, cy - span)
    left = (cx - span * 0.866, cy - span * 0.5)
    right = (cx + span * 0.866, cy - span * 0.5)
    middle = (cx, cy)
    lower_left = (cx - span * 0.866, cy + span * 0.5)
    lower_right = (cx + span * 0.866, cy + span * 0.5)
    bottom = (cx, cy + span)
    width = max(1, round(7.5 * scale))
    cap = width / 2
    outline = [top, right, lower_right, bottom, lower_left, left, top]
    pen.line(outline, fill=WHITE, width=width, joint="curve")
    for start, end in ((left, middle), (right, middle), (top, middle), (middle, bottom)):
        pen.line((start, end), fill=WHITE, width=width, joint="curve")
    for point in (top, left, right, middle, lower_left, lower_right, bottom):
        pen.ellipse((point[0] - cap, point[1] - cap, point[0] + cap, point[1] + cap), fill=WHITE)
    return image.resize((256, 256), Image.Resampling.LANCZOS)


def main():
    image = draw()
    here = Path(__file__).resolve().parent
    png = here / "app.png"
    ico = here / "app.ico"
    favicon = here.parent / "web" / "favicon.png"
    image.save(png)
    image.resize((32, 32), Image.Resampling.LANCZOS).save(favicon)
    image.save(ico, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print(ico)


if __name__ == "__main__":
    main()
