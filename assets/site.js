// GreenLine concept site. No library: a scroll-driven process, a few small controls, and nothing else.
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = v => Math.max(0, Math.min(1, v));
  const ease = t => t * t * (3 - 2 * t);

  // ---- Top bar and menu ----
  const top = document.querySelector('.top');
  // Clear while a pinned picture is on screen, solid once the page has moved past it.
  const hero = document.querySelector('main > [data-process]:first-child');
  const solid = () => top && top.classList.toggle('solid', scrollY > (hero ? hero.offsetTop + hero.offsetHeight - top.offsetHeight - 2 : 8));
  addEventListener('scroll', solid, { passive: true }); solid();
  const menu = document.querySelector('.menu');
  if (menu) {
    const set = open => { document.body.classList.toggle('open', open); menu.setAttribute('aria-expanded', open); menu.textContent = open ? 'Close' : 'Menu'; };
    menu.addEventListener('click', () => set(!document.body.classList.contains('open')));
    addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
    document.querySelectorAll('.nav a').forEach(a => a.addEventListener('click', () => set(false)));
  }

  // ---- The process: each picture arrives over the one before it, as far as the scroll has gone ----
  const setMask = (el, value) => { el.style.webkitMaskImage = value; el.style.maskImage = value; };
  const FX = {
    // a slanted edge that travels from left to right
    sweep(el, t) { const x = -22 + t * 144; el.style.clipPath = t >= 1 ? 'none' : `polygon(0 0, ${x + 12}% 0, ${x - 12}% 100%, 0 100%)`; },
    // a straight edge from left to right, like a plow pass
    plow(el, t) { el.style.clipPath = t >= 1 ? 'none' : `inset(0 ${100 - t * 100}% 0 0)`; },
    // a soft edge that climbs from the ground up
    rise(el, t) { const e = -12 + t * 126; setMask(el, t >= 0.999 ? 'none' : `linear-gradient(to top, #000 ${e - 10}%, transparent ${e + 10}%)`); },
    // a soft circle that opens from the middle of the picture
    iris(el, t) { const r = t * 135; setMask(el, t >= 0.999 ? 'none' : `radial-gradient(circle at 50% 66%, #000 ${Math.max(0, r - 16)}%, transparent ${r}%)`); },
    fade(el, t) { el.style.opacity = t; },
  };
  const clearFx = el => { el.style.clipPath = ''; el.style.opacity = ''; el.style.visibility = ''; setMask(el, ''); };

  function process(story) {
    const layers = [...story.querySelectorAll('.layer')];
    const lines = [...story.querySelectorAll('.line')];
    const ticks = [...story.querySelectorAll('.rail button')];
    const fill = story.querySelector('.rail-fill'), num = story.querySelector('.step b'), name = story.querySelector('.step span'), hint = story.querySelector('.hint');
    const count = layers.length, total = String(count).padStart(2, '0');
    // Each change takes the first part of its stretch of scroll; the rest is a pause on the finished step.
    const stretch = 0.9 / (count - 1);
    const moves = layers.slice(1).map((_, i) => [0.04 + i * stretch, 0.04 + i * stretch + stretch * 0.64]);
    const stops = [0, ...moves.map(([, end]) => Math.min(1, end + stretch * 0.14))];
    let shown = -1, ticking = false;

    const distance = () => story.offsetHeight - innerHeight;
    const start = () => story.getBoundingClientRect().top + scrollY;
    const progress = () => clamp((scrollY - start()) / Math.max(1, distance()));

    function draw() {
      ticking = false;
      if (reduced.matches) return;
      const p = progress();
      let stage = 0;
      moves.forEach(([a, b], i) => {
        const t = ease(clamp((p - a) / (b - a))), el = layers[i + 1];
        el.style.visibility = t <= 0 ? 'hidden' : 'visible';
        (FX[el.dataset.fx] || FX.fade)(el, t);
        if (t > 0.5) stage = i + 1;
      });
      if (fill) {
        // The line reaches each tick exactly when that step is finished.
        let k = 0;
        while (k < count - 2 && p >= stops[k + 1]) k++;
        fill.style.transform = `scaleY(${clamp((k + clamp((p - stops[k]) / (stops[k + 1] - stops[k]))) / (count - 1))})`;
      }
      if (hint) hint.classList.toggle('gone', p > 0.02);
      if (stage === shown) return;
      shown = stage;
      lines.forEach((line, i) => line.classList.toggle('on', i === stage));
      if (num) num.textContent = `${String(stage + 1).padStart(2, '0')} / ${total}`;
      if (name) name.textContent = ticks[stage] ? ticks[stage].dataset.name : '';
      ticks.forEach((tick, i) => { tick.setAttribute('aria-current', i === stage); tick.classList.toggle('done', i < stage); });
    }
    const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(draw); } };
    ticks.forEach((tick, i) => tick.addEventListener('click', () => scrollTo({ top: start() + stops[i] * distance() + 1, behavior: 'smooth' })));
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request);
    reduced.addEventListener('change', () => { layers.forEach(clearFx); shown = -1; request(); });
    stories.push({ start, distance, stops, moves });
    draw();
  }
  const stories = [];
  document.querySelectorAll('[data-process]').forEach(process);

  // ---- Arrow keys: while a process is on screen, one press plays one whole step ----
  // Outside a process the keys scroll the page as usual.
  // The page is moved here, frame by frame, instead of with the browser's own smooth scroll: that one
  // covers a step in about a third of a second (or jumps, if smooth scrolling is off), too fast to see the change.
  let aim = null, run = 0;
  const stop = () => { run++; aim = null; };
  // parts: [from, to, milliseconds, easing]; played one after the other
  function glide(parts) {
    const id = ++run;
    let i = 0, began = performance.now();
    const frame = now => {
      if (id !== run) return;
      const [from, to, ms, curve] = parts[i], t = Math.min(1, (now - began) / ms);
      scrollTo(0, from + (to - from) * (curve ? curve(t) : t));
      if (t >= 1) { i++; began = now; if (i >= parts.length) { aim = null; return; } }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
  // The visitor taking over (wheel, finger, scrollbar) ends a running move at once.
  ['wheel', 'touchstart', 'pointerdown'].forEach(type => addEventListener(type, stop, { passive: true }));

  addEventListener('keydown', e => {
    const dir = e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0;
    if (!dir) { if (aim !== null && ['PageDown', 'PageUp', 'Home', 'End', ' '].includes(e.key)) stop(); return; }
    if (reduced.matches || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (document.body.classList.contains('open')) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable], [role="tab"]')) return;
    // While a move is still running, count from where it is going, so quick presses each add a step.
    const y = aim !== null ? aim : scrollY;
    for (const s of stories) {
      const d = s.distance();
      if (d <= 0) continue;
      const a = s.start(), points = s.stops.map(p => Math.round(a + p * d + 1)), last = points[points.length - 1];
      const exit = Math.round(a + d + innerHeight - (top ? top.offsetHeight : 0));
      let to = null;
      if (dir > 0) {
        if (y < a - 2 && a - y < innerHeight * 0.75) to = points[0];           // nearly there: pin it on step one
        else if (y >= a - 2 && y < last - 2) to = points.find(p => p > y + 2); // next step
        else if (y >= last - 2 && y < exit - 2) to = exit;                     // after the last step: on to the next section
      } else if (y > points[0] + 2 && y <= exit + 2) {
        to = [...points].reverse().find(p => p < y - 2);                       // previous step
      }
      if (to == null) continue;
      e.preventDefault();
      if (e.repeat && aim !== null) return; // a held key waits for the step to finish
      aim = to;
      // Spend the time on the stretch of scroll where the picture is actually changing, and hurry through the pauses.
      const from = scrollY, lo = Math.min(from, to), hi = Math.max(from, to);
      const spans = s.moves.map(([m, n]) => [a + m * d, a + n * d]).filter(([m, n]) => n > lo + 1 && m < hi - 1);
      if (!spans.length) return glide([[from, to, 650, ease]]);
      const first = Math.max(lo, spans[0][0]), end = Math.min(hi, spans[spans.length - 1][1]);
      const A = dir > 0 ? first : end, B = dir > 0 ? end : first;
      return glide([[from, A, 110], [A, B, 1000 * spans.length], [B, to, 160]].filter(([p, q]) => Math.abs(q - p) > 1));
    }
  });

  // ---- Drag to compare ----
  document.querySelectorAll('.compare').forEach(box => {
    const range = box.querySelector('input');
    const set = () => box.style.setProperty('--pos', range.value + '%');
    range.addEventListener('input', set); set();
  });

  // ---- A year's program ----
  document.querySelectorAll('.program').forEach(program => {
    const tabs = [...program.querySelectorAll('[role="tab"]')], when = program.querySelector('.program-panel b'), what = program.querySelector('.program-panel p');
    const pick = (index, focus) => {
      tabs.forEach((tab, i) => { tab.setAttribute('aria-selected', i === index); tab.tabIndex = i === index ? 0 : -1; tab.classList.toggle('past', i < index); });
      when.textContent = `Step ${index + 1} of ${tabs.length}: ${tabs[index].textContent}`;
      what.textContent = tabs[index].dataset.what;
      if (focus) tabs[index].focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => pick(i));
      tab.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight') pick((i + 1) % tabs.length, true);
        if (e.key === 'ArrowLeft') pick((i + tabs.length - 1) % tabs.length, true);
      });
    });
    pick(0);
  });

  // ---- Stump: grind or remove ----
  document.querySelectorAll('[data-stump]').forEach(block => {
    const drawing = block.querySelector('.stump-svg'), note = block.querySelector('.stump-note'), buttons = [...block.querySelectorAll('.choice button')];
    const NOTES = {
      grind: 'Grinding removes the stump and the upper root mass to about 12 to 18 inches below the surface. It is usually the most cost-effective answer for turf or a flower bed. The roots left behind decompose over time and the ground may settle a little.',
      remove: 'Total removal excavates the whole root structure and backfills with the right material for what comes next. It is the better choice before planting a new tree or building a patio, because nothing is left underneath to rot and settle.',
    };
    const pick = mode => { drawing.dataset.mode = mode; note.textContent = NOTES[mode]; buttons.forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === mode)); };
    buttons.forEach(b => b.addEventListener('click', () => pick(b.dataset.mode)));
    pick('grind');
  });

  // ---- Lights off, lights on ----
  document.querySelectorAll('.lights').forEach(box => {
    const button = box.querySelector('.switch'), label = button.querySelector('span');
    button.addEventListener('click', () => {
      const on = box.dataset.on !== 'true';
      box.dataset.on = on; button.setAttribute('aria-pressed', on); label.textContent = on ? 'Lights on' : 'Lights off';
    });
  });

  // ---- Cards show the finished job when they come into view on a touch screen; everything else rises in once ----
  if ('IntersectionObserver' in window) {
    if (matchMedia('(hover: none)').matches) {
      const watch = new IntersectionObserver(entries => entries.forEach(entry => entry.target.classList.toggle('seen', entry.intersectionRatio > 0.7)), { threshold: [0, 0.7, 1] });
      document.querySelectorAll('.card:not(.cta), .row-pic .card').forEach(card => watch.observe(card));
    }
    const rise = new IntersectionObserver(entries => entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('in'); rise.unobserve(entry.target); } }), { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.reveal').forEach(el => rise.observe(el));
  } else {
    document.querySelectorAll('.reveal').forEach(el => el.classList.add('in'));
  }

  // ---- Estimate form: opens the visitor's own email program with the request filled in. Nothing is sent from this page. ----
  const form = document.querySelector('form.estimate');
  if (form) form.addEventListener('submit', event => {
    event.preventDefault();
    const data = new FormData(form), get = key => String(data.get(key) || '').trim();
    const body = [`Name: ${get('name')}`, `Phone: ${get('phone')}`, `Email: ${get('email')}`, `Property address: ${get('address')}`, `Service: ${get('service')}`, '', get('message')].join('\n');
    location.href = `mailto:${form.dataset.to}?subject=${encodeURIComponent('Estimate request: ' + get('service'))}&body=${encodeURIComponent(body)}`;
  });
})();
