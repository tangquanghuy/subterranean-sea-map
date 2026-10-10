(() => {
  'use strict';
  const atlas=document.getElementById('atlas');
  const overlay=document.getElementById('world-overlay');
  const fog=window.EARTHSEA_FOG(overlay);
  let fogSignature='';
  const card=document.getElementById('world-card');
  const cardBody=document.getElementById('world-card-body');
  const directory=document.getElementById('world-directory');
  const seaAffiliated=new Set(['07-01','07-02','07-03']);
  const surfaceNodes=window.GLOBAL_SURFACE_NODES.filter(node=>!seaAffiliated.has(node.id));
  const byId=new Map(surfaceNodes.map(node=>[node.id,node]));
  const regions=[
    {id:'europe',name:'欧洲线',note:'地下伦敦、挪威雪原、东欧湖畔与希腊一线。各地点的具体入口与设施仍以各自记录为准。',children:['08-01','norway','eastern-europe','greece']},
    {id:'china',name:'中国东部城市群',note:'龙祥小区、沿海城市、南京街头、学校、王氏建设集团，以及地表城市外围的废弃钢铁厂。',children:['08-04','07-08','nanjing','east-coast','china-school','wang-group']},
    {id:'south-america',name:'南美线',note:'度假村、山道、银湖溶洞、亚马逊丛林与422现场。',children:['resort','mountain-path','silver-cave','amazon','site422']},
    {id:'indian-ocean',name:'印度洋线',note:'科摩尔岛、斯里兰卡与印度洋公海的相关记录；海面事件不作固定城市落点。',children:['comoros','srilanka','indian-high-seas','offering-fleet']},
    {id:'antarctica',name:'南极',note:'南极24号收容站位于南极；站点的具体位置未载。',children:['08-05']}
  ];
  const supplementary=new Map(window.GLOBAL_SURFACE_SUPPLEMENTARY.map(node=>[node.id,{...node,icon:`assets/crests-surface/${node.id}.webp`}]));
  const regionById=new Map(regions.map(r=>[r.id,r]));
  const allById=id=>byId.get(id)||regionById.get(id)||supplementary.get(id);
  const visibleName=id=>{const n=allById(id);return unlocked(id)&&n.chartedName?n.chartedName:n.name};
  let injectedData=null;
  const runtime=window.EARTHSEA_RUNTIME;
  const known=[...surfaceNodes,...supplementary.values()];
  const currentId=()=>runtime.resolve(known.map(n=>[n.id,n.chartedName||n.name]));
  // Representative interregional ground distances; map art itself is not a measured scale.
  const regionCoords={europe:[50,12],china:[115,31],'south-america':[-60,-15],'indian-ocean':[74,-5],antarctica:[45,-77]};
  const localKm={'08-01':0,norway:1700,'eastern-europe':1600,greece:2000,
    '08-04':0,'07-08':1200,nanjing:220,'east-coast':400,'china-school':270,'wang-group':300,
    resort:0,'mountain-path':18,'silver-cave':32,amazon:210,site422:360,
    comoros:0,srilanka:3900,'indian-high-seas':800,'offering-fleet':800,'08-05':0};
  const groupById=new Map();
  for(const r of regions)for(const id of r.children)groupById.set(id,r.id);
  const haversine=(a,b)=>{const rad=Math.PI/180;const dLat=(b[1]-a[1])*rad,dLon=(b[0]-a[0])*rad;
    const h=Math.sin(dLat/2)**2+Math.cos(a[1]*rad)*Math.cos(b[1]*rad)*Math.sin(dLon/2)**2;
    return Math.round(6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h)));};
  // Region hubs are routing waypoints, NOT extra places on the illustrated map.
  // Each existing local budget is a spoke from its own regional gateway;
  // links between regions use representative great-circle distances, never pixels.
  // The resulting distance is an itinerary estimate, not surveyed road mileage.
  const gateways=new Map(Object.keys(regionCoords).map(region=>['@'+region,region]));
  const surfaceGraph=new Map();
  function link(a,b,km,perDay){
    if(!Number.isFinite(km)||km<0)return;
    for(const [from,to] of [[a,b],[b,a]]){
      if(!surfaceGraph.has(from))surfaceGraph.set(from,[]);
      surfaceGraph.get(from).push({to,km,days:Math.max(.05,km/perDay)});
    }
  }
  for(const [id,region] of groupById){
    if(Number.isFinite(localKm[id]))link(id,'@'+region,localKm[id],250);
  }
  const regionIds=Object.keys(regionCoords);
  for(let i=0;i<regionIds.length;i++)for(let j=i+1;j<regionIds.length;j++){
    link('@'+regionIds[i],'@'+regionIds[j],haversine(regionCoords[regionIds[i]],regionCoords[regionIds[j]]),550);
  }
  function route(from,to){
    if(!surfaceGraph.has(from)||!surfaceGraph.has(to)||!unlocked(from)||!unlocked(to)||from===to)return null;
    const best=new Map([[from,0]]),previous=new Map(),seen=new Set();
    while(true){
      const here=[...best.keys()].filter(n=>!seen.has(n)).sort((a,b)=>best.get(a)-best.get(b))[0];
      if(!here||here===to)break;
      seen.add(here);
      for(const edge of surfaceGraph.get(here)||[]){
        if(!gateways.has(edge.to)&&!unlocked(edge.to))continue;
        const cost=best.get(here)+edge.days;
        if(cost<(best.get(edge.to)??Infinity)){best.set(edge.to,cost);previous.set(edge.to,{from:here,...edge});}
      }
    }
    if(!previous.has(to))return null;
    let at=to,km=0,days=0;const steps=[];
    while(at!==from){const step=previous.get(at);if(!step)return null;
      km+=step.km;days+=step.days;steps.unshift({from:step.from,to:at,km:step.km,days:step.days});at=step.from;
    }
    return {km:Math.round(km/10)*10,days:Math.max(.1,days),steps};
  }
  window.EARTHSEA_SURFACE_NET={route};
  let activeSurfaceRoute=null;
  function updateTrip(id){
    const panel=document.getElementById('surface-trip'),summary=document.getElementById('surface-trip-summary'),go=document.getElementById('surface-trip-go');
    panel.hidden=false;go.disabled=true;panel.dataset.to='';activeSurfaceRoute=null;drawNetwork();
    const from=currentId();
    if(!from||!groupById.has(from)||!groupById.has(id)){summary.textContent='当前位置或目的地未标定地表行程。';return;}
    if(!unlocked(from)||!unlocked(id)){summary.textContent='这片地区仍在海图迷雾之中。';return;}
    if(from===id){summary.textContent='你已在此地。';return;}
    const plan=route(from,id);
    if(!plan){summary.textContent='这段行程尚无可核对的通路与里程。';return;}
    activeSurfaceRoute=plan;drawNetwork();
    summary.textContent=`${allById(from).name} → ${allById(id).name} · 参考路程约 ${plan.km.toLocaleString('zh-CN')} 公里 · 预计约 ${plan.days.toFixed(1)} 天`;
    panel.dataset.from=from;panel.dataset.to=id;panel.dataset.km=plan.km;panel.dataset.days=plan.days.toFixed(1);go.disabled=false;
  }
  document.getElementById('surface-trip-go').addEventListener('click',()=>{
    const panel=document.getElementById('surface-trip');
    const from=currentId(),to=panel.dataset.to;
    if(panel.dataset.from!==from||!to)return;
    const plan=route(from,to);if(!plan)return;
    // Recompute from current MVU/discovery state instead of trusting a stale card.
    runtime.depart({layer:'surface',from:allById(from).name,to:allById(to).name,
      distance:plan.km,distanceUnit:'公里',days:Number(plan.days.toFixed(1)),
      legs:[allById(from).name+' → '+allById(to).name]});
  });
  const discovery=window.EARTHSEA_DISCOVERY || {};
  function storyData(){
    try{return injectedData ?? (typeof window.getMessageVar==='function'?window.getMessageVar('stat_data',{defaults:{}}):{}) ?? {}}
    catch(_){return {}}
  }
  const surfaceOpened=()=>storyData()?.世界信息?.大事件?.['地表通道开放']===true;
  function unlocked(id){
    if(!surfaceOpened())return false;
    const need=discovery[id];if(!need)return true;
    const data=storyData(),item=data?.人物?.背包?.道具?.[need.item];
    return (!need.item || (item != null)) &&
      (!need.event || data?.世界信息?.大事件?.[need.event]===true) &&
      (!need.requiresEvents || need.requiresEvents.every(key=>data?.世界信息?.大事件?.[key]===true));
  }
  function clueFor(id){
    if(!surfaceOpened())return '海图没有画到这里。先找出通往地表的路，才能辨认这片陆地上的地点。';
    const need=discovery[id];if(!need)return '';
    const item=storyData()?.人物?.背包?.道具?.[need.item];
    if(need.clueBeforeEvent && ((need.event && storyData()?.世界信息?.大事件?.[need.event]!==true) ||
        need.requiresEvents?.some(key=>storyData()?.世界信息?.大事件?.[key]!==true))) return need.clueBeforeEvent;
    if(need.event && item != null){
      return need.event==='新界市开放'?'入口的地标已有记录；城门尚未开放，眼下还进不去。':'线索已经记下；通往地表的路尚未贯通，暂时只能从来路继续查找。';
    }
    return need.clue;
  }
  window.EARTHSEA_SURFACE_STATE={set(data){injectedData=data;refreshUnlocks()}};

  // Artistic, playable positions in image pixels. These are NOT geographic
  // coordinates and must never feed route mileage/time calculations.
  // The region cards remain in the index; all their children appear at once.
  const playablePins=[
    // Europe
    {id:'08-01',x:1900,y:950,group:'europe'},
    {id:'norway',x:2140,y:715,group:'europe'},
    {id:'eastern-europe',x:2420,y:925,group:'europe'},
    {id:'greece',x:2200,y:1210,group:'europe'},
    // East China: these spread over the illustrated area for legibility.
    {id:'china-school',x:3060,y:900,group:'china'},
    {id:'wang-group',x:3560,y:840,group:'china'},
    {id:'07-08',x:2910,y:1215,group:'china'},
    {id:'08-04',x:3440,y:1275,group:'china'},
    {id:'nanjing',x:3070,y:1570,group:'china'},
    {id:'east-coast',x:3590,y:1630,group:'china'},
    // South America
    {id:'resort',x:1190,y:1810,group:'south-america'},
    {id:'amazon',x:1490,y:2000,group:'south-america'},
    {id:'mountain-path',x:1200,y:2360,group:'south-america'},
    {id:'silver-cave',x:1510,y:2550,group:'south-america'},
    {id:'site422',x:1350,y:2850,group:'south-america'},
    // Indian Ocean; the sea-going entries have symbolic, non-fixed positions.
    {id:'srilanka',x:2660,y:1640,group:'indian-ocean'},
    {id:'comoros',x:2430,y:2130,group:'indian-ocean'},
    {id:'indian-high-seas',x:2790,y:2280,group:'indian-ocean'},
    {id:'offering-fleet',x:3160,y:2060,group:'indian-ocean',moving:true},
    {id:'08-05',x:2000,y:3660,group:'antarctica'}
  ];
  const locationReadout=document.getElementById('player-position');
  locationReadout.tabIndex=0;locationReadout.setAttribute('role','button');locationReadout.title='定位到当前位置';
  function focusPlayer(){const point=playablePins.find(p=>p.id===currentId());if(point)window.EARTHSEA_VIEW?.center(point.x,point.y);}
  locationReadout.addEventListener('click',focusPlayer);
  locationReadout.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();focusPlayer()}});
  const iconFor=id=>allById(id)?.icon;
  const mk=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!=null)e.textContent=text;return e};
  const imgFor=id=>{const image=mk('img');image.src=iconFor(id);image.alt='';image.loading='lazy';return image};
  const pins=[];
  for(const {id,x,y,group,moving} of playablePins){
    const node=allById(id);
    if(!node)throw new Error(`Unknown surface node: ${id}`);
    const button=mk('button','world-pin'+(moving?' moving':''));
    button.type='button';button.dataset.node=id;button.dataset.group=group;
    button.setAttribute('aria-label',visibleName(id)+'，查看地点');
    button.style.setProperty('--px',x+'px');button.style.setProperty('--py',y+'px');
    if(!iconFor(id))throw new Error(`Missing surface crest: ${id}`);
    button.append(imgFor(id));
    button.append(mk('span','pin-label',visibleName(id)));
    button.addEventListener('click',event=>{event.stopPropagation();open(id)});
    overlay.append(button);pins.push({button,id});
  }
  const routeSvg=document.getElementById('world-routes');
  const routeLines=new Map();
  const routeKey=(a,b)=>[a,b].sort().join('|');
  const routeEntries=new Map(playablePins.map(pin=>[pin.id,pin]));
  for(const [from,edges] of surfaceGraph)for(const edge of edges){
    const key=routeKey(from,edge.to);if(routeLines.has(key))continue;
    const path=document.createElementNS('http://www.w3.org/2000/svg','path');
    if(gateways.has(from)&&gateways.has(edge.to))path.classList.add('interregional');
    routeSvg.append(path);routeLines.set(key,{path,from,to:edge.to});
  }
  function drawNetwork(){
    const pointOf=id=>gateways.has(id)
      ? regions.find(r=>r.id===gateways.get(id))?.children.map(child=>routeEntries.get(child)).find(point=>point&&unlocked(point.id))
      : routeEntries.get(id);
    const selected=new Set(activeSurfaceRoute?.steps.map(step=>routeKey(step.from,step.to))||[]);
    for(const [key,{path,from,to}] of routeLines){
      const a=pointOf(from),b=pointOf(to);
      const visible=!!a&&!!b&&(!gateways.has(from)||unlocked(a.id))&&(!gateways.has(to)||unlocked(b.id));
      path.style.display=visible?'':'none';if(!visible)continue;
      path.classList.toggle('selected',selected.has(key));
      const x=(a.x+b.x)/2,y=(a.y+b.y)/2;
      const cross=gateways.has(from)&&gateways.has(to);
      const offset=cross?Math.min(110,Math.hypot(b.x-a.x,b.y-a.y)*.09):18;
      path.setAttribute('d',`M${a.x} ${a.y} Q${x+offset} ${y-offset} ${b.x} ${b.y}`);
    }
  }
  document.getElementById('toggle-routes').addEventListener('click',e=>{
    const hidden=routeSvg.classList.toggle('off');e.currentTarget.textContent=hidden?'显示航路':'隐藏航路';
    e.currentTarget.setAttribute('aria-pressed',String(!hidden));
  });
  window.addEventListener('sea:render',event=>{
    const {scale,x,y}=event.detail;
    overlay.style.transform=`translate(${x}px,${y}px) scale(${scale})`;
    overlay.style.setProperty('--invscale',String(1/scale));
  });
  function refreshUnlocks(){
    const charted=pins.filter(({id})=>unlocked(id));
    const patches=charted.map(({button})=>({
      x:Number.parseFloat(button.style.getPropertyValue('--px')),
      y:Number.parseFloat(button.style.getPropertyValue('--py')),
      radius:440
    }));
    const signature=JSON.stringify(patches);
    if(signature!==fogSignature){fog.paint(charted.length===pins.length?null:patches);fogSignature=signature;}
    for(const {button,id} of pins){
      button.classList.toggle('locked',!unlocked(id));
      button.setAttribute('aria-label',visibleName(id)+(unlocked(id)?'，查看地点':'，查看寻访线索'));
      button.querySelector('.pin-label').textContent=visibleName(id);
    }
    for(const entry of document.querySelectorAll('#world-directory-list .entry')){
      const id=entry.dataset.location,charted=unlocked(id);
      entry.classList.toggle('uncharted',!charted);
      const label=entry.querySelector('span');if(label)label.textContent=visibleName(id);
      const icon=entry.querySelector('img');
      if(!icon && iconFor(id))entry.prepend(imgFor(id));

    }
    if(!card.hidden && card.dataset.location && card.dataset.unlocked!==String(unlocked(card.dataset.location)))open(card.dataset.location);
    if(activeSurfaceRoute?.steps.some(step=>!gateways.has(step.from)&&!unlocked(step.from)||!gateways.has(step.to)&&!unlocked(step.to)))activeSurfaceRoute=null;
    drawNetwork();
  }
  function close(){activeSurfaceRoute=null;drawNetwork();card.hidden=true;document.getElementById('surface-trip').hidden=true;for(const {button} of pins)button.classList.remove('active')}
  const addParagraph=(parent,title,text)=>{if(!text)return;parent.append(mk('h3','',title));parent.append(mk('p','',text))};
  function addChild(parent,id){
    const node=allById(id);if(!node)return;
    const button=mk('button','entry');button.type='button';button.dataset.location=id;button.classList.toggle('uncharted',!unlocked(id));
    if(iconFor(id))button.append(imgFor(id));
    button.append(mk('span','',visibleName(id)));
    button.addEventListener('click',()=>open(id));parent.append(button);
  }
  function open(id){
    const node=allById(id);if(!node)return;
    card.dataset.location=id;card.dataset.unlocked=String(unlocked(id));directory.hidden=true;card.hidden=false;cardBody.replaceChildren();
    document.getElementById('world-card-title').textContent=visibleName(id);
    const icon=document.getElementById('world-card-icon');
    icon.hidden=!iconFor(id);icon.classList.toggle('uncharted',!unlocked(id));if(!icon.hidden)icon.src=iconFor(id);
    document.getElementById('world-card-class').textContent=regionById.has(id)?'地表区域':byId.has(id)?'地表地点':'地表地点';
    for(const {button} of pins)button.classList.toggle('active',button.dataset.node===id);
    if(!unlocked(id)){
      document.getElementById('world-card-class').textContent='方位未明 · 寻访线索';
      addParagraph(cardBody,'寻访线索',clueFor(id));
      return;
    }
    if(regionById.has(id)){
      addParagraph(cardBody,'区域记录',node.note);
      if(node.children){cardBody.append(mk('h3','','区域内地点'));for(const child of node.children)addChild(cardBody,child)}
    }else if(byId.has(id)){
      const labels=['概况','航行与到达','危险等级','可用资源','关键场景','势力与人物','公开线索'];
      const sections=node.chartedSections||node.sections;
      for(const label of labels)addParagraph(cardBody,label,sections[label]);
      if(['05-02','05-03','05-04','05-07','05-08','05-09','06-01','06-02','06-04'].includes(id)){
        const link=mk('a','external','查看巨坑远征区地图 ↗');link.href='surface-expedition.html';cardBody.append(link);
      }
    }else if(node.sections){
      for(const [label,text] of Object.entries(node.sections))addParagraph(cardBody,label,text);
    }else addParagraph(cardBody,'区域记录',node.note);
    if(!regionById.has(id))updateTrip(id);else document.getElementById('surface-trip').hidden=true;
  }
  document.getElementById('world-card-close').addEventListener('click',close);
  document.getElementById('world-directory-close').addEventListener('click',()=>{directory.hidden=true});
  document.getElementById('world-directory-button').addEventListener('click',()=>{close();directory.hidden=!directory.hidden});
  const list=document.getElementById('world-directory-list');
  const located=['08-01','08-04','07-08','08-05'];
  const expedition=['05-02','05-03','05-04','05-07','05-08','05-09','06-01','06-02','06-04'];
  function section(title,ids){list.append(mk('h3','',title));for(const id of ids)addChild(list,id)}
  section('全球区域',regions.map(r=>r.id));
  section('区域内地点', [...supplementary.keys()]);
  section('有节点简报的地表地点',located);
  section('巨坑远征区 · 全球方位未载',expedition);
  section('其他区域 / 方位未载',surfaceNodes.filter(n=>!located.includes(n.id)&&!expedition.includes(n.id)).map(n=>n.id));
  runtime.onChange(()=>{injectedData=runtime.data();refreshUnlocks();
    const id=currentId();document.getElementById('player-position').textContent='当前位置：'+runtime.label()+(id?'':' · 地表图未标定');
    for(const {id:key,button} of pins)button.classList.toggle('player-current',key===id);
    if(!card.hidden && card.dataset.location && unlocked(card.dataset.location))updateTrip(card.dataset.location);
  });
  refreshUnlocks();
  setInterval(()=>{if(!injectedData)refreshUnlocks()},1200);
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&(!card.hidden||!directory.hidden)){close();directory.hidden=true}});

})();







