/* Справочник мастера: выдвижная панель, поиск и избранное. */
(function(){
  const panel = document.getElementById('rulesPanel');
  if(!panel) return;

  const data = Array.isArray(window.RULES_DATA) ? window.RULES_DATA : [];
  const categories = Array.isArray(window.RULES_CATEGORIES) ? window.RULES_CATEGORIES : [];
  const favKey = 'shirma_rules_fav_v1';
  const byId = new Map(data.map(r => [r.id, r]));
  const catById = new Map(categories.map(c => [c.id, c]));
  const $ = id => document.getElementById(id);
  const search = $('refSearch');
  const catsEl = $('refCats');
  const listEl = $('refList');
  const countEl = $('refCount');
  let cat = 'all';
  let query = '';
  let favs = new Set();

  try {
    const saved = JSON.parse(localStorage.getItem(favKey) || '[]');
    if(Array.isArray(saved)) favs = new Set(saved.filter(id => byId.has(id)));
  } catch(e) {}

  function norm(s){
    return String(s || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
  }
  function catLabel(id){
    const c = catById.get(id);
    return c ? c.label : 'Правила';
  }
  function saveFavs(){
    try { localStorage.setItem(favKey, JSON.stringify(Array.from(favs))); } catch(e) {}
  }
  function plural(n){
    const n10 = n % 10, n100 = n % 100;
    if(n10 === 1 && n100 !== 11) return n + ' статья';
    if(n10 >= 2 && n10 <= 4 && (n100 < 12 || n100 > 14)) return n + ' статьи';
    return n + ' статей';
  }

  function filtered(){
    let list = data;
    if(cat === 'fav') list = list.filter(r => favs.has(r.id));
    else if(cat !== 'all') list = list.filter(r => r.cat === cat);
    if(query){
      const q = norm(query);
      list = list.filter(r => norm([
        r.title, r.short, r.body, r.tags, catLabel(r.cat)
      ].join(' ')).includes(q));
    }
    return list;
  }

  function renderCats(){
    const items = [
      { id:'all', label:'Все' },
      { id:'fav', label:'Избранное' },
      ...categories
    ];
    catsEl.innerHTML = items.map(c => {
      const active = c.id === cat ? ' active' : '';
      const count = c.id === 'all' ? data.length
        : c.id === 'fav' ? favs.size
        : data.filter(r => r.cat === c.id).length;
      return `<button type="button" class="ref-cat${active}" data-ref-cat="${c.id}" aria-pressed="${c.id === cat}">${escapeHtml(c.label)}<span class="ref-cat-count">${count}</span></button>`;
    }).join('');
  }

  function progressHtml(r){
    if(r.cat !== 'classes') return '';
    const key = r.id.replace(/^class-/, '');
    const p = window.CLASS_PROGRESS && window.CLASS_PROGRESS[key];
    if(!p) return '';
    const rows = Object.entries(p.features || {}).filter(([lvl]) => Number(lvl) >= 6);
    const sub = p.subclass;
    return `<div class="ref-progress">
      <div class="ref-progress-title">Уровни 6–20</div>
      <div class="ref-levels">${rows.map(([lvl, text]) => `<span class="ref-lvl">${escapeHtml(lvl)}</span><span>${escapeHtml(text)}</span>`).join('')}</div>
      ${sub ? `<div class="ref-subclass"><b>${escapeHtml(sub.name_ru || sub.name)}</b>${sub.name_ru ? ` <span class="ref-sub-en">${escapeHtml(sub.name)}</span>` : ''}
        <div class="ref-sub-levels">${Object.entries(sub.features || {}).map(([lvl, text]) => `${escapeHtml(lvl)} — ${escapeHtml(text)}`).join(' · ')}</div></div>` : ''}
    </div>`;
  }

  function card(r, open){
    const isFav = favs.has(r.id);
    return `<details class="ref-card" data-ref-id="${escapeHtml(r.id)}"${open ? ' open' : ''}>
      <summary>
        <span class="ref-card-title">${escapeHtml(r.title)}</span>
        <span class="ref-card-cat">${escapeHtml(catLabel(r.cat))}</span>
        <span class="ref-card-short">${escapeHtml(r.short || '')}</span>
        <span class="ref-card-arrow" aria-hidden="true">▾</span>
      </summary>
      <div class="ref-card-body">
        <div class="ref-full">${escapeHtml(r.body || r.short || '')}</div>
        ${progressHtml(r)}
        <div class="ref-card-actions">
          <button type="button" class="ref-add" data-ref-add="${escapeHtml(r.id)}">＋ На ширму</button>
          <button type="button" class="ref-fav${isFav ? ' on' : ''}" data-ref-fav="${escapeHtml(r.id)}" aria-pressed="${isFav}">${isFav ? '★ В избранном' : '☆ В избранное'}</button>
        </div>
      </div>
    </details>`;
  }

  function renderList(){
    const list = filtered();
    if(countEl) countEl.textContent = list.length === data.length ? plural(data.length) : `${list.length} из ${data.length}`;
    if(!list.length){
      listEl.innerHTML = `<div class="ref-empty">Ничего не найдено. Попробуйте «укрытие», «концентрация» или «воин».</div>`;
      return;
    }
    listEl.innerHTML = list.map(r => card(r, !!query)).join('');
  }

  function render(){
    renderCats();
    renderList();
  }

  function openPanel(target){
    if(target && target !== 'all'){
      if(catById.has(target)) cat = target;
      else if(byId.has(target)) cat = 'all';
    } else if(target === 'all'){
      cat = 'all';
    }
    query = '';
    if(search) search.value = '';
    render();
    if(panel.hidden) openModal(panel, document.getElementById('btnRules'));
    setTimeout(() => { if(search) search.focus(); }, 30);
    if(target && byId.has(target)){
      requestAnimationFrame(() => {
        const el = listEl.querySelector(`[data-ref-id="${target}"]`);
        if(!el) return;
        el.open = true;
        el.scrollIntoView({block:'center'});
      });
    }
  }

  $('refClose')?.addEventListener('click', () => closeModal(panel));
  panel.addEventListener('click', e => { if(e.target === panel) closeModal(panel); });
  document.getElementById('btnRules')?.addEventListener('click', () => openPanel('all'));

  catsEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-ref-cat]');
    if(!btn) return;
    cat = btn.getAttribute('data-ref-cat') || 'all';
    render();
  });

  search?.addEventListener('input', e => {
    query = e.target.value;
    renderList();
  });

  listEl.addEventListener('click', e => {
    const add = e.target.closest('[data-ref-add]');
    if(add){
      const rule = byId.get(add.getAttribute('data-ref-add'));
      if(rule){
        addRuleBlock({ title: rule.title, text: rule.body || rule.short || '' });
        add.textContent = '✓ На ширме';
        add.disabled = true;
        toast('Правило добавлено на ширму');
      }
      return;
    }
    const fav = e.target.closest('[data-ref-fav]');
    if(fav){
      const id = fav.getAttribute('data-ref-fav');
      if(!id) return;
      if(favs.has(id)) favs.delete(id); else favs.add(id);
      saveFavs();
      render();
      return;
    }
  });

  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-ref-open]');
    if(!trigger) return;
    e.preventDefault();
    openPanel(trigger.getAttribute('data-ref-open'));
  });

  document.addEventListener('keydown', e => {
    if(!e.altKey || e.ctrlKey || e.metaKey) return;
    if(String(e.key).toLowerCase() !== 'r') return;
    e.preventDefault();
    if(panel.hidden) openPanel('all'); else closeModal(panel);
  });

  function renderHomeCheat(){
    const el = document.getElementById('homeCheatList');
    if(!el) return;
    const quickIds = ['checks', 'advantage', 'cover', 'death', 'concentration'];
    el.innerHTML = quickIds.map(id => {
      const r = byId.get(id);
      if(!r) return '';
      return `<button type="button" class="home-cheat-row" data-ref-open="${escapeHtml(r.id)}">
        <span class="hc-q">${escapeHtml(r.title)}</span>
        <span class="hc-a">${escapeHtml(r.short || '')}</span>
      </button>`;
    }).join('');
  }

  renderHomeCheat();
  window.openRulesPanel = openPanel;
})();
