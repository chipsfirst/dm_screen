/* ═══ Делегирование событий канваса ═══
   Один набор слушателей на #canvas вместо повторного биндинга после каждого рендера;
   карточки обновляются точечно через renderBlockOnly(). */
let canvasEventsInited = false;
function initCanvasEvents(){
  if(canvasEventsInited) return;
  canvasEventsInited = true;
  // Импорт файлов перетаскиванием на холст
  const canvasEl = document.getElementById('canvas');
  if(canvasEl){
    ['dragover','dragenter'].forEach(ev => canvasEl.addEventListener(ev, e=>{
      if(e.dataTransfer && Array.from(e.dataTransfer.types||[]).includes('Files')) e.preventDefault();
    }));
    canvasEl.addEventListener('drop', e=>{
      const dt = e.dataTransfer; if(!dt) return;
      const files = Array.from(dt.files||[]);
      if(!files.length) return;
      e.preventDefault();
      files.forEach(f=> importFile(f));
    });
  }
  const canvas = document.getElementById('canvas');

  canvas.addEventListener('click', e=>{
    const t = e.target;
    // клик по заголовку блока — свернуть/развернуть
    if(t.closest('[data-toggle]') && !t.closest('.block-title') && !t.closest('[data-action]')){
      const blockEl=t.closest('.block');
      if(blockEl) toggleBlock(blockEl.dataset.id);
      return;
    }
    if(t.closest('.block-title')) return; // contenteditable: сама обрабатывает
    const statMod = t.closest('.stat .mod');
    if(statMod){
      const b=findBlock(statMod.dataset.rollId); if(!b) return;
      const idx=ITEMS_FOR_9.indexOf(statMod.dataset.rollStat);
      const m=idx>=0?modf(b.stats[idx]):0;
      doRoll('d20',1, (m>=0?`+${m}`:m));
      return;
    }
    const rollAll = t.closest('[data-action="rollAll"]');
    if(rollAll){
      const b=findBlock(rollAll.dataset.rollId); if(!b) return;
      let out='';
      b.stats.forEach((s,i)=>{ out+=`${ITEMS_FOR_9[i]}: ${doOneD20()+modf(s)}  `; });
      document.getElementById('rollResult').textContent = 'Бросок всех: '+out;
      rollHistory.push('Бросок всех ПК: '+out);
      return;
    }
    const hpBtn = t.closest('[data-hp-op]');
    if(hpBtn){ hpApply(hpBtn.dataset.hpId, hpBtn.dataset.hpOp); return; }
    const hpIn = t.closest('[data-hp-in]') || t.closest('.hp-dmg-in');
    // кнопки действий блока: delete / collapse / expand
    const act = t.closest('[data-action]');
    if(act){
      const blockEl=act.closest('.block'); if(!blockEl) return;
      const id = act.dataset.id || blockEl.dataset.id;
      if(act.dataset.action==='delete'){ uiConfirm('Удалить блок?').then(ok=>{ if(ok) removeBlock(id); }); }
      else if(act.dataset.action==='collapse'){ collapsed.add(id); renderBlockOnly(id); save(); }
      else if(act.dataset.action==='expand'){ collapsed.delete(id); renderBlockOnly(id); save(); }
      else if(act.dataset.action==='battle'){ addBlockToBattle(findBlock(act.dataset.battleId)); }
      else if(act.dataset.action==='map'){ addBlockToMap(findBlock(act.dataset.mapId)); }
      return;
    }
    const resBtn = t.closest('[data-res-op]');
    if(resBtn){
      const r=findBlockRes(resBtn.dataset.resId, +resBtn.dataset.resI); if(!r) return;
      r.cur = resBtn.dataset.resOp==='inc'
        ? Math.min(r.max, r.cur+1)
        : Math.max(0, r.cur-1);
      const chip=resBtn.closest('.res-chip');
      const valEl=chip && chip.querySelector('.res-val');
      if(valEl) valEl.textContent = `${r.cur}/${r.max}`;
      if(chip) chip.classList.toggle('empty', r.cur<=0);
      save();
      return;
    }
    const resAdd = t.closest('[data-res-add]');
    if(resAdd){
      const b=findBlock(resAdd.dataset.resAdd); if(!b) return;
      if(!Array.isArray(b.res)) b.res=[];
      b.res.push({ name:'Ресурс', cur:3, max:3 });
      if(b.res.length>20) b.res.shift();
      save(); renderBlockOnly(b.id);
      return;
    }
    const resDel = t.closest('[data-res-del]');
    if(resDel){
      const b=findBlock(resDel.dataset.resDel); if(!b) return;
      b.res.splice(+resDel.dataset.resI, 1);
      save(); renderBlockOnly(b.id);
      return;
    }
  });

  canvas.addEventListener('input', e=>{
    const t = e.target;
    if(t.matches('[data-field="text"]')){
      const b=findBlock(t.dataset.id); if(b){ b.text=t.value; save(); }
      return;
    }
    if(t.matches('[data-attack]')){
      const b=findBlock(t.dataset.attack); if(b){ b.attack=t.value; save(); }
      return;
    }
    if(t.matches('[data-damage]')){
      const b=findBlock(t.dataset.damage); if(b){ b.damage=t.value; save(); }
      return;
    }
    if(t.matches('.stat input.val')){
      const b=findBlock(t.dataset.statsId); if(!b) return;
      const idx=+t.dataset.statIndex;
      b.stats[idx]=Math.max(1,Math.min(30,parseInt(t.value)||10));
      const modEl=t.parentElement.querySelector('.mod');
      if(modEl) modEl.textContent = signed(Math.floor((b.stats[idx]-10)/2));
      save();
      return;
    }
    if(t.matches('.prop input.v')){
      const b=findBlock(t.dataset.propId); if(!b) return;
      b.props[t.dataset.propKey]=t.value; save();
      return;
    }
  });

  canvas.addEventListener('change', e=>{
    const t = e.target;
    if(t.matches('.stat input.val')){
      const b=findBlock(t.dataset.statsId); if(!b) return;
      const idx=+t.dataset.statIndex;
      const v=Math.max(1,Math.min(30,parseInt(t.value)||10));
      b.stats[idx]=v; t.value=v; save();
      return;
    }
    if(t.matches('[data-width]')){
      const b=findBlock(t.dataset.width); if(!b) return;
      const v=Math.max(180,Math.min(1600,parseInt(t.value)||820));
      t.value=v; b.w=v; save();
      const el=document.querySelector('.block[data-id="'+t.dataset.width+'"]');
      if(el) el.style.width=v+'px';
      return;
    }
    if(t.matches('.hp-dmg-in')){
      hpInputDamage(t);
      return;
    }
  });

  canvas.addEventListener('focusout', e=>{
    const t = e.target;
    if(t.matches('.block-title')){
      const b=findBlock(t.dataset.title); if(!b) return;
      const val=t.textContent.trim();
      if(!val){ t.textContent=b.title||''; return; }
      b.title=val; save(); render();
      return;
    }
    if(t.matches('[data-res-name]')){
      const b=findBlock(t.dataset.resName); if(!b) return;
      const r=(b.res||[])[+t.dataset.resI]; if(!r) return;
      r.name = t.textContent.trim().slice(0,40) || 'Ресурс';
      save();
      return;
    }
  });

  canvas.addEventListener('keydown', e=>{
    const t = e.target;
    if((t.matches('.block-title') || t.matches('[data-res-name]')) && e.key==='Enter'){ e.preventDefault(); t.blur(); }
    if(t.matches('.hp-dmg-in') && e.key==='Enter'){ e.preventDefault(); t.blur(); }
  });

  canvas.addEventListener('mousedown', e=>{
    const t = e.target;
    // переименование не должно начинать drag
    if(t.closest('.block-title') || t.closest('[data-res-name]')){ e.stopPropagation(); return; }
    if(t.closest('select,input,textarea,a,button')) return;
    const handle = t.closest('[data-resize]');
    if(handle){ startBlockResize(e, handle); return; }
    if(freeLayout){
      const head = t.closest('.block-head');
      if(head) startBlockDrag(e, head);
    }
  });
}

/* Точечная перерисовка одной карточки (и внешнего wrapper в свободном холсте) */
function renderBlockOnly(id){
  const b=findBlock(id); if(!b) return;
  const el=document.querySelector('#canvas .block[data-id="'+id+'"]');
  if(!el){ render(); return; }
  const freeWrap = freeLayout ? el.parentElement : null;
  if(freeWrap && freeWrap.classList.contains('canvas-free-wrap')){
    freeWrap.innerHTML = blockCard(b);
    freeWrap.style.width = (b.w||360)+'px';
  } else {
    el.outerHTML = blockCard(b);
  }
}
function startBlockResize(e, handle){
  e.stopPropagation();
  const block=handle.closest('.block'), id=block.dataset.id, b=findBlock(id); if(!b) return;
  const startX=e.clientX, startW=b.w||block.offsetWidth||820;
  block.classList.add('dragging');
  pointerDrag(e, ev=>{
    const nw=Math.max(180,Math.min(1600, startW + (ev.clientX-startX)));
    block.style.width=nw+'px'; b.w=nw;
  }, ()=>{
    block.classList.remove('dragging'); save();
    const inp=block.querySelector('.resize-input'); if(inp) inp.value=b.w;
  });
}
function startBlockDrag(e, head){
  const block=head.closest('.block');
  const id=block.dataset.id, wrap=block.parentElement, b=findBlock(id); if(!b) return;
  const startX=e.clientX, startY=e.clientY;
  const ox=b.x!=null?b.x:wrap.offsetLeft, oy=b.y!=null?b.y:wrap.offsetTop;
  block.classList.add('dragging');
  b._z = Math.max(1,(b._z||0)+1); wrap.style.zIndex=b._z;
  pointerDrag(e, ev=>{
    b.x = Math.max(0, ox+(ev.clientX-startX)); b.y = Math.max(0, oy+(ev.clientY-startY));
    wrap.style.left=b.x+'px'; wrap.style.top=b.y+'px';
  }, ()=>{ block.classList.remove('dragging'); save(); });
}
function toggleBlock(id){
  if(collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
  renderBlockOnly(id);
  save();
}
function removeBlock(id){
  const victim=blocks.find(b=>b.id===id);
  pushUndo('удаление блока «'+((victim&&victim.title)||'')+'»');
  blocks = blocks.filter(b=>b.id!==id);
  blocks.forEach(b=>{ b.links = b.links.filter(x=>x!==id); });
  if(activeParentId===id) activeParentId=null;
  save(); render();
}

/* ═══ Layout toggle (кнопка убрана, режим всегда «лента») ═══ */

/* ═══ Темы ═══ */
const THEME_KEY = 'shirma_theme_v1';
const THEMES = [
  { id:'dark',      name:'Золотая тьма'  },
  { id:'light',     name:'Пергамент'     },
  { id:'matrix',    name:'Матрица'       },
  { id:'dracula',   name:'Dracula'       },
  { id:'nord',      name:'Nord'          },
  { id:'solarized', name:'Solarized Dark'},
  { id:'gruvbox',   name:'Gruvbox'       },
  { id:'monokai',   name:'Monokai'       },
  { id:'tokyo',     name:'Tokyo Night'   },
  { id:'onedark',   name:'One Dark'      },
];
function themeById(id){ return THEMES.find(t=> t.id===id) || null; }
function applyTheme(t){
  const th = themeById(t) || themeById('dark');
  if(th.id === 'dark') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', th.id);
  const b = document.getElementById('btnTheme');
  if(b){
    b.title = 'Тема: '+th.name;
    b.setAttribute('aria-label', 'Тема: '+th.name);
  }
  try{
    document.querySelectorAll('[data-theme-pick]').forEach(el=>{
      const id = el && el.dataset ? el.dataset.themePick : null;
      if(!id) return;
      el.classList.toggle('active', id === th.id);
      el.setAttribute('aria-checked', id === th.id ? 'true' : 'false');
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if(meta){
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
      if(bg) meta.setAttribute('content', bg);
    }
  }catch(e){}
}
function currentTheme(){
  try{
    const t = localStorage.getItem(THEME_KEY);
    return themeById(t) ? t : 'light';     // по умолчанию — светлая «пергаментная» тема
  }catch(e){ return 'light'; }
}
function setTheme(id){
  if(!themeById(id)) return;
  try{ localStorage.setItem(THEME_KEY, id); }catch(e){}
  applyTheme(id);
}
(function(){
  applyTheme(currentTheme());
  const b = document.getElementById('btnTheme');
  const menu = document.getElementById('themeMenu');
  if(!b || !menu) return;
  const close = ()=>{ menu.classList.remove('open'); b.setAttribute('aria-expanded','false'); };
  b.addEventListener('click', e=>{
    if(e && e.stopPropagation) e.stopPropagation();
    const open = menu.classList.toggle('open');
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  menu.addEventListener('click', e=>{
    const item = e.target && e.target.closest ? e.target.closest('[data-theme-pick]') : null;
    if(!item) return;
    setTheme(item.dataset.themePick);
    close();
  });
  document.addEventListener('click', e=>{
    if(!menu.classList.contains('open')) return;
    const t = e && e.target;
    if(menu.contains(t) || b.contains(t)) return;
    close();
  });
  document.addEventListener('keydown', e=>{ if(e && e.key === 'Escape') close(); });
})();

/* ═══ Масштаб интерфейса (шрифт всей ширмы) ═══ */
const ZOOM_KEY = 'shirma_ui_zoom_v1';
function uiZoomGet(){
  let v = 1;
  try{ v = parseFloat(localStorage.getItem(ZOOM_KEY)) || 1; }catch(e){}
  return Math.min(1.6, Math.max(0.8, v));
}
function uiZoomApply(v){
  const z = Math.min(1.6, Math.max(0.8, Math.round(v*100)/100));
  const target = document.body || document.documentElement;
  target.style.zoom = String(z);
  try{ localStorage.setItem(ZOOM_KEY, String(z)); }catch(e){}
  const b=document.getElementById('btnFontPlus'), m=document.getElementById('btnFontMinus');
  if(m) m.disabled = z<=0.8;
  if(b) b.disabled = z>=1.6;
  // перерисовываем карту отложенно: на старте currentTab ещё не объявлен
  setTimeout(()=>{ try{
    const vm=document.getElementById('view-map');
    if(vm && !vm.hidden) renderMap();
  }catch(e){} }, 0);
  return z;
}
(function(){
  try{ uiZoomApply(uiZoomGet()); }catch(e){ /* масштаб не должен ломать запуск */ }
  const plus=document.getElementById('btnFontPlus');
  const minus=document.getElementById('btnFontMinus');
  if(plus) plus.addEventListener('click', ()=> uiZoomApply(uiZoomGet()+0.05));
  if(minus) minus.addEventListener('click', ()=> uiZoomApply(uiZoomGet()-0.05));
  document.addEventListener('keydown', e=>{
    if(!(e.ctrlKey||e.metaKey)) return;
    if(e.key==='='||e.key==='+'){ e.preventDefault(); uiZoomApply(uiZoomGet()+0.05); }
    else if(e.key==='-'){ e.preventDefault(); uiZoomApply(uiZoomGet()-0.05); }
    else if(e.key==='0'){ e.preventDefault(); uiZoomApply(1); }
  });
})();

/* ═══ Полноэкранный режим ═══ */
(function(){
  const btn=document.getElementById('btnFullscreen');
  if(!btn) return;
  function ref(){
    btn.textContent = document.fullscreenElement ? '⛶' : '⛶';
    btn.title = document.fullscreenElement? 'Выйти из полноэкранного режима' : 'Полноэкранный режим';
  }
  btn.addEventListener('click', ()=>{
    if(document.fullscreenElement){ document.exitFullscreen&&document.exitFullscreen().catch(()=>{}); }
    else { const el=document.documentElement; (el.requestFullscreen||el.webkitRequestFullscreen||function(){}).call(el); }
  });
  document.addEventListener('fullscreenchange', ref);
  document.addEventListener('webkitfullscreenchange', ref);
})();

/* ═══ Меню команд (☰) ═══ */
(function(){
  const btn=document.getElementById('btnMenu');
  const panel=document.getElementById('menuPanel');
  if(!btn||!panel) return;
  btn.addEventListener('click', e=>{ e.stopPropagation(); panel.classList.toggle('open'); });
  document.addEventListener('click', e=>{ if(!e.target.closest('.menu-wrap')) panel.classList.remove('open'); });
  panel.addEventListener('click', ()=> panel.classList.remove('open'));
})();

/* ═══ Верхняя панель больше не сворачивается — сбрасываем сохранённое состояние ═══ */
(function(){
  try{ localStorage.removeItem('shirma_topcollapsed_v1'); }catch(e){}
  document.body.classList.remove('top-collapsed');
})();

/* ═══ Звуки (Web Audio, синтез — файлов нет) ═══ */
const SOUND_KEY = 'shirma_sound_v1';
let soundOn = true;
try{ soundOn = localStorage.getItem(SOUND_KEY)!=='0'; }catch(e){}
let audioCtx = null;
function audioReady(){
  try{
    if(!soundOn) return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    if(!audioCtx) audioCtx = new AC();
    if(audioCtx.state==='suspended') audioCtx.resume();
    return audioCtx;
  }catch(e){ return null; }
}
function beep(freq, dur, type, vol, delay){
  try{
    const ctx=audioReady(); if(!ctx) return;
    const t0 = ctx.currentTime + (delay||0);
    const o=ctx.createOscillator(), g=ctx.createGain();
    o.type = type||'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol||0.07, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0+dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t0); o.stop(t0+dur+0.05);
  }catch(e){}
}
function playSound(name){
  if(!soundOn) return;
  if(name==='turn'){ beep(500,.08,'triangle'); beep(760,.11,'triangle',.05,.08); }
  else if(name==='crit'){ beep(660,.09,'square',.05); beep(880,.09,'square',.05,.09); beep(1320,.16,'square',.04,.18); }
  else if(name==='tick'){ beep(880,.04,'sine',.03); }
  else if(name==='round'){ beep(560,.09,'sine'); beep(560,.09,'sine',.06,.15); }
  else if(name==='ding'){ beep(980,.14,'sine'); beep(1470,.22,'sine',.05,.12); }
}
const soundBtn = document.getElementById('btnSound');
function soundBtnState(){ if(soundBtn){ soundBtn.innerHTML = gi('effects'); soundBtn.title = soundOn?'Звуки включены (клик — выключить)':'Звуки выключены (клик — включить)'; } }
if(soundBtn) soundBtn.addEventListener('click', ()=>{
  soundOn=!soundOn;
  try{ localStorage.setItem(SOUND_KEY, soundOn?'1':'0'); }catch(e){}
  soundBtnState();
  toast(soundOn?'Звуки включены':'Звуки выключены');
});
soundBtnState();

/* ═══ Таймер боя: 1 раунд = 6 секунд ═══ */
let timerRunning=false, timerSeconds=0, timerInterval=null;
const timerBtn = document.getElementById('btnTimer');
const timerLbl = document.createElement('span');
timerLbl.className='hint'; timerLbl.id='timerLabel';
if(timerBtn && timerBtn.parentElement) timerBtn.parentElement.insertBefore(timerLbl, timerBtn.nextSibling);
function paintTimer(){
  const rounds=Math.floor(timerSeconds/6), s=timerSeconds%6;
  timerLbl.textContent = timerRunning
    ? `раунд ${rounds+1} · ${s}с`
    : (timerSeconds ? `таймер: ${timerSeconds}с (${rounds+1} раунд)` : '');
}
function timerToggle(){
  if(timerRunning){
    clearInterval(timerInterval); timerRunning=false;
    playSound('ding'); toast('Таймер остановлен');
  } else {
    audioReady();
    timerRunning=true;
    timerInterval=setInterval(()=>{
      timerSeconds++;
      const roundTick = timerSeconds%6===0;
      paintTimer();
      if(roundTick) playSound('round'); else playSound('tick');
    },1000);
    toast('Секундомер боя: 1 раунд = 6 секунд');
  }
  if(timerBtn) timerBtn.textContent = timerRunning?'⏹':'⏱ 6с';
  paintTimer();
}
if(timerBtn) timerBtn.addEventListener('click', timerToggle);

/* ═══ Вид карточек: обычные / компактные / плотная сетка ═══ */
const DENSITY_KEY = 'shirma_density_v1';
const DENSITY_MODES = ['', 'compact'];
const DENSITY_LABEL = { '': 'Обычные карточки', compact: 'Компактные карточки' };
function applyDensity(v){
  if(v === 'compact') document.documentElement.setAttribute('data-density', v);
  else document.documentElement.removeAttribute('data-density');
}
(function(){
  let v = '';
  try{ v = localStorage.getItem(DENSITY_KEY) || ''; }catch(e){}
  if(DENSITY_MODES.indexOf(v) < 0) v = '';
  applyDensity(v);
})();
(function(){
  const btn = document.getElementById('btnDensity');
  if(!btn) return;
  const cur = ()=> document.documentElement.getAttribute('data-density') || '';
  const sync = ()=>{
    const v = cur();
    btn.setAttribute('aria-pressed', v ? 'true' : 'false');
    btn.title = 'Вид карточек: ' + (DENSITY_LABEL[v] || DENSITY_LABEL['']);
  };
  sync();
  btn.addEventListener('click', ()=>{
    const v = cur();
    const next = DENSITY_MODES[(DENSITY_MODES.indexOf(v) + 1) % DENSITY_MODES.length];
    applyDensity(next);
    try{ localStorage.setItem(DENSITY_KEY, next); }catch(e){}
    sync();
    toast(DENSITY_LABEL[next]);
  });
})();
