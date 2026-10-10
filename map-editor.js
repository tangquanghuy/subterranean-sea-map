(() => {
  'use strict';
  const placement = window.EARTHSEA_PLACEMENT;
  const image = document.getElementById('map-image');
  const overlay = document.getElementById('chart-overlay');
  const pins = document.getElementById('map-pins');
  const atlas = document.getElementById('atlas');
  const controls = document.querySelector('.chart-controls');
  const toggle = document.getElementById('toggle-editor');
  const actions = document.getElementById('editor-actions');
  const fileInput = document.getElementById('placement-file');
  const status = document.getElementById('notice');
  const source = Object.fromEntries(Object.entries(placement.anchors).map(([id, pair]) => [id, [...pair]]));
  const key = 'earthsea:v11:placement:manual:v1';
  const editor = window.EARTHSEA_EDITOR = {editing: false};
  let changes = {};
  let dirty = false;
  let drag = null;
  let statusTimer;

  function note(message) {
    status.textContent = message;
    status.hidden = false;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => { status.hidden = true; }, 3800);
  }
  const validPair = pair => Array.isArray(pair) && pair.length === 2 && pair.every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1);
  function validate(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('坐标文件须为节点 ID 到 [x,y] 的对象');
    const list = Object.entries(raw);
    const oldVersions=new Set(['03-02','03-03']);
    for (const [id, pair] of list) {
      if (!/^\d\d-\d\d$/.test(id) || !validPair(pair) ||
          (!oldVersions.has(id) && !window.EARTHSEA_NODES.some(n => n.id === id))) throw Error(`坐标不合法：${id}`);
    }
    // Old exported placements may still contain the former duplicate state pins.
    // Preserve 01-09 / 03-01 user positions; never let a version overwrite its parent.
    return Object.fromEntries(list.filter(([id])=>!oldVersions.has(id)).map(([id, pair]) => [id, [...pair]]));
  }
  function updatePins() {
    for (const pin of pins.querySelectorAll('.map-pin')) {
      const node = window.EARTHSEA_NODES.find(n => n.id === pin.dataset.nodeId);
      const pair = placement.anchors[pin.dataset.nodeId] || (node?.parentId && placement.anchors[node.parentId]);
      if (!pair) continue;
      // Non-explicit subnodes retain the same initial offset as map-layer.js.
      const offset = !placement.anchors[pin.dataset.nodeId] && node?.parentId
        ? ((index) => [[.055,.025],[-.055,.025],[.045,-.048],[-.045,-.048],[0,.075]][index % 5])
          (window.EARTHSEA_NODES.filter(n => n.parentId === node.parentId).findIndex(n => n.id === node.id))
        : [0,0];
      pin.style.setProperty('--x', (Math.max(.035, Math.min(.965, pair[0]+offset[0]))*100)+'%');
      pin.style.setProperty('--y', (Math.max(.035, Math.min(.965, pair[1]+offset[1]))*100)+'%');
    }
    window.dispatchEvent(new Event('sea:placement-change'));
  }
  function apply(raw) {
    changes = validate(raw);
    placement.anchors = Object.fromEntries([...Object.entries(source).map(([id,pair])=>[id,[...pair]]),...Object.entries(changes)]);
    updatePins();
  }
  try {
    const saved = localStorage.getItem(key);
    if (saved) apply(JSON.parse(saved));
  } catch (error) { note(`本机保存数据读取失败：${error.message}`); }

  // Loading can complete before or after this script executes.
  window.addEventListener('sea:ready', updatePins);
  if (image.naturalWidth) updatePins();

  toggle.addEventListener('click', () => {
    editor.editing = !editor.editing;
    atlas.classList.toggle('editor-mode', editor.editing);
    controls.classList.toggle('editor-on', editor.editing);
    actions.hidden = !editor.editing;
    toggle.setAttribute('aria-pressed', String(editor.editing));
    toggle.textContent = editor.editing ? '结束调整' : '调整图钉';
    window.dispatchEvent(new Event('sea:placement-change'));
    if (editor.editing) note('拖动盾徽定位；平移地图请从海面拖动。调好后点「保存落点」。');
  });

  pins.addEventListener('pointerdown', event => {
    if (!editor.editing || (event.pointerType === 'mouse' && event.button !== 0) || drag) return;
    const pin = event.target.closest('.map-pin');
    if (!pin || pin.hidden) return;
    const id = pin.dataset.nodeId;
    const pair = placement.anchors[id] || [parseFloat(pin.style.getPropertyValue('--x')) / 100, parseFloat(pin.style.getPropertyValue('--y')) / 100];
    if (!validPair(pair)) return;
    drag = {pin, id, pointerId:event.pointerId, x:event.clientX, y:event.clientY, pair:[...pair]};
    pin.classList.add('moving');
    pin.setPointerCapture(event.pointerId);
    event.preventDefault();
  }, true);
  pins.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const {id, x, y, pair, pin} = drag;
    const bounds = overlay.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const clamp = n => Math.max(.004, Math.min(.996, Math.round(n * 100000) / 100000));
    placement.anchors[id] = [clamp(pair[0] + (event.clientX-x)/bounds.width),clamp(pair[1] + (event.clientY-y)/bounds.height)];
    changes[id] = [...placement.anchors[id]];
    updatePins();
    dirty = true;
    document.getElementById('save-placement').textContent = '保存落点 · 未保存';
    event.preventDefault();
  });
  function release(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    drag.pin.classList.remove('moving');
    drag = null;
  }
  pins.addEventListener('pointerup', release);
  pins.addEventListener('pointercancel', release);
  pins.addEventListener('lostpointercapture', release);

  document.getElementById('save-placement').addEventListener('click', () => {
    try {
      localStorage.setItem(key, JSON.stringify(changes));
      dirty = false;
      document.getElementById('save-placement').textContent = '保存落点';
      note(`已保存 ${Object.keys(changes).length} 个调整到当前浏览器；导出坐标可跨设备留档。`);
    } catch (error) { note(`本机保存失败：${error.message}；可先导出坐标文件。`); }
  });
  document.getElementById('export-placement').addEventListener('click', () => {
    const data = {format:'earthsea-placement-v1',image:'earthsea-world-v11-4k',anchors:changes};
    const blob = new Blob([JSON.stringify(data,null,2)+'\n'],{type:'application/json'});
    const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='地海地图-手调落点.json';
    link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000);
    note('已导出坐标 JSON；把这个文件交给我可以合并回地图原始落点。');
  });
  document.getElementById('import-placement').addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    if (!fileInput.files?.length) return;
    try {
      const data = JSON.parse(await fileInput.files[0].text());
      if (data.format !== 'earthsea-placement-v1' || data.image !== 'earthsea-world-v11-4k') throw Error('不是这张底图导出的落点文件');
      apply(data.anchors);
      dirty=true;
      document.getElementById('save-placement').textContent = '保存落点 · 未保存';
      note(`已载入 ${Object.keys(changes).length} 个调整；点「保存落点」以便刷新后保留。`);
    } catch (error) { note(`导入失败：${error.message}`); }
    fileInput.value='';
  });
  document.getElementById('reset-placement').addEventListener('click', () => {
    if (!confirm('清除当前浏览器保存的全部手工坐标，恢复项目默认落点？')) return;
    try { localStorage.removeItem(key); } catch (error) { note(`清除保存失败：${error.message}`); return; }
    apply({});dirty=false;
    document.getElementById('save-placement').textContent = '保存落点';
    note('已恢复默认落点。');
  });
  window.addEventListener('beforeunload', event => {if (dirty) {event.preventDefault();event.returnValue='';}});
})();


