/* ═══ Печать карточки и статблока ═══ */

/* Клон карточки/статблока для печати: без кнопок, полей ввода и подвала */
function printSanitizeSheet(root){
  root.querySelectorAll('.cl-chip').forEach(btn=>{
    const s = document.createElement('span');
    s.className = 'ps-link';
    s.textContent = (btn.textContent || '').trim();
    btn.replaceWith(s);
  });
  root.querySelectorAll('.cl-add').forEach(el=> el.remove());
  root.querySelectorAll('.card-links').forEach(row=>{
    if(!row.querySelector('.ps-link')) row.remove();
  });
  root.querySelectorAll('button, .resize-handle, .block-foot, .del').forEach(el=> el.remove());
  root.querySelectorAll('input, textarea').forEach(el=>{
    const isArea = el.tagName === 'TEXTAREA';
    const val = (el.value !== undefined && el.value !== null) ? el.value : (el.textContent || '');
    const out = document.createElement(isArea ? 'div' : 'span');
    out.className = 'ps-val' + (isArea ? ' ps-pre' : '');
    out.textContent = isArea ? val : (String(val).trim() === '' ? '—' : val);
    el.replaceWith(out);
  });
  root.querySelectorAll('[contenteditable]').forEach(el=> el.removeAttribute('contenteditable'));
  return root;
}
function printSheetHead(title, sub){
  const sheet = document.createElement('article');
  sheet.className = 'print-sheet';
  const h = document.createElement('h1');
  h.className = 'ps-title';
  h.textContent = title || 'Карточка';
  sheet.appendChild(h);
  if(sub){
    const s = document.createElement('div');
    s.className = 'ps-sub';
    s.textContent = sub;
    sheet.appendChild(s);
  }
  return sheet;
}
function buildCardSheet(b){
  if(!b) return null;
  if(collapsed.has(b.id)){ collapsed.delete(b.id); render(); }
  const card = document.querySelector('#canvas [data-id="'+b.id+'"]');
  if(!card) return null;
  const sub = [TYPE_LABEL[b.type] || '', blockSummary(b)].filter(Boolean).join(' · ');
  const sheet = printSheetHead(b.title || 'Карточка', sub);
  const body = card.querySelector('.block-body');
  if(body) sheet.appendChild(printSanitizeSheet(body.cloneNode(true)));
  return sheet;
}
function buildBattleSheet(){
  if(!battleStatBid) return null;
  const body = document.getElementById('battleStatBody');
  if(!body) return null;
  const title = document.getElementById('battleStatTitle');
  const sub = document.getElementById('battleStatSub');
  const sheet = printSheetHead(title ? title.textContent : 'Статблок', sub ? sub.textContent : '');
  sheet.appendChild(printSanitizeSheet(body.cloneNode(true)));
  return sheet;
}
function openPrintSheets(sheets, title){
  const list = (Array.isArray(sheets) ? sheets : []).filter(Boolean);
  const wrap = document.getElementById('printSheetWrap');
  if(!wrap){ toast('Печать недоступна'); return; }
  if(!list.length){ toast('Нет данных для печати'); return; }
  wrap.innerHTML = '';
  list.forEach(s => wrap.appendChild(s));
  const t = document.getElementById('printTitle');
  if(t) t.textContent = title || 'Печать';
  const m = document.getElementById('printModal');
  if(m) openModal(m, document.activeElement);
}
function openPrintSheet(sheet, title){
  openPrintSheets(sheet ? [sheet] : [], title);
}
function buildBattleTrackerSheet(){
  const parts = (typeof battleParts !== 'undefined' && Array.isArray(battleParts)) ? battleParts.slice() : [];
  if(!parts.length) return null;
  let ordered = parts;
  try{ if(typeof battleOrder === 'function') ordered = battleOrder(); }catch(e){}
  const round = (typeof battleTurn !== 'undefined' && battleTurn && battleTurn.round) || 1;
  const sheet = printSheetHead('Бой', 'Раунд ' + round + ' · участников: ' + ordered.length);
  const table = document.createElement('table');
  table.className = 'print-table';
  const head = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Иниц.', 'Участник', 'ХП', 'КД', 'Состояния'].forEach(h=>{
    const th = document.createElement('th');
    th.textContent = h;
    hr.appendChild(th);
  });
  head.appendChild(hr);
  table.appendChild(head);
  const body = document.createElement('tbody');
  ordered.forEach(p=>{
    const tr = document.createElement('tr');
    const hp = (p.hp !== '' && p.hp != null ? p.hp : '—') + (p.hpMax ? '/' + p.hpMax : '');
    const vals = [
      p.init !== '' && p.init != null ? p.init : '—',
      p.name || 'Участник',
      hp,
      p.ac !== '' && p.ac != null ? p.ac : '—',
      (Array.isArray(p.statuses) ? p.statuses.join(', ') : '') || '—'
    ];
    vals.forEach((v,i)=>{
      const td = document.createElement('td');
      td.textContent = String(v);
      if(i === 1) td.className = 'pt-name';
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
  table.appendChild(body);
  sheet.appendChild(table);
  return sheet;
}
function openPrintAllCards(){
  if(typeof blocks === 'undefined' || !Array.isArray(blocks) || !blocks.length){
    toast('На ширме пока нет карточек'); return;
  }
  if(typeof collapsed !== 'undefined' && collapsed.size){
    collapsed.clear();
    if(typeof render === 'function') render();
  }
  const sheets = [];
  blocks.forEach(b=>{
    if(!b || !b.id) return;
    const s = buildCardSheet(b);
    if(s) sheets.push(s);
  });
  openPrintSheets(sheets, 'Печать ширмы: ' + sheets.length);
}
function openPrintBattle(){
  const sheet = buildBattleTrackerSheet();
  if(!sheet){ toast('В бою никого нет'); return; }
  openPrintSheet(sheet, 'Печать боя');
}
function openPrintCard(b){
  openPrintSheet(buildCardSheet(b), 'Печать: ' + ((b && b.title) || 'карточка'));
}
function openPrintBattleStat(){
  openPrintSheet(buildBattleSheet(), 'Печать статблока');
}
function closePrintModal(){
  const m = document.getElementById('printModal');
  if(m) closeModal(m);
}

(function initPrint(){
  const modal = document.getElementById('printModal');
  if(!modal) return;
  const close = document.getElementById('printClose');
  if(close) close.addEventListener('click', closePrintModal);
  modal.addEventListener('click', e=>{ if(e.target === modal) closePrintModal(); });
  const doBtn = document.getElementById('printDo');
  if(doBtn) doBtn.addEventListener('click', ()=>{
    try{ window.print(); }
    catch(e){ toast('Печать недоступна в этом окне — используйте браузерную версию'); }
  });
  document.addEventListener('keydown', e=>{
    if(e.key === 'Escape' && !modal.hidden){ e.preventDefault(); closePrintModal(); }
  });
  const battleBtn = document.getElementById('battleStatPrint');
  if(battleBtn) battleBtn.addEventListener('click', openPrintBattleStat);
  const allBtn = document.getElementById('btnPrintAll');
  if(allBtn) allBtn.addEventListener('click', openPrintAllCards);
  const trackerBtn = document.getElementById('btnPrintBattle');
  if(trackerBtn) trackerBtn.addEventListener('click', openPrintBattle);
})();
