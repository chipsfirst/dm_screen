/* ════════════ Render: sidebar tree ════════════ */
/* ════════════════ Render: canvas ════════════════ */
let canvasCols = 3;
let canvasQuery = '';
let canvasView = 'grid';
let sectionCollapsed = new Set();
try{
  const v = +localStorage.getItem('shirma_canvas_cols');
  if(v >= 2 && v <= 4) canvasCols = v;
  if(localStorage.getItem('shirma_canvas_view') === 'list') canvasView = 'list';
  const sc = JSON.parse(localStorage.getItem('shirma_canvas_sections') || '[]');
  if(Array.isArray(sc)) sectionCollapsed = new Set(sc.map(String));
}catch(e){}
function canvasEffectiveCols(){
  if(freeLayout) return canvasCols;
  if(canvasView === 'list') return 1;
  if(innerWidth < 900) return 1;
  if(innerWidth < 1200) return Math.min(canvasCols, 2);
  return canvasCols;
}
function saveCanvasView(){
  try{
    localStorage.setItem('shirma_canvas_view', canvasView);
    localStorage.setItem('shirma_canvas_sections', JSON.stringify([...sectionCollapsed]));
  }catch(e){}
}
function canvasGroups(list){
  const defs = [['pc','Персонажи'],['note','Заметки'],['rule','Правила'],['img','Файлы']];
  const groups = [];
  defs.forEach(([type,title])=>{
    const items = list.filter(b=> b.type === type);
    if(items.length) groups.push({ key:type, title, items });
  });
  const other = list.filter(b=> !defs.some(([t])=> b.type===t));
  if(other.length) groups.push({ key:'other', title:'Другое', items:other });
  return groups;
}
function cardMatchesQuery(b, q){
  if(!q) return true;
  const props = Object.values(b.props||{}).join(' ').toLowerCase();
  return (b.title||'').toLowerCase().includes(q) || (b.text||'').toLowerCase().includes(q) || props.includes(q);
}
function updateCanvasTools(){
  document.querySelectorAll('.canvas-cols button').forEach(b=>{
    b.classList.toggle('on', (+b.dataset.cols||0) === canvasCols);
    b.disabled = canvasView === 'list';
  });
  document.querySelectorAll('.canvas-view button').forEach(b=>{
    b.classList.toggle('on', (b.dataset.view || 'grid') === canvasView);
  });
  const tools = document.querySelector('.canvas-tools');
  if(tools) tools.classList.toggle('mode-list', canvasView === 'list');
  const btn = document.getElementById('canvasCollapseAll');
  if(!btn) return;
  const base = blocksTab==='monsters' ? blocks.filter(b=> b.type==='mob') : blocks.filter(b=> b.type!=='mob');
  const anyOpen = base.some(b=> !collapsed.has(b.id));
  btn.textContent = anyOpen ? 'Свернуть всё' : 'Развернуть всё';
}
function render(){
  const canvas = document.getElementById('canvas');
  canvas.classList.toggle('free', freeLayout);
  canvas.style.setProperty('--canvas-cols', canvasEffectiveCols());
  const viewChars = document.getElementById('view-chars');
  if(viewChars) viewChars.classList.toggle('show-monsters', blocksTab==='monsters');
  let base = blocksTab==='monsters'
    ? blocks.filter(b=> b.type==='mob')
    : blocks.filter(b=> b.type!=='mob');
  let list = searchFilter ? base.filter(matches) : (activeParentId===null ? base : base.filter(b=>b.id===activeParentId));
  const q = canvasQuery.trim().toLowerCase();
  if(q) list = list.filter(b=> cardMatchesQuery(b, q));
  const crumbEl = document.getElementById('crumbsRoot');
  if(crumbEl) crumbEl.textContent = (blocksTab==='monsters'?'Монстры':'Персонажи')
    + (searchFilter?' · результаты поиска':'') + (q?' · фильтр: '+canvasQuery.trim():'')
    + (activeParentId===null?'':(' / '+(findBlock(activeParentId)?.title||'корень')));

  if(!list.length){
    canvas.innerHTML = `<div class="canvas-watermark">${q ? 'По фильтру «'+escapeHtml(canvasQuery.trim())+'» ничего не найдено.' : (searchFilter?'Ничего не найдено.':(blocksTab==='monsters'?'Здесь будут монстры: «＋ Создать монстра» — пресет или пустая карточка, «Бестиарий» — готовые из книг.':'Добавьте первого персонажа — «＋ ПК» в правом меню.'))}</div>`;
  } else {
    const safeCard = b => { try { return blockCard(b); } catch(e){
      return `<div class="block" data-id="${b.id}"><div class="block-head"><div class="ttl-note"><span>${escapeHtml(b.title||'Блок')}</span></div></div><div class="block-body"><div class="hint">Ошибка отображения блока: ${escapeHtml(String((e&&e.message)||e))}</div></div></div>`;
    } };
    if(freeLayout){
      canvas.innerHTML = list.map((b,idx)=>{
        const card = safeCard(b);
        const x = b.x!=null?b.x:(24 + (idx%12)*32), y = b.y!=null?b.y:(24 + (idx%12)*26);
        return `<div class="canvas-free-wrap" style="position:absolute;left:${x}px;top:${y}px;width:${b.w||360}px;z-index:${b._z||0}">${card}</div>`;
      }).join('');
    } else {
      const flowCls = 'canvas-flow' + (canvasView === 'list' ? ' view-list' : '');
      if(blocksTab === 'monsters'){
        canvas.innerHTML = `<div class="${flowCls}">` + list.map(safeCard).join('') + `</div>`;
      } else {
        let html = '';
        canvasGroups(list).forEach(g=>{
          const closed = sectionCollapsed.has(g.key);
          html += `<div class="canvas-section${closed ? ' closed' : ''}" data-sec="${g.key}">`
            + `<button type="button" class="cs-toggle" data-section="${g.key}" aria-expanded="${closed ? 'false' : 'true'}" title="${closed ? 'Развернуть раздел' : 'Свернуть раздел'}">${closed ? '▸' : '▾'}</button>`
            + `<span class="cs-title">${g.title}</span><span class="cs-count">${g.items.length}</span></div>`;
          if(!closed) html += g.items.map(safeCard).join('');
        });
        canvas.innerHTML = `<div class="${flowCls}">` + html + `</div>`;
      }
    }
  }
  updateCanvasTools();
  save();
}

function blockIsWide(b){
  let len = String(b.text||'').length;
  if(b.type==='mob' && b.mdata && Array.isArray(b.mdata.acts)){
    b.mdata.acts.forEach(a=>{ len += String((a&&a.text)||'').length; });
  }
  return len > 800;
}

function blockSummary(b){
  const p = b.props||{};
  const pick = b.type==='mob'
    ? [['Опасн.','ОП'],['КД','КД'],['ХП','ХП']]
    : (b.type==='pc' ? [['Класс','Класс'],['Раса','Раса'],['Броня КК','КД']] : []);
  return pick.map(([k,lbl])=>{
    const v = p[k];
    return (v!=null && String(v).trim()!=='') ? lbl+': '+String(v) : '';
  }).filter(Boolean).slice(0,3).join(' · ');
}
/* ═══ Связи между карточками ═══ */
function linkTarget(v){
  if(v==null) return null;
  const s=String(v);
  return blocks.find(b=>b.id===s) || blocks.find(b=>b.title===s) || null;
}
function linkedBlocksOf(b){
  if(!b) return [];
  const out=[], seen=new Set([b.id]);
  const push=t=>{ if(t && !seen.has(t.id)){ seen.add(t.id); out.push(t); } };
  (Array.isArray(b.links)?b.links:[]).forEach(v=> push(linkTarget(v)));
  blocks.forEach(o=>{
    if(seen.has(o.id)) return;
    const arr=Array.isArray(o.links)?o.links:[];
    if(arr.some(v=> v===b.id || v===b.title)) push(o);
  });
  return out.sort((a,c)=> String(a.title||'').localeCompare(String(c.title||''),'ru'));
}
let sessionsPeeked = false;
function sessionsForBlock(b){
  if(!b) return [];
  try{
    if(typeof sessions === 'undefined' || !Array.isArray(sessions)) return [];
    if(!sessionsPeeked){
      sessionsPeeked = true;
      if(!sessionsInited && !sessions.length && typeof loadSessions === 'function') loadSessions();
    }
    return sessions.filter(s=> Array.isArray(s.links) && s.links.includes(b.id));
  }catch(e){ return []; }
}
function mapMarkersForBlock(b){
  try{
    if(typeof maps === 'undefined' || !Array.isArray(maps)) return [];
    const out=[];
    maps.forEach(m=> (m.markers||[]).forEach(k=>{
      if(k && k.blockId===b.id) out.push({map:m, marker:k});
    }));
    return out;
  }catch(e){ return []; }
}
function mapRowHtml(b){
  const list=mapMarkersForBlock(b);
  if(!list.length) return '';
  return `<div class="card-links card-map"><span class="cl-lbl">На карте</span>${list.map(({map,marker})=>`<button type="button" class="cl-chip" data-map-open="${map.id}" data-map-marker="${marker.id}" title="Перейти к метке на карте">${escapeHtml(map.name||'Карта')}: ${escapeHtml(marker.label||'метка')}</button>`).join('')}</div>`;
}
function sessionsRowHtml(b){
  const list = sessionsForBlock(b);
  if(!list.length) return '';
  return `<div class="card-links card-sessions"><span class="cl-lbl">Сессии</span>${list.map(s=>`<button type="button" class="cl-chip" data-session-open="${s.id}" title="Открыть сессию">${escapeHtml(s.title||'Сессия')}</button>`).join('')}</div>`;
}
function linksHtml(b){
  const list = linkedBlocksOf(b);
  const chips = list.map(t=>{
    const title = t.title || '(без названия)';
    return `<button type="button" class="cl-chip" data-link-open="${t.id}" title="${escapeHtml((TYPE_LABEL[t.type]||'Карточка')+': '+title)}"><span>${escapeHtml(title)}</span></button>`;
  }).join('');
  return `<div class="card-links">
    <span class="cl-lbl">Связи</span>${chips}
    <button type="button" class="cl-add" data-link-edit="${b.id}" title="Добавить или убрать связи">＋ Связь</button>
  </div>` + sessionsRowHtml(b) + mapRowHtml(b);
}
function blockCard(b){
  const open = !collapsed.has(b.id);
  const border = 'border-'+b.type;
  const ttype = TYPE_LABEL[b.type];
  const w = b.w || 820;
  const wide = blockIsWide(b) ? ' block-wide' : '';
  const sum = open ? '' : blockSummary(b);
  const sessList = open ? [] : sessionsForBlock(b);
  const sessBadge = sessList.length
    ? `<button type="button" class="sess-badge" data-session-open="${sessList[0].id}" title="${escapeHtml(sessList.map(s=>s.title||'Сессия').join(', '))}">◈ ${sessList.length}</button>`
    : '';
  const mapList = open ? [] : mapMarkersForBlock(b);
  const mapBadge = mapList.length
    ? `<button type="button" class="sess-badge map-badge" data-map-open="${mapList[0].map.id}" data-map-marker="${mapList[0].marker.id}" title="${escapeHtml(mapList.map(x=>x.map.name||'Карта').join(', '))}">⌖ ${mapList.length}</button>`
    : '';
  const li = `<div class="block ${border}${wide}" data-id="${b.id}" style="width:${w}px">
    <div class="block-head" data-toggle>
      <span class="collapse ${open?'':'collapsed'}">▸</span>
      <div class="ttl-note">
        <span class="block-title" data-title="${b.id}" contenteditable="true" spellcheck="false" title="Кликните, чтобы переименовать">${escapeHtml(b.title||'(без названия)')}</span>
        <span class="type-tag ${b.type}">${ttype}</span>
        ${b.type==='pc' ? blockHpBarHtml(b) : ''}
        ${sum ? `<span class="block-sum" title="${escapeHtml(sum)}">${escapeHtml(sum)}</span>` : ''}
        ${sessBadge}
        ${mapBadge}
        ${open ? '' : `<button class="del del-head" data-action="delete" data-id="${b.id}" title="Удалить блок" aria-label="Удалить блок">✕</button>`}
      </div>
    </div>
    ${ open ? bodyHtml(b) : '' }
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

function autoTextareaStyle(text){
  const lines = String(text || '').split('\n');
  const est = lines.reduce((n, line)=> n + Math.max(1, Math.ceil(line.length / 70)), 0);
  const h = Math.max(72, Math.min(460, est * 21 + 14));
  return `min-height:${h}px; height:${h}px`;
}
function blockFoot(b){
  const rollAll = b.type==='pc'
    ? `<button data-action="rollAll" data-roll-id="${b.id}" title="Бросить d20 по всем характеристикам">Бросок всех</button>`
    : '';
  const battleMap = (b.type==='pc'||b.type==='mob')
    ? `<button data-action="battle" data-battle-id="${b.id}" title="Добавить во вкладку «Бой»">${gi('battle')} В бой</button><button data-action="map" data-map-id="${b.id}" title="Поставить на карту">${gi('map')} На карту</button>`
    : '';
  const tplBtn = b.type!=='img'
    ? `<button data-action="tpl" data-tpl-id="${b.id}" title="Сохранить карточку как шаблон">В шаблон</button>`
    : '';
  const printBtn = `<button data-action="print" data-print-id="${b.id}" title="Печать карточки или сохранение в PDF">${gi('export')} Печать</button>`;
  return `<div class="block-foot">
        ${rollAll}
        ${battleMap}
        ${tplBtn}
        ${printBtn}
        <span class="size-info" title="Ширина карточки">↔ <input class="resize-input" type="number" min="200" max="1600" step="20" value="${b.w||820}" data-width="${b.id}" title="Ширина блока, px"></span>
        <button class="del" data-action="delete">Удалить блок</button>
      </div>`;
}
function bodyHtml(b){
  if(b.type==='mob' && b.mdata){
    return `<div class="block-body">${mobStatBlockHtml(b)}
      <div class="card-notes">
        <div class="hint">Текстовая заметка к статблоку:</div>
        <textarea data-field="text" data-id="${b.id}" style="${autoTextareaStyle(b.text)}">${escapeHtml(b.text)}</textarea>
      </div>${linksHtml(b)}</div>
      ${blockFoot(b)}`;
  }
  if(b.type==='pc' || b.type==='mob'){
    const props = `<div class="props">`+Object.entries(b.props).map(([k,v])=>{
      const full = escapeHtml(k)+': '+escapeHtml(String(v==null?'':v));
      return `<label class="prop" title="${full}"><input class="v" data-prop-key="${escapeHtml(k)}" data-prop-id="${b.id}" value="${escapeHtml(String(v))}"><span class="lbl">${escapeHtml(k)}</span></label>`;
    }).join('')+`</div>`;
    const attackRow = b.type==='pc'
      ? `<div class="attack-row">
          <span class="lbl">Атака:</span>
          <input class="attack-input" type="text" data-attack="${b.id}" value="${escapeHtml(b.attack!==undefined?b.attack:'+0')}" placeholder="+бонус" title="Бонус атаки, напр. +5">
          <span class="lbl">Урон:</span>
          <input class="attack-input dmg-input" type="text" data-damage="${b.id}" value="${escapeHtml(b.damage!==undefined?b.damage:'')}" placeholder="1d8+3" title="Запись урона: кубик и бонус">
        </div>`
      : '';
    const left = `<div class="card-col-left">
      ${props}
      ${b.type==='pc'?`<div class="atts"><div class="atts-title">Характеристики</div>${statsInput(b)}</div>`:statsInput(b)}
      ${attackRow}
    </div>`;
    const right = `<div class="card-col-right">
      ${b.type==='pc'?resourcesHtml(b):''}
      <textarea data-field="text" data-id="${b.id}" placeholder="Заметки…" style="${autoTextareaStyle(b.text)}">${escapeHtml(b.text)}</textarea>
    </div>`;
    return `<div class="block-body"><div class="card-cols">${left}${right}</div>${linksHtml(b)}</div>
      ${blockFoot(b)}`;
  }
  let inner='';
  if(b.type==='img'){
    const src = safeMediaSrc(mediaFor(b));
    if(src && b.kind==='image'){
      inner += `<div class="block-img-prev"><img src="${escapeHtml(src)}" alt="${escapeHtml(b.fileName||'')}"></div>`;
    } else if(src && b.kind==='doc'){
      inner += `<div class="block-doc"><span class="doc-ico">${docIcon(b.fileName)}</span>
        <span class="doc-name">${escapeHtml(b.fileName||'документ')}</span>
        <span class="doc-size">${escapeHtml(b.sizeLabel||'')}</span>
        <a class="doc-open" href="${escapeHtml(src)}" download="${escapeHtml(b.fileName||'doc')}">Скачать</a>
        <a class="doc-open" href="${escapeHtml(src)}" target="_blank" rel="noopener">Открыть</a>
      </div>`;
    }
  }
  inner += `<textarea data-field="text" data-id="${b.id}" style="${autoTextareaStyle(b.text)}">${escapeHtml(b.text)}</textarea>`;
  return `<div class="block-body">${inner}${linksHtml(b)}</div>
    ${blockFoot(b)}`;
}
/* ═══ Ресурсы (ячейки, патроны, вдохновение и т.п.) ═══ */
function resourcesHtml(b){
  const list = b.res || [];
  return `<div class="res-row">
    <span class="lbl res-lbl">Ресурсы:</span>
    <span class="res-list">
      ${list.map((r,i)=>`
        <span class="res-chip ${r.cur<=0?'empty':''}" data-res-chip="${b.id}" data-res-i="${i}">
          <button class="res-btn" data-res-op="dec" data-res-id="${b.id}" data-res-i="${i}" title="Минус один">−</button>
          <span class="res-name" contenteditable="true" spellcheck="false" data-res-name="${b.id}" data-res-i="${i}" title="Клик — переименовать">${escapeHtml(r.name||'Ресурс')}</span>
          <span class="res-val" data-res-val="${b.id}" data-res-i="${i}">${r.cur}/${r.max}</span>
          <button class="res-btn" data-res-op="inc" data-res-id="${b.id}" data-res-i="${i}" title="Плюс один">+</button>
          <button class="res-x" data-res-del="${b.id}" data-res-i="${i}" title="Удалить ресурс">✕</button>
        </span>`).join('')}
      <button class="res-add" data-res-add="${b.id}" title="Добавить ресурс">＋ Ресурс</button>
    </span>
  </div>`;
}
function findBlockRes(id, i){ const b=findBlock(id); if(!b) return null; return (b.res||[])[i]; }
/* ═══ ХП и урон на листе ПК ═══ */
/* ═══ Общая шкала здоровья: лист ПК и карточка боя ═══ */
function hpMaxNum(v){
  const n = +v;
  return (v !== '' && v != null && n > 0) ? n : 0;
}
function hpCurNum(v){
  return (v === '' || v == null) ? null : Math.max(0, Math.round(+v) || 0);
}
function woundOf(ratio){
  if(ratio === null) return '';
  if(ratio <= 0) return 'dead';
  if(ratio <= 0.1) return 'critical';
  if(ratio <= 0.5) return 'wounded';
  return '';
}
function woundLabel(st){
  return st === 'dead' ? '☠ выбыл' : st === 'critical' ? 'окровавлен' : st === 'wounded' ? 'потрёпан' : '';
}
function hpMaxOf(b){ return Math.max(0, parseInt(b.props && b.props['ХП'] || b.props && b.props['HP']) || 0); }
function hpCurOf(b){
  const max=hpMaxOf(b);
  return Math.max(0, Math.min(max, max - Math.max(0, Math.round(+b.dmg)||0)));
}
function blockHpInfo(b){
  const max = hpMaxOf(b);
  if(!max) return null;
  const cur = hpCurOf(b);
  return { max, cur, state: woundOf(cur / max) };
}
function blockHpBarHtml(b){
  const info = blockHpInfo(b);
  if(!info) return '';
  const pct = Math.max(0, Math.min(100, Math.round(info.cur/info.max*100)));
  const crit = (info.state==='critical' || info.state==='dead');
  const cls = crit ? ' crit' : (info.state==='wounded' ? ' warn' : '');
  const label = woundLabel(info.state);
  return `<span class="bt-hpbar${cls}" title="ХП ${info.cur}/${info.max}"><i style="width:${pct}%"></i></span>` +
         (label ? `<span class="bt-wound${crit?' crit':''}">${label}</span>` : '');
}
function hpApply(bid, op){
  const b=findBlock(bid); if(!b) return;
  const hpMax=hpMaxOf(b);
  let cur=hpCurOf(b);
  if(op==='d5') cur-=5;
  else if(op==='d1') cur-=1;
  else if(op==='h1') cur+=1;
  else if(op==='h5') cur+=5;
  else if(op==='healFull'){ cur=hpMax; }
  cur=Math.max(0, Math.min(hpMax, cur));
  b.dmg = hpMax - cur;
  if(syncBlockToTokens(b) && currentTab==='map') renderMap();
  const el=document.querySelector('[data-hp-val="'+b.id+'"]');
  if(el){
    el.textContent = cur;
    el.classList.toggle('knocked', cur<=0 && hpMax>0);
    const row=el.closest('.hp-row');
    const tag=row && row.querySelector('.hp-dead');
    if(tag) tag.remove();
    if(cur<=0 && hpMax>0 && row){
      const s=document.createElement('span'); s.className='hint hp-dead'; s.style.color='var(--danger)'; s.textContent='☠ выбыл';
      row.appendChild(s);
    }
  }
  save();
  renderBlockOnly(b.id);
}
function hpInputDamage(inEl){
  const b=findBlock(inEl.dataset.hpIn); if(!b) return;
  const n=Math.round(+inEl.value)||0;
  if(n>0){
    const hpMax=hpMaxOf(b);
    b.dmg = Math.min(hpMax, Math.max(0, Math.round(+b.dmg||0) + n));
    save();
  }
  inEl.value='';
  hpApply(inEl.dataset.hpIn, 'refresh'); // перерисовать значение/метку
}
function mobStatBlockHtml(b){
  const d=b.mdata||{};
  const AB_RU={Str:'СИЛ',Dex:'ЛОВ',Con:'ТЕЛ',Int:'ИНТ',Wis:'МУД',Cha:'ХАР'};
  const abRow = (d.ab_list||[]).map(a=>`
    <div class="mob-ab"><div class="mob-ab-k">${AB_RU[a.k]||a.k}</div>
      <div class="mob-ab-v">${a.v}</div>
      <div class="mob-ab-m">${a.m>=0?'+'+a.m:a.m}${a.s&&a.s!==(a.m>=0?'+'+a.m:a.m)?' ('+a.s+')':''}</div>
    </div>`).join('');
  const actsHtml = (d.acts && d.acts.length)
    ? actsGroupsHtml(d)
    : '<div class="mob-section"><div class="mob-sec-title">Действия</div><div class="mob-act muted">В источнике нет описания действий — допишите их в заметке ниже.</div></div>';
  return `<div class="card-cols">
      <div class="card-col-left">
        <div class="mob-type">${escapeHtml(d.type||'')}</div>
        <div class="mob-meta-row">
          <span>КД <b>${escapeHtml(d.ac||'—')}</b></span>
          <span>ХП <b>${escapeHtml(d.hp||'—')}</b></span>
          <span>Скорость <b>${escapeHtml(d.sp||'—')}</b></span>
        </div>
        <div class="mob-ab-row">${abRow}</div>
        ${d.sk?`<div class="mob-line"><b>Навыки</b> ${escapeHtml(d.sk)}</div>`:''}
        ${d.sen?`<div class="mob-line"><b>Чувства</b> ${escapeHtml(d.sen)}</div>`:''}
        ${d.lang?`<div class="mob-line"><b>Языки</b> ${escapeHtml(d.lang)}</div>`:''}
        ${d.sav?`<div class="mob-line"><b>Спасброски</b> ${escapeHtml(d.sav)}</div>`:''}
        ${d.imm?`<div class="mob-line"><b>Защита</b> ${escapeHtml(d.imm)}</div>`:''}
        <div class="mob-line"><b>Опасность</b> ${escapeHtml(shortCr(d.cr))}</div>
        <div class="mob-line"><b>Инициатива</b> ${escapeHtml(d.init||'—')}</div>
      </div>
      <div class="card-col-right">
        ${actsHtml}
      </div>
    </div>`;
}
/* Общий разбор действия монстра: «Название. Текст» */
function highlightAct(text){
  let h = escapeHtml(String(text||''));
  h = h.replace(/\d+\s*\(\s*\d+d\d+(?:\s*[+\-−]\s*\d+)?\s*\)|\d+d\d+(?:\s*[+\-−]\s*\d+)?/g, '<b class="hit-dmg">$&</b>');
  h = h.replace(/((?:атака|атаки|атаке|атаку|попаданию)\s*:\s*)([+\-−]\s*\d+)/gi, '$1<b class="hit-atk">$2</b>');
  h = h.replace(/([+\-−]\s*\d+)(\s+к\s+попаданию)/gi, '<b class="hit-atk">$1</b>$2');
  return h;
}
function splitAct(txt){
  const s=String(txt||''); const ci=s.indexOf('. ');
  return ci>0 ? { name:s.slice(0,ci), body:s.slice(ci+2) } : { name:'', body:s };
}
/* Группировка действий по тегам, порядок фиксированный */
const ACT_TAG_ORDER=['Черты','Действия','Бонус','Реакция','Легендарные'];
function actsGroupsHtml(d){
  const groups={};
  (d.acts||[]).forEach(a=>{ (groups[a.tag]=groups[a.tag]||[]).push(a.text); });
  let html='';
  ACT_TAG_ORDER.forEach(tag=>{
    if(groups[tag] && groups[tag].length){
      html += `<div class="mob-section"><div class="mob-sec-title">${escapeHtml(tag)}</div>`;
      groups[tag].forEach(txt=>{
        const {name, body}=splitAct(txt);
        html += `<div class="mob-act"><b>${escapeHtml(name)}</b> ${highlightAct(body)}</div>`;
      });
      html += `</div>`;
    }
  });
  return html;
}
function docIcon(name){
  const n=(name||'').toLowerCase();
  if(n.endsWith('.pdf')||n.endsWith('.docx')||n.endsWith('.doc')) return gi('book');
  return gi('note');
}

/* ════════════ Helpers ════════════ */
function modf(s){ return Math.floor((s-10)/2); }
function signed(n){ return (n>=0?'+':'')+n; }
function escapeHtml(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function matches(b){
  if(!searchFilter) return true;
  const q = searchFilter.toLowerCase();
  const props = Object.values(b.props||{}).join(' ').toLowerCase();
  const resNames = Array.isArray(b.res) ? b.res.map(r=>(r&&r.name)||'').join(' ') : '';
  return (b.title||'').toLowerCase().includes(q) || (b.text||'').toLowerCase().includes(q)
    || props.includes(q) || resNames.toLowerCase().includes(q);
}

