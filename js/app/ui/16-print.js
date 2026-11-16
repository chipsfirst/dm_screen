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
function openPrintSheet(sheet, title){
  if(!sheet) return;
  const wrap = document.getElementById('printSheetWrap');
  if(!wrap){ toast('Печать недоступна'); return; }
  wrap.innerHTML = '';
  wrap.appendChild(sheet);
  const t = document.getElementById('printTitle');
  if(t) t.textContent = title || 'Печать';
  const m = document.getElementById('printModal');
  if(m) openModal(m, document.activeElement);
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
})();
