"""Compare the unchanged homepage to live and detect the reproduced closing pulse."""
import json
from pathlib import Path
from PIL import Image, ImageChops, ImageStat

root = Path(__file__).resolve().parents[1] / 'design-assets/terminal-exploded/qa-release'
report = {'surfaces': [], 'closing': []}
for view in ['desktop', 'phone', 'preview']:
    for state in ['work', 'about', 'contact']:
        live = Image.open(root / f'{view}-live-{state}.png').convert('RGB')
        local = Image.open(root / f'{view}-local-{state}.png').convert('RGB')
        diff = ImageChops.difference(live, local)
        changed = sum(pixel != (0, 0, 0) for pixel in diff.get_flattened_data())
        report['surfaces'].append({'view': view, 'state': state, 'pixels': live.width * live.height, 'changedPixels': changed})
        assert changed == 0, f'{view} {state} differs from the pre-release live homepage'
baseline = Image.open(root / 'closing-1800.png').convert('RGB')
for time in [300, 500, 700, 900, 1100, 1300, 1500, 1800]:
    current = Image.open(root / f'closing-{time}.png').convert('RGB')
    diff = ImageChops.difference(baseline, current)
    report['closing'].append({'timeMs': time, 'meanDifference': sum(ImageStat.Stat(diff).mean) / 3, 'changedPixels': sum(p != (0, 0, 0) for p in diff.get_flattened_data())})
# The original overlapping fades made the 500ms frame brighter than 300ms.
assert report['closing'][1]['meanDifference'] < report['closing'][0]['meanDifference']
assert all(frame['changedPixels'] == 0 for frame in report['closing'][2:]), 'Closing swaps to a different final surface'
root.joinpath('surface-and-closing-report.json').write_text(json.dumps(report, indent=2))
print(json.dumps({'surfaceComparisons': len(report['surfaces']), 'surfacePixels': sum(r['pixels'] for r in report['surfaces']), 'changedSurfacePixels': sum(r['changedPixels'] for r in report['surfaces']), 'stableClosingFrames': len(report['closing']) - 2}))
