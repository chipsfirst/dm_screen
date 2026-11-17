/* ════════════ Проверка целостности данных ════════════ */
(function smokeCheck(){
  const btn = document.getElementById('btnDataCheck');
  if(!btn) return;
  function read(key, fallback){
    try{ const v = JSON.parse(localStorage.getItem(key) || 'null'); return v == null ? fallback : v; }
    catch(e){ return null; }
  }
  function run(){
    const issues = [];
    const bs = (typeof blocks !== 'undefined' && Array.isArray(blocks)) ? blocks : [];
    const ids = new Set(), titles = new Set();
    bs.forEach(b=>{ if(b && b.id) ids.add(b.id); if(b && b.title) titles.add(b.title); });
    const dup = new Set(), seen = new Set();
    bs.forEach(b=>{ if(!b || !b.id) return; if(seen.has(b.id)) dup.add(b.id); seen.add(b.id); });
    if(dup.size) issues.push('Повторяющиеся id карточек: '+[...dup].slice(0,5).join(', '));
    let brokenLinks = 0;
    bs.forEach(b=>{
      (Array.isArray(b.links) ? b.links : []).forEach(v=>{
        if(!ids.has(v) && !titles.has(v)) brokenLinks++;
      });
    });
    if(brokenLinks) issues.push('Битых связей карточек: '+brokenLinks);

    const sess = read('shirma_sessions_v1', []);
    if(sess === null){ issues.push('Файл сессий повреждён и не читается'); }
    else if(Array.isArray(sess)){
      let broken = 0;
      sess.forEach(s=> (Array.isArray(s.links) ? s.links : []).forEach(v=>{ if(!ids.has(v)) broken++; }));
      if(broken) issues.push('Ссылок сессий на удалённые карточки: '+broken);
    }

    const mapsData = read('shirma_map_v1', []);
    if(mapsData === null){ issues.push('Файл карт повреждён и не читается'); }
    else if(Array.isArray(mapsData)){
      let broken = 0;
      mapsData.forEach(m=> (m.markers||[]).forEach(k=>{ if(k && k.blockId && !ids.has(k.blockId)) broken++; }));
      if(broken) issues.push('Меток на картах без карточки: '+broken);
    }

    const extra = read('shirma_extra_timers_v1', []);
    if(extra === null) issues.push('Дополнительные таймеры повреждены');
    const fav = read('shirma_favorites_v1', []);
    if(fav === null) issues.push('Избранное повреждено');

    const result = issues.length
      ? 'Найдены проблемы ('+issues.length+'):\n\n• '+issues.join('\n• ')
      : 'Проблем не найдено.\n\nКарточек: '+bs.length+' · сессий: '+(Array.isArray(sess)?sess.length:0)+' · карт: '+(Array.isArray(maps)?maps.length:0)+'.';
    uiAlert(result);
  }
  btn.addEventListener('click', run);
})();
