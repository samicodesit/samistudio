"""Place reference and browser capture together for visual QA, never runtime."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import sys

SOURCE = Path('/mnt/c/Users/Sami/.codex/generated_images/01a130b2-d18c-7ad1-a04f-0cce5bb3b5fd')
EVIDENCE = Path('/mnt/c/Users/Sami/.codex/visualizations/2026/10/12/01a130b2-d18c-7ad1-a04f-0cce5bb3b5fd/samistudio')
REFERENCES = {
    'autolister-desktop': 'exec-9d884a5b-0482-4fa6-886e-8d3f63cb72e2.png',
    'autolister-mobile': 'exec-8d37bc2d-75f8-4bfb-bef9-1673a83b87b2.png',
    'cryptik-desktop': 'exec-05d93805-d871-4cd5-b57a-665b3740fffe.png',
    'cryptik-mobile': 'exec-8ee8a5f0-60ec-4174-8a58-a60b98c3a309.png',
}
iteration = sys.argv[1] if len(sys.argv) > 1 else '01'
for key, filename in REFERENCES.items():
    reference = Image.open(SOURCE / filename).convert('RGB')
    actual = Image.open(EVIDENCE / f'{key}-built-{iteration}.jpg').convert('RGB')
    assert reference.size == actual.size, (key, reference.size, actual.size)
    board = Image.new('RGB', (reference.width * 2 + 24, reference.height + 44), '#faf8f4')
    draw = ImageDraw.Draw(board)
    draw.text((12, 16), 'APPROVED REFERENCE', fill='#20211e')
    draw.text((reference.width + 36, 16), 'ACTUAL BROWSER IMPLEMENTATION', fill='#20211e')
    board.paste(reference, (0, 44))
    board.paste(actual, (reference.width + 24, 44))
    board.save(EVIDENCE / f'{key}-comparison-{iteration}.jpg', quality=95, subsampling=0)
    crop = (1105, 400, 1480, 690) if key == 'autolister-desktop' else (930, 300, 1415, 557) if key == 'cryptik-desktop' else (24, 1350 if key.startswith('auto') else 1460, 820, 1785)
    focus = Image.new('RGB', ((crop[2] - crop[0]) * 2 + 24, crop[3] - crop[1]))
    focus.paste(reference.crop(crop), (0, 0))
    focus.paste(actual.crop(crop), (crop[2] - crop[0] + 24, 0))
    focus.save(EVIDENCE / f'{key}-type-comparison-{iteration}.jpg', quality=95, subsampling=0)
    print(f'{key}: same dimensions {actual.size}, comparison saved')

if iteration == '04':
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 24)
    for project in ['autolister', 'cryptik']:
        board = Image.new('RGB', (1600, 1518), '#faf8f4')
        draw = ImageDraw.Draw(board)
        project_title = {'autolister': 'AutoLister', 'cryptik': 'Cryptik'}[project]
        draw.text((18, 15), f'{project_title} / APPROVED REFERENCE', fill='#20211e', font=font)
        draw.text((826, 15), 'BUILT SITE / DESKTOP + MOBILE', fill='#20211e', font=font)
        for column in [0, 1]:
            for device in ['desktop', 'mobile']:
                key = f'{project}-{device}'
                path = SOURCE/REFERENCES[key] if column == 0 else EVIDENCE/f'{key}-built-{iteration}.jpg'
                photo = Image.open(path).convert('RGB')
                width = 788 if device == 'desktop' else 400
                height = round(photo.height * width / photo.width)
                photo = photo.resize((width, height), Image.Resampling.LANCZOS)
                x = column * 812 + (788 - width)//2
                y = 54 if device == 'desktop' else 625
                board.paste(photo, (x, y))
        board.save(EVIDENCE/f'{project}-implementation-review.jpg', quality=95, subsampling=0)
