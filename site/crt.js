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

  const PX_PER_CHAR = 2;          // scroll pixels per typed character
  const HOLD = 0.55;              // viewport heights to rest on a finished chapter
  const BOOT_MS = [22, 38];       // per-character delay while the boot chapter self-types

  // The chapters are the accessible source; the screen is their visual twin.
  chaptersRoot.setAttribute('aria-hidden', 'true');
  chaptersRoot.querySelectorAll('a').forEach(a => a.tabIndex = -1);

  // Collapse HTML indentation so it does not count as typed characters.
  chapters.forEach(ch => {
    const w = document.createTreeWalker(ch, NodeFilter.SHOW_TEXT);
    const drop = [];
    let n;
    while ((n = w.nextNode())) {
      if (!n.data.trim()) { drop.push(n); continue; }
      n.data = n.data.replace(/\s+/g, ' ');
    }
    drop.forEach(t => t.remove());
  });

  // ---- scroll layout -------------------------------------------------
  let segs = [];
  let viewportH = innerHeight;
  function layout() {
    viewportH = innerHeight;
    const hold = Math.round(viewportH * HOLD);
    let y = 0;
    segs = chapters.map((ch, i) => {
      const n = ch.textContent.length;
      const typeLen = i === 0 ? 0 : n * PX_PER_CHAR;   // chapter 0 types itself on load
      const len = typeLen + (i === chapters.length - 1 ? Math.round(viewportH * .35) : hold);
      const s = { ch, n, start: y, typeLen, len };
      y += len;
      return s;
    });
    story.style.height = (y + viewportH) + 'px';
  }

  // ---- painting --------------------------------------------------------
  let cur = -1, curN = -1;
  function lastText(node) {
    const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let last = null, n;
    while ((n = w.nextNode())) last = n;
    return last;
  }
  function paint(i, n) {
    const clone = segs[i].ch.cloneNode(true);
    clone.removeAttribute('id');
    let budget = n;
    const dead = [];
    const w = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
    let t;
    while ((t = w.nextNode())) {
      if (budget >= t.data.length) { budget -= t.data.length; continue; }
      if (budget > 0) { t.data = t.data.slice(0, budget); budget = 0; }
      else dead.push(t);
    }
    dead.forEach(t => t.remove());
    clone.querySelectorAll('*').forEach(el => { if (!el.textContent) el.remove(); });
    const cursor = document.createElement('span');
    cursor.className = 'cursor';
    const tail = lastText(clone);
    if (tail) tail.parentNode.insertBefore(cursor, tail.nextSibling); else clone.appendChild(cursor);
    out.replaceChildren(...clone.childNodes);
    const lineH = parseFloat(getComputedStyle(tube).lineHeight) || cursor.offsetHeight;
    const pad = parseFloat(getComputedStyle(tube).paddingBottom) || 0;
    let over = cursor.offsetTop + cursor.offsetHeight + pad - tube.clientHeight;
    over = over > 0 ? Math.ceil(over / lineH) * lineH : 0;   // scroll by whole lines
    out.style.transform = over ? `translateY(${-over}px)` : '';
  }

  let bootChars = 0;
  function render() {
    const y = scrollY;
    let i = segs.findIndex(s => y < s.start + s.len);
    if (i < 0) i = segs.length - 1;
    const s = segs[i];
    let n = i === 0 ? bootChars : Math.min(s.n, Math.max(0, Math.floor((y - s.start) / PX_PER_CHAR)));
    if (reduced && i > 0) n = s.n;
    if (i !== cur || n !== curN) { paint(i, n); cur = i; curN = n; }
  }

  let raf = 0;
  function schedule() { if (!raf) raf = requestAnimationFrame(() => { raf = 0; render(); }); }

  // ---- boot chapter types itself ---------------------------------------
  function boot() {
    const total = segs[0].n;
    if (reduced) { bootChars = total; schedule(); return; }
    const tick = () => {
      if (bootChars >= total) return;
      bootChars++;
      schedule();
      const ch = segs[0].ch.textContent[bootChars - 1];
      const pause = ch === '.' ? 260 : 0;
      setTimeout(tick, BOOT_MS[0] + Math.random() * (BOOT_MS[1] - BOOT_MS[0]) + pause);
    };
    setTimeout(tick, 500);
  }
  function finishBoot() { if (bootChars < segs[0].n) { bootChars = segs[0].n; schedule(); } }

  // ---- events ------------------------------------------------------------
  let typingTimer = 0;
  addEventListener('scroll', () => {
    if (scrollY > 30) { finishBoot(); hint.classList.add('gone'); }
    screen.classList.add('typing');
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => screen.classList.remove('typing'), 180);
    schedule();
  }, { passive: true });

  let lastW = innerWidth;
  addEventListener('resize', () => {
    // Mobile browsers resize the viewport while scrolling; only relayout on real changes.
    if (Math.abs(innerWidth - lastW) < 2 && Math.abs(innerHeight - viewportH) < 120) return;
    lastW = innerWidth;
    const ratio = scrollY / Math.max(1, story.offsetHeight - viewportH);
    layout();
    scrollTo(0, ratio * (story.offsetHeight - innerHeight));
    cur = -1; schedule();
  });

  function jumpTo(id, smooth) {
    const i = chapters.findIndex(c => c.id === id);
    if (i < 0) return false;
    finishBoot();
    const top = segs[i].start + segs[i].typeLen + 2;
    scrollTo({ top, behavior: smooth && !reduced ? 'smooth' : 'auto' });
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
  // ?show=<chapter id> renders one chapter fully typed and static (screenshots, social card).
  const show = new URLSearchParams(location.search).get('show');
  const showIdx = show ? chapters.findIndex(c => c.id === show) : -1;
  if (showIdx >= 0) {
    const still = () => paint(showIdx, segs[showIdx].n);
    still(); hint.classList.add('gone');
    if (document.fonts) document.fonts.ready.then(still);
    return;
  }
  render();
  // Metrics change when the web font arrives; repaint the current frame.
  if (document.fonts) document.fonts.ready.then(() => { cur = -1; schedule(); });
  // The browser performs its own fragment scroll at load; ours must run after it.
  const arrive = () => requestAnimationFrame(() => {
    if (location.hash && jumpTo(location.hash.slice(1), false)) return;
    if (scrollY > 30) finishBoot(); else boot();
  });
  if (document.readyState === 'complete') arrive(); else addEventListener('load', arrive, { once: true });
  addEventListener('hashchange', () => jumpTo(location.hash.slice(1), true));
})();
