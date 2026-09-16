/* contracthero.dev — the CRT types the story as you scroll. No dependencies. */
(() => { try {
  const story = document.getElementById('story');
  const screen = document.querySelector('.screen');
  const tube = document.querySelector('.tube');
  const out = document.getElementById('screen-text');
  const chaptersRoot = document.getElementById('chapters');
  const chapters = Array.from(chaptersRoot.querySelectorAll('.chapter'));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const tubeStyle = getComputedStyle(tube);   // live view: one call keeps returning current values

  const PX_PER_CHAR = 3;          // scroll pixels per typed character; chapters are short, so a wheel notch types ~30 characters
  const HOLD = 0.6;               // viewport heights to rest on a finished chapter
  const LAST_HOLD = 0.35;         // the last chapter rests less: the page ends there
  const BOOT_MS = [12, 22];       // per-character delay while the boot chapter self-types (~4 s for the whole chapter)
  const AWAKE_PX = 30;            // scroll distance after which the reader has started

  // In JS mode the screen is the accessible copy; the chapters stay in the DOM for crawlers and no-JS.
  chaptersRoot.inert = true;
  chaptersRoot.setAttribute('aria-hidden', 'true');
  if (!('inert' in HTMLElement.prototype)) chaptersRoot.querySelectorAll('a, [tabindex]').forEach(el => el.tabIndex = -1);   // browsers without inert

  const textNodes = root => {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n; (n = w.nextNode());) nodes.push(n);
    return nodes;
  };
  // Section ids of the previous site, so old deep links still land somewhere sensible.
  const ALIASES = { experience: 'engineer', teaching: 'classroom', tool: 'solutions', runtime: 'solutions', oss: 'solutions', program: 'solutions', claim: 'boot',
                    y2006: 'engineer', y2014: 'exchange', y2017: 'classroom', y2022: 'contracts', y2023: 'contracts', y2025: 'solutions' };
  const chapterIndex = id => chapters.findIndex(c => c.id === (ALIASES[id] || id));

  // Collapse HTML indentation so it does not count as typed characters. Whitespace-only nodes are
  // dropped. ASCII art inside <pre> keeps every space. This mutates the chapters in place; the screen
  // clones them afterwards.
  chapters.forEach(ch => textNodes(ch).forEach(t => {
    if (t.parentElement.closest('pre')) return;
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
      const typeLen = (timed || reduced) ? 0 : n * PX_PER_CHAR;   // reduced motion: no scroll typing
      const len = typeLen + (i === chapters.length - 1 ? Math.round(viewportH * LAST_HOLD) : hold);
      const s = { ch, n, start: y, typeLen, len, timed };
      y += len;
      return s;
    });
    bootSeg = segs.find(s => s.timed);
    story.style.height = (y + viewportH) + 'px';      // +1 viewport: the sticky scene occupies one
  }

  // ---- painting --------------------------------------------------------
  // One clone per chapter, built on first use and cached. A repaint only rewrites text data, toggles
  // element visibility, moves the cursor and sets the scroll transform; it never rebuilds the DOM.
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
      elements: Array.from(root.querySelectorAll('*')),   // hidden while they hold no typed text
    };
    frames.set(i, f);
    return f;
  }
  let cur = -1, curN = -1, fontsReady = !document.fonts;   // the fallback font wraps differently: only judge overflow once the web font is in
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
    // Keep the cursor inside the tube's content box. Measured against .text with rects: the cursor and
    // .text move together under the transform, so it cancels, and offsetParent differences between
    // engines do not matter. line-height is unitless in CSS, so it computes to pixels here.
    const lineH = parseFloat(tubeStyle.lineHeight) || cursor.offsetHeight;
    const padT = parseFloat(tubeStyle.paddingTop) || 0;
    const padB = parseFloat(tubeStyle.paddingBottom) || 0;
    let over = padT + (cursor.getBoundingClientRect().bottom - out.getBoundingClientRect().top) + padB - tube.clientHeight;
    over = over > 0 ? Math.ceil(over / lineH) * lineH : 0;   // scroll by whole lines
    out.style.transform = over ? `translateY(${-over}px)` : '';
    if (over && n === segs[i].n && fontsReady) console.warn(`crt.js: chapter "${segs[i].ch.id}" overflows the tube by ${over}px at ${innerWidth}x${innerHeight}; its first lines are off screen`);
  }

  // ?show=<chapter id> pins one chapter, fully typed: the text never changes, though the page still
  // scrolls. Used for screenshots and the social card. An unknown id is painted as an error so a bad
  // capture cannot ship unnoticed.
  const showId = new URLSearchParams(location.search).get('show');
  const pin = showId === null ? -1 : chapterIndex(showId);
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
      if (reduced && !s.timed) n = s.n;   // reduced motion: a chapter appears complete as soon as its segment starts
    }
    if (i !== cur || n !== curN) { paint(i, n); cur = i; curN = n; }
  }
  let raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }
  function repaint() { cur = -1; schedule(); }

  // ---- the boot chapter types itself -------------------------------------
  const BOOT_DELAY_MS = 350;      // let the page settle before the first character
  const SENTENCE_MS = 180;        // extra pause after a full stop
  function finishBoot() { if (bootChars < bootSeg.n) { bootChars = bootSeg.n; schedule(); } }
  function boot() {
    if (reduced) return finishBoot();
    const text = bootSeg.ch.textContent;
    const tick = () => {
      if (bootChars >= text.length) return;
      bootChars++;
      schedule();
      const pause = text[bootChars - 1] === '.' ? SENTENCE_MS : 0;
      setTimeout(tick, BOOT_MS[0] + Math.random() * (BOOT_MS[1] - BOOT_MS[0]) + pause);
    };
    setTimeout(tick, BOOT_DELAY_MS);
  }
  function wake() { finishBoot(); }

  // ---- events ------------------------------------------------------------
  let typingTimer = 0;
  addEventListener('scroll', () => {
    if (scrollY > AWAKE_PX) wake();
    // Hold the cursor solid while scrolling; 180ms after the last scroll event it blinks again.
    screen.classList.add('typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => screen.classList.remove('typing'), 180);
    schedule();
  }, { passive: true });

  addEventListener('resize', () => {
    // Mobile browsers grow and shrink the viewport as the URL bar hides, which fires resize during a scroll.
    // Ignore any height change smaller than a URL bar (120px) unless the width also moved.
    if (Math.abs(innerWidth - lastW) < 2 && Math.abs(innerHeight - viewportH) < 120) return;
    layout();
    scrollTo(0, cur >= 0 ? segs[cur].start + curN * PX_PER_CHAR : 0);   // land on the same character
    repaint();
  });

  function jumpTo(id, smooth) {
    const i = chapterIndex(id);
    if (i < 0) return false;
    wake();
    // Land at the end of the chapter's typing run, so the jump shows it complete.
    scrollTo({ top: segs[i].start + segs[i].typeLen, behavior: smooth && !reduced ? 'smooth' : 'auto' });
    return true;
  }
  document.addEventListener('click', e => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest?.('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    if (jumpTo(id, true)) { e.preventDefault(); history.replaceState(null, '', '#' + id); }
  });

  // ---- go ----------------------------------------------------------------
  layout();
  if (showId !== null && pin < 0) {
    console.error(`crt.js: ?show=${showId} is not a chapter id. Valid: ${chapters.map(c => c.id).join(', ')}`);
    out.textContent = `unknown chapter: ${showId}`;
    return;
  }
  render();
  if (document.fonts) document.fonts.ready.then(() => { fontsReady = true; repaint(); });   // metrics change when the web font arrives
  if (pin >= 0) return;
  // The browser performs its own fragment scroll at load; ours must run after it.
  const arrive = () => requestAnimationFrame(() => {
    if (location.hash && jumpTo(location.hash.slice(1), false)) return;
    if (scrollY > AWAKE_PX) wake(); else boot();
  });
  if (document.readyState === 'complete') arrive(); else addEventListener('load', arrive, { once: true });
  addEventListener('hashchange', () => jumpTo(location.hash.slice(1), true));
} catch (err) {
  // Anything wrong above means an empty screen; give the reader the plain page instead.
  document.documentElement.className = 'no-js';
  throw err;
} })();
