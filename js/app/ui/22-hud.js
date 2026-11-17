/* ════════════ Компактный HUD «За столом» ════════════ */
(function tableHud(){
  const bar = document.getElementById('tableHud');
  const btn = document.getElementById('btnTableHud');
  if(!bar || !btn) return;
  const KEY = 'shirma_table_hud_v1';
  const turnEl = document.getElementById('hudTurn');
  const timerEl = document.getElementById('hudTimer');
  const condsEl = document.getElementById('hudConds');
  let enabled = false;
  try{ enabled = localStorage.getItem(KEY) === '1'; }catch(e){}

  function fmt(ms){
    const s=Math.max(0,Math.ceil(ms/1000));
    return String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
  }
  function timerText(){
    let best = null;
    const badge = document.getElementById('gameTimerBadge');
    if(badge && !badge.hidden){ best = badge.textContent; }
    try{
      const extra = JSON.parse(localStorage.getItem('shirma_extra_timers_v1')||'[]');
      if(Array.isArray(extra)){
        extra.forEach(t=>{
          if(!t || !t.running || !t.endAt) return;
          const ms = Math.max(0, t.endAt - Date.now());
          if(!best || ms < (bestMs || Infinity)){ best = fmt(ms); bestMs = ms; }
        });
      }
    }catch(e){}
    return best ? ('Таймер: '+best) : 'Таймер: —';
  }
  let bestMs = Infinity;
  function tick(){
    if(!enabled) return;
    let title='Бой не начат', conds=0;
    try{
      if(typeof battleParts !== 'undefined' && battleParts.length){
        const cur = typeof battleTurn !== 'undefined' ? battleParts.find(p=>p.id===battleTurn.turnId) : null;
        title = 'Раунд ' + (battleTurn && battleTurn.round || 1) + (cur ? ' · '+cur.name : '');
        conds = cur && Array.isArray(cur.statuses) ? cur.statuses.length : 0;
      }
    }catch(e){}
    turnEl.textContent = title;
    condsEl.textContent = 'Состояния: '+conds;
    bestMs = Infinity;
    timerEl.textContent = timerText();
  }
  function apply(){
    bar.hidden = !enabled;
    btn.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    tick();
  }
  btn.addEventListener('click', ()=>{
    enabled = !enabled;
    try{ localStorage.setItem(KEY, enabled ? '1' : '0'); }catch(e){}
    apply();
  });
  if(turnEl) turnEl.addEventListener('click', e=>{ e.stopPropagation(); showTab('battle'); });
  if(timerEl) timerEl.addEventListener('click', e=>{ e.stopPropagation(); document.getElementById('btnGameTimer')?.click(); });
  if(document.getElementById('hudDice')) document.getElementById('hudDice').addEventListener('click', e=>{ e.stopPropagation(); document.getElementById('diceTrayToggle')?.click(); });
  if(condsEl) condsEl.addEventListener('click', e=>{ e.stopPropagation(); showTab('battle'); });
  if(document.getElementById('hudClose')) document.getElementById('hudClose').addEventListener('click', ()=>{
    enabled = false; try{ localStorage.setItem(KEY,'0'); }catch(e){} apply();
  });
  setInterval(tick, 500);
  apply();
})();
