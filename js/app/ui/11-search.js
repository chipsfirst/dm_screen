/* ════════════ Random tables ════════════ */

const tablesModal = document.getElementById('tablesModal');
const tablesSelect = document.getElementById('tablesSelect');
const tablesResult = document.getElementById('tablesResult');
function fillTableSelect(){
  tablesSelect.innerHTML = Object.keys(RANDOM_TABLES).map((k,i)=>`<option value="${i}">${escapeHtml(k)}</option>`).join('');
}
document.getElementById('btnTables').addEventListener('click', ()=>{
  fillTableSelect();
  tablesResult.innerHTML = '<div class="lib-empty">Выберите таблицу и бросьте кость.</div>';
  openModal(tablesModal, document.getElementById('btnTables'));
});
document.getElementById('tablesClose').addEventListener('click', ()=> closeModal(tablesModal));
tablesModal.addEventListener('click', e=>{ if(e.target===tablesModal) closeModal(tablesModal); });
/* Окно горячих клавиш */
(function(){
  const modal = document.getElementById('keysModal');
  const btn = document.getElementById('btnKeys');
  if(!modal) return;
  if(btn) btn.addEventListener('click', ()=> openModal(modal, btn));
  const close = document.getElementById('keysClose');
  if(close) close.addEventListener('click', ()=> closeModal(modal));
  modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(modal); });
  document.addEventListener('keydown', e=>{
    if(e.key!=='?' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t=e.target;
    if(t && (t.tagName==='INPUT'||t.tagName==='TEXTAREA'||t.isContentEditable)) return;
    e.preventDefault(); openModal(modal, btn);
  });
})();
/* Esc закрывает верхнее открытое окно (свои обработчики гасят событие через defaultPrevented) */
window.addEventListener('keydown', e=>{
  if(e.key!=='Escape' || e.defaultPrevented) return;
  const opened = Array.prototype.filter.call(document.querySelectorAll('.modal'), m=> !m.hidden);
  if(!opened.length) return;
  closeModal(opened[opened.length-1]);
});
/* ═══ Глобальный поиск (Ctrl+K / Cmd+K) ═══ */
const goModalRef = document.getElementById('goModal');
const goInput = document.getElementById('goInput');
const goResults = document.getElementById('goResults');
const goClose = document.getElementById('goClose');

function renderGo(qRaw){
  if(!goResults) return;
  const q = normalizeLib(qRaw||'');
  if(!q){ goResults.innerHTML='<div class="lib-empty">Начните вводить: блоки, монстры, заклинания, предметы, правила.</div>'; return; }
  const LIMIT=60, rows=[];
  const hit = t => normalizeLib(t).includes(q);
  const push = r => { if(rows.length<LIMIT) rows.push(r); };
  blocks.forEach(b=>{
    const actsText = (b.mdata && Array.isArray(b.mdata.acts)) ? b.mdata.acts.map(a=>a.text).join(' ') : '';
    if(hit((b.title||'')+' '+(b.text||'')+' '+actsText+' '+Object.values(b.props||{}).join(' ')))
      push({kind:'block',label:b.title||'Блок',meta:TYPE_LABEL[b.type]||'',b});
  });
  (bestAll||[]).forEach(m=>{ if(hit((m.n||'')+' '+(m.en||'')+' '+(m.type||''))) push({kind:'monster',label:(m.n||''),meta:m.type||'',mon:m}); });
  ((LIB&&LIB.spells)||[]).forEach(sp=>{ if(hit((sp.n||'')+' '+(sp.sc||'')+' '+(sp.cls||''))) push({kind:'spell',label:sp.n,meta:(sp.l!==undefined?('Ур.'+sp.l+' · '):'')+(sp.sc||''),sp}); });
  ((LIB&&LIB.items)||[]).forEach(it=>{ if(hit(it.n||'')) push({kind:'item',label:it.n,meta:it.t||'',it}); });
  RULES_FOR_LIB.forEach(r=>{ if(hit((r.title||'')+' '+(r.text||''))) push({kind:'rule',label:r.title,meta:'Правила',rule:r}); });
  if(!rows.length){ goResults.innerHTML='<div class="lib-empty">Ничего не найдено.</div>'; return; }
  const badge={block:'Блок',monster:'Монстр',spell:'Закл.',item:'Предм.',rule:'Прав.'};
  goResults.innerHTML = rows.map((r,i)=>`<div class="lib-row go-row" data-go="${i}">
    <span class="lib-kind">${badge[r.kind]||''}</span>
    <div class="lib-main"><div class="lib-title">${escapeHtml(r.label)}</div>${r.meta?`<div class="lib-meta">${escapeHtml(r.meta)}</div>`:''}</div>
  </div>`).join('');
  goResults.querySelectorAll('[data-go]').forEach(el=> el.addEventListener('click', ()=>{
    const r=rows[+el.dataset.go]; if(!r) return;
    runGoAction(r); closeModal(goModalRef);
  }));
}
function runGoAction(r){
  if(r.kind==='block'){
    const b=r.b;
    searchFilter = b.title||'';
    const s=document.getElementById('search'); if(s) s.value=searchFilter;
    showTab(b.type==='mob'?'monsters':'chars');
    toast('Найдено на ширме: '+(b.title||'блок'));
  } else if(r.kind==='monster'){ addMonsterBlock(r.mon); toast('Монстр добавлен на ширму'); }
  else if(r.kind==='spell'){ addSpellBlock(r.sp); toast('Заклинание добавлено на ширму'); }
  else if(r.kind==='item'){ addItemBlock(r.it); toast('Предмет добавлен на ширму'); }
  else if(r.kind==='rule'){ addRuleBlock(r.rule); toast('Правило добавлено на ширму'); }
}
function openGo(){
  if(!goModalRef) return;
  openModal(goModalRef, document.activeElement);
  if(goInput){ goInput.value=''; goInput.focus(); }
  renderGo('');
  ensureBestiary().then(()=>{ if(!bestAll.length) bestAll=(window.BESTIARY||[]).slice(); renderGo(goInput?goInput.value:''); }).catch(()=>{});
  ensureLibrary().then(()=> renderGo(goInput?goInput.value:'')).catch(()=>{});
}
if(goClose) goClose.addEventListener('click', ()=> closeModal(goModalRef));
if(goInput){
  const renderGoDebounced = debounce(()=> renderGo(goInput.value), 140);
  goInput.addEventListener('input', renderGoDebounced);
  goInput.addEventListener('keydown', e=>{
    if(e.key==='Enter' && goResults){ const first=goResults.querySelector('[data-go]'); if(first) first.click(); }
  });
}
window.addEventListener('keydown', e=>{
  if((e.ctrlKey||e.metaKey) && !e.shiftKey && e.key.toLowerCase()==='k'){ e.preventDefault(); openGo(); }
});
document.getElementById('tablesRoll').addEventListener('click', ()=>{
  const key = Object.keys(RANDOM_TABLES)[+tablesSelect.value];
  const list = RANDOM_TABLES[key];
  const roll = 1 + Math.floor(Math.random()*list.length);
  const val = list[roll-1];
  tablesResult.innerHTML = `<div class="lib-row"><span class="lib-kind k-rule">d${list.length}</span>
    <div class="lib-main">
      <div class="lib-meta">${escapeHtml(key)} · бросок: ${roll}</div>
      <div class="lib-title" style="margin-top:6px; font-size:15px">${escapeHtml(val)}</div>
    </div></div>`;
});

