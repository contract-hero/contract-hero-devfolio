"""One-off retouch of assets/room.jpg (2026-09-16): the two stacks of floppy disks were regenerated.

How it was done, so it can be repeated for another object:
1. Cut a 512x512 context crop around each object with sips (offsets below).
2. Ask Nano Banana Pro through the Higgsfield CLI to change only that object, with the crop as image 1
   and a reference photo of the real object as image 2:
     higgsfield generate create nano_banana_pro --prompt "..." --image-references crop.jpg \
       --image-references reference.png --aspect_ratio 1:1 --resolution 1k --wait --json
3. Run this script: it downsizes each edit to the crop size, aligns it to the original by brute-force
   offset search on the pixels OUTSIDE the object box, and pastes only the box back through a feathered
   mask. Everything outside the box stays pixel-identical to the original photo.
Needs Pillow: python3 -m venv /tmp/venv && /tmp/venv/bin/pip install pillow && /tmp/venv/bin/python tools/retouch-room.py
Inputs are expected in the working directory: room.jpg (original), left-edit.png, right-edit.png.
"""
from PIL import Image, ImageFilter, ImageChops, ImageStat
room = Image.open('room.jpg').convert('RGB')
def patch(edit_path, ox, oy, box, feather=12, search=6):
    """Paste the floppy region of an edited 512-crop back into the room at (ox, oy).
    box = (l, t, r, b) in crop coordinates. The edit is aligned by brute-force offset search on the
    pixels OUTSIDE the box, then blended through a feathered mask."""
    edit = Image.open(edit_path).convert('RGB').resize((512, 512), Image.LANCZOS)
    orig = room.crop((ox, oy, ox + 512, oy + 512))
    # alignment: minimise mean abs diff outside the box
    outside = Image.new('L', (512, 512), 255)
    from PIL import ImageDraw
    ImageDraw.Draw(outside).rectangle([box[0]-20, box[1]-20, box[2]+20, box[3]+20], fill=0)
    best = (1e9, 0, 0)
    for dx in range(-search, search + 1):
        for dy in range(-search, search + 1):
            shifted = ImageChops.offset(edit, dx, dy)
            diff = ImageChops.difference(shifted, orig).convert('L')
            score = ImageStat.Stat(diff, mask=outside).mean[0]
            if score < best[0]: best = (score, dx, dy)
    score, dx, dy = best
    base_score = ImageStat.Stat(ImageChops.difference(edit, orig).convert('L'), mask=outside).mean[0]
    print(f'{edit_path}: outside-box mean diff {base_score:.2f} -> {score:.2f} at offset ({dx},{dy})')
    edit = ImageChops.offset(edit, dx, dy)
    mask = Image.new('L', (512, 512), 0)
    ImageDraw.Draw(mask).rectangle(list(box), fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(feather))
    blended = Image.composite(edit, orig, mask)
    room.paste(blended, (ox, oy))
    return score
patch('left-edit.png', 130, 1150, (110, 160, 405, 290))
patch('right-edit.png', 1536, 1200, (205, 185, 512, 330))
room.save('room-fixed.jpg', quality=88, subsampling=0, optimize=True)
import os; print('room-fixed.jpg', os.path.getsize('room-fixed.jpg'), 'bytes')
# proof crops for review
room.crop((130, 1150, 642, 1662)).save('fixed-left.jpg', quality=90)
room.crop((1536, 1200, 2048, 1712)).save('fixed-right.jpg', quality=90)
