// A textured map-wide fog, following match-3's canvas mask: uncovered sites
// open clear windows through the cloud. Pins live above this layer and keep their colors.
(() => {
  'use strict';
  window.EARTHSEA_FOG = function (container, size=4096) {
    const canvas=document.createElement('canvas');
    canvas.className='discovery-fog';
    canvas.setAttribute('aria-hidden','true');
    canvas.width=canvas.height=Math.round(size/4);
    canvas.style.width=canvas.style.height=size+'px';
    container.prepend(canvas);
    const ctx=canvas.getContext('2d');
    const texture=new Image();
    let openings=[];
    function render() {
      if (!ctx) return;
      const w=canvas.width,h=canvas.height,k=w/size;
      ctx.globalCompositeOperation='source-over';
      ctx.clearRect(0,0,w,h);
      if (openings === null) return;
      if (texture.complete && texture.naturalWidth) {
        // One cover-sized image, not repeated tiles: no seams when panning.
        const cover=Math.max(w/texture.naturalWidth,h/texture.naturalHeight);
        const tw=texture.naturalWidth*cover,th=texture.naturalHeight*cover;
        ctx.drawImage(texture,(w-tw)/2,(h-th)/2,tw,th);
      } else {
        ctx.fillStyle='#859399';ctx.fillRect(0,0,w,h);
      }
      ctx.fillStyle='rgba(10,19,26,.48)';
      ctx.fillRect(0,0,w,h);
      ctx.globalCompositeOperation='destination-out';
      for(const {x,y,radius=425} of openings){
        const cx=x*k,cy=y*k,r=radius*k;
        const hole=ctx.createRadialGradient(cx,cy,0,cx,cy,r);
        hole.addColorStop(0,'rgba(0,0,0,1)');
        hole.addColorStop(.53,'rgba(0,0,0,1)');
        hole.addColorStop(1,'rgba(0,0,0,0)');
        ctx.fillStyle=hole;
        ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fill();
      }
      ctx.globalCompositeOperation='source-over';
    }
    texture.onload=render;
    texture.src='assets/map-fog.webp';
    return {canvas,paint(points){openings=points;render()}};
  };
})();
