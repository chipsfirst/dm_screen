/* Главная «Пульт»: продолжить, инструменты и пустое состояние. */
(function(){
  const dash = document.getElementById('homeDashboard');
  const about = document.getElementById('homeAbout');
  const qs = document.getElementById('homeQuickStart');
  const root = document.querySelector('.home-pult');
  if(!dash || !root) return;

  function sessionsCount(){
    if(typeof sessions !== 'undefined' && sessionsInited) return sessions;
    try { const a = JSON.parse(localStorage.getItem('shirma_sessions_v1') || '[]'); return Array.isArray(a) ? a : []; }
    catch(e){ return []; }
  }
  function mapLabel(){
    try {
      if(typeof maps !== 'undefined' && maps.length){
        const m = maps.find(x => x.id === activeMapId) || maps[0];
        return m ? m.name : '';
      }
      const a = JSON.parse(localStorage.getItem('shirma_map_v1') || '[]');
      return Array.isArray(a) && a[0] ? a[0].name : '';
    } catch(e){ return ''; }
  }
  function pcs(){
    return (typeof blocks !== 'undefined' ? blocks : []).filter(b => b && b.type === 'pc');
  }
  function lastPc(){ const a = pcs(); return a[a.length - 1]; }
  function noteCount(){
    return (typeof blocks !== 'undefined' ? blocks : []).filter(b => b && b.type === 'note').length;
  }
  function setMeta(id, text){
    const el = document.getElementById(id);
    if(el) el.textContent = text;
  }
  const STATUS_ICONS = { session:'sessions', pc:'character', map:'map', battle:'battle' };
  function render(){
    const ss = sessionsCount();
    const pcList = pcs();
    const pc = pcList[pcList.length - 1];
    const map = mapLabel();
    const bp = (typeof battleParts !== 'undefined' ? battleParts : []);
    const notes = noteCount();
    const allCards = (typeof blocks !== 'undefined' ? blocks.length : 0);
    const itemCards = (window.SRD_ITEMS && Array.isArray(window.SRD_ITEMS.items)) ? window.SRD_ITEMS.items.length : 0;
    const stateCards = Array.isArray(window.CONDITIONS_2024) ? window.CONDITIONS_2024.length : 0;
    const empty = !ss.length && !pcList.length && !map && !bp.length;
    setMeta('ppPartyMeta', 'в партии: ' + pcList.length);
    setMeta('ppInitMeta', bp.length ? 'в бою: ' + bp.length : 'из партии: ' + pcList.length);
    setMeta('ppNpcMeta', 'заметок: ' + notes);
    setMeta('ppItemsMeta', itemCards ? 'карточек: ' + itemCards : 'SRD 5.2.1');
    setMeta('ppStateMeta', stateCards ? 'состояний: ' + stateCards : 'карточки и жетоны');
    setMeta('ppBattleMeta', bp.length ? 'участников: ' + bp.length : 'нет боя');
    setMeta('ppScreenMeta', 'карточек: ' + allCards);
    const start = document.getElementById('pultStart');
    const title = document.getElementById('dashTitle');
    const box = document.getElementById('dashLast');

    if(start) start.hidden = !empty;
    if(box){
      box.hidden = empty;
      box.innerHTML = empty ? '' : [
        { kind:'session', kicker:'Сессия', value: ss[0] ? ss[0].title : 'Не начата', meta: ss[0] ? 'открыть' : 'создать' },
        { kind:'pc', kicker:'Персонаж', value: pc ? pc.title : 'Нет персонажа', meta: pc ? 'открыть' : 'создать' },
        { kind:'map', kicker:'Карта', value: map || 'Не создана', meta: map ? 'открыть' : 'создать' },
        { kind:'battle', kicker:'Бой', value: bp.length ? bp.length + ' участников' : 'Не начат', meta: bp.length ? 'открыть' : 'собрать' }
      ].map(r => `<button type="button" class="pult-status-item" data-kind="${r.kind}" data-dash-open="${r.kind}" title="${escapeHtml(r.value)}"><span class="psi-ico">${typeof gi === 'function' ? gi(STATUS_ICONS[r.kind]) : ''}</span><span class="psi-kicker">${r.kicker}</span><b>${escapeHtml(r.value)}</b><small>${r.meta}</small></button>`).join('');
    }
    if(title) title.textContent = empty ? 'Начать кампанию' : 'За столом';
    dash.dataset.ready = '1';
  }
  function openPcCard(){
    const pc = lastPc();
    if(!pc){
      if(window.openCharacterBuilder) window.openCharacterBuilder();
      else showTab('chars');
      return;
    }
    showTab('chars');
    setTimeout(()=>{
      const id = String(pc.id).replace(/"/g, '\\"');
      const el = document.querySelector('#canvas [data-id="' + id + '"]');
      if(el) el.scrollIntoView({ block:'center', behavior:'smooth' });
    }, 60);
  }
  function open(kind){
    if(kind === 'session'){
      const ss = sessionsCount();
      showTab('sessions');
      if(ss.length && typeof openSessionById === 'function') openSessionById(ss[0].id);
      else if(!ss.length) document.getElementById('sessionNew')?.click();
    } else if(kind === 'pc'){
      openPcCard();
    } else if(kind === 'newpc'){
      if(window.openCharacterBuilder) window.openCharacterBuilder();
      else showTab('chars');
    } else if(kind === 'map'){
      showTab('map');
      if(!mapLabel() && typeof addFullScreenMap === 'function') addFullScreenMap();
    } else if(kind === 'battle'){
      showTab('battle');
    } else if(kind === 'mob'){
      document.getElementById('btnBestiary')?.click();
    } else if(kind === 'rules'){
      if(typeof openRulesPanel === 'function') openRulesPanel();
      else document.getElementById('btnRules')?.click();
    } else if(kind === 'gen'){
      document.getElementById('btnGen')?.click();
    } else if(kind === 'library'){
      document.getElementById('btnLibrary')?.click();
    } else if(kind === 'content'){
      if(typeof window.openContentPacks === 'function') window.openContentPacks();
      else document.getElementById('btnContentPacks')?.click();
    }
    setTimeout(render, 250);
  }
  function openPrint(kind){
    if(kind === 'handouts'){ document.getElementById('btnHandouts')?.click(); return; }
    if(kind === 'battle'){ document.getElementById('btnPrintBattle')?.click(); return; }
    if(kind === 'screen'){ document.getElementById('btnPrintAll')?.click(); return; }
    if(typeof window.openPrintKit === 'function') window.openPrintKit(kind);
    else toast('Печать недоступна');
  }
  function show(on){
    dash.hidden = !on;
    if(about) about.hidden = on;
    if(qs) qs.hidden = on;
    const restore = document.getElementById('qsShow');
    if(restore) restore.hidden = true;
    if(on) render();
  }
  root.addEventListener('click', e => {
    const printAct = e.target.closest('[data-print-act]');
    if(printAct){ e.preventDefault(); openPrint(printAct.dataset.printAct); return; }
    const pult = e.target.closest('[data-pult]');
    if(pult){ e.preventDefault(); open(pult.dataset.pult); return; }
    const row = e.target.closest('[data-dash-open]');
    if(row){ open(row.dataset.dashOpen); }
  });
  document.getElementById('dashTraining')?.addEventListener('click', () => {
    if(typeof window.startQuickStart === 'function') window.startQuickStart();
  });
  document.getElementById('pultChronicle')?.addEventListener('click', () => {
    document.getElementById('btnChronicle')?.click();
  });
  document.getElementById('pultTableMode')?.addEventListener('click', () => {
    document.getElementById('btnTableMode')?.click();
  });
  document.querySelectorAll('.tab').forEach(t => {
    if(t.dataset.tab === 'home') t.addEventListener('click', () => setTimeout(render, 60));
  });
  window.homeDashboardSet = show;
  window.renderHomeDashboard = render;
  setTimeout(() => { if(typeof window.renderQuickStart === 'function') window.renderQuickStart(); else render(); }, 0);
})();
