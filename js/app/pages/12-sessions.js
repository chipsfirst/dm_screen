/* ════════════ Сессии (редактор в стиле Obsidian) ════════════ */
const STORE_SESSIONS = KEYS.sessions;
let sessions = [];
let activeSessionId = null;
let sessionsInited = false;

function loadSessions(){
  const data = safeParseRaw(localStorage.getItem(STORE_SESSIONS), 'shirma_sessions');
  if(Array.isArray(data)){ sessions=data; return sessions.length>0; }
  sessions=[]; return false;
}
/* Резервная копия сессий в IndexedDB (не ограничена квотой localStorage) */
const SESS_IDB_KEY = 'sess_backup_v1';
function sessionsFromIdb(){
  const raw = mediaCache[SESS_IDB_KEY];
  if(raw==null) return null;
  try{
    const arr = JSON.parse(typeof raw==='string' ? raw : String(raw));
    return (Array.isArray(arr) && arr.length) ? arr : null;
  }catch(e){ return null; }
}
const persistSessions = debounce(()=>{
  try{
    const out=sessions.map(s=>({...s, html:stripSessionHtml(s.html)}));
    const str=JSON.stringify(out);
    try{ localStorage.setItem(STORE_SESSIONS, str); }catch(e){ console.warn('Сессии не влезли в localStorage — храним в IndexedDB'); }
    idbPut(SESS_IDB_KEY, str); // всегда дублируем в IndexedDB
  }catch(e){ console.warn('Не удалось сохранить сессии:', e); }
}, 300);
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
  // старые свёртки разделов убираем полностью: текст всегда развёрнут
  d.querySelectorAll('.sess-collapse').forEach(w=>{
    const head=w.querySelector('.sess-collapse-head');
    const body=w.querySelector('.sess-collapse-body');
    const h=head ? head.querySelector('h1,h2,h3,h4') : null;
    if(!h) return;
    head.querySelectorAll('.sess-collapse-btn').forEach(b=> b.remove());
    const frag=document.createDocumentFragment();
    frag.appendChild(h);
    if(body){ while(body.firstChild) frag.appendChild(body.firstChild); }
    w.parentNode.insertBefore(frag, w);
    w.remove();
    changed=true;
  });
  d.querySelectorAll('.sess-collapse-btn').forEach(b=>{ b.remove(); changed=true; });
  d.querySelectorAll('[data-sess-collapsed]').forEach(el=>{ el.removeAttribute('data-sess-collapsed'); changed=true; });
  d.querySelectorAll('.sess-folded').forEach(el=>{ el.classList.remove('sess-folded'); changed=true; });
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
    if(!loadSessions()){
      const backup = sessionsFromIdb();         // localStorage пуст/не влез — пробуем IndexedDB
      if(backup){ sessions=backup; toast('Сессии восстановлены из резервной копии'); }
    }
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
    const s=findSession(activeSessionId); if(!s) return;
    s.html=ed.innerHTML.replace(/\u200b/g,''); s.updated=Date.now(); scheduleSaveSessions();
  });
  const listToggle=document.getElementById('sessionsListToggle');
  const sessWrap=document.querySelector('.sessions-wrap');
  if(listToggle && sessWrap){
    const KEY='shirma_sessions_list_collapsed';
    const applyList=(collapsed)=>{
      sessWrap.classList.toggle('list-collapsed', !!collapsed);
      sessWrap.classList.toggle('list-open', !collapsed);
      listToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
      listToggle.classList.toggle('is-collapsed', !!collapsed);
    };
    const narrow=()=> !!(window.matchMedia && window.matchMedia('(max-width:820px)').matches);
    let stored=null;
    try{ stored=localStorage.getItem(KEY); }catch(e){}
    applyList(narrow() ? true : stored==='1');
    listToggle.addEventListener('click', ()=>{
      const now=!sessWrap.classList.contains('list-collapsed');
      applyList(now);
      try{ localStorage.setItem(KEY, now ? '1' : '0'); }catch(e){}
    });
    const listEl=document.getElementById('sessionsList');
    if(listEl) listEl.addEventListener('click', e=>{
      if(!e.target.closest('.session-item')) return;
      if(window.matchMedia && window.matchMedia('(max-width:820px)').matches) applyList(true);
    });
  }
  if(delBtn) delBtn.addEventListener('click', async ()=>{
    if(!activeSessionId) return;
    if(!(await uiConfirm('Удалить эту сессию?'))) return;
    pushUndo('удаление сессии');
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
/* ── помощники форматирования редактора сессий ── */
function selRange(){
  const s=window.getSelection();
  return (s && s.rangeCount)? s.getRangeAt(0) : null;
}
/* проверка, что выделение (или его граница) внутри блока tag */
function isInBlock(tag){
  const r=selRange(); if(!r) return false;
  let n=r.commonAncestorContainer;
  if(n.nodeType===3) n=n.parentNode;
  while(n && n!==document.body){
    if(n.nodeType===1 && String(n.nodeName).toLowerCase()===tag) return true;
    n=n.parentNode;
  }
  return false;
}
/* все текстовые узлы редактора, пересекающиеся с диапазоном */
function textNodesInRange(range){
  const out=[]; const root=document.getElementById('sessionEditor');
  if(!root || !range) return out;
  const walker=document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n; while((n=walker.nextNode())){
    if(n.nodeValue && n.nodeValue.trim()!=='' && range.intersectsNode(n)) out.push(n);
  }
  return out;
}
/* применить inline-стиль к выделению или каретке в редакторе сессий */
function applyInlineStyle(prop, value){
  const ed=document.getElementById('sessionEditor'); if(!ed) return;
  ed.focus();
  const r=selRange(); if(!r) return;
  const px=Math.max(8, Math.min(96, parseInt(value,10)||16));
  const styleProp = prop==='font-size' ? 'fontSize' : 'fontFamily';
  const styleVal = prop==='font-size' ? px+'px' : String(value||'').trim();
  if(!styleVal) return;

  if(r.collapsed){
    // каретка: span с нулевой шириной — дальше текст печатается уже нужным стилем
    const span=document.createElement('span');
    span.style[styleProp]=styleVal;
    const zw=document.createTextNode('\u200b');
    span.appendChild(zw);
    r.insertNode(span);
    const nr=document.createRange();
    try{ nr.setStart(zw,1); nr.collapse(true); }
    catch(e){ nr.selectNodeContents(span); nr.collapse(false); }
    const sel=window.getSelection();
    sel.removeAllRanges(); sel.addRange(nr);
    return;
  }

  // выделение: оборачиваем текстовые узлы, размер — только в точных пикселях
  textNodesInRange(r).forEach((node)=>{
    const parent=node.parentNode;
    let wrap;
    if(parent && parent.nodeType===1 && parent.tagName==='FONT' && prop==='font-size'){
      wrap=parent;
      wrap.removeAttribute('size');
    } else if(parent && parent.nodeType===1 && parent.tagName==='SPAN' && parent.style && parent.style[styleProp]){
      wrap=parent;
    } else {
      wrap=document.createElement('span');
      parent.insertBefore(wrap, node);
      wrap.appendChild(node);
    }
    wrap.style[styleProp]=styleVal;
  });
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
      if(tag==='blockquote'){
        // переключатель: внутри цитаты — вернуть обычный текст, иначе сделать цитатой
        const inside=isInBlock('blockquote');
        try{ document.execCommand('formatBlock', false, inside ? 'p' : 'blockquote'); }catch(e){}
      } else {
        try{ document.execCommand('formatBlock', false, tag); }catch(e){}
      }
      afterEdit();
    });
  });
  bar.querySelectorAll('[data-link]').forEach(btn=>{
    btn.addEventListener('click', async ()=>{
      ed.focus();
      const url=await uiPrompt('Адрес ссылки (URL):','https://'); if(!url) return;
      try{ document.execCommand('createLink', false, url); }catch(e){}
      afterEdit();
    });
  });
  // размер шрифта в пикселях (с сохранением выделения при клике по селекту)
  const fsSel = document.getElementById('sessionFontSize');
  if(fsSel){
    let savedRange=null;
    fsSel.addEventListener('mousedown', ()=>{
      const sel=window.getSelection();
      if(sel && sel.rangeCount){ savedRange = sel.getRangeAt(0).cloneRange(); }
    });
    fsSel.addEventListener('change', ()=>{
      let v=parseInt(fsSel.value,10); if(!v) return;
      ed.focus();
      if(savedRange){ const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
      // рендерим в inline-стиле, а не через <font>
      applyInlineStyle('font-size', v+'px');
      afterEdit();
      fsSel.value='';
    });
  }
  // семейство шрифта
  const ffSel = document.getElementById('sessionFontFamily');
  if(ffSel){
    let savedRangeFF=null;
    ffSel.addEventListener('mousedown', ()=>{
      const sel=window.getSelection();
      if(sel && sel.rangeCount){ savedRangeFF = sel.getRangeAt(0).cloneRange(); }
    });
    ffSel.addEventListener('change', ()=>{
      const v=ffSel.value; if(!v) return;
      ed.focus();
      if(savedRangeFF){ const sel=window.getSelection(); sel.removeAllRanges(); sel.addRange(savedRangeFF); }
      applyInlineStyle('font-family', v);
      afterEdit();
      ffSel.value='';
    });
  }
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
    if(items){
      for(const it of items){
        if(it.type && it.type.indexOf('image')===0){
          const f=it.getAsFile();
          if(f){ e.preventDefault(); insertImageIntoSession(f); afterEdit(); }
          return;
        }
      }
    }
    // HTML из чужой страницы тащит свой цвет текста: чёрный на тёмном фоне не виден
    const raw=e.clipboardData && e.clipboardData.getData('text/html');
    if(!raw) return;
    e.preventDefault();
    const clean=stripPastedColors(raw);
    let ok=false;
    try{ ok=document.execCommand('insertHTML', false, clean); }catch(err){ ok=false; }
    if(!ok) insertHtmlAtCaret(clean);
    afterEdit();
  });
  // перетаскивание файла в редактор
  ed.addEventListener('drop', e=>{
    const dt=e.dataTransfer; if(!dt) return;
    const f=[...(dt.files||[])].find(x=>/^image\//.test(x.type));
    if(f){ e.preventDefault(); insertImageIntoSession(f); afterEdit(); }
  });
  function afterEdit(){
    const s=findSession(activeSessionId); if(s){ s.html=ed.innerHTML.replace(/\u200b/g,''); s.updated=Date.now(); scheduleSaveSessions(); }
  }
}

/* Вставка сохраняет цвета источника: чёрный текст из светлой страницы
   в тёмной теме не читается. Снимаем цвет и фон, оформление оставляем. */
function stripPastedColors(html){
  const box=document.createElement('div');
  box.innerHTML=String(html||'');
  const drop=['color','background','background-color','-webkit-text-fill-color','text-fill-color'];
  Array.prototype.forEach.call(box.querySelectorAll('[style]'), el=>{
    const st=el.style;
    if(!st) return;
    drop.forEach(p=>{ try{ st.removeProperty(p); }catch(e){} });
    const left=(el.getAttribute('style')||'').replace(/[\s;]/g,'');
    if(!left) el.removeAttribute('style');
  });
  Array.prototype.forEach.call(box.querySelectorAll('font'), el=>{
    el.removeAttribute('color'); el.removeAttribute('face');
  });
  Array.prototype.forEach.call(box.querySelectorAll('[bgcolor]'), el=> el.removeAttribute('bgcolor'));
  return box.innerHTML;
}
function insertHtmlAtCaret(html){
  const sel=window.getSelection && window.getSelection();
  if(!sel || !sel.rangeCount) return false;
  const range=sel.getRangeAt(0);
  range.deleteContents();
  const tmp=document.createElement('div');
  tmp.innerHTML=html;
  const frag=document.createDocumentFragment();
  let last=null;
  while(tmp.firstChild){ last=tmp.firstChild; frag.appendChild(last); }
  if(!last) return false;
  range.insertNode(frag);
  const after=document.createRange();
  after.setStartAfter(last); after.collapse(true);
  sel.removeAllRanges(); sel.addRange(after);
  return true;
}
/* В однострочных contenteditable (названия блоков, имена ресурсов) разметка не нужна */
document.addEventListener('paste', e=>{
  const t=e.target;
  if(!t || !t.isContentEditable) return;
  if(t.id==='sessionEditor') return;
  const cd=e.clipboardData;
  if(!cd) return;
  e.preventDefault();
  const text=cd.getData('text/plain')||'';
  let ok=false;
  try{ ok=document.execCommand('insertText', false, text); }catch(err){ ok=false; }
  if(!ok){
    const sel=window.getSelection && window.getSelection();
    if(sel && sel.rangeCount){
      const r=sel.getRangeAt(0); r.deleteContents();
      const node=document.createTextNode(text);
      r.insertNode(node);
      r.setStartAfter(node); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
    }
  }
});

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
    const s=findSession(activeSessionId); if(s){ s.html=ed.innerHTML.replace(/\u200b/g,''); s.updated=Date.now(); scheduleSaveSessions(); }
  };
  reader.readAsDataURL(file);
}

/* ════════════ Экспорт сессии в Markdown / PDF ════════════ */
function htmlToMarkdown(html){
  const root=document.createElement('div'); root.innerHTML=html||'';
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
      case 'button': return '';
      default: return inner;
    }
  }
  let md=walk(root);
  md=md.replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  return md;
}
/* Сохранение файла: в браузере — скачивание, в Tauri — диалог + запись на диск */
async function saveFile(name, content, mime){
  const blob = (content instanceof Blob)
    ? content
    : new Blob([content], { type: mime || 'application/octet-stream' });
  const T = window.__TAURI__;
  if(T && T.dialog && T.core && typeof T.core.invoke === 'function'){
    try{
      const path = await T.dialog.save({ defaultPath: name });
      if(!path) return false;
      const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
      await T.core.invoke('save_file', { path, contents: bytes });
      toast('Сохранено: ' + path);
      return true;
    }catch(e){
      toast('Не удалось сохранить файл: ' + (e && e.message ? e.message : e));
      return false;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1500);
  return true;
}

function downloadFile(name, content, mime){
  saveFile(name, content, mime || 'text/plain;charset=utf-8');
}
function safeFileName(name){ return String(name||'session').replace(/[\/\\:*?"<>|]+/g,'_').slice(0,80); }

/* Внешние ссылки: в нативном приложении вебвью не открывает target="_blank" сам */
function openExternalLink(url){
  const T = window.__TAURI__;
  if(T && T.core && typeof T.core.invoke === 'function'){
    T.core.invoke('open_external', { url }).catch(err=>{
      toast('Не удалось открыть ссылку: ' + (err && err.message ? err.message : err));
    });
    return true;
  }
  return false;
}
document.addEventListener('click', e=>{
  const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
  if(!a) return;
  const href = a.getAttribute('href') || '';
  if(!/^https?:\/\//i.test(href)) return;
  if(openExternalLink(a.href)) e.preventDefault();
});
function exportSessionMd(){
  const s=findSession(activeSessionId); if(!s){ uiAlert('Нет активной сессии'); return; }
  const md='# '+(s.title||'Сессия')+'\n\n'+htmlToMarkdown(hydrateSessionHtml(s.html||''));
  downloadFile(safeFileName(s.title)+'.md', md, 'text/markdown;charset=utf-8');
}
function exportSessionPdf(){
  const s=findSession(activeSessionId); if(!s){ uiAlert('Нет активной сессии'); return; }
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
  if(window.__TAURI__ && window.__TAURI__.dialog){
    saveFile(safeFileName(s.title||'Сессия')+'.html', html, 'text/html;charset=utf-8');
    toast('Файл сохранён — откройте его в браузере и напечатайте в PDF');
    return;
  }
  const frame=document.createElement('iframe');
  frame.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc=frame.contentWindow.document;
  doc.open(); doc.write(html); doc.close();
  setTimeout(()=>{
    try{ frame.contentWindow.focus(); frame.contentWindow.print(); }
    catch(e){ uiAlert('Не удалось открыть печать: '+e.message); }
    setTimeout(()=>frame.remove(), 1500);
  }, 400);
}

