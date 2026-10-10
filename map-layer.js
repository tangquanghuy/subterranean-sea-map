(() => {
  'use strict';
  const nodes = window.EARTHSEA_NODES || [];
  const placement = window.EARTHSEA_PLACEMENT;
  const tentative = new Set(placement.tentative || []);
  const symbolic = new Set(['02-05','03-05','03-06','04-01','04-03','04-05','04-06','05-06','05-11','06-06','07-05','07-07','02-03','04-04','07-01','07-02','07-03','08-07','08-10','08-12']);
  const net = window.EARTHSEA_NET;
  const byId = new Map(nodes.map(n => [n.id,n]));
  const variants = window.EARTHSEA_NODE_VARIANTS || {};
  let injectedEvents = null;
  let injectedData = null;
  // A rumor in the ledger is not a plotted coordinate. The complete card and
  // graph endpoint share the same discovery condition as the full EJS entry.
  const discovery = window.EARTHSEA_DISCOVERY || {};
  function storyData() {
    try { return injectedData ?? (typeof window.getMessageVar==='function' ? window.getMessageVar('stat_data',{defaults:{}}) : {}) ?? {}; }
    catch (_) { return {}; }
  }
  function unlocked(n) {
    const need=discovery[n.id];
    if(!need) return true;
    const item=storyData()?.人物?.背包?.道具?.[need.item];
    return (!need.item || (item != null)) &&
      (!need.event || events()[need.event]===true) &&
      (!need.requiresEvents || need.requiresEvents.every(key=>events()[key]===true));
  }
  function clueFor(n) {
    const need=discovery[n.id];
    if(!need) return '';
    if(need.clueBeforeParent && !unlocked(byId.get(need.parentId))) return need.clueBeforeParent;
    if(need.clueBeforeEvent && ((need.event && events()[need.event]!==true) || need.requiresEvents?.some(key=>events()[key]!==true))) return need.clueBeforeEvent;
    if(need.event && need.item && storyData()?.人物?.背包?.道具?.[need.item] != null) {
      if(need.event==='全海共享召开') return '会址已有通告；要等各岛的法阵真正接通，才能进入会场。';
      if(need.event==='新界市开放') return '入口的地标已有记录；城门尚未开放，眼下还进不去。';
      return '线索已经记下；通往地表的路尚未贯通，暂时只能从来路继续查找。';
    }
    return need.clue;
  }
  function hostEvents() {
    try {
      if (typeof window.getMessageVar !== 'function') return {};
      return window.getMessageVar('stat_data', {defaults:{}})?.世界信息?.大事件 || {};
    } catch (_) { return {}; }
  }
  function events() { return injectedEvents ?? hostEvents(); }
  function current(node) {
    if (!node) return null;
    const e=events(), versions=variants[node.id] || {};
    let version=null;
    switch(node.id) {
      case '01-09': if(e['活岛易主']===true) version='易主'; break;
      case '04-01': case '08-02': case '08-06': if(unlocked(node)) version='标定'; break;
      case '01-14': if(e['索多玛王退场']===true) version='王退场'; break;
      case '02-01': if(e['天水岛易主']===true) version='易主'; break;
      case '01-15': if(e['影岛沉没']===true) version='沉没'; break;
      case '02-02': if(e['希望岛建立']===true) version='建立'; break;
      case '02-08': if(e['何方岛光复']===true) version='光复';
        else if(e['何方岛覆灭']===true) version='占领'; break;
      case '03-01': if(e['英伦岛毁灭']===true) version='紫雾'; break;
      case '05-01': if(e['010泡泡消失']===true)
        version=e['安查岛建港']===true?'建港':'未建港'; break;
      case '08-10': if(e['墨尘岛沉没']===true) version='沉没';
        else if(e['墨尘岛死光灾变']===true) version='死光'; break;
    }
    return version && versions[version] ? {...node,...versions[version]} : node;
  }

  const overlay = document.getElementById('chart-overlay');
  const pins = document.getElementById('map-pins');
  const fog = window.EARTHSEA_FOG(overlay);
  let fogSignature = '';
  const svg = document.getElementById('sea-lines');
  const card = document.getElementById('node-card');
  const scroll = document.getElementById('card-scroll');
  const panel = document.getElementById('trip-panel');
  const legend = document.getElementById('chart-legend');
  const zoomTarget = document.getElementById('viewport');
  const NS = 'http://www.w3.org/2000/svg';
  let zoom = 100, routeVisible = false, rumors = false;
  let zoomBand = -1, renderedScale = null;
  let selected = null, from = null, to = null, currentRoute = null;
  const runtime=window.EARTHSEA_RUNTIME;
  const positionEntries=nodes.map(n=>[n.id,n.displayName||n.name||n.id,[]]);
  positionEntries.find(n=>n[0]==='02-02')?.[2].push('光明之地','希望岛');
  function playerId(){return runtime.resolve(positionEntries);}
  function focusPlayer(){
    const id=playerId(), point=id&&position(byId.get(id));
    const image=document.getElementById('map-image');
    if(point && image.naturalWidth)window.EARTHSEA_VIEW?.center(point[0]*image.naturalWidth,point[1]*image.naturalHeight);
  }
  const locationReadout=document.getElementById('player-position');
  locationReadout.tabIndex=0;locationReadout.setAttribute('role','button');locationReadout.title='定位到当前位置';
  locationReadout.addEventListener('click',focusPlayer);
  locationReadout.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();focusPlayer()}});
  function updatePlayer(){
    const id=playerId();
    document.getElementById('player-position').textContent='当前位置：'+runtime.label()+(id?'':' · 海图未标定');
    for(const [key,element] of pinElements)element.classList.toggle('player-current',key===id);
    const next=id && unlocked(byId.get(id)) ? id : null;
    if(from!==next){from=next;if(!panel.hidden)itinerary();}
    if(!card.hidden && selected)document.getElementById('route-to').disabled=!from || !unlocked(byId.get(selected));
  }
  const pinElements = new Map();
  function position(node) {
    const explicit = placement.anchors[node.id];
    if (explicit) return explicit;
    if (!node.parentId) return null;
    const p = placement.anchors[node.parentId];
    if (!p) return null;
    const index = nodes.filter(n => n.parentId === node.parentId).findIndex(n => n.id === node.id);
    const offsets = [[.055,.025],[-.055,.025],[.045,-.048],[-.045,-.048],[0,.075]];
    const [dx,dy] = offsets[index % offsets.length];
    // Subnodes form a readable cluster near the parent; positions are not surveyed.
    return [Math.max(.035,Math.min(.965,p[0]+dx)),Math.max(.035,Math.min(.965,p[1]+dy))];
  }
  function eligible(n) {
    return (!rumors || n.visibility === '传闻');
  }
  function shown(n) {
    if (!position(n)) return false;
    if (window.EARTHSEA_EDITOR?.editing) return true;
    if (!eligible(n)) return false;
    // Zoom controls tier visibility, never removes a node from the plate.
    if (n.kind === '船只') return true; // overview: isolated silhouettes only; names appear when zoomed
    if (n.displayTier === '次级') return zoom >= 195;
    
    return true;
  }
  function name(id) { return id==='02-03' && unlocked(byId.get(id)) ? '041梦境岛' : current(byId.get(id))?.displayName || id; }
  function crest(id) {
    const e=events();
    if(id==='03-01' && e['英伦岛毁灭']===true) return '03-03';
    if(id==='01-09' && e['活岛易主']===true) return '03-02';
    return id;
  }
  function measureText(m,kind) {
    if (kind==='portal') return '跨层通道';
    if (!m) return '里程未明';
    if (m.nauticalMiles != null) return `${m.estimated ? '约 ' : ''}${m.nauticalMiles.toLocaleString('zh-CN')} 海里`;
    if (m.days != null) return `${m.qualifier || ''}${m.days} 天`;
    return m.duration || '里程未明';
  }
  function svgPath(points) {
    const p = points.map(([x,y]) => [x*1000,y*1000]);
    if (p.length === 2) return `M${p[0].join(' ')} L${p[1].join(' ')}`;
    return 'M'+p[0].join(' ')+' '+p.slice(1).map(a => 'L'+a.join(' ')).join(' ');
  }
  let linesReady=false;
  let cachedSelected=null;
  function updateLines(visible) {
    if (!routeVisible && !currentRoute) {
      if (svg.childElementCount) svg.replaceChildren();
      linesReady=false;cachedSelected=null;
      return;
    }
    if (linesReady && cachedSelected===currentRoute) return;
    const fragment=document.createDocumentFragment();
    if (routeVisible) for (const e of net.edges(true)) {
      if (!e.points || !visible.has(e.a) || !visible.has(e.b)) continue;
      if (e.documented && Math.hypot(e.points[0][0]-e.points.at(-1)[0],e.points[0][1]-e.points.at(-1)[1])>.22) continue;
      const path=document.createElementNS(NS,'path');
      path.setAttribute('d',svgPath(e.points));
      path.setAttribute('class',`${e.kind} ${e.inferred ? 'inferred' : ''}`);
      fragment.append(path);
    }
    if (currentRoute) for (const leg of currentRoute) {
      if (!leg.points) continue;
      const path=document.createElementNS(NS,'path');
      path.setAttribute('d',svgPath(leg.points));
      path.setAttribute('class','selected');
      fragment.append(path);
    }
    svg.replaceChildren(fragment);
    cachedSelected=currentRoute;
    linesReady=true;
  }
  function draw() {
    const visible=new Set(nodes.filter(shown).map(n=>n.id));
    const charted=new Set([...visible].filter(id=>unlocked(byId.get(id))));
    const editing=!!window.EARTHSEA_EDITOR?.editing;
    fog.canvas.hidden=editing;
    if(!editing){
      const chartedSites=nodes.filter(n=>unlocked(n) && position(n));
      const patches=chartedSites.map(n=>{
        const [x,y]=position(n);
        return {x:x*4096,y:y*4096,radius:n.displayTier==='??'?285:n.kind==='??'?320:470};
      });
      const signature=JSON.stringify(patches);
      if(signature!==fogSignature){fog.paint(chartedSites.length===nodes.filter(position).length?null:patches);fogSignature=signature;}
    }
    for (const [id,el] of pinElements) {
      const n=byId.get(id);
      el.hidden=!visible.has(id);
      el.classList.toggle('locked',!unlocked(n) && !editing);
      window.EARTHSEA_DANGER.pin(el,name(id),current(n)?.risk,!unlocked(n));
      el.setAttribute('aria-label',name(id)+(unlocked(n)?' · 查看地点卡':' · 查看寻访线索'));
      el.classList.toggle('minimal',!window.EARTHSEA_EDITOR?.editing && zoom < 160 && id !== selected && id !== '01-14');
      el.classList.toggle('active',id === selected);
    }
    updateLines(charted);
  }
  function text(tag,value,parent) {
    const el=document.createElement(tag); el.textContent=value; parent.append(el); return el;
  }
  function section(title,content) {
    if (!content || (Array.isArray(content) && !content.length)) return;
    text('h3',title,scroll);
    if (Array.isArray(content)) {
      const ul=document.createElement('ul');
      for (const [label,value] of content) {
        const li=document.createElement('li');text('b',label+'：',li);li.append(document.createTextNode(value));ul.append(li);
      }
      scroll.append(ul);
    } else text('p',content,scroll);
  }
  function openNode(node) {
    const located=unlocked(node);
    selected=node.id;
    node=located ? current(node) : node;
    window.EARTHSEA_DANGER.card(document.getElementById('card-title'),document.getElementById('card-danger'),name(node.id),node.risk,!located);
    document.getElementById('card-class').textContent=located ? `${node.kind} · 已标定` : '海图边注 · 方位未明';
    const icon=document.getElementById('card-icon'); icon.style.display='';icon.classList.toggle('uncharted',!located);icon.src=`assets/crests-v3/${crest(node.id)}.webp`;icon.alt=`${name(node.id)}盾徽`;
    scroll.replaceChildren();
    if(!located) {
      section('寻访线索',clueFor(node));
      document.querySelector('.card-actions').hidden=true;
      card.hidden=false;draw();return;
    }
    section('概况',node.overview);
    section('航行与到达',node.navigation);
    section('危险等级',node.risk);
    section('可用资源',node.resources);
    section('关键场景',node.scenes);
    section('势力与人物',node.factions);
    section('公开线索',node.publicClues);
    scroll.scrollTop=0;
    const routeable = net.edges().some(e=>e.a===node.id || e.b===node.id);
    document.getElementById('route-to').disabled=!routeable || !playerId() || !unlocked(byId.get(playerId()));
    document.querySelector('.card-actions').hidden=false;
    card.hidden=false;
    draw();
  }
  function directory() {
    selected=null;
    window.EARTHSEA_DANGER.card(document.getElementById('card-title'),document.getElementById('card-danger'),'地海地点索引','',true);
    document.getElementById('card-class').textContent='';
    document.getElementById('card-icon').style.display='none';
    document.querySelector('.card-actions').hidden=true;
    scroll.replaceChildren();
    for (const [heading,entries] of [
      ['海图已标定',nodes.filter(n=>unlocked(n) && eligible(n) && !discovery[n.id]?.variantOnly)],
      ['航报与待寻之地',nodes.filter(n=>!unlocked(n) && eligible(n) && !discovery[n.id]?.variantOnly)]
    ]) {
      if(!entries.length) continue;
      text('h3',heading,scroll);
      const list=document.createElement('div');list.className='directory-list';
      for(const n of entries){
        const button=document.createElement('button');button.type='button';
        button.className='directory-item'+(unlocked(n)?'':' uncharted');
        button.dataset.location=n.id;
        const img=document.createElement('img');img.loading='lazy';img.src=`assets/crests-v3/${crest(n.id)}.webp`;img.alt='';button.append(img);
        text('span',name(n.id),button);
        window.EARTHSEA_DANGER.pin(button,name(n.id),current(n)?.risk,!unlocked(n));
        button.addEventListener('click',()=>openNode(n));list.append(button);
      }
      scroll.append(list);
    }
    card.hidden=false;draw();

  }
  function available() {
    return new Set(nodes.filter(unlocked).map(n=>n.id));
  }
  function itinerary() {
    const summary=document.getElementById('trip-summary');
    const legs=document.getElementById('trip-legs');
    summary.replaceChildren();legs.replaceChildren();legs.hidden=true;
    currentRoute=null;
    const go=document.getElementById('trip-go');go.disabled=true;
    if (from && to) {
      currentRoute=net.route(from,to,available(),document.getElementById('allow-inferred').checked);
      text('p',`${name(from)} → ${name(to)}`,summary);
      if (currentRoute) {
        const missing=currentRoute.some(leg=>leg.measure?.nauticalMiles==null);
        const total=currentRoute.reduce((sum,leg)=>sum+(leg.measure?.nauticalMiles || 0),0);
        const approximate=currentRoute.some(leg=>leg.measure?.estimated);
        text('p',total ? `${missing ? '已知 ' : ''}${approximate ? '约 ' : ''}${total.toLocaleString('zh-CN')} 海里` : '里程未明',summary);
        const hours=runtime.travelDays(currentRoute)*24;
        if(hours)text('p',`预计航时约 ${hours>=24?(hours/24).toFixed(1)+' 天':Math.ceil(hours)+' 小时'}${missing?' · 通道另计':''}`,summary);
        go.disabled=from===to || !hours;
        // For one leg, the summary already says everything; avoid a duplicate numbered list.
        if (currentRoute.length > 1) {
          legs.hidden=false;
          for (const leg of currentRoute) {
            text('li',`${name(leg.from)} → ${name(leg.to)} · ${measureText(leg.measure,leg.kind)}`,legs);
          }
        }
      } else text('p','暂无可用航路。',summary);
    } else text('p',from?`从 ${name(from)} 出发，选择目的地。`:`当前位置尚未标定在地海海图上，航程暂不可用。`,summary);
    panel.hidden=false;card.hidden=true;selected=null;draw();
  }
  function refreshStory() {
    for (const [id,pin] of pinElements) {
      const label=name(id);
      pin.title=label;
      pin.setAttribute('aria-label',label+' · 查看地点卡');
      pin.querySelector('span').textContent=label;
      const icon=pin.querySelector('img');
      const src=`assets/crests-v3/${crest(id)}.webp`;
      if(icon.getAttribute('src')!==src) icon.src=src;
    }
    const activeCard=!card.hidden && selected ? selected : null;
    const activeDirectory=!card.hidden && !selected;
    linesReady=false;
    const now=available();
    from=playerId();
    if(from && !now.has(from))from=null;
    if(to && !now.has(to))to=null;
    if (!panel.hidden) itinerary();
    if (activeCard && byId.has(activeCard)) {
      openNode(byId.get(activeCard));
    }
    else if (activeDirectory) directory();
    updatePlayer();draw();
    window.dispatchEvent(new CustomEvent('sea:story-rendered',{detail:{events:events()}}));
  }
  // The host can pass either a big-event dictionary or the complete stat_data.
  // Passing null reconnects the card to the host's getMessageVar state.
  window.EARTHSEA_MAP_STATE = {
    set(state) {
      injectedData=state?.世界信息 ? state : null;
      injectedEvents=state == null ? null : (state?.世界信息?.大事件 || state);
      refreshStory();
    },
    refresh:refreshStory,
    get:()=>({...events()})
  };
  window.addEventListener('sea:story-change',refreshStory);
  let lastHostSignature=JSON.stringify([hostEvents(),storyData()?.人物?.背包?.道具]);
  window.setInterval(()=>{
    if (injectedEvents!==null || document.hidden) return;
    const signature=JSON.stringify([hostEvents(),storyData()?.人物?.背包?.道具]);
    if(signature!==lastHostSignature) {lastHostSignature=signature;refreshStory();}
  },1000);
  function toggle(button,value) { button.setAttribute('aria-pressed',String(value)); }
  function initialize() {
    const size=document.getElementById('map-image').naturalWidth;
    overlay.style.width=size+'px';overlay.style.height=size+'px';
    overlay.style.transform=document.getElementById('map-image').style.transform;
    overlay.style.setProperty('--inverse-scale',String(1/Math.min(zoomTarget.clientWidth/size,zoomTarget.clientHeight/size)));
    for(const node of nodes) {
      const point=position(node);if(!point) continue;
      const pin=document.createElement('button');pin.type='button';
      pin.className=`map-pin ${node.displayTier==='次级'?'secondary':''} ${node.kind==='船只'?'ship':''} ${node.id==='01-14'?'featured':''} ${symbolic.has(node.id)?'region':''} ${node.visibility==='公开'?'':'rumor'}`;
      pin.style.setProperty('--x',point[0]*100+'%');pin.style.setProperty('--y',point[1]*100+'%');
      pin.title=name(node.id);
      pin.setAttribute('aria-label',name(node.id)+' · 查看地点卡');
      const img=document.createElement('img');img.src=`assets/crests-v3/${crest(node.id)}.webp`;img.alt='';img.loading='lazy';pin.append(img);
      text('span',name(node.id),pin);
      pin.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse' || window.EARTHSEA_EDITOR?.editing) event.stopPropagation();});
      pin.addEventListener('dblclick',event=>event.stopPropagation());
      pin.dataset.nodeId=node.id;
      pin.addEventListener('click',()=>{if (!window.EARTHSEA_EDITOR?.editing) openNode(node);});
      pins.append(pin);pinElements.set(node.id,pin);
    }
    updatePlayer();draw();
  }
  window.addEventListener('sea:render',event=>{
    zoom=event.detail.zoom;
    overlay.style.transform=document.getElementById('map-image').style.transform;
    if(renderedScale!==event.detail.scale) {
      renderedScale=event.detail.scale;
      overlay.style.setProperty('--inverse-scale',String(1/renderedScale));
    }
    const band=zoom < 160 ? 0 : zoom < 195 ? 1 : 2;
    if (pinElements.size && band !== zoomBand) {zoomBand=band;linesReady=false;draw();}
  });
  window.addEventListener('sea:placement-change',()=>{
    linesReady=false;
    if(from && to && !panel.hidden) itinerary();
    else draw();
  });
  window.addEventListener('sea:ready',initialize);
  if(document.getElementById('map-image').naturalWidth) initialize();
  document.getElementById('toggle-routes').addEventListener('click',event=>{
    routeVisible=!routeVisible;toggle(event.currentTarget,routeVisible);legend.hidden=!routeVisible;linesReady=false;draw();
  });
  document.getElementById('toggle-rumors').addEventListener('click',event=>{
    rumors=!rumors;toggle(event.currentTarget,rumors);linesReady=false;draw();
  });
  document.getElementById('open-directory').addEventListener('click',()=>directory());
  document.getElementById('card-close').addEventListener('click',()=>{card.hidden=true;selected=null;draw();});
  document.getElementById('trip-close').addEventListener('click',()=>{panel.hidden=true;from=null;to=null;currentRoute=null;draw();});
  document.getElementById('allow-inferred').addEventListener('change',itinerary);
  document.getElementById('route-to').addEventListener('click',()=>{from=playerId();if(!from)return;to=selected;itinerary();});
  document.getElementById('trip-go').addEventListener('click',()=>{
    if(!currentRoute || !from || !to || from!==playerId())return;
    const nm=currentRoute.reduce((total,leg)=>total+(leg.measure?.nauticalMiles||0),0);
    const days=runtime.travelDays(currentRoute);
    runtime.depart({layer:'sea',from:name(from),to:name(to),distance:nm,distanceUnit:'海里',days:Number(days.toFixed(1)),legs:currentRoute.map(leg=>name(leg.from)+' → '+name(leg.to))});
  });
  runtime.onChange(()=>{if(!pinElements.size)return;
    const state=runtime.data();
    if (state?.世界信息 && injectedData!==state) window.EARTHSEA_MAP_STATE.set(state);
    updatePlayer();
  });
  // Existing map keyboard Esc continues to close the pure-image view first.
  window.addEventListener('keydown',event=>{if(event.key==='Escape' && !document.getElementById('atlas').classList.contains('pure')) {card.hidden=true;panel.hidden=true;selected=null;draw();}});
})();






















