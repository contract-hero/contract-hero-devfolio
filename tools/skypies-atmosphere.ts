// Shared motion policy with the existing mist pies; no new runtime dependency.
(() => {
  const hero = document.querySelector<HTMLElement>('.overview .hero');
  if (!hero) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
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

  const video = document.querySelector<HTMLVideoElement>('#demo-video');
  if (!video) return;
  // Set autoplay only after checking the preference, so reduced-motion users
  // never get a playing frame before the script can pause it.
  video.autoplay = !reduced.matches;
  if (video.autoplay) void video.play().catch(() => { /* Native Play remains available. */ });
  reduced.addEventListener('change', () => {
    video.autoplay = !reduced.matches;
    if (reduced.matches) video.pause();
  });
})();
