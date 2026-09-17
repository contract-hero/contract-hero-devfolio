"""Paste a Nano Banana Pro edit of one region back into assets/room.jpg, leaving the rest of the frame
unchanged apart from the JPEG re-encode.

Recipe:
1. Cut a square context crop around the object: `sips -c N N --cropOffset Y X room.jpg --out crop.jpg`
   (sips takes height width, then y x).
2. Ask Nano Banana Pro through the Higgsfield CLI to change only that object, with the crop as image 1
   (and a reference photo of the real object as image 2 when there is one):
     higgsfield generate create nano_banana_pro --prompt "Change ONLY ... everything else exactly as it is" \
       --image-references crop.jpg --aspect_ratio 1:1 --resolution 1k --wait --json
3. Run this script: it resizes the edit to the crop size, aligns it to the original by brute-force
   offset search on the pixels OUTSIDE the box, and pastes only the box back through a feathered mask.
   The blend bleeds about one feather radius past the box.

Usage: retouch-room.py <room.jpg> <out.jpg> <edit.png> <X> <Y> <N> <l,t,r,b> [feather=12]
  X Y N       the crop's offset and size in the room photo
  l,t,r,b     the box to paste back, in crop coordinates
Needs Pillow: python3 -m venv /tmp/venv && /tmp/venv/bin/pip install pillow && /tmp/venv/bin/python tools/retouch-room.py ...

Done so far (2048x2048 room.jpg):
  2026-09-16 floppy stacks: crops 512 at (130,1150) box 110,160,405,290 and (1536,1200) box 205,185,512,330.
  2026-09-17 monitor bezel: crop 1024 at (512,440) box 70,180,950,845 feather 14 ("a thin dark inner frame
             lip of the same depth on all four sides, screen a flat pure black rectangle"); aligned at (0,0).
"""
import os, sys
from PIL import Image, ImageFilter, ImageChops, ImageStat, ImageDraw

def die(msg):
    raise SystemExit(f"retouch-room: {msg}")

if len(sys.argv) not in (8, 9):
    die(__doc__.split("Usage: ")[1].split("\n")[0])
src, out, edit_path = sys.argv[1:4]
try:
    ox, oy, n = (int(v) for v in sys.argv[4:7])
    box = tuple(int(v) for v in sys.argv[7].split(","))
    feather = int(sys.argv[8]) if len(sys.argv) == 9 else 12
    if len(box) != 4: raise ValueError
except ValueError:
    die("X, Y, N and feather must be integers and the box four comma-separated integers")

room = Image.open(src).convert("RGB")
edit = Image.open(edit_path).convert("RGB").resize((n, n), Image.LANCZOS)
orig = room.crop((ox, oy, ox + n, oy + n))

# alignment: minimise the mean abs diff outside the box
outside = Image.new("L", (n, n), 255)
ImageDraw.Draw(outside).rectangle([box[0] - 20, box[1] - 20, box[2] + 20, box[3] + 20], fill=0)
def score(img):
    return ImageStat.Stat(ImageChops.difference(img, orig).convert("L"), mask=outside).mean[0]
search = 8
base = score(edit)
best = min(((score(ImageChops.offset(edit, dx, dy)), dx, dy) for dx in range(-search, search + 1) for dy in range(-search, search + 1)))
s, dx, dy = best
print(f"outside-box mean diff {base:.2f} -> {s:.2f} at offset ({dx},{dy})")
# A best offset on the search boundary means the true offset is outside the window, and ImageChops.offset
# wraps pixels around the crop edge: refuse rather than composite a misaligned patch.
if s > base or abs(dx) == search or abs(dy) == search:
    die(f"alignment failed ({s:.2f} at {dx},{dy}); nothing written")
edit = ImageChops.offset(edit, dx, dy)

mask = Image.new("L", (n, n), 0)
ImageDraw.Draw(mask).rectangle(list(box), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(feather))
room.paste(Image.composite(edit, orig, mask), (ox, oy))
room.save(out, quality=88, subsampling=0, optimize=True)
print(out, os.path.getsize(out), "bytes")
