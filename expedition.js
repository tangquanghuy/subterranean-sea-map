(() => {
  'use strict';
  const records=window.EXPEDITION_NODES;
  const byId=new Map(records.map(n=>[n.id,n]));
  const overlay=document.getElementById('expedition-overlay');
  const fog=window.EARTHSEA_FOG(overlay);
  const discovery=window.EARTHSEA_DISCOVERY || {};
  let supplied=null,previous='';
  function unlocked(id){
    const need=discovery[id];if(!need)return true;
    const data=supplied ?? (typeof window.getMessageVar==='function'?window.getMessageVar('stat_data',{defaults:{}}):{}) ?? {};
    const item=data?.人物?.背包?.道具?.[need.item];
    return (!need.item || item != null) && (!need.event || data?.世界信息?.大事件?.[need.event]===true) &&
      (!need.requiresEvents || need.requiresEvents.every(key=>data?.世界信息?.大事件?.[key]===true));
  }
  const svg=document.getElementById('expedition-routes');
  const card=document.getElementById('expedition-card');
  const body=document.getElementById('expedition-card-body');
  const directory=document.getElementById('expedition-directory');
  const routing=document.getElementById('expedition-routing');
  const routingText=document.getElementById('expedition-routing-text');
  // These are illustration coordinates, not real-world distances. No mileage is derived from them.
  const positions={
    '05-02':[3130,2500,'ground'],'05-03':[2260,1480,'ground'],'05-04':[1220,420,'ground'],
    '05-07':[330,1060,'flight'],'05-08':[335,1530,'flight'],'05-09':[340,2240,'flight'],
    '06-01':[995,1840,'ground'],'06-02':[175,2810,'flight'],'06-04':[3710,2470,'ground']
  };  const edges=[
    ['05-02','06-01','rail',[[3130,2500],[2710,2630],[2150,2580],[1550,2340],[1080,2030],[995,1840]]],
    ['05-02','05-03','ground',[[3130,2500],[2750,2690],[2320,2670],[1910,2390],[1930,2040],[2260,1480]]],
    ['05-03','05-04','ground',[[2260,1480],[1940,1160],[1600,860],[1220,420]]],
    ['06-01','05-03','ground',[[995,1840],[1420,1600],[1850,1330],[2260,1480]]],
    ['05-02','06-04','ground',[[3130,2500],[3450,2450],[3710,2470]]],
    ['06-01','05-07','flight',[[995,1840],[720,1650],[480,1260],[330,1060]]],
    ['05-07','05-08','flight',[[330,1060],[275,1280],[335,1530]]],
    ['05-08','05-09','flight',[[335,1530],[280,1900],[340,2240]]],
    ['05-09','06-02','flight',[[340,2240],[240,2500],[175,2810]]]
  ];
  for(const id of Object.keys(positions))if(!byId.has(id))throw new Error(`Unknown expedition card: ${id}`);
  for(const n of records)if(!positions[n.id]&&n.id!=='08-03')throw new Error(`Missing expedition pin: ${n.id}`);
  const tags={ground:'地表远征',flight:'地表上空',unlocated:'地表沙漠 · 方位未载'};
  const mk=(tag,klass,text)=>{const el=document.createElement(tag);if(klass)el.className=klass;if(text!==undefined)el.textContent=text;return el};
  const pins=new Map();let routeMode=false,start=null,end=null;
  const runtime=window.EARTHSEA_RUNTIME;
  const playerEntries=records.map(n=>[n.id,n.name]);
  const playerId=()=>runtime.resolve(playerEntries);
  const locationReadout=document.getElementById('player-position');
  locationReadout.tabIndex=0;locationReadout.setAttribute('role','button');locationReadout.title='定位到当前位置';
  function focusPlayer(){const point=positions[playerId()];if(point)window.EARTHSEA_VIEW?.center(point[0],point[1]);}
  locationReadout.addEventListener('click',focusPlayer);
  locationReadout.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();focusPlayer()}});

  // Rough itinerary budget per link, not distances calculated from the illustration.
  const legBudget={
    '05-02|06-01':[130,450],'05-02|05-03':[95,30],'05-03|05-04':[115,30],
    '05-03|06-01':[90,30],'05-02|06-04':[55,30],'05-07|06-01':[70,190],
    '05-07|05-08':[55,190],'05-08|05-09':[80,190],'05-09|06-02':[85,190]
  };
  const budget=(a,b)=>legBudget[[a,b].sort().join('|')];
  for(const n of records){
    if(!positions[n.id])continue;
    const [x,y,kind]=positions[n.id];
    const pin=mk('button',`expedition-pin ${kind}`);
    pin.type='button';pin.dataset.node=n.id;pin.setAttribute('aria-label',`${n.name}，查看地点`);
    pin.style.left=`${x}px`;pin.style.top=`${y}px`;
    const icon=mk('img');icon.src=n.icon;icon.alt='';pin.append(icon, mk('span','expedition-pin-label',n.name));
    pin.addEventListener('click',e=>{e.stopPropagation();if(routeMode && unlocked(n.id))choose(n.id);open(n.id)});
    overlay.append(pin);pins.set(n.id,pin);
  }
  const pathFor=points=>'M '+points.map(p=>p.join(' ')).join(' L ');
  const paths=[];
  for(const [a,b,kind,points] of edges){
    const el=document.createElementNS('http://www.w3.org/2000/svg','path');
    el.setAttribute('d',pathFor(points));el.setAttribute('class',`expedition-line ${kind}`);
    svg.append(el);paths.push({a,b,kind,el});
  }
  function open(id){
    const n=byId.get(id);directory.hidden=true;card.hidden=false;card.dataset.node=id;
    document.getElementById('expedition-trip').hidden=true;document.getElementById('expedition-trip-go').disabled=true;
    document.getElementById('expedition-card-icon').src=n.icon;
    document.getElementById('expedition-card-title').textContent=n.name;
    document.getElementById('expedition-card-category').textContent=tags[positions[id]?.[2]||'unlocated'];
    body.replaceChildren();
    if(!unlocked(id)){
      document.getElementById('expedition-card-category').textContent='方位未明 · 寻访线索';
      const need=discovery[id];const item=supplied?.人物?.背包?.道具?.[need?.item];
      const events=supplied?.世界信息?.大事件 || {};
      const gated=(need?.event && events[need.event]!==true) || need?.requiresEvents?.some(key=>events[key]!==true);
      const clue=gated ? (need?.clueBeforeEvent || need?.clue) : need?.clue;
      body.append(mk('h3','','寻访线索'),mk('p','',clue||'先找到这处地标的可靠航迹。'));
      return;
    }
    for(const [title,text] of Object.entries(n.sections)){
      if(!text)continue;
      body.append(mk('h3','',title),mk('p','',text));
    }
    for(const [key,pin] of pins)pin.classList.toggle('active',key===id);
    planFromPlayer(id);
  }
  function close(){card.hidden=true;document.getElementById('expedition-trip').hidden=true;for(const pin of pins.values())pin.classList.remove('active')}
  function shortest(a,b){
    // Only the documented ground, railway and ascent links are traversable.
    if(!byId.has(a)||!byId.has(b)||!unlocked(a)||!unlocked(b))return null;
    const dist=new Map([[a,0]]),prev=new Map([[a,null]]),visited=new Set();
    while(true){
      const here=[...dist.keys()].filter(id=>!visited.has(id)).sort((x,y)=>dist.get(x)-dist.get(y))[0];
      if(!here||here===b)break;visited.add(here);
      for(const edge of paths){if(!unlocked(edge.a)||!unlocked(edge.b))continue;
        const next=edge.a===here?edge.b:edge.b===here?edge.a:null;
        if(!next)continue;const measure=budget(here,next);if(!measure)continue;
        const candidate=dist.get(here)+measure[0]/measure[1];
        if(candidate<(dist.get(next)??Infinity)){dist.set(next,candidate);prev.set(next,{id:here,edge});}
      }
    }
    if(!prev.has(b))return null;
    const result=[];let at=b;
    while(at!==a){const step=prev.get(at);result.unshift({from:step.id,to:at,edge:step.edge});at=step.id}
    return result;
  }
  function updateRoute(){
    for(const {el} of paths)el.classList.remove('selected','dimmed');
    for(const pin of pins.values())pin.classList.remove('route-selected');
    if(start&&pins.has(start))pins.get(start).classList.add('route-selected');
    if(end&&pins.has(end))pins.get(end).classList.add('route-selected');
    if(!start){routingText.textContent='当前位置尚未标定在远征区';return}
    if(!end){routingText.textContent=`从 ${byId.get(start).name} 选择目的地`;return}
    const route=shortest(start,end);
    if(!route){routingText.textContent=`${byId.get(start).name} → ${byId.get(end).name} · 暂无已知通路`;return}
    for(const {el} of paths)el.classList.add('dimmed');
    for(const step of route){step.edge.el.classList.add('selected');step.edge.el.classList.remove('dimmed');pins.get(step.to).classList.add('route-selected')}
    const pathNames=[byId.get(start).name,...route.map(step=>byId.get(step.to).name)];
    routingText.textContent=pathNames.join(' → ')+(route.length?' · '+route.map(step=>({ground:'陆路',rail:'铁路',flight:'浮空远征'}[step.edge.kind])).join(' / '):'');
  }
  function choose(id){start=playerId();end=id;updateRoute();}
  // Recorded ascent: 安查岛 -> 巨坑要塞 takes six hours by airship.
  // Requiring the existing discovery/event gate prevents an early ascent.
  const seaGateway=()=>!playerId() && runtime.resolve([['05-01','安查岛']])==='05-01' && unlocked('05-02');
  function planFromPlayer(id){
    const seaOrigin=seaGateway(),from=seaOrigin?'05-02':playerId();
    const summary=document.getElementById('expedition-trip-summary');
    const trip=document.getElementById('expedition-trip'),go=document.getElementById('expedition-trip-go');
    trip.hidden=false;go.disabled=true;trip.dataset.to='';start=from;end=id;
    if(!from||!unlocked(from)){summary.textContent='当前位置未标定在远征区，暂不能从这里规划路程。';return;}
    if(from===id&&!seaOrigin&&from==='05-02'){
      // Reverse service follows the same airship corridor; 6h is a working estimate from the recorded outward leg.
      summary.textContent='巨坑要塞 → 安查岛 · 飞艇约 6 小时';
      trip.dataset.from=from;trip.dataset.to='05-01';trip.dataset.km='0';trip.dataset.days='0.25';
      go.disabled=false;return;
    }
    if(from===id&&!seaOrigin){summary.textContent='你已在此地。';return;}
    const legs=from===id?[]:shortest(from,id);
    if(!legs){summary.textContent='尚无已知通路。';return;}
    const measures=legs.map(({from,to})=>budget(from,to));
    if(measures.some(value=>!value)){summary.textContent='航路已标定，里程尚未核实。';return;}
    const km=measures.reduce((sum,[distance])=>sum+distance,0);
    const days=measures.reduce((sum,[distance,perDay])=>sum+distance/perDay,0)+(seaOrigin?.25:0);
    summary.textContent=seaOrigin&&id===from
      ?'安查岛 → 巨坑要塞 · 升空约 6 小时'
      :`${seaOrigin?'安查岛':byId.get(from).name} → ${byId.get(id).name} · ${seaOrigin?"地表段约":"参考里程约 "}${km} 公里 · 预计约 ${days.toFixed(1)} 天${seaOrigin?'（含升空六小时）':''}` +
        (legs.length>1?'\n途经：'+legs.map(leg=>byId.get(leg.to).name).join(' → '):'');
    trip.dataset.from=seaOrigin?'05-01':from;trip.dataset.to=id;trip.dataset.km=km;trip.dataset.days=days.toFixed(2);
    go.disabled=false;updateRoute();svg.classList.remove('off');
    const toggle=document.getElementById('expedition-lines');toggle.textContent='隐藏航路';toggle.setAttribute('aria-pressed','true');
  }
  document.getElementById('expedition-trip-go').addEventListener('click',()=>{
    const trip=document.getElementById('expedition-trip');
    const seaOrigin=seaGateway(),from=seaOrigin?'05-02':playerId(),to=trip.dataset.to;
    if(!seaOrigin&&from==='05-02'&&to==='05-01'&&trip.dataset.from==='05-02'&&unlocked(from)){
      runtime.depart({layer:'expedition',from:'巨坑要塞',to:'安查岛',distance:0,distanceUnit:'公里',days:0.25,legs:['巨坑要塞 → 安查岛（飞艇返航）']});return;
    }
    if(!from||!to||trip.dataset.from!==(seaOrigin?'05-01':from)||!unlocked(to)||!unlocked(from)||(!seaOrigin&&from===to))return;
    const legs=from===to?[]:shortest(from,to);
    if(!legs)return;
    const measures=legs.map(({from,to})=>budget(from,to));if(measures.some(value=>!value))return;
    const km=measures.reduce((sum,[distance])=>sum+distance,0);
    const days=measures.reduce((sum,[distance,speed])=>sum+distance/speed,seaOrigin?.25:0);
    runtime.depart({layer:'expedition',from:seaOrigin?'安查岛':byId.get(from).name,to:byId.get(to).name,
      distance:km,distanceUnit:'公里',days:Number(days.toFixed(2)),
      legs:[...(seaOrigin?['安查岛 → 巨坑要塞（飞艇六小时）']:[]),...legs.map(leg=>byId.get(leg.from).name+' → '+byId.get(leg.to).name)]});
  });
  document.getElementById('expedition-route').addEventListener('click',()=>{
    routeMode=!routeMode;routing.hidden=!routeMode;
    document.getElementById('expedition-route').classList.toggle('on',routeMode);
    if(!routeMode){start=end=null;updateRoute();}else{start=playerId();end=null;updateRoute();directory.hidden=true;close();}
  });
  document.getElementById('expedition-route-clear').addEventListener('click',()=>document.getElementById('expedition-route').click());
  svg.classList.add('off');document.getElementById('expedition-lines').textContent='显示航路';document.getElementById('expedition-lines').setAttribute('aria-pressed','false');
  document.getElementById('expedition-lines').addEventListener('click',e=>{
    const off=svg.classList.toggle('off');e.currentTarget.textContent=off?'显示航路':'隐藏航路';e.currentTarget.setAttribute('aria-pressed',String(!off));
  });
  document.getElementById('expedition-card-close').addEventListener('click',close);
  document.getElementById('expedition-directory-close').addEventListener('click',()=>directory.hidden=true);
  const groups={ground:'巨坑与黑墙',flight:'浮空岛远征',unlocated:'地表沙漠 · 方位未载'};
  const list=document.getElementById('expedition-directory-body');
  for(const [kind,title] of Object.entries(groups)){
    list.append(mk('h3','',title));
    for(const n of records.filter(n=>(positions[n.id]?.[2]||'unlocated')===kind)){
      const entry=mk('button','expedition-entry');entry.type='button';
      const icon=mk('img');icon.src=n.icon;icon.alt='';entry.append(icon,mk('span','',n.name));
      entry.dataset.node=n.id;entry.addEventListener('click',()=>{if(routeMode && unlocked(n.id))choose(n.id);open(n.id);directory.hidden=true});list.append(entry);
    }
  }
  document.getElementById('expedition-list').addEventListener('click',()=>{directory.hidden=!directory.hidden;if(!directory.hidden)close()});
  window.addEventListener('sea:render',e=>{
    const {x,y,scale}=e.detail;overlay.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
    overlay.style.setProperty('--invscale',String(1/scale));
  });
  window.addEventListener('keydown',e=>{if(e.key==='Escape'){close();directory.hidden=true;}});
  function refreshDiscovery(){
    const patches=Object.entries(positions).filter(([id])=>unlocked(id)).map(([,p])=>({x:p[0],y:p[1],radius:520}));
    const signature=JSON.stringify(patches);
    if(signature!==previous){fog.paint(patches.length===Object.keys(positions).length?null:patches);previous=signature;}
    for(const [id,pin] of pins)pin.classList.toggle('locked',!unlocked(id));
    for(const entry of document.querySelectorAll('.expedition-entry'))entry.classList.toggle('locked',!unlocked(entry.dataset.node));
    for(const {a,b,el} of paths)el.classList.toggle('locked',!unlocked(a)||!unlocked(b));
    if(start&&!unlocked(start))start=null;
    if(end&&!unlocked(end))end=null;
    if(!card.hidden && card.dataset.node)open(card.dataset.node);
    updateRoute();
  }
  window.EXPEDITION_MAP={positions,edges,shortest,setState(data){supplied=data;refreshDiscovery()}};
  runtime.onChange(()=>{supplied=runtime.data();refreshDiscovery();
    const id=playerId();if(routeMode && start!==id){start=id;end=null;updateRoute();}document.getElementById('player-position').textContent='当前位置：'+runtime.label()+(id?'':' · 远征区未标定');
    for(const [key,pin] of pins)pin.classList.toggle('player-current',key===id);
    if(!card.hidden && card.dataset.node && unlocked(card.dataset.node))planFromPlayer(card.dataset.node);
  });
  refreshDiscovery();
  setInterval(()=>{if(!supplied && !document.hidden)refreshDiscovery()},1200);
})();








