// Overview only: builds the hero's falling-code sky and plays the demo video
// while it is on screen. The sky follows the mist pies' rule (skypies-clouds.ts):
// visible, tab shown, no reduced motion, no clouds-paused.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const hero = document.querySelector<HTMLElement>('.overview .hero');
  if (hero) {
    const atmosphere = document.createElement('div');
    atmosphere.className = 'sky-atmosphere';
    atmosphere.id = 'sky-atmosphere';
    atmosphere.setAttribute('aria-hidden', 'true');
    atmosphere.dataset.running = 'false';
    const wave = document.createElement('div');
    wave.className = 'sky-terminal-wave';
    const curtain = document.createElement('div');
    curtain.className = 'sky-html-curtain';
    const source = '<!doctype html><html lang="en"><head><title>Ideas, still cooking — skypies</title></head><body><main><section><h1>Something worth making</h1><p>Your files, within reach.</p></section></main></body></html> ';
    for (let i = 0; i < 38; i++) {
      const strand = document.createElement('span');
      const offset = (i * 41) % source.length;
      strand.textContent = source.repeat(3).slice(offset, offset + 190).match(/.{1,3}/g)!.join('\n');
      strand.style.cssText = `--x:${(i * 2.61 + (i % 5) * .48) % 99}%;--mobile-x:${(i * 5.23 + (i % 4) * .91) % 98}%;--alpha:${.25 + (i % 5) * .08};--size:${6 + i % 6}px;--time:${48 + (i % 7) * 7}s;--delay:${-i * 5.1}s`;
      curtain.append(strand);
    }
    atmosphere.append(wave, curtain);
    hero.prepend(atmosphere);
    let visible = false;
    const refresh = () => {
      atmosphere.dataset.running = String(visible && !document.hidden && !reduced.matches && !document.documentElement.classList.contains('clouds-paused'));
    };
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; refresh(); }).observe(hero);
    reduced.addEventListener('change', refresh);
    document.addEventListener('visibilitychange', refresh);
    document.addEventListener('cloudmotionchange', refresh);
  }

  // The demo plays, muted, only while a third of it is on screen and motion is
  // allowed, so a visit that never scrolls to it fetches only its metadata.
  // A pause the person makes with the controls is kept: scrolling never
  // restarts it.
  const video = document.querySelector<HTMLVideoElement>('#demo-video');
  if (!video) return;
  let onScreen = false;
  let userPaused = false;
  let scriptPausing = false;
  video.addEventListener('pause', () => { if (!scriptPausing) userPaused = true; scriptPausing = false; });
  video.addEventListener('play', () => { userPaused = false; });
  const sync = () => {
    if (onScreen && !reduced.matches && video.paused && !userPaused) {
      video.play().catch((e: DOMException) => {
        // Blocked autoplay and an interrupted play() are expected; anything
        // else (no playable source) is a real failure.
        if (!['NotAllowedError', 'AbortError'].includes(e.name)) console.error('skypies demo video:', e);
      });
    } else if ((!onScreen || reduced.matches) && !video.paused) {
      scriptPausing = true;
      video.pause();
    }
  };
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; sync(); }, { threshold: .35 }).observe(video);
  reduced.addEventListener('change', sync);
})();
