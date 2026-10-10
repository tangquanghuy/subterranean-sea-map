(() => {
  'use strict';
  let injected = null, locationOnly = null, lastSignature = '';
  let hostState = false;
  const listeners = new Set();
  const direct = () => {
    try { return typeof window.getMessageVar === 'function' ? window.getMessageVar('stat_data', {defaults:{}}) || {} : {}; }
    catch (_) { return {}; }
  };
  const data = () => injected || direct();
  const location = () => locationOnly || data()?.世界信息?.位置 || {};
  const label = () => {
    const loc = location();
    return [loc.区域, loc.场所].filter(Boolean).join(' · ') || loc.大陆 || '位置未载入';
  };
  const norm = s => String(s || '').replace(/[\s·・—–_\-（）()【】]/g,'').replace(/(篇|港口|码头|外档)$/g,'');
  // Ground truth is MVU's location string, never the painted coordinate or a picked origin.
  function resolve(entries) {
    const loc=location(), parts=[loc.场所,loc.区域].flatMap(value=>String(value||'').split(/[·・›>／/\|]/).reverse());
    const ranked=[];
    for (const [id,name,aliases=[]] of entries) {
      for (const term of [name,...aliases]) {
        const needle=norm(term); if(!needle || needle.length<2)continue;
        parts.forEach((piece,index)=>{
          const value=norm(piece);
          if (!value) return;
          if(value===needle) ranked.push({id,score:1000+needle.length*4-index*100});
          else if(value.includes(needle) && needle.length>=3)ranked.push({id,score:needle.length*4-index*100});
        });
      }
    }
    ranked.sort((a,b)=>b.score-a.score);
    return ranked[0]?.id || null;
  }
  function notify() { for(const fn of listeners) fn(); }
  function setState(value) {
    if (!value || typeof value !== 'object')return;
    injected=value.stat_data || value;
    hostState=true;locationOnly=null;notify();
  }
  function onChange(fn) { listeners.add(fn);fn();return () => listeners.delete(fn); }
  window.addEventListener('message',event => {
    if(event.source !== window.parent || !event.data)return;
    if(event.data.type==='earthsea_state')setState(event.data.stat_data);
    else if(event.data.type==='mvu_location' && event.data.位置 && !hostState){locationOnly=event.data.位置;notify();}
  });
  // Read local MVU live when the map itself runs in the same context as the host.
  setInterval(()=>{
    if(hostState || document.hidden)return;
    const current=direct();
    const signature=JSON.stringify([current?.世界信息?.位置,current?.世界信息?.大事件,current?.人物?.背包?.道具]);
    if(signature!==lastSignature){lastSignature=signature;notify();}
  },1000);
  function travelDays(legs, dailyMiles=75){
    return legs.reduce((total,leg)=>{
      const measure=leg.measure||{};
      const days=Number(measure.days);
      if(days>0)return total+days;
      const duration=String(measure.duration||'');
      const annotated=duration.match(/(\d+)\s*(?:天|日)/);
      if(annotated)return total+Number(annotated[1]);
      if(duration.includes('月余'))return total+35;
      if(duration.includes('数日'))return total+4;
      return total+(leg.kind==='portal' ? 0.1 : (Number(measure.nauticalMiles)||0)/dailyMiles);
    },0);
  }
  function depart(detail){
    if(window.parent!==window)window.parent.postMessage({type:'earthsea_depart',originLocation:location(),...detail},'*');
    else window.dispatchEvent(new CustomEvent('earthsea:depart',{detail}));
  }
  window.EARTHSEA_RUNTIME={data,location,label,norm,resolve,onChange,setState,travelDays,depart};
  if(window.parent!==window){
    let attempts=0;
    const ready=()=>window.parent.postMessage({type:'map_ready',map:'earthsea',layer:window.location.pathname.split('/').pop()},'*');
    ready();
    const retry=setInterval(()=>{if(hostState || ++attempts>12){clearInterval(retry);return;}ready();},500);
  }
})();