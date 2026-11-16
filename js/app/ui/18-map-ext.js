/* ═══ Карта: отмена, калибровка, туман, слои, режим игрока ═══ */

/* ── Отмена и повтор действий на карте ── */
let mapUndoStack = [], mapRedoStack = [], mapLastFull = null, mapUndoBypass = false;
const MAP_UNDO_MAX = 30;
function mapStableJson(json){
  try{
    const arr = JSON.parse(json);
    if(Array.isArray(arr)) arr.forEach(m=>{ delete m.zoom; delete m.userZoom; delete m.scrollX; delete m.scrollY; });
    return JSON.stringify(arr);
  }catch(e){ return json; }
}
function updateMapUndoButtons(){
  const u = document.getElementById('mapUndo'), r = document.getElementById('mapRedo');
  if(u) u.disabled = !mapUndoStack.length;
  if(r) r.disabled = !mapRedoStack.length;
}
function mapUndoObserve(){
  if(mapUndoBypass) return;
  let cur; try{ cur = JSON.stringify(maps); }catch(e){ return; }
  if(mapLastFull === null){ mapLastFull = cur; updateMapUndoButtons(); return; }
  if(mapStableJson(cur) !== mapStableJson(mapLastFull)){
    mapUndoStack.push(mapLastFull);
    while(mapUndoStack.length > MAP_UNDO_MAX) mapUndoStack.shift();
    mapRedoStack.length = 0;
  }
  mapLastFull = cur;
  updateMapUndoButtons();
}
function mapApplySnapshot(json){
  let arr; try{ arr = JSON.parse(json); }catch(e){ return false; }
  if(!Array.isArray(arr)) return false;
  maps = arr;
  if(!maps.some(m=> m.id === activeMapId)) activeMapId = maps[0] ? maps[0].id : null;
  mapUndoBypass = true;
  try{ saveMap(); } finally { mapUndoBypass = false; }
  mapLastFull = JSON.stringify(maps);
  if(typeof selectedMarkerId !== 'undefined') selectedMarkerId = null;
  if(typeof selectedPropId !== 'undefined') selectedPropId = null;
  if(typeof rulerPts !== 'undefined') rulerPts = [];
  renderMap();
  updateMapUndoButtons();
  return true;
}
function mapUndoStep(){
  if(!mapUndoStack.length){ toast('Нечего отменять на карте'); return; }
  mapRedoStack.push(JSON.stringify(maps));
  const prev = mapUndoStack.pop();
  mapApplySnapshot(prev);
  toast('Действие на карте отменено');
}
function mapRedoStep(){
  if(!mapRedoStack.length) return;
  mapUndoStack.push(JSON.stringify(maps));
  const next = mapRedoStack.pop();
  mapApplySnapshot(next);
  toast('Действие повторено');
}
(function initMapUndo(){
  mapLastFull = JSON.stringify(maps);
  const u = document.getElementById('mapUndo'), r = document.getElementById('mapRedo');
  if(u) u.addEventListener('click', mapUndoStep);
  if(r) r.addEventListener('click', mapRedoStep);
  document.addEventListener('keydown', e=>{
    if(typeof currentTab === 'undefined' || currentTab !== 'map') return;
    if(!(e.ctrlKey || e.metaKey)) return;
    const k = String(e.key || '').toLowerCase();
    if(e.shiftKey && k === 'z'){ e.preventDefault(); mapRedoStep(); return; }
    if(k === 'y'){ e.preventDefault(); mapRedoStep(); }
  });
  updateMapUndoButtons();
})();

/* ── Калибровка сетки ── */
let mapCalibrateOn = false;
let mapCalPts = [];
function mapCalibrateReset(){
  mapCalibrateOn = false; mapCalPts = [];
  const btn = document.getElementById('mapCalibrate');
  if(btn) btn.classList.remove('active');
  const mc = document.getElementById('mapCanvas');
  if(mc) mc.classList.remove('calibrating');
}
(function bindGridCalibration(){
  const btn = document.getElementById('mapCalibrate');
  const mc = document.getElementById('mapCanvas');
  if(btn) btn.addEventListener('click', ()=>{
    mapCalibrateOn = !mapCalibrateOn;
    mapCalPts = [];
    btn.classList.toggle('active', mapCalibrateOn);
    if(mc) mc.classList.toggle('calibrating', mapCalibrateOn);
    toast(mapCalibrateOn ? 'Кликните первую точку на сетке' : 'Калибровка отменена');
  });
  if(mc){
    mc.addEventListener('pointerdown', e=>{
      if(!mapCalibrateOn) return;
      e.preventDefault(); e.stopPropagation();
    }, true);
    mc.addEventListener('click', e=>{
      if(!mapCalibrateOn) return;
      const m = curMap(); if(!m) return;
      const w = mc.querySelector('.map-zoom'); if(!w) return;
      const r = w.getBoundingClientRect();
      const z = mapFitScale(mc, m) * (m.userZoom||1);
      const x = (e.clientX - r.left) / z;
      const y = (e.clientY - r.top) / z;
      if(x < 0 || y < 0 || x > m.baseW || y > m.baseH) return;
      e.preventDefault(); e.stopPropagation();
      mapCalPts.push({x, y});
      if(mapCalPts.length === 1){ toast('Точка 1. Теперь вторая точка сетки'); return; }
      const p1 = mapCalPts[0], p2 = mapCalPts[1];
      mapCalPts = [];
      mapCalibrateReset();
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if(dist < 4){ toast('Точки слишком близко — попробуйте ещё раз'); return; }
      uiPrompt('Расстояние между точками в футах:', '30', {title:'Калибровка сетки'}).then(v=>{
        const feet = parseFloat(String(v==null?'':v).replace(',', '.'));
        if(!feet || feet <= 0) return;
        const cells = feet / Math.max(1, m.feetPerCell || 5);
        const cellPx = Math.max(12, Math.min(160, dist / cells));
        m.cellPx = Math.round(cellPx * 10) / 10;
        m.cellOffX = ((p1.x % cellPx) + cellPx) % cellPx;
        m.cellOffY = ((p1.y % cellPx) + cellPx) % cellPx;
        saveMap(); renderMap();
        toast('Сетка подогнана: клетка ' + Math.round(cellPx) + ' px, смещение ' + Math.round(m.cellOffX) + '/' + Math.round(m.cellOffY));
      });
    }, true);
  }
  const ox = document.getElementById('mapGridOffX');
  const oy = document.getElementById('mapGridOffY');
  function applyOffsets(){
    const m = curMap(); if(!m) return;
    m.cellOffX = Math.max(-240, Math.min(240, Math.round(+ox.value) || 0));
    m.cellOffY = Math.max(-240, Math.min(240, Math.round(+oy.value) || 0));
    saveMap(); renderMap();
  }
  if(ox) ox.addEventListener('change', applyOffsets);
  if(oy) oy.addEventListener('change', applyOffsets);
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && mapCalibrateOn){ mapCalibrateReset(); toast('Калибровка отменена'); }
  });
})();

/* ── Туман: скрыть/открыть всё и открытие комнатой ── */
let mapFogRoomOn = false;
function rotatePt(px, py, cx, cy, deg){
  const a = (deg||0) * Math.PI / 180;
  const dx = px-cx, dy = py-cy;
  return [cx + dx*Math.cos(a) - dy*Math.sin(a), cy + dx*Math.sin(a) + dy*Math.cos(a)];
}
function unrotatePt(px, py, cx, cy, deg){
  return rotatePt(px, py, cx, cy, -(deg||0));
}
function pointInPoly(px, py, pts){
  let inside = false;
  for(let i=0, j=pts.length-1; i<pts.length; j=i++){
    const xi=pts[i][0], yi=pts[i][1], xj=pts[j][0], yj=pts[j][1];
    if(((yi>py)!==(yj>py)) && (px < (xj-xi)*(py-yi)/(yj-yi)+xi)) inside = !inside;
  }
  return inside;
}
function distToSeg(px, py, ax, ay, bx, by){
  const dx=bx-ax, dy=by-ay;
  const len2=dx*dx+dy*dy;
  let t = len2 ? ((px-ax)*dx+(py-ay)*dy)/len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px-(ax+t*dx), py-(ay+t*dy));
}
function roomFogShapeAt(m, x, y){
  const list = (m.draw||[]).slice().reverse();
  for(const s of list){
    if(s.type==='rect'){
      const cx=s.x+s.w/2, cy=s.y+s.h/2;
      const p=unrotatePt(x,y,cx,cy,s.rot||0);
      if(p[0]>=s.x && p[0]<=s.x+s.w && p[1]>=s.y && p[1]<=s.y+s.h){
        const pts=[[s.x,s.y],[s.x+s.w,s.y],[s.x+s.w,s.y+s.h],[s.x,s.y+s.h]]
          .map(q=>rotatePt(q[0],q[1],cx,cy,s.rot||0));
        return {kind:'fill', pts};
      }
    } else if(s.type==='ellipse'){
      const cx=s.x+s.w/2, cy=s.y+s.h/2;
      const p=unrotatePt(x,y,cx,cy,s.rot||0);
      const rx=Math.max(1,s.w/2), ry=Math.max(1,s.h/2);
      if(((p[0]-cx)/rx)**2 + ((p[1]-cy)/ry)**2 <= 1){
        const pts=[];
        for(let i=0;i<40;i++){
          const a=i/40*Math.PI*2;
          pts.push(rotatePt(cx+Math.cos(a)*rx, cy+Math.sin(a)*ry, cx, cy, s.rot||0));
        }
        return {kind:'fill', pts};
      }
    } else if(s.type==='poly'){
      const pts=s.pts||[];
      if(pts.length>=3){
        // грубая проверка без учёта поворота: полигоны комнат обычно не поворачивают
        if(pointInPoly(x,y,pts)) return {kind:'fill', pts};
      }
    } else if(s.type==='cpath'){
      const pts=s.pts||[];
      const half=Math.max(2,(+s.w||20)/2);
      for(let i=1;i<pts.length;i++){
        if(distToSeg(x,y,pts[i-1][0],pts[i-1][1],pts[i][0],pts[i][1]) <= half){
          return {kind:'stroke', pts, width:s.w};
        }
      }
      if(pts.length===1 && Math.hypot(x-pts[0][0],y-pts[0][1])<=half) return {kind:'stroke', pts, width:s.w};
    }
  }
  return null;
}
function mapFogRoomReset(){
  mapFogRoomOn = false;
  const b=document.getElementById('mapFogRoom'); if(b) b.classList.remove('active');
  const mc=document.getElementById('mapCanvas'); if(mc) mc.classList.remove('fog-room');
}
(function bindFogTools(){
  const hideAll=document.getElementById('mapFogHideAll');
  const showAll=document.getElementById('mapFogShowAll');
  const roomBtn=document.getElementById('mapFogRoom');
  const mc=document.getElementById('mapCanvas');
  if(hideAll) hideAll.addEventListener('click', ()=>{
    const m=curMap(); if(!m) return;
    m.fogOn=true;
    m.fog=[{ mode:'hide', type:'fill', width:0, pts:[[0,0],[m.baseW,0],[m.baseW,m.baseH],[0,m.baseH]] }];
    saveMap(); renderMap(); toast('Вся карта закрыта туманом');
  });
  if(showAll) showAll.addEventListener('click', ()=>{
    const m=curMap(); if(!m) return;
    m.fog=[]; m.fogOn=false;
    saveMap(); renderMap(); toast('Туман убран со всей карты');
    mapFogRoomReset();
  });
  if(roomBtn) roomBtn.addEventListener('click', ()=>{
    const m=curMap(); if(!m) return;
    mapFogRoomOn=!mapFogRoomOn;
    roomBtn.classList.toggle('active', mapFogRoomOn);
    if(mc) mc.classList.toggle('fog-room', mapFogRoomOn);
    toast(mapFogRoomOn ? 'Кликните по нарисованной комнате, чтобы открыть её' : 'Открытие комнатой выключено');
  });
  if(mc){
    mc.addEventListener('pointerdown', e=>{
      if(!mapFogRoomOn) return;
      e.preventDefault(); e.stopPropagation();
    }, true);
    mc.addEventListener('click', e=>{
      if(!mapFogRoomOn) return;
      const m=curMap(); if(!m) return;
      if(!m.fogOn){ toast('Сначала нажмите «Скрыть всё» или включите туман'); return; }
      const w=mc.querySelector('.map-zoom'); if(!w) return;
      const r=w.getBoundingClientRect();
      const z=mapFitScale(mc,m) * (m.userZoom||1);
      const x=(e.clientX-r.left)/z, y=(e.clientY-r.top)/z;
      e.preventDefault(); e.stopPropagation();
      const sh=roomFogShapeAt(m,x,y);
      if(!sh){ toast('Комната не найдена — кликните внутри нарисованной комнаты'); return; }
      m.fog=m.fog||[];
      if(sh.kind==='fill') m.fog.push({ mode:'reveal', type:'fill', width:0, pts:sh.pts });
      else m.fog.push({ mode:'reveal', type:'stroke', width:sh.width||20, pts:sh.pts });
      saveMap(); renderMap();
      toast('Комната открыта');
    }, true);
  }
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape' && mapFogRoomOn){ mapFogRoomReset(); toast('Открытие комнатой выключено'); }
  });
})();

/* ── Мультивыделение и слои ── */
let mapMultiSel = new Set();
function mapLayerMove(arr, id, toFront){
  const i=(arr||[]).findIndex(x=>x.id===id);
  if(i<0) return false;
  const j = toFront ? arr.length-1 : 0;
  if(i===j) return false;
  const [it]=arr.splice(i,1);
  arr.splice(j,0,it);
  return true;
}
(function bindMultiAndLayers(){
  document.addEventListener('keydown', e=>{
    if(typeof currentTab==='undefined' || currentTab!=='map') return;
    if(e.key!=='Delete' && e.key!=='Backspace') return;
    const t=e.target;
    if(t && (t.closest('input,textarea,select') || t.isContentEditable)) return;
    if(!mapMultiSel.size) return;
    const m=curMap(); if(!m) return;
    e.preventDefault();
    m.markers=(m.markers||[]).filter(k=>!mapMultiSel.has(k.id));
    m.props=(m.props||[]).filter(p=>!mapMultiSel.has(p.id));
    mapMultiSel.clear();
    if(typeof selectedMarkerId!=='undefined') selectedMarkerId=null;
    if(typeof selectedPropId!=='undefined') selectedPropId=null;
    saveMap(); renderMap(); updateMapUndoButtons();
  });
  const bind=(id, fn)=>{
    const el=document.getElementById(id);
    if(el) el.addEventListener('click', fn);
  };
  bind('tokenFront', ()=>{
    const m=curMap(); if(!m||!selectedMarkerId) return;
    if(mapLayerMove(m.markers, selectedMarkerId, true)){ saveMap(); renderMap(); }
  });
  bind('tokenBack', ()=>{
    const m=curMap(); if(!m||!selectedMarkerId) return;
    if(mapLayerMove(m.markers, selectedMarkerId, false)){ saveMap(); renderMap(); }
  });
  bind('propFront', ()=>{
    const m=curMap(); if(!m||!selectedPropId) return;
    if(mapLayerMove(m.props, selectedPropId, true)){ saveMap(); renderMap(); }
  });
  bind('propBack', ()=>{
    const m=curMap(); if(!m||!selectedPropId) return;
    if(mapLayerMove(m.props, selectedPropId, false)){ saveMap(); renderMap(); }
  });
  bind('drawFront', ()=>{
    const m=curMap(); const i=(typeof window.__drawSelIndex==='number')?window.__drawSelIndex:-1;
    if(!m || i<0 || i>=m.draw.length) return;
    const [it]=m.draw.splice(i,1); m.draw.push(it); window.__drawSelIndex=m.draw.length-1;
    saveMap(); renderMap();
  });
  bind('drawBack', ()=>{
    const m=curMap(); const i=(typeof window.__drawSelIndex==='number')?window.__drawSelIndex:-1;
    if(!m || i<0 || i>=m.draw.length) return;
    const [it]=m.draw.splice(i,1); m.draw.unshift(it); window.__drawSelIndex=0;
    saveMap(); renderMap();
  });
})();

/* ── Токены: состояния, скрытие и «В бой» ── */
(function bindTokenExtras(){
  const conds=document.getElementById('tokenConds');
  if(conds) conds.addEventListener('change', e=>{
    const c=e.target.dataset.tcond; if(!c) return;
    const k=curToken(); if(!k) return;
    k.conds=Array.isArray(k.conds)?k.conds.slice():[];
    if(e.target.checked){ if(!k.conds.includes(c)) k.conds.push(c); }
    else k.conds=k.conds.filter(x=>x!==c);
    saveMap(); renderMap();
  });
  const hd=document.getElementById('tokenHidden');
  if(hd) hd.addEventListener('change', ()=>{
    const k=curToken(); if(!k) return;
    k.hidden=!!hd.checked;
    saveMap(); renderMap();
  });
  const tb=document.getElementById('tokenToBattle');
  if(tb) tb.addEventListener('click', ()=>{
    const k=curToken(); if(!k) return;
    const b=k.blockId?findBlock(k.blockId):null;
    if(!b){ toast('Токен не связан с карточкой'); return; }
    if(typeof battleParts!=='undefined' && battleParts.some(p=>p.srcId===b.id)){ toast('Этот участник уже в бою'); return; }
    if(typeof addBlockToBattle!=='function'){ toast('Боевой трекер недоступен'); return; }
    addBlockToBattle(b);
    toast('«'+(b.title||'Токен')+'» добавлен в бой');
  });
})();

/* ── Режим игрока ── */
let mapPresentOn = false;
function mapPresentSet(on){
  mapPresentOn=!!on;
  document.body.classList.toggle('map-present', mapPresentOn);
  const btn=document.getElementById('mapPresent');
  if(btn) btn.classList.toggle('active', mapPresentOn);
  const ex=document.getElementById('mapPresentExit');
  if(ex) ex.hidden=!mapPresentOn;
  renderMap();
  toast(mapPresentOn?'Режим игрока: интерфейс скрыт, скрытые токены не видны':'Режим игрока выключен');
}
(function bindPlayerMode(){
  const btn=document.getElementById('mapPresent');
  if(btn) btn.addEventListener('click', ()=> mapPresentSet(!mapPresentOn));
  const ex=document.getElementById('mapPresentExit');
  if(ex) ex.addEventListener('click', ()=> mapPresentSet(false));
  document.addEventListener('keydown', e=>{
    if(e.key==='Escape' && mapPresentOn){ mapPresentSet(false); }
  });
})();

/* ── Линейка: сброс маршрута по Esc ── */
document.addEventListener('keydown', e=>{
  if(e.key!=='Escape' || typeof mapRulerOn==='undefined' || !mapRulerOn) return;
  rulerPts=[];
  const l=document.getElementById('mapRulerLabel');
  if(l){ l.hidden=false; l.textContent='Кликните точку маршрута'; }
  renderMap();
});

/* ── Переход с карточки к метке на карте ── */
function openMapMarker(mapId, markerId){
  const m=(typeof maps!=='undefined') ? maps.find(x=>x.id===mapId) : null;
  if(!m) return;
  activeMapId=mapId;
  if(typeof selectedMarkerId!=='undefined') selectedMarkerId=markerId;
  showTab('map');
  renderMap();
  setTimeout(()=>{
    const el=document.querySelector('#mapCanvas [data-id="'+markerId+'"]');
    if(!el) return;
    el.scrollIntoView({block:'center', inline:'center'});
    el.classList.add('flash');
    setTimeout(()=>el.classList.remove('flash'),1500);
  }, 90);
}

/* ── Мягкий край тумана ── */
(function bindFogSoft(){
  const cb=document.getElementById('mapFogSoft');
  if(!cb) return;
  cb.addEventListener('change', ()=>{
    const m=curMap(); if(!m) return;
    m.fogSoft=!!cb.checked;
    saveMap(); renderMap();
  });
})();
