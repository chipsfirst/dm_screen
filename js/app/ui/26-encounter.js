/* Сборщик встречи: выбор монстров из бестиария и добавление в бой. */
(function(){
  const modal = document.getElementById('encounterModal');
  const btn = document.getElementById('battleEncounter');
  if(!modal || !btn) return;
  const search = document.getElementById('encounterSearch');
  const crSel = document.getElementById('encounterCr');
  const listEl = document.getElementById('encounterList');
  const pickedEl = document.getElementById('encounterPicked');
  const totalEl = document.getElementById('encounterTotal');
  const hint = document.getElementById('encounterHint');
  const addBtn = document.getElementById('encounterToBattle');
  let all = [];
  let selected = new Map();
  let loaded = false;
  const XP = {1:[25,50,75,100],2:[50,100,150,200],3:[75,150,225,400],4:[125,250,375,500],5:[250,500,750,1100],6:[300,600,900,1400],7:[350,750,1100,1700],8:[450,900,1400,2100],9:[550,1100,1600,2400],10:[600,1200,1900,2800],11:[800,1600,2400,3600],12:[1000,2000,3000,4500],13:[1100,2200,3400,5100],14:[1250,2500,3800,5700],15:[1400,2800,4300,6400],16:[1600,3200,4800,7200],17:[2000,3900,5900,8800],18:[2100,4200,6300,9500],19:[2400,4900,7300,10900],20:[2800,5700,8500,12700]};
  const DIFF = {easy:0,medium:1,hard:2,deadly:3};
  const pick = a => a[Math.floor(Math.random()*a.length)];
  function partyLevel(){ return Math.max(1, Math.min(20, +document.getElementById('encLevel').value || 5)); }
  function partySize(){ return Math.max(1, Math.min(8, +document.getElementById('encSize').value || 4)); }
  function budget(){
    const diff = document.getElementById('encDiff').value || 'medium';
    return XP[partyLevel()][DIFF[diff]] * partySize();
  }
  function updateBudget(){
    const el = document.getElementById('encBudget');
    if(el) el.textContent = `Бюджет: ${budget()} XP`;
  }
  function fillParty(){
    const lvl = document.getElementById('encLevel');
    const size = document.getElementById('encSize');
    if(lvl && !lvl.options.length) lvl.innerHTML = Array.from({length:20},(_,i)=>`<option value="${i+1}"${i+1===5?' selected':''}>${i+1}</option>`).join('');
    if(size && !size.options.length) size.innerHTML = Array.from({length:8},(_,i)=>`<option value="${i+1}"${i+1===4?' selected':''}>${i+1}</option>`).join('');
    updateBudget();
  }

  function crNum(s){
    const raw = String(s || '').trim().split(/[\s(]/)[0];
    if(!raw) return 0;
    if(raw.includes('/')){
      const p = raw.split('/').map(Number);
      return p[1] ? p[0] / p[1] : 0;
    }
    return Number(raw) || 0;
  }
  function xpNum(s){
    const m = String(s || '').match(/опыт\s*([\d\s]+)/i);
    return m ? Number(m[1].replace(/\s/g, '')) || 0 : 0;
  }
  function matchesCr(cr){
    const v = crNum(cr);
    if(crSel.value === 'all') return true;
    if(crSel.value === '0') return v === 0;
    if(crSel.value === '1/8' || crSel.value === '1/4' || crSel.value === '1/2') return Math.abs(v - crNum(crSel.value)) < 0.001;
    if(crSel.value === '1-4') return v >= 1 && v <= 4;
    if(crSel.value === '5-10') return v >= 5 && v <= 10;
    return v >= 11;
  }
  function filtered(){
    const q = String(search.value || '').trim().toLowerCase();
    return all.filter(m => {
      if(!matchesCr(m.cr)) return false;
      if(!q) return true;
      return ((m.n || '') + ' ' + (m.en || '') + ' ' + (m.type || '') + ' ' + (m.cr || '')).toLowerCase().includes(q);
    }).slice(0, 120);
  }
  function renderList(){
    const rows = filtered();
    if(!rows.length){
      listEl.innerHTML = '<div class="lib-empty">Ничего не найдено.</div>';
      return;
    }
    listEl.innerHTML = rows.map((m, i) => `<button type="button" class="encounter-row" data-enc-i="${i}">
      <b>${escapeHtml(m.n || 'Без имени')}</b><em>CR ${escapeHtml(String(m.cr || '').split(' ')[0])}</em>
      <small>${escapeHtml(m.type || '')} · ${xpNum(m.cr) || '—'} XP</small>
    </button>`).join('');
  }
  function renderPicked(){
    if(!selected.size){
      pickedEl.innerHTML = '<div class="lib-empty">Добавьте монстров из списка.</div>';
      totalEl.textContent = 'Встреча пуста';
      addBtn.disabled = true;
      return;
    }
    let count = 0, xp = 0;
    pickedEl.innerHTML = Array.from(selected.entries()).map(([name, it]) => {
      count += it.count;
      xp += (xpNum(it.m.cr) || 0) * it.count;
      return `<div class="encounter-pick"><b>${escapeHtml(name)}</b>
        <div class="encounter-pick-ctl">
          <button type="button" data-pick-dec="${escapeHtml(name)}">−</button>
          <span>${it.count}</span>
          <button type="button" data-pick-inc="${escapeHtml(name)}">＋</button>
          <button type="button" data-pick-del="${escapeHtml(name)}" title="Убрать">✕</button>
        </div></div>`;
    }).join('');
    totalEl.textContent = `Существ: ${count} · ${xp} XP · бюджет ${budget()} XP`;
    addBtn.disabled = false;
  }
  function autoPick(){
    const pool = filtered();
    if(!pool.length){ hint.textContent = 'Под фильтр не подошёл ни один монстр.'; return; }
    selected = new Map();
    let sum = 0, guard = 0;
    const target = budget();
    while(sum < target * 0.8 && guard < 40){
      const affordable = pool.filter(m => (xpNum(m.cr) || 0) <= target - sum);
      const m = pick(affordable.length ? affordable : pool);
      if(!m) break;
      const key = m.n || 'Монстр';
      const it = selected.get(key) || { m, count: 0 };
      it.count++;
      selected.set(key, it);
      sum += xpNum(m.cr) || 0;
      guard++;
    }
    renderPicked();
    hint.textContent = 'Подобрано по бюджету; проверьте состав перед боем.';
  }
  function render(){ renderList(); renderPicked(); }
  function load(){
    if(loaded) return;
    loaded = true;
    if(typeof ensureBestiary === 'function'){
      ensureBestiary().then(() => { all = (window.BESTIARY || []).slice(); render(); })
        .catch(() => { hint.textContent = 'Не удалось загрузить бестиарий.'; });
    } else {
      all = (window.BESTIARY || []).slice();
      render();
    }
  }
  function open(){
    fillParty();
    selected = new Map();
    search.value = '';
    crSel.value = 'all';
    hint.textContent = 'Выберите монстров — они добавятся в трекер боя.';
    if(all.length) render(); else { listEl.innerHTML = '<div class="lib-empty">Загрузка бестиария…</div>'; load(); }
    openModal(modal, btn);
    setTimeout(() => search.focus(), 40);
  }

  btn.addEventListener('click', open);
  document.getElementById('encounterClose')?.addEventListener('click', () => closeModal(modal));
  modal.addEventListener('click', e => { if(e.target === modal) closeModal(modal); });
  search.addEventListener('input', renderList);
  crSel.addEventListener('change', renderList);
  ['encLevel','encSize','encDiff'].forEach(id => document.getElementById(id)?.addEventListener('change', updateBudget));
  document.getElementById('encAuto')?.addEventListener('click', autoPick);
  listEl.addEventListener('click', e => {
    const row = e.target.closest('[data-enc-i]');
    if(!row) return;
    const m = filtered()[+row.dataset.encI];
    if(!m) return;
    const key = m.n || 'Монстр';
    const cur = selected.get(key) || { m, count: 0 };
    cur.count++;
    selected.set(key, cur);
    renderPicked();
  });
  pickedEl.addEventListener('click', e => {
    const inc = e.target.closest('[data-pick-inc]');
    const dec = e.target.closest('[data-pick-dec]');
    const del = e.target.closest('[data-pick-del]');
    if(inc){ const it = selected.get(inc.dataset.pickInc); if(it) it.count++; }
    if(dec){ const it = selected.get(dec.dataset.pickDec); if(it){ it.count--; if(it.count <= 0) selected.delete(dec.dataset.pickDec); } }
    if(del){ selected.delete(del.dataset.pickDel); }
    renderPicked();
  });
  addBtn.addEventListener('click', () => {
    if(!selected.size) return;
    if(typeof battleParts === 'undefined' || typeof saveBattle !== 'function'){ hint.textContent = 'Трекер боя недоступен.'; return; }
    let added = 0;
    selected.forEach(({ m, count }) => {
      for(let i = 0; i < count; i++){
        const hp = (typeof numField === 'function') ? numField(m.hp) : (parseInt(m.hp, 10) || 0);
        battleParts.push({
          srcId: '', id: (typeof uniq === 'function' ? uniq() : 'b' + Date.now() + Math.random()),
          name: count > 1 ? `${m.n} ${i + 1}` : m.n, side: 'opp',
          ac: (typeof numField === 'function') ? numField(m.ac) : (parseInt(m.ac, 10) || 0),
          hp, hpMax: hp,
          init: (typeof numField === 'function') ? numField(m.init) : (parseInt(m.init, 10) || 0),
          atk: '', acts: (m.acts || []).map(a => ({ tag: a.tag || '', text: a.text || '' })),
          applied: [], statuses: [], statusTurns: {}
        });
        added++;
      }
    });
    saveBattle();
    if(typeof renderBattle === 'function') renderBattle();
    closeModal(modal);
    if(typeof showTab === 'function') showTab('battle');
    toast(`Встреча добавлена: ${added}`);
  });
})();
