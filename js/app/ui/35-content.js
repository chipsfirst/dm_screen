/* ═══ Контент-паки: сокровища, лут, НПС и советы ═══ */
(function(){
  const modal = document.getElementById('contentModal');
  if(!modal) return;

  const PACK_KEY = 'shirma_content_packs_v1';
  const TYPE_LABEL = { treasure:'Сокровище', loot:'Лут', npc:'НПС', advice:'Совет' };
  const TYPE_ORDER = ['treasure','loot','npc','advice'];
  const TYPE_ALIAS = {
    treasure:['treasure','сокровище','сокровища','клад'],
    loot:['loot','лут','предмет','добыча'],
    npc:['npc','нпс','персонаж'],
    advice:['advice','совет','советы']
  };
  const FIELD_ALIAS = {
    type:['type','тип'],
    title:['title','название','имя'],
    tags:['tags','теги'],
    tier:['tier','уровень','полоса'],
    rarity:['rarity','редкость'],
    text:['text','текст','описание'],
    hook:['hook','зацепка'],
    role:['role','роль'],
    want:['want','хочет','цель'],
    fear:['fear','боится','страх'],
    secret:['secret','тайна'],
    quirk:['quirk','привычка','манера'],
    voice:['voice','голос'],
    moment:['moment','момент'],
    example:['example','пример']
  };

  const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v == null ? '' : v)) : String(v == null ? '' : v));
  const norm = v => String(v == null ? '' : v).toLowerCase().replace(/ё/g, 'е').trim();
  const clean = (v, n) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, n || 500);
  const tagsOf = v => Array.isArray(v)
    ? v.map(x => clean(x, 40)).filter(Boolean).slice(0, 12)
    : clean(v, 300).split(/[,;]/).map(x => x.trim()).filter(Boolean).slice(0, 12);
  const typeOf = v => {
    const t = norm(v);
    return TYPE_ORDER.find(k => TYPE_ALIAS[k].some(a => t === a || t.indexOf(a) === 0)) || '';
  };

  let userPacks = loadPacks();
  let activeTab = 'treasure';
  let query = '';
  let selectedPack = 'all';
  let featured = null;
  let importStatus = '';

  function sanitizeItem(raw){
    if(!raw || typeof raw !== 'object') return null;
    const type = typeOf(raw.type);
    const title = clean(raw.title, 120);
    if(!type || !title) return null;
    return {
      type,
      title,
      tags:tagsOf(raw.tags),
      tier:clean(raw.tier, 30),
      rarity:clean(raw.rarity, 30),
      text:clean(raw.text, 4000),
      hook:clean(raw.hook, 1200),
      role:clean(raw.role, 80),
      want:clean(raw.want, 600),
      fear:clean(raw.fear, 600),
      secret:clean(raw.secret, 600),
      quirk:clean(raw.quirk, 400),
      voice:clean(raw.voice, 400),
      moment:clean(raw.moment, 60),
      example:clean(raw.example, 900)
    };
  }
  function sanitizePacks(raw){
    if(!Array.isArray(raw)) return [];
    return raw.map(p => {
      if(!p || typeof p !== 'object') return null;
      const items = (Array.isArray(p.items) ? p.items : []).map(sanitizeItem).filter(Boolean).slice(0, 500);
      if(!items.length) return null;
      return {
        id:String(p.id || 'user-' + Math.random().toString(36).slice(2, 9)).slice(0, 80),
        title:clean(p.title, 80) || 'Мой пак',
        description:clean(p.description, 300),
        license:clean(p.license, 120),
        builtin:false,
        items
      };
    }).filter(Boolean).slice(0, 40);
  }
  function loadPacks(){
    try{ return sanitizePacks(JSON.parse(localStorage.getItem(PACK_KEY) || '[]')); }
    catch(e){ return []; }
  }
  function savePacks(){
    try{ localStorage.setItem(PACK_KEY, JSON.stringify(userPacks)); }
    catch(e){ toast('Не удалось сохранить пак: хранилище переполнено'); }
  }
  function presets(){
    return (Array.isArray(window.CONTENT_PACK_PRESETS) ? window.CONTENT_PACK_PRESETS : [])
      .map(p => Object.assign({}, p, { builtin:true }));
  }
  function allPacks(){ return presets().concat(userPacks); }
  function flatItems(){
    const out = [];
    allPacks().forEach(p => {
      (p.items || []).forEach((it, i) => out.push(Object.assign({}, it, {
        _id:p.id + ':' + i,
        _pack:p.title,
        _packId:p.id
      })));
    });
    return out;
  }
  function findItem(id){ return flatItems().find(x => x._id === id) || null; }

  function metaOf(it){
    if(it.type === 'treasure') return it.tier ? 'Полоса: ' + it.tier : '';
    if(it.type === 'loot') return it.rarity || '';
    if(it.type === 'npc') return it.role || '';
    if(it.type === 'advice') return it.moment || '';
    return '';
  }
  function detailsOf(it){
    const rows = [];
    const add = (label, val) => { if(val) rows.push(`<div class="content-detail"><b>${esc(label)}</b><span>${esc(val)}</span></div>`); };
    if(it.type === 'npc'){
      add('Хочет', it.want); add('Боится', it.fear); add('Тайна', it.secret);
      add('Привычка', it.quirk); add('Голос', it.voice);
    } else if(it.type === 'advice'){
      add('Пример', it.example);
    } else {
      add('Зацепка', it.hook);
    }
    return rows.join('');
  }
  function cardHtml(it){
    const meta = metaOf(it);
    const tags = (it.tags || []).map(t => `<span>${esc(t)}</span>`).join('');
    return `<article class="content-card${featured === it._id ? ' is-featured' : ''}" data-content-id="${esc(it._id)}">
      <div class="content-card-top">
        <span class="content-kind k-${esc(it.type)}">${esc(TYPE_LABEL[it.type])}</span>
        <span class="content-pack">${esc(it._pack)}</span>
      </div>
      <h3>${esc(it.title)}</h3>
      ${meta ? `<div class="content-meta">${esc(meta)}</div>` : ''}
      ${it.text ? `<p>${esc(it.text)}</p>` : ''}
      ${detailsOf(it)}
      ${tags ? `<div class="content-tags">${tags}</div>` : ''}
      <div class="content-actions"><button type="button" data-content-add="${esc(it._id)}">На ширму</button></div>
    </article>`;
  }

  const body = document.getElementById('contentBody');
  const toolbar = document.getElementById('contentToolbar');
  const importBox = document.getElementById('contentImport');
  const search = document.getElementById('contentSearch');
  const packSelect = document.getElementById('contentPack');
  const count = document.getElementById('contentCount');
  const importStatusEl = document.getElementById('contentImportStatus');
  const packsList = document.getElementById('contentPacksList');

  function renderPackSelect(){
    const packs = allPacks();
    packSelect.innerHTML = '<option value="all">Все паки</option>' + packs.map(p =>
      `<option value="${esc(p.id)}">${esc(p.title)}${p.builtin ? '' : ' · мой'}</option>`
    ).join('');
    if(!packs.some(p => p.id === selectedPack)) selectedPack = 'all';
    packSelect.value = selectedPack;
  }
  function match(it){
    if(selectedPack !== 'all' && it._packId !== selectedPack) return false;
    if(!query) return true;
    return norm([it.title, it.text, it.hook, it.role, it.want, it.fear, it.secret, it.quirk, it.voice, it.moment, it.example, (it.tags || []).join(' ')].join(' ')).indexOf(query) >= 0;
  }
  function currentItems(){
    let list = flatItems().filter(it => it.type === activeTab && match(it));
    if(featured){
      const i = list.findIndex(it => it._id === featured);
      if(i > 0) list.unshift(list.splice(i, 1)[0]);
    }
    return list;
  }
  function render(){
    const isImport = activeTab === 'import';
    toolbar.hidden = isImport;
    body.hidden = isImport;
    importBox.hidden = !isImport;
    if(isImport){
      renderImport();
      count.textContent = `Моих паков: ${userPacks.length}`;
      return;
    }
    const list = currentItems();
    body.innerHTML = list.length
      ? list.map(cardHtml).join('')
      : '<div class="lib-empty">Ничего не найдено. Попробуйте другой запрос или пак.</div>';
    count.textContent = `Найдено: ${list.length} · пакетов: ${allPacks().length}`;
    body.scrollTop = 0;
  }
  function renderImport(){
    if(importStatusEl) importStatusEl.textContent = importStatus;
    packsList.innerHTML = userPacks.length
      ? userPacks.map(p => `<div class="content-pack-row">
          <div><b>${esc(p.title)}</b><span>${p.items.length} записей</span></div>
          <button type="button" data-pack-del="${esc(p.id)}">Удалить</button>
        </div>`).join('')
      : '<div class="lib-empty">Своих паков пока нет. Загрузите CSV или скачайте шаблон.</div>';
  }
  function setTab(tab){
    activeTab = (tab === 'import' || TYPE_ORDER.includes(tab)) ? tab : 'treasure';
    featured = null;
    modal.querySelectorAll('[data-content-tab]').forEach(b => {
      const on = b.dataset.contentTab === activeTab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    render();
  }
  function textForNote(it){
    const lines = [TYPE_LABEL[it.type] + ': ' + it.title];
    const meta = metaOf(it);
    if(meta) lines.push(meta);
    if(it.text) lines.push('', it.text);
    if(it.want) lines.push('', 'Хочет: ' + it.want);
    if(it.fear) lines.push('Боится: ' + it.fear);
    if(it.secret) lines.push('Тайна: ' + it.secret);
    if(it.quirk) lines.push('Привычка: ' + it.quirk);
    if(it.voice) lines.push('Голос: ' + it.voice);
    if(it.hook) lines.push('', 'Зацепка: ' + it.hook);
    if(it.example) lines.push('', 'Пример: ' + it.example);
    if(it.tags && it.tags.length) lines.push('', 'Теги: ' + it.tags.join(', '));
    return lines.join('\n');
  }
  function addToScreen(id){
    const it = findItem(id);
    if(!it) return;
    const b = makeBlock('note', it.title);
    Object.assign(b, freeCascadePos());
    b.text = textForNote(it);
    blocks.push(b);
    save();
    render();
    showTab('chars');
    closeModal(modal);
    toast('На ширму: ' + it.title);
  }
  function randomPick(){
    const list = currentItems();
    if(!list.length){ toast('В этом разделе ничего нет'); return; }
    featured = list[Math.floor(Math.random() * list.length)]._id;
    render();
    toast('Случайный результат: ' + (findItem(featured) || {}).title);
  }

  function parseCsv(text){
    const rows = [];
    let row = [], cell = '', quote = false;
    for(let i = 0; i < text.length; i++){
      const ch = text[i];
      if(quote){
        if(ch === '"'){
          if(text[i + 1] === '"'){ cell += '"'; i++; }
          else quote = false;
        } else cell += ch;
      } else if(ch === '"'){
        quote = true;
      } else if(ch === ','){
        row.push(cell); cell = '';
      } else if(ch === '\n'){
        row.push(cell); rows.push(row); row = []; cell = '';
      } else if(ch !== '\r'){
        cell += ch;
      }
    }
    row.push(cell);
    if(row.some(x => x !== '')) rows.push(row);
    return rows.filter(r => r.some(x => String(x).trim() !== ''));
  }
  function headerMap(headers){
    const map = {};
    headers.forEach((h, i) => {
      const key = norm(h).replace(/^\ufeff/, '');
      const field = Object.keys(FIELD_ALIAS).find(k => FIELD_ALIAS[k].some(a => key === a || key === norm(a)));
      if(field && map[field] === undefined) map[field] = i;
    });
    return map;
  }
  function importCsv(text, filename){
    const rows = parseCsv(text);
    if(rows.length < 2){ importStatus = 'В CSV нет строк с данными.'; renderImport(); return; }
    const map = headerMap(rows[0]);
    if(map.type === undefined || map.title === undefined){
      importStatus = 'Нужны колонки type и title (или «тип» и «название»).';
      renderImport(); return;
    }
    const items = [];
    rows.slice(1).forEach(r => {
      const raw = {};
      Object.keys(map).forEach(k => { raw[k] = r[map[k]]; });
      const it = sanitizeItem(raw);
      if(it) items.push(it);
    });
    if(!items.length){ importStatus = 'Не найдено ни одной корректной записи. Проверьте type.'; renderImport(); return; }
    const pack = {
      id:'user-' + Date.now().toString(36),
      title:clean(filename.replace(/\.csv$/i, ''), 80) || 'Мой пак',
      description:'Импорт из CSV',
      license:'Пользовательский контент',
      builtin:false,
      items
    };
    userPacks.push(pack);
    savePacks();
    selectedPack = pack.id;
    importStatus = `Импортировано ${items.length} записей в пак «${pack.title}».`;
    renderPackSelect();
    setTab(items[0].type);
    toast('Контент-пак загружен: ' + items.length);
  }
  function downloadTemplate(){
    const headers = ['type','title','tags','tier','rarity','text','hook','role','want','fear','secret','quirk','voice','moment','example'];
    const rows = [
      ['treasure','Кошелёк карманника','город;улица','1–4','','4d6 см и 1d6 зм.','Монета — жетон гильдии.','','','','','','','',''],
      ['loot','Ключ с тремя бородками','город;ключ','','обычный','Подходит к трём замкам.','Один замок — в доме союзника.','','','','','','','',''],
      ['npc','Барнабас Толстый','таверна','','','','','трактирщик','Купить соседнюю таверну','Пожара','Продаёт слухи','Протирает кружку','Громкий, добродушный','',''],
      ['advice','Одна привычка — уже характер','нпс;отыгрыш','','','Дайте НПС одну привычку.','','','','','','','','Перед сессией','Трактирщик протирает кружку, когда лжёт.']
    ];
    const csv = '\ufeff' + [headers, ...rows].map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\r\n');
    if(typeof saveFile === 'function') saveFile('content-pack-template.csv', csv, 'text/csv');
    else toast('Шаблон недоступен: нет сохранения файла');
  }
  async function deletePack(id){
    const p = userPacks.find(x => x.id === id);
    if(!p) return;
    const ok = typeof uiConfirm === 'function'
      ? await uiConfirm(`Удалить пак «${p.title}»? Карточки, уже добавленные на ширму, останутся.`, {ok:'Удалить'})
      : true;
    if(!ok) return;
    userPacks = userPacks.filter(x => x.id !== id);
    savePacks();
    if(selectedPack === id) selectedPack = 'all';
    renderPackSelect();
    render();
    toast('Пак удалён');
  }

  function open(){
    renderPackSelect();
    render();
    openModal(modal, document.getElementById('btnContentPacks') || document.activeElement);
  }

  document.getElementById('btnContentPacks')?.addEventListener('click', open);
  document.getElementById('contentClose')?.addEventListener('click', () => closeModal(modal));
  modal.addEventListener('click', e => {
    if(e.target === modal){ closeModal(modal); return; }
    const tab = e.target.closest('[data-content-tab]');
    if(tab){ setTab(tab.dataset.contentTab); return; }
    const add = e.target.closest('[data-content-add]');
    if(add){ addToScreen(add.dataset.contentAdd); return; }
    const del = e.target.closest('[data-pack-del]');
    if(del){ deletePack(del.dataset.packDel); }
  });
  document.getElementById('contentRandom')?.addEventListener('click', randomPick);
  search?.addEventListener('input', () => { query = norm(search.value); featured = null; render(); });
  packSelect?.addEventListener('change', () => { selectedPack = packSelect.value; featured = null; render(); });
  document.getElementById('contentCsvPick')?.addEventListener('click', () => document.getElementById('contentCsvFile')?.click());
  document.getElementById('contentCsvFile')?.addEventListener('change', e => {
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    if(typeof file.text === 'function'){
      file.text().then(txt => importCsv(txt, file.name)).catch(() => { importStatus = 'Не удалось прочитать файл.'; renderImport(); });
    } else {
      const r = new FileReader();
      r.onload = () => importCsv(String(r.result || ''), file.name);
      r.readAsText(file);
    }
    e.target.value = '';
  });
  document.getElementById('contentCsvTemplate')?.addEventListener('click', downloadTemplate);

  window.openContentPacks = open;
  window.sanitizeContentPacks = sanitizePacks;
})();
