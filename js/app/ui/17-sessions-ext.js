/* ═══ Сессии: шаблоны, связи с карточками, ссылки в тексте ═══ */

/* ── Шаблоны сессий ── */
const SESS_TPL_KEY = 'shirma_session_templates_v1';
const BUILTIN_SESS_TPLS = [
  { id:'sess-empty', name:'Пустая сессия', builtin:true, hint:'Чистый лист без подсказок — для тех, кто уже знает, что делает.', sources:[], html:'' },
  { id:'sess-combat', name:'Боевая сессия', builtin:true,
    hint:'Цель, быстрый старт, три сцены, противники и награды — с советами и примером боя.',
    sources:[
      '<b>DMG 2024</b> — построение столкновений, местность и награды.',
      '<b>Monster Manual 2025</b> — статблоки и тактики монстров.',
      '<b>SRD 5.2.1</b> — открытые статблоки и правила боя.',
      '<b>«Гробница Аннигиляции»</b> — опасные локации и боссы.',
      '<b>The Lazy Dungeon Master</b> — подготовка сцен без жёсткого сюжета.'
    ],
    html:
      '<h2>Цель сессии</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Сформулируйте одну цель: что игроки должны понять, потерять или получить к концу вечера.</p>'+
      '<p><b>Пример.</b> «Удержать мост до рассвета и выяснить, кто платит наёмникам».</p>'+
      '<h2>Быстрый старт</h2>'+
      '<ul><li>Кто нападает и чего хочет.</li><li>Почему сейчас и почему здесь.</li><li>Что потеряют герои, если проиграют.</li></ul>'+
      '<h2>Сцены</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Готовьте 3–4 сцены, а не весь сюжет: игроки всё равно пойдут своим путём.</p>'+
      '<p><b>Сцена 1.</b> Подход: что видят и слышат герои, кто первый говорит.</p>'+
      '<p><b>Сцена 2.</b> Осложнение: подкрепление, обвал, пленник или выбор.</p>'+
      '<p><b>Сцена 3.</b> Развязка: погоня, переговоры или последний рубеж.</p>'+
      '<h2>Противники</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Добавьте местность, укрытия и вторую волну — бой решают не только хиты.</p>'+
      '<p><b>Пример.</b> Гоблины на балках, лучник за бочками, через два раунда — тролль.</p>'+
      '<h2>Награды</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Дайте не только золото: информацию, союзника, репутацию или ключ к следующей сцене.</p>'+
      '<h2>После игры</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Запишите три факта, которые изменились в мире, и один вопрос, который задаст следующая сессия.</p>' },
  { id:'sess-city', name:'Городская интрига', builtin:true,
    hint:'НПС, локации, улики и часы — для расследования, политики и двойного дна.',
    sources:[
      '<b>Waterdeep: Dragon Heist</b> — городское расследование и фракции.',
      '<b>Keys from the Golden Vault</b> — ограбления и подготовка к ним.',
      '<b>DMG 2024</b> — НПС, социальное взаимодействие и интриги.',
      '<b>The Alexandrian</b> — сюжет как сеть узлов, а не рельсы.',
      '<b>dungeons.ru</b> — статьи и переводы для мастеров.'
    ],
    html:
      '<h2>Завязка</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Начните с просьбы, а не с предыстории: кто обратился и что просит.</p>'+
      '<p><b>Пример.</b> Сборщик налогов пропал вместе с ведомостью, а через день его находят живым — но он всё отрицает.</p>'+
      '<h2>Действующие лица</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Трёх НПС достаточно: союзник, соперник и тот, кто лжёт.</p>'+
      '<ul><li><b>Союзник.</b> Помогает, но чего-то боится.</li><li><b>Соперник.</b> Идёт к той же цели и мешает.</li><li><b>Лжец.</b> Говорит правду, но не всю.</li></ul>'+
      '<h2>Локации</h2>'+
      '<p class="sess-tip"><b>Совет.</b> У каждой локации должен быть секрет и хотя бы один обитатель, с которым можно поговорить.</p>'+
      '<p><b>Пример.</b> Таверна с долговой книгой, ратуша с закрытым архивом, рынок, где торгуют краденым.</p>'+
      '<h2>Улики и тайны</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Правило трёх улик: каждую важную догадку подтверждают три независимые находки.</p>'+
      '<ul><li>Что можно узнать и у кого.</li><li>Ложный след, который стоит времени.</li><li>Улика, которая меняет сторону конфликта.</li></ul>'+
      '<h2>Осложнения</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Заведите часы: что случится, если герои будут медлить.</p>'+
      '<p><b>Пример.</b> Через три сцены городской совет голосует, и виновный получает власть.</p>'+
      '<h2>Развязка</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Подготовьте 2–3 исхода в зависимости от того, кому поверили и что доказали.</p>' },
  { id:'sess-travel', name:'Путешествие', builtin:true,
    hint:'Маршрут, сцены в пути, погода и испытания, встречи и прибытие.',
    sources:[
      '<b>Rime of the Frostmaiden</b> — холод, выживание и дорога.',
      '<b>Tomb of Annihilation</b> — исследование диких земель.',
      '<b>Storm King\'s Thunder</b> — большие расстояния и гиганты.',
      '<b>DMG 2024</b> — исследование и путешествия.',
      '<b>SRD 5.2.1</b> — темп путешествия и дорожные правила.'
    ],
    html:
      '<h2>Маршрут</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Трёх точек и одного перевала достаточно: у каждой остановки должна быть причина.</p>'+
      '<p><b>Пример.</b> Деревня → переправа → заброшенный монастырь → перевал.</p>'+
      '<h2>Сцены в пути</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Не играйте каждый день пути: одна сцена на переход, остальное — монтаж.</p>'+
      '<p><b>Сцена 1.</b> Дорога, погода и настроение группы.</p>'+
      '<p><b>Сцена 2.</b> Встреча или препятствие, которое меняет план.</p>'+
      '<h2>Погода и испытания</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Испытание — это выбор с ценой, а не только проверка навыка.</p>'+
      '<p><b>Пример.</b> Река поднялась: брод стоит припасов, мост — времени, проводник — денег.</p>'+
      '<h2>Встречи</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Не каждая встреча — бой: торговец, патруль, беженец или хищник, который просто наблюдает.</p>'+
      '<h2>Прибытие</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Закончите первым впечатлением и крючком на следующую сессию.</p>' },
  { id:'sess-dungeon', name:'Подземелье', builtin:true,
    hint:'Вход, комнаты, ловушки, обитатели и сокровища — с подсказками и примером.',
    sources:[
      '<b>DMG 2024</b> — устройство подземелий и опасности.',
      '<b>Lost Mine of Phandelver</b> — компактное стартовое подземелье.',
      '<b>Tomb of Annihilation</b> — ловушки, секреты и смертельные комнаты.',
      '<b>SRD 5.2.1</b> — ловушки, снаряжение и статблоки.',
      '<b>dungeons.ru</b> — идеи для комнат и встреч.'
    ],
    html:
      '<h2>Вход и слухи</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Дайте две версии слухов: одна правдива, другая удобна кому-то другому.</p>'+
      '<h2>Комнаты</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Пяти комнат хватит: бой, загадка, пустая с атмосферой, сокровище и логово.</p>'+
      '<p><b>Комната 1.</b> Описание, опасность, что можно найти.</p>'+
      '<p><b>Комната 2.</b> Обитатели и их реакция.</p>'+
      '<h2>Ловушки и секреты</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Сначала подсказка, потом ловушка: царапины, запах, сквозняк или кости.</p>'+
      '<p><b>Пример.</b> На полу пыль, но у стены — чистая полоса; на стене — три одинаковые ниши.</p>'+
      '<h2>Обитатели</h2>'+
      '<p class="sess-tip"><b>Совет.</b> С большинством можно договориться: у них есть страх, голод или цель.</p>'+
      '<h2>Сокровища</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Сокровище — это выбор: тяжёлое, заметное или требующее услуги.</p>'+
      '<h2>Выход</h2>'+
      '<p class="sess-tip"><b>Совет.</b> Закончите последствием: что осталось внизу и кто об этом узнал.</p>' }
];
let sessTemplates = [];
try{
  const raw = JSON.parse(localStorage.getItem(SESS_TPL_KEY) || '[]');
  if(Array.isArray(raw)) sessTemplates = raw.filter(t=> t && typeof t==='object' && t.name && typeof t.html==='string').slice(0,20);
}catch(e){}
function persistSessTemplates(){
  try{ localStorage.setItem(SESS_TPL_KEY, JSON.stringify(sessTemplates)); }
  catch(e){ toast('Шаблоны сессий не сохранились: хранилище переполнено'); }
}
function sessSourcesHtml(list){
  const arr = Array.isArray(list) ? list.filter(Boolean) : [];
  if(!arr.length) return '';
  return '<h2>Источники вдохновения</h2><ul>' + arr.map(s=>'<li>'+s+'</li>').join('') + '</ul>';
}
function sessTemplateHtml(t){
  return String((t && t.html) || '') + sessSourcesHtml(t && t.sources);
}
function sessTplSections(html){
  const d = document.createElement('div');
  d.innerHTML = html || '';
  return d.querySelectorAll('h2').length;
}
function renderSessTemplates(){
  const list = document.getElementById('sessionTplList'); if(!list) return;
  const search = document.getElementById('sessionTplSearch');
  const q = (search ? search.value : '').trim().toLowerCase();
  const all = BUILTIN_SESS_TPLS.concat(sessTemplates.map(t=> Object.assign({}, t, { builtin:false })));
  const items = all.filter(t=> !q || String(t.name||'').toLowerCase().includes(q) || String(t.hint||'').toLowerCase().includes(q) || String(t.html||'').toLowerCase().includes(q));
  if(!items.length){
    list.innerHTML = '<div class="lib-empty">Ничего не найдено.</div>';
    return;
  }
  list.innerHTML = items.map(t=>{
    const n = sessTplSections(sessTemplateHtml(t));
    const src = Array.isArray(t.sources) ? t.sources.length : 0;
    const meta = (n ? ('Разделов: '+n) : 'Чистый лист') + (src ? (' · Источников: '+src) : '');
    const hint = t.hint ? `<div class="lib-p">${escapeHtml(t.hint)}</div>` : '';
    return `<div class="lib-row sess-tpl-row">
      <span class="lib-kind">${t.builtin ? 'Готовый' : 'Мой'}</span>
      <div class="lib-main"><div class="lib-title">${escapeHtml(t.name)}</div><div class="lib-meta">${escapeHtml(meta)}</div>${hint}</div>
      <button type="button" class="tpl-add" data-sess-tpl-add="${escapeHtml(t.id)}" title="Создать сессию по шаблону" aria-label="Создать сессию по шаблону">＋</button>
      ${t.builtin ? '' : `<button type="button" class="tpl-del" data-sess-tpl-del="${escapeHtml(t.id)}" title="Удалить шаблон" aria-label="Удалить шаблон">✕</button>`}
    </div>`;
  }).join('');
}
function openSessionTemplates(){
  renderSessTemplates();
  const m = document.getElementById('sessionTplModal');
  if(m) openModal(m, document.activeElement);
}
function addSessionFromTemplate(tpl){
  if(!tpl) return;
  newSession(false, { title:tpl.name, html:sessTemplateHtml(tpl) });
  const m = document.getElementById('sessionTplModal'); if(m) closeModal(m);
  toast('Сессия по шаблону «'+tpl.name+'»');
  setTimeout(()=>{ const ed=document.getElementById('sessionEditor'); if(ed) ed.focus(); }, 60);
}
async function saveActiveSessionTemplate(){
  const s = findSession(activeSessionId);
  if(!s){ toast('Нет активной сессии'); return; }
  const name = await uiPrompt('Название шаблона:', s.title || 'Шаблон сессии', { title:'Сохранить сессию как шаблон' });
  if(name === null || name === undefined) return;
  const nm = String(name).trim().slice(0,80);
  if(!nm) return;
  const tpl = { id:'st'+Date.now().toString(36)+Math.random().toString(36).slice(2,6), name:nm, html:String(s.html||'').slice(0,200000), created:Date.now() };
  sessTemplates.unshift(tpl);
  while(sessTemplates.length > 20) sessTemplates.pop();
  persistSessTemplates();
  renderSessTemplates();
  toast('Шаблон «'+nm+'» сохранён');
}

/* ── Связи сессии с карточками ── */
let sessLinksMode = 'links';
let sessLinksPick = null;
let sessInsertRange = null;

function renderSessionLinks(){
  const box = document.getElementById('sessionLinks');
  if(!box) return;
  const s = findSession(activeSessionId);
  if(!s){ box.hidden = true; box.innerHTML=''; return; }
  box.hidden = false;
  const items = (s.links||[]).map(id=> (typeof findBlock==='function' ? findBlock(id) : null)).filter(Boolean);
  box.innerHTML = '<span class="cl-lbl">Карточки</span>' +
    items.map(b=>`<button type="button" class="cl-chip" data-sess-open-card="${b.id}" title="${escapeHtml((TYPE_LABEL[b.type]||'Карточка')+': '+(b.title||''))}">${escapeHtml(b.title||'(без названия)')}</button>`).join('') +
    '<button type="button" class="cl-add" data-sess-link-edit="1" title="Связать карточки с сессией">＋ Связь</button>';
}
function sessCandidates(){
  return blocks.slice().sort((a,c)=>{
    const ta = TYPE_LABEL[a.type] || '', tc = TYPE_LABEL[c.type] || '';
    if(ta !== tc) return ta.localeCompare(tc,'ru');
    return String(a.title||'').localeCompare(String(c.title||''),'ru');
  });
}
function renderSessLinksList(){
  const list = document.getElementById('sessLinksList'); if(!list) return;
  const search = document.getElementById('sessLinksSearch');
  const q = (search ? search.value : '').trim().toLowerCase();
  const items = sessCandidates().filter(b=> !q || String(b.title||'').toLowerCase().includes(q));
  if(!items.length){
    list.innerHTML = '<div class="lib-empty">'+(q ? 'Ничего не найдено.' : 'На ширме пока нет карточек.')+'</div>';
    return;
  }
  let html='', lastType=null;
  items.forEach(b=>{
    if(b.type !== lastType){
      lastType = b.type;
      html += `<div class="lx-group">${escapeHtml(TYPE_LABEL[lastType] || lastType)}</div>`;
    }
    const on = sessLinksMode === 'links' && sessLinksPick && sessLinksPick.has(b.id);
    const mark = sessLinksMode === 'insert' ? '↳' : (on ? '✓' : '');
    html += `<button type="button" class="lx-row${on ? ' on' : ''}" data-sess-pick="${b.id}" aria-pressed="${on ? 'true' : 'false'}">
      <span class="lx-check">${mark}</span>
      <span class="lx-main"><span class="lx-title">${escapeHtml(b.title||'(без названия)')}</span>
      <span class="lx-meta">${escapeHtml(blockSummary(b)||'')}</span></span>
    </button>`;
  });
  list.innerHTML = html;
}
function openSessLinks(mode){
  const s = findSession(activeSessionId);
  if(!s) return;
  sessLinksMode = mode === 'insert' ? 'insert' : 'links';
  sessLinksPick = new Set((s.links||[]).filter(id=> findBlock(id)));
  const title = document.getElementById('sessLinksTitle');
  if(title) title.textContent = sessLinksMode === 'insert' ? 'Вставить ссылку на карточку' : 'Связи: ' + (s.title || 'сессия');
  const hint = document.getElementById('sessLinksHint');
  if(hint) hint.textContent = sessLinksMode === 'insert'
    ? 'Кликните карточку — в текст сессии вставится ссылка [[название]].'
    : 'Отметьте карточки, связанные с сессией. Они появятся в панели «Карточки» и на самих карточках.';
  const search = document.getElementById('sessLinksSearch');
  if(search) search.value = '';
  renderSessLinksList();
  const m = document.getElementById('sessLinksModal');
  if(m) openModal(m, document.activeElement);
}
function closeSessLinks(){
  const m = document.getElementById('sessLinksModal');
  if(m && !m.hidden) closeModal(m);
  sessInsertRange = null;
  if(typeof renderSessionLinks === 'function') renderSessionLinks();
  if(typeof render === 'function') render();
}
function insertSessionCardLink(b){
  const ed = document.getElementById('sessionEditor');
  if(!ed || !b) return;
  ed.focus();
  const sel = window.getSelection();
  let range = sessInsertRange;
  if(range){ sel.removeAllRanges(); sel.addRange(range); }
  else if(sel.rangeCount && ed.contains(sel.getRangeAt(0).commonAncestorContainer)) range = sel.getRangeAt(0);
  if(!range){
    range = document.createRange();
    range.selectNodeContents(ed);
    range.collapse(false);
  }
  const a = document.createElement('a');
  a.href = '#';
  a.className = 'sess-card-link';
  a.setAttribute('data-card-open', b.id);
  a.textContent = b.title || 'карточка';
  range.deleteContents();
  range.insertNode(a);
  const after = document.createRange();
  after.setStartAfter(a);
  after.collapse(true);
  sel.removeAllRanges();
  sel.addRange(after);
  const s = findSession(activeSessionId);
  if(s){ s.html = ed.innerHTML.replace(/\u200b/g,''); s.updated = Date.now(); scheduleSaveSessions(); }
  closeSessLinks();
}
function toggleSessPick(id){
  const s = findSession(activeSessionId);
  if(!s || !sessLinksPick) return;
  if(sessLinksPick.has(id)) sessLinksPick.delete(id); else sessLinksPick.add(id);
  s.links = [...sessLinksPick];
  s.updated = Date.now();
  persistSessions();
  renderSessLinksList();
}

/* ── Обработчики ── */
(function initSessionsExtras(){
  const tplModal = document.getElementById('sessionTplModal');
  if(tplModal){
    const openBtn = document.getElementById('sessionTplBtn');
    if(openBtn) openBtn.addEventListener('click', openSessionTemplates);
    const closeBtn = document.getElementById('sessionTplClose');
    if(closeBtn) closeBtn.addEventListener('click', ()=> closeModal(tplModal));
    tplModal.addEventListener('click', e=>{ if(e.target === tplModal) closeModal(tplModal); });
    const search = document.getElementById('sessionTplSearch');
    if(search) search.addEventListener('input', renderSessTemplates);
    const saveBtn = document.getElementById('sessionTplSave');
    if(saveBtn) saveBtn.addEventListener('click', saveActiveSessionTemplate);
    const list = document.getElementById('sessionTplList');
    if(list) list.addEventListener('click', e=>{
      const add = e.target.closest('[data-sess-tpl-add]');
      if(add){
        const all = BUILTIN_SESS_TPLS.concat(sessTemplates);
        const tpl = all.find(t=> t.id === add.dataset.sessTplAdd);
        if(tpl) addSessionFromTemplate(tpl);
        return;
      }
      const del = e.target.closest('[data-sess-tpl-del]');
      if(!del) return;
      const tpl = sessTemplates.find(t=> t.id === del.dataset.sessTplDel);
      if(!tpl) return;
      uiConfirm('Удалить шаблон «'+tpl.name+'»?').then(ok=>{
        if(!ok) return;
        sessTemplates = sessTemplates.filter(t=> t !== tpl);
        persistSessTemplates();
        renderSessTemplates();
      });
    });
  }

  const linksBox = document.getElementById('sessionLinks');
  if(linksBox) linksBox.addEventListener('click', e=>{
    const card = e.target.closest('[data-sess-open-card]');
    if(card){ openLinkedBlock(card.dataset.sessOpenCard); return; }
    if(e.target.closest('[data-sess-link-edit]')) openSessLinks('links');
  });

  const linksModal = document.getElementById('sessLinksModal');
  if(linksModal){
    const closeBtn = document.getElementById('sessLinksClose');
    if(closeBtn) closeBtn.addEventListener('click', closeSessLinks);
    linksModal.addEventListener('click', e=>{ if(e.target === linksModal) closeSessLinks(); });
    const search = document.getElementById('sessLinksSearch');
    if(search) search.addEventListener('input', renderSessLinksList);
    const list = document.getElementById('sessLinksList');
    if(list) list.addEventListener('click', e=>{
      const row = e.target.closest('[data-sess-pick]');
      if(!row) return;
      const b = findBlock(row.dataset.sessPick);
      if(!b) return;
      if(sessLinksMode === 'insert') insertSessionCardLink(b);
      else toggleSessPick(b.id);
    });
  }

  const cardBtn = document.getElementById('sessionCardLink');
  if(cardBtn){
    cardBtn.addEventListener('mousedown', e=>{
      e.preventDefault();
      const sel = window.getSelection();
      if(sel && sel.rangeCount) sessInsertRange = sel.getRangeAt(0).cloneRange();
    });
    cardBtn.addEventListener('click', ()=> openSessLinks('insert'));
  }

  document.addEventListener('click', e=>{
    const a = e.target && e.target.closest ? e.target.closest('#sessionEditor a[data-card-open]') : null;
    if(!a) return;
    e.preventDefault();
    openLinkedBlock(a.getAttribute('data-card-open'));
  });

  document.addEventListener('keydown', e=>{
    if(e.key !== 'Escape') return;
    if(linksModal && !linksModal.hidden){ e.preventDefault(); closeSessLinks(); }
  });

  if(typeof currentTab !== 'undefined' && currentTab === 'sessions' && activeSessionId){
    renderSessionLinks();
  }
})();
