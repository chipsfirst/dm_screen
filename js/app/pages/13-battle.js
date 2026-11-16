/* ════════════ Вкладка «Бой» ════════════ */
const STORE_BATTLE = 'shirma_battle_v1';
const STORE_BATTLE_LOG = 'shirma_battle_log_v1';
let battleParts = [];   // {id,name,side:'opp'|'char',ac,hp,init}
let battleTurn = { round: 1, turnId: null };
const STORE_BATTLE_TURN = 'shirma_battle_turn_v1';
const STORE_BATTLE_NOTE = 'shirma_battle_note_v1';
function loadBattleTurn(){
  try{
    const d = JSON.parse(localStorage.getItem(STORE_BATTLE_TURN)||'null');
    if(d && typeof d==='object') battleTurn = { round: Math.max(1, Math.round(+d.round)||1), turnId: d.turnId || null };
  }catch(e){}
}
function saveBattleTurn(){ try{ localStorage.setItem(STORE_BATTLE_TURN, JSON.stringify(battleTurn)); }catch(e){} }
let battleLog = [];     // {t:ms, text}
function saveBattleLog(){ try{ localStorage.setItem(STORE_BATTLE_LOG, JSON.stringify(battleLog.slice(0,200))); }catch(e){} }
function loadBattleLog(){ try{ const d=JSON.parse(localStorage.getItem(STORE_BATTLE_LOG)||'[]'); battleLog=Array.isArray(d)?d.slice(0,200):[]; }catch(e){ battleLog=[]; } }
function battleLogPush(text){
  battleLog.unshift({ t:Date.now(), text:String(text||'') });
  if(battleLog.length>200) battleLog.length=200;
  saveBattleLog();
  renderBattleLog();
}
function loadBattleNote(){
  let v=''; try{ v=localStorage.getItem(STORE_BATTLE_NOTE)||''; }catch(e){}
  const el=document.getElementById('battleQuickNote'); if(el) el.value=v;
}
function saveBattleNote(v){ try{ localStorage.setItem(STORE_BATTLE_NOTE, String(v||'')); }catch(e){} }
function renderBattleLog(){
  const box = document.getElementById('battleLogItems');
  if(!box) return;
  if(!battleLog.length){ box.innerHTML = '<div class="battle-log-empty">Пока пусто. Здесь будут урон, лечение, действия и порядок ходов.</div>'; return; }
  box.innerHTML = battleLog.map(e=>{
    const d = new Date(e.t);
    const hh = String(d.getHours()).padStart(2,'0'), mm = String(d.getMinutes()).padStart(2,'0');
    return `<div class="battle-log-item"><span class="lt">${hh}:${mm}</span>${escapeHtml(e.text)}</div>`;
  }).join('');
}

function loadBattle(){
  const data = safeParseRaw(localStorage.getItem(STORE_BATTLE), 'shirma_battle');
  if(Array.isArray(data) && data.length){
    battleParts = data.map(p=>({ id:String(p.id||uniq()), name:String(p.name||'Участник').slice(0,60),
      side: p.side==='char'?'char':'opp', ac: numField(p.ac), hp: numField(p.hp), hpMax: numField(p.hpMax), init: numField(p.init),
      atk: p.atk===undefined ? '' : numField(p.atk),
      statuses: Array.isArray(p.statuses) ? p.statuses.slice(0,20).map(x=>String(x)) : [],
      acts: Array.isArray(p.acts) ? p.acts.slice(0,40).map(a=>({tag:String(a.tag||''),text:String(a.text||'')})) : [],
      applied: Array.isArray(p.applied) ? p.applied.slice(0,40).map(x=>String(x)) : [],
      srcId: p.srcId ? String(p.srcId) : '',
      collapsed: !!p.collapsed, detailsOpen: !!p.detailsOpen }));
    return true;
  }
  battleParts = []; return false;
}
function numField(v){
  const n = parseFloat(v);
  return isNaN(n) ? '' : n;
}
function saveBattle(){ try{ localStorage.setItem(STORE_BATTLE, JSON.stringify(battleParts)); }catch(e){} }
function battleSorted(){
  return battleParts.slice().sort((a,b)=>{
    const ae = a.init==='' || a.init==null, be = b.init==='' || b.init==null;
    if(ae && be) return 0;
    if(ae) return 1;   // пустая инициатива — в конец
    if(be) return -1;
    return b.init - a.init;
  });
}
function renderBattle(){
  const list = document.getElementById('battleList');
  if(!list) return;
  if(!battleParts.length){
    list.innerHTML = `<div class="battle-empty">Бой пуст. Добавьте противников и персонажей — они сортируются по инициативе (по убыванию).</div>`;
    return;
  }
  const sorted = battleSorted();
  const rows = sorted.map(p=>{
    const st = p.statuses || [];
    const stTitle = escapeHtml(st.join(', '));
    const stShown = st.slice(0,1).map(x=>`<span class="bt-chip-mini" title="${stTitle}">${escapeHtml(x)}</span>`).join('');
    const stMore = st.length>1 ? `<span class="bt-chip-mini" title="${stTitle}">+${st.length-1}</span>` : '';
    return `
    <tbody class="battle-card ${p.side==='opp'?'opp':''}${p.id===battleSelId?' sel':''}${p.id===battleTurn.turnId?' turn':''}" data-bid="${p.id}">
      <tr class="battle-row-main" tabindex="0">
        <td class="bt-cell-chev">${(p.srcId && statBlockOf(p)) ? `<button type="button" class="bt-side bt-side-btn" data-stat="${p.id}" title="Открыть статблок" aria-label="Открыть статблок">${gi(p.side==='opp'?'monsters':'character')}</button>` : `<span class="bt-side">${gi(p.side==='opp'?'monsters':'character')}</span>`}</td>
        <td class="bt-cell-name"><div class="bt-name-wrap"><input class="bt-name" data-field="name" data-bid="${p.id}" value="${escapeHtml(p.name)}" spellcheck="false" aria-label="Имя">${woundTag(p)}</div></td>
        <td class="bt-cell-init"><input class="bt-in bt-init" data-field="init" data-bid="${p.id}" type="number" value="${p.init}" aria-label="Инициатива"></td>
        <td class="bt-cell-ac"><input class="bt-in bt-ac" data-field="ac" data-bid="${p.id}" type="number" value="${p.ac}" aria-label="КД"></td>
        <td class="bt-cell-hp">${hpBarTag(p)}<input class="bt-in bt-hp" data-field="hp" data-bid="${p.id}" type="number" value="${p.hp}" aria-label="ХП">${hpMaxTag(p)}<span class="bt-step">
          <button class="bt-stepbtn" data-hp-op="inc" data-bid="${p.id}" title="+1 ХП" aria-label="+1 ХП">+</button>
          <button class="bt-stepbtn" data-hp-op="dec" data-bid="${p.id}" title="−1 ХП" aria-label="−1 ХП">−</button>
        </span></td>
        <td class="bt-cell-dmg"><input class="bt-in bt-dmg" data-dmg data-bid="${p.id}" type="number" placeholder="⏎" title="Введите урон и нажмите Enter" aria-label="Урон"><span class="bt-step">
          <button class="bt-stepbtn" data-dmg-op="inc" data-bid="${p.id}" title="Нанести 1 урон" aria-label="Нанести 1 урон">+</button>
          <button class="bt-stepbtn" data-dmg-op="dec" data-bid="${p.id}" title="Вылечить 1" aria-label="Вылечить 1">−</button>
        </span></td>
        <td class="bt-cell-status">${stShown}${stMore}<button class="bt-mini" data-details="${p.id}" title="Статусы и действия" aria-label="Статусы и действия">+</button></td>
        <td class="bt-cell-del"><button class="bt-del" data-del="${p.id}" title="Убрать из боя" aria-label="Убрать">${gi('trash')}</button></td>
      </tr>
    </tbody>`;}).join('');
  list.innerHTML = `<table class="battle-table">
    <colgroup><col style="width:30px"><col><col style="width:58px"><col style="width:54px"><col style="width:180px"><col style="width:92px"><col style="width:150px"><col style="width:30px"></colgroup>
    <thead><tr><th></th><th>Имя</th><th>Иниц</th><th>КД</th><th>ХП</th><th>Урон</th><th>Статусы</th><th></th></tr></thead>
    ${rows}
  </table>`;
  renderBattleTurn();
}
function renderBattleTurn(){
  const label = document.getElementById('battleRound');
  if(!label) return;
  const cur = battleParts.find(p=>p.id===battleTurn.turnId);
  label.textContent = 'Раунд ' + battleTurn.round + (cur ? ' · ' + cur.name : '');
  label.title = cur ? ('Сейчас ходит: ' + cur.name) : 'Текущий раунд';
}
function statBlockOf(p){
  if(!p || !p.srcId || typeof findBlock !== 'function') return null;
  try{
    const b = findBlock(p.srcId);
    return (b && (b.mdata || b.type==='pc')) ? b : null;
  }catch(e){ return null; }
}
function modOf(v){
  v = +v;
  if(!isFinite(v)) return '';
  const m = Math.floor((v-10)/2);
  return m>=0 ? ('+' + m) : ('−' + Math.abs(m));
}
let battleStatBid = null;

function splitActsBalanced(acts){
  const len = a => String((typeof a==='string') ? a : ((a && a.text) || '')).length;
  const total = acts.reduce((n,a)=>n+len(a),0);
  let acc=0, i=0;
  for(; i<acts.length-1; i++){ acc += len(acts[i]); if(acc >= total/2) { i++; break; } }
  return [acts.slice(0,i), acts.slice(i)];
}
function pcStatBlockHtml(p, b){
  const pr = b.props || {};
  const val = k => (pr[k]!=null && pr[k]!=='') ? String(pr[k]) : '';
  const ac = val('Броня КК') || val('КД') || val('AC') || (p.ac!=='' && p.ac!=null ? String(p.ac) : '');
  const sp = val('Скорость') || val('Speed');
  const lvl = val('Уровень') || val('Ур.');
  const stats = Array.isArray(b.stats) ? b.stats : [];
  const names = ['СИЛ','ЛОВ','ТЕЛ','ИНТ','МДР','ХАР'];
  const hpMax = (p.hpMax!=='' && p.hpMax!=null) ? p.hpMax : (hpMaxOf(b) || val('ХП'));
  const hpVal = (p.hp==='' || p.hp==null) ? '—' : String(p.hp);
  const badges = `
      ${ac?`<div class="sc-badge"><span class="l">КД</span><span class="v">${escapeHtml(ac)}</span></div>`:''}
      <div class="sc-badge hp"><span class="l">ХП</span><span class="v">${escapeHtml(hpVal)}${(hpMax && hpVal!=='—')?`<span class="m">/${escapeHtml(String(hpMax))}</span>`:''}</span></div>
      ${lvl?`<div class="sc-badge"><span class="l">Уровень</span><span class="v">${escapeHtml(lvl)}</span></div>`:''}
      ${sp?`<div class="sc-badge wide"><span class="l">Скорость</span><span class="v small">${escapeHtml(sp)}</span></div>`:''}`;
  const abilityCells = stats.length ? stats.slice(0,6).map((v,i)=>`<div class="sc-badge ab"><span class="l">${names[i]||''}</span><span class="v">${escapeHtml(String(v))}<span class="m">${modOf(v)}</span></span></div>`).join('') : '';
  const topRow = `<div class="sc-top">${badges}${abilityCells}</div>`;
  const initLine = (val('Инициатива')||val('Иниц')||p.init!=='') ? `<div class="sc-line"><b>Инициатива</b> ${escapeHtml(val('Инициатива')||val('Иниц')||String(p.init))}</div>` : '';
  const atk = (b.attack!=null && b.attack!=='') ? String(b.attack) : (p.atk!=='' && p.atk!=null ? String(p.atk) : '');
  const dmg = (b.damage!=null) ? String(b.damage) : '';
  const attackLine = (atk || dmg) ? `<div class="sc-line"><b>Атака</b> ${atk?`<b class="hit-atk">${escapeHtml(atk)}</b>`:'—'}${dmg?` <span class="sc-dot">·</span> <b>Урон</b> ${highlightAct(dmg)}`:''}</div>` : '';
  const skip = new Set(['КД','AC','Броня КК','Скорость','Speed','Уровень','Ур.','ХП','HP','Инициатива','Иниц']);
  const propLines = Object.entries(pr).filter(([k,v])=>!skip.has(k) && String(v||'').trim()).map(([k,v])=>`<div class="sc-line"><b>${escapeHtml(k)}</b> ${escapeHtml(String(v))}</div>`).join('');
  const res = Array.isArray(b.res) && b.res.length ? `<div class="sc-sec">Ресурсы</div><div class="sc-res">${b.res.map(r=>`<span class="sc-res-chip">${escapeHtml(r.name||'Ресурс')} <b>${r.cur}/${r.max}</b></span>`).join('')}</div>` : '';
  const text = (b.text||'').trim() ? `<div class="sc-sec">Заметки</div><div class="sc-text">${escapeHtml(b.text)}</div>` : '';
  return `<div class="stat-card">${topRow}${initLine}${attackLine}${propLines}${res}${text}</div>`;
}

function statBlockHtml(p){
  const b = statBlockOf(p);
  if(b && b.type==='pc') return pcStatBlockHtml(p, b);
  const md = (b && b.mdata) || {};
  const acts = Array.isArray(md.acts) ? md.acts : (Array.isArray(p.acts) ? p.acts : []);
  const stats = (b && Array.isArray(b.stats)) ? b.stats : [];
  const names = ['СИЛ','ЛОВ','ТЕЛ','ИНТ','МДР','ХАР'];
  const ac = (md.ac!==undefined && md.ac!=='') ? md.ac : p.ac;
  const cr = md.cr ? String(md.cr).split(' ')[0] : '';
  const line = (lbl, val) => val ? `<div class="sc-line"><b>${lbl}</b> ${escapeHtml(val)}</div>` : '';
  const actionsLen = acts.reduce((n,a)=>n + String((typeof a==='string') ? a : ((a && a.text) || '')).length, 0);
  const wide = acts.length >= 2 && (acts.length >= 3 || actionsLen > 320);
  const badgesInner = `
      ${(ac!=='' && ac!=null)?`<div class="sc-badge"><span class="l">КД</span><span class="v">${escapeHtml(String(ac))}</span></div>`:''}
      <div class="sc-badge hp"><span class="l">ХП</span><span class="v">${escapeHtml(String(p.hp))}</span></div>
      ${cr?`<div class="sc-badge"><span class="l">ОП</span><span class="v">${escapeHtml(cr)}</span></div>`:''}
      ${md.sp?`<div class="sc-badge wide"><span class="l">Скорость</span><span class="v small">${escapeHtml(md.sp)}</span></div>`:''}`;
  const abilityCells = stats.length ? stats.slice(0,6).map((v,i)=>`<div class="sc-badge ab"><span class="l">${names[i]||''}</span><span class="v">${escapeHtml(String(v))}<span class="m">${modOf(v)}</span></span></div>`).join('') : '';
  const topRow = `<div class="sc-top">${badgesInner}${abilityCells}</div>`;
  const initLine = md.init ? `<div class="sc-line"><b>Инициатива</b> ${escapeHtml(md.init)}</div>` : '';
  const actHtml = a => {
    const txt = (typeof a==='string') ? a : ((a && a.text) || '');
    const rawTag = (a && typeof a==='object' && a.tag) ? a.tag : '';
    const tag = /^действ/i.test(rawTag) ? '' : rawTag;
    const sp = (typeof splitAct==='function') ? splitAct(txt) : {name:txt, body:''};
    return `<div class="act"><span class="an">${tag?escapeHtml(tag)+' — ':''}${escapeHtml(sp.name)}.</span> ${highlightAct(sp.body)}</div>`;
  };
  let actsBlock = '';
  if(acts.length){
    if(wide){
      const [a1,a2] = splitActsBalanced(acts);
      actsBlock = `<div class="sc-sec">Действия</div><div class="sc-cols">
        <div class="sc-col">${a1.map(actHtml).join('')}</div>
        <div class="sc-col">${a2.map(actHtml).join('')}</div>
      </div>`;
    } else {
      actsBlock = `<div class="sc-sec">Действия</div><div class="sc-acts">${acts.map(actHtml).join('')}</div>`;
    }
  }
  const meta = line('Навыки', md.sk) + line('Чувства', md.sen) + line('Языки', md.lang) + line('Спасброски', md.sav) + line('Защита', md.imm);
  const hint = !b ? `<div class="hint">Участник добавлен вручную — подробного статблока нет.</div>` : '';
  const extra = meta ? `<div class="sc-extra">${meta}</div>` : '';
  if(wide) return `<div class="stat-card wide">${topRow}${initLine}${actsBlock}${extra}${hint}</div>`;
  return `<div class="stat-card">${topRow}${initLine}${actsBlock}${meta}${hint}</div>`;
}
function placeStatExtra(body){
  const cols = [...body.querySelectorAll('.sc-cols .sc-col')];
  const extra = body.querySelector('.sc-extra');
  if(cols.length < 2 || !extra) return;
  const h1 = cols[0].getBoundingClientRect().height;
  const h2 = cols[1].getBoundingClientRect().height;
  (h1 <= h2 ? cols[0] : cols[1]).appendChild(extra);
}

function openStatBlock(p){
  const box = document.getElementById('battleStat');
  const body = document.getElementById('battleStatBody');
  const title = document.getElementById('battleStatTitle');
  const sub = document.getElementById('battleStatSub');
  if(!box || !body || !title || !p) return;
  const b = statBlockOf(p);
  if(!b) return;
  const md = b.mdata || {};
  battleStatBid = p.id;
  title.textContent = p.name;
  sub.textContent = (b.type==='pc')
    ? [(b.props||{})['Раса'], (b.props||{})['Класс']].filter(Boolean).join(' · ')
    : (md.type || '');
  body.innerHTML = statBlockHtml(p);
  box.hidden = false;
  placeStatExtra(body);
}

function closeStatBlock(){
  const box = document.getElementById('battleStat');
  if(box) box.hidden = true;
  battleStatBid = null;
}

function battleNextTurn(){
  if(!battleParts.length){ toast('В бою никого нет'); return; }
  const sorted = battleSorted();
  let i = sorted.findIndex(p=>p.id===battleTurn.turnId);
  i = i < 0 ? 0 : i + 1;
  if(i >= sorted.length){ i = 0; battleTurn.round += 1; }
  battleTurn.turnId = sorted[i].id;
  saveBattleTurn(); renderBattle();
  battleLogPush('Раунд ' + battleTurn.round + ' · ход: ' + sorted[i].name);
}
function applyBattleDamage(inp){
  const p = battleParts.find(x=>x.id===inp.dataset.bid);
  if(!p) return;
  const dmg = Math.max(0, Math.round(+inp.value)||0);
  inp.value='';
  if(dmg<=0){ if(p.hp==='') return; }
  ensureHpMax(p);
  const woundBefore = woundState(p);
  const cur = p.hp==='' ? 0 : (p.hp||0);
  p.hp = Math.max(0, cur - dmg);
  saveBattle();
  const hpInput = document.querySelector(`.battle-list [data-bid="${p.id}"][data-field="hp"]`);
  if(hpInput) hpInput.value = p.hp;
  refreshBattleState(p);
  logWoundChange(p, woundBefore);
  if(dmg>0) toast(`«${p.name}» получил ${dmg} урона → ХП ${p.hp}`);
  if(dmg>0) battleLogPush(`«${p.name}» получил ${dmg} урона → ХП ${p.hp}`);
  if(dmg>0) checkConcentration(p, dmg);
}
/* Урон/лечение по выделенной карточке одной суммой */
function applyAmountTo(p, delta){
  if(!p) return;
  const hasHp = !(p.hp==='' || p.hp==null) || (p.hpMax!=='' && +p.hpMax>0);
  ensureHpMax(p);
  const woundBefore = woundState(p);
  const cur = (p.hp==='' || p.hp==null) ? 0 : (+p.hp || 0);
  const maxHp = (+p.hpMax > 0) ? +p.hpMax : 9999;
  p.hp = Math.max(0, Math.min(maxHp, cur + delta));
  saveBattle();
  refreshBattleState(p);
  logWoundChange(p, woundBefore);
  if(delta < 0){
    battleLogPush(`«${p.name}» получил ${-delta} урона → ХП ${p.hp}`);
    toast(`«${p.name}»: −${-delta} → ХП ${p.hp}`);
    checkConcentration(p, -delta);
  } else {
    battleLogPush(`«${p.name}» вылечен на ${delta} → ХП ${p.hp}`);
    toast(`«${p.name}»: +${delta} → ХП ${p.hp}`);
  }
  if(!hasHp) toast('Подсказка: укажите ХП в карточке, чтобы видеть полоску здоровья');
}

/* Диалог быстрого урона: число, 2d6+3 или +5 для лечения */
function battleDamageDialog(){
  closeStatusPalette();
  const p = battleParts.find(x=>x.id===battleSelId);
  if(!p){ toast('Сначала выберите карточку (↑↓)'); return; }
  uiPrompt(`Урон по «${p.name}» (можно 2d6+3, «+5» — лечение):`, '').then(v=>{
    if(v===null) return;
    const raw = String(v).trim();
    if(!raw) return;
    let amount = null, heal = false;

    if(/^\+\s*\d+$/.test(raw)){ heal = true; amount = parseInt(raw.replace(/\D/g,''),10); }
    else if(/^-?\s*\d+$/.test(raw)){
      const n = parseInt(raw.replace(/\s/g,''),10);
      if(n < 0){ heal = true; amount = -n; } else { amount = n; }
    } else {
      const m = /^(\d+)\s*d\s*(\d+)\s*(?:([+-])\s*(\d+))?$/i.exec(raw.replace(/\s+/g,''));
      if(m){
        const n = Math.min(100, +m[1]), d = Math.min(1000, +m[2]);
        let total = 0;
        for(let i=0;i<n;i++) total += 1 + Math.floor(Math.random()*d);
        total += (m[3] === '-' ? -1 : 1) * (+m[4] || 0);
        amount = Math.max(0, total);
        battleLogPush(`Бросок урона: ${raw} = ${amount}`);
        toast(`${raw} → ${amount}`);
      }
    }
    if(amount === null || !isFinite(amount)){ uiAlert('Не понял значение: «'+raw+'»'); return; }
    applyAmountTo(p, heal ? amount : -amount);
  });
}

const BATTLE_STATUSES = ['Концентрация','Ослеплён','Оглох','Очарован','Испуган','Отравлен','Парализован','Окаменел','Схвачен','Опутан','Сбит с ног','Ошеломлён','Без сознания','Невидимый','Недееспособен','Истощён','Ускорен','Замедлен'];
function ensureHpMax(p){
  if(!p) return;
  const hp = (p.hp==='' || p.hp==null) ? null : +p.hp;
  if(hp === null || !isFinite(hp)) return;
  const max = (p.hpMax==='' || p.hpMax==null) ? 0 : (+p.hpMax || 0);
  if(max <= 0 || hp > max) p.hpMax = Math.max(0, Math.round(hp));
}
function woundState(p){
  const max = hpMaxNum(p.hpMax);
  const cur = hpCurNum(p.hp);
  if(!max || cur === null) return '';
  return woundOf(Math.min(1, cur / max));
}
function woundTag(p){
  const st = woundState(p);
  if(!st) return '';
  const label = woundLabel(st);
  return st==='wounded' ? `<span class="bt-wound">${label}</span>` : `<span class="bt-wound crit">${label}</span>`;
}
function logWoundChange(p, before){
  const after = woundState(p);
  if(after===before) return;
  if(after) battleLogPush(`«${p.name}» — ${woundLabel(after)} (ХП ${p.hp}/${p.hpMax})`);
  else if(before) battleLogPush(`«${p.name}» — состояние в норме (ХП ${p.hp}/${p.hpMax})`);
}
function hpPct(p){
  const max = hpMaxNum(p.hpMax);
  if(!max) return null;
  const cur = hpCurNum(p.hp);
  return Math.max(0, Math.min(100, Math.round((cur === null ? 0 : cur) / max * 100)));
}
function hpBarTag(p){
  const pct = hpPct(p);
  if(pct===null) return '';
  const st = woundState(p);
  const cls = (st==='critical' || st==='dead') ? ' crit' : (st==='wounded' ? ' warn' : '');
  return `<span class="bt-hpbar${cls}" title="ХП ${p.hp}/${p.hpMax}"><i style="width:${pct}%"></i></span>`;
}
function hpMaxTag(p){
  const max = (p.hpMax!=='' && p.hpMax!=null && +p.hpMax>0) ? +p.hpMax : 0;
  if(!max) return '';
  const st = woundState(p);
  const cls = (st==='critical' || st==='dead') ? ' crit' : '';
  return `<span class="bt-hpmax${cls}" title="Максимум хитов">/ ${max}</span>`;
}
function refreshBattleState(p){
  if(!p) return;
  const card = document.querySelector(`.battle-card[data-bid="${p.id}"]`);
  if(!card) return;
  const nameInput = card.querySelector('.bt-name');
  const hpInput = card.querySelector('.bt-hp');
  if(!nameInput || !hpInput) return;
  const nameLine = card.querySelector('.bt-name-wrap') || nameInput;
  const wHtml = woundTag(p);
  const wOld = card.querySelector('.bt-wound');
  if(!wHtml){ if(wOld) wOld.remove(); }
  else if(wOld){ wOld.outerHTML = wHtml; }
  else { nameLine.insertAdjacentHTML('beforeend', wHtml); }
  const bHtml = hpBarTag(p);
  const bOld = card.querySelector('.bt-hpbar');
  if(!bHtml){ if(bOld) bOld.remove(); }
  else if(bOld){ bOld.outerHTML = bHtml; }
  else { hpInput.insertAdjacentHTML('beforebegin', bHtml); }
  const mHtml = hpMaxTag(p);
  const mOld = card.querySelector('.bt-hpmax');
  if(!mHtml){ if(mOld) mOld.remove(); }
  else if(mOld){ mOld.outerHTML = mHtml; }
  else { hpInput.insertAdjacentHTML('afterend', mHtml); }
  if(hpInput.value !== String(p.hp)) hpInput.value = p.hp;
}

function addBlockToBattle(b){
  if(!b) return;
  const side = b.type==='mob' ? 'opp' : 'char';
  const md = b.mdata||{};
  const p = b.props||{};
  const name = b.title || 'Участник';
  const ac = side==='opp'
    ? (md.ac!==undefined ? md.ac : '')
    : (p['Броня КК'] ?? p['КД'] ?? p['AC'] ?? '');
  const hp = side==='opp'
    ? (md.hp!==undefined ? md.hp : '')
    : (hpMaxOf(b) || (p['ХП'] ?? p['HP'] ?? ''));
  const init = side==='opp'
    ? (md.init!==undefined ? md.init : '')
    : (p['Инициат'] ?? p['Иниц'] ?? '');
  const acts = side==='opp' ? ((md.acts||[]).map(a=>({tag:String(a.tag||''),text:String(a.text||'')}))) : [];
  const hpNum = numField(hp);
  battleParts.push({ srcId: b.id, id:uniq(), name:String(name).slice(0,60), side,
    ac: numField(ac), hp: hpNum, hpMax: hpNum, init: numField(init), atk: '', acts, applied: [], statuses: [] });
  saveBattle(); renderBattle();
  toast('«'+name+'» добавлен(а) в бой');
  showTab('battle');
}
function battleAdd(side, preset){
  const base = (preset !== undefined && preset !== null && String(preset).trim())
    ? String(preset).trim()
    : (side==='opp' ? 'Противник' : 'Персонаж');
  const same = battleParts.filter(p => p.name === base || p.name.indexOf(base + ' ') === 0).length;
  const name = (same ? base + ' ' + (same + 1) : base).slice(0,60);
  const rec = { id:uniq(), name, side, ac:'', hp:'', hpMax:'', init:'', atk:'', acts:[], applied:[], statuses:[] };
  battleParts.push(rec);
  battleSelId = rec.id;
  saveBattle(); renderBattle();
  battleLogPush(`«${name}» добавлен в бой`);
  const card = document.querySelector(`.battle-card[data-bid="${rec.id}"]`);
  if(card){
    card.focus();
    const nm = card.querySelector('.bt-name');
    if(nm){ nm.focus(); nm.select(); }
  }
}
/* ── Быстрые статусы и клавиатура в бою ── */
let paletteBid = null;
let paletteAnchor = null;
let battleSelId = null;

function toggleStatus(bid, name){
  const p = battleParts.find(x=>x.id===bid);
  if(!p) return;
  if(!Array.isArray(p.statuses)) p.statuses = [];
  const i = p.statuses.indexOf(name);
  if(i>=0) p.statuses.splice(i,1); else p.statuses.push(name);
  saveBattle(); renderBattle();
  battleLogPush(`«${p.name}»: ${i>=0?'снят статус':'статус'} «${name}»`);
}

function paletteBox(){
  const box = document.getElementById('battleStatusPalette');
  if(box && box.parentElement !== document.body) document.body.appendChild(box);
  return box;
}

function renderStatusPalette(bid, anchor){
  const box = paletteBox();
  if(!box) return;
  const p = battleParts.find(x=>x.id===bid);
  if(!p) return;
  if(anchor && !anchor.isConnected) anchor = null;
  if(!anchor){
    const card = document.querySelector(`.battle-card[data-bid="${bid}"]`);
    if(card) anchor = card.querySelector('[data-details]');
  }
  paletteBid = bid; paletteAnchor = anchor || null;
  const on = Array.isArray(p.statuses) ? p.statuses : [];
  const acts = Array.isArray(p.acts) ? p.acts : [];
  const applied = Array.isArray(p.applied) ? p.applied : [];
  box.innerHTML = `
    <div class="bp-head"><span>${escapeHtml(p.name)}</span>${p.srcId && statBlockOf(p) ? `<button type="button" class="bp-stat" data-bp-stat="${p.id}" title="Открыть статблок">статблок</button>` : ''}<button type="button" class="bp-x" data-bp-close title="Закрыть" aria-label="Закрыть">✕</button></div>
    <div class="bp-grid">
      ${BATTLE_STATUSES.map((st,i)=>`<button type="button" class="${on.includes(st)?'on':''}" data-pst="${escapeHtml(st)}"><span class="num">${i+1}</span>${escapeHtml(st)}</button>`).join('')}
    </div>
    ${acts.length ? `<div class="bp-sub">Действия</div><div class="bp-acts">${acts.map((a,i)=>`<button type="button" class="bp-act-row" data-bp-act="${i}" title="${escapeHtml(a.text)}">${a.tag?`<span class="bp-tag">${escapeHtml(a.tag)}</span>`:''}<span class="bp-act-txt">${highlightAct(a.text)}</span><span class="bp-act-go" aria-hidden="true">📝</span></button>`).join('')}</div>` : ''}
    ${applied.length ? `<div class="bp-sub">Эффекты</div><div class="bp-chips">${applied.map((t,i)=>`<span class="bt-chip">${escapeHtml(t)}<button type="button" class="bt-chip-del" data-achip="${p.id}" data-ai="${i}" title="Убрать">✕</button></span>`).join('')}</div>` : ''}
  `;
  box.hidden = false;
  box.style.position = 'fixed';
  box.style.width = 'min(360px, calc(100vw - 16px))';
  box.style.left = '0px'; box.style.top = '0px';
  const bw = box.offsetWidth, bh = box.offsetHeight;
  const el = anchor || document.getElementById('battleList');
  const r = el ? el.getBoundingClientRect() : { right: innerWidth - 12, bottom: 90, top: 60 };
  let left = Math.round(r.right - bw);
  left = Math.max(8, Math.min(left, innerWidth - bw - 8));
  let top = Math.round(r.bottom + 6);
  if(top + bh > innerHeight - 8) top = Math.max(8, Math.round(r.top - bh - 6));
  box.style.left = left + 'px';
  box.style.top = top + 'px';
}

function closeStatusPalette(){
  const box = document.getElementById('battleStatusPalette');
  if(box) box.hidden = true;
  paletteBid = null; paletteAnchor = null;
}

function paletteIsOpen(){
  const box = document.getElementById('battleStatusPalette');
  return !!(box && !box.hidden);
}

function bindBattleKeyboard(){
  const pal = document.getElementById('battleStatusPalette');
  if(pal){
    pal.addEventListener('click', e=>{
      e.stopPropagation();
      const bid = paletteBid;
      if(e.target.closest('[data-bp-close]')){ closeStatusPalette(); return; }
      const stBtn = e.target.closest('[data-bp-stat]');
      if(stBtn){
        const p = battleParts.find(x=>x.id===stBtn.dataset.bpStat);
        closeStatusPalette();
        if(p) openStatBlock(p);
        return;
      }
      if(!bid) return;
      const b = e.target.closest('[data-pst]');
      if(b){ toggleStatus(bid, b.dataset.pst); renderStatusPalette(bid, paletteAnchor); return; }
      const actBtn = e.target.closest('[data-bp-act]');
      if(actBtn){
        const p = battleParts.find(x=>x.id===bid);
        const a = p && (p.acts||[])[+actBtn.dataset.bpAct];
        if(!p || !a) return;
        const txt = (a.tag? a.tag+': ' : '') + a.text;
        battleLogPush(`«${p.name}» → ${txt}`);
        return;
      }
      const chip = e.target.closest('[data-achip]');
      if(chip){
        const p = battleParts.find(x=>x.id===chip.dataset.achip);
        if(p && Array.isArray(p.applied)){ p.applied.splice(+chip.dataset.ai,1); saveBattle(); renderBattle(); renderStatusPalette(p.id, paletteAnchor); }
        return;
      }
    });
  }

  document.addEventListener('keydown', e=>{
    if(currentTab !== 'battle') return;
    if(e.altKey || e.ctrlKey || e.metaKey) return;   // служебные сочетания — не наши
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    const typing = tag==='input' || tag==='textarea' || tag==='select' || (e.target && e.target.isContentEditable);

    if(e.key === 'Escape' && paletteIsOpen()){ closeStatusPalette(); return; }
    if(typing) return;

    if(e.key === 'n' || e.key === 'N' || e.key === 'т' || e.key === 'Т'){
      e.preventDefault(); battleNextTurn(); return;
    }

    if(paletteIsOpen() && /^[1-9]$/.test(e.key)){
      const st = BATTLE_STATUSES[+e.key - 1];
      const bid = paletteBid;
      if(st && bid){ e.preventDefault(); toggleStatus(bid, st); if(paletteIsOpen()) renderStatusPalette(bid, paletteAnchor); }
      return;
    }

    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      const list = battleSorted();
      if(!list.length) return;
      e.preventDefault();
      let i = list.findIndex(p=>p.id===battleSelId);
      if(i < 0) i = e.key === 'ArrowDown' ? -1 : list.length;
      const j = e.key === 'ArrowDown' ? Math.min(list.length-1, i+1) : Math.max(0, i-1);
      battleSelId = list[j].id;
      renderBattle();
      const card = document.querySelector(`.battle-card[data-bid="${battleSelId}"]`);
      if(card) card.scrollIntoView({ block:'nearest' });
      return;
    }

    const sel = battleSelId ? battleParts.find(p=>p.id===battleSelId) : null;
    if(!sel) return;

    if(e.key === 'Enter'){
      e.preventDefault();
      renderStatusPalette(sel.id);
      return;
    }
    if(e.key === 's' || e.key === 'S' || e.key === 'ы' || e.key === 'Ы'){
      e.preventDefault();
      renderStatusPalette(sel.id);
      return;
    }
    if(e.key === 'd' || e.key === 'D' || e.key === 'в' || e.key === 'В'){
      e.preventDefault();
      battleDamageDialog();
      return;
    }
    if(e.key === 'Delete' && e.shiftKey){
      e.preventDefault();
      const gone = sel;
      battleParts = battleParts.filter(x=>x.id!==sel.id);
      battleSelId = null; saveBattle(); renderBattle();
      battleLogPush(`«${gone.name}» убран из боя`);
    }
  });
}

/* Модификатор Телосложения участника: из карточки-источника, если она есть */
function conModOf(p){
  try{
    const b = (p && p.srcId && typeof findBlock==='function') ? findBlock(p.srcId) : null;
    if(b && Array.isArray(b.stats) && b.stats.length >= 3){
      const v = +b.stats[2];
      if(isFinite(v)) return Math.floor((v-10)/2);
    }
  }catch(e){}
  return 0;
}
/* ХП на нуле → концентрация снимается без броска */
function dropConcentrationIfDown(p){
  if(!p || p.hp==='' || p.hp==null) return false;
  if((+p.hp || 0) > 0) return false;
  const arr = p.statuses || [];
  const i = arr.indexOf('Концентрация');
  if(i < 0) return false;
  arr.splice(i, 1);
  saveBattle();
  battleLogPush(`«${p.name}»: ХП 0 — концентрация снята`);
  return true;
}
function checkConcentration(p, dmg){
  if(!p || !(p.statuses||[]).includes('Концентрация') || !(dmg>0)) return;
  if(p.hp!=='' && (+p.hp || 0) <= 0){
    if(dropConcentrationIfDown(p)) renderBattle();
    return;
  }
  const dc = Math.max(10, Math.floor(dmg/2));
  const mod = conModOf(p);
  const roll = 1 + Math.floor(Math.random()*20);
  const total = roll + mod;
  const ok = total >= dc;
  const modTxt = mod ? (' ' + (mod>0?'+':'') + mod) : '';
  battleLogPush(`«${p.name}»: концентрация Сл ${dc} — бросок ${roll}${modTxt} = ${total}, ${ok?'успех':'провал'}`);
  if(ok) toast(`Концентрация удержана: ${total} ≥ ${dc}`);
  else toast(`Концентрация сорвана: ${total} < ${dc}`);
  if(!ok){
    p.statuses = (p.statuses||[]).filter(x=>x!=='Концентрация');
    saveBattle();
  }
  renderBattle();
}
function bindBattle(){
  const addOpp = document.getElementById('battleAddOpp');
  const addChar = document.getElementById('battleAddChar');
  const nextBtn = document.getElementById('battleNextTurn');
  if(nextBtn) nextBtn.addEventListener('click', battleNextTurn);
  const clr = document.getElementById('battleClear');
  if(addOpp) addOpp.addEventListener('click', ()=> battleAdd('opp'));
  if(addChar) addChar.addEventListener('click', ()=> battleAdd('char'));
  if(clr){
    let armed=false, timer=null;
    const disarm=()=>{ armed=false; clr.classList.remove('armed'); clr.textContent='✕ Очистить'; };
    clr.addEventListener('click', ()=>{
      if(!battleParts.length) return;
      if(!armed){
        armed=true; clr.classList.add('armed'); clr.textContent='Точно очистить?';
        timer=setTimeout(disarm, 3000);
        return;
      }
      clearTimeout(timer); disarm();
      battleParts=[]; battleTurn={round:1, turnId:null}; closeStatBlock(); saveBattle(); saveBattleTurn(); renderBattle(); battleLogPush('Бой очищен');
    });
  }
  const list = document.getElementById('battleList');
  if(list){
    list.addEventListener('input', e=>{
      const inp = e.target.closest('[data-field]');
      if(!inp) return;
      const p = battleParts.find(x=>x.id===inp.dataset.bid);
      if(!p) return;
      const f = inp.dataset.field;
      if(f==='name'){ p.name = inp.value.slice(0,60); }
      else { p[f] = numField(inp.value); }
      if(f==='hp'){ ensureHpMax(p); if(dropConcentrationIfDown(p)) renderBattle(); refreshBattleState(p); }
      saveBattle();
    });
    /* порядок пересобираем только когда ввод закончен: иначе карточка
       переезжает на первом же символе и поле теряет фокус */
    list.addEventListener('change', e=>{
      const inp = e.target.closest('[data-field="init"]');
      if(!inp) return;
      const p = battleParts.find(x=>x.id===inp.dataset.bid);
      if(!p) return;
      const v = numField(inp.value);
      if(p.init !== v){ p.init = v; saveBattle(); }
      const order = battleSorted().map(x=>x.id);
      const els = [...list.querySelectorAll('.battle-card')];
      els.sort((x,y)=> order.indexOf(x.dataset.bid) - order.indexOf(y.dataset.bid));
      els.forEach(el=> { if(el.parentNode) el.parentNode.appendChild(el); });
    });
    list.addEventListener('click', e=>{
      const card = e.target.closest('.battle-card');
      if(card){ battleSelId = card.dataset.bid; }
      const statBtn = e.target.closest('[data-stat]');
      if(statBtn){
        const p = battleParts.find(x=>x.id===statBtn.dataset.stat);
        if(p) openStatBlock(p);
        return;
      }
      const detBtn = e.target.closest('[data-details]');
      if(detBtn){
        const p = battleParts.find(x=>x.id===detBtn.dataset.details);
        if(p) renderStatusPalette(p.id, detBtn);
        return;
      }
      if(card && !e.target.closest('input,button,select,textarea,label,[contenteditable]')){
        const p = battleParts.find(x=>x.id===card.dataset.bid);
        if(p && statBlockOf(p)) openStatBlock(p);
        else if(battleStatBid) closeStatBlock();
      }
      const del = e.target.closest('[data-del]');
      if(del){
        const gone = battleParts.find(x=>x.id===del.dataset.del);
        battleParts = battleParts.filter(x=>x.id!==del.dataset.del);
        if(battleStatBid === del.dataset.del) closeStatBlock();
        saveBattle(); renderBattle();
        if(gone) battleLogPush(`«${gone.name}» убран из боя`);
        return;
      }
      const chip = e.target.closest('[data-achip]');
      if(chip){
        const p = battleParts.find(x=>x.id===chip.dataset.achip);
        if(p && Array.isArray(p.applied)){ p.applied.splice(+chip.dataset.ai,1); saveBattle(); renderBattle(); }
        return;
      }
      const stDel = e.target.closest('[data-status-del]');
      if(stDel){
        const p = battleParts.find(x=>x.id===stDel.dataset.statusDel);
        if(p && Array.isArray(p.statuses)){
          const removed = p.statuses[+stDel.dataset.si];
          p.statuses.splice(+stDel.dataset.si,1);
          saveBattle(); renderBattle();
          if(removed) battleLogPush(`«${p.name}» — снят статус: ${removed}`);
        }
        return;
      }
      const acBtn = e.target.closest('[data-ac-op]');
      if(acBtn){
        const p = battleParts.find(x=>x.id===acBtn.dataset.bid);
        if(!p) return;
        const cur = p.ac==='' ? 0 : (+p.ac||0);
        const nv = Math.max(0, acBtn.dataset.acOp==='dec' ? cur-1 : cur+1);
        p.ac = nv; saveBattle();
        const inp = list.querySelector(`[data-bid="${p.id}"][data-field="ac"]`);
        if(inp) inp.value = nv;
        return;
      }
      const dmgBtn = e.target.closest('[data-dmg-op]');
      if(dmgBtn){
        const p = battleParts.find(x=>x.id===dmgBtn.dataset.bid);
        if(!p) return;
        ensureHpMax(p);
        const woundBefore = woundState(p);
        const cur = p.hp==='' ? 0 : (+p.hp||0);
        p.hp = dmgBtn.dataset.dmgOp==='inc' ? Math.max(0, cur-1) : cur+1;
        saveBattle();
        const hpInp = list.querySelector(`[data-bid="${p.id}"][data-field="hp"]`);
        if(hpInp) hpInp.value = p.hp;
        refreshBattleState(p);
        logWoundChange(p, woundBefore);
        const dmgInp = list.querySelector(`[data-bid="${p.id}"][data-dmg]`);
        if(dmgInp) dmgInp.value = '';
        battleLogPush(dmgBtn.dataset.dmgOp==='inc'
          ? `«${p.name}» получил 1 урон → ХП ${p.hp}`
          : `«${p.name}» вылечен на 1 → ХП ${p.hp}`);
        if(dmgBtn.dataset.dmgOp==='inc' && p.hp===0 && dropConcentrationIfDown(p)) renderBattle();
        return;
      }
      const hpBtn = e.target.closest('[data-hp-op]');
      if(hpBtn){
        const p = battleParts.find(x=>x.id===hpBtn.dataset.bid);
        if(!p) return;
        ensureHpMax(p);
        const woundBefore = woundState(p);
        const cur = p.hp==='' ? 0 : (p.hp||0);
        const nv = hpBtn.dataset.hpOp==='dec' ? Math.max(0, cur-1) : cur+1;
        p.hp = nv; saveBattle();
        const hpInput = list.querySelector(`[data-bid="${p.id}"][data-field="hp"]`);
        if(hpInput) hpInput.value = nv;
        refreshBattleState(p);
        logWoundChange(p, woundBefore);
        battleLogPush(`«${p.name}»: ХП ${nv}`);
        if(dropConcentrationIfDown(p)) renderBattle();
        return;
      }
      const atkBtn = e.target.closest('[data-attack]');
      if(atkBtn){
        const p = battleParts.find(x=>x.id===atkBtn.dataset.bid);
        if(!p) return;
        const bonus = p.atk==='' ? 0 : (p.atk||0);
        const roll = 1+Math.floor(Math.random()*20);
        const total = roll+bonus;
        let note='';
        if(roll===20) note=' — КРИТ!';
        else if(roll===1) note=' — промах';
        else if(p.ac!=='' && p.ac!=null) note = total >= p.ac ? ' — попадание' : ' — промах';
        toast(`Атака «${p.name}»: d20 ${roll} + ${bonus} = ${total}${note}`);
        return;
      }
    });
    list.addEventListener('keydown', e=>{
      const dmg = e.target.closest('[data-dmg]');
      if(!dmg) return;
      if(e.key==='Enter'){ applyBattleDamage(dmg); e.preventDefault(); }
    });
    list.addEventListener('change', e=>{
      const dmg = e.target.closest('[data-dmg]');
      if(dmg){ applyBattleDamage(dmg); return; }
    });
  }
  loadBattle();
  loadBattleTurn();
  loadBattleLog();
  renderBattleLog();
  const logClear = document.getElementById('battleLogClear');
  if(logClear) logClear.addEventListener('click', ()=>{ battleLog=[]; saveBattleLog(); renderBattleLog(); });
  loadBattleNote();
  const qn=document.getElementById('battleQuickNote');
  const qa=document.getElementById('battleQuickNoteAdd');
  if(qn){
    qn.addEventListener('input', ()=> saveBattleNote(qn.value));
    const pushNote=()=>{
      const v=qn.value.trim(); if(!v) return;
      battleLogPush('📝 '+v);
      qn.value=''; saveBattleNote('');
    };
    qn.addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); pushNote(); } });
    if(qa) qa.addEventListener('click', pushNote);
  }
  const statBox = document.getElementById('battleStat');
  if(statBox){
    const statClose = document.getElementById('battleStatClose');
    const statGrow = document.getElementById('battleStatGrow');
    if(statClose) statClose.addEventListener('click', closeStatBlock);
    if(statGrow) statGrow.addEventListener('click', ()=>{
      statBox.classList.toggle('grow');
      statGrow.textContent = statBox.classList.contains('grow') ? '⤡' : '⤢';
      statGrow.title = statBox.classList.contains('grow') ? 'Свернуть по высоте' : 'Развернуть по высоте';
    });
  }
  document.addEventListener('click', e=>{
    if(!paletteIsOpen()) return;
    if(e.target.closest('#battleStatusPalette') || e.target.closest('[data-details]')) return;
    closeStatusPalette();
  });
}
/* ════════════ Эффекты монстров по типам ════════════ */
const MON_TYPE_EFFECTS = {
  'Аберрация': {
    desc:'Осколки реальности и чужие разумы: устойчивы к контролю разума, бьют по ментальности.',
    rows:[
      ['Телепатия','Контроль на расстоянии','Урон/контроль без прямого контакта; спасброски Интеллекта/Мудрости'],
      ['Разрушение разума','Специальное','Атака по Инт/Мудр: при провале — снижение спасбросков, накладывает «Ошеломлён»'],
      ['Сбивание концентрации','Против заклинателей','Метаются объекты/вспышки, чтобы сорвать концентрацию и дистанцию'],
    ]
  },
  'Зверь': {
    desc:'Обычные животные: нет магических способностей, но быстры и опасны в стае.',
    rows:[
      ['Когти/клыки','Простая атака','Обычно только урон; бонус стаи даёт преимущество на бросок атаки'],
      ['Стая','Ситуационный бонус','+к атаке/урону, если рядом союзник; уязвимы к запугиванию и огню'],
      ['Охота','Тактика','При ХП ниже половины — агрессивнее, бонус к урону'],
    ]
  },
  'Конструкт': {
    desc:'Механизмы и големы: без усталости, невосприимчивы ко многим состояниям, точные удары.',
    rows:[
      ['Точные удары','Оружие','Часто бонус к броску атаки; точнее по неподвижным целям'],
      ['Иммунитеты','Состояния','Яд, очарование, испуг, усталость, паралич и отравление обычно не действуют'],
      ['Встроенное оружие','Специальное','Жало/лучи/шипы; перезарядка по их правилам'],
    ]
  },
  'Дракон': {
    desc:'Дыхание и страх: мощные атаки по площади, страшащая аура у взрослых особей.',
    rows:[
      ['Дыхание','Оружие по площади','Линия/конус, спасбросок Ловк/Сил/Телос; перезарядка через ход'],
      ['Страх','Аура легендарного дракона','Спасбросок Мудрости; при провале — «Испуган»'],
      ['Легендарные действия','До 3 за ход','Атака хвостом/крыльями вне очереди в конце хода противника'],
    ]
  },
  'Элементаль': {
    desc:'Стихии: устойчивы к своему типу, иммунны к яду/усталости, не нуждаются в дыхании.',
    rows:[
      ['Стихийная атака','Урон стихией','Бонус к урону своей стихией; иммунитет к яду, оглушению, усталости'],
      ['Передвижение','Форма','Летает / плавает / проходит сквозь землю — сложно заблокировать'],
      ['Вихрь / вспышка','Область','Сбивает с ног, гасит огонь, снимает концентрацию'],
    ]
  },
  'Фея': {
    desc:'Природа и иллюзии: очарование, ускорение, обман; слабы против холодного железа.',
    rows:[
      ['Очарование','Контроль','Спасбросок Мудрости; при провале — «Очарован»/«Подчинён»'],
      ['Иллюзии / лёгкость','Обман','Иллюзии, невидимость, ускорение; спасброски Интеллекта/Мудрости'],
      ['Уязвимость','Холодное железо','Урон от холодного железа 1d6 не-магического урона'],
    ]
  },
  'Исчадие': {
    desc:'Нижние планы: устойчивы к огню/яду/холоду, стойки ко многим состояниям.',
    rows:[
      ['Сопротивления','Общее','Огню, яду, холоду; иммунитет к яду, очарованию, испугу нередко'],
      ['Проклятия и яд','Специальное','Проклятия, заражение, «Отравлен»; урон, понижающий максимум ХП'],
      ['Магическое сопротивление','Общее','Преимущество на спасброски от заклинаний'],
    ]
  },
  'Гигант': {
    desc:'Мощь и бросок камней: здоровые физические спасброски, атаки по площади ударом.',
    rows:[
      ['Бросок камня','Дальняя атака','Высокий урон; учёт укрытий, может бросать по области'],
      ['Размашистый удар','По площади','Конус/круг перед собой; спасбросок Ловкости'],
      ['Стойкость','ХП','Много ХП; слаб к магии разума, но силён физически'],
    ]
  },
  'Гуманоид': {
    desc:'Разум и оружие: используют снаряжение и тактику, нет врождённой сверхзащиты.',
    rows:[
      ['Оружие','Стандарт','Обычные атаки; ищите магическое оружие и преимущества в строю'],
      ['Тактика / строй','Бонусы','Бонусы «Строю»/«Кличу» при союзниках; слабеет изолированный'],
      ['Яды и ловушки','Снаряжение','Яды (спасбросок Телосложения), ловушки, подкопы'],
    ]
  },
  'Чудовище': {
    desc:'Крупные хищники: уникальные физические способности, сложные атаки с эффектами.',
    rows:[
      ['Жало / клешня / щупальца','Специальное','Атаки с накопленными эффектами: яд, хватка, усыхание'],
      ['Хватка','Контроль','При попадании — «Схвачен»; проверка Сил/Ловк, чтобы высвободиться'],
      ['Сенсоры','Обнаружение','Тёмное зрение, слепозрение, «обоняние» — трудно скрыться'],
    ]
  },
  'Слизь (Тварь-желе)': {
    desc:'Бесформенные пожиратели: растворяют снаряжение, проходят сквозь щели, стоек к яду.',
    rows:[
      ['Растворение','Против снаряжения','Повреждает оружие/броню при касании; иммунитет к ослеплению'],
      ['Сквозь щели','Передвижение','Проходит через узкие проёмы до 1–5 см'],
      ['Иммунитеты','Состояния','Яд, усталость, очарование, испуг, паралич, ослепление'],
    ]
  },
  'Растение': {
    desc:'Недвижимые ловушки: корни и усики, ядовитые споры, стойкость к яду.',
    rows:[
      ['Корни / усики','Хватка','«Опутан»/«Схвачен» корнями при касании'],
      ['Споры / пыльца','Яд','Конус спор: яд (Телос) или «Опутан»'],
      ['Иммунитеты','Состояния','Яд, очарование, испуг; уязвимы к огню'],
    ]
  },
  'Нежить': {
    desc:'Мёртвые души: сопротивляются немагическому урону, атаки с жизнеотводом и страхом.',
    rows:[
      ['Жизнеотвод','Урон + лечит','Урон добавляется к ХП нежити при попадании'],
      ['Паралич / страх','Состояния','При провале — «Парализован»/«Испуган»; спасброски Телос/Мудр'],
      ['Иммунитеты','Общее','Яд, усталость, очарование, испуг; сопротивление немагическому урону'],
    ]
  },
};
const monEffModal = document.getElementById('monEffModal');
const monEffType = document.getElementById('monEffType');
const monEffResults = document.getElementById('monEffResults');
function renderMonEff(){
  if(!monEffResults) return;
  const t = monEffType ? monEffType.value : '';
  const keys = Object.keys(MON_TYPE_EFFECTS);
  const list = t ? [t] : keys;
  if(!list.length){ monEffResults.innerHTML='<div class="lib-empty">Нет данных.</div>'; return; }
  monEffResults.innerHTML = list.map(k=>{
    const e = MON_TYPE_EFFECTS[k];
    return `<div class="me-type">
      <div class="me-head">${escapeHtml(k)}</div>
      <div class="hint" style="margin-bottom:6px">${escapeHtml(e.desc)}</div>
      <table class="me-table">
        <thead><tr><th>Эффект</th><th>Тип</th><th>Как применяется</th></tr></thead>
        <tbody>${(e.rows||[]).map(r=>`<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td><td>${escapeHtml(r[2])}</td></tr>`).join('')}</tbody>
      </table>
    </div>`;
  }).join('');
}
document.getElementById('btnMonEffects').addEventListener('click', ()=>{
  if(monEffType && !monEffType.options.length){
    Object.keys(MON_TYPE_EFFECTS).forEach(k=>{
      const o=document.createElement('option'); o.value=k; o.textContent=k; monEffType.appendChild(o);
    });
  }
  monEffType.value = '';
  openModal(monEffModal, document.getElementById('btnMonEffects'));
  renderMonEff();
});
document.getElementById('monEffClose').addEventListener('click', ()=> closeModal(monEffModal));
monEffModal.addEventListener('click', e=>{ if(e.target===monEffModal) closeModal(monEffModal); });
if(monEffType) monEffType.addEventListener('change', renderMonEff);

(function init(){
  initCanvasEvents();
  collapsed = new Set();
  if(!load()){ blocks = SAMPLES.map(s=>makeBlock(s.type,s.title,{title:s.title, links:s.links, stats:s.stats||[10,10,10,10,10,10], props:s.props||{}, res:sanitizeRes(s.res), text:s.text||''})); }
  blocks.forEach(b=>{ collapsed.add(b.id); });
  if(ensureBgProp()) persistBlocks();
  loadMap();
  // загрузка медиа из IndexedDB + миграция старых base64 из localStorage
  loadAllMedia().then(()=>{
    let migrated=false;
    blocks.forEach(b=>{
      if(b.data && (b.kind==='image'||b.kind==='doc') && !b.dataKey){
        const key='media_'+b.id; mediaCache[key]=b.data; idbPut(key,b.data); b.dataKey=key; b.data=''; migrated=true;
      }
    });
    maps.forEach(m=>{
      if(m.bg && !m.bgKey){
        const key='mapbg_'+m.id; mediaCache[key]=m.bg; idbPut(key,m.bg); m.bgKey=key; m.bg=''; migrated=true;
      }
    });
    if(migrated){ persistBlocks(); saveMap(); }
    render(); renderMap();
  });
  let savedTab='home';
  try{ savedTab=localStorage.getItem(KEYS.tab)||'home'; }catch(e){}
  if(!['home','chars','monsters','sessions','map','battle','music'].includes(savedTab)) savedTab='home';
  bindBattle();
  bindBattleKeyboard();
  musicInit();
  // броски костей живут на панели боя
  { const db=document.querySelector('.topbar .dicebar');
    const tb=document.getElementById('battleToolbar');
    if(db && tb && !tb.contains(db)) tb.insertBefore(db, tb.firstChild); }
  showTab(savedTab);   // remember последняя вкладка
  hydrateIcons();
})();
