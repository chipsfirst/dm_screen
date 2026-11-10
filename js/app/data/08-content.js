/* ═══ Подстановка данных из SRD 5.2.1 (класс, вид, предыстория) ═══ */
const SRD = {
  classes: window.SRD_CLASSES || [],
  species: window.SRD_SPECIES || [],
  backgrounds: window.SRD_BACKGROUNDS || [],
};
const SRD_AB = { 'Сила':0, 'Ловкость':1, 'Телосложение':2, 'Интеллект':3, 'Мудрость':4, 'Харизма':5 };
function srdMod(b, idx){
  const v = (b.stats && b.stats[idx] != null) ? +b.stats[idx] : 10;
  return Math.floor((v - 10) / 2);
}
function srdSigned(n){ return (n >= 0 ? '+' : '') + n; }
function srdFind(list, name){
  const q = acNorm(name);
  if(!q) return null;
  return list.find(x=> acNorm(x.name) === q) || list.find(x=> acNorm(x.en) === q) || null;
}
function srdBgNames(){
  return (SRD.backgrounds || []).map(x=> x && x.name).filter(Boolean);
}
/* Предыстория есть в карточках, созданных до её появления — досоздаём поле */
function ensureBgProp(){
  let changed = false;
  (blocks || []).forEach(b=>{
    if(!b || b.type !== 'pc') return;
    const props = b.props || {};
    const keys = Object.keys(props);
    if(keys.some(k=> /^(предыстор|бэкграунд)/i.test(String(k).trim()))) return;
    const out = {};
    let placed = false;
    keys.forEach(k=>{
      out[k] = props[k];
      if(!placed && /^(раса|вид|родословн)/i.test(String(k).trim())){ out['Предыстория'] = ''; placed = true; }
    });
    if(!placed) out['Предыстория'] = '';
    b.props = out;
    changed = true;
  });
  return changed;
}
function srdPlanFor(b, kind, item){
  const groups = [];
  if(kind === 'class'){
    const con = srdMod(b, 2), dex = srdMod(b, 1);
    const hp = Math.max(1, item.die + con);
    /* не заводим второй ключ хитов: обновляем существующие HP/ХП, иначе добавляем ХП */
    const hpKeys = Object.keys(b.props || {}).filter(k=> /^(хп|hp)$/i.test(k.trim()));
    const numProps = {};
    (hpKeys.length ? hpKeys : ['ХП']).forEach(k=>{ numProps[k] = String(hp); });
    numProps['Броня КК'] = String(10+dex);
    numProps['Инициат'] = srdSigned(dex);
    groups.push({
      id:'nums', title:'Числа',
      rows:['Хиты '+hp+' (кость d'+item.die+' '+srdSigned(con)+')', 'Броня КК '+(10+dex), 'Инициатива '+srdSigned(dex)],
      props:numProps,
    });
    const saves = item.saves.map(a=> a+' '+srdSigned(srdMod(b, SRD_AB[a]) + 2)).join(', ');
    const prof = [item.armor, item.weapons, item.tools].filter(Boolean).join('; ');
    if(saves || prof){
      const p = {};
      if(saves) p['Спасброски'] = saves;
      if(prof) p['Владения'] = prof;
      groups.push({
        id:'prof', title:'Спасброски и владения',
        rows:[saves ? 'Спасброски: '+saves : '', prof ? 'Владения: '+prof : ''].filter(Boolean),
        props:p,
      });
    }
    const notes = [];
    if(item.features.length) notes.push('Особенности (1 ур.): ' + item.features.join(', '));
    if(item.skills.count) notes.push('Навыки: выбрать ' + item.skills.count + ' из: ' + item.skills.list.join(', '));
    if(item.equip) notes.push('Снаряжение: ' + item.equip);
    if(notes.length) groups.push({ id:'notes', title:'Навыки, особенности, снаряжение', rows:notes, text:notes.join('\n') });
  }
  if(kind === 'species'){
    const rows = ['Размер: ' + item.size, 'Скорость: ' + item.speed + ' фт'];
    const notes = [];
    if(item.darkvision){ rows.push('Тёмное зрение: ' + item.darkvision + ' фт'); notes.push('Тёмное зрение ' + item.darkvision + ' фт'); }
    if(item.traits.length){ rows.push('Черты вида: ' + item.traits.join(', ')); notes.push('Черты вида: ' + item.traits.join(', ')); }
    groups.push({
      id:'spec', title:'Вид: ' + item.name, rows,
      props:{ 'Размер':item.size, 'Скорость':item.speed + ' фт' },
    });
    if(notes.length) groups.push({ id:'spnotes', title:'Черты вида в заметки', rows:notes, text:notes.join('\n') });
  }
  if(kind === 'background'){
    const rows = [
      'Характеристики: ' + item.abilities.join(', ') + ' (+2 и +1)',
      'Навыки: ' + item.skills.join(', '),
      item.tool ? 'Инструмент: ' + item.tool : '',
      item.feat ? 'Черта: ' + item.feat : '',
      item.equip ? 'Снаряжение: ' + item.equip : '',
    ].filter(Boolean);
    groups.push({ id:'bg', title:'Предыстория: ' + item.name, rows, text:rows.join('\n') });
  }
  return groups;
}
let srdState = null;
function srdModalEl(){ return document.getElementById('srdModal'); }
function srdShow(b, kind, item){
  const groups = srdPlanFor(b, kind, item);
  const modal = srdModalEl();
  if(!groups.length || !modal) return;
  srdState = { id:b.id, groups, chosen:new Set(groups.map(g=> g.id)) };
  const title = document.getElementById('srdTitle');
  if(title){
    title.textContent = (kind === 'class' ? 'Класс «' : kind === 'species' ? 'Вид «' : 'Предыстория «') + item.name + '» — что подставить?';
  }
  const list = document.getElementById('srdList');
  if(list){
    list.innerHTML = groups.map(g=>
      '<label class="srd-group"><input type="checkbox" data-srd-group="' + escapeHtml(g.id) + '" checked>'
      + '<span class="srd-group-main"><b>' + escapeHtml(g.title) + '</b>'
      + g.rows.map(r=> '<span class="srd-row">' + escapeHtml(r) + '</span>').join('')
      + '</span></label>'
    ).join('');
    list.querySelectorAll('[data-srd-group]').forEach(cb=>{
      cb.addEventListener('change', ()=>{
        if(!srdState) return;
        if(cb.checked) srdState.chosen.add(cb.dataset.srdGroup);
        else srdState.chosen.delete(cb.dataset.srdGroup);
      });
    });
  }
  openModal(modal, null);
}
function srdApply(){
  const st = srdState;
  const modal = srdModalEl();
  if(!st){ if(modal) closeModal(modal); return; }
  const b = findBlock(st.id);
  if(!b){ if(modal) closeModal(modal); srdState = null; return; }
  let touched = 0;
  st.groups.forEach(g=>{
    if(!st.chosen.has(g.id)) return;
    if(g.props){
      Object.keys(g.props).forEach(k=>{
        if(String(b.props[k] == null ? '' : b.props[k]).trim() !== String(g.props[k]).trim()) touched++;
        b.props[k] = g.props[k];
      });
    }
    if(g.text){
      const add = String(g.text).trim();
      if(add && (b.text || '').indexOf(add) === -1){
        b.text = (b.text ? b.text.replace(/\s+$/, '') + '\n\n' : '') + add;
        touched++;
      }
    }
  });
  save();
  if(currentTab === 'chars' || currentTab === 'monsters') render();
  else renderBlockOnly(b.id);
  if(modal) closeModal(modal);
  srdState = null;
  toast(touched ? 'Данные из SRD подставлены' : 'Уже было заполнено');
}
(function srdBind(){
  const modal = srdModalEl();
  if(!modal) return;
  const close = ()=>{ closeModal(modal); srdState = null; };
  const byClose = document.getElementById('srdClose');
  if(byClose) byClose.addEventListener('click', close);
  const byCancel = document.getElementById('srdCancel');
  if(byCancel) byCancel.addEventListener('click', close);
  const byApply = document.getElementById('srdApply');
  if(byApply) byApply.addEventListener('click', srdApply);
  modal.addEventListener('click', e=>{ if(e.target === modal) close(); });
})();
document.addEventListener('change', e=>{
  const el = e && e.target;
  if(!el || !el.matches || !el.matches('input.v[data-prop-key]')) return;
  const key = acNorm(el.dataset.propKey || '');
  const b = findBlock(el.dataset.propId);
  if(!b) return;
  let kind = null, item = null;
  if(/^класс/.test(key)){ kind = 'class'; item = srdFind(SRD.classes, el.value); }
  else if(/^(раса|вид)/.test(key)){ kind = 'species'; item = srdFind(SRD.species, el.value); }
  else if(/^(предыстор|бэкграунд|background)/.test(key)){ kind = 'background'; item = srdFind(SRD.backgrounds, el.value); }
  if(item) srdShow(b, kind, item);
});

/* Плашка свойства целиком ставит курсор в своё поле (в т.ч. если кликнули по подписи) */
document.addEventListener('click', e=>{
  const el = e && e.target;
  const prop = el && el.closest ? el.closest('.prop') : null;
  if(!prop) return;
  const input = prop.querySelector('input.v');
  if(input && document.activeElement !== input) input.focus();
});

/* Клик мимо списка закрывает подсказки раньше, чем сработает соседнее поле */
document.addEventListener('mousedown', e=>{
  if(!acState.input) return;
  const t = e && e.target;
  if(!t) return;
  if(acEl && acEl.contains(t)) return;
  if(t === acState.input) return;
  acClose();
}, true);

/* Поля свойств пересоздаются при каждом рендере — цепляем подсказки по фокусу */
document.addEventListener('focusin', e=>{
  const el = e && e.target;
  if(!el || !el.matches || !el.matches('input.v[data-prop-key]')) return;
  const key = el.dataset ? el.dataset.propKey : '';
  acAttach(el, ()=> acPropItems(key));
});

function renderLib(){
  const q = normalizeLib(libSearch.value);
  const kind = libKind.value;
  let rows=[];
  const inKind = k => kind==='all'||kind===k;
  const matchQ = t => !q || normalizeLib(t).includes(q);

  const spells=(LIB&&LIB.spells)||[], items=(LIB&&LIB.items)||[];
  if(inKind('spell')) spells.forEach(sp=>{ if(matchQ(sp.n+' '+sp.sc)) rows.push({kind:'spell', sp}); });
  if(inKind('item'))  items.forEach(it=>{ if(matchQ(it.n)) rows.push({kind:'item', it}); });
  if(inKind('rule'))  RULES_FOR_LIB.forEach(r=>{ if(matchQ(r.title+' '+r.text)) rows.push({kind:'rule', rule:r}); });

  if(!rows.length){ libResults.innerHTML=`<div class="lib-empty">Ничего не найдено. Попробуйте другое слово.</div>`; return; }

  const limit = 80;
  let html = rows.slice(0,limit).map((r,i)=>{
    const addBtn = `<span class="lib-add" data-add="${i}" title="Добавить на ширму">＋</span>`;
    if(r.kind==='spell'){
      const s=r.sp;
      const meta = `Ур.${s.l} · ${s.sc} · ${s.t} · ${s.r} · ${s.d}${s.c?' · '+s.c:''} · ${s.cls}`;
      return `<div class="lib-row" data-type="librow">
        <span class="lib-kind k-spell">Закл.</span>
        <div class="lib-main">
          <div class="lib-title">${escapeHtml(s.n)}</div>
          <div class="lib-meta">${escapeHtml(meta)}</div>
          ${s.desc?`<div class="lib-p">${escapeHtml(s.desc.slice(0,140))}${s.desc.length>140?'…':''}</div>`:''}
        </div>${addBtn}</div>`;
    }
    if(r.kind==='item'){
      const it=r.it;
      let meta = `${it.t}`;
      if(it.d1) meta += ` · Урон ${it.d1}` + (it.d2?`/${it.d2}`:'');
      if(it.v) meta += ` · ${it.v}`;
      if(it.w) meta += ` · ${it.w}`;
      if(it.p) meta += ` · ${it.p}`;
      return `<div class="lib-row" data-type="librow">
        <span class="lib-kind k-item">Предм.</span>
        <div class="lib-main">
          <div class="lib-title">${escapeHtml(it.n)}</div>
          <div class="lib-meta">${escapeHtml(meta)}</div>
        </div>${addBtn}</div>`;
    }
    const rl=r.rule;
    return `<div class="lib-row" data-type="librow">
      <span class="lib-kind k-rule">Прав.</span>
      <div class="lib-main">
        <div class="lib-title">${escapeHtml(rl.title)}</div>
        <div class="lib-p">${escapeHtml(String(rl.text||'').slice(0,120))}</div>
      </div>${addBtn}</div>`;
  }).join('');

  if(rows.length>limit) html += `<div class="lib-empty">…ещё ${rows.length-limit} результатов. Уточните запрос.</div>`;
  libResults.innerHTML = html;

  libResults.querySelectorAll('[data-add]').forEach(btn=>{
    btn.addEventListener('click', e=>{
      e.stopPropagation();
      const idx=+btn.dataset.add;
      const r=rows[idx];
      if(r.kind==='spell') addSpellBlock(r.sp);
      else if(r.kind==='item') addItemBlock(r.it);
      else if(r.kind==='rule') addRuleBlock(r.rule);
    });
  });
}

/* ═══ Adding from library to canvas ═══ */
function addSpellBlock(s){
  const b=makeBlock('rule', s.n);
  let txt = `Уровень: ${s.l} (${s.sc})\nВремя: ${s.t}\nДистанция: ${s.r}\nДлительность: ${s.d}`;
  if(s.c) txt += `\n${s.c}`;
  if(s.cls) txt += `\nДоступно: ${s.cls}`;
  if(s.desc) txt += `\n\n—————\n${s.desc}`;
  b.text = txt;
  blocks.push(b);
  save(); render();
}
function addItemBlock(it){
  let txt = `Тип: ${it.t}`;
  if(it.d1) txt += `\nУрон: ${it.d1}` + (it.d2?` / ${it.d2}`:'') + (it.dt?' ('+it.dt+')':'');
  if(it.v) txt += `\nЦена: ${it.v}`;
  if(it.w) txt += `\nВес: ${it.w}`;
  if(it.p) txt += `\nСвойства: ${it.p}`;
  if(it.d) txt += `\n\n${it.d}`;
  addRuleBlock({ title:it.n, text:txt.trim() });
}
function addRuleBlock(r){
  const b=makeBlock('rule', r.title);
  b.text = r.text||'';
  blocks.push(b);
  save(); render();
}

/* ═══ Dice ═══ */
let currentDie='d20';
let rollHistory=[];
const dieSel=document.getElementById('dieSel');
const dieCustom=document.getElementById('dieCustom');
function resolveDie(){
  if(dieSel && dieSel.value==='custom'){
    const n=parseInt(dieCustom && dieCustom.value)||0;
    return n>=2 ? `d${n}` : null;
  }
  return dieSel ? `d${dieSel.value}` : currentDie;
}
function applyDieUI(){
  if(!dieSel) return;
  const custom = dieSel.value==='custom';
  if(dieCustom) dieCustom.style.display = custom ? '' : 'none';
  const d=resolveDie();
  currentDie = d || currentDie;
}
if(dieSel){
  dieSel.addEventListener('change', applyDieUI);
}
if(dieCustom){
  dieCustom.addEventListener('input', ()=>{ currentDie=resolveDie()||currentDie; });
}
document.getElementById('btnRoll').addEventListener('click', ()=>{
   doRoll(currentDie, parseInt(document.getElementById('dieCount').value)||1, null);
 });
 const btnRollShort=document.getElementById('btnRollShort');
 if(btnRollShort) btnRollShort.addEventListener('click', ()=>{
   doRoll(currentDie, parseInt(document.getElementById('dieCount').value)||1, null);
 });
/* Всплывающее значение броска */
let rollPopupTimer = null;
function showRollPopup(total, detail){
  const pop = document.getElementById('rollPopup');
  if(!pop) return;
  const b = pop.querySelector('b');
  const sp = pop.querySelector('span');
  if(b) b.textContent = String(total);
  if(sp) sp.textContent = detail || '';
  pop.hidden = false;
  pop.classList.remove('show');
  void pop.offsetWidth;
  pop.classList.add('show');
  if(rollPopupTimer) clearTimeout(rollPopupTimer);
  rollPopupTimer = setTimeout(()=>{
    pop.classList.remove('show');
    setTimeout(()=>{ pop.hidden = true; }, 220);
  }, 1400);
}
function doRoll(die,count,modLabel){
  const n=parseInt(die.slice(1)); const cnt=count||1;
  const rolls=Array.from({length:cnt},()=>1+Math.floor(Math.random()*n));
  const sum=rolls.reduce((a,b)=>a+b,0);
  const label= ` (${rolls.join('+')})` + (modLabel?` ${modLabel}`:'');
  document.getElementById('rollResult').textContent = `${die}${cnt>1?`×${cnt}`:''} ➜ ${sum}`;
  document.getElementById('rollLog').textContent = label;

  const detail = [
    `${die}${cnt>1?`×${cnt}`:''}`,
    cnt>1 ? `(${rolls.join(' + ')})` : '',
    modLabel ? String(modLabel) : ''
  ].filter(Boolean).join(' ');
  showRollPopup(sum, detail);

  rollHistory.push(`${die}${cnt>1?`×${cnt}`:''} = ${sum}${label}`);
  if(rollHistory.length>8) rollHistory.shift();
  try{
    battleLogPush(`Бросок: ${die}${cnt>1?`×${cnt}`:''} = ${sum}${label}`);
  }catch(e){}
}
function doOneD20(){ return 1+Math.floor(Math.random()*20); }
document.getElementById('btnExport').addEventListener('click', ()=>{
  // собираем блобы медиа, на которые ссылаются блоки, фон карты и токены
  const media={};
  const collect=k=>{ if(k && mediaCache[k]) media[k]=mediaCache[k]; };
  blocks.forEach(b=> collect(b.dataKey));
  maps.forEach(m=>{ collect(m.bgKey); (m.markers||[]).forEach(k=> collect(k.imgKey)); });
  const payload={ version:2, exported:Date.now(), blocks, media };
  saveFile('shirma-backup.json', JSON.stringify(payload,null,2), 'application/json');
});
document.getElementById('btnImport').addEventListener('click', ()=> document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    try{
      let data=JSON.parse(r.result);
      let arr, media=null;
      if(Array.isArray(data)) arr=data;                                  // старый формат: просто массив блоков
      else if(data && Array.isArray(data.blocks)){ arr=data.blocks; media=data.media; } // v2: блоки + медиа
      else { uiAlert('Неизвестный формат файла'); return; }
      arr = sanitizeBlocks(arr);
      if(!arr.length){ uiAlert('В файле нет корректных блоков'); return; }
      pushUndo('импорт из файла');
      if(media && typeof media==='object'){
        Object.entries(media).forEach(([k,v])=>{
          if(typeof k==='string' && typeof v==='string' && /^data:/.test(v)){ mediaCache[k]=v; idbPut(k,v); }
        });
      }
      blocks=arr; collapsed=new Set(); activeParentId=null; save(); render();
      toast('Импортировано блоков: '+arr.length);
      if(data && !Array.isArray(data)){
        let extra=false;
        if(data.sessions!==undefined){ try{ localStorage.setItem('shirma_sessions_v1', JSON.stringify(data.sessions)); extra=true; }catch(e){} }
        if(data.map!==undefined){ try{ localStorage.setItem('shirma_map_v1', JSON.stringify(data.map)); extra=true; }catch(e){} }
        if(data.battle!==undefined){ try{ localStorage.setItem('shirma_battle_v1', JSON.stringify(data.battle)); extra=true; }catch(e){} }
        if(Array.isArray(data.battleLog)){ try{ localStorage.setItem('shirma_battle_log_v1', JSON.stringify(data.battleLog.slice(0,200))); battleLog=data.battleLog.slice(0,200); extra=true; }catch(e){} }
        if(data.battleTurn && typeof data.battleTurn==='object'){ try{ localStorage.setItem('shirma_battle_turn_v1', JSON.stringify(data.battleTurn)); battleTurn=data.battleTurn; extra=true; }catch(e){} }
        if(data.music && typeof data.music==='object' && musicMetaRestore(data.music)) extra=true;
        if(extra){ toast('Восстановлены сессии/карта/бой — применяю…'); setTimeout(()=>location.reload(), 700); }
      }
    }catch(err){ uiAlert('Ошибка чтения файла'); }
  };
  r.readAsText(f); e.target.value='';
});
document.getElementById('btnReset').addEventListener('click', ()=>{
  uiConfirm('Перезаписать все данные демо-версией?').then(ok=>{ if(ok){ pushUndo('сброс к демо-данным'); seed(); } });
});

/* ═══ Shop ═══ */
const SHOP = (window.SHOP || []).concat(window.SHOP_CATALOG || []);
const shopModal = document.getElementById('shopModal');
const shopSearch = document.getElementById('shopSearch');
const shopCat = document.getElementById('shopCat');
const shopResults = document.getElementById('shopResults');

function shopCats(){
  const seen=[];
  SHOP.forEach(i=>{ if(!seen.includes(i.c)) seen.push(i.c); });
  return seen;
}
function renderShop(){
  const q = normalizeLib(shopSearch.value);
  const cat = shopCat.value;
  let list = SHOP.filter(i=>{
    if(cat!=='all' && i.c!==cat) return false;
    if(q && !normalizeLib(i.n+' '+i.c+' '+(i.g||'')+' '+(i.d||'')).includes(q)) return false;
    return true;
  });
  if(!list.length){ shopResults.innerHTML='<div class="lib-empty">Ничего не найдено.</div>'; return; }
  const limit=120;
  let html = list.slice(0,limit).map((i, idx)=>{
    const meta = [i.c, i.g, i.d, i.w ? i.w+' фнт' : ''].filter(Boolean).join(' · ');
    const alt = i.vc||i.ve ? `<span class="shop-alt" title="дешёвая / дорогая цена">${escapeHtml(i.vc||'—')} / ${escapeHtml(i.ve||'—')}</span>` : '';
    const rare = i.l ? '<span class="shop-rare" title="ограниченный запас">редко</span>' : '';
    return `
    <div class="lib-row"><span class="lib-kind k-item">${escapeHtml(i.c.split(' ')[0])}</span>
      <div class="lib-main">
        <div class="lib-title">${escapeHtml(i.n)}${rare}</div>
        <div class="lib-meta">${escapeHtml(meta)}</div>
      </div>
      <span class="shop-price"><b>${escapeHtml(i.v)}</b>${alt}</span>
      <span class="lib-add" data-shop-add="${idx}" title="Добавить на ширму" aria-label="Добавить на ширму">＋</span>
    </div>`;
  }).join('');
  if(list.length>limit) html += `<div class="lib-empty">…ещё ${list.length-limit} — уточните запрос.</div>`;
  shopResults.innerHTML = html;
  shopResults.querySelectorAll('[data-shop-add]').forEach(el=>{
    el.addEventListener('click', e=>{
      e.stopPropagation();
      const it = list[+el.dataset.shopAdd];
      if(!it) return;
      addItemBlock({ n: it.n, t: it.c, v: it.v, w: it.w, d: it.d });
      toast('Предмет добавлен на ширму');
    });
  });
}
function fillShopCats(){
  const cats=shopCats();
  const prev=shopCat.value;
  shopCat.innerHTML = '<option value="all">Все категории</option>'+cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  if(prev && Array.from(shopCat.options).some(o=>o.value===prev)) shopCat.value=prev;
}
document.getElementById('btnShop').addEventListener('click', ()=>{
  shopSearch.value=''; shopCat.value='all';
  fillShopCats();
  openModal(shopModal, document.getElementById('btnShop')); renderShop();
  // догружаем WoW и обновляем категории/список, если модалка ещё открыта
  ensureWow().then(()=>{
    if(shopModal.hidden) return;
    fillShopCats(); renderShop();
  }).catch(()=>{});
});
document.getElementById('shopClose').addEventListener('click', ()=> closeModal(shopModal));
shopModal.addEventListener('click', e=>{ if(e.target===shopModal) closeModal(shopModal); });
const shopSearchDebounced = debounce(renderShop, 180);
shopSearch.addEventListener('input', ()=> shopSearchDebounced());
shopCat.addEventListener('change', renderShop);
const SHOP_FILTER_KEY = 'shirma_shop_filter_v1';
function saveShopFilter(){
  try{ localStorage.setItem(SHOP_FILTER_KEY, JSON.stringify({ q: shopSearch.value, cat: shopCat.value })); }catch(err){}
}
document.addEventListener('input', e=>{ if(e.target===shopSearch) saveShopFilter(); });
document.addEventListener('change', e=>{ if(e.target===shopCat) saveShopFilter(); });
setTimeout(()=>{
  try{
    const f = JSON.parse(localStorage.getItem(SHOP_FILTER_KEY)||'null');
    if(!f) return;
    if(f.q) shopSearch.value = f.q;
    if(f.cat && Array.from(shopCat.options).some(o=>o.value===f.cat)) shopCat.value = f.cat;
    if(f.q || f.cat) renderShop();
  }catch(err){}
}, 600);

/* ═══ Tabs ═══ */
let currentTab = 'chars';
let blocksTab = 'chars'; // 'chars' | 'monsters'
KEYS.tab = 'shirma_tab_last_v1';
const tabs = {
  home: document.getElementById('view-home'),
  chars: document.getElementById('view-chars'),
  sessions: document.getElementById('view-sessions'),
  map: document.getElementById('view-map'),
  battle: document.getElementById('view-battle'),
  music: document.getElementById('view-music'),
};
function showTab(name){
  currentTab = name;
  try{ localStorage.setItem(KEYS.tab, name); }catch(e){}
  document.querySelectorAll('.tab').forEach(t=> t.classList.toggle('active', t.dataset.tab===name));
  tabs.home.hidden = true;
  tabs.chars.hidden = true;
  tabs.sessions.hidden = true;
  tabs.map.hidden = true;
  tabs.battle.hidden = true;
  if(tabs.music) tabs.music.hidden = true;
  if(name==='home'){
    tabs.home.hidden = false;
  } else if(name==='chars'||name==='monsters'){
    blocksTab = name;
    tabs.chars.hidden = false;
    render();
  } else if(name==='sessions'){
    tabs.sessions.hidden = false;
    ensureSessions();
  } else if(name==='map'){
    tabs.map.hidden = false;
    renderMap();
  } else if(name==='battle'){
    tabs.battle.hidden = false;
    renderBattle();
  } else if(name==='music'){
    if(tabs.music) tabs.music.hidden = false;
    musicRenderAll();
  }
  save();
}
document.querySelectorAll('.tab').forEach(t=> t.addEventListener('click', ()=> showTab(t.dataset.tab)));

/* ════════════ Карты ════════════ */
/* Быстрое переключение вкладок: Alt+1…6, Alt+←/→ */
/* Номер цифровой клавиши независимо от раскладки и модификаторов (macOS Option+1 = «¡») */
function digitFromEvent(e){
  const code = e.code || '';
  let m = /^Digit([0-9])$/.exec(code) || /^Numpad([0-9])$/.exec(code);
  if(m) return +m[1];
  if(e.keyCode >= 48 && e.keyCode <= 57) return e.keyCode - 48;   // запасной путь
  const k = String(e.key || '');
  if(/^[0-9]$/.test(k)) return +k;
  const map = { '¡':'1','™':'2','£':'3','¢':'4','∞':'5','§':'6','¶':'7','•':'8','ª':'9','º':'0',
                '!':'1','@':'2','#':'3','$':'4','%':'5','^':'6','&':'7','*':'8','(':'9',')':'0' };
  return map[k] || 0;
}

const TAB_ORDER = ['home','sessions','chars','monsters','map','battle','music'];
document.addEventListener('keydown', e=>{
  const tag = (e.target && e.target.tagName || '').toLowerCase();
  if(tag==='input' || tag==='textarea' || tag==='select' || (e.target && e.target.isContentEditable)) return;
  if(e.altKey && e.ctrlKey) return;                  // Ctrl+Alt+цифра — карты

  const byAlt = e.altKey && !e.metaKey;
  const byCtrl = e.ctrlKey && !e.altKey && !e.metaKey;
  if(!byAlt && !byCtrl) return;

  const d = digitFromEvent(e);
  if(d >= 1 && d <= TAB_ORDER.length){
    e.preventDefault();
    showTab(TAB_ORDER[d - 1]);
    return;
  }
  if(byAlt && (e.key==='ArrowLeft' || e.key==='ArrowRight')){
    e.preventDefault();
    const i = TAB_ORDER.indexOf(currentTab);
    const n = TAB_ORDER.length;
    const j = e.key==='ArrowRight' ? (i+1+n)%n : (i-1+n)%n;
    showTab(TAB_ORDER[j]);
  }
});

