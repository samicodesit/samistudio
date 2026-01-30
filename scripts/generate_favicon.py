#!/usr/bin/env python3
"""Generate favicon.ico (64,32,16) from the monogram used in favicon.svg.

This script uses Pillow to draw a rounded dark square and a centered "S".
It tries common system fonts (DejaVu / Liberation) and falls back to the default font.

Run:
  python3 scripts/generate_favicon.py

No files are committed by this script.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys

OUT = Path(__file__).resolve().parents[1]
ICON_NAME = OUT / 'favicon.ico'

def find_font():
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf',
    ]
    for p in candidates:
        fp = Path(p)
        if fp.exists():
            return str(fp)
    return None

def make_base(size=64, bg='#050505', radius=10, letter='S', font_path=None):
    img = Image.new('RGBA', (size, size), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    # rounded rectangle
    try:
        draw.rounded_rectangle((0,0,size,size), radius=radius, fill=bg)
    except Exception:
        # Pillow old versions: draw rect + rounded corners fallback
        draw.rectangle((0,0,size,size), fill=bg)

    # load font
    font_size = int(size * 0.75)
    font = None
    if font_path:
        try:
            font = ImageFont.truetype(font_path, font_size)
        except Exception:
            font = None
    if font is None:
        try:
            font = ImageFont.truetype('DejaVuSans-Bold.ttf', font_size)
        except Exception:
            font = ImageFont.load_default()

    # center text
    text = letter
    bbox = draw.textbbox((0,0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    x = (size - w)/2 - bbox[0]
    y = (size - h)/2 - bbox[1]
    draw.text((x,y), text, font=font, fill='#ffffff')
    return img

def main():
    font_path = find_font()
    if font_path:
        print('Using font:', font_path)
    else:
        print('No TTF font found; using default bitmap font (may look different)')

    sizes = [64, 32, 16]
    base = make_base(size=64, font_path=font_path)
    # save intermediate PNGs (optional)
    (OUT / 'favicon-64.png').write_bytes(base.convert('RGBA').tobytes() if False else b'') if False else None

    # Save ICO with multiple sizes
    try:
        base.save(ICON_NAME, sizes=[(s,s) for s in sizes])
        print('Wrote', ICON_NAME)
    except Exception as e:
        # fallback: save resized images and then save first with sizes
        imgs = [base.resize((s,s), Image.LANCZOS) for s in sizes]
        imgs[0].save(ICON_NAME, sizes=[(s,s) for s in sizes])
        print('Wrote (fallback)', ICON_NAME)

if __name__ == '__main__':
    main()
