/* ════════════ Игровой таймер: отсчёт и секундомер ════════════ */
(function gameTimer(){
  const panel = document.getElementById('gameTimerPanel');
  const btn = document.getElementById('btnGameTimer');
  const badge = document.getElementById('gameTimerBadge');
  const display = document.getElementById('gtDisplay');
  const startBtn = document.getElementById('gtStart');
  const resetBtn = document.getElementById('gtReset');
  const presets = document.getElementById('gtPresets');
  const customBox = document.getElementById('gtCustom');
  const minInp = document.getElementById('gtMin');
  const secInp = document.getElementById('gtSec');
  const hint = document.getElementById('gtHint');
  if(!panel || !btn || !display) return;

  const KEY = 'shirma_game_timer_v1';
  let mode = 'down';
  let total = 5*60*1000;
  let remain = total;
  let elapsed = 0;
  let running = false;
  let endAt = 0;
  let startAt = 0;
  let done = false;
  let tick = null;

  function fmt(ms){
    const s = Math.max(0, Math.ceil(ms/1000));
    const m = Math.floor(s/60), r = s%60;
    return String(m).padStart(2,'0') + ':' + String(r).padStart(2,'0');
  }
  function current(){
    if(mode === 'down') return running ? Math.max(0, endAt - Date.now()) : remain;
    return running ? elapsed + (Date.now() - startAt) : elapsed;
  }
  function stopTick(){ if(tick){ clearInterval(tick); tick = null; } }
  function startTick(){ stopTick(); tick = setInterval(onTick, 250); }
  function save(){
    try{
      localStorage.setItem(KEY, JSON.stringify({ v:1, mode, total, remain, elapsed, running, endAt, startAt }));
    }catch(e){}
  }
  function render(){
    const cur = current();
    display.textContent = fmt(cur);
    startBtn.textContent = running ? 'Пауза' : ((mode==='down' ? remain < total : elapsed > 0) ? 'Продолжить' : 'Старт');
    if(badge){
      const show = running || (mode==='down' ? (remain < total && remain > 0) : elapsed > 0);
      badge.hidden = !show;
      badge.textContent = fmt(cur);
    }
    panel.classList.toggle('done', done);
    btn.classList.toggle('done', done);
    if(hint){
      hint.textContent = mode==='down'
        ? 'Обратный отсчёт. Таймер продолжает идти при переключении вкладок.'
        : 'Секундомер. Показывает, сколько времени прошло с момента старта.';
    }
    btn.title = 'Таймер: ' + fmt(cur);
  }
  function onTick(){
    if(!running) return;
    if(mode === 'down'){
      remain = Math.max(0, endAt - Date.now());
      if(remain <= 0){
        running = false; done = true; stopTick();
        playSound('alarm');
        toast('Время вышло');
      }
    } else {
      elapsed += Date.now() - startAt;
      startAt = Date.now();
    }
    render();
    if(!running) save();
  }
  function readCustomMs(){
    const m = Math.max(0, Math.min(999, parseInt(minInp && minInp.value, 10) || 0));
    const sec = Math.max(0, Math.min(59, parseInt(secInp && secInp.value, 10) || 0));
    return (m*60 + sec)*1000;
  }
  function syncCustom(){
    if(mode !== 'down' || running) return;
    const ms = readCustomMs();
    if(ms !== total){ total = ms; remain = ms; done = false; }
  }
  function start(){
    if(mode === 'down'){
      syncCustom();
      if(remain <= 0) remain = total;
      if(remain <= 0) return;
      endAt = Date.now() + remain;
    } else {
      startAt = Date.now();
    }
    running = true; done = false;
    audioReady();
    startTick(); save(); render();
  }
  function pause(){
    if(!running) return;
    if(mode === 'down') remain = Math.max(0, endAt - Date.now());
    else elapsed += Date.now() - startAt;
    running = false; stopTick(); save(); render();
  }
  function reset(){
    running = false; done = false; stopTick();
    if(mode === 'down') remain = total; else elapsed = 0;
    save(); render();
  }
  function setMode(next){
    if(next !== 'down' && next !== 'up') return;
    running = false; done = false; stopTick();
    mode = next;
    panel.querySelectorAll('[data-gt-mode]').forEach(b=> b.classList.toggle('active', b.dataset.gtMode === mode));
    presets.hidden = mode !== 'down';
    customBox.hidden = mode !== 'down';
    save(); render();
  }
  function setTotal(ms){
    mode = 'down';
    total = Math.max(0, Math.min(999*60*1000 + 59*1000, ms));
    remain = total; running = false; done = false; stopTick();
    panel.querySelectorAll('[data-gt-mode]').forEach(b=> b.classList.toggle('active', b.dataset.gtMode === 'down'));
    presets.hidden = false; customBox.hidden = false;
    save(); render();
  }
  function setCustom(){
    setTotal(readCustomMs());
  }
  function place(){
    const bar = document.querySelector('.topbar');
    const top = bar ? bar.getBoundingClientRect().bottom + 8 : 56;
    panel.style.top = Math.max(8, Math.round(top)) + 'px';
  }
  function close(){
    panel.hidden = true;
    btn.setAttribute('aria-expanded','false');
  }
  function open(){
    place();
    const dice = document.getElementById('diceTrayPanel');
    if(dice && !dice.hidden){
      const dbtn = document.getElementById('diceTrayToggle'); if(dbtn) dbtn.click();
    }
    panel.hidden = false;
    btn.setAttribute('aria-expanded','true');
  }

  btn.addEventListener('click', e=>{
    e.stopPropagation();
    if(panel.hidden) open(); else close();
  });
  const closeBtn = document.getElementById('gtClose'); if(closeBtn) closeBtn.addEventListener('click', close);
  document.addEventListener('click', e=>{
    if(panel.hidden) return;
    if(panel.contains(e.target) || btn.contains(e.target)) return;
    close();
  });
  document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && !panel.hidden) close(); });
  window.addEventListener('resize', ()=>{ if(!panel.hidden) place(); });

  startBtn.addEventListener('click', ()=> running ? pause() : start());
  resetBtn.addEventListener('click', reset);
  panel.querySelectorAll('[data-gt-mode]').forEach(b=> b.addEventListener('click', ()=> setMode(b.dataset.gtMode)));
  presets.querySelectorAll('[data-gt-min]').forEach(b=> b.addEventListener('click', ()=>{
    setTotal((parseInt(b.dataset.gtMin,10)||1)*60*1000);
    if(minInp) minInp.value = b.dataset.gtMin;
    if(secInp) secInp.value = '0';
  }));
  const setBtn = document.getElementById('gtSet'); if(setBtn) setBtn.addEventListener('click', setCustom);
  if(minInp){
    minInp.addEventListener('change', ()=>{ if(mode==='down' && !running) setTotal(readCustomMs()); });
    minInp.addEventListener('keydown', e=>{ if(e.key==='Enter') setCustom(); });
  }
  if(secInp){
    secInp.addEventListener('change', ()=>{ if(mode==='down' && !running) setTotal(readCustomMs()); });
    secInp.addEventListener('keydown', e=>{ if(e.key==='Enter') setCustom(); });
  }
  window.addEventListener('beforeunload', ()=>{
    if(!running) return;
    if(mode === 'down') remain = Math.max(0, endAt - Date.now());
    else elapsed += Date.now() - startAt;
    save();
  });

  try{
    const st = JSON.parse(localStorage.getItem(KEY) || 'null');
    if(st && st.v === 1){
      mode = st.mode === 'up' ? 'up' : 'down';
      total = Math.max(1000, +st.total || total);
      remain = Math.max(0, +st.remain || total);
      elapsed = Math.max(0, +st.elapsed || 0);
      running = !!st.running;
      endAt = +st.endAt || 0;
      startAt = +st.startAt || 0;
      if(running){
        if(mode === 'down'){
          remain = Math.max(0, endAt - Date.now());
          if(remain <= 0){ running = false; done = true; }
        } else {
          elapsed = Math.max(0, elapsed + (Date.now() - startAt));
          startAt = Date.now();
        }
      }
    }
  }catch(e){}
  panel.querySelectorAll('[data-gt-mode]').forEach(b=> b.classList.toggle('active', b.dataset.gtMode === mode));
  presets.hidden = mode !== 'down';
  customBox.hidden = mode !== 'down';
  if(minInp) minInp.value = String(Math.floor(total/60000));
  if(secInp) secInp.value = String(Math.round((total%60000)/1000));
  render();
  if(running) startTick();
})();

/* ════════════ Несколько дополнительных таймеров ════════════ */
(function extraTimers(){
  const listEl = document.getElementById('gtExtraList');
  const addBtn = document.getElementById('gtExtraAdd');
  const nameInp = document.getElementById('gtExtraName');
  const minInp = document.getElementById('gtExtraMin');
  const secInp = document.getElementById('gtExtraSec');
  if(!listEl || !addBtn) return;
  const KEY = 'shirma_extra_timers_v1';
  const COLORS = ['#7fb3e6','#86c48f','#d49bd6','#e6b93c'];
  let items = [];
  let tick = null;

  function fmt(ms){
    const s=Math.max(0,Math.ceil(ms/1000));
    return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  }
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify(items)); }catch(e){}
  }
  function ensureTick(){
    const any = items.some(t=>t.running);
    if(any && !tick) tick = setInterval(onTick,250);
    if(!any && tick){ clearInterval(tick); tick=null; }
  }
  function render(){
    listEl.innerHTML = items.map(t=>{
      const ms = t.running ? Math.max(0,t.endAt-Date.now()) : t.remain;
      return `<div class="gt-extra-item${t.done?' done':''}" data-id="${t.id}">
        <span class="gte-dot" style="--c:${t.color}"></span>
        <span class="gte-name" title="${escapeHtml(t.name)}">${escapeHtml(t.name)}</span>
        <span class="gte-time">${fmt(ms)}</span>
        <button type="button" data-x="toggle" data-id="${t.id}" title="${t.running?'Пауза':'Запустить'}">${t.running?'Пауза':'Старт'}</button>
        <button type="button" data-x="del" data-id="${t.id}" title="Удалить таймер">✕</button>
      </div>`;
    }).join('');
    ensureTick();
  }
  function onTick(){
    let changed=false;
    items.forEach(t=>{
      if(!t.running) return;
      t.remain = Math.max(0,t.endAt-Date.now());
      if(t.remain<=0){
        t.running=false; t.done=true; changed=true;
        playSound('alarm');
        toast('Таймер «'+t.name+'» закончился');
      }
    });
    render();
    if(changed) save();
  }
  function add(){
    if(items.length>=4){ toast('Можно добавить не больше 4 таймеров'); return; }
    const m=Math.max(0,Math.min(999,parseInt(minInp&&minInp.value,10)||0));
    const s=Math.max(0,Math.min(59,parseInt(secInp&&secInp.value,10)||0));
    const total=(m*60+s)*1000;
    if(total<1000){ toast('Задайте хотя бы 1 секунду'); return; }
    const name=(nameInp&&nameInp.value||'').trim().slice(0,24) || ('Таймер '+(items.length+1));
    items.push({ id:'t'+Date.now().toString(36)+Math.random().toString(36).slice(2,5), name, color:COLORS[items.length%COLORS.length], total, remain:total, running:true, endAt:Date.now()+total, done:false });
    if(nameInp) nameInp.value='';
    save(); render();
  }
  addBtn.addEventListener('click', add);
  if(nameInp) nameInp.addEventListener('keydown', e=>{ if(e.key==='Enter') add(); });
  if(minInp) minInp.addEventListener('keydown', e=>{ if(e.key==='Enter') add(); });
  if(secInp) secInp.addEventListener('keydown', e=>{ if(e.key==='Enter') add(); });
  listEl.addEventListener('click', e=>{
    const b=e.target.closest('[data-x]'); if(!b) return;
    const t=items.find(x=>x.id===b.dataset.id); if(!t) return;
    if(b.dataset.x==='del'){
      items=items.filter(x=>x.id!==t.id);
    } else if(t.running){
      t.remain=Math.max(0,t.endAt-Date.now()); t.running=false;
    } else {
      if(t.remain<=0){ t.remain=t.total; t.done=false; }
      t.endAt=Date.now()+t.remain; t.running=true;
    }
    save(); render();
  });
  try{
    const a=JSON.parse(localStorage.getItem(KEY)||'[]');
    if(Array.isArray(a)){
      items=a.filter(t=>t&&typeof t==='object').map((t,i)=>({
        id:String(t.id||('t'+i)), name:String(t.name||'Таймер').slice(0,24),
        color:t.color||COLORS[i%COLORS.length], total:Math.max(1000,+t.total||60000),
        remain:Math.max(0,+t.remain||+t.total||60000), running:!!t.running,
        endAt:+t.endAt||0, done:!!t.done
      }));
      items.forEach(t=>{
        if(t.running){
          t.remain=Math.max(0,t.endAt-Date.now());
          if(t.remain<=0){ t.running=false; t.done=true; }
        }
      });
    }
  }catch(e){}
  render();
  window.addEventListener('beforeunload', ()=>{
    items.forEach(t=>{ if(t.running) t.remain=Math.max(0,t.endAt-Date.now()); });
    save();
  });
})();
