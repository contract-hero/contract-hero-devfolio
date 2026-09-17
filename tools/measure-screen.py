"""Find the black CRT screen rectangle in a room photo and print it as the CSS variables style.css needs
(fractions of the photo, 0-1).

No Python dependencies, but macOS only: it shells out to `sips` to decode the image to BMP, then
scans outward from a start pixel until it leaves the dark region.

Usage: measure-screen.py <image> [threshold=45] [centre_y_fraction=0.5]
  threshold          luminance (0-255) below which a pixel counts as screen. Raise it if the screen
                     is not pure black; above ~90 the scan escapes the bezel and reports the room.
  centre_y_fraction  where to start the scan, as a fraction of image height (0.47 for assets/room.jpg, whose screen centre sits above the middle).

Each edge is sampled at several points and the INNERMOST sample wins (max of the left and top samples,
min of the right and bottom), so a CRT glass whose edges bow outwards yields the rectangle inside its
corners, where text is safe. Two lines are printed: that rectangle, and the same rectangle inset ~1.2%
of its width and ~1.6% of its height per side so the text stays off the glass edge. Paste the INSET
line into style.css. The tool refuses to print CSS when the samples do not describe one plausible screen.
"""
import os, struct, subprocess, sys, tempfile

def die(msg):
    raise SystemExit(f"measure-screen: {msg}")

if len(sys.argv) < 2 or len(sys.argv) > 4:
    die(__doc__.split("\n\n")[2].strip())
src = sys.argv[1]
try:
    T = int(sys.argv[2]) if len(sys.argv) > 2 else 45
    CY = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
except ValueError:
    die("threshold must be an integer and centre_y_fraction a number")
if not os.path.isfile(src):
    die(f"no such image: {src}")

# sips exits 0 even when the source is missing or unreadable, so verify its output ourselves.
fd, bmp = tempfile.mkstemp(suffix=".bmp"); os.close(fd)
try:
    p = subprocess.run(["sips", "-s", "format", "bmp", src, "--out", bmp], capture_output=True, text=True)
    if p.returncode or not os.path.getsize(bmp):
        die(f"sips could not convert {src}\n{p.stdout}{p.stderr}")
    d = open(bmp, "rb").read()
finally:
    os.remove(bmp)
if d[:2] != b"BM":
    die("sips did not produce a BMP")
off = struct.unpack_from("<I", d, 10)[0]
w = struct.unpack_from("<i", d, 18)[0]
h = struct.unpack_from("<i", d, 22)[0]
bpp = struct.unpack_from("<H", d, 28)[0]
bottom_up = h > 0; h = abs(h)
if bpp not in (24, 32):
    die(f"unsupported BMP depth {bpp}; this parser needs 24 or 32 bits per pixel")
Bpp = bpp // 8
stride = ((bpp * w + 31) // 32) * 4
if len(d) < off + stride * h:
    die(f"BMP is truncated: {len(d)} bytes, expected at least {off + stride * h}")

def lum(x, y):
    row = (h - 1 - y) if bottom_up else y
    i = off + row * stride + x * Bpp
    b, g, r = d[i], d[i + 1], d[i + 2]
    return (r * 299 + g * 587 + b * 114) // 1000
def dark(x, y):
    return 0 <= x < w and 0 <= y < h and lum(x, y) < T

# Start at the centre (or the requested height). If that pixel is not dark, find a dark one nearby.
cx, cy = w // 2, int(h * CY)
if not dark(cx, cy):
    for r in range(4, 400, 4):
        hit = next(((cx + dx, cy + dy) for dx in range(-r, r + 1, 4) for dy in range(-r, r + 1, 4) if dark(cx + dx, cy + dy)), None)
        if hit:
            cx, cy = hit; break
    else:
        die(f"no dark pixel within 400px of ({cx},{cy}) at threshold {T}. Raise the threshold or move centre_y_fraction.")

def run(x, y, dx, dy):
    """Walk from (x,y) in direction (dx,dy); return the last dark pixel before 4 bright ones in a row."""
    last, miss = (x, y), 0
    while 0 <= x < w and 0 <= y < h:
        if dark(x, y): last, miss = (x, y), 0
        else:
            miss += 1
            if miss >= 4: break
        x += dx; y += dy
    return last

L, R, Tp, B = [], [], [], []
for k in range(-6, 7):
    y = cy + int(k * h * 0.025)
    if dark(cx, y): L.append(run(cx, y, -1, 0)[0]); R.append(run(cx, y, 1, 0)[0])
    x = cx + int(k * w * 0.02)
    if dark(x, cy): Tp.append(run(x, cy, 0, -1)[1]); B.append(run(x, cy, 0, 1)[1])

print("samples L", sorted(L), "R", sorted(R), "T", sorted(Tp), "B", sorted(B))
MIN = 5
for name, s, span in (("left", L, w), ("right", R, w), ("top", Tp, h), ("bottom", B, h)):
    if len(s) < MIN:
        die(f"only {len(s)} {name} samples (need {MIN}); the start point is probably not on the screen")
    if max(s) - min(s) > 0.08 * span:
        die(f"{name} samples disagree by more than 8% of the image; the scan hit more than one dark object")
l, r, t, b = max(L), min(R), max(Tp), min(B)   # innermost sample per side: safe inside a curved glass
if not (0 < l < r < w - 1 and 0 < t < b < h - 1):
    die(f"the rectangle runs to the image edge: left={l} right={r} top={t} bottom={b}")
aspect = (r - l) / (b - t)
if not 1.2 < aspect < 2.2:
    die(f"implausible screen aspect {aspect:.2f}; the start point is probably not on the screen")

sx, sy, sw, sh = l / w, t / h, (r - l) / w, (b - t) / h
ix, iy = sw * 0.012, sh * 0.016
print(f"image {w}x{h}  screen px: left={l} right={r} top={t} bottom={b}  ({r - l}x{b - t}, aspect {aspect:.3f})")
print(f"raw:   --sx: {sx:.4f}; --sy: {sy:.4f}; --sw: {sw:.4f}; --sh: {sh:.4f};")
print(f"INSET: --sx: {sx + ix:.4f}; --sy: {sy + iy:.4f}; --sw: {sw - 2 * ix:.4f}; --sh: {sh - 2 * iy:.4f};   <- paste this into style.css")
