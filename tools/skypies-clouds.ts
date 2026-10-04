// Approved geometry from contract-hero/skypies-core at aab5fdab755cad337d69c2f2a76aefd1d120d3d4.
// Keep cloudArtwork, bindCloud and paintCloud in sync with ui/src/render/pie-cloud.ts.
// Compiled and inlined into the three marketing pages by build.ts; no app runtime required.
(() => {
type Wedge = { kind: string; count: number; share: number };
const HTML_SOURCE =
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>skypies</title></head><body><main><article class="pie"><h1>Your sky</h1><p>Every idea starts as a pie in the sky.</p><a href="notes.html">Open a slice</a><section><code>const sky = await open();</code></section></article></main></body></html> ';
/** A `length`-long window of the texture starting at `offset`, wrapping around. */
function sourceWindow(offset: number, length: number): string {
  const size = HTML_SOURCE.length;
  let text = HTML_SOURCE.slice(((offset % size) + size) % size);
  while (text.length < length) text += HTML_SOURCE;
  return text.slice(0, length);
}
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
// This renderer preserves the approved mist material and per-sector lower lobes.
const CLOUD_GEOMETRY = {
  radius: 54,
  projectedRadius: 16,
  gutterInner: 49.8,
  gutterOuter: 50.4,
  crustRadius: 51.3,
  seamWidth: 0.6,
} as const;
const { radius: RADIUS, gutterInner, gutterOuter, crustRadius, seamWidth } =
  CLOUD_GEOMETRY;
const PITCH = CLOUD_GEOMETRY.projectedRadius / RADIUS,
  rad = (a: number) => (a * Math.PI) / 180;
type Point = [number, number];
// The cloud's centre in the 160x90 viewBox; every sector pivots around it.
const CX = 80,
  CY = 42,
  CENTER: Point = [CX, CY];
// Half-angle of the seam cut through the front wall (0.3 units wide at the rim).
const SEAM_HALF_ANGLE = (Math.asin(0.3 / RADIUS) * 180) / Math.PI;
const point = (a: number, r: number = RADIUS, z = 0): Point => [
  CX + r * Math.cos(rad(a)),
  CY + r * PITCH * Math.sin(rad(a)) + z,
];
const shape = (p: Point[], close = true) =>
  "M" +
  p.map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join("L") +
  (close ? "Z" : "");
const arc = (a: number, b: number, r: number = RADIUS): Point[] =>
  Array.from({ length: 81 }, (_, j) => point(a + ((b - a) * j) / 80, r));
function hashPie(id: string): number {
  let h = 2166136261;
  for (const c of id) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}
function rotationOf(id: string) {
  const seed = hashPie(id);
  return {
    seed,
    angle:
      ((Math.imul(seed ^ 0x9e3779b9, 2246822507) >>> 0) / 4294967296) * 360,
    rate: 1.2 * (0.8 + ((seed >>> 4) % 1700) / 1000) * (seed & 1 ? 1 : -1),
  };
}
// Rotate in the circular pie plane, then apply the original low front projection.
// The finished SVG never rotates in the screen plane.
function planeRotation(angle: number) {
  const c = Math.cos(rad(angle)),
    s = Math.sin(rad(angle));
  return `matrix(${c} ${PITCH * s} ${-s / PITCH} ${c} ${CX - CX * c + (CY * s) / PITCH} ${CY - CX * PITCH * s - CY * c})`;
}
const PLANE = `matrix(1 0 0 ${PITCH} ${CX} ${CY})`;
type Sector = {
  a: number;
  b: number;
  full: boolean;
  index: number;
  w: Wedge | { kind: "empty"; count: number; share: number };
};
// Exact sector angles stay intact. One constant-width mask supplies all
// spacing, rather than accumulating an angular gap and central offset.
function sectorsOf(wedges: readonly Wedge[]): Sector[] {
  const segments = wedges.length
    ? wedges
    : [{ kind: "empty" as const, count: 0, share: 1 }];
  let bearing = -190;
  return segments.map((w, index) => {
    const a = bearing,
      b = bearing + w.share * 360;
    bearing = b;
    return { a, b, full: segments.length === 1, index, w };
  });
}
function topPath(s: Sector, r: number = RADIUS) {
  return shape(s.full ? arc(s.a, s.b, r) : [CENTER, ...arc(s.a, s.b, r)]);
}
/** Trusted markup only: all text is the fixed HTML texture; file paths and names
 * never enter SVG markup. React's useId supplies the unique identifier prefix. */
function cloudArtwork(
  pieId: string,
  wedges: readonly Wedge[],
  uid: string,
): string {
  const angle = rotationOf(pieId).angle,
    sectors = sectorsOf(wedges),
    seams = sectors.filter((s) => !s.full);
  const defs = [
    `<linearGradient id="${uid}-body" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--pie-wall-top,#e1e8dd)"/><stop offset=".5" stop-color="var(--pie-wall-mid,#ccd8c8)"/><stop offset="1" stop-color="var(--pie-wall-low,#bdcbbb)" stop-opacity=".1"/></linearGradient>`,
    `<linearGradient id="${uid}-top" x1="0" y1="0" x2="0" y2="1"><stop stop-color="var(--pie-top,#f0f2e9)"/><stop offset="1" stop-color="var(--pie-top-low,#cbd7ca)"/></linearGradient>`,
    `<linearGradient id="${uid}-fade" gradientUnits="userSpaceOnUse" x1="0" y1="40" x2="0" y2="71"><stop stop-color="white"/><stop offset=".56" stop-color="white"/><stop offset="1" stop-color="black"/></linearGradient>`,
    `<mask id="${uid}-mask" maskUnits="userSpaceOnUse" x="0" y="15" width="160" height="65"><rect x="0" y="15" width="160" height="65" fill="url(#${uid}-fade)"/></mask>`,
    `<filter id="${uid}-fog" filterUnits="userSpaceOnUse" x="0" y="15" width="160" height="65"><feGaussianBlur stdDeviation=".95"/></filter>`,
  ];
  // A real compositing void, not a dark painted band. It removes only the
  // inset annulus from every layer; outer mist and crust stay untouched.
  defs.push(
    `<mask id="${uid}-gutter-void" class="gutter-void-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="90"><rect width="160" height="90" fill="white"/><ellipse cx="${CX}" cy="${CY}" rx="${gutterOuter}" ry="${gutterOuter * PITCH}" fill="black"/><ellipse cx="${CX}" cy="${CY}" rx="${gutterInner}" ry="${gutterInner * PITCH}" fill="white"/><g transform="${PLANE}"><g class="seam-turn" transform="rotate(${angle})" stroke="black" stroke-width="${seamWidth}" stroke-linecap="butt">${seams
      .map(
        (s) =>
          `<path class="seam-ray" d="M0,0L${RADIUS * Math.cos(rad(s.a))},${RADIUS * Math.sin(rad(s.a))}"/>`,
      )
      .join("")}</g></g>${seams
      .map(
        (s) =>
          `<path class="seam-wall-mask" data-bearing="${s.a}" fill="black"/>`,
      )
      .join("")}</mask>`,
  );
  const bodies: string[] = [],
    faces: string[] = [];
  sectors.forEach((s) => {
    const { a, b } = s,
      clip = `${uid}-top-${s.index}`,
      sideclip = `${uid}-wall-${s.index}`,
      rim = `${uid}-rim-${s.index}`;
    defs.push(
      `<clipPath id="${clip}"><path d="${topPath(s, gutterInner)}"/></clipPath>`,
      `<clipPath id="${sideclip}"><path class="sector-wall-clip" data-sector="${s.index}"/></clipPath>`,
      `<path id="${rim}" d="${shape(
        arc(a, b, crustRadius).map(([x, y]): Point => [x - CX, (y - CY) / PITCH]),
        false,
      )}"/>`,
    );
    const rows = Array.from({ length: 23 }, (_, row) => {
      return `<text class="code-row" style="--shimmer-phase:${-row * 0.24 - s.index * 0.7}s" x="-56" y="${-53 + row * 5}" font-size="4.25">${esc(sourceWindow(row * 31 + s.index * 59, 66))}</text>`;
    }).join("");
    const text = `<g clip-path="url(#${clip})"><g transform="${PLANE}" fill="var(--pie-ink,#374c3e)" font-family="ui-monospace,monospace" opacity=".76">${rows}</g></g>`;
    const crust = `<g class="pie-crust" transform="${PLANE}" fill="var(--crust-ink,#d9e5d9)" font-family="ui-monospace,monospace" font-size="3.1" font-weight="500" opacity=".94"><text><textPath href="#${rim}">${esc("<html> <head> <title>skypies</title> </head> <body> ".repeat(8))}</textPath></text></g>`;
    const wallText: string[] = [];
    if (!s.full)
      [a, b].forEach((c, i) =>
        wallText.push(
          `<g class="cut-text" data-angle="${c}" data-cut="${i}">${[2.8, 5.8].map((z) => `<text x="0" y="${z}" font-size="2.6">${esc(HTML_SOURCE.slice(0, 72))}</text>`).join("")}</g>`,
        ),
      );
    // Texture samples stay attached to their sector as it turns.
    for (let c = Math.ceil(a / 8) * 8; c < b; c += 8) {
      wallText.push(
        `<g class="wall-fragment" data-angle="${c}">${[2.8, 5.8].map((z) => `<text x="0" y="${z}" font-size="2.5">${esc(sourceWindow(c * 3, 5))}</text>`).join("")}</g>`,
      );
    }
    bodies.push(
      `<g class="mist-sector-body" data-sector="${s.index}" data-kind="${s.w.kind}"><path class="sector-fog" fill="var(--pie-fog,#d6dfd1)" filter="url(#${uid}-fog)" opacity=".21"/><g mask="url(#${uid}-caps-visible)"><g mask="url(#${uid}-mask)"><path class="sector-wall" fill="url(#${uid}-body)" opacity=".58"/><g clip-path="url(#${sideclip})" fill="var(--pie-ink,#374c3e)" font-family="ui-monospace,monospace" opacity=".54">${wallText.join("")}</g></g></g></g>`,
    );
    faces.push(
      `<g class="pie-piece" data-kind="${s.w.kind}" data-count="${s.w.count}" data-share="${s.w.share}" data-bearing="${s.a}" data-end="${s.b}"><path class="pie-top-face" d="${topPath(s, gutterInner)}" fill="url(#${uid}-top)" fill-opacity=".68"/>${text}${crust}</g>`,
    );
  });
  // Mist stays outside the cap mask, as in the approved cloud: clipping a
  // blur to the hard top edge erases its airy fringe as sectors turn.
  // Internal caps retain the old depth/material but are occluded by adjacent
  // tops. This avoids the former wide cardinal seam at every possible bearing.
  defs.push(
    `<mask id="${uid}-caps-visible" maskUnits="userSpaceOnUse" x="0" y="0" width="160" height="90"><rect width="160" height="90" fill="white"/><g class="cap-occlusion" transform="${planeRotation(angle)}">${sectors.map((s) => `<path d="${topPath(s)}" fill="black"/>`).join("")}</g></mask>`,
  );
  return `<defs>${defs.join("")}</defs><g class="cloud-art" mask="url(#${uid}-gutter-void)"><g class="sector-bodies">${bodies.join("")}</g><g class="top-turn" transform="${planeRotation(angle)}">${faces.join("")}</g></g>`;
}
type PieceView = {
  s: Sector;
  wall: SVGPathElement;
  fog: SVGPathElement;
  clip: SVGPathElement;
  fragments: SVGGElement[];
  cuts: SVGGElement[];
};
type View = {
  svg: SVGSVGElement;
  top: SVGGElement;
  occlusion: SVGGElement;
  seams: SVGGElement;
  seamWalls: SVGPathElement[];
  pieces: PieceView[];
};
function paintCloud(view: View, angle: number) {
  const matrix = planeRotation(angle);
  view.svg.dataset.angle = angle.toFixed(5);
  view.top.setAttribute("transform", matrix);
  view.occlusion.setAttribute("transform", matrix);
  view.seams.setAttribute("transform", `rotate(${angle})`);
  // Continue the same plane-width clearance through the visible front wall.
  // Only these narrow cuts remove fog; all other mist remains unconstrained.
  for (const cut of view.seamWalls) {
    const q = Number(cut.dataset.bearing) + angle;
    const l = point(q - SEAM_HALF_ANGLE),
      r = point(q + SEAM_HALF_ANGLE);
    cut.setAttribute(
      "d",
      Math.sin(rad(q)) > 0
        ? shape([l, r, [r[0], r[1] + 11], [l[0], l[1] + 11]])
        : "",
    );
  }

  for (const p of view.pieces) {
    const { a, b } = p.s;
    const start = p.s.full ? 0 : a + angle,
      end = p.s.full ? 360 : b + angle,
      edge = arc(start, end),
      walls: string[] = [];
    let run: Point[] = [];
    const flush = () => {
      if (run.length > 1) {
        const lower: Point[] = run.map(([x, y], i) => {
          const u = i / (run.length - 1);
          return [
            x,
            y +
              7 +
              Math.sin(Math.PI * u) ** 0.8 *
                2.7 *
                (0.7 + 0.3 * Math.sin(u * Math.PI * 5)),
          ];
        });
        walls.push(shape([...run, ...lower.reverse()]));
      }
      run = [];
    };
    edge.forEach((v, j) => {
      if (Math.sin(rad(start + ((end - start) * j) / 80)) >= 0) run.push(v);
      else flush();
    });
    flush();
    if (!p.s.full)
      [a + angle, b + angle].forEach((q) =>
        walls.push(shape([CENTER, point(q), point(q, RADIUS, 7), [CX, CY + 7]])),
      );
    const d = walls.join("");
    p.wall.setAttribute("d", d);
    p.fog.setAttribute("d", d);
    p.clip.setAttribute("d", d);
    for (const fragment of p.fragments) {
      const q = Number(fragment.dataset.angle) + angle,
        sin = Math.sin(rad(q)),
        cos = Math.cos(rad(q)),
        [x, y] = point(q);
      fragment.setAttribute("visibility", sin >= 0 ? "visible" : "hidden");
      fragment.setAttribute(
        "transform",
        `matrix(${sin} ${-PITCH * cos} 0 1 ${x} ${y})`,
      );
    }
    for (const cut of p.cuts) {
      const q = Number(cut.dataset.angle) + angle;
      let co = Math.cos(rad(q)),
        si = Math.sin(rad(q)),
        origin = CENTER;
      if (co < 0) {
        origin = point(q);
        co = -co;
        si = -si;
      }
      cut.setAttribute(
        "transform",
        `matrix(${co} ${PITCH * si} 0 1 ${origin[0]} ${origin[1]})`,
      );
    }
  }
}

function bindCloud(svg: SVGSVGElement, wedges: readonly Wedge[]): View {
  return {
    svg,
    top: svg.querySelector<SVGGElement>(".top-turn")!,
    occlusion: svg.querySelector<SVGGElement>(".cap-occlusion")!,
    seams: svg.querySelector<SVGGElement>(".seam-turn")!,
    seamWalls: [...svg.querySelectorAll<SVGPathElement>(".seam-wall-mask")],
    pieces: sectorsOf(wedges).map((s) => {
      const body = svg.querySelector<SVGGElement>(
        `.mist-sector-body[data-sector="${s.index}"]`,
      )!;
      return {
        s,
        wall: body.querySelector<SVGPathElement>(".sector-wall")!,
        fog: body.querySelector<SVGPathElement>(".sector-fog")!,
        clip: svg.querySelector<SVGPathElement>(
          `.sector-wall-clip[data-sector="${s.index}"]`,
        )!,
        fragments: [...body.querySelectorAll<SVGGElement>(".wall-fragment")],
        cuts: [...body.querySelectorAll<SVGGElement>(".cut-text")],
      };
    }),
  };
}

type CloudOptions = {
  id: string | number;
  name: string;
  wedges?: { kind: string; count: number }[];
};
type CloudEntry = {
  svg: SVGSVGElement;
  view: View;
  angle: number;
  rate: number;
  visible: boolean;
};
const clouds = new Map<SVGSVGElement, CloudEntry>();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let frame = 0, lastPaint = 0;
const running = (entry: CloudEntry) => entry.visible && !document.hidden &&
  !reducedMotion.matches && !document.documentElement.classList.contains("clouds-paused");

function tick(now: number) {
  frame = 0;
  if (![...clouds.values()].some(running)) { lastPaint = 0; return; }
  if (!lastPaint || now - lastPaint >= 1000 / 18) {
    const dt = lastPaint ? (now - lastPaint) / 1000 : 0;
    for (const entry of clouds.values()) {
      if (!running(entry)) continue;
      entry.angle = (entry.angle + entry.rate * dt + 360) % 360;
      paintCloud(entry.view, entry.angle);
    }
    lastPaint = now;
  }
  frame = requestAnimationFrame(tick);
}
function refreshMotion() {
  for (const entry of clouds.values()) entry.svg.dataset.motionRunning = String(running(entry));
  // Resuming starts a fresh time interval, never catching up with hidden time.
  lastPaint = 0;
  if ([...clouds.values()].some(running)) {
    if (!frame) frame = requestAnimationFrame(tick);
  } else {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}
const observer = new IntersectionObserver((changes) => {
  for (const change of changes) {
    const entry = clouds.get(change.target as SVGSVGElement);
    if (entry) entry.visible = change.isIntersecting;
  }
  refreshMotion();
});
reducedMotion.addEventListener("change", refreshMotion);
document.addEventListener("visibilitychange", refreshMotion);
document.addEventListener("cloudmotionchange", refreshMotion);

function makePieSvg(opts: CloudOptions): SVGSVGElement {
  const pieId = `marketing-${opts.id}`;
  const counts = opts.wedges ?? [
    { kind: "html", count: 60 }, { kind: "md", count: 25 }, { kind: "code", count: 15 },
  ];
  const total = counts.reduce((sum, wedge) => sum + wedge.count, 0);
  const wedges = total ? counts.filter(w => w.count > 0).map(w => ({ ...w, share: w.count / total })) : [];
  const rotation = rotationOf(pieId);
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("pie-cloud");
  svg.setAttribute("viewBox", "0 0 160 90");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.dataset.cloud = pieId;
  svg.dataset.motionRunning = "false";
  svg.style.setProperty("--float-period", `${6 + (rotation.seed % 1000) / 1000}s`);
  svg.style.setProperty("--float-phase", `${-(rotation.seed % 6000) / 1000}s`);
  // Sequential ids keep masks unique even if a page repeats a pie.
  svg.innerHTML = cloudArtwork(pieId, wedges, `cloud-${clouds.size}`);
  const entry = { svg, view: bindCloud(svg, wedges), angle: rotation.angle, rate: rotation.rate, visible: false };
  paintCloud(entry.view, entry.angle);
  clouds.set(svg, entry);
  observer.observe(svg);
  return svg;
}
// The existing page scenes keep their layout and create their clouds here.
Object.assign(window, { makePieSvg });
})();
