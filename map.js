(() => {
  'use strict';
  const atlas = document.getElementById('atlas');
  const viewport = document.getElementById('viewport');
  const image = document.getElementById('map-image');
  const readout = document.getElementById('zoom-readout');
  const loading = document.getElementById('loading');
  const notice = document.getElementById('notice');
  const pointers = new Map();
  let scale = 1, fitScale = 1, x = 0, y = 0, ready = false, noticeTimer;
  const box = () => ({w: viewport.clientWidth, h: viewport.clientHeight});
  const local = event => {
    const rect = viewport.getBoundingClientRect();
    return {x: event.clientX - rect.left, y: event.clientY - rect.top};
  };
  function render() {
    if (!ready) return;
    const {w, h} = box();
    const iw = image.naturalWidth * scale, ih = image.naturalHeight * scale;
    x = iw <= w ? (w - iw) / 2 : Math.min(0, Math.max(w - iw, x));
    y = ih <= h ? (h - ih) / 2 : Math.min(0, Math.max(h - ih, y));
    image.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    const zoom = Math.round(scale / fitScale * 100);
    readout.textContent = `${zoom}%`;
    document.getElementById('zoom-out').disabled = zoom <= 100;
    document.getElementById('zoom-in').disabled = zoom >= 800;
    viewport.dataset.zoom = String(zoom);
    window.dispatchEvent(new CustomEvent("sea:render", {detail:{scale, fitScale, zoom, x, y}}));
  }
  function fit(overview = false) {
    if (!ready) return;
    const {w, h} = box();
    fitScale = Math.min(w / image.naturalWidth, h / image.naturalHeight);
    // Phone maps open as an explorable, full-height canvas rather than a
    // tiny square with empty bands. The Fit button still shows the whole chart.
    scale = !overview && matchMedia("(max-width: 700px) and (orientation: portrait)").matches
      ? Math.min(fitScale * 8, Math.max(w, h) / Math.min(image.naturalWidth, image.naturalHeight))
      : fitScale;
    x = (w - image.naturalWidth * scale) / 2;
    y = (h - image.naturalHeight * scale) / 2;
    render();
  }
  function zoom(factor, at) {
    if (!ready) return;
    const {w, h} = box();
    at = at || {x: w / 2, y: h / 2};
    const next = Math.max(fitScale, Math.min(fitScale * 8, scale * factor));
    x = at.x - (at.x - x) * next / scale;
    y = at.y - (at.y - y) * next / scale;
    scale = next;
    render();
  }
  // Recenter without adding another panel to the map UI.
  window.EARTHSEA_VIEW = {
    center(px,py) {
      if (!ready || !Number.isFinite(px) || !Number.isFinite(py)) return false;
      x = box().w / 2 - px * scale;
      y = box().h / 2 - py * scale;
      render();
      return true;
    },
    fit: () => fit(true)
  };  function flash(text) {
    notice.textContent = text;
    notice.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 3000);
  }
  function toggleUI() {
    const hidden = atlas.classList.toggle('pure');
    const button = document.getElementById('toggle-ui');
    button.setAttribute('aria-pressed', String(hidden));
    button.setAttribute('aria-label', hidden ? '显示界面' : '隐藏界面');
    button.title = hidden ? '显示界面（H）' : '隐藏界面（H）';
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (atlas.requestFullscreen) await atlas.requestFullscreen();
      else flash('可使用浏览器菜单进入全屏');
    } catch { flash('可使用浏览器菜单进入全屏'); }
  }
  function loaded() {
    if (ready || !image.naturalWidth) return;
    ready = true;
    image.style.width = `${image.naturalWidth}px`;
    image.style.height = `${image.naturalHeight}px`;
    fit();
    image.classList.add('ready');
    loading.hidden = true;
    window.dispatchEvent(new CustomEvent("sea:ready", {detail:{width:image.naturalWidth,height:image.naturalHeight}}));
  }
  image.addEventListener('load', loaded);
  image.addEventListener('error', () => {
    loading.querySelector('p').textContent = '海图资源尚未就绪';
    loading.querySelector('small').textContent = '请检查 assets 目录后刷新页面';
  });
  if (image.complete) loaded();
  new ResizeObserver(() => fit()).observe(viewport);
  viewport.addEventListener('wheel', event => {
    event.preventDefault();
    const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1);
    zoom(Math.exp(-Math.max(-180, Math.min(180, delta)) * .0025), local(event));
  }, {passive: false});
  viewport.addEventListener('pointerdown', event => {
    if (!ready || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointers.set(event.pointerId, local(event));
    if (!event.target.closest('.map-pin, .world-pin, .expedition-pin')) viewport.setPointerCapture(event.pointerId);
    viewport.classList.add('dragging');
  });
  viewport.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId)) return;
    const old = [...pointers.values()];
    const previous = pointers.get(event.pointerId);
    const current = local(event);
    pointers.set(event.pointerId, current);
    if (pointers.size === 1) {
      x += current.x - previous.x;
      y += current.y - previous.y;
    } else if (pointers.size === 2) {
      const now = [...pointers.values()];
      const midpoint = pair => ({x: (pair[0].x + pair[1].x) / 2, y: (pair[0].y + pair[1].y) / 2});
      const distance = pair => Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
      const a = midpoint(old), b = midpoint(now);
      const next = Math.max(fitScale, Math.min(fitScale * 8, scale * distance(now) / Math.max(1, distance(old))));
      x = b.x - (a.x - x) * next / scale;
      y = b.y - (a.y - y) * next / scale;
      scale = next;
    }
    render();
  });
  function release(event) {
    pointers.delete(event.pointerId);
    if (!pointers.size) viewport.classList.remove('dragging');
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) viewport.addEventListener(type, release);
  window.addEventListener('blur', () => { pointers.clear(); viewport.classList.remove('dragging'); });
  viewport.addEventListener('dblclick', event => zoom(scale / fitScale > 3.9 ? fitScale / scale : 2, local(event)));
  document.getElementById('zoom-in').addEventListener('click', () => zoom(1.25));
  document.getElementById('zoom-out').addEventListener('click', () => zoom(.8));
  document.getElementById('fit').addEventListener('click', () => fit(true));
  document.getElementById('toggle-ui').addEventListener('click', toggleUI);
  document.getElementById('fullscreen').addEventListener('click', fullscreen);
  document.addEventListener('fullscreenchange', () => {
    document.getElementById('fullscreen').setAttribute('aria-label', document.fullscreenElement ? '退出全屏' : '进入全屏');
  });
  window.addEventListener('keydown', event => {
    if (event.ctrlKey || event.metaKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    let handled = true;
    switch (event.key.toLowerCase()) {
      case '+': case '=': zoom(1.25); break;
      case '-': case '_': zoom(.8); break;
      case 'home': case '0': fit(true); break;
      case 'h': toggleUI(); break;
      case 'f': fullscreen(); break;
      case 'escape': if (atlas.classList.contains('pure')) toggleUI(); else handled = false; break;
      case 'arrowleft': x += 80; render(); break;
      case 'arrowright': x -= 80; render(); break;
      case 'arrowup': y += 80; render(); break;
      case 'arrowdown': y -= 80; render(); break;
      default: handled = false;
    }
    if (handled) event.preventDefault();
  });
})();




