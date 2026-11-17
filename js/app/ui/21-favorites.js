/* ════════════ Избранное в бестиарии и библиотеке ════════════ */
(function favorites(){
  const KEY = 'shirma_favorites_v1';
  let set = new Set();
  try{
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    if(Array.isArray(a)) set = new Set(a.filter(x=>typeof x === 'string'));
  }catch(e){}
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify([...set])); }catch(e){}
  }
  function has(key){ return set.has(key); }
  function toggle(key){
    if(set.has(key)) set.delete(key); else set.add(key);
    save();
  }
  window.favHas = has;
  window.libFavKey = function(r){
    if(!r) return '';
    if(r.kind === 'spell') return 'lib:spell:' + (r.sp && r.sp.n);
    if(r.kind === 'item') return 'lib:item:' + (r.it && r.it.n);
    if(r.kind === 'feat') return 'lib:feat:' + (r.feat && r.feat.n);
    if(r.kind === 'rule') return 'lib:rule:' + (r.rule && r.rule.title);
    return '';
  };
  const libResults = document.getElementById('libResults');
  const bestResults = document.getElementById('bestResults');
  if(libResults) libResults.addEventListener('click', e=>{
    const b = e.target.closest('[data-fav]');
    if(!b) return;
    e.preventDefault(); e.stopPropagation();
    toggle(b.dataset.fav);
    if(typeof renderLib === 'function') renderLib();
  }, true);
  if(bestResults) bestResults.addEventListener('click', e=>{
    const b = e.target.closest('[data-fav]');
    if(!b) return;
    e.preventDefault(); e.stopPropagation();
    toggle(b.dataset.fav);
    if(typeof renderBestiary === 'function') renderBestiary();
  }, true);

  function bindFilter(id, flag, render){
    const b = document.getElementById(id);
    if(!b) return;
    function sync(){
      b.classList.toggle('on', !!window[flag]);
      b.setAttribute('aria-pressed', window[flag] ? 'true' : 'false');
    }
    b.addEventListener('click', ()=>{
      window[flag] = !window[flag];
      sync();
      if(typeof render === 'function') render();
    });
    sync();
  }
  bindFilter('libFavBtn', 'libFavOnly', window.renderLib || (typeof renderLib === 'function' ? renderLib : null));
  bindFilter('bestFavBtn', 'bestFavOnly', window.renderBestiary || (typeof renderBestiary === 'function' ? renderBestiary : null));
})();
