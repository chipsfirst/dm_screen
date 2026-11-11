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
  if(mapPlaceOn){
    mapZoneType='none';
    const zt=document.getElementById('mapZoneType'); if(zt) zt.value='none';
    toast('Кликните по карте, чтобы поставить маркер');
  }
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
    props:(m.props||[]).map(p=>({...p,id:'p'+Math.random().toString(36).slice(2,7)})),
    draw:(m.draw||[]).map(s=>JSON.parse(JSON.stringify(s))) });
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
function presetColor(kind){ return '#111'; }
function presetPreview(p){
  const items=presetItems(p), bb=presetBBox(items);
  const pad=0.6, vw=bb.w+pad*2, vh=bb.h+pad*2;
  let shapes='';
  items.forEach(it=>{
    const col=presetColor(it.k);
    const X=it.x-bb.x+pad, Y=it.y-bb.y+pad;
    if(it.k==='hall'){
      shapes+='<ellipse cx="'+(X+it.w/2)+'" cy="'+(Y+it.h/2)+'" rx="'+((it.w)/2)+'" ry="'+((it.h)/2)+'" fill="#ffffff" stroke="'+col+'" stroke-width="0.09"/>';
    } else if(it.k==='corr'){
      const horiz=it.w>=it.h;
      shapes+='<rect x="'+X+'" y="'+Y+'" width="'+it.w+'" height="'+it.h+'" fill="#f2f2f2" stroke="'+col+'" stroke-width="0.09"/>';
    } else {
      shapes+='<rect x="'+X+'" y="'+Y+'" width="'+it.w+'" height="'+it.h+'" rx="0.25" fill="#ffffff" stroke="'+col+'" stroke-width="0.09"/>';
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
  const roomShapes=[], corrShapes=[];
  items.forEach(it=>{
    const x=ox+it.x*cell, y=oy+it.y*cell, w=it.w*cell, h=it.h*cell;
    if(it.k==='corr'){
      const t=Math.max(4, Math.min(w,h));
      const pts = w>=h ? [[x,y+h/2],[x+w,y+h/2]] : [[x+w/2,y],[x+w/2,y+h]];
      corrShapes.push({ type:'cpath', pts:pts, w:t, color:'#111', fill:'rgba(0,0,0,.06)', width:2 });
    } else {
      const type = it.k==='hall' ? 'ellipse' : 'rect';
      roomShapes.push({ type, x:x, y:y, w:w, h:h, color:'#111', fill:'rgba(255,255,255,.5)', width:2, wall:true });
    }
  });
  const doors=[];
  corrShapes.forEach(c=>{
    const pts=c.pts||[]; if(pts.length<2) return;
    const t=c.w||0; if(t<=0) return;
    const p0=pts[0], p1=pts[1], pn=pts[pts.length-1], pm=pts[pts.length-2];
    const h0=Math.abs(p1[0]-p0[0])>=Math.abs(p1[1]-p0[1]);
    doors.push(h0 ? {x:p0[0]-4,y:p0[1]-t/2,w:8,h:t} : {x:p0[0]-t/2,y:p0[1]-4,w:t,h:8});
    const hN=Math.abs(pn[0]-pm[0])>=Math.abs(pn[1]-pm[1]);
    doors.push(hN ? {x:pn[0]-4,y:pn[1]-t/2,w:8,h:t} : {x:pn[0]-t/2,y:pn[1]-4,w:t,h:8});
  });
  const doorShapes=doors.map(d=>({type:'rect', x:d.x, y:d.y, w:d.w, h:d.h, color:'#fff', fill:'#fff', width:1, wall:false}));
  m.draw=m.draw.concat(roomShapes, doorShapes, corrShapes);
  window.drawSelectIndex(m.draw.length-1);
  const selTool=document.getElementById('mapDrawTool');
  if(selTool){ selTool.value='select'; selTool.dispatchEvent(new Event('change',{bubbles:true})); }
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
/* ── меню «Добавить карту» ── */
let mapAddMenuEl=null;
function openMapAddMenu(btn){
  if(!mapAddMenuEl){
    const el=document.createElement('div');
    el.id='mapAddMenu'; el.className='map-add-menu'; el.hidden=true;
    el.innerHTML='<button type="button" data-act="file">С компьютера</button>'
      +'<button type="button" data-act="url">По ссылке</button>'
      +'<button type="button" data-act="blank">Пустая карта (квадраты)</button>';
    el.addEventListener('click', e=>{
      const b=e.target.closest('button'); if(!b) return;
      const act=b.dataset.act;
      el.hidden=true;
      if(act==='file') document.getElementById('mapFileInput')?.click();
      else if(act==='url') mapAddFromUrl();
      else if(act==='blank') addFullScreenMap();
    });
    document.body.appendChild(el);
    mapAddMenuEl=el;
    document.addEventListener('pointerdown', e=>{
      if(el.hidden) return;
      if(el.contains(e.target) || e.target.closest('#mapAdd, #mapAddTab')) return;
      el.hidden=true;
    });
    document.addEventListener('keydown', e=>{ if(e.key==='Escape' && !el.hidden) el.hidden=true; });
  }
  mapAddMenuEl.hidden=false;
  const r=btn.getBoundingClientRect();
  const w=mapAddMenuEl.offsetWidth||210;
  mapAddMenuEl.style.left=Math.max(8, Math.min(window.innerWidth-w-8, r.left))+'px';
  mapAddMenuEl.style.top=(r.bottom+8)+'px';
}
/* ── обработчики карты ── */
{ const fi=document.getElementById('mapFileInput');
  if(fi) fi.addEventListener('change', e=>{ const f=e.target.files && e.target.files[0]; if(f) mapAddFromFile(f); e.target.value=''; });
  const add=document.getElementById('mapAdd'); if(add && !add.dataset.bound){ add.dataset.bound='1'; add.addEventListener('click', ()=> openMapAddMenu(add)); }
  const drawSel=document.getElementById('mapDrawTool');
  if(drawSel && !drawSel.dataset.bound){
    drawSel.dataset.bound='1';
    drawSel.addEventListener('change', ()=>{
      mapPenOn = drawSel.value!=='none' && drawSel.value!=='select';
      if(drawSel.value!=='select' && window.drawSelectIndex) window.drawSelectIndex(-1);
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
      if(e.target.closest('.map-marker')||e.target.closest('.map-token')||e.target.closest('.map-draw')||e.target.closest('.map-prop')) return;
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
        if(e.target.closest('.map-marker')||e.target.closest('.map-prop')||e.target.closest('.map-draw')) return;
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
        if(mapPlaceOn){ const sp=snapPoint(m,x,y); placeMarkerAt(sp.x,sp.y); return; }
        if(mapZoneType!=='none'){ placeZoneAt(m, x, y); return; }
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



/* ── Ассеты и пропсы карты ── */
(function mapProps(){
  const btn=document.getElementById('mapAssets');
  const modal=document.getElementById('tilesModal');
  const grid=document.getElementById('tilesGrid');
  const closeBtn=document.getElementById('tilesClose');
  if(!btn || !modal || !grid) return;
  function renderPalette(){
    const cats = window.MAP_TILES || [];
    grid.innerHTML = cats.map(cat =>
      '<div class="tiles-cat">'+escapeHtml(cat.cat)+'</div>'+
      '<div class="tiles-grid">'+cat.items.map(it =>
        '<button class="tile-btn" data-tile="'+escapeHtml(it.file)+'" title="'+escapeHtml(it.name)+'">'+
        '<img src="assets/tiles/'+escapeHtml(it.file)+'?v=2" alt="" loading="lazy">'+
        '<span>'+escapeHtml(it.name)+'</span></button>').join('')+'</div>').join('');
    grid.querySelectorAll('[data-tile]').forEach(b=>{
      b.addEventListener('click', ()=>{ addPropAt(b.dataset.tile); closeModal(modal); });
    });
  }
  function mapViewCenter(){
    const mc=document.getElementById('mapCanvas'); const m=curMap();
    if(!mc || !m) return { x:0, y:0 };
    const z=Math.min(8, Math.max(0.05, mapFitScale(mc,m)*(m.userZoom||1)));
    const x=(mc.scrollLeft + mc.clientWidth/2)/z;
    const y=(mc.scrollTop + mc.clientHeight/2)/z;
    return { x:Math.max(0, Math.min(m.baseW, x)), y:Math.max(0, Math.min(m.baseH, y)) };
  }
  function addPropAt(file){
    const m=curMap(); if(!m) return;
    const c=mapViewCenter();
    const p=normProp({ file:file, x:c.x, y:c.y });
    (m.props=m.props||[]).push(p);
    selectedPropId=p.id;
    saveMap(); renderMap();
  }
  function updatePropCtl(){
    const ctl=document.getElementById('propCtl'); if(!ctl) return;
    const m=curMap();
    const p=m && selectedPropId ? (m.props||[]).find(x=>x.id===selectedPropId) : null;
    ctl.hidden=!p;
    const nm=document.getElementById('propName'); if(nm) nm.textContent = p ? p.file.replace(/^.*\//,'').replace(/\.png$/,'') : 'Пропс';
    const sv=document.getElementById('propSizeVal'); if(sv) sv.textContent = p ? (Math.round(p.w*100)/100)+'×' : '1×';
  }
  btn.addEventListener('click', ()=>{ renderPalette(); openModal(modal, btn); });
  closeBtn && closeBtn.addEventListener('click', ()=> closeModal(modal));
  modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(modal); });
  document.getElementById('propRotL')&&document.getElementById('propRotL').addEventListener('click', ()=>{
    const m=curMap(); const p=m&&selectedPropId?(m.props||[]).find(x=>x.id===selectedPropId):null; if(!p) return;
    p.rot=((p.rot-90)%360+360)%360; saveMap(); renderMap();
  });
  document.getElementById('propRotR')&&document.getElementById('propRotR').addEventListener('click', ()=>{
    const m=curMap(); const p=m&&selectedPropId?(m.props||[]).find(x=>x.id===selectedPropId):null; if(!p) return;
    p.rot=((p.rot+90)%360+360)%360; saveMap(); renderMap();
  });
  document.getElementById('propFlip')&&document.getElementById('propFlip').addEventListener('click', ()=>{
    const m=curMap(); const p=m&&selectedPropId?(m.props||[]).find(x=>x.id===selectedPropId):null; if(!p) return;
    p.flip=!p.flip; saveMap(); renderMap();
  });
  document.getElementById('propSizeM')&&document.getElementById('propSizeM').addEventListener('click', ()=>{
    const m=curMap(); const p=m&&selectedPropId?(m.props||[]).find(x=>x.id===selectedPropId):null; if(!p) return;
    p.w=Math.max(0.5, Math.round((p.w-0.5)*100)/100); saveMap(); renderMap();
  });
  document.getElementById('propSizeP')&&document.getElementById('propSizeP').addEventListener('click', ()=>{
    const m=curMap(); const p=m&&selectedPropId?(m.props||[]).find(x=>x.id===selectedPropId):null; if(!p) return;
    p.w=Math.min(4, Math.round((p.w+0.5)*100)/100); saveMap(); renderMap();
  });
  document.getElementById('propDel')&&document.getElementById('propDel').addEventListener('click', async ()=>{
    const m=curMap(); if(!m||!selectedPropId) return; if(!(await uiConfirm('Удалить пропс?'))) return;
    m.props=(m.props||[]).filter(x=>x.id!==selectedPropId); selectedPropId=null; saveMap(); renderMap();
  });
  document.getElementById('propDone')&&document.getElementById('propDone').addEventListener('click', ()=>{ selectedPropId=null; renderMap(); });
  window.updatePropCtl=updatePropCtl;
})();


/* ── Генератор подземелий и JSON карты ── */
(function mapTools(){
  const gen=document.getElementById('mapGen');
  const exp=document.getElementById('mapExport');
  const imp=document.getElementById('mapImport');
  const inp=document.getElementById('mapImportInput');
  if(!gen) return;
  async function generateBsp(){
    const m=curMap(); if(!m) return;
    if((m.draw||[]).length){
      if(!(await uiConfirm('Очистить текущий рисунок и сгенерировать подземелье?'))) return;
      m.draw=[];
    }
    const cell=mapCellPx(m);
    const snap=v=>Math.round(v/cell)*cell;
    function makeRoom(node){
      const mgn=cell*1.2;
      const maxW=Math.max(cell*2.4, node.w-mgn*2), maxH=Math.max(cell*2.4, node.h-mgn*2);
      const w=Math.min(maxW, cell*(2.4+Math.random()*2.6));
      const h=Math.min(maxH, cell*(2.4+Math.random()*2.6));
      const x=node.x+(node.w-w)/2 + (Math.random()-0.5)*Math.min(cell, Math.max(0,maxW-w));
      const y=node.y+(node.h-h)/2 + (Math.random()-0.5)*Math.min(cell, Math.max(0,maxH-h));
      const room={ type:'rect', x:x, y:y, w:w, h:h, color:'#111', fill:'rgba(255,255,255,.5)', width:2, wall:true };
      m.draw.push(room); return room;
    }
    function splitNode(node, depth){
      const min=cell*5;
      if(depth<=0 || (node.w<2*min && node.h<2*min)){ node.room=makeRoom(node); return node; }
      if(node.w>=node.h){
        if(node.w<2*min){ node.room=makeRoom(node); return node; }
        const cut=min+Math.random()*(node.w-2*min);
        node.axis='x'; node.cut=node.x+cut;
        node.left=splitNode({x:node.x,y:node.y,w:cut,h:node.h},depth-1);
        node.right=splitNode({x:node.x+cut,y:node.y,w:node.w-cut,h:node.h},depth-1);
      } else {
        if(node.h<2*min){ node.room=makeRoom(node); return node; }
        const cut=min+Math.random()*(node.h-2*min);
        node.axis='y'; node.cut=node.y+cut;
        node.left=splitNode({x:node.x,y:node.y,w:node.w,h:cut},depth-1);
        node.right=splitNode({x:node.x,y:node.y+cut,w:node.w,h:node.h-cut},depth-1);
      }
      return node;
    }
    function collect(node, out){ if(!node) return out; if(node.room){ out.push(node.room); return out; } collect(node.left,out); collect(node.right,out); return out; }
    function nearestRoom(list, edge, dir){
      let best=null, bestVal=null;
      list.forEach(r=>{
        const v = edge==='x' ? (dir>0 ? r.x+r.w : r.x) : (dir>0 ? r.y+r.h : r.y);
        if(bestVal===null || (dir>0 ? v>bestVal : v<bestVal)){ bestVal=v; best=r; }
      });
      return best;
    }
    function connect(node){
      if(!node || !node.left) return;
      connect(node.left); connect(node.right);
      const leftRooms=collect(node.left,[]), rightRooms=collect(node.right,[]);
      if(!leftRooms.length || !rightRooms.length) return;
      const t=Math.max(2,cell*0.7);
      function pushPath(pts){
        const clean=[];
        pts.forEach(p=>{ const q=clean[clean.length-1]; if(!q || Math.abs(q[0]-p[0])>0.5 || Math.abs(q[1]-p[1])>0.5) clean.push([p[0],p[1]]); });
        if(clean.length>=2) m.draw.push({ type:'cpath', pts:clean, w:t, color:'#111', fill:'rgba(0,0,0,.06)', width:2 });
      }
      if(node.axis==='x'){
        const ra=nearestRoom(leftRooms,'x',1), rb=nearestRoom(rightRooms,'x',-1);
        const ax=ra.x+ra.w, bx=rb.x;
        if(bx-ax<4) return;
        const cut=Math.max(ax+1, Math.min(bx-1, node.cut));
        const ay=snap(ra.y+ra.h/2), by=snap(rb.y+rb.h/2);
        if(Math.abs(ay-by)>0.5) pushPath([[ax,ay],[cut,ay],[cut,by],[bx,by]]);
        else pushPath([[ax,ay],[bx,by]]);
      } else {
        const ra=nearestRoom(leftRooms,'y',1), rb=nearestRoom(rightRooms,'y',-1);
        const ay=ra.y+ra.h, by=rb.y;
        if(by-ay<4) return;
        const cut=Math.max(ay+1, Math.min(by-1, node.cut));
        const ax=snap(ra.x+ra.w/2), bx=snap(rb.x+rb.w/2);
        if(Math.abs(ax-bx)>0.5) pushPath([[ax,ay],[ax,cut],[bx,cut],[bx,by]]);
        else pushPath([[ax,ay],[ax,by]]);
      }
    }
    const pad=cell*1.2;
    const root={ x:pad, y:pad, w:Math.max(cell*10, m.baseW-pad*2), h:Math.max(cell*10, m.baseH-pad*2) };
    splitNode(root, 4);
    connect(root);
    const rooms=m.draw.filter(d=>d.type==='rect'||d.type==='ellipse');
    const corrs=m.draw.filter(d=>d.type==='cpath');
    const doors=[];
    corrs.forEach(c=>{
      const pts=c.pts||[]; if(pts.length<2) return;
      const t=c.w||0; if(t<=0) return;
      const p0=pts[0], p1=pts[1], pn=pts[pts.length-1], pm=pts[pts.length-2];
      const h0=Math.abs(p1[0]-p0[0])>=Math.abs(p1[1]-p0[1]);
      doors.push(h0 ? {x:p0[0]-4,y:p0[1]-t/2,w:8,h:t} : {x:p0[0]-t/2,y:p0[1]-4,w:t,h:8});
      const hN=Math.abs(pn[0]-pm[0])>=Math.abs(pn[1]-pm[1]);
      doors.push(hN ? {x:pn[0]-4,y:pn[1]-t/2,w:8,h:t} : {x:pn[0]-t/2,y:pn[1]-4,w:t,h:8});
    });
    const doorShapes=doors.map(d=>({type:'rect', x:d.x, y:d.y, w:d.w, h:d.h, color:'#fff', fill:'#fff', width:1, wall:false}));
    m.draw=rooms.concat(doorShapes, corrs);
    saveMap(); renderMap(); toast('Подземелье сгенерировано');
  }
  function exportMap(){
    const m=curMap(); if(!m) return;
    const txt=JSON.stringify(normMap(m), null, 1);
    saveFile((m.name||'карта')+'.json', txt, 'application/json');
    toast('Карта сохранена в JSON');
  }
  gen.addEventListener('click', generateBsp);
  exp && exp.addEventListener('click', exportMap);
  imp && imp.addEventListener('click', ()=>{ if(inp) inp.click(); });
  inp && inp.addEventListener('change', ()=>{
    const f=inp.files && inp.files[0]; if(!f) return;
    const r=new FileReader();
    r.onload=()=>{
      try{
        const obj=JSON.parse(String(r.result||'{}'));
        const m=normMap(obj);
        maps.push(m); activeMapId=m.id; saveMap(); renderMap();
        toast('Карта импортирована');
      }catch(e){ uiAlert('Не удалось прочитать JSON карты'); }
      inp.value='';
    };
    r.readAsText(f);
  });
})();


/* ── Боковая панель инструментов карты ── */
(function mapMenus(){
  const bar=document.getElementById('mapMenus');
  if(!bar) return;
  const gDraw=document.getElementById('msDraw');
  const gObj=document.getElementById('msObj');
  const gCreate=document.getElementById('msCreate');
  const gView=document.getElementById('msView');
  const gZones=document.getElementById('msZones');
  const gMore=document.getElementById('msMore');
  function move(id,parent){ const el=document.getElementById(id); if(el&&parent) parent.appendChild(el); }
  ['mapDrawTool','mapRuler','mapSnapShapes','mapDrawHint'].forEach(id=>move(id,gDraw));
  ['mapAddToken','mapAddMarker'].forEach(id=>move(id,gObj));
  ['mapGen','mapRoomsLib','mapAssets'].forEach(id=>move(id,gCreate));
  ['mapShape','mapCellPx','mapFeet','mapSnap','mapMono','mapFull','mapFogMode'].forEach(id=>move(id,gView));
  ['mapZoneAdd','mapZoneClear'].forEach(id=>move(id,gZones));
  ['mapDrawClear','mapExport','mapImport','mapImportInput','mapFileInput','mapRulerLabel','mapTypeHint'].forEach(id=>move(id,gMore));
  const more=document.getElementById('mapMoreBtn'); if(more) more.style.display='none';
  const adv=document.getElementById('mapAdvanced'); if(adv) adv.hidden=true;
  const toolsBtn=document.getElementById('mapToolsBtn'); if(toolsBtn) toolsBtn.style.display='none';
  const segSync=[];
  function seg(selId,parent,opts){
    const sel=document.getElementById(selId);
    if(!sel || !parent) return;
    const box=document.createElement('div');
    box.className='ms-seg'+(opts.length===2?' two':'');
    opts.forEach(o=>{
      const b=document.createElement('button');
      b.type='button'; b.title=o.t; b.dataset.val=o.v;
      b.innerHTML='<span class="gi" data-gi="'+o.i+'"></span><span>'+o.l+'</span>';
      b.addEventListener('click', ()=>{ sel.value=o.v; sel.dispatchEvent(new Event('change',{bubbles:true})); syncSel(); });
      box.appendChild(b);
    });
    parent.insertBefore(box, sel);
    sel.hidden=true;
    function syncSel(){ box.querySelectorAll('button').forEach(b=>b.classList.toggle('active', b.dataset.val===sel.value)); }
    sel.addEventListener('change', syncSel);
    syncSel();
    hydrateIcons(box);
    segSync.push(syncSel);
  }
  seg('mapDrawTool', gDraw, [
    {v:'none',l:'Выкл',i:'off',t:'Инструмент выключен'},
    {v:'select',l:'Выбор',i:'select',t:'Выбор фигур: двигать, менять размер, удалять'},
    {v:'pen',l:'Перо',i:'pen',t:'Свободное рисование'},
    {v:'room',l:'Комната',i:'room',t:'Прямоугольная комната'},
    {v:'oval',l:'Зал',i:'oval',t:'Овальный зал'},
    {v:'corridor',l:'Коридор',i:'corridor',t:'Коридор'},
    {v:'poly',l:'Полигон',i:'polygon',t:'Многоугольная комната'}
  ]);
  seg('mapShape', gView, [
    {v:'hex',l:'Гексы',i:'hex',t:'Сетка: гексы'},
    {v:'square',l:'Квадраты',i:'square',t:'Сетка: квадраты'}
  ]);
  seg('mapFogMode', gView, [
    {v:'off',l:'Выкл',i:'off',t:'Туман войны выключен'},
    {v:'hide',l:'Скрыть',i:'moon',t:'Закрыть области туманом'},
    {v:'reveal',l:'Открыть',i:'sun',t:'Открыть области'}
  ]);
  window.__msSync = ()=>segSync.forEach(f=>f());
  function updateDrawCtl(){
    const ctl=document.getElementById('drawCtl'); if(!ctl) return;
    const m=curMap(); const i=window.__drawSelIndex;
    const s=(m && i>=0 && window.__drawSelMap===m.id)?(m.draw||[])[i]:null;
    ctl.hidden=!s;
  }
  window.updateDrawCtl=updateDrawCtl;
  const dcl=document.getElementById('drawCtlClose');
  if(dcl) dcl.addEventListener('click', ()=>{ window.drawSelectIndex(-1); renderMap(); });
  const ddel=document.getElementById('drawDelete');
  if(ddel) ddel.addEventListener('click', ()=>{ if(window.deleteDrawSel) window.deleteDrawSel(); });
  function rotateDrawSel(d){
    const m=curMap(); const i=window.__drawSelIndex;
    if(!m||i<0||!(m.draw||[])[i]) return;
    const s=m.draw[i];
    s.rot=(((+s.rot||0)+d)%360+360)%360;
    saveMap(); renderMap();
  }
  const rl=document.getElementById('drawRotL'); if(rl) rl.addEventListener('click', ()=>rotateDrawSel(-15));
  const rr=document.getElementById('drawRotR'); if(rr) rr.addEventListener('click', ()=>rotateDrawSel(15));
  document.addEventListener('keydown', e=>{
    if(currentTab!=='map') return;
    const tag=(e.target&&e.target.tagName||'').toLowerCase();
    if(tag==='input'||tag==='textarea'||tag==='select'||(e.target&&e.target.isContentEditable)) return;
    if((e.key==='Delete'||e.key==='Backspace') && window.__drawSelIndex>=0){
      e.preventDefault();
      if(window.deleteDrawSel) window.deleteDrawSel();
    }
  });
  function closeAll(keep){
    bar.querySelectorAll('.map-menu').forEach(m=>{
      const p=m.querySelector('.menu-panel'), b=m.querySelector('.map-menu-btn');
      const open=(m===keep);
      if(p) p.classList.toggle('open', open);
      if(b) b.setAttribute('aria-expanded', open?'true':'false');
    });
  }
  bar.querySelectorAll('.map-menu').forEach(m=>{
    const b=m.querySelector('.map-menu-btn');
    if(!b) return;
    b.addEventListener('click', e=>{
      e.stopPropagation();
      const p=m.querySelector('.menu-panel');
      const willOpen = p && !p.classList.contains('open');
      closeAll(willOpen ? m : null);
    });
  });
  document.addEventListener('click', e=>{ if(!bar.contains(e.target)) closeAll(null); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeAll(null); });
})();
