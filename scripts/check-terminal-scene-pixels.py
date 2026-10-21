"""Compare complete frames and regions that the moving device never covers."""
import json
from pathlib import Path
from PIL import Image, ImageChops

root = Path(__file__).resolve().parents[1] / 'design-assets/terminal-exploded/qa-scene'
report = []
for name in ['desktop', 'phone', 'preview']:
    baseline = Image.open(root / f'{name}-home.png').convert('RGB')
    for suffix in ['handoff', 'restored']:
        current = Image.open(root / f'{name}-{suffix}.png').convert('RGB')
        diff = ImageChops.difference(baseline, current)
        changed = sum(pixel != (0, 0, 0) for pixel in diff.get_flattened_data())
        report.append({'view': name, 'frame': suffix, 'pixelsChecked': baseline.width * baseline.height, 'changedPixels': changed})
    regions = {'desktop': [(800, 0, 1440, 900)], 'phone': [(0, 0, 393, 280), (0, 790, 393, 852)], 'preview': [(0, 0, 685, 300), (600, 0, 685, 846)]}[name]
    for frame in range(6):
        current = Image.open(root / f'{name}-motion-{frame}.png').convert('RGB')
        for box in regions:
            diff = ImageChops.difference(baseline.crop(box), current.crop(box))
            changed = sum(pixel != (0, 0, 0) for pixel in diff.get_flattened_data())
            report.append({'view': name, 'frame': frame, 'unchangedRegion': list(box), 'pixelsChecked': diff.width * diff.height, 'changedPixels': changed})
root.joinpath('pixel-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'comparisons': len(report), 'pixelsChecked': sum(r['pixelsChecked'] for r in report), 'changedPixels': sum(r['changedPixels'] for r in report)}))
assert all(r['changedPixels'] == 0 for r in report), 'Frame or unchanged homepage region changed'
