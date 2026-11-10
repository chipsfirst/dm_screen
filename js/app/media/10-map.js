/* ═══ Выбор персонажа/монстра для карты ═══ */
const mapPickModal = document.getElementById('mapPickModal');
const mapPickSearch = document.getElementById('mapPickSearch');
const mapPickResults = document.getElementById('mapPickResults');

function renderMapPicker(){
  if(!mapPickResults) return;
  const q = normalizeLib(mapPickSearch ? mapPickSearch.value : '');
  const rows = [];
  const party = (blocks||[]).filter(b=>b.type==='pc'||b.type==='mob');
  party.forEach(b=>{
    const kind = b.type==='mob' ? 'Монстр' : 'Персонаж';
    if(q && !normalizeLib((b.title||'')+' '+kind).includes(q)) return;
    rows.push(`<div class="lib-row" data-pick-block="${b.id}">
      <span class="lib-kind k-item">${escapeHtml(kind)}</span>
      <div class="lib-main"><div class="lib-title">${escapeHtml(b.title||'Без имени')}</div>
        <div class="lib-meta">с ширмы</div></div>
      <span class="lib-add">＋</span></div>`);
  });
  (bestAll||[]).slice(0, 600).forEach(m=>{
    if(q && !normalizeLib((m.n||'')+' '+(m.en||'')+' монстр').includes(q)) return;
    rows.push(`<div class="lib-row" data-pick-best="${m.id}">
      <span class="lib-kind k-rule">${escapeHtml(shortCr(m.cr))}</span>
      <div class="lib-main"><div class="lib-title">${escapeHtml(m.n)}</div>
        <div class="lib-meta">Бестиарий · ${escapeHtml(m.type||'')}</div></div>
      <span class="lib-add">＋</span></div>`);
  });
  mapPickResults.innerHTML = rows.length ? rows.join('') : '<div class="lib-empty">Ничего не найдено.</div>';
  mapPickResults.querySelectorAll('[data-pick-block]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const b = (blocks||[]).find(x=>x.id===el.dataset.pickBlock);
      if(b) addBlockToMap(b);
      closeModal(mapPickModal);
    });
  });
  mapPickResults.querySelectorAll('[data-pick-best]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const m = (bestAll||[]).find(x=>x.id==el.dataset.pickBest);
      if(m) addMarkerFromMonster(m);
      closeModal(mapPickModal);
    });
  });
}
function openMapPicker(){
  if(!mapPickModal) return;
  openModal(mapPickModal, document.getElementById('mapAddToken'));
  if(mapPickSearch) mapPickSearch.value='';
  if(bestAll && bestAll.length){ renderMapPicker(); }
  else if(window.BESTIARY && window.BESTIARY.length){ bestAll = window.BESTIARY.slice().concat(BOOKS_CREATURES); renderMapPicker(); }
  else { renderMapPicker(); ensureBestiary().then(()=>{ bestAll = (window.BESTIARY||[]).slice().concat(BOOKS_CREATURES); renderMapPicker(); }).catch(()=>{}); }
}
if(mapPickModal){
  document.getElementById('mapAddToken')?.addEventListener('click', openMapPicker);
  document.getElementById('mapPickClose')?.addEventListener('click', ()=> closeModal(mapPickModal));
  mapPickModal.addEventListener('click', e=>{ if(e.target===mapPickModal) closeModal(mapPickModal); });
  mapPickSearch?.addEventListener('input', debounce(renderMapPicker, 120));
}

function addMapMarker(){
  // включить/выключить режим расстановки маркеров кликом
  mapPlaceOn = !mapPlaceOn;
  const hint=document.getElementById('mapPlaceHint'); if(hint) hint.hidden = !mapPlaceOn;
  const btn=document.getElementById('mapAddMarker'); if(btn) btn.classList.toggle('active', !!mapPlaceOn);
  if(mapPlaceOn) toast('Кликните по карте, чтобы поставить маркер');
}
function markerLinkedBlock(m,k){
  if(!k || !k.blockId) return null;
  return (blocks||[]).find(b=>b.id===k.blockId) || null;
}
function focusBlockOnScreen(b){
  if(!b) return;
  showTab('chars');
  requestAnimationFrame(()=>{
    const el=document.getElementById('canvas').querySelector('[data-id="'+b.id+'"]');
    if(!el) return;
    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.classList.add('flash');
    setTimeout(()=>el.classList.remove('flash'), 1600);
  });
}
function openMarkerNote(m,k){
  const b=markerLinkedBlock(m,k);
  if(!b){ toast('У метки ещё нет заметки'); return; }
  focusBlockOnScreen(b);
}
function showMapNoteTip(el,m,k){
  const b=markerLinkedBlock(m,k);
  const tip=document.getElementById('mapNoteTip');
  if(!b || !tip) return;
  const text=String(b.text||'').trim();
  tip.innerHTML='<div class="mnt-title">'+escapeHtml(b.title||k.label)+'</div>'+
    '<div class="mnt-text">'+escapeHtml(text.length>500?text.slice(0,500)+'…':text)+'</div>'+
    '<div class="mnt-foot">Клик — открыть заметку на ширме</div>';
  tip.hidden=false;
  const r=el.getBoundingClientRect();
  const tr=tip.getBoundingClientRect();
  let left=r.left+r.width/2-tr.width/2;
  let top=r.top-tr.height-12;
  if(top<8) top=r.bottom+12;
  left=Math.max(8,Math.min(left, window.innerWidth-tr.width-8));
  top=Math.max(8,Math.min(top, window.innerHeight-tr.height-8));
  tip.style.left=left+'px';
  tip.style.top=top+'px';
}
function hideMapNoteTip(){
  const tip=document.getElementById('mapNoteTip');
  if(tip) tip.hidden=true;
}
function markerNoteAction(m,k){
  if(!m||!k) return;
  let b=markerLinkedBlock(m,k);
  if(!b){
    b=makeBlock('rule', k.label||'Метка');
    b.text='Метка на карте «'+(m.name||'Карта')+'».\n\n';
    blocks.push(b);
    k.blockId=b.id;
    save(); saveMap();
    toast('Заметка создана на ширме');
  }
  focusBlockOnScreen(b);
}
async function placeMarkerAt(x,y){
  const m=curMap(); if(!m) return;
  const label=await uiPrompt('Подпись метки:','Метка'); if(label===null) return;
  const k={ id:'k'+Math.random().toString(36).slice(2,7), x:x, y:y,
    label:(label.trim()||'Метка').slice(0,40), color:'#7fb3e6' };
  m.markers.push(k);
  mapPlaceOn=false;
  const hint=document.getElementById('mapPlaceHint'); if(hint) hint.hidden=true;
  const btn=document.getElementById('mapAddMarker'); if(btn) btn.classList.remove('active');
  selectedMarkerId=k.id;
  saveMap(); renderMap();
}
async function renameMap(id){
  const m=maps.find(x=>x.id===id); if(!m) return;
  const t=await uiPrompt('Название карты:',m.name); if(t===null) return;
  m.name=(t.trim()||'Карта').slice(0,40); saveMap(); renderMap();
}
function mapRulerToggle(){
  mapRulerOn=!mapRulerOn; rulerPt=null;
  const b=document.getElementById('mapRuler'); if(b) b.classList.toggle('active', !!mapRulerOn);
  const l=document.getElementById('mapRulerLabel'); if(l){ l.hidden=!mapRulerOn; l.textContent=mapRulerOn?'Клик №1…':''; }
  if(mapRulerOn) toast('Линейка: кликните начало, затем конец');
}
function mapDuplicate(){
  const m=curMap(); if(!m) return;
  const cp=normMap({ id:'m'+Math.random().toString(36).slice(2,8), name:(m.name||'Карта')+' (копия)',
    bgKey:m.bgKey, bg:m.bg, baseW:m.baseW, baseH:m.baseH, zoom:m.zoom, scrollX:m.scrollX, scrollY:m.scrollY,
    markers:m.markers.map(k=>({...k,id:'k'+Math.random().toString(36).slice(2,7)})),
    draw:m.draw.map(s=>({color:s.color,width:s.width,pts:s.pts.map(p=>[p[0],p[1]])})) });
  maps.push(cp); activeMapId=cp.id; saveMap(); renderMap(); toast('Карта дублирована');
}
function mapSnapPNG(){
  const m=curMap(); if(!m) return;
  const cv=document.createElement('canvas'); cv.width=m.baseW; cv.height=m.baseH;
  const ctx=cv.getContext('2d');
  if(m.bgKey&&mediaCache[m.bgKey]){ const im=new Image(); im.onload=()=>{ drawSnap(im); }; im.src=mediaCache[m.bgKey]; }
  else drawSnap(null);
  function drawSnap(bg){
    if(bg) ctx.drawImage(bg,0,0,cv.width,cv.height);
    (m.draw||[]).forEach(s=>{ if(!s.pts||s.pts.length<2) return; ctx.strokeStyle=s.color; ctx.lineWidth=s.width; ctx.lineCap='round';
      ctx.beginPath(); s.pts.forEach((p,i)=> i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1])); ctx.stroke(); });
    (m.markers||[]).forEach(k=>{ ctx.beginPath(); ctx.fillStyle=k.color; ctx.arc(k.x,k.y,10,0,Math.PI*2); ctx.fill(); ctx.strokeStyle='#111'; ctx.lineWidth=1; ctx.stroke(); });
    cv.toBlob(b=>{ saveFile((m.name||'карта')+'.png', b, 'image/png'); });
  }
}
function mapClearDraw(){
  const m=curMap(); if(!m) return;
  if(m.draw.length){ uiConfirm('Стереть нарисованное с карты?').then(ok=>{ if(ok){ m.draw=[]; saveMap(); renderMap(); } }); }
}

/* ── Библиотека комнат и пресеты подземелий ── */
const MAP_ROOM_LIB=[
  { id:'room4',  name:'Комната 4×4',   w:4, h:4, k:'room' },
  { id:'room6',  name:'Комната 6×4',   w:6, h:4, k:'room' },
  { id:'hall86', name:'Зал 8×6',       w:8, h:6, k:'room' },
  { id:'hallC',  name:'Круглый зал 6', w:6, h:6, k:'hall' },
  { id:'corrH',  name:'Коридор 6×1',   w:6, h:1, k:'corr' },
  { id:'corrV',  name:'Коридор 1×6',   w:1, h:6, k:'corr' },
  { id:'room3',  name:'Комната 3×3',   w:3, h:3, k:'room' }
];
const MAP_DUNGEON_LIB=[
  { id:'triple', name:'Три комнаты', items:[
    { k:'room', x:0, y:0, w:5, h:4 },
    { k:'corr', x:5, y:1.5, w:2, h:1 },
    { k:'room', x:7, y:0, w:5, h:4 },
    { k:'corr', x:9, y:4, w:1, h:3 },
    { k:'room', x:7, y:7, w:5, h:4 }
  ]},
  { id:'cross', name:'Крест', items:[
    { k:'hall', x:4, y:4, w:6, h:6 },
    { k:'corr', x:6.5, y:0, w:1, h:4 },
    { k:'corr', x:6.5, y:10, w:1, h:4 },
    { k:'corr', x:0, y:6.5, w:4, h:1 },
    { k:'corr', x:10, y:6.5, w:4, h:1 },
    { k:'room', x:5, y:-3, w:4, h:3 },
    { k:'room', x:5, y:14, w:4, h:3 },
    { k:'room', x:-4, y:5.5, w:4, h:3 },
    { k:'room', x:14, y:5.5, w:4, h:3 }
  ]},
  { id:'chain', name:'Анфилада', items:[
    { k:'room', x:0, y:0, w:4, h:4 },
    { k:'corr', x:4, y:1.5, w:3, h:1 },
    { k:'room', x:7, y:0, w:4, h:4 },
    { k:'corr', x:8.5, y:4, w:1, h:3 },
    { k:'hall', x:6, y:7, w:6, h:6 },
    { k:'corr', x:11, y:9.5, w:3, h:1 },
    { k:'room', x:14, y:8, w:4, h:4 }
  ]}
];
function presetItems(p){
  return p.items ? p.items : [{ k:p.k, x:0, y:0, w:p.w, h:p.h }];
}
function presetBBox(items){
  let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
  items.forEach(it=>{
    x1=Math.min(x1,it.x); y1=Math.min(y1,it.y);
    x2=Math.max(x2,it.x+it.w); y2=Math.max(y2,it.y+it.h);
  });
  return { x:x1, y:y1, w:Math.max(1,x2-x1), h:Math.max(1,y2-y1) };
}
function presetColor(kind){ return kind==='corr' ? '#c0564f' : (kind==='hall' ? '#7fb3e6' : '#c9a227'); }
function presetPreview(p){
  const items=presetItems(p), bb=presetBBox(items);
  const pad=0.6, vw=bb.w+pad*2, vh=bb.h+pad*2;
  let shapes='';
  items.forEach(it=>{
    const col=presetColor(it.k);
    const X=it.x-bb.x+pad, Y=it.y-bb.y+pad;
    if(it.k==='hall'){
      shapes+='<ellipse cx="'+(X+it.w/2)+'" cy="'+(Y+it.h/2)+'" rx="'+((it.w)/2)+'" ry="'+((it.h)/2)+'" fill="'+col+'33" stroke="'+col+'" stroke-width="0.09"/>';
    } else if(it.k==='corr'){
      const horiz=it.w>=it.h;
      shapes+='<rect x="'+X+'" y="'+Y+'" width="'+it.w+'" height="'+it.h+'" fill="'+col+'44" stroke="'+col+'" stroke-width="0.09"/>';
    } else {
      shapes+='<rect x="'+X+'" y="'+Y+'" width="'+it.w+'" height="'+it.h+'" rx="0.25" fill="'+col+'2e" stroke="'+col+'" stroke-width="0.09"/>';
    }
  });
  return '<svg class="rc-art" viewBox="0 0 '+vw+' '+vh+'" preserveAspectRatio="xMidYMid meet" aria-hidden="true">'+shapes+'</svg>';
}
function renderRoomLib(tab){
  const grid=document.getElementById('roomLibGrid'); if(!grid) return;
  const list=tab==='dungeons' ? MAP_DUNGEON_LIB : MAP_ROOM_LIB;
  grid.innerHTML=list.map(p=>{
    const bb=presetBBox(presetItems(p));
    return '<button type="button" class="room-card" data-preset="'+p.id+'">'+
      presetPreview(p)+
      '<span class="rc-top"><span class="rc-name">'+escapeHtml(p.name)+'</span>'+
      '<span class="rc-size">'+bb.w+'×'+bb.h+'</span></span></button>';
  }).join('');
  grid.querySelectorAll('[data-preset]').forEach(card=>{
    card.addEventListener('click', ()=>{
      const p=list.find(x=>x.id===card.dataset.preset);
      if(p) insertMapPreset(p);
    });
  });
}
function insertMapPreset(p){
  const m=curMap();
  if(!m){ uiAlert('Сначала создайте или откройте карту'); return; }
  const cell=mapCellPx(m);
  const items=presetItems(p);
  const bb=presetBBox(items);
  const ox=Math.max(0,(m.baseW-bb.w*cell)/2 - bb.x*cell);
  const oy=Math.max(0,(m.baseH-bb.h*cell)/2 - bb.y*cell);
  m.draw=m.draw||[];
  items.forEach(it=>{
    const type = it.k==='corr' ? 'corridor' : (it.k==='hall' ? 'ellipse' : 'rect');
    m.draw.push({ type, color:presetColor(it.k), width:2,
      x: ox+it.x*cell, y: oy+it.y*cell, w: it.w*cell, h: it.h*cell });
  });
  saveMap(); renderMap();
  const mbox=document.getElementById('roomLibModal'); if(mbox) closeModal(mbox);
  toast('Пресет «'+p.name+'» добавлен на карту');
}
function bindRoomLib(){
  const libBtn=document.getElementById('mapRoomsLib');
  const mbox=document.getElementById('roomLibModal');
  if(!libBtn || !mbox || libBtn.dataset.bound) return;
  libBtn.dataset.bound='1';
  libBtn.addEventListener('click', ()=>{ renderRoomLib('rooms'); openModal(mbox, libBtn); });
  const closeBtn=document.getElementById('roomLibClose');
  if(closeBtn) closeBtn.addEventListener('click', ()=> closeModal(mbox));
  mbox.querySelectorAll('[data-room-tab]').forEach(tab=>{
    tab.addEventListener('click', ()=>{
      mbox.querySelectorAll('[data-room-tab]').forEach(t=> t.classList.toggle('active', t===tab));
      renderRoomLib(tab.dataset.roomTab);
    });
  });
}
bindRoomLib();
/* ── обработчики карты ── */
{ const fi=document.getElementById('mapFileInput');
  if(fi) fi.addEventListener('change', e=>{ const f=e.target.files && e.target.files[0]; if(f) mapAddFromFile(f); e.target.value=''; });
  const add=document.getElementById('mapAdd'); if(add) add.addEventListener('click', ()=> fi&&fi.click());
  const drawSel=document.getElementById('mapDrawTool');
  if(drawSel && !drawSel.dataset.bound){
    drawSel.dataset.bound='1';
    drawSel.addEventListener('change', ()=>{
      mapPenOn = drawSel.value!=='none';
      updateMapPenBtn();
      const mc=document.getElementById('mapCanvas');
      if(mc){ const m=curMap(); if(m){ m.scrollX=mc.scrollLeft; m.scrollY=mc.scrollTop; } }
      renderMap();
      if(mapPenOn) toast('Рисование включено: тяните по карте');
    });
  }
  const snapShapes=document.getElementById('mapSnapShapes');
  if(snapShapes && !snapShapes.dataset.bound){
    snapShapes.dataset.bound='1';
    snapShapes.addEventListener('click', ()=>{
      const m=curMap(); if(!m) return;
      const cell=mapCellPx(m);
      let n=0;
      (m.draw||[]).forEach(s=>{
        if(s.type==='rect' || s.type==='ellipse' || s.type==='corridor'){
          const nx=Math.round(s.x/cell)*cell, ny=Math.round(s.y/cell)*cell;
          const nw=Math.max(cell, Math.round(s.w/cell)*cell), nh=Math.max(cell, Math.round(s.h/cell)*cell);
          if(nx!==s.x || ny!==s.y || nw!==s.w || nh!==s.h){ s.x=nx; s.y=ny; s.w=nw; s.h=nh; n++; }
        }
      });
      if(!n){ toast('Фигуры уже стоят по сетке'); return; }
      saveMap(); renderMap(); toast('Выровнено по сетке: '+n);
    });
  }
  const drawClr=document.getElementById('mapDrawClear');
  if(drawClr && !drawClr.dataset.bound){
    drawClr.dataset.bound='1';
    drawClr.addEventListener('click', ()=>{
      const m=curMap(); if(!m) return;
      if(!(m.draw && m.draw.length)){ toast('На карте пока ничего не нарисовано'); return; }
      m.draw=[]; saveMap(); renderMap(); toast('Рисунок стёрт');
    });
  }
  const moreBtn=document.getElementById('mapMoreBtn');
  const adv=document.getElementById('mapAdvanced');
  if(moreBtn && adv && !moreBtn.dataset.bound){
    moreBtn.dataset.bound='1';
    moreBtn.addEventListener('click', ()=>{
      const open=adv.hidden;
      adv.hidden=!open;
      moreBtn.classList.toggle('active', open);
      moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }
  const railToggle=document.getElementById('mapRailToggle');
  const mapLayout=document.querySelector('.map-layout');
  if(railToggle && mapLayout && !railToggle.dataset.bound){
    railToggle.dataset.bound='1';
    const KEY='shirma_map_rail_collapsed';
    const narrow=()=> !!(window.matchMedia && window.matchMedia('(max-width:820px)').matches);
    const applyRail=(collapsed)=>{
      mapLayout.classList.toggle('rail-collapsed', !!collapsed);
      mapLayout.classList.toggle('rail-open', !collapsed);
      railToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      // на узком экране панель — выдвижная: положение задаём явно
      const rail=mapLayout.querySelector('.map-rail');
      if(rail){
        if(narrow()){
          rail.style.left = collapsed ? '-105%' : '0';
          rail.style.opacity = collapsed ? '0' : '1';
          rail.style.pointerEvents = collapsed ? 'none' : 'auto';
        } else {
          rail.style.left=''; rail.style.opacity=''; rail.style.pointerEvents='';
        }
      }
    };
    let stored=null;
    try{ stored=localStorage.getItem(KEY); }catch(e){}
    applyRail(narrow() ? true : stored==='1');
    railToggle.addEventListener('click', ()=>{
      const collapsed=!mapLayout.classList.contains('rail-collapsed');
      applyRail(collapsed);
      try{ localStorage.setItem(KEY, collapsed ? '1' : '0'); }catch(e){}
      mapResizeTimer && clearTimeout(mapResizeTimer);
    });
    const tabsEl=document.getElementById('mapTabs');
    if(tabsEl) tabsEl.addEventListener('click', e=>{
      if(!e.target.closest('.map-tab')) return;
      if(narrow()) applyRail(true);
    });
  }
  const zl=document.getElementById('mapZoomReset');
  if(zl) zl.addEventListener('click', ()=>{ if(mapLocked) return; const m=curMap(); if(m){ m.userZoom=1; m.scrollX=0; m.scrollY=0; saveMap(); renderMap(); } });
  const zi=document.getElementById('mapZoomIn');
  if(zi) zi.addEventListener('click', ()=> mapZoom(1));
  const zo=document.getElementById('mapZoomOut');
  if(zo) zo.addEventListener('click', ()=> mapZoom(-1));
  const mcEl=document.getElementById('mapCanvas');
  if(mcEl && !mcEl.dataset.zoomBound){
    mcEl.dataset.zoomBound='1';
    mcEl.addEventListener('wheel', e=>{
      if(mapLocked) return;
      e.preventDefault();
      mapZoom(e.deltaY < 0 ? 1 : -1);
    }, { passive:false });
  }
  document.getElementById('mapLock')&&document.getElementById('mapLock').addEventListener('click', ()=>{
    mapLocked=!mapLocked;
    const mc=document.getElementById('mapCanvas');
    if(mc){ const m=curMap(); if(m){ m.scrollX=mc.scrollLeft; m.scrollY=mc.scrollTop; } }
    renderMap();
  });
  document.getElementById('mapAddMarker')&&document.getElementById('mapAddMarker').addEventListener('click', addMapMarker);
  const gridBtn=document.getElementById('mapGrid');
  if(gridBtn){
    function updateGrid(){ gridBtn.classList.toggle('active', !!mapGridOn); }
    gridBtn.addEventListener('click', ()=>{ mapGridOn=!mapGridOn; saveMap(); renderMap(); updateGrid(); });
    updateGrid();
  }
  const stepSel=document.getElementById('mapGridStep');
  if(stepSel){
    stepSel.value = String(mapGridStep);
    stepSel.addEventListener('change', ()=>{ mapGridStep=parseInt(stepSel.value,10)||18; saveMap(); renderMap(); });
  }
  const pen=document.getElementById('mapPen'); if(pen) pen.addEventListener('click', ()=>{ mapPenOn=!mapPenOn; updateMapPenBtn(); });
  document.getElementById('mapRuler')&&document.getElementById('mapRuler').addEventListener('click', mapRulerToggle);
  document.getElementById('mapDup')&&document.getElementById('mapDup').addEventListener('click', mapDuplicate);
  document.getElementById('mapSnap')&&document.getElementById('mapSnap').addEventListener('click', mapSnapPNG);
  document.getElementById('mapPenClear')&&document.getElementById('mapPenClear').addEventListener('click', mapClearDraw);
  const mc=document.getElementById('mapCanvas');
  if(mc){
    mc.addEventListener('scroll', ()=>{
      hideMapNoteTip();
      const m=curMap(); if(!m||mapLocked) return; m.scrollX=mc.scrollLeft; m.scrollY=mc.scrollTop; saveMap();
    });
    // зум колесом отключён — колесо прокручивает карту
    // панорама: тащим пустое место карты мышью
    mc.addEventListener('mousedown', e=>{
      if(mapLocked||mapPenOn) return;
      if(e.target.closest('.map-marker')||e.target.closest('.map-token')||e.target.closest('.map-draw')) return;
      e.preventDefault();
      const sx=e.clientX, sy=e.clientY, sl=mc.scrollLeft, st=mc.scrollTop;
      let moved=false;
      pointerDrag(e, ev=>{
        const dx=ev.clientX-sx, dy=ev.clientY-sy;
        if(dx||dy) moved=true;
        mc.scrollLeft=sl-dx; mc.scrollTop=st-dy;
        clampMapScroll(mc);
      }, ()=>{
        if(moved){ const m=curMap(); if(m){ m.scrollX=mc.scrollLeft; m.scrollY=mc.scrollTop; saveMap(); } }
      });
    });
  }
  // клик по карте: расстановка маркера (режим placement)
  { const MC=document.getElementById('mapCanvas');
    if(MC){
      MC.addEventListener('click', e=>{
        if(e.target.closest('.map-marker')) return; // выбор маркера — в самом маркере
        if(e.target.closest('.zone')) return;        // зону тащим, новую не ставим
        const m=curMap(); if(!m) return;
        const w=MC.querySelector('.map-zoom'); if(!w) return;
        const r=w.getBoundingClientRect();
        const z=mapFitScale(MC, m);
        const x=(e.clientX-r.left)/z, y=(e.clientY-r.top)/z;
        if(x<0||y<0||x>m.baseW||y>m.baseH) return;
        if(mapRulerOn){
          if(!rulerPt){ rulerPt={x:x,y:y}; const l=document.getElementById('mapRulerLabel'); if(l) l.textContent='Клик №2 — конец измерения'; }
          else{
            const px=Math.hypot(x-rulerPt.x, y-rulerPt.y);
            const cells=Math.round(px / Math.max(1,mapCellPx(m)) * 10)/10;
            const feet=Math.round(cells * Math.max(1, m.feetPerCell||5));
            const l=document.getElementById('mapRulerLabel'); if(l){ l.hidden=true; l.textContent=''; }
            toast('Расстояние: '+feet+' фт ('+cells+' кл.)');
            rulerPt=null; renderMap();
          }
          return;
        }
        if(mapZoneType!=='none'){ placeZoneAt(m, x, y); return; }
        if(mapPlaceOn){ const sp=snapPoint(m,x,y); placeMarkerAt(sp.x,sp.y); return; }
        if(selectedMarkerId){ selectedMarkerId=null; renderMap(); if(window.updateMapMarkerCtl) window.updateMapMarkerCtl(); }
      });
    }
    // панель управления выбранным маркером
    const ctl=document.getElementById('markerCtl');
    function updateMarkerCtl(){
      if(!ctl) return;
      const m=curMap();
      const k = m && selectedMarkerId ? m.markers.find(x=>x.id===selectedMarkerId) : null;
      const isTok = !!(k && (k.kind==='pc' || k.kind==='mob'));
      ctl.hidden = !k || isTok;
      const nm=document.getElementById('markerName'); if(nm) nm.textContent=k?k.label:'';
      const nb=document.getElementById('markerNote');
      if(nb){
        const linked = !!(k && markerLinkedBlock(m,k));
        nb.textContent = linked ? 'Открыть заметку' : 'Создать заметку';
        nb.title = linked ? 'Перейти к связанной заметке на ширме' : 'Создать заметку на ширме и связать её с меткой';
      }
    }
    function deselect(){ selectedMarkerId=null; renderMap(); updateMarkerCtl(); }
    document.getElementById('markerRename')&&document.getElementById('markerRename').addEventListener('click', async ()=>{
      const m=curMap(); const k=m&&selectedMarkerId?m.markers.find(x=>x.id===selectedMarkerId):null; if(!k) return;
      const t=await uiPrompt('Имя маркера:',k.label); if(t===null) return; k.label=(t.trim()||'Маркер').slice(0,40); saveMap(); renderMap(); updateMarkerCtl();
    });
    document.getElementById('markerColor')&&document.getElementById('markerColor').addEventListener('click', ()=>{
      const palette=['#7fb3e6','#c0564f','#86c48f','#c9a227','#c9a2e6','#e68a4a','#6ac4c9'];
      const m=curMap(); const k=m&&selectedMarkerId?m.markers.find(x=>x.id===selectedMarkerId):null; if(!k) return;
      const i=palette.indexOf(k.color); k.color=palette[(i+1)%palette.length]; saveMap(); renderMap(); updateMarkerCtl();
    });
    document.getElementById('markerDel')&&document.getElementById('markerDel').addEventListener('click', async ()=>{
      const m=curMap(); if(!m||!selectedMarkerId) return; if(!(await uiConfirm('Удалить маркер?'))) return;
      m.markers=m.markers.filter(x=>x.id!==selectedMarkerId); selectedMarkerId=null; saveMap(); renderMap(); updateMarkerCtl();
    });
    document.getElementById('markerNote')&&document.getElementById('markerNote').addEventListener('click', ()=>{
      const m=curMap(); const k=m&&selectedMarkerId?m.markers.find(x=>x.id===selectedMarkerId):null; if(!k) return;
      markerNoteAction(m,k); updateMarkerCtl();
    });
    document.getElementById('markerDone')&&document.getElementById('markerDone').addEventListener('click', deselect);
    window.updateMapMarkerCtl=updateMarkerCtl;
  }
}

