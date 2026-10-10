(() => {
  'use strict';
  const items = window.CREST_ITEMS;
  const labels = { earthsea: '地海世界', surface: '地表', other: '异空间' };
  const grid = document.querySelector('#grid');
  const count = document.querySelector('#count');
  const empty = document.querySelector('#empty');
  const search = document.querySelector('#search');
  const dialog = document.querySelector('#detail');
  let layer = 'all';
  const cards = items.map(item => {
    const button = document.createElement('button');
    button.className = 'card';
    button.type = 'button';
    button.dataset.layer = item.layer;
    button.dataset.search = `${item.name} ${item.title} ${item.id} ${item.excerpt}`.toLocaleLowerCase();
    const image = document.createElement('img');
    image.src = item.icon;
    image.alt = '';
    image.loading = 'lazy';
    image.decoding = 'async';
    const name = document.createElement('span');
    name.className = 'card-name';
    name.textContent = item.name;
    name.title = item.title;
    const id = document.createElement('span');
    id.className = 'card-id';
    id.textContent = item.id;
    const category = document.createElement('span');
    category.className = 'card-layer';
    category.textContent = `${labels[item.layer]} · ${item.kind === 'ship' ? '航船' : '地点'}`;
    button.append(image, name, id, category);
    button.setAttribute('aria-label', `查看${item.name}的盾徽`);
    button.addEventListener('click', () => {
      document.querySelector('#detail-image').src = item.icon;
      document.querySelector('#detail-image').alt = `${item.name}盾徽`;
      document.querySelector('#detail-meta').textContent = `${labels[item.layer]} / ${item.kind === 'ship' ? '航船' : '地点'}`;
      document.querySelector('#detail-title').textContent = item.title;
      document.querySelector('#detail-id').textContent = item.id;
      document.querySelector('#detail-desc').textContent = item.excerpt || '诡秘地海 · 地点图鉴';
      const download = document.querySelector('#detail-download');
      download.href = item.icon;
      download.download = `${item.id}-${item.name}.webp`;
      dialog.showModal();
    });
    grid.appendChild(button);
    return button;
  });
  function update() {
    const query = search.value.trim().toLocaleLowerCase();
    let total = 0;
    for (const card of cards) {
      const visible = (layer === 'all' || card.dataset.layer === layer) && (!query || card.dataset.search.includes(query));
      card.hidden = !visible;
      if (visible) total++;
    }
    count.textContent = `已展示 ${total} / ${items.length} 枚盾徽`;
    empty.hidden = total !== 0;
  }
  document.querySelectorAll('[data-layer]').forEach(button => {
    if (button.tagName !== 'BUTTON' || !button.closest('.tabs')) return;
    button.addEventListener('click', () => {
      layer = button.dataset.layer;
      document.querySelectorAll('.tabs button').forEach(tab => tab.classList.toggle('active', tab === button));
      update();
    });
  });
  search.addEventListener('input', update);
  document.querySelector('#close-detail').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  update();
})();
