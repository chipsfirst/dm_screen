/* ═══ Bestiary (ленивая загрузка тяжёлого bestiary-data.js) ═══ */
let bestiaryLoadingPromise = null;
function syncHomeBestiaryCount(){
  const el=document.getElementById('homeBestiaryCount'); if(!el) return;
  const n=(window.BESTIARY && window.BESTIARY.length) || 0;
  if(n) el.textContent = String(n);
}

function mergeWowBestiary(){
  const wow = window.WOW_DATA;
  if(!wow || !Array.isArray(wow.monsters) || !Array.isArray(window.BESTIARY)) return;
  if(window.BESTIARY.__wowMerged) return;
  const known = new Set(window.BESTIARY.map(m=>String(m.en||'').toLowerCase()));
  wow.monsters.forEach(m=>{
    if(known.has(String(m.en||'').toLowerCase())) return;
    known.add(String(m.en||'').toLowerCase());
    window.BESTIARY.push(Object.assign({}, m, { id: window.BESTIARY.length }));
  });
  window.BESTIARY.__wowMerged = true;
}

function ensureBestiary(){
  if(window.BESTIARY && window.BESTIARY.length){
    return ensureWow().then(()=>{ mergeWowBestiary(); syncHomeBestiaryCount(); }).catch(()=>{ mergeWowBestiary(); syncHomeBestiaryCount(); });
  }
  if(bestiaryLoadingPromise) return bestiaryLoadingPromise;
  bestiaryLoadingPromise = new Promise((resolve, reject)=>{
    const s=document.createElement('script');
    s.src='bestiary-data.js?v='+DATA_VER;
    s.onload=()=>{
      ensureWow().then(()=>{ mergeWowBestiary(); syncHomeBestiaryCount(); resolve(); })
               .catch(()=>{ mergeWowBestiary(); syncHomeBestiaryCount(); resolve(); });
    };
    s.onerror=()=>{ bestiaryLoadingPromise=null; reject(new Error('не удалось загрузить bestiary-data.js')); };
    document.head.appendChild(s);
  });
  return bestiaryLoadingPromise;
}
const bestModal = document.getElementById('bestModal');
const bestSearch = document.getElementById('bestSearch');
const bestResults = document.getElementById('bestResults');
const bestResultClose = document.getElementById('bestResultClose');
let bestState = { list:true, monster:null };
let bestAll = [];

let bestShowCount = 60;
function renderBestiary(){
  if(!bestState.list && bestState.monster){ renderBestMonster(bestState.monster); return; }
  const q = normalizeLib(bestSearch.value);
  let list;
  if(!q){ list = bestAll.slice(0, bestShowCount); }
  else{
    // при поиске НЕ трогаем bestShowCount — раньше он раздувался навсегда
    list = bestAll.filter(m => normalizeLib(m.n+' '+m.en+' '+m.type).includes(q));
  }
  if(!list.length){ bestResults.innerHTML='<div class="lib-empty">Ничего не найдено.</div>'; return; }
  bestResultClose.style.display='none';
  bestResults.innerHTML = list.map(m=>`
    <div class="lib-row" data-type="librow" data-best="${m.id}" style="cursor:pointer">
      <span class="lib-kind k-rule">${escapeHtml(shortCr(m.cr))}</span>
      <div class="lib-main">
        <div class="lib-title">${escapeHtml(m.n)}</div>
        <div class="lib-meta">${escapeHtml(m.type)} · КД ${escapeHtml(m.ac)} · ХП ${escapeHtml(m.hp)}</div>
      </div>
      <span class="lib-add" title="Открыть">›</span>
    </div>`).join('');
  if(!q && bestShowCount < bestAll.length) bestResults.innerHTML += `<div class="lib-empty" style="text-align:center"><button id="bestMore" style="margin:auto">Показать ещё (${bestShowCount} / ${bestAll.length})</button></div>`;
  if(list.length){ /* bind */ bestResults.querySelectorAll('[data-best]').forEach(row=>{
    row.addEventListener('click', ()=>{
      const m = bestAll.find(x=>x.id==row.dataset.best);
      if(m){ bestState.list=false; bestState.monster=m; renderBestiary(); }
    });
  }); }
  const more=bestResults.querySelector('#bestMore');
  if(more) more.addEventListener('click', ()=>{ bestShowCount = Math.min(bestAll.length, bestShowCount+120); renderBestiary(); });
}
function shortCr(cr){ return str(cr).split(' ')[0]; }
function str(s){ return String(s||''); }
function safeArr(x){ return Array.isArray(x) ? x : []; }
function renderBestMonster(m){
  bestResultClose.style.display='inline-block';
  m = (m && typeof m === 'object') ? m : {};
  const ab = (typeof m.ab === 'string') ? m.ab : '';
  const acts = safeArr(m.acts);
  try {
  bestResults.innerHTML = `<div class="best-card">
    <div class="best-h">
      <span class="bh-name">${escapeHtml(m.n)}</span>
      <span class="bh-type">${escapeHtml(m.type)}</span>
    </div>
    ${m.img?`<div class="best-img"><img src="${escapeHtml(m.img)}" alt="${escapeHtml(m.n)}" onerror="this.style.display='none'"></div>`:''}
    <div style="margin:8px 0">
      <button data-best-add="${m.id}" title="Добавить монстра как блок на ширму">＋ Добавить на ширму</button>
      <button data-best-token="${m.id}" title="Добавить токен на карту боя с инициативой и ХП">⬤ На карту боя</button>
      <button data-best-map="${m.id}" title="Поставить маркер монстра на карту">${gi('map')} На карту</button>
      <span class="hint" style="margin-left:8px">Блок — во вкладке «Монстры», токен — на карте боя</span>
    </div>
    <div class="best-meta">
      <span class="tag"><b>Опасн.</b> ${escapeHtml(shortCr(m.cr))}</span>
      <span class="tag"><b>КД</b> ${escapeHtml(m.ac)}</span>
      <span class="tag"><b>ХП</b> ${escapeHtml(m.hp)}</span>
      <span class="tag"><b>Скорость</b> ${escapeHtml(m.sp)}</span>
      <span class="tag"><b>Иниц.</b> ${escapeHtml(m.init)}</span>
    </div>
    <div class="best-stats">
      ${ab.split(', ').map(si=>{
        const mm=si.match(/^\s*(\S+)\s+(\d+)\s+([+-]\d+)/);
        return `<div class="best-stat"><div class="l">${escapeHtml(mm?mm[1]:si)}</div><div class="v">${mm?mm[2]:''}</div><div class="v" style="font-size:11px;color:var(--muted)">${mm?mm[3]:''}</div></div>`;
      }).join('')}
    </div>
    ${m.sk?`<div class="best-meta"><span class="tag"><b>Навыки</b> ${escapeHtml(m.sk)}</span></div>`:''}
    ${m.sen?`<div class="best-meta"><span class="tag"><b>Чувства</b> ${escapeHtml(m.sen)}</span></div>`:''}
    ${m.lang?`<div class="best-meta"><span class="tag"><b>Языки</b> ${escapeHtml(m.lang)}</span></div>`:''}
    ${m.sav?`<div class="best-meta"><span class="tag"><b>Спасброски</b> ${escapeHtml(m.sav)}</span></div>`:''}
    ${m.imm?`<div class="best-meta"><span class="tag"><b>Защита</b> ${escapeHtml(m.imm)}</span></div>`:''}
    ${(acts.length)?`<div class="best-acts">
      ${acts.map(a=>{
        const txt = (typeof a==='string') ? a : (a && typeof a==='object' ? (a.text||'') : '');
        const tag = (a && typeof a==='object' && a.tag) ? a.tag : '';
        const {name, body}=splitAct(txt);
        return `<div class="act"><span class="an">${tag?escapeHtml(tag)+' — ':''}${escapeHtml(name)}.</span> ${escapeHtml(body)}</div>`;
      }).join('')}
    </div>`:''}
  </div>`;
  } catch(e){
    bestResults.innerHTML = `<div class="best-card"><div class="best-h"><span class="bh-name">${escapeHtml(m.n||'Монстр')}</span></div>
      <div class="hint">Не удалось полностью отобразить карточку: ${escapeHtml(String(e&&e.message||e))}</div>
      <button data-best-add="${m.id}" title="Добавить монстра как блок на ширму">＋ Добавить на ширму</button></div>`;
  }
  bestResults.querySelectorAll('[data-best-add]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id=+btn.dataset.bestAdd;
      const mon = bestAll.find(x=>x.id===id);
      if(mon) addMonsterBlock(mon);
    });
  });
  bestResults.querySelectorAll('[data-best-token]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id=+btn.dataset.bestToken;
      const mon = bestAll.find(x=>x.id===id);
      if(mon) addMarkerFromMonster(mon);
    });
  });
  bestResults.querySelectorAll('[data-best-map]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id=+btn.dataset.bestMap;
      const mon = bestAll.find(x=>x.id===id);
      if(mon) addMarkerFromMonster(mon);
    });
  });
}
/* ХП/КД блока для токена */
function blockCombatStats(b){
  const p=b.props||{}, md=b.mdata||{};
  const ac = b.type==='mob'
    ? (md.ac!==undefined && md.ac!=='' ? String(md.ac) : '')
    : String(p['Броня КК'] ?? p['КД'] ?? p['AC'] ?? '');
  const hpMax = b.type==='mob'
    ? (parseInt(String(md.hp||'').replace(/[^0-9]/g,''),10) || hpMaxOf(b))
    : hpMaxOf(b);
  const hp = b.type==='mob' ? hpMax : hpCurOf(b);
  return { ac, hp: hp||null, hpMax: hpMax||null };
}

/* Персонаж или монстр с ширмы → маркер на карте */
function addBlockToMap(b){
  if(!b) return;
  const mp=curMap();
  if(mp){
    const n=(mp.markers||[]).length;
    const pt = snapPoint(mp, mp.baseW/2 + (n%5)*26, mp.baseH/2 + (n%5)*26);
    const stat = blockCombatStats(b);
    mp.markers.push({
      id:'k'+Math.random().toString(36).slice(2,7),
      x: Math.min(mp.baseW-18, Math.max(18, pt.x)),
      y: Math.min(mp.baseH-18, Math.max(18, pt.y)),
      label: String(b.title||'Участник').slice(0,40),
      kind: b.type==='mob' ? 'mob' : 'pc',
      blockId: b.id,
      hp: stat.hp, hpMax: stat.hpMax, ac: stat.ac,
      color: b.type==='mob' ? '#c0564f' : '#7fb3e6'
    });
    saveMap();
  }
  if(currentTab!=='map') showTab('map'); else renderMap();
  toast('«'+(b.title||'Участник')+'» на карте');
}

/* Монстр из бестиария → маркер на карте */
function addMarkerFromMonster(m){
  if(!m || m.id==null) return;
  const mp=curMap();
  if(mp){
    const n=(mp.markers||[]).length;
    const pt = snapPoint(mp, mp.baseW/2 + (n%4)*24, mp.baseH/2 + (n%4)*24);
    const hpMax = parseInt(String(m.hp||'').replace(/[^0-9]/g,''),10) || null;
    mp.markers.push({ id:'k'+Math.random().toString(36).slice(2,7),
      x: pt.x, y: pt.y,
      label: m.n||'Монстр', kind:'mob', bestId: m.id,
      hp: hpMax, hpMax: hpMax, ac: String(m.ac||''),
      color:'#c0564f' });
    saveMap();
  }
  if(currentTab!=='map') showTab('map'); else renderMap();
  toast('Маркер «'+(m.n||'Монстр')+'» на карте');
}

function addMonsterBlock(m){
  prepareCanvasForAdd();
  const b=makeBlock('mob', m.n);
  Object.assign(b, freeCascadePos());
  b.props = {
    'Опасн.': shortCr(m.cr), 'КД': m.ac, 'ХП': m.hp,
    'Скорость': m.sp, 'Иниц.': m.init
  };
  // structured data for official stat block rendering
  b.mdata = {
    type: m.type, cr: m.cr, ac: m.ac, hp: m.hp, sp: m.sp, init: m.init,
    ab_list: m.ab_list||[], sk: m.sk||'', sen: m.sen||'', lang: m.lang||'',
    sav: m.sav||'', imm: m.imm||'',
    acts: m.acts||[]
  };
  const order=['Str','Dex','Con','Int','Wis','Cha'];
  b.stats = (m.ab_list&&m.ab_list.length)? m.ab_list.map(x=>x.v) : [10,10,10,10,10,10];
  b.text = '';
  blocks.push(b);
  save();
  // переключаемся на вкладку «Монстры», чтобы добавленный монстр был виден
  if(currentTab!=='monsters'){ showTab('monsters'); } else { render(); }
  // прокручиваем канвас к добавленному блоку
  setTimeout(()=>{
    const el=document.querySelector('#canvas [data-id="'+b.id+'"]');
    if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
  }, 30);
  toast('Монстр «'+m.n+'» добавлен во вкладку «Монстры»');
}
bestResultClose.addEventListener('click', ()=>{ bestState.list=true; bestState.monster=null; renderBestiary(); });
document.getElementById('btnBestiary').addEventListener('click', ()=>{
  ensureBestiary().then(()=>{
    bestAll = (window.BESTIARY || []).slice().concat(BOOKS_CREATURES);
    bestState = { list:true, monster:null };
    bestSearch.value='';
    bestShowCount = 60;
    openModal(bestModal, document.getElementById('btnBestiary'));
    renderBestiary();
  }).catch(err=>{
    openModal(bestModal, document.getElementById('btnBestiary'));
    bestResults.innerHTML = `<div class="lib-empty">Ошибка загрузки бестиария: ${escapeHtml(String(err.message||err))}. Проверьте, что файл bestiary-data.js лежит рядом с index.html.</div>`;
  });
});
document.getElementById('bestClose').addEventListener('click', ()=> closeModal(bestModal));
bestModal.addEventListener('click', e=>{ if(e.target===bestModal) closeModal(bestModal); });
const bestSearchDebounced = debounce(renderBestiary, 180);
bestSearch.addEventListener('input', ()=>{
  bestState.list=true; bestState.monster=null;
  if(!bestSearch.value.trim()) bestShowCount = 60;   // сброс раздутого счётчика при очистке поиска
  bestSearchDebounced();
});

document.getElementById('btnLibrary').addEventListener('click', ()=>{
  openModal(libModal, document.getElementById('btnLibrary'));
  ensureLibrary().then(()=>{
    libSearch.value='';
    libKind.value='all';
    libSearch.focus();
    renderLib();
  }).catch(err=>{
    libResults.innerHTML = `<div class="lib-empty">Ошибка загрузки библиотеки: ${escapeHtml(String(err.message||err))}. Проверьте, что файл library-data.js лежит рядом с index.html.</div>`;
  });
});
document.getElementById('libClose').addEventListener('click', ()=> closeModal(libModal));
libModal.addEventListener('click', e=>{ if(e.target===libModal) closeModal(libModal); });
const libSearchDebounced = debounce(renderLib, 180);
libSearch.addEventListener('input', ()=> libSearchDebounced());
libKind.addEventListener('change', ()=> renderLib());

function normalizeLib(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }

/* ═══ Автодополнение: подсказки в поиске и в полях свойств ═══ */
const AC_LIMIT = 8;
const AC_SIZE   = ['Крошечный','Маленький','Средний','Большой','Огромный','Громадный'];
const AC_ALIGN  = ['законно-добрый','нейтрально-добрый','хаотично-добрый','законно-нейтральный','нейтральный',
                   'хаотично-нейтральный','законно-злой','нейтрально-злой','хаотично-злой','без мировоззрения'];
const AC_TYPES  = ['аберрация','небожитель','великан','гигант','гуманоид','дракон','элементаль','исчадие',
                   'зверь','конструкт','нежить','растение','слизь','фея','чудовище'];
const AC_LANGS  = ['Общий','Эльфийский','Дварфийский','Орочий','Драконий','Гоблинский','Инфернальный','Небесный',
                   'Первичный','Сильван','Подземный','Великаний','Гномий','Полуросликов','Акван','Ауран','Игнан',
                   'Терран','Глубинная речь','Телепатия 60 фт'];
const AC_SENSES = ['Тёмное зрение 60 фт','Тёмное зрение 120 фт','Слепое зрение 10 фт','Слепое зрение 30 фт',
                   'Слепое зрение 60 фт','Истинное зрение 120 фт','Пассивное Восприятие 10','Пассивное Восприятие 12',
                   'Пассивное Восприятие 14','Пассивное Восприятие 16'];
const AC_CLASS  = ['Варвар','Бард','Воин','Волшебник','Друид','Жрец','Колдун','Монах','Паладин','Плут','Следопыт',
                   'Чародей','Изобретатель'];
const AC_RACE   = ['Человек','Эльф','Высший эльф','Лесной эльф','Дроу','Дварф','Полурослик','Гном','Полуорк',
                   'Полуэльф','Тифлинг','Драконорождённый','Аасимар','Голиаф','Орк','Кобольд','Табакси','Генази'];

function acNorm(s){ return String(s==null?'':s).toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim(); }
function acUniq(list){
  const seen = new Set(), out = [];
  (list||[]).forEach(v=>{
    const txt = String(v==null?'':v).trim();
    const k = acNorm(txt);
    if(!k || seen.has(k)) return;
    seen.add(k); out.push(txt);
  });
  return out;
}

/* Словарь значений по названию поля карточки */
function acPropBase(key){
  const k = acNorm(key);
  if(/^размер/.test(k)) return AC_SIZE.slice();
  if(/мировоззр/.test(k)) return AC_ALIGN.slice();
  if(/^(тип|вид|категор)/.test(k)) return AC_TYPES.slice();
  if(/^язык/.test(k)) return AC_LANGS.slice();
  if(/^(чувств|восприят|зрен)/.test(k)) return AC_SENSES.slice();
  if(/^класс/.test(k)) return AC_CLASS.slice();
  if(/^(раса|родословн|народ)/.test(k)) return AC_RACE.slice();
  if(/^(предыстор|бэкграунд|background)/.test(k)) return srdBgNames();
  return [];
}
function acPropUsed(key){
  const out = [];
  const k = acNorm(key);
  (blocks||[]).forEach(b=>{
    const props = b.props || {};
    Object.keys(props).forEach(name=>{
      if(acNorm(name) !== k) return;
      const v = props[name];
      if(v!=null && String(v).trim()) out.push(String(v));
    });
  });
  return out;
}
function acPropItems(key){
  return acUniq(acPropBase(key).concat(acPropUsed(key)));
}

/* Сам список */
let acEl = null;
const acState = { input:null, all:[], items:[], idx:0 };

function acBox(){
  if(acEl) return acEl;
  acEl = document.createElement('div');
  acEl.className = 'ac-list';
  acEl.hidden = true;
  acEl.setAttribute('role','listbox');
  acEl.addEventListener('mousedown', e=>{
    const row = e.target && e.target.closest ? e.target.closest('[data-ac]') : null;
    if(!row) return;
    e.preventDefault();          // не даём полю потерять фокус
    acPick(+row.dataset.ac);
  });
  document.body.appendChild(acEl);
  return acEl;
}
function acMarkup(text, q){
  const at = q ? acNorm(text).indexOf(q) : -1;
  if(at < 0) return escapeHtml(text);
  return escapeHtml(text.slice(0, at)) + '<b>' + escapeHtml(text.slice(at, at + q.length)) + '</b>' + escapeHtml(text.slice(at + q.length));
}
function acClose(){
  if(acState.input) acState.input.setAttribute('aria-expanded','false');
  if(acEl){ acEl.hidden = true; acEl.innerHTML = ''; }
  acState.input = null; acState.items = []; acState.all = []; acState.idx = 0;
}
function acDraw(){
  const input = acState.input;
  if(!input) return;
  const q = acNorm(input.value);
  const items = (q ? acState.all.filter(v=> acNorm(v).includes(q)) : acState.all).slice(0, AC_LIMIT);
  if(!items.length){ acClose(); return; }
  acState.items = items;
  acState.idx = 0;
  const box = acBox();
  box.innerHTML = items.map((v,i)=>
    '<div class="ac-item'+(i===0?' on':'')+'" role="option" data-ac="'+i+'">'+acMarkup(v,q)+'</div>'
  ).join('');
  const r = input.getBoundingClientRect();
  box.style.left = Math.round(r.left)+'px';
  box.style.top = Math.round(r.bottom + 3)+'px';
  box.style.minWidth = Math.round(r.width)+'px';
  box.style.width = Math.max(Math.round(r.width), 240)+'px';
  box.hidden = false;
  input.setAttribute('aria-expanded','true');
}
function acPick(i){
  const value = acState.items[i];
  const input = acState.input;
  if(value == null || !input) return;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles:true }));
  input.dispatchEvent(new Event('change', { bubbles:true }));
  acClose();
  try{ input.focus(); }catch(e){}
}
function acAttach(input, getItems, opts){
  if(!input || input.dataset.acOn) return;
  input.dataset.acOn = '1';
  input.setAttribute('autocomplete','off');
  input.setAttribute('aria-autocomplete','list');
  input.setAttribute('aria-expanded','false');
  const open = ()=>{
    let all = [];
    try{ all = acUniq(getItems() || []); }catch(e){ all = []; }
    if(!all.length) return;
    acState.input = input; acState.all = all; acState.idx = 0;
    acDraw();
  };
  input.addEventListener('input', ()=>{
    if(acState.input !== input) open(); else acDraw();
  });
  input.addEventListener('blur', ()=>{ setTimeout(()=>{ if(acState.input === input) acClose(); }, 120); });
  input.addEventListener('keydown', e=>{
    if(acState.input !== input){
      if(e.key === 'ArrowDown'){ e.preventDefault(); open(); }
      return;
    }
    if(!acState.items.length) return;
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
      e.preventDefault();
      const n = acState.items.length;
      acState.idx = e.key === 'ArrowDown' ? (acState.idx + 1) % n : (acState.idx - 1 + n) % n;
      Array.prototype.forEach.call(acEl.children, (el,i)=> el.classList.toggle('on', i === acState.idx));
      const act = acEl.children[acState.idx];
      if(act && act.scrollIntoView) act.scrollIntoView({ block:'nearest' });
    } else if(e.key === 'Enter' || e.key === 'Tab'){
      if(acState.items[acState.idx] != null){ e.preventDefault(); acPick(acState.idx); }
    } else if(e.key === 'Escape'){
      acClose();
    }
  });
  window.addEventListener('scroll', ()=>{ if(acState.input === input) acClose(); }, true);
  window.addEventListener('resize', ()=>{ if(acState.input === input) acClose(); });
}

