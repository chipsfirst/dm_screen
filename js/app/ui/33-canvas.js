/* Свободный холст: режим доски, панорама и масштаб. */
(function(){
  const canvas = document.getElementById('canvas');
  const toggle = document.getElementById('canvasFreeToggle');
  const zoomBar = document.getElementById('canvasZoomBar');
  const zoomVal = document.getElementById('canvasZoomVal');
  const minimap = document.getElementById('canvasMinimap');
  const miniCards = document.getElementById('canvasMinimapCards');
  const miniView = document.getElementById('canvasMinimapView');
  const linkModal = document.getElementById('linkModal');
  const linkLabel = document.getElementById('linkLabel');
  const linkType = document.getElementById('linkType');
  const linkSave = document.getElementById('linkSave');
  const linkDelete = document.getElementById('linkDelete');
  const linkClose = document.getElementById('linkClose');
  let linkEdit = null;
  if(!canvas || !toggle) return;
  const MODE_KEY = 'shirma_canvas_free_v1';
  const ZOOM_KEY = 'shirma_canvas_zoom_v1';
  let zoom = 1;
  const selected = new Set();
  try{
    const z = +localStorage.getItem(ZOOM_KEY);
    if(Number.isFinite(z) && z >= 0.5 && z <= 1.5) zoom = z;
  }catch(e){}

  function editable(el){
    return !!(el && (el.matches('input,textarea,select') || el.isContentEditable));
  }
  function sync(){
    toggle.setAttribute('aria-pressed', freeLayout ? 'true' : 'false');
    toggle.classList.toggle('on', freeLayout);
    if(zoomBar) zoomBar.hidden = !freeLayout;
    if(zoomVal) zoomVal.textContent = Math.round(zoom * 100) + '%';
    document.querySelectorAll('.canvas-cols').forEach(el=>{ el.style.display = freeLayout ? 'none' : ''; });
    if(minimap) minimap.hidden = !freeLayout;
  }
  function applyZoom(){
    canvas.style.zoom = freeLayout ? String(zoom) : '';
    sync();
    scheduleLinks();
    drawMinimap();
    try{ localStorage.setItem(ZOOM_KEY, String(zoom)); }catch(e){}
  }
  function setZoom(z){
    zoom = Math.max(0.5, Math.min(1.5, Math.round(z * 100) / 100));
    applyZoom();
  }
  function setMode(free){
    freeLayout = !!free;
    try{ localStorage.setItem(MODE_KEY, freeLayout ? '1' : '0'); }catch(e){}
    if(typeof render === 'function') render();
    applyZoom();
  }

  function drawLinks(){
    const svg = document.getElementById('canvasLinks');
    if(!svg || !freeLayout || typeof blocks === 'undefined') return;
    const wraps = [...canvas.querySelectorAll('.canvas-free-wrap')];
    const byId = new Map();
    wraps.forEach(w=>{
      const el = w.querySelector('.block[data-id]');
      if(el) byId.set(el.dataset.id, w);
    });
    let maxX = 800, maxY = 600;
    wraps.forEach(w=>{
      maxX = Math.max(maxX, w.offsetLeft + w.offsetWidth + 200);
      maxY = Math.max(maxY, w.offsetTop + w.offsetHeight + 200);
    });
    svg.setAttribute('width', maxX);
    svg.setAttribute('height', maxY);
    svg.innerHTML = '';
    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    defs.innerHTML = '<marker id="canvasArrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker>';
    svg.appendChild(defs);
    const byTitle = new Map();
    blocks.forEach(b=>{ if(b.title) byTitle.set(String(b.title), b); });
    const targetWrap = (id)=>{
      const b = blocks.find(x=>String(x.id) === String(id)) || byTitle.get(String(id));
      return b ? byId.get(String(b.id)) : null;
    };
    const seen = new Set();
    blocks.forEach(b=>{
      (Array.isArray(b.links) ? b.links : []).forEach(id=>{
        const a = byId.get(String(b.id));
        const c = targetWrap(id);
        if(!a || !c) return;
        const key = [String(b.id), String(id)].sort().join('|');
        if(seen.has(key)) return;
        seen.add(key);
        const ay = a.offsetTop + Math.min(32, a.offsetHeight / 3);
        const by = c.offsetTop + Math.min(32, c.offsetHeight / 3);
        const aright = (a.offsetLeft + a.offsetWidth / 2) <= (c.offsetLeft + c.offsetWidth / 2);
        const ax = aright ? a.offsetLeft + a.offsetWidth : a.offsetLeft;
        const bx = aright ? c.offsetLeft : c.offsetLeft + c.offsetWidth;
        const dx = Math.max(50, Math.abs(bx - ax) * 0.4);
        const path = document.createElementNS(ns, 'path');
        path.setAttribute('d', `M ${ax} ${ay} C ${ax + (aright ? dx : -dx)} ${ay}, ${bx + (aright ? -dx : dx)} ${by}, ${bx} ${by}`);
        const meta = (b.linkMeta && b.linkMeta[String(id)]) || {};
        const type = meta.type || 'link';
        path.setAttribute('marker-end', 'url(#canvasArrow)');
        path.setAttribute('data-type', type);
        path.dataset.src = String(b.id);
        path.dataset.link = String(id);
        svg.appendChild(path);
        if(meta.label){
          const tx = document.createElementNS(ns, 'text');
          tx.setAttribute('x', String((ax + bx) / 2));
          tx.setAttribute('y', String((ay + by) / 2 - 5));
          tx.setAttribute('text-anchor', 'middle');
          tx.setAttribute('class', 'canvas-link-label');
          tx.setAttribute('data-type', type);
          tx.textContent = meta.label;
          svg.appendChild(tx);
        }
      });
    });
  }
  function applySelection(){
    canvas.querySelectorAll('.canvas-free-wrap').forEach(w=>{
      const el = w.querySelector('.block[data-id]');
      w.classList.toggle('selected', !!(el && selected.has(el.dataset.id)));
    });
  }
  function decoratePorts(){
    if(!freeLayout) return;
    canvas.querySelectorAll('.canvas-free-wrap').forEach(w=>{
      const block = w.querySelector('.block[data-id]');
      if(!block || block.querySelector('.canvas-port')) return;
      ['in', 'out'].forEach(side=>{
        const port = document.createElement('span');
        port.className = 'canvas-port ' + side;
        port.dataset.port = side;
        port.title = side === 'out' ? 'Потяните, чтобы создать связь' : 'Входящая связь';
        block.appendChild(port);
      });
    });
    applySelection();
  }
  function addLink(sourceId, targetId){
    const b = blocks.find(x=>String(x.id) === String(sourceId));
    const t = blocks.find(x=>String(x.id) === String(targetId));
    if(!b || !t || b === t) return;
    if(!Array.isArray(b.links)) b.links = [];
    if(b.links.some(x=>String(x) === String(targetId) || x === t.title)) return;
    b.links.push(t.id);
    if(typeof save === 'function') save();
    if(typeof render === 'function') render();
  }
  function startLink(e, port){
    const block = port.closest('.block');
    const sourceId = block && block.dataset.id;
    const svg = document.getElementById('canvasLinks');
    if(!sourceId || !svg) return;
    const ns = 'http://www.w3.org/2000/svg';
    const temp = document.createElementNS(ns, 'path');
    temp.setAttribute('class', 'canvas-link-temp');
    svg.appendChild(temp);
    const cr = canvas.getBoundingClientRect();
    const pr = port.getBoundingClientRect();
    const x1 = (pr.left + pr.width / 2 - cr.left) / zoom + canvas.scrollLeft;
    const y1 = (pr.top + pr.height / 2 - cr.top) / zoom + canvas.scrollTop;
    const move = ev=>{
      const x2 = (ev.clientX - cr.left) / zoom + canvas.scrollLeft;
      const y2 = (ev.clientY - cr.top) / zoom + canvas.scrollTop;
      const dx = Math.max(40, Math.abs(x2 - x1) * 0.4);
      temp.setAttribute('d', `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`);
    };
    const up = ev=>{
      document.removeEventListener('mousemove', move);
      document.removeEventListener('mouseup', up);
      temp.remove();
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const target = hit && hit.closest('.canvas-free-wrap');
      const targetEl = target && target.querySelector('.block[data-id]');
      if(targetEl) addLink(sourceId, targetEl.dataset.id);
    };
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', up);
  }
  function scheduleLinks(){ decoratePorts(); drawLinks(); drawMinimap(); requestAnimationFrame(()=>{ decoratePorts(); drawLinks(); drawMinimap(); }); }
  function drawMinimap(){
    if(!minimap) return;
    if(!freeLayout){ minimap.hidden = true; return; }
    const wraps = [...canvas.querySelectorAll('.canvas-free-wrap')];
    if(!wraps.length){ minimap.hidden = true; return; }
    const sw = Math.max(1, canvas.scrollWidth), sh = Math.max(1, canvas.scrollHeight);
    if(miniCards){
      miniCards.innerHTML = wraps.map(w=>{
        return `<span class="cm-card" style="left:${w.offsetLeft/sw*100}%;top:${w.offsetTop/sh*100}%;width:${Math.max(3,w.offsetWidth/sw*100)}%;height:${Math.max(3,w.offsetHeight/sh*100)}%"></span>`;
      }).join('');
    }
    if(miniView){
      miniView.style.left = (canvas.scrollLeft/sw*100)+'%';
      miniView.style.top = (canvas.scrollTop/sh*100)+'%';
      miniView.style.width = Math.min(100,canvas.clientWidth/sw*100)+'%';
      miniView.style.height = Math.min(100,canvas.clientHeight/sh*100)+'%';
    }
    minimap.hidden = false;
  }
  function jumpMini(e){
    if(!minimap) return;
    const r = minimap.getBoundingClientRect();
    if(!r.width || !r.height) return;
    canvas.scrollLeft = ((e.clientX-r.left)/r.width) * canvas.scrollWidth - canvas.clientWidth/2;
    canvas.scrollTop = ((e.clientY-r.top)/r.height) * canvas.scrollHeight - canvas.clientHeight/2;
    drawMinimap();
  }
  function fitAll(){
    const wraps = [...canvas.querySelectorAll('.canvas-free-wrap')];
    if(!wraps.length) return;
    let maxX=1,maxY=1;
    wraps.forEach(w=>{ maxX=Math.max(maxX,w.offsetLeft+w.offsetWidth+60); maxY=Math.max(maxY,w.offsetTop+w.offsetHeight+60); });
    const z = Math.min(1, (canvas.clientWidth-40)/maxX, (canvas.clientHeight-40)/maxY);
    setZoom(Math.max(0.5,z));
    setTimeout(()=>{ canvas.scrollLeft=0; canvas.scrollTop=0; drawMinimap(); }, 60);
  }


  function openLinkEditor(src, link){
    const b = blocks.find(x=>String(x.id) === String(src));
    if(!b || !linkModal) return;
    linkEdit = { b, link:String(link) };
    const meta = (b.linkMeta && b.linkMeta[String(link)]) || {};
    if(linkLabel) linkLabel.value = meta.label || '';
    if(linkType) linkType.value = meta.type || 'link';
    openModal(linkModal, document.activeElement);
  }
  function saveLinkEditor(){
    if(!linkEdit) return;
    if(!linkEdit.b.linkMeta) linkEdit.b.linkMeta = {};
    const label = linkLabel ? linkLabel.value.trim().slice(0,48) : '';
    const type = linkType ? linkType.value : 'link';
    if(label || type !== 'link') linkEdit.b.linkMeta[linkEdit.link] = { label, type };
    else delete linkEdit.b.linkMeta[linkEdit.link];
    if(typeof save === 'function') save();
    closeModal(linkModal);
    render();
  }
  function deleteLinkEditor(){
    if(!linkEdit) return;
    linkEdit.b.links = (linkEdit.b.links || []).filter(x=>String(x) !== linkEdit.link);
    if(linkEdit.b.linkMeta) delete linkEdit.b.linkMeta[linkEdit.link];
    if(typeof save === 'function') save();
    closeModal(linkModal);
    render();
  }

  window.canvasSelected = selected;
  window.drawCanvasLinks = drawLinks;
  window.canvasZoomFactor = ()=> freeLayout ? zoom : 1;
  window.setCanvasMode = setMode;

  toggle.addEventListener('click', ()=> setMode(!freeLayout));
  document.getElementById('canvasZoomOut')?.addEventListener('click', ()=> setZoom(zoom - 0.1));
  document.getElementById('canvasZoomIn')?.addEventListener('click', ()=> setZoom(zoom + 0.1));
  document.getElementById('canvasZoomFit')?.addEventListener('click', fitAll);
  document.getElementById('canvasZoomReset')?.addEventListener('click', ()=>{
    canvas.scrollTo({ left:0, top:0, behavior:'smooth' });
    setZoom(1);
  });
  canvas.addEventListener('wheel', e=>{
    if(!freeLayout || !e.ctrlKey) return;
    e.preventDefault();
    setZoom(zoom + (e.deltaY < 0 ? 0.1 : -0.1));
  }, { passive:false });

  let miniDown = false;
  if(minimap){
    minimap.addEventListener('pointerdown', e=>{ miniDown=true; e.preventDefault(); jumpMini(e); if(minimap.setPointerCapture) minimap.setPointerCapture(e.pointerId); });
    window.addEventListener('pointermove', e=>{ if(miniDown) jumpMini(e); });
    window.addEventListener('pointerup', ()=>{ miniDown=false; });
  }
  canvas.addEventListener('scroll', drawMinimap, {passive:true});

  let space = false;
  document.addEventListener('keydown', e=>{
    if(e.code !== 'Space' || editable(e.target) || !freeLayout) return;
    if(document.getElementById('view-chars')?.hidden) return;
    space = true;
    e.preventDefault();
  });
  document.addEventListener('keyup', e=>{ if(e.code === 'Space') space = false; });

  canvas.addEventListener('pointerdown', e=>{
    if(!freeLayout) return;
    const port = e.target.closest('.canvas-port');
    if(port){ e.preventDefault(); e.stopPropagation(); startLink(e, port); return; }
    if(e.target.closest('.block')) return;
    if(!(e.button === 1 || e.altKey || space)) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    const sl = canvas.scrollLeft, st = canvas.scrollTop;
    canvas.classList.add('panning');
    if(canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    const move = ev=>{
      canvas.scrollLeft = sl - (ev.clientX - sx);
      canvas.scrollTop = st - (ev.clientY - sy);
    };
    const up = ()=>{
      canvas.classList.remove('panning');
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
    };
    canvas.addEventListener('pointermove', move);
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  });

  canvas.addEventListener('click', e=>{
    const linkPath = e.target.closest && e.target.closest('#canvasLinks path[data-src]');
    if(linkPath){
      openLinkEditor(linkPath.dataset.src, linkPath.dataset.link);
      return;
    }
    if(!freeLayout || !e.shiftKey) return;
    const w = e.target.closest('.canvas-free-wrap');
    const el = w && w.querySelector('.block[data-id]');
    if(!el) return;
    if(selected.has(el.dataset.id)) selected.delete(el.dataset.id); else selected.add(el.dataset.id);
    applySelection();
  });

  if(linkSave) linkSave.addEventListener('click', saveLinkEditor);
  if(linkDelete) linkDelete.addEventListener('click', deleteLinkEditor);
  if(linkClose) linkClose.addEventListener('click', ()=> closeModal(linkModal));
  if(linkModal) linkModal.addEventListener('click', e=>{ if(e.target === linkModal) closeModal(linkModal); });

  let initial = false;
  try{ initial = localStorage.getItem(MODE_KEY) === '1'; }catch(e){}
  if(initial){
    freeLayout = true;
    if(typeof render === 'function') render();
  }
  applyZoom();
  document.addEventListener('mouseup', ()=> setTimeout(drawLinks, 30));
  window.addEventListener('resize', scheduleLinks);
  if(typeof MutationObserver !== 'undefined'){
    new MutationObserver(scheduleLinks).observe(canvas, { childList:true });
  }
})();
