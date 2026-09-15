/* contracthero.dev — the CRT types the story as you scroll. No dependencies. */
(() => {
  const story = document.getElementById('story');
  const screen = document.querySelector('.screen');
  const tube = document.querySelector('.tube');
  const out = document.getElementById('screen-text');
  const hint = document.getElementById('hint');
  const chaptersRoot = document.getElementById('chapters');
  const chapters = Array.from(chaptersRoot.querySelectorAll('.chapter'));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tubeStyle = getComputedStyle(tube);   // live object, resolved once

  const PX_PER_CHAR = 2;          // scroll pixels per typed character
  const HOLD = 0.55;              // viewport heights to rest on a finished chapter
  const BOOT_MS = [22, 38];       // per-character delay while the boot chapter self-types
  const AWAKE_PX = 30;            // scroll distance after which the reader has started

  // In JS mode the screen is the accessible copy; the chapters stay in the DOM for crawlers and no-JS.
  chaptersRoot.inert = true;
  chaptersRoot.setAttribute('aria-hidden', 'true');   // browsers without inert

  const textNodes = root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n; (n = w.nextNode());) nodes.push(n);
    return nodes;
  };
  const chapterIndex = id => chapters.findIndex(c => c.id === id);

  // Collapse HTML indentation so it does not count as typed characters.
  chapters.forEach(ch => textNodes(ch).forEach(t => {
    if (t.data.trim()) t.data = t.data.replace(/\s+/g, ' '); else t.remove();
  }));
  const lengths = chapters.map(ch => ch.textContent.length);

  // ---- scroll layout -------------------------------------------------
  let segs = [], bootSeg = null, viewportH = 0, lastW = 0;
  function layout() {
    viewportH = innerHeight;
    lastW = innerWidth;
    const hold = Math.round(viewportH * HOLD);
    let y = 0;
    segs = chapters.map((ch, i) => {
      const timed = i === 0;                            // the first chapter types itself on load
      const n = lengths[i];
      const typeLen = timed ? 0 : n * PX_PER_CHAR;
      const len = typeLen + (i === chapters.length - 1 ? Math.round(viewportH * .35) : hold);
      const s = { ch, n, start: y, typeLen, len, timed };
      y += len;
      return s;
    });
    bootSeg = segs.find(s => s.timed);
    const height = y + viewportH;
    story.style.height = height + 'px';
    return height;
  }

  // ---- painting --------------------------------------------------------
  // One clone per chapter, built on first use. A frame only rewrites text data and toggles visibility.
  const frames = new Map();
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  function frame(i) {
    let f = frames.get(i);
    if (f) return f;
    const root = segs[i].ch.cloneNode(true);
    root.removeAttribute('id');
    f = {
      nodes: Array.from(root.childNodes),
      texts: textNodes(root).map(node => ({ node, full: node.data })),
      elements: Array.from(root.querySelectorAll('*')).reverse(),   // children before parents
    };
    frames.set(i, f);
    return f;
  }
  let cur = -1, curN = -1;
  function paint(i, n) {
    const f = frame(i);
    if (i !== cur) out.replaceChildren(...f.nodes);
    let budget = n, tail = null;
    for (const { node, full } of f.texts) {
      const keep = Math.min(budget, full.length);
      const data = keep === full.length ? full : full.slice(0, keep);
      if (node.data !== data) node.data = data;
      if (keep > 0) tail = node;
      budget -= keep;
    }
    for (const el of f.elements) el.style.display = el.textContent ? '' : 'none';
    if (tail) tail.parentNode.insertBefore(cursor, tail.nextSibling); else out.prepend(cursor);
    const lineH = parseFloat(tubeStyle.lineHeight) || cursor.offsetHeight;
    const pad = parseFloat(tubeStyle.paddingBottom) || 0;
    let over = cursor.offsetTop + cursor.offsetHeight + pad - tube.clientHeight;
    over = over > 0 ? Math.ceil(over / lineH) * lineH : 0;   // scroll by whole lines
    out.style.transform = over ? `translateY(${-over}px)` : '';
  }

  // ?show=<chapter id> pins one chapter, fully typed and static (screenshots, social card).
  const pin = chapterIndex(new URLSearchParams(location.search).get('show'));
  let bootChars = 0;
  function render() {
    let i, n;
    if (pin >= 0) { i = pin; n = segs[i].n; }
    else {
      const y = scrollY;
      i = segs.findIndex(s => y < s.start + s.len);
      if (i < 0) i = segs.length - 1;
      const s = segs[i];
      n = s.timed ? bootChars : Math.min(s.n, Math.max(0, Math.floor((y - s.start) / PX_PER_CHAR)));
      if (reduced && !s.timed) n = s.n;
    }
    if (i !== cur || n !== curN) { paint(i, n); cur = i; curN = n; }
  }
  let raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
  function repaint() { cur = -1; schedule(); }

  // ---- the boot chapter types itself -------------------------------------
  function finishBoot() { if (bootChars < bootSeg.n) { bootChars = bootSeg.n; schedule(); } }
  function boot() {
    if (reduced) return finishBoot();
    const text = bootSeg.ch.textContent;
    const tick = () => {
      if (bootChars >= text.length) return;
      bootChars++;
      schedule();
      const pause = text[bootChars - 1] === '.' ? 260 : 0;
      setTimeout(tick, BOOT_MS[0] + Math.random() * (BOOT_MS[1] - BOOT_MS[0]) + pause);
    };
    setTimeout(tick, 500);
  }
  function wake() { finishBoot(); hint.classList.add('gone'); }

  // ---- events ------------------------------------------------------------
  let typingTimer = 0;
  addEventListener('scroll', () => {
    if (scrollY > AWAKE_PX) wake();
    screen.classList.add('typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => screen.classList.remove('typing'), 180);
    schedule();
  }, { passive: true });

  addEventListener('resize', () => {
    // Mobile browsers resize the viewport while scrolling; only relayout on real changes.
    if (Math.abs(innerWidth - lastW) < 2 && Math.abs(innerHeight - viewportH) < 120) return;
    const ratio = scrollY / Math.max(1, story.offsetHeight - viewportH);
    const height = layout();
    scrollTo(0, ratio * (height - viewportH));
    repaint();
  });

  function jumpTo(id, smooth) {
    const i = chapterIndex(id);
    if (i < 0) return false;
    wake();
    scrollTo({ top: segs[i].start + segs[i].typeLen, behavior: smooth && !reduced ? 'smooth' : 'auto' });
    return true;
  }
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (jumpTo(id, true)) { e.preventDefault(); history.replaceState(null, '', '#' + id); }
  });

  // ---- go ----------------------------------------------------------------
  layout();
  render();
  if (document.fonts) document.fonts.ready.then(repaint);   // metrics change when the web font arrives
  if (pin >= 0) { hint.classList.add('gone'); return; }
  // The browser performs its own fragment scroll at load; ours must run after it.
  const arrive = () => requestAnimationFrame(() => {
    if (location.hash && jumpTo(location.hash.slice(1), false)) return;
    if (scrollY > AWAKE_PX) wake(); else boot();
  });
  if (document.readyState === 'complete') arrive(); else addEventListener('load', arrive, { once: true });
  addEventListener('hashchange', () => jumpTo(location.hash.slice(1), true));
})();
