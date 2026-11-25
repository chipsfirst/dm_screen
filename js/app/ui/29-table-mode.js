/* Режим «За столом»: крупная навигация без верхней панели. */
(function(){
  const btn = document.getElementById('btnTableMode');
  const bar = document.getElementById('tableBar');
  if(!btn || !bar) return;
  const exit = document.getElementById('tableExit');
  const KEY = 'shirma_table_mode_v1';

  function currentTab(){
    const t = document.querySelector('.tab.active');
    return t ? t.dataset.tab : 'chars';
  }
  function sync(){
    const cur = currentTab();
    bar.querySelectorAll('[data-tm-tab]').forEach(b=> b.classList.toggle('active', b.dataset.tmTab === cur));
  }
  function open(){
    document.body.classList.add('table-mode');
    bar.hidden = false;
    btn.setAttribute('aria-pressed', 'true');
    if(typeof showTab === 'function') showTab('chars');
    sync();
    try{
      const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      if(p && p.catch) p.catch(()=>{});
    }catch(e){}
  }
  function close(){
    document.body.classList.remove('table-mode');
    bar.hidden = true;
    btn.setAttribute('aria-pressed', 'false');
    if(document.fullscreenElement && document.exitFullscreen){
      try{ document.exitFullscreen().catch(()=>{}); }catch(e){}
    }
  }
  btn.addEventListener('click', ()=>{
    if(document.body.classList.contains('table-mode')) close();
    else open();
  });
  if(exit) exit.addEventListener('click', close);
  bar.addEventListener('click', e=>{
    const tab = e.target.closest('[data-tm-tab]');
    if(tab){
      if(typeof showTab === 'function') showTab(tab.dataset.tmTab);
      setTimeout(sync, 0);
      return;
    }
    if(e.target.closest('[data-tm-action="rules"]')){
      if(typeof openRulesPanel === 'function') openRulesPanel();
      else document.getElementById('btnRules')?.click();
    }
  });
  document.addEventListener('keydown', e=>{
    if(e.key !== 'Escape' || !document.body.classList.contains('table-mode')) return;
    if(document.querySelector('.modal:not([hidden]), .ref-modal:not([hidden])')) return;
    close();
  });
  document.addEventListener('fullscreenchange', ()=>{
    if(!document.fullscreenElement && document.body.classList.contains('table-mode')){
      close();
    }
  });
  try{ if(localStorage.getItem(KEY) === '1' && !sessionStorage.getItem(KEY)) open(); }catch(e){}
  window.addEventListener('beforeunload', ()=>{ try{ localStorage.setItem(KEY, document.body.classList.contains('table-mode') ? '1' : '0'); }catch(e){} });
})();
