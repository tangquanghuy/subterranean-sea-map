/* 航程记载与画面相邻航路分层：已知航程优先保留原始海里；
   局部路网参照临江市 city_net.js 的 relative-neighborhood graph (RNG)。
   绘画坐标只决定相邻关系，不能充当地理坐标；未记载的航段单独按航时预算。 */
(function () {
  'use strict';
  const placement=window.EARTHSEA_PLACEMENT;
  const ledger=window.EARTHSEA_DISTANCES;
  const nodes=window.EARTHSEA_NODES || [];
  const byId=new Map(nodes.map(n=>[n.id,n]));
  const terminals=new Set(nodes.filter(n=>n.kind==='船只' || !!n.parentId || ['07-07','07-02','02-03'].includes(n.id)).map(n=>n.id));
  const key=(a,b)=>[a,b].sort().join('|');
  // 跨层图钉不参与岛间相邻图；作为接驳节点保留可达性。
  const nonMarine=new Set(['02-03','07-02','07-03','06-06','07-07','08-07']);
  // These are chart-edge records or uncharted sites, never an inferred ferry from the nearest painted island.
  const unrouteable=new Set(['07-03','06-06','08-07']);
  const portalAccess=new Set(['04-04','07-01']);
  const navigable=n=>n && n.kind!=='船只' && !nonMarine.has(n.id) && !!at(n);
  const at=n=>placement.anchors[n.id] || (n.parentId && placement.anchors[n.parentId] && [Math.min(.98,placement.anchors[n.parentId][0]+.055),Math.min(.98,placement.anchors[n.parentId][1]+.025)]);
  const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
  const estimate=(kind)=>kind==='access'
    ? {nauticalMiles:25,estimated:true,range:[10,50],basis:'同岛或附属地点的接驳预算，不依据海图坐标'}
    : {nauticalMiles:200,estimated:true,range:[120,350],basis:'未载航时的邻岛航段暂按单船约3日行程预算，不依据海图坐标'};
  const pointsOf=(a,b,via=[])=>at(byId.get(a))&&at(byId.get(b))?[at(byId.get(a)),...via,at(byId.get(b))]:null;
  let cachedSignature='',cachedEdges=null;
  function build() {
    const signature=nodes.map(n=>placement.anchors[n.id]?.join(',')||'').join(';');
    if(signature===cachedSignature && cachedEdges) return cachedEdges;
    const out=[],used=new Set();
    const add=(a,b,props={})=>{
      if(a===b || used.has(key(a,b))) return;
      const A=at(byId.get(a)),B=at(byId.get(b));
      if(!A || !B) return;
      used.add(key(a,b));
      out.push({a,b,line:props.line||'相邻航路',kind:props.kind||'local',inferred:!!props.inferred,
        documented:!!props.documented,points:pointsOf(a,b,props.via||[]),
        measure:props.kind==='portal'?null:(ledger[key(a,b)]||estimate(props.kind))});
    };
    // 几个事件地点只按实际追踪线索接入，画面坐标不充当航道证据。
    add('02-04','02-03',{line:'先知引路',kind:'local'});
    add('07-05','07-07',{line:'冰海血岛航迹',kind:'local'});
    add('04-06','07-02',{line:'三八面体追踪',kind:'local'});
    // 各岛及独立海域节点参与全图 RNG；附属设施通过其父节点接入，避免跨岛捷径。
    const places=nodes.filter(n=>navigable(n) && !n.parentId);
    const count=places.length;
    const D=Array.from({length:count},()=>new Float64Array(count));
    for(let i=0;i<count;i++) for(let j=0;j<i;j++)
      D[i][j]=D[j][i]=distance(placement.anchors[places[i].id],placement.anchors[places[j].id]);
    const degree=new Map(places.map(n=>[n.id,0]));
    const neighbors=new Map(places.map(n=>[n.id,[]]));
    const connect=(i,j)=>{
      if(used.has(key(places[i].id,places[j].id))) return;
      add(places[i].id,places[j].id);
      degree.set(places[i].id,degree.get(places[i].id)+1);
      degree.set(places[j].id,degree.get(places[j].id)+1);
      neighbors.get(places[i].id).push(j);
      neighbors.get(places[j].id).push(i);
    };
    // RNG 包含最小生成树；比全图按距离选边更能维持不同方向的相邻海岛。
    for(let i=0;i<count;i++) for(let j=i+1;j<count;j++) {
      const dij=D[i][j];
      let keep=true;
      for(let k=0;k<count;k++) if(k!==i&&k!==j && Math.max(D[i][k],D[j][k])<dij-1e-10) {keep=false;break;}
      if(keep) connect(i,j);
    }
    // RNG 只保证基本连通，近邻补边交由下方统一处理，避免出现图上明明有邻岛却只有一条海路。    // 已记载的长航程继续作为航路选项，但不强迫绕过相邻节点的局部网。
    for(const line of placement.routes) for(let i=0;i<line.stops.length-1;i++) {
      const a=line.stops[i],b=line.stops[i+1];
      if(!navigable(byId.get(a)) || !navigable(byId.get(b))) continue;
      if(used.has(key(a,b))) {
        if(line.inferred) {
          out.push({a,b,line:line.name,kind:line.kind,inferred:true,documented:true,
            points:pointsOf(a,b,line.via?.[i]||[]),measure:ledger[key(a,b)]||estimate(line.kind)});
          continue; // keep the optional long voyage separate from the ordinary adjacent crossing
        }
        const edge=out.find(e=>key(e.a,e.b)===key(a,b));
        edge.line=line.name;edge.kind=line.kind;edge.documented=true;
        continue;
      }
      add(a,b,{line:line.name,kind:line.kind,via:line.via?.[i],inferred:line.inferred,documented:true});
    }
    // 已有航次计入出口数量；在基本 RNG 之外连接画面附近的岛，形成可绕行的网。
    // 只补短线，不穿过其他岛点，也避免新旧局部线段相交；长航次不参与交叉判断。
    const crossing=(a,b,c,d)=>{
      const cross=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);
      return cross(a,b,c)*cross(a,b,d)<-1e-9 && cross(c,d,a)*cross(c,d,b)<-1e-9;
    };
    const nearIsland=(i,j)=>{
      const a=at(places[i]),b=at(places[j]),vx=b[0]-a[0],vy=b[1]-a[1],length=vx*vx+vy*vy;
      return places.some((place,k)=>{
        if(k===i||k===j) return false;
        const p=at(place),t=((p[0]-a[0])*vx+(p[1]-a[1])*vy)/length;
        return t>.1 && t<.9 && Math.hypot(p[0]-a[0]-t*vx,p[1]-a[1]-t*vy)<.013;
      });
    };
    const passes=(i,j)=>!nearIsland(i,j) && !out.some(e=>{
      if(e.kind!=='local' || e.a===places[i].id || e.a===places[j].id || e.b===places[i].id || e.b===places[j].id) return false;
      return crossing(at(places[i]),at(places[j]),at(byId.get(e.a)),at(byId.get(e.b)));
    });
    const localDegree=id=>out.filter(e=>e.a===id||e.b===id).length;
    const nearestByIndex=Array.from({length:count},(_,i)=>Math.min(...D[i].filter(x=>x>0)));
    const candidates=[];
    for(let i=0;i<count;i++) for(let j=i+1;j<count;j++) {
      const nearest=nearestByIndex[i];
      const otherNearest=nearestByIndex[j];
      if(D[i][j]>Math.min(.29,Math.max(.09,nearest*2.15)) &&
         D[i][j]>Math.min(.29,Math.max(.09,otherNearest*2.15))) continue;
      candidates.push([i,j,D[i][j]]);
    }
    candidates.sort((a,b)=>a[2]-b[2]);
    // 先给少于三条通道的岛补最短近邻，再给密集海域增加第四条。
    for(const goal of [3,4]) for(const [i,j] of candidates) {
      if(used.has(key(places[i].id,places[j].id))) continue;
      if(localDegree(places[i].id)>=goal && localDegree(places[j].id)>=goal) continue;
      if(!passes(i,j)) continue;
      connect(i,j);
    }
    // 拖动岛屿后局部距离上限可能使其成为孤岛；以最短连接修复连通分量。
    const components=Array.from({length:count},(_,i)=>i);
    const root=i=>{while(components[i]!==i) i=components[i]=components[components[i]];return i;};
    const merge=(i,j)=>{components[root(i)]=root(j);};
    const index=new Map(places.map((n,i)=>[n.id,i]));
    for(const e of out) if(index.has(e.a)&&index.has(e.b)) merge(index.get(e.a),index.get(e.b));
    const bridges=[];
    for(let i=0;i<count;i++) for(let j=i+1;j<count;j++) bridges.push([i,j,D[i][j]]);
    bridges.sort((a,b)=>a[2]-b[2]);
    for(const [i,j] of bridges) if(root(i)!==root(j)) {connect(i,j);merge(i,j);}
    // 父地点、船只、跨层索引均为真实可点选的路网端点。
    // 船在画面上只是暂时位置，依其当前落点接驳邻近岛屿；拖动会重选邻岛。
    for(const n of nodes) {
      if(unrouteable.has(n.id) || !at(n) || (navigable(n) && !n.parentId)) continue;
      if(n.parentId && at(byId.get(n.parentId))) {
        add(n.parentId,n.id,{line:n.id==='04-04'?'角度接引':n.id==='07-01'?'穹顶通道':'地点内部',kind:portalAccess.has(n.id)?'portal':'access'});
        continue;
      }
      const near=places.map(p=>({id:p.id,d:distance(at(n),at(p))}))
        .sort((a,b)=>a.d-b.d || a.id.localeCompare(b.id));
      const exits=n.kind==='船只'?2:1;
      for(const candidate of near.slice(0,exits))
        add(candidate.id,n.id,{line:n.kind==='船只'?'船只接驳':'区域接驳',
          kind:n.kind==='船只'?'vessel':nonMarine.has(n.id)?'portal':'access'});
    }
    cachedSignature=signature;cachedEdges=out;
    return out;
  }
  function edges(allowInferred=false) {return build().filter(e=>allowInferred || !e.inferred);}
  function better(a,b) {
    if(!b) return true;
    for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return a[i]<b[i];
    return false;
  }
  function route(from,to,allowed,allowInferred=false) {
    if(from===to || !allowed.has(from) || !allowed.has(to)) return null;
    const all=edges(allowInferred);
    // 用户选中一段已有航程时使用该航次；其他目的地由全图相邻路网寻路。
    const direct=all.find(e=>e.documented && key(e.a,e.b)===key(from,to));
    // If a chain of recorded voyages exists, honor it instead of replacing it
    // with an invented cheap shortcut through painted neighboring islands.
    const recorded=new Set([from]),pendingRecorded=[from];
    while(pendingRecorded.length) {
      const id=pendingRecorded.pop();
      for(const e of all) {
        if(!e.documented || !allowed.has(e.a) || !allowed.has(e.b)) continue;
        const next=e.a===id?e.b:e.b===id?e.a:null;
        if(next && !recorded.has(next)) {recorded.add(next);pendingRecorded.push(next);}
      }
    }
    const candidates=recorded.has(to)?all.filter(e=>e.documented):all;
    const graph=new Map();
    for(const e of candidates) {
      if(!allowed.has(e.a) || !allowed.has(e.b)) continue;
      for(const [src,dst,reverse] of [[e.a,e.b,false],[e.b,e.a,true]]) {
        if(!graph.has(src)) graph.set(src,[]);
        graph.get(src).push({dst,edge:e,reverse});
      }
    }
    const leg=(at,dst,e,reverse)=>({from:at,to:dst,line:e.line,kind:e.kind,
      inferred:e.inferred,measure:e.measure,points:e.points?(reverse?[...e.points].reverse():e.points):null});
    if(direct && allowed.has(direct.a) && allowed.has(direct.b))
      return [leg(from,to,direct,from!==direct.a)];
    const endpointParents=new Set();
    for(const id of [from,to]) {
      let parent=byId.get(id)?.parentId;
      while(parent) {endpointParents.add(parent);parent=byId.get(parent)?.parentId;}
    }
    const best=new Map([[from,[0,0,0]]]),previous=new Map(),pending=new Set([from]);
    while(pending.size) {
      const current=[...pending].reduce((a,b)=>better(best.get(a),best.get(b))?a:b);
      pending.delete(current);
      if(current===to) break;
      if(current!==from && terminals.has(current) && !endpointParents.has(current)) continue; // ships/subnodes are destinations, not teleport shortcuts
      for(const step of graph.get(current)||[]) {
        const e=step.edge;
        // Geometry establishes connectivity only; mileage stays independent of the painted map.
        const cost=e.measure?.nauticalMiles ?? 200;
        const score=best.get(current).map((v,i)=>v+[e.inferred?1:0,cost,1][i]);
        if(better(score,best.get(step.dst))) {
          best.set(step.dst,score);previous.set(step.dst,{at:current,...step});pending.add(step.dst);
        }
      }
    }
    if(!best.has(to)) return null;
    const legs=[];
    for(let cursor=to;cursor!==from;) {
      const step=previous.get(cursor);
      if(!step) return null;
      legs.push(leg(step.at,cursor,step.edge,step.reverse));cursor=step.at;
    }
    return legs.reverse();
  }
  window.EARTHSEA_NET={edges,route};
})();













