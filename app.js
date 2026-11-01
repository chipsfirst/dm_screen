
/* ════════════ Mодель данных ════════════ */
const TYPES = { pc:'pc', rule:'rule', note:'note' };
const TYPE_LABEL = { pc:'ПК', mob:'Монстр', rule:'Правила', note:'Заметка', img:'Файл' };

let blocks = [];
let activeParentId = null;   // какой блок сейчас "раскрыт" как коллекция (null = корень)
let collapsed = new Set();   // id блоков, свёрнутых на дашборде
let searchFilter = '';
let freeLayout = false;      // свободный холст (drag-n-drop) или лента

const ITEMS_FOR_9 = ['Сила','Ловк','Телосл','Интел','Мудр','Хар'];

const STORE_KEY = 'shirma_blocks_v1';

/* ═══ IndexedDB для медиа (картинки/документы/фоны) ═══ */
const MEDIA_DB = 'shirma_media_v1';
const MEDIA_STORE = 'media';
const mediaCache = {}; // key -> dataURL (в памяти)
let mediaDBPromise = null;
function openMediaDB(){
  if(mediaDBPromise) return mediaDBPromise;
  mediaDBPromise = new Promise((resolve)=>{
    try{
      const req = indexedDB.open(MEDIA_DB, 1);
      req.onupgradeneeded = ()=>{ const db=req.result; if(!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE); };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = ()=> resolve(null);
    }catch(e){ resolve(null); }
  });
  return mediaDBPromise;
}
function idbPut(key, val){
  openMediaDB().then(db=>{ if(!db) return; try{ const tx=db.transaction(MEDIA_STORE,'readwrite'); tx.objectStore(MEDIA_STORE).put(val, key); }catch(e){} });
}
function idbDel(key){
  openMediaDB().then(db=>{ if(!db) return; try{ const tx=db.transaction(MEDIA_STORE,'readwrite'); tx.objectStore(MEDIA_STORE).delete(key); }catch(e){} });
}
function loadAllMedia(){
  return openMediaDB().then(db=> new Promise(resolve=>{
    if(!db){ resolve(); return; }
    try{
      const tx=db.transaction(MEDIA_STORE,'readonly');
      const store=tx.objectStore(MEDIA_STORE);
      const req=store.openCursor();
      req.onsuccess=(e)=>{ const cur=e.target.result; if(cur){ mediaCache[cur.key]=cur.value; cur.continue(); } else resolve(); };
      req.onerror=()=>resolve();
    }catch(e){ resolve(); }
  }));
}
function mediaFor(b){ return (b.dataKey && mediaCache[b.dataKey]) || b.data || ''; }

/* Общий механизм перетаскивания: onMove(clientEvent), onEnd() */
function pointerDrag(e, onMove, onEnd){
  if(e) e.preventDefault();
  function move(ev){ onMove(ev); }
  function up(){
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    if(typeof onEnd==='function') onEnd();
  }
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

function load(){
  try{
    const raw = localStorage.getItem(STORE_KEY);
    if(raw){ blocks = JSON.parse(raw); return true; }
  }catch(e){}
  return false;
}
function makeBlock(type,title,extra){
  return Object.assign({ id:uniq(), type, title, collapse:false, links:[], stats:[10,10,10,10,10,10], props:{}, text:'', x:null, y:null, w:360, uid:Date.now().toString(36)+Math.random().toString(36).slice(2,7) }, extra||{});
}
function uniq(){ return 'b'+Math.random().toString(36).slice(2,9); }
function debounce(fn, ms){
  let t;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=>fn.apply(this, args), ms);
  };
}
function persistBlocks(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(blocks)); }catch(e){ console.warn('Не удалось сохранить блоки:', e); }
}
const persistBlocksDebounced = debounce(persistBlocks, 250);
function save(){
  document.getElementById('blockCount').textContent = blocks.length;
  persistBlocksDebounced();
}
window.addEventListener('beforeunload', persistBlocks);
window.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') persistBlocks(); });
function findBlock(id){ return blocks.find(b=>b.id===id); }

function seed(){
  blocks = SAMPLES.map(s=>makeBlock(s.type,s.title,{title:s.title, links:s.links, stats:s.stats||[10,10,10,10,10,10], props:s.props||{}, text:s.text||''}));
  collapsed = new Set(); blocks.forEach(b=>collapsed.add(b.id));
  save(); render();
}

/* ════════════ Render: sidebar tree ════════════ */
function renderTree(){
  const tree = document.getElementById('tree');
  let html='';
  const inTab = b => blocksTab==='monsters' ? b.type==='mob' : b.type!=='mob';
  const scoped = blocks.filter(inTab);
  if(searchFilter){
    scoped.filter(matches).forEach(b=>{ html+=treeNode(b); });
  } else {
    html+=`<div class="node ${activeParentId===null?'active':''}" data-root="1">
      <span class="ic">▦</span><span class="tt">${blocksTab==='monsters'?'Все монстры':'Все блоки'}</span></div>`;
    scoped.forEach(b=>{ html+=treeNode(b); });
  }
  tree.innerHTML = html;
  tree.querySelectorAll('.node').forEach(n=>{
    n.addEventListener('click', e=>{
      if(n.dataset.root){ activeParentId=null; render(); return; }
      const id = n.dataset.parent;
      toggleBlock(id);
    });
  });
}
function treeNode(b){
  const name = escapeHtml(b.title||'(без названия)');
  const cls = activeParentId===b.id ? 'active':'' ;
  const col = collapsed.has(b.id) ? 'collapsed':'';
  return `<div class="node ${cls}" data-parent="${b.id}">
    <span class="ic">${b.type==='pc'?'◆':b.type==='mob'?'👹':b.type==='rule'?'§':b.type==='img'?'▦':'·'}</span>
    <span class="tt ${col}">${name}</span>
    <span class="type-tag ${b.type}">${TYPE_LABEL[b.type]}</span>
  </div>`;
}

/* ════════════ Render: canvas ════════════ */
function render(){
  const canvas = document.getElementById('canvas');
  canvas.classList.toggle('free', freeLayout);
  let base = blocksTab==='monsters'
    ? blocks.filter(b=> b.type==='mob')
    : blocks.filter(b=> b.type!=='mob');
  const list = searchFilter ? base.filter(matches) : (activeParentId===null ? base : base.filter(b=>b.id===activeParentId));
  document.getElementById('crumbsRoot').textContent = (blocksTab==='monsters'?'Монстры':'Персонажи')
    + (searchFilter?' · результаты поиска':(activeParentId===null?'':(' / '+(findBlock(activeParentId)?.title||'корень'))));

  if(!list.length){
    canvas.innerHTML = `<div class="canvas-watermark">${searchFilter?'Ничего не найдено.':(blocksTab==='monsters'?'Здесь будут монстры. Добавьте их через «👹 Бестиарий» → «＋ Добавить на ширму».':'Добавьте первого персонажа — «＋ ПК» в правом меню.')}</div>`;
  } else {
    const safeCard = b => { try { return blockCard(b); } catch(e){
      return `<div class="block" data-id="${b.id}"><div class="block-head"><div class="ttl-note"><span>${escapeHtml(b.title||'Блок')}</span></div></div><div class="block-body"><div class="hint">Ошибка отображения блока: ${escapeHtml(String((e&&e.message)||e))}</div></div></div>`;
    } };
    if(freeLayout){
      canvas.innerHTML = list.map(b=>{
        const card = safeCard(b);
        const x = b.x!=null?b.x:20, y=b.y!=null?b.y:20;
        return `<div style="position:absolute;left:${x}px;top:${y}px;width:${b.w||360}px;z-index:${b._z||0}">${card}</div>`;
      }).join('');
    } else {
      canvas.innerHTML = `<div style="max-width:820px">` + list.map(safeCard).join('') + `</div>`;
    }
  }
  bindCanvas();
  renderTree();
  save();
}

function blockCard(b){
  const open = !collapsed.has(b.id);
  const border = 'border-'+b.type;
  const ttype = TYPE_LABEL[b.type];
  const w = b.w || 820;
  const li = `<div class="block ${border}" data-id="${b.id}" style="width:${w}px">
    <div class="block-head" data-toggle>
      <span class="collapse ${open?'':'collapsed'}">▸</span>
      <div class="ttl-note">
        <span class="block-title" data-title="${b.id}" contenteditable="true" spellcheck="false" title="Кликните, чтобы переименовать">${escapeHtml(b.title||'(без названия)')}</span>
        <span class="type-tag ${b.type}">${ttype}</span>
      </div>
    </div>
    ${ open ? bodyHtml(b) : `<div class="block-foot"><button class="del" data-action="delete" data-id="${b.id}">Удалить</button></div>` }
    <div class="resize-handle" data-resize="${b.id}" title="Изменить размер"></div>
  </div>`;
  return li;
}

function statsInput(b){
  return `<div class="stats">`+ b.stats.map((s,i)=>`<div class="stat">
    <div class="lbl">${ITEMS_FOR_9[i]||''}</div>
    <input class="val" type="number" min="1" max="30" value="${s}" data-stat-index="${i}" data-stats-id="${b.id}">
    <div class="mod" data-roll-stat="${ITEMS_FOR_9[i]||''}" data-roll-id="${b.id}" title="Бросить d20 + модификатор">${signed(modf(s))}</div>
  </div>`).join('')+`</div>`;
}

function bodyHtml(b){
  let inner='';
  if(b.type==='mob' && b.mdata){ inner = mobStatBlockHtml(b); }
  else if(b.type==='pc' || b.type==='mob'){
    inner += `<div class="props">`+Object.entries(b.props).map(([k,v])=>`<div class="prop"><span class="lbl">${escapeHtml(k)}</span><input class="v" data-prop-key="${escapeHtml(k)}" data-prop-id="${b.id}" value="${escapeHtml(String(v))}"></div>`).join('')+`</div>`;
    inner += statsInput(b);
    inner += `<div class="attack-row">
      <span class="lbl">Атака:</span>
      <input class="attack-input" type="text" data-attack="${b.id}" value="${escapeHtml(b.attack!==undefined?b.attack:'+0')}" placeholder="+бонус" title="Бонус атаки, напр. +5">
      <button data-rollatt="${b.id}" title="Бросок атаки: d20 + бонус">⚔️ Бросить атаку</button>
      <span class="hint" data-attresult="${b.id}"></span>
    </div>`;
  }
  if(b.type==='img'){
    const src = mediaFor(b);
    if(src && b.kind==='image'){
      inner += `<div class="block-img-prev"><img src="${src}" alt="${escapeHtml(b.fileName||'')}"></div>`;
    } else if(src && b.kind==='doc'){
      inner += `<div class="block-doc"><span class="doc-ico">${docIcon(b.fileName)}</span>
        <span class="doc-name">${escapeHtml(b.fileName||'документ')}</span>
        <span class="doc-size">${b.sizeLabel||''}</span>
        <a class="doc-open" href="${src}" download="${escapeHtml(b.fileName||'doc')}">Скачать</a>
        <a class="doc-open" href="${src}" target="_blank" rel="noopener">Открыть</a>
      </div>`;
    }
  }
  inner += ''; /* связи убраны из интерфейса */
  if(b.type==='mob' && b.mdata){ inner += `<div class="hint" style="margin-top:6px">Текстовая заметка к статблоку:</div><textarea data-field="text" data-id="${b.id}" style="min-height:60px">${escapeHtml(b.text)}</textarea>`; }
  else if(b.type==='img'){ /* no textarea for media blocks */ }
  else inner += `<textarea data-field="text" data-id="${b.id}">${escapeHtml(b.text)}</textarea>`;
  return `<div class="block-body">${inner}</div>
    <div class="block-foot">
      <button data-action="collapse">Свернуть</button>
      <button data-action="expand">Развернуть</button>
      ${b.type==='pc'?`<button data-action="rollAll" data-roll-id="${b.id}" title="Бросить d20 по всем характеристикам">Бросок всех</button>`:''}
      <span class="size-info">Ширина: <input class="resize-input" type="number" min="200" max="1600" step="20" value="${b.w||820}" data-width="${b.id}" title="Ширина блока, px"></span>
      <span class="hint" style="margin-left:auto">редактируйте заголовок и текст прямо здесь</span>
      <button class="del" data-action="delete">Удалить блок</button>
    </div>`;
}
function mobStatBlockHtml(b){
  const d=b.mdata||{};
  const AB_RU={Str:'СИЛ',Dex:'ЛОВ',Con:'ТЕЛ',Int:'ИНТ',Wis:'МУД',Cha:'ХАР'};
  const abRow = (d.ab_list||[]).map(a=>`
    <div class="mob-ab"><div class="mob-ab-k">${AB_RU[a.k]||a.k}</div>
      <div class="mob-ab-v">${a.v}</div>
      <div class="mob-ab-m">${a.m>=0?'+'+a.m:a.m}${a.s&&a.s!==(a.m>=0?'+'+a.m:a.m)?' ('+a.s+')':''}</div>
    </div>`).join('');
  // group acts by tag, preserve order
  const tagOrder=['Черты','Действия','Бонус','Реакция','Легендарные'];
  const groups={};
  (d.acts||[]).forEach(a=>{ (groups[a.tag]=groups[a.tag]||[]).push(a.text); });
  let actsHtml='';
  tagOrder.forEach(tag=>{
    if(groups[tag] && groups[tag].length){
      actsHtml += `<div class="mob-section"><div class="mob-sec-title">${escapeHtml(tag)}</div>`;
      groups[tag].forEach(txt=>{
        const ci=txt.indexOf('. ');
        const name=ci>0?txt.slice(0,ci):'';
        const body=ci>0?txt.slice(ci+2):txt;
        actsHtml += `<div class="mob-act"><b>${escapeHtml(name)}</b> ${escapeHtml(body)}</div>`;
      });
      actsHtml += `</div>`;
    }
  });
  return `<div class="mob-block">
    <div class="mob-meta">
      <div class="mob-type">${escapeHtml(d.type||'')}</div>
      <div class="mob-meta-row">
        <span>КД <b>${escapeHtml(d.ac||'—')}</b></span>
        <span>ХП <b>${escapeHtml(d.hp||'—')}</b></span>
        <span>Скорость <b>${escapeHtml(d.sp||'—')}</b></span>
      </div>
    </div>
    <div class="mob-ab-row">${abRow}</div>
    ${d.sk?`<div class="mob-line"><b>Навыки</b> ${escapeHtml(d.sk)}</div>`:''}
    ${d.sen?`<div class="mob-line"><b>Чувства</b> ${escapeHtml(d.sen)}</div>`:''}
    ${d.lang?`<div class="mob-line"><b>Языки</b> ${escapeHtml(d.lang)}</div>`:''}
    <div class="mob-line"><b>Опасность</b> ${escapeHtml(shortCr(d.cr))}</div>
    <div class="mob-line"><b>Инициатива</b> ${escapeHtml(d.init||'—')}</div>
    ${actsHtml}
  </div>`;
}
function docIcon(name){
  const n=(name||'').toLowerCase();
  if(n.endsWith('.pdf')) return '📕';
  if(n.endsWith('.txt')||n.endsWith('.md')) return '📄';
  if(n.endsWith('.docx')||n.endsWith('.doc')) return '📘';
  if(n.endsWith('.json')) return '🧾';
  return '📎';
}

/* ════════════ Helpers ════════════ */
function modf(s){ return Math.floor((s-10)/2); }
function signed(n){ return (n>=0?'+':'')+n; }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function matches(b){
  if(!searchFilter) return true;
  const q = searchFilter.toLowerCase();
  return (b.title||'').toLowerCase().includes(q) || (b.text||'').toLowerCase().includes(q);
}

function bindCanvas(){
  const canvas = document.getElementById('canvas');
  canvas.querySelectorAll('[data-toggle]').forEach(el=>{
    el.addEventListener('click', ()=>{ const id=el.closest('.block').dataset.id; toggleBlock(id); });
  });
  canvas.querySelectorAll('[data-field="text"]').forEach(t=>{
    t.addEventListener('input', e=>{ const b=findBlock(e.target.dataset.id); b.text=e.target.value; save(); });
  });
  canvas.querySelectorAll('[data-action="delete"]').forEach(bn=>{
    bn.addEventListener('click', e=>{
      const id=bn.closest('.block').dataset.id;
      if(confirm('Удалить блок?')){ removeBlock(id); }
    });
  });
  canvas.querySelectorAll('[data-action="collapse"]').forEach(bn=>{
    bn.addEventListener('click', e=>{ collapsed.add(bn.closest('.block').dataset.id); render(); });
  });
  canvas.querySelectorAll('[data-action="expand"]').forEach(bn=>{
    bn.addEventListener('click', e=>{ collapsed.delete(bn.closest('.block').dataset.id); render(); });
  });
  // link remove
  canvas.querySelectorAll('.link-tag').forEach(tag=>{
    tag.addEventListener('click', e=>{
      e.stopPropagation();
      const b=findBlock(tag.dataset.id); b.links = b.links.filter(x=>x!==tag.dataset.link); save(); render();
    });
  });
  canvas.querySelectorAll('[data-field="link-add"]').forEach(sel=>{
    sel.addEventListener('change', e=>{
      const v=e.target.value; if(!v) return;
      const b=findBlock(e.target.dataset.id);
      if(!b.links.includes(v)) b.links.push(v);
      sel.value=''; save(); render();
    });
  });
  bindStatInputs(canvas);
  bindStatRolls(canvas);
  bindResize(canvas);
  if(freeLayout) bindDrag(canvas);
  canvas.querySelectorAll('[data-attack]').forEach(inp=>{
    inp.addEventListener('input', ()=>{ const b=findBlock(inp.dataset.attack); if(b){ b.attack=inp.value; save(); } });
  });
  canvas.querySelectorAll('[data-rollatt]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      const id=btn.dataset.rollatt, b=findBlock(id); if(!b) return;
      const bonus = parseFloat(b.attack||'0')||0;
      const roll = 1+Math.floor(Math.random()*20);
      const total = roll+bonus;
      const crit = roll===20 ? ' — КРИТ!' : (roll===1?' — авто-промах':'');
      const resEl = document.querySelector('[data-attresult="'+id+'"]');
      if(resEl) resEl.textContent = `d20 ${roll} + ${bonus} = ${total}${crit}`;
      const rr=document.getElementById('rollResult');
      if(rr) rr.textContent = `Атака: ${total}`;
    });
  });
  canvas.querySelectorAll('.block-title').forEach(t=>{
    t.addEventListener('mousedown', e=> e.stopPropagation());
    t.addEventListener('click', e=> e.stopPropagation());
    t.addEventListener('blur', ()=>{
      const b=findBlock(t.dataset.title); if(!b) return;
      const val=t.textContent.trim();
      if(!val){ t.textContent=b.title||''; return; }
      b.title=val; save(); renderTree();
    });
    t.addEventListener('keydown', e=>{
      if(e.key==='Enter'){ e.preventDefault(); t.blur(); }
    });
  });
}
function bindResize(canvas){
  canvas.querySelectorAll('[data-width]').forEach(inp=>{
    inp.addEventListener('change', e=>{
      const b=findBlock(e.target.dataset.width); if(!b) return;
      let v=parseInt(e.target.value)||820; v=Math.max(180,Math.min(1600,v));
      b.w=v; e.target.value=v; save(); render();
    });
  });
  canvas.querySelectorAll('[data-resize]').forEach(handle=>{
    handle.addEventListener('mousedown', e=>{
      e.stopPropagation();
      const block=handle.closest('.block'), id=block.dataset.id, b=findBlock(id); if(!b) return;
      const startX=e.clientX, startW=b.w||block.offsetWidth||820;
      block.classList.add('dragging');
      pointerDrag(e, ev=>{
        const nw=Math.max(180,Math.min(1600, startW + (ev.clientX-startX)));
        block.style.width=nw+'px'; b.w=nw;
      }, ()=>{ block.classList.remove('dragging'); save(); render(); });
    });
  });
}
function toggleBlock(id){
  if(collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
  render();
}
function removeBlock(id){
  blocks = blocks.filter(b=>b.id!==id);
  blocks.forEach(b=>{ b.links = b.links.filter(x=>x!==id); });
  if(activeParentId===id) activeParentId=null;
  save(); render();
}

function bindDrag(canvas){
  canvas.querySelectorAll('.block').forEach(block=>{
    const head = block.querySelector('.block-head');
    if(!head) return;
    head.addEventListener('mousedown', e=>{
      if(e.target.closest('select,input,textarea,a,button')) return;
      const id=block.dataset.id, wrap=block.parentElement, b=findBlock(id); if(!b) return;
      const startX=e.clientX, startY=e.clientY;
      const ox=b.x!=null?b.x:wrap.offsetLeft, oy=b.y!=null?b.y:wrap.offsetTop;
      block.classList.add('dragging');
      b._z = Math.max(1,(b._z||0)+1); wrap.style.zIndex=b._z;
      pointerDrag(e, ev=>{
        b.x = Math.max(0, ox+(ev.clientX-startX)); b.y = Math.max(0, oy+(ev.clientY-startY));
        wrap.style.left=b.x+'px'; wrap.style.top=b.y+'px';
      }, ()=>{ block.classList.remove('dragging'); save(); render(); });
    });
  });
}

/* ═══ Layout toggle ═══ */
document.getElementById('btnLayout').addEventListener('click', ()=>{
  freeLayout=!freeLayout;
  document.getElementById('btnLayout').textContent = freeLayout?'Лента':'Свободный холст';
  render();
});

/* ═══ Sidebar toggle ═══ */
const sideToggle = document.getElementById('sideToggle');
const side = document.getElementById('side');
function applySide(hidden){
  side.classList.toggle('collapsed', hidden);
  document.body.classList.toggle('side-hide', hidden);
}
sideToggle.addEventListener('click', ()=>{
  const hidden = !side.classList.contains('collapsed');
  applySide(hidden);
  try{ localStorage.setItem('shirma_side_collapsed', hidden?'1':'0'); }catch(e){}
});
(function(){
  let h=0;
  try{ h=localStorage.getItem('shirma_side_collapsed'); }catch(e){}
  applySide(h==='1');
})();

/* ════════════ Events ════════════ */
document.getElementById('addPc').addEventListener('click', ()=> addBlock('pc'));
document.getElementById('addNpc').addEventListener('click', ()=> addBlock('rule'));
document.getElementById('addNote').addEventListener('click', ()=> addBlock('note'));
document.getElementById('addFile').addEventListener('click', ()=> document.getElementById('mediaInput').click());

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
    const b=makeBlock('img', file.name.replace(/\.[^.]+$/,'') || 'Файл');
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
  const b=makeBlock(type, TYPE_LABEL[type]+' — новый');
  blocks.push(b);
  if(type==='pc') Object.assign(b.props,{Класс:'',Раса:'',HP:10,'Броня КК':10,Инициат:'+0'});
  save(); render();
}
const renderSearchDebounced = debounce(render, 180);
document.getElementById('search').addEventListener('input', e=>{ searchFilter=e.target.value.trim(); renderSearchDebounced(); });

/* ═══ Local library search ═══ */
const LIB = window.LIBRARY || { spells:[], items:[] };
const RULES_FOR_LIB = BASE_RULES || [];
const libModal = document.getElementById('libModal');
const libSearch = document.getElementById('libSearch');
const libKind = document.getElementById('libKind');
const libResults = document.getElementById('libResults');

/* ═══ Bestiary (ленивая загрузка тяжёлого bestiary-data.js) ═══ */
let bestiaryLoadingPromise = null;
function ensureBestiary(){
  if(window.BESTIARY && window.BESTIARY.length) return Promise.resolve();
  if(bestiaryLoadingPromise) return bestiaryLoadingPromise;
  bestiaryLoadingPromise = new Promise((resolve, reject)=>{
    const s=document.createElement('script');
    s.src='bestiary-data.js';
    s.onload=()=>resolve();
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
    list = bestAll.filter(m => normalizeLib(m.n+' '+m.en+' '+m.type).includes(q));
    bestShowCount = Math.max(bestShowCount, list.length);
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
      <span class="hint" style="margin-left:8px">Блок появится во вкладке «Монстры»</span>
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
    ${(acts.length)?`<div class="best-acts">
      ${acts.map(a=>{
        const txt = (typeof a==='string') ? a : (a && typeof a==='object' ? (a.text||'') : '');
        const tag = (a && typeof a==='object' && a.tag) ? a.tag : '';
        const ci=txt.indexOf('. ');
        const title = ci>0? txt.slice(0,ci) : txt;
        const body = ci>0? txt.slice(ci+2) : '';
        return `<div class="act"><span class="an">${tag?escapeHtml(tag)+' — ':''}${escapeHtml(title)}.</span> ${escapeHtml(body)}</div>`;
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
}
function addMonsterBlock(m){
  const b=makeBlock('mob', '👹 '+m.n);
  b.props = {
    'Опасн.': shortCr(m.cr), 'КД': m.ac, 'ХП': m.hp,
    'Скорость': m.sp, 'Иниц.': m.init
  };
  // structured data for official stat block rendering
  b.mdata = {
    type: m.type, cr: m.cr, ac: m.ac, hp: m.hp, sp: m.sp, init: m.init,
    ab_list: m.ab_list||[], sk: m.sk||'', sen: m.sen||'', lang: m.lang||'',
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
  alert('Монстр «'+m.n+'» добавлен во вкладку «Монстры».');
}
bestResultClose.addEventListener('click', ()=>{ bestState.list=true; bestState.monster=null; renderBestiary(); });
document.getElementById('btnBestiary').addEventListener('click', ()=>{
  ensureBestiary().then(()=>{
    bestAll = (window.BESTIARY || []).slice();
    bestState = { list:true, monster:null };
    bestSearch.value='';
    bestShowCount = 60;
    bestModal.hidden=false;
    renderBestiary();
  }).catch(err=>{
    bestModal.hidden=false;
    bestResults.innerHTML = `<div class="lib-empty">Ошибка загрузки бестиария: ${escapeHtml(String(err.message||err))}. Проверьте, что файл bestiary-data.js лежит рядом с index.html.</div>`;
  });
});
document.getElementById('bestClose').addEventListener('click', ()=> bestModal.hidden=true);
bestModal.addEventListener('click', e=>{ if(e.target===bestModal) bestModal.hidden=true; });
const bestSearchDebounced = debounce(renderBestiary, 180);
bestSearch.addEventListener('input', ()=>{ bestState.list=true; bestState.monster=null; bestSearchDebounced(); });

document.getElementById('btnLibrary').addEventListener('click', ()=>{
  libModal.hidden = false;
  libSearch.value='';
  libKind.value='all';
  libSearch.focus();
  renderLib();
});
document.getElementById('libClose').addEventListener('click', ()=> libModal.hidden = true);
libModal.addEventListener('click', e=>{ if(e.target===libModal) libModal.hidden=true; });
const libSearchDebounced = debounce(renderLib, 180);
libSearch.addEventListener('input', ()=> libSearchDebounced());
libKind.addEventListener('change', ()=> renderLib());

function normalizeLib(s){ return String(s||'').toLowerCase().replace(/\s+/g,' ').trim(); }
function renderLib(){
  const q = normalizeLib(libSearch.value);
  const kind = libKind.value;
  let rows=[];
  const inKind = k => kind==='all'||kind===k;
  const matchQ = t => !q || normalizeLib(t).includes(q);

  if(inKind('spell')) LIB.spells.forEach(sp=>{ if(matchQ(sp.n+' '+sp.sc)) rows.push({kind:'spell', sp}); });
  if(inKind('item'))  LIB.items.forEach(it=>{ if(matchQ(it.n)) rows.push({kind:'item', it}); });
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
  const b=makeBlock('rule', '📜 '+s.n);
  let txt = `Уровень: ${s.l} (${s.sc})\nВремя: ${s.t}\nДистанция: ${s.r}\nДлительность: ${s.d}`;
  if(s.c) txt += `\n${s.c}`;
  if(s.cls) txt += `\nДоступно: ${s.cls}`;
  if(s.desc) txt += `\n\n—————\n${s.desc}`;
  b.text = txt;
  blocks.push(b);
  save(); render();
}
function addItemBlock(it){
  let txt = `Тип: ${it.t}\n`;
  if(it.d1) txt += `Урон: ${it.d1}` + (it.d2?` / ${it.d2}`:'') + (it.dt?' ('+it.dt+')':'') + '\n';
  if(it.v) txt += `Цена: ${it.v}\n`;
  if(it.w) txt += `Вес: ${it.w}\n`;
  if(it.p) txt += `Свойства: ${it.p}\n`;
  const b=makeBlock('img', '🎒 '+it.n);
  b.kind='doc'; b.fileName=it.n; b.data='';
  b.text = txt;
  // ensure body shows text — img block doesn't render textarea; change type to rule for text
  b.type='rule';
  b.text = txt.trim();
  blocks.push(b);
  save(); render();
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
document.querySelectorAll('.die-btn').forEach(b=>{
  b.addEventListener('click', ()=>{
    currentDie=b.dataset.die;
    document.querySelectorAll('.die-btn').forEach(x=>x.classList.toggle('active',x===b));
  });
});
document.querySelectorAll('.die-btn').forEach((b,i)=>i===5&&b.classList.add('active'));
document.getElementById('btnRoll').addEventListener('click', ()=>{
  doRoll(currentDie, parseInt(document.getElementById('dieCount').value)||1, null);
});
function doRoll(die,count,modLabel){
  const n=parseInt(die.slice(1)); const cnt=count||1;
  const rolls=Array.from({length:cnt},()=>1+Math.floor(Math.random()*n));
  const sum=rolls.reduce((a,b)=>a+b,0);
  const label= ` (${rolls.join('+')})` + (modLabel?` ${modLabel}`:'');
  document.getElementById('rollResult').textContent = `${die}${cnt>1?`×${cnt}`:''} ➜ ${sum}`;
  document.getElementById('rollLog').textContent = label;
  rollHistory.push(`${die}${cnt>1?`×${cnt}`:''} = ${sum}${label}`);
  if(rollHistory.length>8) rollHistory.shift();
}
/* stat rolls for PC blocks */
function bindStatRolls(canvas){
  canvas.querySelectorAll('.stat .mod').forEach(el=>{
    el.addEventListener('click', e=>{
      const b=findBlock(el.dataset.rollId); if(!b) return;
      const idx=ITEMS_FOR_9.indexOf(el.dataset.rollStat);
      const m=idx>=0?modf(b.stats[idx]):0;
      doRoll('d20',1, (m>=0?`+${m}`:m));
    });
  });
  canvas.querySelectorAll('[data-action="rollAll"]').forEach(el=>{
    el.addEventListener('click', ()=>{
      const b=findBlock(el.dataset.rollId); if(!b) return;
      let out='';
      b.stats.forEach((s,i)=>{ out+=`${ITEMS_FOR_9[i]}: ${doOneD20()+modf(s)}  `; });
      document.getElementById('rollResult').textContent = 'Бросок всех: '+out;
      rollHistory.push('Бросок всех ПК: '+out);
    });
  });
}
function doOneD20(){ return 1+Math.floor(Math.random()*20); }
function bindStatInputs(canvas){
  canvas.querySelectorAll('.stat input.val').forEach(inp=>{
    inp.addEventListener('input', ()=>{
      const b=findBlock(inp.dataset.statsId); const idx=+inp.dataset.statIndex;
      b.stats[idx]=Math.max(1,Math.min(30,parseInt(inp.value)||10));
      const mod=b.stats[idx]>=0? '+'+(Math.floor((b.stats[idx]-10)/2)) : ''+Math.floor((b.stats[idx]-10)/2);
      const modEl=inp.parentElement.querySelector('.mod'); if(modEl) modEl.textContent= (function(x){return (x>=0?'+':'')+x})(Math.floor((b.stats[idx]-10)/2));
      save();
    });
    inp.addEventListener('change', ()=>{ const b=findBlock(inp.dataset.statsId); const idx=+inp.dataset.statIndex;
      const v=Math.max(1,Math.min(30,parseInt(inp.value)||10)); b.stats[idx]=v; inp.value=v; save(); });
  });
  canvas.querySelectorAll('.prop input.v').forEach(inp=>{
    const keyEl=inp.dataset.propKey;
    inp.addEventListener('input', ()=>{ const b=findBlock(inp.dataset.propId); b.props[keyEl]=inp.value; save(); });
  });
}
document.getElementById('btnExport').addEventListener('click', ()=>{
  const blob=new Blob([JSON.stringify(blocks,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='shirma-backup.json'; a.click(); URL.revokeObjectURL(a.href);
});
document.getElementById('btnImport').addEventListener('click', ()=> document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{ try{ const data=JSON.parse(r.result); if(Array.isArray(data)){ blocks=data; collapsed=new Set(); save(); render(); } else alert('Не JSON-массив'); }catch(err){ alert('Ошибка чтения файла'); } };
  r.readAsText(f); e.target.value='';
});
document.getElementById('btnReset').addEventListener('click', ()=>{
  if(confirm('Перезаписать все данные демо-версией?')){ seed(); }
});

/* ═══ Shop ═══ */
const SHOP = window.SHOP || [];
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
    if(q && !normalizeLib(i.n+' '+i.c).includes(q)) return false;
    return true;
  });
  if(!list.length){ shopResults.innerHTML='<div class="lib-empty">Ничего не найдено.</div>'; return; }
  const limit=100;
  shopResults.innerHTML = list.slice(0,limit).map(i=>`
    <div class="lib-row"><span class="lib-kind k-item">${escapeHtml(i.c.split(' ')[0])}</span>
      <div class="lib-main">
        <div class="lib-title">${escapeHtml(i.n)}</div>
        <div class="lib-meta">${escapeHtml(i.c)}${i.w?` · ${escapeHtml(i.w)}`:''}</div>
      </div>
      <span class="shop-price" style="color:var(--accent2); font-weight:700; align-self:center">${escapeHtml(i.v)}</span>
    </div>`).join('');
  if(list.length>limit) shopResults.innerHTML+=`<div class="lib-empty">…ещё ${list.length-limit} — уточните запрос.</div>`;
}
document.getElementById('btnShop').addEventListener('click', ()=>{
  const cats=shopCats();
  shopCat.innerHTML = '<option value="all">Все категории</option>'+cats.map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  shopSearch.value=''; shopCat.value='all';
  shopModal.hidden=false; renderShop();
});
document.getElementById('shopClose').addEventListener('click', ()=> shopModal.hidden=true);
shopModal.addEventListener('click', e=>{ if(e.target===shopModal) shopModal.hidden=true; });
const shopSearchDebounced = debounce(renderShop, 180);
shopSearch.addEventListener('input', ()=> shopSearchDebounced());
shopCat.addEventListener('change', renderShop);

/* ═══ Tabs ═══ */
let currentTab = 'chars';
let blocksTab = 'chars'; // 'chars' | 'monsters'
const tabs = {
  chars: document.getElementById('view-chars'),
  notes: document.getElementById('view-notes'),
  sessions: document.getElementById('view-sessions'),
  map: document.getElementById('view-map'),
};
function showTab(name){
  currentTab = name;
  document.querySelectorAll('.tab').forEach(t=> t.classList.toggle('active', t.dataset.tab===name));
  tabs.chars.hidden = true;
  tabs.notes.hidden = true;
  tabs.sessions.hidden = true;
  tabs.map.hidden = true;
  if(name==='chars'||name==='monsters'){
    blocksTab = name;
    tabs.chars.hidden = false;
    render();
  } else if(name==='notes'){
    tabs.notes.hidden = false;
    renderNotes();
  } else if(name==='sessions'){
    tabs.sessions.hidden = false;
    ensureSessions();
  } else if(name==='map'){
    tabs.map.hidden = false;
    renderMap();
  }
  save();
}
document.querySelectorAll('.tab').forEach(t=> t.addEventListener('click', ()=> showTab(t.dataset.tab)));

/* ═══ Free notes canvas ═══ */
const STORE_NOTES = 'shirma_notes_v1';
let noteBlocks = [];
function loadNotes(){
  try{ const raw=localStorage.getItem(STORE_NOTES); if(raw){ noteBlocks=JSON.parse(raw); return true; } }catch(e){}
  return false;
}
function saveNotes(){ try{ localStorage.setItem(STORE_NOTES, JSON.stringify(noteBlocks)); }catch(e){} }
function renderNotes(){
  const nc = document.getElementById('notesCanvas');
  if(!nc) return;
  nc.innerHTML = noteBlocks.map(nb=>`
    <div class="block note-blk" style="left:${nb.x||40}px;top:${nb.y||40}px;width:${nb.w||280}px;border-top:3px solid ${nb.clr||'#d49bd6'}" data-nid="${nb.id}">
      <div class="block-head" data-ndrag>
        <span class="ttl-note"><span class="block-title" contenteditable="true" spellcheck="false" data-ntitle="${nb.id}">${escapeHtml(nb.title||'Заметка')}</span></span>
        <span class="cp-group">
          ${['#c0564f','#c9a227','#86c48f','#7fb3e6',''].map(c=>`<span class="cp-dot" data-nc="${c}" style="background:${c||'#3a4048'}"></span>`).join('')}
        </span>
      </div>
      <div class="block-body" style="padding:8px">
        <textarea data-ntext="${nb.id}" style="min-height:130px">${escapeHtml(nb.text||'')}</textarea>
        <div style="display:flex;gap:6px;margin-top:6px">
          <button data-ndel="${nb.id}">Удалить</button>
          <button data-nsize="${nb.id}">${(nb.w||280)<400?'⇄ Расширить':'⇄ Сузить'}</button>
        </div>
      </div>
    </div>`).join('');
  nc.querySelectorAll('[data-nid]').forEach(el=>{
    // color picker
    el.querySelectorAll('.cp-dot').forEach(dot=> dot.addEventListener('click', e=>{
      e.stopPropagation();
      const nb=noteBlocks.find(x=>x.id===el.dataset.nid); if(nb){ nb.clr=dot.dataset.nc; saveNotes(); renderNotes(); }
    }));
    // title
    el.querySelectorAll('[data-ntitle]').forEach(t=>{
      t.addEventListener('mousedown', e=> e.stopPropagation());
      t.addEventListener('blur', ()=>{ const nb=noteBlocks.find(x=>x.id===t.dataset.ntitle); if(nb){ nb.title=t.textContent.trim()||'Заметка'; saveNotes(); } });
    });
    // text
    el.querySelectorAll('[data-ntext]').forEach(t=> t.addEventListener('input', ()=>{ const nb=noteBlocks.find(x=>x.id===t.dataset.ntext); if(nb){ nb.text=t.value; saveNotes(); } }));
    // delete
    el.querySelectorAll('[data-ndel]').forEach(b=> b.addEventListener('click', ()=>{ noteBlocks=noteBlocks.filter(x=>x.id!==b.dataset.ndel); saveNotes(); renderNotes(); }));
    // resize
    el.querySelectorAll('[data-nsize]').forEach(b=> b.addEventListener('click', ()=>{ const nb=noteBlocks.find(x=>x.id===b.dataset.nsize); if(nb){ nb.w=(nb.w||280)<400?420:280; saveNotes(); renderNotes(); } }));
    // drag
    el.querySelectorAll('[data-ndrag]').forEach(h=> h.addEventListener('mousedown', e=>{
      if(e.target.closest('.cp-group')) return;
      const nb=noteBlocks.find(x=>x.id===el.dataset.nid); if(!nb) return;
      const sx=e.clientX, sy=e.clientY, ox=nb.x||40, oy=nb.y||40;
      pointerDrag(e, ev=>{ nb.x=Math.max(0,ox+(ev.clientX-sx)); nb.y=Math.max(0,oy+(ev.clientY-sy)); el.style.left=nb.x+'px'; el.style.top=nb.y+'px'; }, ()=> saveNotes());
    }));
  });
}
function newNote(x,y){ noteBlocks.push({ id:'n'+Math.random().toString(36).slice(2,7), title:'Заметка', text:'', x:x||40, y:y||40, w:280, clr:'' }); saveNotes(); renderNotes(); }
document.getElementById('notesAdd').addEventListener('click', ()=> newNote(40,40));
document.getElementById('notesAddRule').addEventListener('click', ()=>{ noteBlocks.push({ id:'n'+Math.random().toString(36).slice(2,7), title:'Правило', text:'Вставьте текст правила…', x:60, y:60, w:280, clr:'#86c48f' }); saveNotes(); renderNotes(); });
document.getElementById('notesClear').addEventListener('click', ()=>{ if(confirm('Очистить все заметки холста?')){ noteBlocks=[]; saveNotes(); renderNotes(); } });
{ const nc=document.getElementById('notesCanvas'); if(nc) nc.addEventListener('dblclick', e=>{ newNote(e.offsetX, e.offsetY); }); }

/* ════════════ Map & tokens ════════════ */
const STORE_MAP = 'shirma_map_v1';
let mapState = { bg:null, tokens:[], zoom:1 };
function loadMap(){
  try{ const raw=localStorage.getItem(STORE_MAP); if(raw){ mapState=JSON.parse(raw); if(!mapState.zoom) mapState.zoom=1; if(mapState.locked==null) mapState.locked=false; if(mapState.scrollX==null) mapState.scrollX=0; if(mapState.scrollY==null) mapState.scrollY=0; return true; } }catch(e){}
  return false;
}
function saveMap(){ try{ localStorage.setItem(STORE_MAP, JSON.stringify(mapState)); }catch(e){} }
function mapZoom(delta){
  if(mapState.locked) return;
  const z = Math.min(4, Math.max(0.25, mapState.zoom + delta));
  mapState.zoom = z;
  saveMap(); renderMap();
}
function renderMap(){
  const mc = document.getElementById('mapCanvas');
  mc.innerHTML='';
  mc.classList.toggle('locked', !!mapState.locked);
  const z = mapState.zoom;
  const wrapper=document.createElement('div');
  wrapper.className='map-zoom';
  wrapper.style.transform=`scale(${z})`;
  wrapper.style.width=(z*800)+'px';
  wrapper.style.height=(z*600)+'px';
  mc.appendChild(wrapper);
  document.getElementById('mapZoomLabel').textContent = Math.round(z*100)+'%';
  const bgSrc = (mapState.bgKey && mediaCache[mapState.bgKey]) || mapState.bg;
  if(bgSrc){
    mc.classList.add('has-bg');
    const img=document.createElement('img');
    img.className='map-bg';
    img.src=bgSrc;
    img.draggable=false;
    wrapper.appendChild(img);
  } else {
    mc.classList.remove('has-bg');
  }
  mapState.tokens.forEach(t=>{
    if(t.x==null) t.x=Math.random()*400+100, t.y=Math.random()*300+100;
    wrapper.appendChild(tokenEl(t));
  });
  bindTokens();
  if(!mapState.tokens.length && !mapState.bg){
    const empty=document.createElement('div');
    empty.className='map-empty';
    empty.textContent='Загрузите карту или добавьте токен.';
    mc.appendChild(empty);
  }
  updateMapLockBtn();
  requestAnimationFrame(()=>{ mc.scrollLeft=mapState.scrollX||0; mc.scrollTop=mapState.scrollY||0; });
}
function updateMapLockBtn(){
  const btn=document.getElementById('mapLock'); if(!btn) return;
  btn.textContent = mapState.locked ? '🔒 Закреплено' : '🔓 Закрепить';
  btn.classList.toggle('locked', !!mapState.locked);
  btn.title = mapState.locked ? 'Карта закреплена: масштаб и прокрутка заблокированы' : 'Закрепить карту в текущем положении';
}
let selectedTokenId = null;
function tokenEl(t){
  const el=document.createElement('div');
  el.className='map-token'+(t.npc?' npc':'')+(t.id===selectedTokenId?' selected':'');
  el.dataset.tid=t.id;
  el.style.left=t.x+'px'; el.style.top=t.y+'px';
  if(t.img){
    el.style.background='transparent';
    const im=document.createElement('img');
    im.src=t.img; im.style.width='100%'; im.style.height='100%';
    im.style.borderRadius='50%'; im.style.objectFit='cover';
    el.appendChild(im);
  } else {
    el.style.background=t.color||'var(--accent2)';
    el.textContent=t.label||'П';
  }
  const name=document.createElement('div');
  name.className='tok-name'; name.textContent=t.title||'';
  el.appendChild(name);
  el.addEventListener('click', e=>{
    if(e.target.classList.contains('tok-del')) return;
    selectedTokenId = (selectedTokenId===t.id)? null : t.id;
    saveMap(); renderMap();
  });
  return el;
}
function bindTokens(){
  document.querySelectorAll('.map-token').forEach(el=>{
    el.addEventListener('mousedown', e=>{
      if(e.target.classList.contains('tok-del')) return;
      el.classList.add('dragging');
      const tok = mapState.tokens.find(x=>x.id===el.dataset.tid);
      const startX=e.clientX, startY=e.clientY;
      const zoom=mapState.zoom||1;
      const ox=parseFloat(el.style.left), oy=parseFloat(el.style.top);
      pointerDrag(e, ev=>{
        const nx = Math.max(0, ox + (ev.clientX-startX)/zoom);
        const ny = Math.max(0, oy + (ev.clientY-startY)/zoom);
        el.style.left=nx+'px'; el.style.top=ny+'px';
        if(tok){ tok.x=nx; tok.y=ny; }
      }, ()=>{ el.classList.remove('dragging'); saveMap(); });
    });
  });
  const sel=mapState.tokens.find(t=>t.id===selectedTokenId);
  docGet('mapTokCtl').style.display = sel ? 'flex' : 'none';
  if(sel){
    docGet('mapTokName').textContent = sel.title||'Токен';
    docGet('mapTokType').textContent = sel.npc ? 'Враг' : 'ПК';
    docGet('mapTokType').style.color = sel.npc ? 'var(--danger)' : 'var(--accent2)';
  }
}
function docGet(id){ return document.getElementById(id); }
document.getElementById('mapUpload').addEventListener('click', ()=> document.getElementById('mapFileInput').click());
document.getElementById('mapFileInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader();
  r.onload=()=>{
    const data=r.result;
    mediaCache['mapbg'] = data;
    idbPut('mapbg', data);      // фон в IndexedDB
    mapState.bgKey='mapbg';
    mapState.bg='';             // base64 в localStorage не храним
    saveMap(); renderMap();
  };
  r.readAsDataURL(f); e.target.value='';
});
document.getElementById('mapAddToken').addEventListener('click', ()=>{
  mapState.tokens.push({
    id:'tok'+Math.random().toString(36).slice(2,7),
    title: prompt('Имя токена:','Персонаж') || 'Персонаж',
    label: '', npc: false,
    x: Math.random()*400+100, y: Math.random()*250+100,
    color: null,
  });
  saveMap(); renderMap();
});
document.getElementById('mapClear').addEventListener('click', ()=>{
  if(confirm('Убрать фон карты? Токены останутся.')){
    if(mapState.bgKey) idbDel(mapState.bgKey);
    delete mediaCache['mapbg'];
    mapState.bg=null; mapState.bgKey=null; saveMap(); renderMap();
  }
});
/* token controls */
document.getElementById('mapTokType').addEventListener('click', ()=>{
  const t=mapState.tokens.find(x=>x.id===selectedTokenId); if(!t) return;
  t.npc=!t.npc; if(!t.img){ t.color = t.npc? '#c0564f':'var(--accent2)'; }
  saveMap(); renderMap();
});
document.getElementById('mapTokImg').addEventListener('click', ()=> document.getElementById('mapTokImgInput').click());
document.getElementById('mapTokImgInput').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  const t=mapState.tokens.find(x=>x.id===selectedTokenId); if(!t) return;
  const r=new FileReader();
  r.onload=()=>{ t.img=r.result; t.label=''; saveMap(); renderMap(); };
  r.readAsDataURL(f); e.target.value='';
});
document.getElementById('mapTokImgClear').addEventListener('click', ()=>{
  const t=mapState.tokens.find(x=>x.id===selectedTokenId); if(!t) return;
  delete t.img; t.color = t.npc? '#c0564f':'var(--accent2)'; saveMap(); renderMap();
});
document.getElementById('mapTokDel').addEventListener('click', ()=>{
  if(!selectedTokenId) return;
  mapState.tokens = mapState.tokens.filter(x=>x.id!==selectedTokenId);
  selectedTokenId=null; saveMap(); renderMap();
});
document.getElementById('mapZoomIn').addEventListener('click', ()=> mapZoom(0.25));
document.getElementById('mapZoomOut').addEventListener('click', ()=> mapZoom(-0.25));
document.getElementById('mapZoomReset').addEventListener('click', ()=>{ if(mapState.locked) return; mapState.zoom=1; saveMap(); renderMap(); });
document.getElementById('mapLock').addEventListener('click', ()=>{
  mapState.locked=!mapState.locked;
  const mc=document.getElementById('mapCanvas');
  if(mc){ mapState.scrollX=mc.scrollLeft; mapState.scrollY=mc.scrollTop; }
  saveMap(); renderMap();
});
const saveMapScroll = debounce(()=>{ saveMap(); }, 250);
document.getElementById('mapCanvas').addEventListener('scroll', e=>{
  if(mapState.locked) return;
  const mc=e.currentTarget;
  mapState.scrollX=mc.scrollLeft; mapState.scrollY=mc.scrollTop;
  saveMapScroll();
});
document.getElementById('mapCanvas').addEventListener('wheel', e=>{
  e.preventDefault();
  if(mapState.locked) return;
  mapZoom(e.deltaY<0 ? 0.1 : -0.1);
}, { passive:false });

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
  tablesModal.hidden = false;
});
document.getElementById('tablesClose').addEventListener('click', ()=> tablesModal.hidden=true);
tablesModal.addEventListener('click', e=>{ if(e.target===tablesModal) tablesModal.hidden=true; });
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

/* ════════════ Сессии (редактор в стиле Obsidian) ════════════ */
const STORE_SESSIONS = 'shirma_sessions_v1';
let sessions = [];
let activeSessionId = null;
let sessionsInited = false;

function loadSessions(){
  try{ const raw=localStorage.getItem(STORE_SESSIONS); if(raw){ sessions=JSON.parse(raw)||[]; return true; } }catch(e){}
  sessions=[]; return false;
}
const persistSessions = debounce(()=>{ try{ const out=sessions.map(s=>({...s, html:stripSessionHtml(s.html)})); localStorage.setItem(STORE_SESSIONS, JSON.stringify(out)); }catch(e){ console.warn('Не удалось сохранить сессии:', e); } }, 300);
function scheduleSaveSessions(){
  persistSessions();
  const el=document.getElementById('sessionSaved');
  if(el){ el.textContent='Сохранение…'; setTimeout(()=>{ if(el) el.textContent='Сохранено'; }, 350); }
}
function findSession(id){ return sessions.find(s=>s.id===id); }
function stripSessionHtml(html){
  if(!html) return html||'';
  const d=document.createElement('div'); d.innerHTML=html;
  d.querySelectorAll('img[data-mkey]').forEach(img=> img.removeAttribute('src'));
  return d.innerHTML;
}
function hydrateSessionHtml(html){
  if(!html) return html||'';
  const d=document.createElement('div'); d.innerHTML=html;
  let changed=false;
  d.querySelectorAll('img[data-mkey]').forEach(img=>{
    const k=img.getAttribute('data-mkey');
    const src=(k && mediaCache[k]) || '';
    if(src){ img.setAttribute('src',src); changed=true; }
  });
  return changed ? d.innerHTML : (html||'');
}

function ensureSessions(){
  if(!sessionsInited){
    sessionsInited = true;
    loadSessions();
    bindSessionControls();
    if(!sessions.length){ newSession(true); }
    else { renderSessionsList(); selectSession(sessions[0].id); }
  } else {
    renderSessionsList();
  }
}
function renderSessionsList(){
  const box=document.getElementById('sessionsList');
  if(!box) return;
  if(!sessions.length){ box.innerHTML='<div class="hint" style="padding:8px">Нет сессий</div>'; return; }
  box.innerHTML = sessions.map(s=>{
    const date = s.updated ? new Date(s.updated).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '';
    return `<div class="session-item ${s.id===activeSessionId?'active':''}" data-sid="${s.id}">
      <div class="si-title">${escapeHtml(s.title||'Без названия')}</div>
      <div class="si-date">${date}</div>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-sid]').forEach(el=> el.addEventListener('click', ()=> selectSession(el.dataset.sid)));
}
function selectSession(id){
  const s=findSession(id); if(!s) return;
  activeSessionId=id;
  const titleEl=document.getElementById('sessionTitle');
  const ed=document.getElementById('sessionEditor');
  if(titleEl) titleEl.value = s.title||'';
  if(ed) ed.innerHTML = hydrateSessionHtml(s.html||'');
  const sv=document.getElementById('sessionSaved'); if(sv) sv.textContent='';
  renderSessionsList();
}
function newSession(silent){
  const now=Date.now();
  const s={ id:'s'+now.toString(36)+Math.random().toString(36).slice(2,6), title:'Сессия '+new Date(now).toLocaleDateString('ru-RU'), html:'', updated:now };
  sessions.unshift(s);
  persistSessions();
  activeSessionId=s.id;
  const titleEl=document.getElementById('sessionTitle');
  const ed=document.getElementById('sessionEditor');
  if(titleEl) titleEl.value=s.title;
  if(ed) ed.innerHTML='';
  renderSessionsList();
  if(!silent){ scheduleSaveSessions(); }
}
function bindSessionControls(){
  const titleEl=document.getElementById('sessionTitle');
  const ed=document.getElementById('sessionEditor');
  const delBtn=document.getElementById('sessionDelete');
  const newBtn=document.getElementById('sessionNew');
  if(newBtn) newBtn.addEventListener('click', ()=> newSession());
  if(titleEl) titleEl.addEventListener('input', ()=>{
    const s=findSession(activeSessionId); if(!s) return;
    s.title=titleEl.value; s.updated=Date.now(); scheduleSaveSessions(); renderSessionsList();
  });
  if(ed) ed.addEventListener('input', ()=>{
    const s=findSession(activeSessionId); if(!s){ return; }
    s.html=ed.innerHTML; s.updated=Date.now(); scheduleSaveSessions();
  });
  if(delBtn) delBtn.addEventListener('click', ()=>{
    if(!activeSessionId) return;
    if(!confirm('Удалить эту сессию?')) return;
    sessions = sessions.filter(s=>s.id!==activeSessionId);
    persistSessions();
    if(sessions.length){ selectSession(sessions[0].id); } else { activeSessionId=null; const t=document.getElementById('sessionTitle'); const e=document.getElementById('sessionEditor'); if(t)t.value=''; if(e)e.innerHTML=''; renderSessionsList(); }
  });
  const mdBtn=document.getElementById('sessionExportMd');
  const pdfBtn=document.getElementById('sessionExportPdf');
  if(mdBtn) mdBtn.addEventListener('click', exportSessionMd);
  if(pdfBtn) pdfBtn.addEventListener('click', exportSessionPdf);
  bindSessionToolbar();
}
function bindSessionToolbar(){
  const bar=document.getElementById('sessionToolbar');
  const ed=document.getElementById('sessionEditor');
  if(!bar || !ed) return;
  // mousedown с preventDefault — чтобы не терять выделение в редакторе
  bar.addEventListener('mousedown', e=>{ if(e.target.closest('button')) e.preventDefault(); });
  bar.querySelectorAll('[data-cmd]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      ed.focus();
      try{ document.execCommand(btn.dataset.cmd, false, null); }catch(e){}
      afterEdit();
    });
  });
  bar.querySelectorAll('[data-block]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      ed.focus();
      const tag=btn.dataset.block;
      try{ document.execCommand('formatBlock', false, tag); }catch(e){}
      afterEdit();
    });
  });
  bar.querySelectorAll('[data-link]').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      ed.focus();
      const url=prompt('Адрес ссылки (URL):','https://'); if(!url) return;
      try{ document.execCommand('createLink', false, url); }catch(e){}
      afterEdit();
    });
  });
  // вставка картинки: кнопка → выбор файла
  const imgBtn=document.getElementById('sessionImgBtn');
  const imgInput=document.getElementById('sessionImgInput');
  if(imgBtn && imgInput){
    imgBtn.addEventListener('click', ()=> imgInput.click());
    imgInput.addEventListener('change', e=>{
      const f=e.target.files && e.target.files[0];
      if(f) insertImageIntoSession(f);
      e.target.value='';
      afterEdit();
    });
  }
  // вставка из буфера обмена (Ctrl+V)
  ed.addEventListener('paste', e=>{
    const items=e.clipboardData && e.clipboardData.items;
    if(!items) return;
    for(const it of items){
      if(it.type && it.type.indexOf('image')===0){
        const f=it.getAsFile();
        if(f){ e.preventDefault(); insertImageIntoSession(f); afterEdit(); }
        return;
      }
    }
  });
  // перетаскивание файла в редактор
  ed.addEventListener('drop', e=>{
    const dt=e.dataTransfer; if(!dt) return;
    const f=[...(dt.files||[])].find(x=>/^image\//.test(x.type));
    if(f){ e.preventDefault(); insertImageIntoSession(f); afterEdit(); }
  });
  function afterEdit(){
    const s=findSession(activeSessionId); if(s){ s.html=ed.innerHTML; s.updated=Date.now(); scheduleSaveSessions(); }
  }
}

function insertImageIntoSession(file){
  if(!file || !/^image\//.test(file.type)) return;
  const ed=document.getElementById('sessionEditor'); if(!ed) return;
  const reader=new FileReader();
  reader.onload=()=>{
    const data=reader.result;
    const key='sessimg_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    mediaCache[key]=data; idbPut(key,data);
    const img=document.createElement('img');
    img.setAttribute('src',data);
    img.setAttribute('data-mkey',key);
    img.setAttribute('alt','');
    const sel=window.getSelection();
    let inserted=false;
    if(sel && sel.rangeCount){
      const range=sel.getRangeAt(0);
      if(ed.contains(range.commonAncestorContainer)){
        range.deleteContents(); range.insertNode(img);
        const after=document.createRange(); after.setStartAfter(img); after.collapse(true);
        sel.removeAllRanges(); sel.addRange(after); inserted=true;
      }
    }
    if(!inserted) ed.appendChild(img);
    const s=findSession(activeSessionId); if(s){ s.html=ed.innerHTML; s.updated=Date.now(); scheduleSaveSessions(); }
  };
  reader.readAsDataURL(file);
}

/* ════════════ Экспорт сессии в Markdown / PDF ════════════ */
function htmlToMarkdown(html){
  const root=document.createElement('div'); root.innerHTML=html||'';
  function esc(s){ return s; }
  function walk(node){
    if(node.nodeType===3) return node.nodeValue;
    if(node.nodeType!==1) return '';
    const tag=node.nodeName.toLowerCase();
    const inner=Array.from(node.childNodes).map(walk).join('');
    switch(tag){
      case 'h1': return '\n# '+inner.trim()+'\n';
      case 'h2': return '\n## '+inner.trim()+'\n';
      case 'h3': return '\n### '+inner.trim()+'\n';
      case 'h4': return '\n#### '+inner.trim()+'\n';
      case 'strong': case 'b': return '**'+inner+'**';
      case 'em': case 'i': return '_'+inner+'_';
      case 's': case 'strike': case 'del': return '~~'+inner+'~~';
      case 'u': return inner;
      case 'code': return '`'+inner+'`';
      case 'pre': return '\n```\n'+node.textContent.replace(/\n+$/,'')+'\n```\n';
      case 'blockquote': return '\n> '+inner.trim().replace(/\n/g,'\n> ')+'\n';
      case 'a': return '['+inner+']('+(node.getAttribute('href')||'')+')';
      case 'img': return '!['+(node.getAttribute('alt')||'')+']('+(node.getAttribute('src')||'')+')';
      case 'ul': return '\n'+Array.from(node.children).map(li=>'- '+li.textContent.trim()).join('\n')+'\n';
      case 'ol': return '\n'+Array.from(node.children).map((li,i)=>(i+1)+'. '+li.textContent.trim()).join('\n')+'\n';
      case 'li': return inner;
      case 'br': return '\n';
      case 'hr': return '\n---\n';
      case 'p': case 'div': return '\n'+inner+'\n';
      default: return inner;
    }
  }
  let md=walk(root);
  md=md.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  return md;
}
function downloadFile(name, content, mime){
  const blob=new Blob([content],{type:mime||'text/plain;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
}
function safeFileName(name){ return String(name||'session').replace(/[\/\\:*?"<>|]+/g,'_').slice(0,80); }
function exportSessionMd(){
  const s=findSession(activeSessionId); if(!s){ alert('Нет активной сессии'); return; }
  const md='# '+(s.title||'Сессия')+'\n\n'+htmlToMarkdown(hydrateSessionHtml(s.html||''));
  downloadFile(safeFileName(s.title)+'.md', md, 'text/markdown;charset=utf-8');
}
function exportSessionPdf(){
  const s=findSession(activeSessionId); if(!s){ alert('Нет активной сессии'); return; }
  const bodyHtml=hydrateSessionHtml(s.html||'');
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>${escapeHtml(s.title||'Сессия')}</title>
    <style>
      body{font-family:-apple-system,"Segoe UI",Roboto,sans-serif;color:#111;max-width:800px;margin:24px auto;padding:0 20px;line-height:1.6;font-size:14px}
      h1{font-size:24px;margin:0 0 14px}h2{font-size:19px}h3{font-size:16px}
      blockquote{border-left:3px solid #999;margin:10px 0;padding:4px 12px;color:#555}
      pre{background:#f4f4f4;padding:10px;border-radius:6px;white-space:pre-wrap;font-size:12px}
      code{background:#f4f4f4;padding:1px 4px;border-radius:3px}
      a{color:#1155cc} img{max-width:100%}
    </style></head><body><h1>${escapeHtml(s.title||'Сессия')}</h1>${bodyHtml}</body></html>`;
  const frame=document.createElement('iframe');
  frame.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc=frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(()=>{
    try{ frame.contentWindow.focus(); frame.contentWindow.print(); }
    catch(e){ alert('Не удалось открыть печать: '+e.message); }
    setTimeout(()=>frame.remove(), 1500);
  }, 400);
}

/* ════════════ Init ════════════ */
(function init(){
  collapsed = new Set();
  if(!load()){ blocks = SAMPLES.map(s=>makeBlock(s.type,s.title,{title:s.title, links:s.links, stats:s.stats||[10,10,10,10,10,10], props:s.props||{}, text:s.text||''})); }
  blocks.forEach(b=>{ collapsed.add(b.id); });
  loadMap();
  loadNotes();
  // загрузка медиа из IndexedDB + миграция старых base64 из localStorage
  loadAllMedia().then(()=>{
    let migrated=false;
    blocks.forEach(b=>{
      if(b.data && (b.kind==='image'||b.kind==='doc') && !b.dataKey){
        const key='media_'+b.id; mediaCache[key]=b.data; idbPut(key,b.data); b.dataKey=key; b.data=''; migrated=true;
      }
    });
    if(mapState.bg && !mapState.bgKey){
      mediaCache['mapbg']=mapState.bg; idbPut('mapbg',mapState.bg); mapState.bgKey='mapbg'; mapState.bg=''; migrated=true;
    }
    if(migrated){ persistBlocks(); saveMap(); }
    render(); renderMap(); renderNotes();
  });
  save(); render();
  renderMap();
  renderNotes();
})();
