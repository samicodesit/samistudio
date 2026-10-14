"""Prepare atelier photography using the authentic Doodle illustration assets.

The room and physical panel come from the approved photographic masters.
Original product artwork is projectively placed on those printed surfaces.
No illustration is redrawn. One flattened photograph per layout avoids runtime
seams, moving sticky notes, or extra artwork downloads while scrolling.
"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

SOURCE = Path('/mnt/c/Users/Sami/.codex/generated_images/01a130b2-d18c-7ad1-a04f-0cce5bb3b5fd')
OUTPUT = Path(__file__).resolve().parents[1] / 'assets' / 'gallery'
ART = OUTPUT.parents[1] / 'design-assets' / 'doodle-originals'
PLATES = {
    'doodle-atelier-desktop': 'exec-45e28131-5ef5-4552-b78a-9c3f629d64c2.png',
    'doodle-atelier-portrait-room': 'exec-9e3341bd-8831-4a5c-b45f-2bd631190d19.png',
    'doodle-atelier-landscape': 'exec-5570e2ab-6405-42c4-bd4e-f42f8e5eb4f1.png',
    'doodle-atelier-panorama': 'exec-44948d79-c5fa-4aab-aa0f-a66e38792352.png',
}

# Coordinates are measured in each source photograph, clockwise from top left.
# The original board silhouette masks the note so it remains physically behind it.
LAYOUTS = {
    'desktop': {
        'board': [(249,168),(1060,249),(1115,769),(281,819)],
        'note': [(1066,178),(1256,160),(1257,349),(1072,361)],
        'cat_clear': (894,410,1055,658),
        'cat': [(900,414),(1038,428),(1050,650),(907,654)],
        'samples': [
            [(722,707),(819,703),(826,788),(726,794)],
            [(842,702),(940,698),(946,781),(847,787)],
            [(960,698),(1056,693),(1062,774),(965,780)]],
        'flowers': [(737,415),(848,419),(850,462),(739,458)],
    },
    'portrait-room': {
        'board': [(241,314),(625,336),(659,971),(247,986)],
        'note': [(608,280),(773,279),(777,467),(614,470)],
        'cat_clear': (516,528,628,727),
        'cat': [(519,535),(621,541),(627,718),(521,724)],
        'samples': [
            [(284,852),(388,851),(391,963),(284,966)],
            [(407,850),(508,849),(511,960),(409,963)],
            [(526,849),(621,848),(625,956),(529,959)]],
    },
    'landscape': {
        'board': [(230,294),(871,337),(908,744),(248,773)],
        'note': [(879,281),(1032,265),(1031,419),(881,430)],
        'cat_clear': (727,461,856,661),
        'cat': [(736,470),(840,480),(848,650),(739,653)],
        'samples': [
            [(586,692),(665,690),(669,756),(590,759)],
            [(683,690),(763,688),(768,751),(687,754)],
            [(780,688),(859,687),(863,747),(784,750)]],
        'flowers': [(594,469),(686,473),(688,504),(596,501)],
    },
    'panorama': {
        'board': [(539,176),(1216,249),(1262,678),(563,719)],
        'note': [(1223,193),(1382,179),(1382,335),(1229,345)],
        'cat_clear': (1080,387,1206,588),
        'cat': [(1084,389),(1193,401),(1203,581),(1088,584)],
        'samples': [
            [(934,626),(1017,620),(1022,694),(938,700)],
            [(1035,622),(1118,619),(1123,689),(1039,694)],
            [(1132,619),(1213,616),(1218,683),(1136,689)]],
        'flowers': [(947,385),(1040,389),(1042,422),(949,419)],
    },
}


def coefficients(destination, source):
    """Inverse homography for Pillow, solved without an optional dependency."""
    rows = []
    for (x, y), (u, v) in zip(destination, source):
        rows.extend([[x,y,1,0,0,0,-u*x,-u*y,u],
                     [0,0,0,x,y,1,-v*x,-v*y,v]])
    for col in range(8):
        pivot = max(range(col,8), key=lambda row: abs(rows[row][col]))
        rows[col],rows[pivot] = rows[pivot],rows[col]
        divisor = rows[col][col]
        if abs(divisor) < 1e-10:
            raise ValueError('Collapsed artwork plane')
        rows[col] = [cell/divisor for cell in rows[col]]
        for row in range(8):
            if row != col:
                factor = rows[row][col]
                rows[row] = [a-factor*b for a,b in zip(rows[row],rows[col])]
    return tuple(row[8] for row in rows)


def place(image, artwork, quad, behind=None):
    # A projective transform alone point-samples small textured line drawings.
    # Render the local plane at 4x then reduce once to retain continuous strokes.
    from math import floor, ceil
    left=floor(min(x for x,y in quad)); top=floor(min(y for x,y in quad))
    right=ceil(max(x for x,y in quad)); bottom=ceil(max(y for x,y in quad))
    factor=4
    destination=[((x-left)*factor,(y-top)*factor) for x,y in quad]
    local_size=((right-left)*factor,(bottom-top)*factor)
    artwork=artwork.convert('RGBA')
    artwork.thumbnail(local_size,Image.Resampling.LANCZOS)
    w,h = artwork.size
    transform = coefficients(destination, [(0,0),(w,0),(w,h),(0,h)])
    local=artwork.transform(local_size,Image.Transform.PERSPECTIVE,
        transform,Image.Resampling.BICUBIC).resize((right-left,bottom-top),Image.Resampling.LANCZOS)
    layer=Image.new('RGBA',image.size)
    layer.paste(local,(left,top))
    if behind:
        mask = Image.new('L',image.size,255)
        ImageDraw.Draw(mask).polygon(behind,fill=0)
        from PIL import ImageChops
        layer.putalpha(ImageChops.multiply(layer.getchannel('A'),mask))
    image.alpha_composite(layer)


def clear_print(image, box):
    """Restore only the smooth, unprinted UI substrate beneath the cat.

    The untouched substrate at four corners defines its smooth lighting. A narrow
    feather preserves the original panel lighting without a rectangle boundary.
    No panel edge, contact shadow, UI control, or room pixel is replaced.
    """
    left,top,right,bottom = box
    patch = Image.new('RGBA',(right-left,bottom-top))
    pixels = patch.load()
    corners=[image.getpixel(point) for point in [(left,top),(right,top),(left,bottom),(right,bottom)]]
    for y in range(top,bottom):
        v=(y-top)/(bottom-top-1)
        a=[corners[0][c]*(1-v)+corners[2][c]*v for c in range(3)]
        b=[corners[1][c]*(1-v)+corners[3][c]*v for c in range(3)]
        for x in range(right-left):
            t=x/(right-left-1)
            pixels[x,y-top]=tuple(round(a[c]*(1-t)+b[c]*t) for c in range(3))+(255,)
    mask=Image.new('L',patch.size,0)
    ImageDraw.Draw(mask).rectangle((3,3,patch.width-4,patch.height-4),fill=255)
    mask=mask.filter(ImageFilter.GaussianBlur(1))
    image.paste(patch,(left,top),mask)


def prepare(name, source):
    layout=LAYOUTS[name.removeprefix('doodle-atelier-')]
    image=Image.open(SOURCE/source).convert('RGBA')
    place(image,Image.open(ART/'birthday-puppy.png'),layout['note'],layout['board'])
    clear_print(image,layout['cat_clear'])
    place(image,Image.open(ART/'flower-cat.webp'),layout['cat'])
    for filename,quad in zip(['cooking.png','reading.png','gardening.png'],layout['samples']):
        place(image,Image.open(ART/filename),quad)
    if 'flowers' in layout:
        place(image,Image.open(ART/'flower-levels.png'),layout['flowers'])
    target=OUTPUT/f'{name}.webp'
    image.convert('RGB').save(target,quality=96,method=6)
    assert Image.open(target).size==image.size
    print(f'{target.name}: {image.size}, {target.stat().st_size:,} bytes')


if __name__ == '__main__':
    for name,source in PLATES.items():
        prepare(name,source)
