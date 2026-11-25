/* Хроника кампании: таймлайн сессий и последние события боя. */
(function(){
  const modal = document.getElementById('chronicleModal');
  const btn = document.getElementById('btnChronicle');
  if(!modal || !btn) return;
  const body = document.getElementById('chronicleBody');
  const closeBtn = document.getElementById('chronicleClose');
  const exportBtn = document.getElementById('chronicleExport');

  function esc(v){ return (typeof escapeHtml === 'function' ? escapeHtml(String(v || '')) : String(v || '')); }
  function items(){
    try{
      if(typeof sessions !== 'undefined' && Array.isArray(sessions)) return sessions;
      const a = JSON.parse(localStorage.getItem('shirma_sessions_v1') || '[]');
      return Array.isArray(a) ? a : [];
    }catch(e){ return []; }
  }
  function logItems(){
    try{
      if(typeof battleLog !== 'undefined' && Array.isArray(battleLog)) return battleLog;
      const a = JSON.parse(localStorage.getItem('shirma_battle_log_v1') || '[]');
      return Array.isArray(a) ? a : [];
    }catch(e){ return []; }
  }
  function text(html){
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return (d.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 260);
  }
  function date(ts){
    if(!ts) return '';
    try{ return new Date(ts).toLocaleDateString('ru-RU', { day:'2-digit', month:'short', year:'numeric' }); }
    catch(e){ return ''; }
  }
  function build(){
    const list = items().slice().sort((a,b)=> (+b.updated||0) - (+a.updated||0));
    const log = logItems().slice(-30).reverse();
    const sessionsHtml = list.length ? list.map(s=>`<article class="chr-item">
      <div class="chr-top"><b>${esc(s.title || 'Без названия')}</b><span>${esc(date(s.updated))}</span></div>
      <p>${esc(text(s.html) || 'Нет заметок.')}</p>
    </article>`).join('') : '<p class="hint">Пока нет сессий.</p>';
    const logHtml = log.length ? log.map(x=>`<div class="chr-log">${esc(typeof x === 'string' ? x : JSON.stringify(x))}</div>`).join('') : '<p class="hint">Журнал боя пуст.</p>';
    body.innerHTML = `<section class="chronicle-sec"><h3>Сессии</h3>${sessionsHtml}</section>
      <section class="chronicle-sec"><h3>Последние события боя</h3>${logHtml}</section>`;
  }
  function open(){
    build();
    openModal(modal, document.activeElement);
  }
  function exportMd(){
    const list = items().slice().sort((a,b)=> (+a.updated||0) - (+b.updated||0));
    const md = ['# Хроника кампании', ''].concat(list.map(s=>`## ${s.title || 'Без названия'}\n\n${text(s.html) || ''}\n`)).join('\n');
    if(typeof downloadFile === 'function') downloadFile('hronika-kampanii.md', md, 'text/markdown;charset=utf-8');
    else if(typeof saveFile === 'function') saveFile('hronika-kampanii.md', md, 'text/markdown');
    else toast('Экспорт недоступен');
  }
  btn.addEventListener('click', open);
  if(closeBtn) closeBtn.addEventListener('click', ()=> closeModal(modal));
  modal.addEventListener('click', e=>{ if(e.target === modal) closeModal(modal); });
  if(exportBtn) exportBtn.addEventListener('click', exportMd);
  window.renderChronicle = build;
})();
