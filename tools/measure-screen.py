"""Find the black CRT screen rectangle in an image. Pure Python: sips -> BMP -> scan from the centre."""
import struct, subprocess, sys, statistics, os
src = sys.argv[1]; T = int(sys.argv[2]) if len(sys.argv) > 2 else 45
bmp = '/tmp/_measure.bmp'
subprocess.run(['sips', '-s', 'format', 'bmp', src, '--out', bmp], check=True, capture_output=True)
d = open(bmp, 'rb').read(); os.remove(bmp)
off = struct.unpack_from('<I', d, 10)[0]; w = struct.unpack_from('<i', d, 18)[0]; h = struct.unpack_from('<i', d, 22)[0]
bpp = struct.unpack_from('<H', d, 28)[0]; bottom_up = h > 0; h = abs(h); Bpp = bpp // 8
stride = ((bpp * w + 31) // 32) * 4
def lum(x, y):
    row = (h - 1 - y) if bottom_up else y
    i = off + row * stride + x * Bpp
    b, g, r = d[i], d[i+1], d[i+2]
    return (r*299 + g*587 + b*114) // 1000
def dark(x, y): return 0 <= x < w and 0 <= y < h and lum(x, y) < T
cx, cy = w // 2, int(h * (float(sys.argv[3]) if len(sys.argv) > 3 else 0.5))
# nudge to the nearest dark pixel if the centre is not on the screen
if not dark(cx, cy):
    for r in range(1, 400):
        hit = next(((cx+dx, cy+dy) for dx in range(-r, r+1, 4) for dy in range(-r, r+1, 4) if dark(cx+dx, cy+dy)), None)
        if hit: cx, cy = hit; break
def run(x, y, dx, dy):
    miss = 0
    while 0 <= x < w and 0 <= y < h:
        miss = 0 if dark(x, y) else miss + 1
        if miss >= 4: return (x - dx*miss, y - dy*miss)
        x += dx; y += dy
    return (x, y)
L, R, Tp, B = [], [], [], []
for k in range(-6, 7):
    y = cy + int(k * h * 0.025)
    if dark(cx, y): L.append(run(cx, y, -1, 0)[0]); R.append(run(cx, y, 1, 0)[0])
    x = cx + int(k * w * 0.02)
    if dark(x, cy): Tp.append(run(x, cy, 0, -1)[1]); B.append(run(x, cy, 0, 1)[1])
l, r, t, b = statistics.median(L), statistics.median(R), statistics.median(Tp), statistics.median(B)
print(f"image {w}x{h}  screen px: left={l} right={r} top={t} bottom={b}  ({r-l}x{b-t}, aspect {(r-l)/(b-t):.3f})")
print(f"--sx:{100*l/w:.2f}%; --sy:{100*t/h:.2f}%; --sw:{100*(r-l)/w:.2f}%; --sh:{100*(b-t)/h:.2f}%;")
print("samples L", sorted(L), "R", sorted(R), "T", sorted(Tp), "B", sorted(B))
