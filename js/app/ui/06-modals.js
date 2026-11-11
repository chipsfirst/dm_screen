/* ═══ Local library search (ленивая загрузка library-data.js) ═══ */
const DATA_VER = '1.3.4';
let wowLoadingPromise = null;
/* Ленивая загрузка wow-data.js (400 КБ): нужна магазину, библиотеке и бестиарию */
function ensureWow(){
  if(window.WOW_DATA) return Promise.resolve(window.WOW_DATA);
  if(wowLoadingPromise) return wowLoadingPromise;
  wowLoadingPromise = new Promise((resolve, reject)=>{
    const s=document.createElement('script');
    s.src='js/data/wow-data.js?v='+DATA_VER;
    s.onload=()=>{ applyWowData(); resolve(window.WOW_DATA); };
    s.onerror=()=>{ wowLoadingPromise=null; reject(new Error('не удалось загрузить wow-data.js')); };
    document.head.appendChild(s);
  });
  return wowLoadingPromise;
}
function applyWowData(){
  mergeWowSpells();
  mergeWowBestiary();
  if(typeof SHOP!=='undefined') mergeWowShop(SHOP);
  syncHomeBestiaryCount();
}
let LIB = null;
let libLoadingPromise = null;
function ensureLibrary(){
  if(window.LIBRARY){
    LIB=window.LIBRARY; booksLibMerged();
    return ensureWow().then(()=>{ booksLibMerged(); }).catch(()=>{});
  }
  if(libLoadingPromise) return libLoadingPromise;
  libLoadingPromise = new Promise((resolve, reject)=>{
    const s=document.createElement('script');
    s.src='js/data/library-data.js?v='+DATA_VER;
    s.onload=()=>{
      LIB=window.LIBRARY || { spells:[], items:[] };
      booksLibMerged();
      ensureWow().then(()=>{ booksLibMerged(); resolve(); }).catch(()=> resolve());
    };
    s.onerror=()=>{ libLoadingPromise=null; reject(new Error('не удалось загрузить library-data.js')); };
    document.head.appendChild(s);
  });
  return libLoadingPromise;
}
const RULES_FOR_LIB = BASE_RULES || [];
mergeBooksRules();
const libModal = document.getElementById('libModal');
const libSearch = document.getElementById('libSearch');
const libKind = document.getElementById('libKind');
const libResults = document.getElementById('libResults');

/* ═══ Модалки: роль, метка, фокус-трап и возврат фокуса ═══ */
let modalOpener = null;
let modalTrapEl = null, modalTrapKey = null;
const MODAL_FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function modalFocusables(m){
  return Array.prototype.filter.call(m.querySelectorAll(MODAL_FOCUSABLE), el=>{
    if(el.hidden || (el.getAttribute && el.getAttribute('aria-hidden') === 'true')) return false;
    let n = el.parentNode;
    while(n && n !== m){
      if(n.hidden) return false;
      n = n.parentNode;
    }
    return true;
  });
}
function modalLabelOf(m){
  const head = m.querySelector('.modal-head strong, .modal-head h1, .modal-head h2, .modal-head h3, .modal-head h4');
  if(head && head.textContent.trim()) return head.textContent.trim();
  const named = m.querySelector('[aria-label]');
  if(named) return named.getAttribute('aria-label') || '';
  return '';
}
function initModalA11y(){
  Array.prototype.forEach.call(document.querySelectorAll('.modal'), m=>{
    if(!m.hasAttribute('role')) m.setAttribute('role','dialog');
    if(!m.hasAttribute('aria-modal')) m.setAttribute('aria-modal','true');
    if(!m.hasAttribute('aria-label') && !m.hasAttribute('aria-labelledby')){
      const label = modalLabelOf(m);
      if(label) m.setAttribute('aria-label', label);
    }
    if(!m.hasAttribute('tabindex')) m.setAttribute('tabindex','-1');
  });
}
function releaseModalTrap(){
  if(modalTrapKey){ try{ document.removeEventListener('keydown', modalTrapKey, true); }catch(e){} }
  modalTrapKey = null; modalTrapEl = null;
}
function trapModal(m){
  releaseModalTrap();
  if(!m) return;
  modalTrapEl = m;
  modalTrapKey = function(e){
    if(e.key !== 'Tab' || !modalTrapEl) return;
    const list = modalFocusables(modalTrapEl);
    if(!list.length){ e.preventDefault(); try{ modalTrapEl.focus(); }catch(err){} return; }
    const first = list[0], last = list[list.length-1];
    const act = document.activeElement;
    const inside = act && modalTrapEl.contains(act);
    if(e.shiftKey){
      if(act === first || !inside){ e.preventDefault(); try{ last.focus(); }catch(err){} }
    } else if(act === last || !inside){
      e.preventDefault(); try{ first.focus(); }catch(err){}
    }
  };
  document.addEventListener('keydown', modalTrapKey, true);
}
function openModal(m, opener){
  modalOpener = opener || null;
  if(!m) return;
  if(!m.hasAttribute('role')) m.setAttribute('role','dialog');
  if(!m.hasAttribute('aria-modal')) m.setAttribute('aria-modal','true');
  m.hidden = false;
  trapModal(m);
  setTimeout(()=>{
    if(modalTrapEl !== m || m.hidden) return;
    if(document.activeElement && m.contains(document.activeElement)) return;
    const list = modalFocusables(m);
    try{ (list[0] || m).focus(); }catch(e){}
  }, 80);
}
try{ initModalA11y(); }catch(e){}
/* ═══ Универсальные диалоги вместо prompt/confirm/alert ═══ */
function uiDialog(opts){
  const o = Object.assign({title:'Сообщение', message:'', input:false, def:'', ok:'ОК', cancel:'Отмена'}, opts||{});
  const modal = document.getElementById('uiModal');
  if(!modal) return Promise.resolve(o.input ? (o.def||'') : true);
  const titleEl = document.getElementById('uiTitle');
  const msgEl = document.getElementById('uiMessage');
  const inp = document.getElementById('uiInput');
  const okBtn = document.getElementById('uiOk');
  const cancelBtn = document.getElementById('uiCancel');
  const closeBtn = document.getElementById('uiClose');
  if(titleEl) titleEl.textContent = o.title;
  if(msgEl) msgEl.textContent = o.message;
  if(okBtn) okBtn.textContent = o.ok;
  if(cancelBtn){ cancelBtn.textContent = o.cancel; cancelBtn.hidden = !o.cancel; }
  if(inp){ inp.hidden = !o.input; inp.value = o.def || ''; }

  return new Promise(resolve=>{
    let done = false;
    const finish = (val)=>{
      if(done) return;
      done = true;
      document.removeEventListener('keydown', onKey, true);
      okBtn && okBtn.removeEventListener('click', onOk);
      cancelBtn && cancelBtn.removeEventListener('click', onCancel);
      closeBtn && closeBtn.removeEventListener('click', onCancel);
      closeModal(modal);
      resolve(val);
    };
    const onOk = ()=> finish(o.input ? (inp ? inp.value : '') : true);
    const onCancel = ()=> finish(o.input ? null : false);
    const onKey = (e)=>{
      if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); onCancel(); }
      else if(e.key === 'Enter'){ e.preventDefault(); e.stopPropagation(); onOk(); }
    };
    okBtn && okBtn.addEventListener('click', onOk);
    cancelBtn && cancelBtn.addEventListener('click', onCancel);
    closeBtn && closeBtn.addEventListener('click', onCancel);
    document.addEventListener('keydown', onKey, true);
    openModal(modal, document.activeElement);
    if(o.input && inp){ setTimeout(()=>{ inp.focus(); inp.select(); }, 30); }
    else if(okBtn){ setTimeout(()=>okBtn.focus(), 30); }
  });
}
function uiAlert(message, title){
  return uiDialog({ title: title || 'Сообщение', message: String(message||''), cancel:'' }).then(()=>undefined);
}
function uiConfirm(message, opts){
  return uiDialog(Object.assign({ title:'Подтверждение', message:String(message||''), cancel:'Отмена' }, opts||{}))
    .then(v=>!!v);
}
function uiPrompt(message, def, opts){
  return uiDialog(Object.assign({ title:'Введите значение', message:String(message||''), input:true, def:def||'' }, opts||{}))
    .then(v=> (v===null || v===undefined) ? null : String(v));
}

function closeModal(m){
  if(!m || m.hidden) return;
  m.hidden = true;
  if(modalTrapEl === m) releaseModalTrap();
  if(modalOpener && document.contains(modalOpener)){ try{ modalOpener.focus(); }catch(e){} }
  modalOpener = null;
}

/* ═══ Модалка состояний боя ═══ */
(function(){
  const modal=document.getElementById('statesModal');
  if(!modal) return;
  const btn=document.getElementById('battleStatesBtn');
  const close=document.getElementById('statesClose');
  if(btn) btn.addEventListener('click', ()=> openModal(modal, btn));
  if(close) close.addEventListener('click', ()=> closeModal(modal));
  modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(modal); });
})();

