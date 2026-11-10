/* ════════════ Вкладка «Бой» ════════════ */
const STORE_BATTLE = 'shirma_battle_v1';
const STORE_BATTLE_LOG = 'shirma_battle_log_v1';
let battleParts = [];   // {id,name,side:'opp'|'char',ac,hp,init}
let battleTurn = { round: 1, turnId: null };
const STORE_BATTLE_TURN = 'shirma_battle_turn_v1';
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
      collapsed: !!p.collapsed }));
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
  list.innerHTML = sorted.map(p=>`
    <div class="battle-card ${p.side==='opp'?'opp':''}${p.collapsed?' collapsed':''}${p.id===battleSelId?' sel':''}${p.id===battleTurn.turnId?' turn':''}" data-bid="${p.id}" tabindex="0">
      <span class="bt-chev" title="Свернуть/развернуть">▾</span>
      <div class="bt-side">${gi(p.side==='opp'?'monsters':'character')}</div>
      <span class="bt-nameline">
        <input class="bt-name" data-field="name" data-bid="${p.id}" value="${escapeHtml(p.name)}" spellcheck="false" aria-label="Имя">
        ${woundTag(p)}
      </span>
      ${(p.acts && p.acts.length) ? `<div class="bt-acts">
        <select class="bt-acts-select" data-act-select="${p.id}" aria-label="Действия монстра">
          <option value="">действие…</option>
          ${p.acts.map((a,i)=>`<option value="${i}">${escapeHtml((a.tag? a.tag+': ' : '')+ a.text.slice(0,90))}</option>`).join('')}
        </select>
      </div>` : ''}
      <span class="bt-grp bt-stat bt-acgrp">
        <span class="bt-ico" title="КД" aria-hidden="true">${gi('shield')}</span>
        <input class="bt-in bt-ac" data-field="ac" data-bid="${p.id}" type="number" value="${p.ac}" aria-label="КД">
        <span class="bt-step">
          <button class="bt-stepbtn" data-ac-op="inc" data-bid="${p.id}" title="+1 КД" aria-label="+1 КД">+</button>
          <button class="bt-stepbtn" data-ac-op="dec" data-bid="${p.id}" title="−1 КД" aria-label="−1 КД">−</button>
        </span>
      </span>
      <span class="bt-grp bt-stat bt-hpgrp">
        <span class="bt-ico" title="ХП" aria-hidden="true">${gi('heart')}</span>
        ${hpBarTag(p)}
        <input class="bt-in bt-hp" data-field="hp" data-bid="${p.id}" type="number" value="${p.hp}" aria-label="ХП">
        ${hpMaxTag(p)}
        <span class="bt-step">
          <button class="bt-stepbtn" data-hp-op="inc" data-bid="${p.id}" title="+1 ХП" aria-label="+1 ХП">+</button>
          <button class="bt-stepbtn" data-hp-op="dec" data-bid="${p.id}" title="−1 ХП" aria-label="−1 ХП">−</button>
        </span>
      </span>
      <span class="bt-grp bt-stat bt-dmggrp">
        <span class="bt-ico" title="Урон" aria-hidden="true">${gi('sword')}</span>
        <input class="bt-in bt-dmg" data-dmg data-bid="${p.id}" type="number" placeholder="⏎" title="Введите урон и нажмите Enter" aria-label="Урон">
        <span class="bt-step">
          <button class="bt-stepbtn" data-dmg-op="inc" data-bid="${p.id}" title="Нанести 1 урон" aria-label="Нанести 1 урон">+</button>
          <button class="bt-stepbtn" data-dmg-op="dec" data-bid="${p.id}" title="Вылечить 1" aria-label="Вылечить 1">−</button>
        </span>
      </span>
      <span class="bt-grp bt-initgrp"><span class="bt-lbl">Иниц</span><input class="bt-in bt-init" data-field="init" data-bid="${p.id}" type="number" value="${p.init}" aria-label="Инициатива"></span>
      <button class="bt-del" data-del="${p.id}" title="Убрать из боя" aria-label="Убрать">${gi('trash')}</button>
      <div class="bt-statuses">
        ${(p.statuses||[]).map((s,i)=>`<span class="bt-status">${escapeHtml(s)}<button class="bt-status-del" data-status-del="${p.id}" data-si="${i}" title="Убрать статус">✕</button></span>`).join('')}
        <select class="bt-status-add" data-status-add="${p.id}" aria-label="Добавить статус">
          <option value="">+ статус…</option>
          ${BATTLE_STATUSES.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
        </select>
      </div>
      ${(p.applied && p.applied.length) ? `<div class="bt-applied">${p.applied.map((t,i)=>`
        <span class="bt-chip">${escapeHtml(t)}<button class="bt-chip-del" data-achip="${p.id}" data-ai="${i}" title="Убрать">✕</button></span>`).join('')}</div>` : ''}
    </div>`).join('');
  renderBattleTurn();
}
function renderBattleTurn(){
  const label = document.getElementById('battleRound');
  if(!label) return;
  const cur = battleParts.find(p=>p.id===battleTurn.turnId);
  label.textContent = 'Раунд ' + battleTurn.round + (cur ? ' · ' + cur.name : '');
  label.title = cur ? ('Сейчас ходит: ' + cur.name) : 'Текущий раунд';
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
  const nameLine = card.querySelector('.bt-nameline') || nameInput;
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
let battleSelId = null;

function toggleStatus(bid, name){
  const p = battleParts.find(x=>x.id===bid);
  if(!p) return;
  if(!Array.isArray(p.statuses)) p.statuses = [];
  const i = p.statuses.indexOf(name);
  if(i>=0) p.statuses.splice(i,1); else p.statuses.push(name);
  saveBattle(); renderBattle();
  battleLogPush(`«${p.name}»: ${i>=0?'снят статус':'статус'} «${name}»`);
  const card = document.querySelector(`.battle-card[data-bid="${bid}"]`);
  if(card) card.focus();
}

function renderStatusPalette(bid){
  const box = document.getElementById('battleStatusPalette');
  if(!box) return;
  paletteBid = bid;
  const p = battleParts.find(x=>x.id===bid);
  const on = (p && Array.isArray(p.statuses)) ? p.statuses : [];
  box.innerHTML = BATTLE_STATUSES.map((st,i)=>
    `<button type="button" class="${on.includes(st)?'on':''}" data-pst="${escapeHtml(st)}"><span class="num">${i+1}</span>${escapeHtml(st)}</button>`
  ).join('');
  box.hidden = false;
}

function closeStatusPalette(){
  const box = document.getElementById('battleStatusPalette');
  if(box) box.hidden = true;
  paletteBid = null;
}

function paletteIsOpen(){
  const box = document.getElementById('battleStatusPalette');
  return !!(box && !box.hidden);
}

function bindBattleKeyboard(){
  const pal = document.getElementById('battleStatusPalette');
  if(pal){
    pal.addEventListener('click', e=>{
      const b = e.target.closest('[data-pst]');
      if(!b) return;
      const bid = paletteBid;
      if(bid) toggleStatus(bid, b.dataset.pst);
      closeStatusPalette();
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
      if(st && bid){ e.preventDefault(); toggleStatus(bid, st); closeStatusPalette(); }
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
      sel.collapsed = !sel.collapsed; saveBattle(); renderBattle();
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
      battleParts=[]; battleTurn={round:1, turnId:null}; saveBattle(); saveBattleTurn(); renderBattle(); battleLogPush('Бой очищен');
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
      els.forEach(el=> list.appendChild(el));
    });
    list.addEventListener('click', e=>{
      const card = e.target.closest('.battle-card');
      if(card){ battleSelId = card.dataset.bid; }
      if(card && !e.target.closest('input,button,select,textarea,label,[contenteditable]')){
        const p = battleParts.find(x=>x.id===card.dataset.bid);
        if(p){ p.collapsed = !p.collapsed; saveBattle(); renderBattle(); }
        return;
      }
      const del = e.target.closest('[data-del]');
      if(del){ const gone = battleParts.find(x=>x.id===del.dataset.del); battleParts = battleParts.filter(x=>x.id!==del.dataset.del); saveBattle(); renderBattle(); if(gone) battleLogPush(`«${gone.name}» убран из боя`); return; }
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
      const stAdd = e.target.closest('[data-status-add]');
      if(stAdd){
        const v = stAdd.value; stAdd.value='';
        if(!v) return;
        const p = battleParts.find(x=>x.id===stAdd.dataset.statusAdd);
        if(!p) return;
        if(!Array.isArray(p.statuses)) p.statuses=[];
        if(!p.statuses.includes(v)) p.statuses.push(v);
        saveBattle(); renderBattle();
        battleLogPush(`«${p.name}» — статус: ${v}`);
        return;
      }
      const actSel = e.target.closest('[data-act-select]');
      if(actSel){
        const idx = +actSel.value;
        actSel.value = '';
        if(!idx && idx!==0) return;
        const p = battleParts.find(x=>x.id===actSel.dataset.actSelect);
        if(!p) return;
        const act = (p.acts||[])[idx];
        if(!act) return;
        const txt = (act.tag? act.tag+': ' : '') + act.text;
        if(!Array.isArray(p.applied)) p.applied=[];
        if(!p.applied.includes(txt)) p.applied.push(txt);
        saveBattle(); renderBattle();
        battleLogPush(`«${p.name}» → ${txt}`);
        return;
      }
    });
  }
  loadBattle();
  loadBattleTurn();
  loadBattleLog();
  renderBattleLog();
  const logClear = document.getElementById('battleLogClear');
  if(logClear) logClear.addEventListener('click', ()=>{ battleLog=[]; saveBattleLog(); renderBattleLog(); });
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
