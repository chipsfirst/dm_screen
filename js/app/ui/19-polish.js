/* ════════════ Полировка интерфейса: быстрый старт, пустые состояния, режимы карты ════════════ */
(function quickStart(){
  const card = document.getElementById('homeQuickStart');
  const list = document.getElementById('qsList');
  if(!card || !list) return;
  const bar = document.getElementById('qsBar');
  const lead = document.getElementById('qsLead');
  const doneMsg = document.getElementById('qsDone');
  const hideBtn = document.getElementById('qsHide');
  const showBtn = document.getElementById('qsShow');
  const HIDE_KEY = 'shirma_quickstart_hidden_v1';
  let forceTraining = false;

  function readSessions(){
    if(typeof sessions !== 'undefined' && sessionsInited) return sessions.length;
    try{
      const a = JSON.parse(localStorage.getItem('shirma_sessions_v1') || '[]');
      return Array.isArray(a) ? a.length : 0;
    }catch(e){ return 0; }
  }
  function isSample(title){
    try{ return typeof SAMPLES !== 'undefined' && SAMPLES.some(s=> s.title === title); }
    catch(e){ return false; }
  }
  function data(){
    const bs = (typeof blocks !== 'undefined' && Array.isArray(blocks)) ? blocks : [];
    const ms = (typeof maps !== 'undefined' && Array.isArray(maps)) ? maps : [];
    const bp = (typeof battleParts !== 'undefined' && Array.isArray(battleParts)) ? battleParts : [];
    return {
      pc: bs.some(b=> b.type==='pc' && !isSample(b.title)),
      mob: bs.some(b=> b.type==='mob'),
      session: readSessions() > 0,
      map: ms.length > 0,
      battle: bp.length > 0
    };
  }
  const STEPS = [
    { key:'pc', title:'Создайте героя', hint:'Карточка персонажа: характеристики, ХП, атаки.', act:'Создать' },
    { key:'mob', title:'Добавьте монстра', hint:'Из бестиария или готового пресета.', act:'Добавить' },
    { key:'session', title:'Заведите сессию', hint:'План вечера, сцены и заметки.', act:'Создать' },
    { key:'map', title:'Поставьте карту', hint:'Сетка, туман войны и токены.', act:'Добавить' },
    { key:'battle', title:'Соберите бой', hint:'Инициатива, хиты и статусы.', act:'Собрать' }
  ];

  function render(){
    const hidden = (()=>{ try{ return localStorage.getItem(HIDE_KEY)==='1'; }catch(e){ return false; } })();
    const d = data();
    const n = STEPS.filter(s=> d[s.key]).length;
    const showDash = (hidden || n === STEPS.length) && !forceTraining;

    if(typeof window.homeDashboardSet === 'function') window.homeDashboardSet(showDash);
    card.hidden = showDash;
    if(showBtn) showBtn.hidden = true;
    if(showDash) return;

    list.innerHTML = STEPS.map((s,i)=>{
      const on = !!d[s.key];
      return `<li class="qs-step${on ? ' done' : ''}">
        <span class="qs-check" aria-hidden="true">${on ? '✓' : (i+1)}</span>
        <span class="qs-body"><b>${s.title}</b><small>${s.hint}</small></span>
        <button type="button" class="qs-act" data-qs-act="${s.key}">${on ? 'Открыть' : s.act}</button>
      </li>`;
    }).join('');
    if(bar) bar.style.width = (n/STEPS.length*100) + '%';
    const track = card.querySelector('.qs-progress');
    if(track) track.setAttribute('aria-valuenow', String(n));
    if(lead) lead.textContent = n===STEPS.length
      ? 'Всё готово: можно вести игру.'
      : `Осталось шагов: ${STEPS.length-n} из ${STEPS.length}.`;
    if(doneMsg) doneMsg.hidden = n!==STEPS.length;
  }

  function act(key){
    const d = data();
    if(key==='pc'){
      if(d.pc){ showTab('chars'); return; }
      showTab('chars');
      addBlock('pc');
    } else if(key==='mob'){
      const b = document.getElementById('btnBestiary'); if(b) b.click();
    } else if(key==='session'){
      showTab('sessions');
      if(!d.session){
        const b = document.getElementById('sessionNew');
        if(b) b.click();
      }
    } else if(key==='map'){
      showTab('map');
      if(!d.map && typeof addFullScreenMap==='function') addFullScreenMap();
    } else if(key==='battle'){
      showTab('battle');
      if(!d.battle){
        const b = document.getElementById('battleAddOpp');
        if(b) b.click();
      }
    }
    setTimeout(render, 300);
  }

  list.addEventListener('click', e=>{
    const b = e.target.closest('[data-qs-act]');
    if(b) act(b.dataset.qsAct);
  });
  if(hideBtn) hideBtn.addEventListener('click', ()=>{
    forceTraining = false;
    try{ localStorage.setItem(HIDE_KEY,'1'); }catch(e){}
    render();
  });
  if(showBtn) showBtn.addEventListener('click', ()=>{
    forceTraining = true;
    try{ localStorage.removeItem(HIDE_KEY); }catch(e){}
    render();
  });
  document.querySelectorAll('.tab').forEach(t=>{
    if(t.dataset.tab==='home') t.addEventListener('click', ()=> setTimeout(render, 40));
  });
  window.startQuickStart = ()=>{
    forceTraining = true;
    try{ localStorage.removeItem(HIDE_KEY); }catch(e){}
    render();
  };
  render();
  window.renderQuickStart = render;
})();

/* ════════════ Пустые состояния: действия ════════════ */
(function emptyStates(){
  const canvas = document.getElementById('canvas');
  if(canvas) canvas.addEventListener('click', e=>{
    const b = e.target.closest('[data-empty-action]');
    if(!b) return;
    const act = b.dataset.emptyAction;
    if(act==='pc'){ addBlock('pc'); return; }
    if(act==='note'){ addBlock('note'); return; }
    if(act==='bestiary'){ const t=document.getElementById('btnBestiary'); if(t) t.click(); return; }
    if(act==='mob-preset'){ const t=document.getElementById('createMobTop'); if(t) t.click(); return; }
    if(act==='reset-filter'){
      canvasQuery = '';
      searchFilter = null;
      const inp = document.getElementById('canvasFilter');
      if(inp) inp.value = '';
      render();
    }
  });
  document.addEventListener('click', e=>{
    const b = e.target.closest('[data-map-empty]');
    if(!b) return;
    if(b.dataset.mapEmpty==='blank'){ if(typeof addFullScreenMap==='function') addFullScreenMap(); return; }
    if(b.dataset.mapEmpty==='file'){ const f=document.getElementById('mapFileInput'); if(f) f.click(); }
  });
})();

/* ════════════ Режимы карты: подготовка и игра ════════════ */
(function mapModes(){
  const view = document.getElementById('view-map');
  const box = document.getElementById('mapMode');
  const bar = document.getElementById('mapPlayBar');
  if(!view || !box || !bar) return;
  const KEY = 'shirma_map_mode_v1';
  function apply(next, persist){
    const mode = next === 'play' ? 'play' : 'prep';
    view.classList.toggle('map-play', mode === 'play');
    box.querySelectorAll('[data-map-mode]').forEach(b=>{
      const on = b.dataset.mapMode === mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    bar.hidden = mode !== 'play';
    if(mode === 'play'){
      const tool = document.getElementById('mapDrawTool');
      if(tool && tool.value !== 'none'){
        tool.value = 'none';
        tool.dispatchEvent(new Event('change', { bubbles:true }));
      }
      const hint = document.getElementById('mapPlaceHint');
      if(hint) hint.hidden = true;
    }
    if(persist){
      try{ localStorage.setItem(KEY, mode); }catch(e){}
    }
  }
  box.addEventListener('click', e=>{
    const b = e.target.closest('[data-map-mode]');
    if(b) apply(b.dataset.mapMode, true);
  });
  bar.addEventListener('click', e=>{
    const b = e.target.closest('[data-play-act]');
    if(!b) return;
    const map = {
      token:'mapAddToken', marker:'mapAddMarker', ruler:'mapRuler',
      'fog-hide':'mapFogHideAll', 'fog-show':'mapFogShowAll', 'fog-room':'mapFogRoom',
      present:'mapPresent'
    };
    const el = document.getElementById(map[b.dataset.playAct]);
    if(el) el.click();
  });
  let saved = 'prep';
  try{ saved = localStorage.getItem(KEY) || 'prep'; }catch(e){}
  apply(saved, false);
})();

/* ════════════ Меню «Ещё» в редакторе сессий ════════════ */
(function sessionMore(){
  const btn = document.getElementById('sessionMoreBtn');
  const panel = document.getElementById('sessionMorePanel');
  if(!btn || !panel) return;
  function close(){
    panel.classList.remove('open');
    btn.setAttribute('aria-expanded', 'false');
  }
  btn.addEventListener('click', e=>{
    e.stopPropagation();
    const open = panel.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  panel.addEventListener('click', e=>{
    if(e.target.closest('button')) close();
  });
  document.addEventListener('click', e=>{
    if(!panel.classList.contains('open')) return;
    if(e.target.closest('.menu-wrap') && e.target.closest('.menu-wrap').contains(panel)) return;
    close();
  });
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && panel.classList.contains('open')){ close(); }
  });
})();

/* ════════════ Дайс-трей ════════════ */
(function diceTray(){
  const box = document.getElementById('diceTray');
  const btn = document.getElementById('diceTrayToggle');
  const panel = document.getElementById('diceTrayPanel');
  if(!box || !btn || !panel) return;
  function close(){
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    box.classList.remove('open');
  }
  btn.addEventListener('click', e=>{
    e.stopPropagation();
    const open = panel.hidden;
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    box.classList.toggle('open', open);
  });
  document.addEventListener('click', e=>{
    if(panel.hidden) return;
    if(box.contains(e.target)) return;
    close();
  });
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && !panel.hidden) close();
  });
})();

/* ════════════ Быстрый выбор кости в трее ════════════ */
(function diceTrayChips(){
  const panel = document.getElementById('diceTrayPanel');
  const sel = document.getElementById('dieSel');
  const custom = document.getElementById('dieCustom');
  const toggle = document.getElementById('diceTrayToggle');
  const close = document.getElementById('diceTrayClose');
  if(!panel || !sel) return;
  const chips = [...panel.querySelectorAll('[data-die]')];
  function sync(){
    chips.forEach(b=> b.classList.toggle('active', b.dataset.die === sel.value));
  }
  chips.forEach(b=> b.addEventListener('click', ()=>{
    sel.value = b.dataset.die;
    sel.dispatchEvent(new Event('change', { bubbles:true }));
    sync();
    if(b.dataset.die === 'custom' && custom) setTimeout(()=> custom.focus(), 0);
  }));
  sel.addEventListener('change', sync);
  if(close) close.addEventListener('click', ()=>{
    panel.hidden = true;
    if(toggle) toggle.setAttribute('aria-expanded','false');
    const box=document.getElementById('diceTray'); if(box) box.classList.remove('open');
  });
  sync();
})();
