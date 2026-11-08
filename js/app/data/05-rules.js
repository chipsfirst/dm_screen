/* ═══ Base rules D&D 5.5 ═══ */

document.getElementById('mediaInput').addEventListener('change', function(e){
  const files=Array.from(e.target.files||[]);
  files.forEach(f=> importFile(f));
  e.target.value='';
});
function importFile(file){
  const reader=new FileReader();
  const isImg=/^image\//i.test(file.type);
  reader.onload=()=>{
    const data=reader.result; // dataURL
    prepareCanvasForAdd();
    const b=makeBlock('img', file.name.replace(/\.[^.]+$/,'') || 'Файл');
    Object.assign(b, freeCascadePos());
    b.kind = isImg?'image':'doc';
    const key = 'media_'+b.id;
    mediaCache[key] = data;   // держим в памяти
    idbPut(key, data);        // и в IndexedDB (не в localStorage)
    b.dataKey = key;
    b.data = '';              // base64 в localStorage НЕ храним
    b.fileName = file.name;
    b.sizeLabel = file.size>1048576 ? (file.size/1048576).toFixed(1)+' МБ' : Math.ceil(file.size/1024)+' КБ';
    b.collapse = false;
    blocks.push(b);
    save(); render();
    document.getElementById('canvas').querySelector('[data-id="'+b.id+'"] .block-head')?.scrollIntoView({behavior:'smooth'});
  };
  reader.readAsDataURL(file);
}
function addBlock(type){
  prepareCanvasForAdd();
  const b=makeBlock(type, TYPE_LABEL[type]+' — новый');
  Object.assign(b, freeCascadePos());
  blocks.push(b);
  if(type==='pc'){
    Object.assign(b.props,{Класс:'',Раса:'',Предыстория:'',HP:10,'Броня КК':10,Инициат:'+0'});
    b.res=[{ name:'Вдохновение', cur:1, max:1 }];
  }
  save(); render();
}
/* ═══ Пресеты создания монстров ═══ */
const MOB_PRESETS = [
  { name:'Миньон', cr:'1/8', ac:'13', hp:'7 (2d6)', sp:'30 фт', init:'+2 (12)',
    stats:[8,14,10,10,12,8], attack:'+3',
    text:'Мультиатака. Одна атака.\nАтака. Бросок атаки +3, досягаемость 5 фт, одна цель. Попадание: 4 (1d6 + 1) рубящего урона.',
    hint:'CR 1/8 · слабый, гибнет за один-два удара' },
  { name:'Стражник', cr:'1/2', ac:'14 (кольчужная рубаха, щит)', hp:'22 (4d8 + 4)', sp:'30 фт', init:'+1 (11)',
    stats:[13,12,12,10,11,10], attack:'+3',
    text:'Мультиатака. Одна атака.\nКопьё. Бросок атаки +3, досягаемость 5 фт или дальность 20/60 фт, одна цель. Попадание: 6 (1d8 + 2) колющего урона.',
    hint:'CR 1/2 · охрана, патруль, городская стража' },
  { name:'Зверь', cr:'1', ac:'12 (природная броня)', hp:'26 (4d8 + 8)', sp:'40 фт', init:'+2 (12)',
    stats:[14,14,14,3,12,6], attack:'+4',
    text:'Черты\nОстрые чувства. Преимущество на проверки Восприятия (слух или запах).\n\nДействия\nМультиатака. Одна атака.\nУкус. Бросок атаки +4, досягаемость 5 фт, одна цель. Попадание: 7 (1d10 + 2) колющего урона.',
    hint:'CR 1 · волк, рысь, крупный хищник' },
  { name:'Рядовой боец', cr:'2', ac:'15 (шкурный доспех, щит)', hp:'45 (7d8 + 14)', sp:'30 фт', init:'+1 (11)',
    stats:[15,12,14,10,11,10], attack:'+4',
    text:'Мультиатака. Две атаки оружием.\nТопор. Бросок атаки +4, досягаемость 5 фт, одна цель. Попадание: 11 (2d8 + 2) рубящего урона.',
    hint:'CR 2 · наёмник, орк, бандит-ветеран' },
  { name:'Нежить', cr:'3', ac:'13 (природная броня)', hp:'45 (7d8 + 14)', sp:'30 фт', init:'+0 (10)',
    stats:[14,10,14,8,10,6], attack:'+4',
    text:'Черты\nНежить. Иммунитет к яду и состоянию «отравлен»; не нужно дышать.\n\nДействия\nМультиатака. Две атаки когтями.\nКоготь. Бросок атаки +4, досягаемость 5 фт, одна цель. Попадание: 9 (1d8 + 4) рубящего урона плюс 4 (1d8) некротического урона.',
    hint:'CR 3 · скелет-воин, зомби-ветеран, упырь' },
  { name:'Заклинатель', cr:'4', ac:'12 (15 с доспехами мага)', hp:'60 (11d8 + 11)', sp:'30 фт', init:'+2 (12)',
    stats:[8,14,12,17,12,10], attack:'+5',
    text:'Черты\nСотворение заклинаний. Заклинательная характеристика — Интеллект, Сл спасброска 14, +6 к атаке заклинаниями.\n\nДействия\nМультиатака. Две атаки посохом или одно заклинание.\nПосох. Бросок атаки +5, досягаемость 5 фт, одна цель. Попадание: 8 (2d6 + 1) дробящего урона.\nОгненный снаряд (1/день). Дальность 120 фт, одна цель, 10 (3d6) огненного урона при провале спасброска Ловкости Сл 14, половина при успехе.',
    hint:'CR 4 · маг-наёмник, культист-заклинатель' },
  { name:'Элита', cr:'5', ac:'16 (кольчуга, щит)', hp:'90 (12d8 + 36)', sp:'30 фт', init:'+2 (12)',
    stats:[17,14,16,12,12,10], attack:'+6',
    text:'Черты\nПарирование. Реакция: +3 к КД против одной рукопашной атаки.\n\nДействия\nМультиатака. Две атаки длинным мечом.\nДлинный меч. Бросок атаки +6, досягаемость 5 фт, одна цель. Попадание: 13 (2d8 + 4) рубящего урона.',
    hint:'CR 5 · рыцарь, капитан, телохранитель босса' },
  { name:'Босс', cr:'10', ac:'17 (природная броня)', hp:'150 (20d8 + 60)', sp:'40 фт', init:'+3 (13)',
    stats:[19,16,17,14,14,16], attack:'+8',
    text:'Черты\nЛегендарное сопротивление (3/день). Может заменить провал спасброска успехом.\n\nДействия\nМультиатака. Две атаки когтями и одна атака хвостом.\nКоготь. Бросок атаки +8, досягаемость 10 фт, одна цель. Попадание: 16 (2d10 + 5) рубящего урона.\n\nЛегендарные действия (3 за раунд)\nОбрушиться. Совершает одну атаку когтями.\nРёв. Спасбросок Мудрости Сл 15, существа в 30 фт: при провале «испуган» до конца своего следующего хода.\nМанёвр. Перемещается на половину скорости, не вызывая атак по возможности.',
    hint:'CR 10 · главный злодей с легендарными действиями' },
];

function mobPresetCard(p, i){
  return `<button class="preset-card" data-preset="${i}">
    <span class="preset-head"><span class="preset-name">${escapeHtml(p.name)}</span><span class="preset-cr">CR ${escapeHtml(p.cr)}</span></span>
    <span class="preset-meta">КД ${escapeHtml(p.ac)} · ХП ${escapeHtml(p.hp)} · Скорость ${escapeHtml(p.sp)}</span>
    <span class="preset-hint">${escapeHtml(p.hint)}</span>
  </button>`;
}

function renderMobPresets(){
  const list = document.getElementById('mobPresetList');
  if(!list) return;
  list.innerHTML = MOB_PRESETS.map(mobPresetCard).join('') +
    `<button class="preset-card preset-empty" data-preset="blank">
      <span class="preset-head"><span class="preset-name">Пустой монстр</span><span class="preset-cr">—</span></span>
      <span class="preset-meta">Пустая карточка с полями</span>
      <span class="preset-hint">Заполнить вручную</span>
    </button>`;
  list.querySelectorAll('[data-preset]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const modal = document.getElementById('mobPresetModal');
      closeModal(modal);
      const key = btn.dataset.preset;
      if(key === 'blank'){ addBlock('mob'); return; }
      addPresetBlock(MOB_PRESETS[+key]);
    });
  });
}

function addPresetBlock(p){
  prepareCanvasForAdd();
  const b = makeBlock('mob', p.name);
  Object.assign(b, freeCascadePos());
  b.props = { 'Опасн.': p.cr, 'КД': p.ac, 'ХП': p.hp, 'Скорость': p.sp, 'Иниц.': p.init };
  b.stats = p.stats.slice();
  b.attack = p.attack;
  b.text = p.text;
  blocks.push(b);
  save();
  if(currentTab !== 'monsters') showTab('monsters'); else render();
  setTimeout(()=>{
    const el = document.querySelector('#canvas [data-id="'+b.id+'"]');
    if(el) el.scrollIntoView({ behavior:'smooth', block:'start' });
    const t = el && el.querySelector('.block-title');
    if(t){ t.focus(); const r=document.createRange(); r.selectNodeContents(t); const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  }, 40);
  toast('Пресет «'+p.name+'» добавлен — поправьте название и числа');
}

const renderSearchDebounced = debounce(render, 180);
const searchEl=document.getElementById('search');
if(searchEl) searchEl.addEventListener('input', e=>{ searchFilter=e.target.value.trim(); renderSearchDebounced(); });

/* ═══ Данные из книг (DMG: таблицы предметов, AU: заклинания/предметы/существа) ═══ */
const BOOKS = window.BOOKS || { spells:[], items:[], creatures:[], rules:[], tables:{} };
const BOOKS_SPELLS = (BOOKS.spells||[]).map(s=>({
  n: s.n, l: s.l, sc: s.sc || '—', t:'—', r:'—', d:'—',
  c: s.comp ? ('Компоненты: '+s.comp) : '',
  cls: (s.cls||[]).join(', '), desc:'', src:'AU'
}));
const BOOKS_CREATURES = (BOOKS.creatures||[]).map((c,i)=>({
  n: c.n, en: c.en, type:'Персонаж (AU)', cr:'—', ac:'—', hp:'—', sp:'—', init:'—',
  ab:'', sk:'', sen:'', lang:'', acts:[], src:'AU'
}));
function booksLibMerged(){
  if(!LIB) return;
  if(!LIB.__booksMerged){
    LIB.__booksMerged = true;
    LIB.spells = (LIB.spells||[]).concat(BOOKS_SPELLS);
  }
  mergeWowSpells();
}
/* заклинания WoW — в библиотеку (можно вызвать и после ленивой загрузки) */
function mergeWowSpells(){
  if(!LIB || !window.WOW_DATA || !Array.isArray(window.WOW_DATA.spells)) return;
  if(LIB.__wowMerged) return;
  LIB.__wowMerged = true;
  const known = new Set((LIB.spells||[]).map(sp=>sp.n));
  window.WOW_DATA.spells.forEach(sp=>{ if(!known.has(sp.n)){ known.add(sp.n); LIB.spells.push(sp); } });
}
/* предметы книг — в магазин */
(function mergeBooksShop(){
  if(!Array.isArray(window.SHOP)) return;
  const existing = new Set(window.SHOP.map(i=>i.n));
  (BOOKS.items||[]).forEach(it=>{
    if(existing.has(it.n)) return;
    existing.add(it.n);
    const meta = it.src==='AU'
      ? ('AU · ' + (it.rarity||'') + (it.attune?' · настройка':''))
      : ('DMG · таблица ' + (it.t||''));
    window.SHOP.push({ n: it.n, c: it.src==='AU' ? 'Магические предметы (AU)' : 'Магические предметы (DMG)',
      v:'—', w: meta.trim(), src: it.src });
  });
})();
/* предметы SRD (CC-BY-4.0) — в магазин */
(function mergeSrdShop(){
  const srd = window.SRD_ITEMS;
  if(!srd || !Array.isArray(srd.items) || !Array.isArray(window.SHOP)) return;
  const existing = new Set(window.SHOP.map(i=>i.n));
  srd.items.forEach(it=>{
    if(existing.has(it.n)) return;
    existing.add(it.n);
    window.SHOP.push({
      n: it.n, c: 'Магические предметы (SRD)',
      v: '—',
      w: [it.type, it.rarity, it.att ? 'настройка' : ''].filter(Boolean).join(' · '),
      d: it.d || '', src: 'SRD'
    });
  });
})();

/* предметы WoW — в магазин (вызывается после ленивой загрузки wow-data.js) */
function mergeWowShop(list){
  const wow = window.WOW_DATA;
  const target = Array.isArray(list) ? list : window.SHOP;
  if(!wow || !Array.isArray(wow.items) || !Array.isArray(target)) return;
  const existing = new Set(target.map(i=>i.n));
  wow.items.forEach(it=>{
    if(existing.has(it.n)) return;
    existing.add(it.n);
    target.push({
      n: it.n, c: 'Магические предметы (WoW)',
      v: '—',
      w: [it.type, it.rarity, it.att ? 'настройка' : ''].filter(Boolean).join(' · '),
      d: it.d || '', src: 'WoW'
    });
  });
}

/* правила книг — в «Правила» (вызывается после объявления RULES_FOR_LIB) */
function mergeBooksRules(){
  (BOOKS.rules||[]).forEach(r=>{
    RULES_FOR_LIB.push({ title: r.n + ' · ' + (r.sec||''), text: r.text + '\n\nИсточник: ' + (r.src||'DMG') });
  });
}
/* таблицы книг — в «Случайные таблицы» */
(function mergeBooksTables(){
  Object.entries(BOOKS.tables||{}).forEach(([name, t])=>{
    if(!t || !t.rows) return;
    const cols = t.cols || [];
    RANDOM_TABLES[name] = t.rows.map(r=>{
      const vals = (r.vals||[]).map((v,i)=> v==='—' ? '' : (cols[i] ? v+' '+cols[i] : v)).filter(Boolean).join(', ');
      return r.roll + ' — ' + (vals || 'ничего');
    });
  });
})();

