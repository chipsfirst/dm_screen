/* ═══ Печатные мелочи: партия, инициатива, НПС, предметы ═══ */
(function(){
  const modal = document.getElementById('printKitModal');
  if(!modal) return;

  const esc = v => (typeof escapeHtml === 'function'
    ? escapeHtml(String(v == null ? '' : v))
    : String(v == null ? '' : v));
  const ABBR = ['Сил','Лов','Тел','Инт','Муд','Хар'];
  const FULL = ['Сила','Ловкость','Телосложение','Интеллект','Мудрость','Харизма'];
  const ALIASES = [
    ['сила','сил','str','strength'],
    ['ловкость','лов','dex','dexterity'],
    ['телосложение','тел','con','constitution'],
    ['интеллект','инт','int','intelligence'],
    ['мудрость','муд','wis','wisdom'],
    ['харизма','хар','cha','charisma']
  ];
  const SPECIES_SPEED = { 'голиаф':35 };
  const CONDITIONS = Array.isArray(window.CONDITIONS_2024) ? window.CONDITIONS_2024 : [];
  const selected = { party:new Set(), init:new Set(), npc:new Set(), items:new Set(), states:new Set() };
  let activeTab = 'party';

  function norm(v){
    return String(v == null ? '' : v).toLowerCase().replace(/ё/g, 'е').trim();
  }
  function abilityIndex(token){
    const t = norm(token);
    return ALIASES.findIndex(list => list.some(a => t === a || t.indexOf(a + ' ') === 0 || t.indexOf(a + ':') === 0));
  }
  function prop(b, names){
    const p = (b && b.props) || {};
    for(const name of names){
      const q = norm(name);
      const key = Object.keys(p).find(k => norm(k) === q);
      if(key && String(p[key]).trim() !== '') return String(p[key]).trim();
    }
    return '';
  }
  function line(b, re){
    return String((b && b.text) || '').split(/\n/).find(l => re.test(l)) || '';
  }
  function afterColon(s){
    return String(s || '').replace(/^[^:]*:/, '').trim();
  }
  function statScore(b, i){
    const arr = Array.isArray(b && b.stats) ? b.stats : [];
    return Math.max(1, Math.min(30, Number(arr[i]) || 10));
  }
  function mod(score){ return Math.floor((score - 10) / 2); }
  function sign(n){ return (n >= 0 ? '+' : '') + n; }
  function levelOf(b){
    const cls = prop(b, ['Класс','Class']);
    const m = String(cls).match(/(\d+)\s*$/);
    const raw = m ? m[1] : prop(b, ['Уровень','Level']);
    return Math.max(1, Math.min(20, Number(raw) || 1));
  }
  function profBonus(b){ return 2 + Math.floor((levelOf(b) - 1) / 4); }
  function numProp(b, names){
    const v = prop(b, names);
    const m = String(v).match(/-?\d+/);
    return m ? m[0] : '';
  }
  function initiativeOf(b){
    const v = prop(b, ['Инициат','Инициатива','Init','Initiative']);
    if(v){
      if(/^[+-]?\d+$/.test(v)) return sign(Number(v));
      return v;
    }
    return sign(mod(statScore(b, 1)));
  }
  function speedOf(b){
    const v = prop(b, ['Скорость','Speed']);
    if(v) return /фт|ft|клет/i.test(v) ? v : v + ' фт';
    const all = String((b && b.text) || '') + ' ' + Object.values((b && b.props) || {}).join(' ');
    const m = all.match(/Скорость[:\s]+(\d+)\s*(фт|клет)?/i);
    if(m) return m[1] + ' фт';
    const race = norm(prop(b, ['Раса','Вид','Species']));
    return (SPECIES_SPEED[race] || 30) + ' фт';
  }
  function savesOf(b){
    const raw = afterColon(line(b, /^\s*Спасброски\s*:/i)) || prop(b, ['Спасброски','Saves']);
    if(!raw) return '';
    const out = [];
    raw.split(/[,;]/).map(s => s.trim()).filter(Boolean).forEach(part => {
      const idx = abilityIndex(part);
      if(idx < 0) return;
      const explicit = part.match(/([+-]\d+)\s*$/);
      const val = explicit ? explicit[1] : sign(mod(statScore(b, idx)) + profBonus(b));
      out.push(ABBR[idx] + ' ' + val);
    });
    return out.join(' · ');
  }
  function skillSource(b){
    const chunks = [];
    String((b && b.text) || '').split(/\n/).forEach(l => {
      if(/^\s*(Навыки|Владения|Навыки и владения)\s*:/i.test(l)) chunks.push(l);
    });
    ['Навыки','Владения'].forEach(k => {
      const v = prop(b, [k]);
      if(v) chunks.push(v);
    });
    return norm(chunks.join(' '));
  }
  function hasSkill(b, aliases){
    const s = skillSource(b);
    return aliases.some(a => s.indexOf(norm(a)) >= 0);
  }
  function passiveOf(b, idx, aliases){
    return String(10 + mod(statScore(b, idx)) + (hasSkill(b, aliases) ? profBonus(b) : 0));
  }
  function languagesOf(b){
    const raw = afterColon(line(b, /^\s*Языки\s*:/i)) || prop(b, ['Языки','Languages']);
    return raw.length > 72 ? raw.slice(0, 71).replace(/\s+\S*$/, '') + '…' : raw;
  }
  function darkvisionOf(b){
    const all = String((b && b.text) || '') + ' ' + Object.values((b && b.props) || {}).join(' ');
    const m = all.match(/Тёмное зрение\s*(\d+)/i);
    return m ? m[1] + ' фт' : '';
  }
  function attackOf(b){
    const a = String((b && b.attack) || '').trim();
    const d = String((b && b.damage) || '').trim();
    return [a ? 'атака ' + a : '', d ? 'урон ' + d : ''].filter(Boolean).join(' · ');
  }
  function partyData(b){
    return {
      id:b.id,
      name:(b && b.title) || 'Без имени',
      sub:[prop(b, ['Класс']), prop(b, ['Раса','Вид']), prop(b, ['Предыстория'])].filter(Boolean).join(' · '),
      ac:numProp(b, ['Броня КК','КД','AC']) || '—',
      hp:numProp(b, ['HP','ХП','Хиты']) || '—',
      init:initiativeOf(b),
      speed:speedOf(b) || '—',
      saves:savesOf(b),
      passive:{
        perc:passiveOf(b, 4, ['Внимательность','Восприятие','Perception']),
        inv:passiveOf(b, 3, ['Анализ','Расследование','Investigation']),
        ins:passiveOf(b, 4, ['Проницательность','Insight'])
      },
      languages:languagesOf(b),
      darkvision:darkvisionOf(b),
      attack:attackOf(b)
    };
  }
  function pcBlocks(){
    return (typeof blocks !== 'undefined' && Array.isArray(blocks))
      ? blocks.filter(b => b && b.type === 'pc')
      : [];
  }
  function chunk(arr, n){
    const out = [];
    for(let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
    return out;
  }
  function sheet(html){
    const el = document.createElement('article');
    el.className = 'print-sheet pk-sheet';
    el.innerHTML = html;
    return el;
  }
  function short(v, n){
    const s = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s;
  }

  function partyCard(b){
    const p = partyData(b);
    const lines = [];
    if(p.saves) lines.push(`<div class="pk-line"><i>Спасброски</i><span>${esc(p.saves)}</span></div>`);
    lines.push(`<div class="pk-line"><i>Пассивно</i><span>Внимательность ${esc(p.passive.perc)} · Анализ ${esc(p.passive.inv)} · Проницательность ${esc(p.passive.ins)}</span></div>`);
    if(p.languages) lines.push(`<div class="pk-line"><i>Языки</i><span>${esc(p.languages)}</span></div>`);
    if(p.darkvision) lines.push(`<div class="pk-line"><i>Тёмное зрение</i><span>${esc(p.darkvision)}</span></div>`);
    if(p.attack) lines.push(`<div class="pk-line"><i>Атака</i><span>${esc(p.attack)}</span></div>`);
    return `<article class="pk-pc">
      <div class="pk-pc-head"><b>${esc(p.name)}</b>${p.sub ? `<span>${esc(p.sub)}</span>` : ''}</div>
      <div class="pk-nums">
        <span><i>КД</i><b>${esc(p.ac)}</b></span>
        <span><i>ХП</i><b>${esc(p.hp)}</b></span>
        <span><i>Иниц.</i><b>${esc(p.init)}</b></span>
        <span><i>Скор.</i><b>${esc(p.speed)}</b></span>
      </div>
      ${lines.join('')}
    </article>`;
  }
  function buildPartySheets(ids){
    const wanted = Array.isArray(ids) ? new Set(ids) : null;
    const chosen = pcBlocks().filter(b => !wanted || wanted.has(b.id));
    if(!chosen.length) return [];
    const cards = chosen.map(partyCard);
    const pages = chunk(cards, 8);
    return pages.map((group, i) => sheet(
      `<h1 class="ps-title">Партия</h1>
       <div class="ps-sub">Шпаргалка мастера · персонажей: ${chosen.length}${pages.length > 1 ? ` · лист ${i + 1} из ${pages.length}` : ''} · пассивные проверки без черт и предметов</div>
       <div class="pk-party-grid">${group.join('')}</div>`
    ));
  }

  function initiativeTentCard(t, fallbackNum){
    const num = t.number || fallbackNum;
    const name = t.name ? esc(t.name) : '<span class="pk-write-line"></span>';
    const val = v => v ? esc(v) : '<span class="pk-write-line short"></span>';
    const front = `<div class="pk-init-number">${esc(num)}</div><div class="pk-init-name">${name}</div>`;
    const back = `<div class="pk-init-head"><span class="pk-init-number small">${esc(num)}</span><b>${name}</b></div>
      <div class="pk-init-fields">
        <span><i>Иниц.</i><b>${val(t.init)}</b></span>
        <span><i>КД</i><b>${val(t.ac)}</b></span>
        <span><i>ХП</i><b>${val(t.hp)}</b></span>
      </div>
      <div class="pk-init-notes"><i>Состояния</i><span class="pk-write-line"></span></div>`;
    return `<div class="pk-tent pk-tent-init"><div class="pk-tent-half top">${front}</div><div class="pk-tent-half">${back}</div></div>`;
  }
  function tentCard(t, i){
    if(t.variant === 'init') return initiativeTentCard(t, i + 1);
    const half = `<b>${esc(t.name)}</b>${t.meta ? `<span>${esc(t.meta)}</span>` : ''}${t.note ? `<small>${esc(t.note)}</small>` : ''}`;
    return `<div class="pk-tent"><div class="pk-tent-half top">${half}</div><div class="pk-tent-half">${half}</div></div>`;
  }
  function buildTentSheets(items, title, subtitle){
    if(!items.length) return [];
    const cards = items.map((t, i) => tentCard(t, i));
    const pages = chunk(cards, 8);
    return pages.map((group, i) => sheet(
      `<h1 class="ps-title">${esc(title)}</h1>
       <div class="ps-sub">${esc(subtitle)}${pages.length > 1 ? ` · лист ${i + 1} из ${pages.length}` : ''}</div>
       <div class="pk-tents">${group.join('')}</div>`
    ));
  }

  function initCandidates(){
    const parts = (typeof battleParts !== 'undefined' && Array.isArray(battleParts)) ? battleParts : [];
    if(parts.length){
      let ordered = parts;
      try{ if(typeof battleOrder === 'function') ordered = battleOrder(); }catch(e){}
      return ordered.map(p => ({
        id:'b:' + p.id,
        name:p.name || 'Участник',
        init:p.init !== '' && p.init != null ? String(p.init) : '—',
        ac:p.ac !== '' && p.ac != null ? String(p.ac) : '—',
        hp:(p.hp !== '' && p.hp != null ? String(p.hp) : '—') + (p.hpMax ? '/' + p.hpMax : '')
      }));
    }
    return pcBlocks().map(b => {
      const p = partyData(b);
      return { id:'pc:' + b.id, name:p.name, init:p.init, ac:p.ac, hp:p.hp };
    });
  }
  function npcCandidates(){
    return (typeof blocks !== 'undefined' && Array.isArray(blocks))
      ? blocks.filter(b => b && b.type === 'note')
      : [];
  }
  function npcNote(b){
    return short(String((b && b.text) || '').split(/\n/).map(s => s.trim()).filter(Boolean)[0] || '', 90);
  }
  function initBlankCount(){
    const el = document.getElementById('pkInitBlank');
    const n = Number(el && el.value);
    return Number.isFinite(n) ? Math.max(0, Math.min(12, n)) : 0;
  }
  function initTents(){
    const stats = document.getElementById('pkInitStats');
    const showStats = !stats || stats.checked;
    const out = initCandidates().filter(x => selected.init.has(x.id)).map((x, i) => ({
      variant:'init',
      number:i + 1,
      name:x.name,
      init:x.init,
      ac:showStats ? x.ac : '',
      hp:showStats ? x.hp : ''
    }));
    const blanks = initBlankCount();
    for(let i = 0; i < blanks; i++){
      out.push({ variant:'init', number:out.length + 1, name:'', init:'', ac:'', hp:'' });
    }
    return out;
  }
  function npcTents(){
    return npcCandidates().filter(b => selected.npc.has(b.id)).map(b => ({
      name:b.title || 'НПС',
      meta:'НПС',
      note:npcNote(b)
    }));
  }

  function itemData(){
    return (window.SRD_ITEMS && Array.isArray(window.SRD_ITEMS.items)) ? window.SRD_ITEMS.items : [];
  }
  function itemMeta(it){
    return [it.type, it.rarity, it.att ? 'настройка' : ''].filter(Boolean).join(' · ');
  }
  function itemCard(it){
    return `<article class="pk-item">
      <div class="pk-item-kicker">${esc([it.type, it.rarity].filter(Boolean).join(' · '))}</div>
      <h3>${esc(it.n || 'Предмет')}</h3>
      <div class="pk-item-desc">${esc(short(it.d, 330))}</div>
      <div class="pk-item-foot"><span>${it.att ? 'Требует настройки' : 'Магический предмет'}</span><span>SRD 5.2.1</span></div>
    </article>`;
  }
  function buildItemSheets(indices){
    const all = itemData();
    const chosen = (Array.isArray(indices) ? indices : []).map(i => all[Number(i)]).filter(Boolean);
    if(!chosen.length) return [];
    const cards = chosen.map(itemCard);
    const pages = chunk(cards, 9);
    return pages.map((group, i) => sheet(
      `<h1 class="ps-title">Предметы</h1>
       <div class="ps-sub">Карточки для игроков · ${chosen.length} шт.${pages.length > 1 ? ` · лист ${i + 1} из ${pages.length}` : ''}</div>
       <div class="pk-items">${group.join('')}</div>`
    ));
  }

  function conditionCard(c){
    return `<article class="pk-cond">
      <div class="pk-cond-kicker">Состояние</div>
      <h3>${esc(c.name)}</h3>
      <ul>${(c.effects || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="pk-cond-foot">D&amp;D 2024</div>
    </article>`;
  }
  function buildConditionSheets(ids){
    const wanted = Array.isArray(ids) ? new Set(ids) : null;
    const chosen = CONDITIONS.filter(c => !wanted || wanted.has(c.id));
    if(!chosen.length) return [];
    const cards = chosen.map(conditionCard);
    const pages = chunk(cards, 9);
    return pages.map((group, i) => sheet(
      `<h1 class="ps-title">Состояния</h1>
       <div class="ps-sub">Карточки для стола · ${chosen.length} шт.${pages.length > 1 ? ` · лист ${i + 1} из ${pages.length}` : ''}</div>
       <div class="pk-conditions">${group.join('')}</div>`
    ));
  }
  function stateToken(c){
    return `<div class="pk-token"><span>СОСТОЯНИЕ</span><b>${esc(c.token || c.name)}</b></div>`;
  }
  function buildStateTokenSheets(ids){
    const wanted = Array.isArray(ids) ? new Set(ids) : null;
    const chosen = CONDITIONS.filter(c => !wanted || wanted.has(c.id));
    if(!chosen.length) return [];
    const tokens = [];
    chosen.forEach(c => { tokens.push(stateToken(c), stateToken(c)); });
    const pages = chunk(tokens, 30);
    return pages.map((group, i) => sheet(
      `<h1 class="ps-title">Жетоны состояний</h1>
       <div class="ps-sub">По две копии каждого · ${chosen.length * 2} шт.${pages.length > 1 ? ` · лист ${i + 1} из ${pages.length}` : ''}</div>
       <div class="pk-tokens">${group.join('')}</div>`
    ));
  }
  function buildInitTokenSheets(){
    const tokens = Array.from({length:20}, (_, i) =>
      `<div class="pk-token pk-token-num"><span>ИНИЦИАТИВА</span><b>${i + 1}</b></div>`
    );
    return [sheet(
      `<h1 class="ps-title">Номера инициативы</h1>
       <div class="ps-sub">Жетоны 1–20 · для очереди хода и меток на карте</div>
       <div class="pk-tokens pk-init-tokens">${tokens.join('')}</div>`
    )];
  }
  function buildStatePrintSheets(opts){
    const o = opts || {};
    const ids = Array.isArray(o.ids) ? o.ids : [];
    const out = [];
    if(o.cards) out.push(...buildConditionSheets(ids));
    if(o.tokens) out.push(...buildStateTokenSheets(ids));
    if(o.init) out.push(...buildInitTokenSheets());
    return out;
  }

  const listParty = document.getElementById('pkPartyList');
  const listInit = document.getElementById('pkInitList');
  const listNpc = document.getElementById('pkNpcList');
  const listItems = document.getElementById('pkItemList');
  const listStates = document.getElementById('pkStateList');
  const countParty = document.getElementById('pkPartyCount');
  const countInit = document.getElementById('pkInitCount');
  const countNpc = document.getElementById('pkNpcCount');
  const countItems = document.getElementById('pkItemCount');
  const countStates = document.getElementById('pkStateCount');
  const hint = document.getElementById('pkHint');
  const printBtn = document.getElementById('pkPrint');

  function refreshCounts(){
    const pcs = pcBlocks();
    const init = initCandidates();
    const notes = npcCandidates();
    const blanks = initBlankCount();
    countParty.textContent = `Выбрано: ${selected.party.size} из ${pcs.length}`;
    countInit.textContent = `Выбрано: ${selected.init.size} из ${init.length}` + (blanks ? ` · пустых: ${blanks}` : '');
    countNpc.textContent = `Выбрано: ${selected.npc.size} из ${notes.length}`;
    countStates.textContent = `Выбрано: ${selected.states.size} из ${CONDITIONS.length}`;
  }

  function pickRow(kind, id, title, meta, checked){
    const attr = kind === 'party' ? 'data-pk-pc' : kind === 'init' ? 'data-pk-init' : 'data-pk-npc';
    return `<label class="pk-pick"><input type="checkbox" ${attr}="${esc(id)}" ${checked ? 'checked' : ''}>
      <span class="pk-pick-main"><b>${esc(title)}</b>${meta ? `<span>${esc(meta)}</span>` : ''}</span></label>`;
  }
  function renderParty(){
    const items = pcBlocks();
    listParty.innerHTML = items.length
      ? items.map(b => {
          const p = partyData(b);
          return pickRow('party', b.id, p.name, [p.sub, 'КД ' + p.ac, 'ХП ' + p.hp].filter(Boolean).join(' · '), selected.party.has(b.id));
        }).join('')
      : '<div class="lib-empty">На ширме нет персонажей. Создайте карточку ПК.</div>';
    countParty.textContent = `Выбрано: ${selected.party.size} из ${items.length}`;
  }
  function renderInit(){
    const items = initCandidates();
    listInit.innerHTML = items.length
      ? items.map(x => pickRow('init', x.id, x.name, `Иниц. ${x.init} · КД ${x.ac} · ХП ${x.hp}`, selected.init.has(x.id))).join('')
      : '<div class="lib-empty">В бою никого нет, и на ширме нет персонажей.</div>';
    const blanks = initBlankCount();
    countInit.textContent = `Выбрано: ${selected.init.size} из ${items.length}` + (blanks ? ` · пустых: ${blanks}` : '');
  }
  function renderNpc(){
    const items = npcCandidates();
    listNpc.innerHTML = items.length
      ? items.map(b => pickRow('npc', b.id, b.title || 'НПС', npcNote(b) || 'Заметка', selected.npc.has(b.id))).join('')
      : '<div class="lib-empty">Нет заметок. Добавьте НПС заметкой на ширму.</div>';
    countNpc.textContent = `Выбрано: ${selected.npc.size} из ${items.length}`;
  }
  function itemQuery(){
    const input = document.getElementById('pkItemSearch');
    return norm(input ? input.value : '');
  }
  function filteredItems(){
    const q = itemQuery();
    return itemData().map((it, i) => ({ it, i }))
      .filter(x => !q || norm([x.it.n, x.it.type, x.it.rarity].join(' ')).indexOf(q) >= 0)
      .slice(0, 80);
  }
  function renderItems(){
    const rows = filteredItems();
    listItems.innerHTML = rows.length
      ? rows.map(({ it, i }) => {
          const key = String(i);
          return `<label class="pk-pick"><input type="checkbox" data-pk-item="${key}" ${selected.items.has(key) ? 'checked' : ''}>
            <span class="pk-pick-main"><b>${esc(it.n || 'Предмет')}</b><span>${esc(itemMeta(it))}</span></span></label>`;
        }).join('')
      : '<div class="lib-empty">Ничего не найдено.</div>';
    countItems.textContent = `Выбрано: ${selected.items.size}${rows.length === 80 ? ' · показаны первые 80' : ''}`;
  }
  function renderStates(){
    listStates.innerHTML = CONDITIONS.length
      ? CONDITIONS.map(c => `<label class="pk-pick"><input type="checkbox" data-pk-state="${esc(c.id)}" ${selected.states.has(c.id) ? 'checked' : ''}>
          <span class="pk-pick-main"><b>${esc(c.name)}</b><span>${esc(c.brief || '')}</span></span></label>`).join('')
      : '<div class="lib-empty">Нет данных состояний.</div>';
    countStates.textContent = `Выбрано: ${selected.states.size} из ${CONDITIONS.length}`;
  }
  function stateOptions(){
    return {
      cards:!!document.getElementById('pkStateCards')?.checked,
      tokens:!!document.getElementById('pkStateTokens')?.checked,
      init:!!document.getElementById('pkInitTokens')?.checked
    };
  }
  function stateSummary(){
    const o = stateOptions();
    const parts = [];
    if(o.cards && selected.states.size) parts.push('карточки: ' + selected.states.size);
    if(o.tokens && selected.states.size) parts.push('жетоны: ' + selected.states.size * 2);
    if(o.init) parts.push('номера: 20');
    return parts.join(' · ');
  }
  function tabCount(){
    if(activeTab === 'party') return selected.party.size;
    if(activeTab === 'init') return selected.init.size + initBlankCount();
    if(activeTab === 'npc') return selected.npc.size;
    if(activeTab === 'states'){
      const o = stateOptions();
      return ((o.cards || o.tokens) ? selected.states.size : 0) + (o.init ? 20 : 0);
    }
    return selected.items.size;
  }
  function updateFoot(){
    const n = tabCount();
    if(!n) hint.textContent = 'Ничего не выбрано.';
    else if(activeTab === 'states') hint.textContent = `К печати: ${stateSummary()}. В диалоге печати выберите принтер или «Сохранить как PDF».`;
    else hint.textContent = `К печати: ${n}. В диалоге печати выберите принтер или «Сохранить как PDF».`;
    printBtn.disabled = n === 0;
  }
  function setTab(tab){
    activeTab = tab;
    modal.querySelectorAll('[data-pk-tab]').forEach(btn => {
      const on = btn.dataset.pkTab === tab;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    modal.querySelectorAll('[data-pk-pane]').forEach(pane => {
      pane.hidden = pane.dataset.pkPane !== tab;
    });
    const title = document.getElementById('printKitTitle');
    if(title){
      title.textContent = tab === 'party' ? 'Партийная шпаргалка'
        : tab === 'states' ? 'Состояния и жетоны'
        : 'Печатные мелочи';
    }
    updateFoot();
  }
  function renderAll(){
    renderParty();
    renderInit();
    renderNpc();
    renderItems();
    renderStates();
  }
  function open(tab){
    selected.party = new Set(pcBlocks().map(b => b.id));
    selected.init = new Set(initCandidates().map(x => x.id));
    selected.npc = new Set(npcCandidates().map(b => b.id));
    selected.states = new Set(CONDITIONS.map(c => c.id));
    selected.items = new Set();
    ['pkStateCards','pkStateTokens','pkInitTokens'].forEach(id => {
      const el = document.getElementById(id);
      if(el) el.checked = true;
    });
    const blank = document.getElementById('pkInitBlank');
    if(blank) blank.value = '4';
    const stats = document.getElementById('pkInitStats');
    if(stats) stats.checked = true;
    const search = document.getElementById('pkItemSearch');
    if(search) search.value = '';
    renderAll();
    setTab(tab || 'party');
    openModal(modal, document.getElementById(tab === 'init' || tab === 'states' ? 'btnPrintKit' : 'btnPartySheet') || document.activeElement);
  }
  function printActive(){
    let sheets = [];
    let title = 'Печать';
    if(activeTab === 'party'){
      sheets = buildPartySheets([...selected.party]);
      title = 'Партийная шпаргалка';
    } else if(activeTab === 'init'){
      sheets = buildTentSheets(initTents(), 'Инициатива', 'Палатки со сгибом · номер, имя и поля для характеристик');
      title = 'Палатки инициативы';
    } else if(activeTab === 'npc'){
      sheets = buildTentSheets(npcTents(), 'НПС', 'Палатки со сгибом · имя и первая строка описания');
      title = 'Палатки НПС';
    } else if(activeTab === 'items'){
      sheets = buildItemSheets([...selected.items]);
      title = 'Карточки предметов';
    } else {
      const o = stateOptions();
      sheets = buildStatePrintSheets({ ids:[...selected.states], cards:o.cards, tokens:o.tokens, init:o.init });
      title = 'Состояния и жетоны';
    }
    if(!sheets.length){ toast('Нечего печатать: выберите хотя бы одну запись'); return; }
    closeModal(modal);
    if(typeof openPrintSheets === 'function') openPrintSheets(sheets, title);
    else toast('Печать недоступна');
  }

  document.getElementById('btnPartySheet')?.addEventListener('click', () => open('party'));
  document.getElementById('btnPrintKit')?.addEventListener('click', () => open('init'));
  document.getElementById('printKitClose')?.addEventListener('click', () => closeModal(modal));
  modal.addEventListener('click', ev => {
    if(ev.target === modal){ closeModal(modal); return; }
    const tabBtn = ev.target.closest('[data-pk-tab]');
    if(tabBtn){ setTab(tabBtn.dataset.pkTab); return; }
    const allBtn = ev.target.closest('[data-pk-all]');
    if(allBtn){
      const kind = allBtn.dataset.pkAll;
      if(kind === 'party') selected.party = new Set(pcBlocks().map(b => b.id));
      if(kind === 'init') selected.init = new Set(initCandidates().map(x => x.id));
      if(kind === 'npc') selected.npc = new Set(npcCandidates().map(b => b.id));
      if(kind === 'states') selected.states = new Set(CONDITIONS.map(c => c.id));
      renderAll();
      updateFoot();
    }
  });
  modal.addEventListener('change', ev => {
    const t = ev.target;
    if(t.matches('[data-pk-pc]')){
      t.checked ? selected.party.add(t.dataset.pkPc) : selected.party.delete(t.dataset.pkPc);
    } else if(t.matches('[data-pk-init]')){
      t.checked ? selected.init.add(t.dataset.pkInit) : selected.init.delete(t.dataset.pkInit);
    } else if(t.matches('[data-pk-npc]')){
      t.checked ? selected.npc.add(t.dataset.pkNpc) : selected.npc.delete(t.dataset.pkNpc);
    } else if(t.matches('[data-pk-item]')){
      t.checked ? selected.items.add(t.dataset.pkItem) : selected.items.delete(t.dataset.pkItem);
      renderItems();
    } else if(t.matches('[data-pk-state]')){
      t.checked ? selected.states.add(t.dataset.pkState) : selected.states.delete(t.dataset.pkState);
    }
    refreshCounts();
    updateFoot();
  });
  document.getElementById('pkInitStats')?.addEventListener('change', updateFoot);
  document.getElementById('pkInitBlank')?.addEventListener('change', () => { renderInit(); updateFoot(); });
  ['pkStateCards','pkStateTokens','pkInitTokens'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', updateFoot);
  });
  document.getElementById('pkItemSearch')?.addEventListener('input', renderItems);
  document.getElementById('pkItemClear')?.addEventListener('click', () => {
    selected.items.clear();
    renderItems();
    updateFoot();
  });
  printBtn?.addEventListener('click', printActive);
  document.addEventListener('keydown', ev => {
    if(ev.key === 'Escape' && !modal.hidden){ ev.preventDefault(); closeModal(modal); }
  });

  window.openPrintKit = open;
  window.buildPartySheets = buildPartySheets;
  window.buildTentSheets = buildTentSheets;
  window.buildItemSheets = buildItemSheets;
  window.buildConditionSheets = buildConditionSheets;
  window.buildStateTokenSheets = buildStateTokenSheets;
  window.buildInitTokenSheets = buildInitTokenSheets;
  window.buildStatePrintSheets = buildStatePrintSheets;
})();
