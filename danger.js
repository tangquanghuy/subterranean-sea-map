(() => {
  'use strict';
  const roman=['0','I','II','III','IV','V','VI'];
  const level=text=>{
    const match=String(text||'').match(/([0-6])\s*级/);
    return match?Number(match[1]):null;
  };
  const tone=n=>n==null?'unrated':n===6?'extreme':n>=4?'high':n>=2?'medium':'low';
  function label(name){return name;}
  function pin(element,name,text,locked=false){
    const n=locked?null:level(text);
    element.dataset.danger=locked?'':tone(n);
    const nameElement=element.querySelector('.pin-label,.expedition-pin-label,span');
    if(nameElement)nameElement.textContent=label(name,n);
  }
  function card(title,badge,name,text,locked=false){
    const n=locked?null:level(text);
    title.dataset.danger=locked?'':tone(n);
    title.textContent=name;
    if(n===6){
      const skull=document.createElement('span');
      skull.className='danger-skull';
      skull.setAttribute('role','img');skull.setAttribute('aria-label','六级危险');
      title.append(skull);
    }
    badge.hidden=locked||!text;
    badge.dataset.danger=tone(n);
    badge.innerHTML=n==null?'<small>危险等级</small><strong>—</strong>':`<small>危险等级</small><strong>${roman[n]}</strong>`;
    badge.title=locked?'':String(text||'');
  }
  window.EARTHSEA_DANGER={level,tone,label,pin,card};
})();
