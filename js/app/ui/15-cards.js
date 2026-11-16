/* ═══ Связи карточек и шаблоны ═══ */

/* ── Переход к связанной карточке ── */
function openLinkedBlock(id){
  const b = findBlock(id);
  if(!b){ toast('Карточка не найдена'); return; }
  const wantMonsters = b.type === 'mob';
  if(searchFilter){ searchFilter=''; const s=document.getElementById('search'); if(s) s.value=''; }
  if(typeof canvasQuery !== 'undefined' && canvasQuery){
    canvasQuery=''; const f=document.getElementById('canvasFilter'); if(f) f.value='';
  }
  activeParentId = null;
  collapsed.delete(b.id);
  const onBlocks = (typeof currentTab !== 'undefined' && (currentTab === 'chars' || currentTab === 'monsters'));
  if(!onBlocks || wantMonsters !== (blocksTab==='monsters')) showTab(wantMonsters ? 'monsters' : 'chars');
  else render();
  setTimeout(()=>{
    const el = document.querySelector('#canvas [data-id="'+b.id+'"]');
    if(!el) return;
    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.classList.add('flash');
    setTimeout(()=> el.classList.remove('flash'), 1600);
  }, 60);
}

/* ── Диалог выбора связей ── */
let linksEditId = null, linksPick = null, linksDirty = false;

function linksCandidates(){
  return blocks.filter(b=> b.id !== linksEditId).slice().sort((a,c)=>{
    const ta=TYPE_LABEL[a.type]||'', tc=TYPE_LABEL[c.type]||'';
    if(ta!==tc) return ta.localeCompare(tc,'ru');
    return String(a.title||'').localeCompare(String(c.title||''),'ru');
  });
}
function renderLinksList(){
  const list = document.getElementById('linksList'); if(!list) return;
  const search = document.getElementById('linksSearch');
  const q = (search ? search.value : '').trim().toLowerCase();
  const items = linksCandidates().filter(b=> !q || String(b.title||'').toLowerCase().includes(q));
  if(!items.length){
    list.innerHTML = '<div class="lib-empty">'+(q ? 'Ничего не найдено.' : 'Других карточек нет — создайте их на ширме.')+'</div>';
    return;
  }
  let html='', lastType=null;
  items.forEach(b=>{
    if(b.type!==lastType){
      lastType=b.type;
      html += `<div class="lx-group">${escapeHtml(TYPE_LABEL[lastType]||lastType)}</div>`;
    }
    const on = linksPick.has(b.id);
    html += `<button type="button" class="lx-row${on?' on':''}" data-link-pick="${b.id}" aria-pressed="${on?'true':'false'}">
      <span class="lx-check">${on?'✓':''}</span>
      <span class="lx-main"><span class="lx-title">${escapeHtml(b.title||'(без названия)')}</span>
      <span class="lx-meta">${escapeHtml(blockSummary(b)||'')}</span></span>
    </button>`;
  });
  list.innerHTML = html;
}
function useBlockLinks(b, ids){
  const keep = new Set(ids);
  b.links = ids.slice();
  blocks.forEach(o=>{
    if(o.id===b.id) return;
    const was = Array.isArray(o.links) ? o.links : [];
    const next = was.filter(v=> v!==b.id && !(v===b.title && linkTarget(v)===b));
    if(keep.has(o.id)) next.push(b.id);
    if(next.length!==was.length || keep.has(o.id)) o.links = next;
  });
  save();
}
function toggleLinkPick(id){
  if(!linksPick || !linksEditId) return;
  if(linksPick.has(id)) linksPick.delete(id); else linksPick.add(id);
  linksDirty = true;
  const b = findBlock(linksEditId);
  if(b) useBlockLinks(b, [...linksPick]);
  renderLinksList();
}
function openLinksDialog(id){
  const b = findBlock(id); if(!b) return;
  linksEditId = id;
  linksPick = new Set();
  linksDirty = false;
  linkedBlocksOf(b).forEach(t=> linksPick.add(t.id));
  const title = document.getElementById('linksTitle');
  if(title) title.textContent = 'Связи: ' + (b.title || 'карточка');
  const search = document.getElementById('linksSearch');
  if(search) search.value='';
  renderLinksList();
  const m = document.getElementById('linksModal');
  if(m) openModal(m, document.activeElement);
}
function closeLinksDialog(){
  const m = document.getElementById('linksModal');
  if(m && !m.hidden) closeModal(m);
  if(linksDirty){ linksDirty=false; render(); }
  linksEditId = null; linksPick = null;
}

/* ── Шаблоны карточек ── */
const TPL_KEY = 'shirma_templates_v1';
let blockTemplates = [];
try{
  const raw = JSON.parse(localStorage.getItem(TPL_KEY) || '[]');
  if(Array.isArray(raw)) blockTemplates = raw.filter(t=> t && typeof t==='object' && t.type);
}catch(e){}
function persistTemplates(){
  try{ localStorage.setItem(TPL_KEY, JSON.stringify(blockTemplates)); }
  catch(e){ toast('Шаблоны не сохранились: хранилище переполнено'); }
}
function tplSummary(t){
  const p = t.props || {};
  const keys = t.type==='mob' ? ['ОП','КД','ХП'] : (t.type==='pc' ? ['Класс','Раса','Броня КК'] : []);
  return keys.map(k=> (p[k]!=null && String(p[k]).trim()!=='') ? k+': '+p[k] : '').filter(Boolean).join(' · ');
}
function saveBlockAsTemplate(b){
  if(!b) return;
  uiPrompt('Название шаблона:', b.title || TYPE_LABEL[b.type] || 'Шаблон', {title:'Сохранить как шаблон'}).then(name=>{
    if(name===null || name===undefined) return;
    name = String(name).trim().slice(0,80);
    if(!name) return;
    const tpl = {
      id: 't'+Math.random().toString(36).slice(2,9),
      name, type: b.type,
      props: Object.assign({}, b.props||{}),
      stats: (Array.isArray(b.stats)? b.stats : [10,10,10,10,10,10]).slice(0,6),
      res: (b.res||[]).map(r=>({ name:String(r.name||'').slice(0,40), cur:+r.cur||0, max:+r.max||0 })),
      attack: String(b.attack||'').slice(0,20),
      damage: String(b.damage||'').slice(0,40),
      mdata: b.mdata ? JSON.parse(JSON.stringify(b.mdata)) : null,
      text: String(b.text||'').slice(0,5000),
      w: Math.max(200, Math.min(1600, +b.w||820)),
      created: Date.now()
    };
    const i = blockTemplates.findIndex(t=> t.name===tpl.name && t.type===tpl.type);
    if(i>=0) blockTemplates[i]=tpl; else blockTemplates.push(tpl);
    while(blockTemplates.length>60) blockTemplates.shift();
    persistTemplates();
    toast('Шаблон «'+name+'» сохранён');
    const m = document.getElementById('tplModal');
    if(m && !m.hidden) renderTemplates();
  });
}
function addFromTemplate(tplId){
  const t = blockTemplates.find(x=> x.id===tplId); if(!t) return;
  const b = makeBlock(t.type, t.name || TYPE_LABEL[t.type] || 'Карточка');
  Object.assign(b, freeCascadePos());
  b.props = Object.assign({}, t.props||{});
  if(Array.isArray(t.stats) && t.stats.length===6) b.stats = t.stats.slice();
  b.res = (t.res||[]).map(r=>({ name:r.name, cur:r.cur, max:r.max }));
  b.attack = t.attack || '';
  b.damage = t.damage || '';
  if(t.mdata) b.mdata = JSON.parse(JSON.stringify(t.mdata));
  b.text = t.text || '';
  b.w = t.w || b.w;
  blocks.push(b);
  const mon = b.type==='mob';
  if(mon !== (blocksTab==='monsters')) showTab(mon ? 'monsters' : 'chars'); else render();
  save();
  const m = document.getElementById('tplModal'); if(m) closeModal(m);
  setTimeout(()=>{
    const el = document.querySelector('#canvas [data-id="'+b.id+'"]');
    if(!el) return;
    el.scrollIntoView({behavior:'smooth', block:'center'});
    el.classList.add('flash');
    setTimeout(()=> el.classList.remove('flash'), 1600);
  }, 60);
  toast('Карточка из шаблона «'+t.name+'»');
}
function renderTemplates(){
  const list = document.getElementById('tplList'); if(!list) return;
  const search = document.getElementById('tplSearch');
  const q = (search ? search.value : '').trim().toLowerCase();
  const items = blockTemplates
    .filter(t=> !q || String(t.name||'').toLowerCase().includes(q))
    .slice().sort((a,c)=> (c.created||0)-(a.created||0));
  if(!items.length){
    list.innerHTML = '<div class="lib-empty">'+(q ? 'Ничего не найдено.' : 'Шаблонов пока нет. Откройте карточку и нажмите «В шаблон» в её подвале — заготовка появится здесь.')+'</div>';
    return;
  }
  list.innerHTML = items.map(t=>`<div class="lib-row tpl-row">
      <span class="lib-kind">${escapeHtml(TYPE_LABEL[t.type]||t.type)}</span>
      <div class="lib-main"><div class="lib-title">${escapeHtml(t.name||'')}</div><div class="lib-meta">${escapeHtml(tplSummary(t)||'Шаблон карточки')}</div></div>
      <button type="button" class="tpl-add" data-tpl-add="${t.id}" title="Создать карточку по шаблону" aria-label="Добавить карточку по шаблону">＋</button>
      <button type="button" class="tpl-del" data-tpl-del="${t.id}" title="Удалить шаблон" aria-label="Удалить шаблон">✕</button>
    </div>`).join('');
}

/* ── Обработчики диалогов ── */
(function initCardsExtras(){
  const linksModal = document.getElementById('linksModal');
  if(linksModal){
    const close = document.getElementById('linksClose');
    if(close) close.addEventListener('click', closeLinksDialog);
    linksModal.addEventListener('click', e=>{ if(e.target===linksModal) closeLinksDialog(); });
    const s = document.getElementById('linksSearch');
    if(s) s.addEventListener('input', renderLinksList);
    const list = document.getElementById('linksList');
    if(list) list.addEventListener('click', e=>{
      const row = e.target.closest('[data-link-pick]'); if(!row) return;
      toggleLinkPick(row.dataset.linkPick);
    });
  }
  document.addEventListener('keydown', e=>{
    if(e.key!=='Escape' || !linksModal || linksModal.hidden) return;
    e.preventDefault();
    closeLinksDialog();
  });

  const tplModal = document.getElementById('tplModal');
  if(tplModal){
    const close = document.getElementById('tplClose');
    if(close) close.addEventListener('click', ()=> closeModal(tplModal));
    tplModal.addEventListener('click', e=>{ if(e.target===tplModal) closeModal(tplModal); });
    const s = document.getElementById('tplSearch');
    if(s) s.addEventListener('input', renderTemplates);
    const list = document.getElementById('tplList');
    if(list) list.addEventListener('click', e=>{
      const add = e.target.closest('[data-tpl-add]');
      if(add){ addFromTemplate(add.dataset.tplAdd); return; }
      const del = e.target.closest('[data-tpl-del]');
      if(!del) return;
      const t = blockTemplates.find(x=> x.id===del.dataset.tplDel); if(!t) return;
      uiConfirm('Удалить шаблон «'+t.name+'»?').then(ok=>{
        if(!ok) return;
        blockTemplates = blockTemplates.filter(x=> x!==t);
        persistTemplates();
        renderTemplates();
      });
    });
  }
  const openBtn = document.getElementById('tplOpenTop');
  if(openBtn) openBtn.addEventListener('click', ()=>{
    renderTemplates();
    const m = document.getElementById('tplModal');
    if(m) openModal(m, openBtn);
  });
})();
