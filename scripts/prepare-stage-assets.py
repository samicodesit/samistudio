"""Lossless encoding of the approved stage and generated clean-plate PNGs.

No resizing, retouching, compositing, or recoloring occurs here. Native HTML
replaces overlay text in the browser; the approved photographic pixels remain.
"""
from pathlib import Path
from PIL import Image
import sys

SOURCE = Path('/mnt/c/Users/Sami/.codex/generated_images/01a130b2-d18c-7ad1-a04f-0cce5bb3b5fd')
OUTPUT = Path(__file__).resolve().parents[1] / 'assets' / 'gallery'
IMAGES = {
    'autolister-desktop': 'exec-9d884a5b-0482-4fa6-886e-8d3f63cb72e2.png',
    'autolister-mobile': 'exec-8d37bc2d-75f8-4bfb-bef9-1673a83b87b2.png',
    'cryptik-desktop': 'exec-05d93805-d871-4cd5-b57a-665b3740fffe.png',
    'cryptik-mobile': 'exec-8ee8a5f0-60ec-4174-8a58-a60b98c3a309.png',
    'autolister-desktop-clean': 'exec-66a82936-37af-40ce-8280-ac02cfeb1cb2.png',
    'autolister-mobile-clean': 'exec-3d64b6cc-ba45-473f-981a-992e4fa32765.png',
    'cryptik-desktop-clean': 'exec-10595617-b90c-48b7-a599-cbd39375ed4e.png',
    'cryptik-mobile-clean': 'exec-12cb34bb-d99a-4f23-852c-90857b26bf3d.png',
    'autolister-room-wide': 'exec-99d05b79-bb0b-43d5-8feb-fb4fb5fdffcf.png',
    'cryptik-room-wide': 'exec-53e6862f-4221-4257-858d-00cc4087cb15.png',
}

PATCHES = {
    'autolister-desktop': [(54, 36, 211, 62), (1264, 37, 187, 62), (1108, 402, 372, 258)],
    'autolister-mobile': [(48, 49, 279, 81), (540, 61, 253, 61), (43, 1363, 681, 378)],
    'cryptik-desktop': [(54, 36, 211, 62), (1264, 37, 187, 62), (937, 307, 439, 247)],
    'cryptik-mobile': [(32, 50, 302, 78), (574, 61, 238, 62), (30, 1468, 645, 321)],
}

for name, source in ([] if '--patches-only' in sys.argv else IMAGES.items()):
    image = Image.open(SOURCE / source).convert('RGB')
    target = OUTPUT / f'{name}.webp'
    image.save(target, lossless=True, method=6)
    assert Image.open(target).convert('RGB').tobytes() == image.tobytes()
    print(f'{name}: {image.size}, {target.stat().st_size:,} bytes, pixel-identical')

for name, regions in PATCHES.items():
    clean = Image.open(SOURCE / IMAGES[f'{name}-clean']).convert('RGB')
    for part, (x, y, width, height) in zip(['wordmark', 'back', 'caption'], regions):
        image = clean.crop((x, y, x + width, y + height))
        target = OUTPUT / f'{name}-patch-{part}.webp'
        image.save(target, lossless=True, method=6)
        assert Image.open(target).convert('RGB').tobytes() == image.tobytes()
        print(f'{target.name}: {image.size}, {target.stat().st_size:,} bytes, pixel-identical')
