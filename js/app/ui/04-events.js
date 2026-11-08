/* ════════════ Events ════════════ */
document.getElementById('addPc').addEventListener('click', ()=> addBlock('pc'));
(function(){
  const pc = document.getElementById('addPcTop');
  if(pc) pc.addEventListener('click', ()=> addBlock('pc'));
  const note = document.getElementById('addNoteTop');
  if(note) note.addEventListener('click', ()=> addBlock('note'));
  const cm = document.getElementById('createMobTop');
  if(cm) cm.addEventListener('click', ()=>{
    renderMobPresets();
    openModal(document.getElementById('mobPresetModal'), cm);
  });
  const closePresets = document.getElementById('mobPresetClose');
  const presetModal = document.getElementById('mobPresetModal');
  if(closePresets) closePresets.addEventListener('click', ()=> closeModal(presetModal));
  if(presetModal) presetModal.addEventListener('click', e=>{ if(e.target===presetModal) closeModal(presetModal); });
  const am = document.getElementById('addMobTop');
  if(am) am.addEventListener('click', ()=>{ const b=document.getElementById('btnBestiary'); if(b) b.click(); });
  document.querySelectorAll('[data-menu-target]').forEach(b=>{
    b.addEventListener('click', ()=>{ const t=document.getElementById(b.dataset.menuTarget); if(t) t.click(); });
  });
})();

/* ═══ Импорт персонажей/монстров из JSON ═══ */
(function(){
  const modal = document.getElementById('jsonModal');
  if(!modal) return;
  const textEl = document.getElementById('jsonText');
  const fileEl = document.getElementById('jsonFile');
  const status = document.getElementById('jsonStatus');
  const AB_KEYS=['Str','Dex','Con','Int','Wis','Cha'];

  const clampN=(v,lo,hi,d)=>{ const n=Math.round(parseFloat(v)); return isFinite(n)?Math.max(lo,Math.min(hi,n)):d; };
  const str=(v,max)=>{ const s=(v==null?'':String(v)); return s.slice(0,max||4000); };

  function abilityStats(o){
    if(Array.isArray(o.ab_list) && o.ab_list.length){
      const map={}; o.ab_list.forEach(a=>{ if(a&&a.k) map[a.k]=a.v; });
      return AB_KEYS.map(k=> clampN(map[k],1,30,10));
    }
    const ab=o.abilities||{};
    const get=(k)=>{ const lk=k.toLowerCase(); if(ab[k]!=null) return ab[k]; if(ab[lk]!=null) return ab[lk]; return 10; };
    return AB_KEYS.map(k=> clampN(get(k),1,30,10));
  }
  function normAbList(o){
    const inc=(x)=> x>=0?('+'+x):String(x);
    if(Array.isArray(o.ab_list) && o.ab_list.length){
      return o.ab_list.slice(0,6).map(a=>({ k:String(a.k||'').slice(0,4), v:clampN(a.v,1,30,10), m:clampN(a.m,-10,10,0), s:str(a.s||'',10) }));
    }
    const ab=o.abilities||{};
    const get=(k)=>{ const lk=k.toLowerCase(); if(ab[k]!=null) return ab[k]; if(ab[lk]!=null) return ab[lk]; return 10; };
    return AB_KEYS.map(k=>{ const v=clampN(get(k),1,30,10); const m=Math.floor((v-10)/2); return { k, v, m, s:inc(m) }; });
  }
  const normProps=(o)=>{ const out={}; if(o&&typeof o==='object'){ Object.keys(o).slice(0,20).forEach(k=>{ const kk=str(k,40); if(kk) out[kk]=str(o[k],200); }); } return out; };
  function isNative(o){ return !!(o && typeof o==='object' && (o.mdata || ((o.type==='pc'||o.type==='mob') && (Array.isArray(o.stats)||o.props)))); }
  function isMonster(o){ return !!(o && typeof o==='object' && (Array.isArray(o.actions)||Array.isArray(o.acts)||o.cr!=null)); }
  const dispType=(o)=> (o.type && !['monster','character','pc','mob'].includes(String(o.type).toLowerCase())) ? str(o.type,120) : '';

  /* ═══ Long Story Short (hotbox.longstoryshort.app) ═══ */
  function lssUnwrap(o){
    if(!o || typeof o!=='object') return null;
    if(o.jsonType==='character' && typeof o.data==='string'){
      try{ const d=JSON.parse(o.data); if(d && typeof d==='object') return d; }catch(e){ return null; }
    }
    if(o.jsonType==='character' && o.name && typeof o.name==='object') return o;
    return null;
  }
  function isLSS(o){ return !!lssUnwrap(o); }
  const lssVal=(x,def)=> {
    if(x==null) return def==null?'':def;
    if(typeof x==='object'){ if('value' in x) return x.value==null?(def==null?'':def):x.value; return def==null?'':def; }
    return x;
  };
  function lssProse(node, out){
    out=out||[];
    if(!node) return out;
    if(Array.isArray(node)){ node.forEach(n=>lssProse(n,out)); return out; }
    if(typeof node!=='object') return out;
    if(node.type==='text'){ out.push(String(node.text||'')); return out; }
    if(node.type==='hardBreak'){ out.push('\n'); return out; }
    if(node.type==='paragraph' || node.type==='heading'){
      const inner=[];
      lssProse(node.content, inner);
      const line=inner.join('').trim();
      out.push(line+'\n');
      return out;
    }
    lssProse(node.content, out);
    return out;
  }
  function lssDoc(docField){
    const v=docField && typeof docField==='object' ? docField.value : docField;
    if(!v) return '';
    const doc=(v && v.data) ? v.data : v;
    return lssProse(doc).join('').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function lssBlock(src){
    const d=lssUnwrap(src);
    if(!d) return null;
    const info=d.info||{}, vit=d.vitality||{};
    const name=String(lssVal(d.name,'Персонаж')).slice(0,100) || 'Персонаж';
    const cls=String(lssVal(info.charClass,''));
    const sub=String(lssVal(info.charSubclass,''));
    const lvl=clampN(lssVal(info.level,1),1,30,1);
    const b=makeBlock('pc', name);
    const stats=d.stats||{};
    const score=(k)=>{ const v=stats[k]; const sc=(v&&typeof v==='object')?v.score:v; return clampN(sc==null?10:sc,1,30,10); };
    b.stats=['str','dex','con','int','wis','cha'].map(score);
    const dexMod=Math.floor((b.stats[1]-10)/2);
    const hp=clampN(lssVal(vit['hp-max'], lssVal(vit['hp-current'],10)),0,9999,10);
    const ac=clampN(lssVal(vit.ac,10),0,99,10);
    b.props={
      'Класс': (cls + (sub? ' · '+sub : '')).slice(0,60),
      'Уровень': String(lvl),
      'Раса': String(lssVal(info.race,'')).slice(0,40),
      'Предыстория': String(lssVal(info.background,'')).slice(0,60),
      'HP': String(hp),
      'Броня КК': String(ac),
      'Инициат': (dexMod>=0?'+':'')+dexMod
    };
    // ресурсы: из файла, иначе Ци у монаха (уровень)
    const res=[];
    const src_res=d.resources||{};
    Object.keys(src_res).forEach(k=>{
      const v=src_res[k]; if(!v||typeof v!=='object') return;
      const max=clampN(lssVal(v.max,0),0,999,0), cur=clampN(lssVal(v.value, lssVal(v.current, max)),0,999,max);
      if(max||cur) res.push({ name:String(v.name||k).slice(0,40), cur, max: max||cur });
    });
    if(/монах|monk/i.test(cls) && !res.length){
      res.push({ name:'Ци', cur:lvl, max:lvl });
    }
    b.res = res.length ? sanitizeRes(res) : [{ name:'Вдохновение', cur:1, max:1 }];
    // атака: бонус первого оружия
    const wp=d.weaponsList||[];
    const firstW=wp[0]||{};
    const wmod=String(firstW.mod && typeof firstW.mod==='object' ? firstW.mod.value : (firstW.mod||''));
    if(/^[+-]\d+$/.test(wmod)) b.attack=wmod;
    // заметки
    const parts=[];
    const wk=wp.map(w=>{
      const nm=String(lssVal(w.name,'')); const dm=String(lssVal(w.dmg,'')); const nt=String(lssVal(w.notes,''));
      return (nm||dm)? ('• '+nm+(dm? ' — '+dm : '')+(nt? ' (' + nt.replace(/\n/g,' ') + ')' : '')) : '';
    }).filter(Boolean);
    if(wk.length) parts.push('Оружие:\n'+wk.join('\n'));
    const sections=[['traits','Классовые умения'],['feats','Черты и приёмы'],['attacks','Атаки и приёмы'],['prof','Навыки и снаряжение'],['quests','Задание']];
    sections.forEach(([key,title])=>{
      const t=lssDoc((d.text||{})[key]);
      if(t) parts.push('— '+title+' —\n'+t);
    });
    const coins=d.coins||{};
    const money=[];
    ['pp','gp','ep','sp','cp'].forEach(c=>{ const v=clampN(lssVal(coins[c],0),0,999999,0); if(v) money.push(v+' '+({pp:'пм',gp:'зм',ep:'эм',sp:'см',cp:'мм'})[c]); });
    if(money.length) parts.push('Монеты: '+money.join(', '));
    b.text = parts.join('\n\n').slice(0,20000);
    return b;
  }

  function buildBlock(o){
    if(isLSS(o)){
      const lb=lssBlock(o);
      if(lb) return lb;
    }
    if(isNative(o)){
      const type = (o.type==='pc'||o.type==='mob') ? o.type : (o.mdata?'mob':'pc');
      const b = makeBlock(type, str(o.title||o.name||TYPE_LABEL[type],120));
      if(Array.isArray(o.stats)) b.stats=[0,1,2,3,4,5].map(i=>clampN(o.stats[i],1,30,10));
      if(o.props && typeof o.props==='object') b.props=normProps(o.props);
      if(Array.isArray(o.res)) b.res=sanitizeRes(o.res);
      if(typeof o.text==='string') b.text=str(o.text,20000);
      if(typeof o.attack!=='undefined') b.attack=str(o.attack,20);
      if(o.mdata && typeof o.mdata==='object'){
        const d=o.mdata;
        b.mdata={ type:str(d.type,120), cr:d.cr, ac:d.ac, hp:d.hp, sp:str(d.sp,120), init:str(d.init,20),
          ab_list:normAbList(d), sk:str(d.sk,300), sen:str(d.sen,300), lang:str(d.lang,300),
          acts:Array.isArray(d.acts)?d.acts.slice(0,60).map(a=>({tag:str(a.tag,30)||'Действия', text:str(a.text,2000)})):[] };
        b.stats=abilityStats(d);
      }
      return b;
    }
    if(isMonster(o)){
      const b=makeBlock('mob',str(o.name||o.n||'Монстр',100));
      const cr=o.cr, ac=o.ac, hp=o.hp, sp=o.speed||o.sp, init=o.initiative||o.init;
      b.props={ 'Опасн.':str(cr,20)||'—', 'КД':str(ac,20)||'—', 'ХП':str(hp,30)||'—', 'Скорость':str(sp,60)||'—', 'Иниц.':str(init,20)||'—' };
      const raw=Array.isArray(o.actions)?o.actions:(Array.isArray(o.acts)?o.acts:[]);
      const acts=raw.slice(0,60).map(a=>{
        let tag=a.tag||'Действия'; let text=a.text||a.desc||'';
        const nm=a.name?String(a.name):'';
        if(nm && text && !String(text).startsWith(nm)) text=nm+'. '+text;
        else if(nm && !text) text=nm;
        return { tag:str(tag,30)||'Действия', text:str(text,2000) };
      }).filter(a=>a.text);
      b.mdata={ type:dispType(o), cr, ac, hp, sp:str(sp,120), init:str(init,20),
        ab_list:normAbList(o), sk:str(o.skills||o.sk,300), sen:str(o.senses||o.sen,300), lang:str(o.languages||o.lang,300), acts };
      b.stats=abilityStats(o);
      return b;
    }
    const b=makeBlock('pc', str(o.name||o.title||'Персонаж',100));
    const cls=o.class||o.cls, lvl=o.level;
    b.props={ 'Класс':(str(cls,40)+(lvl?' '+str(lvl,4):'')).trim(), 'Раса':str(o.race,40), 'HP':str(o.hp!=null?o.hp:10,20), 'Броня КК':str(o.ac!=null?o.ac:10,20), 'Инициат':str(o.initiative!=null?o.initiative:'+0',20) };
    b.stats=abilityStats(o);
    if(Array.isArray(o.resources)) b.res=sanitizeRes(o.resources);
    else b.res=[{name:'Вдохновение',cur:1,max:1}];
    if(o.attack!=null) b.attack=str(o.attack,20);
    b.text=str(o.notes||o.text||'',20000);
    return b;
  }

  function parseAndImport(text){
    if(status) status.textContent='';
    text=(text||'').trim();
    if(!text){ if(status) status.textContent='Пусто: вставьте JSON или выберите файл.'; return; }
    if(text.length>2*1024*1024){ if(status) status.textContent='Слишком большой JSON (>2 МБ).'; return; }
    let data;
    try{ data=JSON.parse(text); }catch(e){ if(status) status.textContent='Ошибка JSON: '+e.message; return; }
    const items=[];
    (function collect(x){
      if(!x) return;
      if(Array.isArray(x)){ x.forEach(collect); return; }
      if(typeof x!=='object') return;
      if(Array.isArray(x.blocks)) return x.blocks.forEach(collect);
      if(Array.isArray(x.characters)) return x.characters.forEach(o=>collect(Object.assign({ },o)));
      if(Array.isArray(x.monsters)) return x.monsters.forEach(o=>collect(Object.assign({ },o)));
      items.push(x);
    })(data);
    if(!items.length){ if(status) status.textContent='Не найдено ни одного объекта.'; return; }
    if(items.length>100){ if(status) status.textContent='Слишком много объектов (макс. 100).'; return; }
    const built=[]; let errors=0;
    items.forEach(o=>{ try{ const b=buildBlock(o); if(b) built.push(b); }catch(e){ errors++; } });
    if(!built.length){ if(status) status.textContent='Не удалось разобрать объекты.'; return; }
    prepareCanvasForAdd();
    built.forEach(b=>{ Object.assign(b, freeCascadePos()); blocks.push(b); });
    save();
    const anyMob=built.some(b=>b.type==='mob'), anyPc=built.some(b=>b.type==='pc');
    showTab(anyMob && !anyPc ? 'monsters' : 'chars');
    if(status) status.textContent='Импортировано: '+built.length+(errors?' · ошибок: '+errors:'')+'.';
    toast('Импортировано: '+built.length);
    setTimeout(()=> closeModal(modal), 700);
  }

  [document.getElementById('btnImportJson'), document.getElementById('btnImportJsonTop')].forEach(b=>{
    if(b) b.addEventListener('click', ()=>{ if(status) status.textContent=''; openModal(modal); });
  });
  const closeBtn=document.getElementById('jsonClose');
  if(closeBtn) closeBtn.addEventListener('click', ()=> closeModal(modal));
  modal.addEventListener('click', e=>{ if(e.target===modal) closeModal(modal); });

  const doBtn=document.getElementById('jsonDoImport');
  if(doBtn) doBtn.addEventListener('click', ()=> parseAndImport(textEl?textEl.value:''));
  const exBtn=document.getElementById('jsonFillExample');
  if(exBtn) exBtn.addEventListener('click', ()=>{
    if(textEl) textEl.value=JSON.stringify({type:'character',name:'Арин',class:'Плут',race:'Полурослик',level:3,hp:24,ac:15,initiative:'+3',abilities:{str:10,dex:16,con:12,int:13,wis:11,cha:14},attack:'+5',resources:[{name:'Вдохновение',cur:1,max:1}],notes:'Любит тени и золото.'},null,2);
  });
  if(fileEl) fileEl.addEventListener('change', ()=>{
    const f=fileEl.files && fileEl.files[0]; if(!f) return;
    if(f.size>2*1024*1024){ if(status) status.textContent='Файл больше 2 МБ.'; fileEl.value=''; return; }
    const r=new FileReader();
    r.onload=()=>{ const t=String(r.result||''); if(textEl) textEl.value=t; parseAndImport(t); };
    r.onerror=()=>{ if(status) status.textContent='Не удалось прочитать файл.'; };
    r.readAsText(f,'utf-8');
  });
})();

