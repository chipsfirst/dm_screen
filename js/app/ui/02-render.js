/* ════════════ Render: sidebar tree ════════════ */
/* ════════════════ Render: canvas ════════════════ */
function render(){
  const canvas = document.getElementById('canvas');
  canvas.classList.toggle('free', freeLayout);
  const viewChars = document.getElementById('view-chars');
  if(viewChars) viewChars.classList.toggle('show-monsters', blocksTab==='monsters');
  let base = blocksTab==='monsters'
    ? blocks.filter(b=> b.type==='mob')
    : blocks.filter(b=> b.type!=='mob');
  const list = searchFilter ? base.filter(matches) : (activeParentId===null ? base : base.filter(b=>b.id===activeParentId));
  const crumbEl = document.getElementById('crumbsRoot');
  if(crumbEl) crumbEl.textContent = (blocksTab==='monsters'?'Монстры':'Персонажи')
    + (searchFilter?' · результаты поиска':(activeParentId===null?'':(' / '+(findBlock(activeParentId)?.title||'корень'))));

  if(!list.length){
    canvas.innerHTML = `<div class="canvas-watermark">${searchFilter?'Ничего не найдено.':(blocksTab==='monsters'?'Здесь будут монстры: «＋ Создать монстра» — пресет или пустая карточка, «Бестиарий» — готовые из книг.':'Добавьте первого персонажа — «＋ ПК» в правом меню.')}</div>`;
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
      canvas.innerHTML = `<div class="canvas-flow">` + list.map(safeCard).join('') + `</div>`;
    }
  }
  save();
}

function blockIsWide(b){
  let len = String(b.text||'').length;
  if(b.type==='mob' && b.mdata && Array.isArray(b.mdata.acts)){
    b.mdata.acts.forEach(a=>{ len += String((a&&a.text)||'').length; });
  }
  return len > 800;
}

function blockCard(b){
  const open = !collapsed.has(b.id);
  const border = 'border-'+b.type;
  const ttype = TYPE_LABEL[b.type];
  const w = b.w || 820;
  const wide = blockIsWide(b) ? ' block-wide' : '';
  const li = `<div class="block ${border}${wide}" data-id="${b.id}" style="width:${w}px">
    <div class="block-head" data-toggle>
      <span class="collapse ${open?'':'collapsed'}">▸</span>
      <div class="ttl-note">
        <span class="block-title" data-title="${b.id}" contenteditable="true" spellcheck="false" title="Кликните, чтобы переименовать">${escapeHtml(b.title||'(без названия)')}</span>
        <span class="type-tag ${b.type}">${ttype}</span>
        ${b.type==='pc' ? blockHpBarHtml(b) : ''}
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
    ? `<button data-action="battle" data-battle-id="${b.id}" title="Добавить в вкладку «Бой»">${gi('battle')} В бой</button><button data-action="map" data-map-id="${b.id}" title="Поставить на карту">${gi('map')} На карту</button>`
    : '';
  return `<div class="block-foot">
        <button data-action="collapse">Свернуть</button>
        <button data-action="expand">Развернуть</button>
        ${rollAll}
        ${battleMap}
        <span class="size-info">Ширина: <input class="resize-input" type="number" min="200" max="1600" step="20" value="${b.w||820}" data-width="${b.id}" title="Ширина блока, px"></span>
        <span class="hint" style="margin-left:auto">редактируйте заголовок и текст прямо здесь</span>
        <button class="del" data-action="delete">Удалить блок</button>
      </div>`;
}
function bodyHtml(b){
  if(b.type==='mob' && b.mdata){
    return `<div class="block-body">${mobStatBlockHtml(b)}
      <div class="card-notes">
        <div class="hint">Текстовая заметка к статблоку:</div>
        <textarea data-field="text" data-id="${b.id}" style="${autoTextareaStyle(b.text)}">${escapeHtml(b.text)}</textarea>
      </div></div>
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
    return `<div class="block-body"><div class="card-cols">${left}${right}</div></div>
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
  return `<div class="block-body">${inner}</div>
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
        html += `<div class="mob-act"><b>${escapeHtml(name)}</b> ${escapeHtml(body)}</div>`;
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

