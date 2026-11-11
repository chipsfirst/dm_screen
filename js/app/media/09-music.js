/* ════════════ Музыка ════════════ */
const MUSIC_KEY = 'shirma_music_v1';
const MUSIC_DB = 'shirma_audio_v1';
const MUSIC_STORE = 'audio';
const MUSIC_ALL = '__all';
const MUSIC_MAX_BYTES = 200*1024*1024;   // предел одного трека в байтах (200 МБ)

const music = {
  tracks: {},          // id -> {id,key,title,artist,dur,size,added}
  lists: [],           // [{id,name,trackIds:[]}]
  currentList: MUSIC_ALL,
  currentId: null,
  queue: [],
  queueIndex: -1,
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeat: 'off',
};

const musicAudio = document.getElementById('musicAudio');
let musicDBPromise = null;
let musicObjectUrl = null;
let musicPickSelection = new Set();
let musicStorageAt = 0;
let musicSaveWarned = false;

/* Аудио лежит в отдельной базе: файлы крупные, в резервную копию и localStorage им нельзя */
function openMusicDB(){
  if(musicDBPromise) return musicDBPromise;
  musicDBPromise = new Promise((resolve)=>{
    const fail = ()=>{ musicDBPromise = null; resolve(null); };   // следующая попытка откроет базу заново
    try{
      if(typeof indexedDB === 'undefined'){ fail(); return; }
      const req = indexedDB.open(MUSIC_DB, 1);
      req.onupgradeneeded = ()=>{ const db=req.result; if(!db.objectStoreNames.contains(MUSIC_STORE)) db.createObjectStore(MUSIC_STORE); };
      req.onsuccess = ()=> resolve(req.result);
      req.onerror = fail;
      req.onblocked = fail;
    }catch(e){ fail(); }
  });
  return musicDBPromise;
}
function musicPut(key, blob){
  return openMusicDB().then(db=> new Promise(resolve=>{
    if(!db){ resolve(false); return; }
    try{
      const tx = db.transaction(MUSIC_STORE,'readwrite');
      tx.objectStore(MUSIC_STORE).put(blob, key);
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> resolve(false);
      tx.onabort = ()=> resolve(false);
    }catch(e){ resolve(false); }
  }));
}
function musicGet(key){
  return openMusicDB().then(db=> new Promise(resolve=>{
    if(!db){ resolve(null); return; }
    try{
      const tx = db.transaction(MUSIC_STORE,'readonly');
      const req = tx.objectStore(MUSIC_STORE).get(key);
      req.onsuccess = ()=> resolve(req.result || null);
      req.onerror = ()=> resolve(null);
    }catch(e){ resolve(null); }
  }));
}
function musicDel(key){
  return openMusicDB().then(db=> new Promise(resolve=>{
    if(!db){ resolve(false); return; }
    try{
      const tx = db.transaction(MUSIC_STORE,'readwrite');
      tx.objectStore(MUSIC_STORE).delete(key);
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> resolve(false);
    }catch(e){ resolve(false); }
  }));
}

function musicLoad(){
  let raw = null;
  try{ raw = JSON.parse(localStorage.getItem(MUSIC_KEY)||'null'); }catch(e){ raw = null; }
  if(!raw || typeof raw !== 'object') return;
  if(raw.tracks && typeof raw.tracks === 'object'){
    Object.keys(raw.tracks).forEach(id=>{
      const t = raw.tracks[id];
      if(!t || typeof t !== 'object') return;
      music.tracks[id] = {
        id: String(t.id||id),
        key: String(t.key||('audio_'+id)),
        title: String(t.title||'Трек').slice(0,160),
        artist: String(t.artist||'').slice(0,120),
        dur: Math.max(0, +t.dur||0),
        size: Math.max(0, +t.size||0),
        added: +t.added||0,
      };
    });
  }
  if(Array.isArray(raw.lists)){
    music.lists = raw.lists.slice(0,100).map(l=>({
      id: String(l.id||('ml_'+Math.random().toString(36).slice(2,7))),
      name: String(l.name||'Плейлист').slice(0,60),
      trackIds: Array.isArray(l.trackIds) ? l.trackIds.map(String).filter(id=> music.tracks[id]) : [],
    }));
  }
  music.currentList = (raw.currentList===MUSIC_ALL || music.lists.some(l=> l.id===raw.currentList)) ? raw.currentList : MUSIC_ALL;
  music.currentId = (raw.currentId && music.tracks[raw.currentId]) ? raw.currentId : null;
  music.volume = Math.min(1, Math.max(0, raw.volume==null ? 0.8 : +raw.volume));
  music.muted = !!raw.muted;
  music.shuffle = !!raw.shuffle;
  music.repeat = ['off','all','one'].includes(raw.repeat) ? raw.repeat : 'off';
}
function musicMeta(){
  return {
    tracks: music.tracks, lists: music.lists, currentList: music.currentList,
    currentId: music.currentId, volume: music.volume, muted: music.muted,
    shuffle: music.shuffle, repeat: music.repeat,
  };
}
function musicSave(){
  try{
    localStorage.setItem(MUSIC_KEY, JSON.stringify(musicMeta()));
  }catch(e){
    if(!musicSaveWarned){
      musicSaveWarned = true;
      toast('Список треков не сохранился: в браузере мало места');
    }
  }
}
/* Снимок для резервной копии: только описание плейлистов, без самих аудиофайлов */
function musicMetaSnapshot(){
  try{
    if(typeof music === 'undefined' || !music.tracks) return null;
    const meta = musicMeta();
    return { tracks: meta.tracks, lists: meta.lists, currentList: meta.currentList,
             currentId: meta.currentId, volume: meta.volume, muted: meta.muted,
             shuffle: meta.shuffle, repeat: meta.repeat };
  }catch(e){ return null; }
}
function musicMetaRestore(raw){
  try{
    if(!raw || typeof raw !== 'object') return false;
    localStorage.setItem(MUSIC_KEY, JSON.stringify(raw));
    return true;
  }catch(e){ return false; }
}

function musicTrack(id){ return music.tracks[id] || null; }
function musicList(id){ return music.lists.find(l=> l.id===id) || null; }
function musicListName(id){
  if(id===MUSIC_ALL) return 'Все треки';
  const l = musicList(id);
  return l ? l.name : 'Все треки';
}
function musicListTracks(id){
  if(id===MUSIC_ALL) return Object.keys(music.tracks).map(k=> music.tracks[k]);
  const l = musicList(id);
  return l ? l.trackIds.map(t=> music.tracks[t]).filter(Boolean) : [];
}
function musicFmtTime(sec){
  sec = Math.max(0, Math.round(+sec||0));
  return Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
}
/* «1 файл», «2 файла», «5 файлов» */
function musicFilesWord(n){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return 'файлов';
  if(b === 1) return 'файл';
  if(b >= 2 && b <= 4) return 'файла';
  return 'файлов';
}
function musicFmtBytes(n){
  n = +n||0;
  if(n >= 1024*1024*1024) return (n/1024/1024/1024).toFixed(1)+' ГБ';
  if(n >= 1024*1024) return (n/1024/1024).toFixed(1)+' МБ';
  if(n >= 1024) return Math.round(n/1024)+' КБ';
  return n+' Б';
}

function musicBuildQueue(listId, startId){
  const ids = musicListTracks(listId).map(t=> t.id);
  if(music.shuffle && ids.length > 1){
    for(let i=ids.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const tmp=ids[i]; ids[i]=ids[j]; ids[j]=tmp; }
    if(startId){
      const k = ids.indexOf(startId);
      if(k > 0){ ids.splice(k,1); ids.unshift(startId); }
    }
  }
  let at = startId ? ids.indexOf(startId) : 0;
  if(startId && at < 0){ ids.unshift(startId); at = 0; }
  music.queue = ids;
  music.queueIndex = Math.max(0, at);
}

function musicApplyVolume(){
  if(!musicAudio) return;
  try{ musicAudio.volume = music.muted ? 0 : music.volume; }catch(e){}
}
function musicSetVolume(v){
  music.volume = Math.max(0, Math.min(1, +v||0));
  if(music.volume > 0) music.muted = false;   // ползунок сам снимает «выключено»
  musicApplyVolume(); musicSave(); musicRenderBar();
}
function musicToggleMute(){
  music.muted = !music.muted;
  if(!music.muted && music.volume <= 0){
    music.volume = 0.5;
    const el = document.getElementById('mbVol');
    if(el) el.value = 50;
  }
  musicApplyVolume(); musicSave(); musicRenderBar();
}

function musicPlay(id, listId){
  const tr = musicTrack(id);
  if(!tr || !musicAudio) return Promise.resolve();
  const list = listId || music.currentList;
  const listIds = musicListTracks(list).map(t=> t.id);
  /* очередь годится, только если целиком из этого плейлиста и трек в ней уже есть */
  const queueFits = music.queue.length > 0 && music.queue.every(x=> listIds.includes(x));
  if(listIds.includes(id)){
    if(!queueFits || !music.queue.includes(id)) musicBuildQueue(list, id);
    else music.queueIndex = music.queue.indexOf(id);
  } else {
    music.queue = [id]; music.queueIndex = 0;
  }
  if(listId) music.currentList = list;
  return musicGet(tr.key).then(blob=>{
    if(!blob){
      tr.missing = true;
      musicRenderTracks();
      toast('Файл «'+tr.title+'» не найден на этом устройстве — добавьте его заново');
      return;
    }
    tr.missing = false;
    if(musicObjectUrl){ try{ URL.revokeObjectURL(musicObjectUrl); }catch(e){} musicObjectUrl = null; }
    musicObjectUrl = URL.createObjectURL(blob);
    musicAudio.src = musicObjectUrl;
    music.currentId = id;
    musicApplyVolume();
    const p = musicAudio.play();
    if(p && p.catch) p.catch(()=>{});
    musicMediaSession(tr);
    musicSave(); musicRenderAll();
  }).catch(()=>{ toast('Не удалось открыть файл трека'); });
}
function musicToggle(){
  if(!musicAudio) return;
  if(music.currentId && musicTrack(music.currentId)){
    if(!musicAudio.getAttribute('src')){ musicPlay(music.currentId, music.currentList); return; }
    if(musicAudio.paused){ const p = musicAudio.play(); if(p && p.catch) p.catch(()=>{}); }
    else musicAudio.pause();
    musicRenderBar(); musicSave(); return;
  }
  const list = musicListTracks(music.currentList);
  if(!list.length){ toast('Сначала добавьте треки во вкладке «Музыка»'); showTab('music'); return; }
  musicPlay(list[0].id, music.currentList);
}
function musicNext(auto){
  if(!musicAudio || !music.queue.length) return;
  if(!music.currentId){ musicPlay(music.queue[0], music.currentList); return; }
  let i = music.queue.indexOf(music.currentId);
  i = i < 0 ? 0 : i + 1;
  if(i >= music.queue.length){
    if(music.repeat === 'all' || !auto){ i = 0; }
    else { musicAudio.pause(); try{ musicAudio.currentTime = 0; }catch(e){} musicRenderBar(); return; }
  }
  musicPlay(music.queue[i], music.currentList);
}
function musicPrev(){
  if(!musicAudio || !music.queue.length) return;
  if(!music.currentId){ musicPlay(music.queue[0], music.currentList); return; }
  if(musicAudio.currentTime > 3){ try{ musicAudio.currentTime = 0; }catch(e){} return; }
  let i = music.queue.indexOf(music.currentId);
  i = i <= 0 ? music.queue.length - 1 : i - 1;
  musicPlay(music.queue[i], music.currentList);
}
function musicStop(){
  if(!musicAudio) return;
  try{ musicAudio.pause(); }catch(e){}
  try{ musicAudio.removeAttribute('src'); musicAudio.load(); }catch(e){}
  if(musicObjectUrl){ try{ URL.revokeObjectURL(musicObjectUrl); }catch(e){} musicObjectUrl = null; }
}
function musicMediaSession(tr){
  try{
    if(!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: tr.title,
      artist: tr.artist || 'Ширма мастера',
      album: musicListName(music.currentList),
    });
  }catch(e){}
}
function musicBindMediaSession(){
  try{
    if(!('mediaSession' in navigator) || !navigator.mediaSession.setActionHandler) return;
    navigator.mediaSession.setActionHandler('play', ()=> musicToggle());
    navigator.mediaSession.setActionHandler('pause', ()=> musicToggle());
    navigator.mediaSession.setActionHandler('previoustrack', ()=> musicPrev());
    navigator.mediaSession.setActionHandler('nexttrack', ()=> musicNext(false));
  }catch(e){}
}

function musicRenderBar(){
  const titleEl = document.getElementById('mbTitleText');
  const playBtn = document.getElementById('mbPlay');
  const muteBtn = document.getElementById('mbMute');
  const volEl = document.getElementById('mbVol');
  const tr = music.currentId ? musicTrack(music.currentId) : null;
  const bar = document.getElementById('musicBar');
  if(bar) bar.classList.toggle('is-empty', !Object.keys(music.tracks).length);
  if(titleEl) titleEl.textContent = tr ? tr.title : 'Треки не добавлены';
  if(playBtn){
    const playing = !!(tr && musicAudio && !musicAudio.paused);
    playBtn.textContent = playing ? '❚❚' : '▶';
    playBtn.title = playing ? 'Пауза (Ctrl+Space)' : 'Играть (Ctrl+Space)';
    playBtn.setAttribute('aria-label', playing ? 'Пауза' : 'Играть');
  }
  if(muteBtn) muteBtn.classList.toggle('is-off', music.muted || music.volume === 0);
  if(volEl && document.activeElement !== volEl) volEl.value = Math.round(music.volume*100);
  if(titleEl && document.getElementById('mbTitle')) document.getElementById('mbTitle').title = tr ? ('Играет: '+tr.title+' — открыть музыку') : 'Открыть вкладку «Музыка»';
}
function musicRenderLists(){
  const el = document.getElementById('musicLists');
  if(!el) return;
  const items = [{ id:MUSIC_ALL, name:'Все треки', n:Object.keys(music.tracks).length }]
    .concat(music.lists.map(l=>({ id:l.id, name:l.name, n:l.trackIds.length })));
  el.innerHTML = items.map(it=>
    '<button class="music-list'+(music.currentList===it.id?' active':'')+'" data-mlist="'+escapeHtml(it.id)+'" title="'+escapeHtml(it.name)+'">'
    + '<span class="gi" data-gi="'+(it.id===MUSIC_ALL?'music':'note')+'"></span>'
    + '<span class="music-list-name">'+escapeHtml(it.name)+'</span>'
    + '<span class="music-list-n">'+it.n+'</span>'
    + '</button>'
  ).join('');
  hydrateIcons(el);
}
function musicRenderTracks(){
  const el = document.getElementById('musicTracks');
  if(!el) return;
  const list = musicListTracks(music.currentList);
  const all = music.currentList === MUSIC_ALL;
  const titleEl = document.getElementById('musicListTitle');
  const countEl = document.getElementById('musicListCount');
  const delBtn = document.getElementById('musicDelete');
  const renBtn = document.getElementById('musicRename');
  const addBtn = document.getElementById('musicAddFromLib');
  if(titleEl) titleEl.textContent = musicListName(music.currentList);
  if(countEl){
    const total = list.reduce((s,t)=> s + (+t.dur||0), 0);
    countEl.textContent = list.length ? (list.length + ' · ' + (total ? musicFmtTime(total) : '—')) : 'пусто';
  }
  if(delBtn) delBtn.disabled = all;
  if(renBtn) renBtn.disabled = all;
  if(addBtn) addBtn.disabled = all;
  if(!list.length){
    el.innerHTML = '<div class="music-empty">'
      + (all
        ? 'Пока нет треков. Нажмите <b>«Добавить треки»</b> или перетащите аудиофайлы сюда.<br>Аудио до '+Math.round(MUSIC_MAX_BYTES/1024/1024)+' МБ на файл, хранится локально и никуда не отправляется.'
        : 'В этом плейлисте пусто. <b>«＋ Из библиотеки»</b> — добавить готовые треки, или перетащите файлы сюда.')
      + '</div>';
    return;
  }
  el.innerHTML = list.map((tr, i)=>
    '<div class="music-track'+(tr.id===music.currentId?' playing':'')+(tr.missing?' missing':'')+'" data-mid="'+escapeHtml(tr.id)+'">'
    + '<span class="mt-idx" title="Играть">'+(tr.id===music.currentId?'▶':(i+1))+'</span>'
    + '<span class="mt-main"><div class="mt-name">'+escapeHtml(tr.title)+'</div>'
    + '<div class="mt-sub">'+escapeHtml(tr.missing ? 'файла нет на этом устройстве' : (tr.artist || (all?'Библиотека':'Плейлист')))+'</div></span>'
    + '<span class="mt-dur">'+(tr.dur?musicFmtTime(tr.dur):'—')+'</span>'
    + '<span class="mt-acts">'
    + (all?'':'<button class="mt-btn" data-mact="remove" title="Убрать из плейлиста">✕</button>')
    + '<button class="mt-btn del" data-mact="delete" title="Удалить файл">'+gi('trash')+'</button>'
    + '</span></div>'
  ).join('');
}
function musicUpdateStorage(force){
  const el = document.getElementById('musicStorage');
  if(!el) return;
  const now = Date.now();
  if(!force && now - musicStorageAt < 5000) return;
  musicStorageAt = now;
  const size = Object.keys(music.tracks).reduce((s,id)=> s + (+music.tracks[id].size||0), 0);
  el.textContent = size ? ('Аудио: '+musicFmtBytes(size)) : 'Локально, без интернета';
  try{
    if(navigator.storage && navigator.storage.estimate){
      navigator.storage.estimate().then(est=>{
        if(!est || !est.quota) return;
        const free = Math.max(0, est.quota - (est.usage||0));
        if(free < 500*1024*1024) el.textContent = 'Мало места: свободно '+musicFmtBytes(free);
      }).catch(()=>{});
    }
  }catch(e){}
}
function musicRenderAll(){
  musicRenderBar();
  musicRenderLists();
  musicRenderTracks();
  musicUpdateStorage();
}

function musicIsAudioFile(f){
  if(!f) return false;
  if(/^audio\//.test(f.type||'')) return true;
  return /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|weba?)$/i.test(f.name||'');
}
/* Длительность читаем по одному файлу: пачка из полусотни треков не должна
   поднимать столько же декодеров одновременно */
let musicProbeQueue = [];
let musicProbeBusy = false;
function musicProbeDuration(id, blob){
  if(typeof Audio === 'undefined' || !blob) return;
  musicProbeQueue.push({ id, blob });
  musicProbeRun();
}
function musicProbeRun(){
  if(musicProbeBusy) return;
  const job = musicProbeQueue.shift();
  if(!job) return;
  musicProbeBusy = true;
  let url = null, timer = 0, done = false;
  const finish = ()=>{
    if(done) return;
    done = true;
    if(timer) clearTimeout(timer);
    if(url){ try{ URL.revokeObjectURL(url); }catch(e){} url = null; }
    musicProbeBusy = false;
    setTimeout(musicProbeRun, 0);
  };
  try{
    url = URL.createObjectURL(job.blob);
    const a = new Audio();
    if(typeof a.addEventListener !== 'function'){ finish(); return; }
    a.addEventListener('loadedmetadata', ()=>{
      const tr = music.tracks[job.id];
      if(tr && isFinite(a.duration) && a.duration > 0 && Math.abs((+tr.dur||0) - a.duration) > 0.01){
        tr.dur = a.duration;
        musicSave(); musicRenderTracks();
      }
      finish();
    });
    a.addEventListener('error', finish);
    a.addEventListener('abort', finish);
    timer = setTimeout(finish, 10000);      // если движок так и не ответил
    a.preload = 'metadata';
    a.src = url;
  }catch(e){ finish(); }
}
function musicAddFiles(fileList, listId){
  const all = Array.from(fileList||[]);
  const files = all.filter(musicIsAudioFile);
  const notAudio = all.length - files.length;
  if(!files.length){
    toast(all.length ? 'Это не аудиофайлы: нужны mp3, ogg, wav, m4a, flac, aac или opus' : 'Выберите аудиофайлы');
    return Promise.resolve(0);
  }
  const target = listId || music.currentList;
  const list = target === MUSIC_ALL ? null : musicList(target);
  const limitMb = Math.round(MUSIC_MAX_BYTES/1024/1024);
  let added = 0, tooBig = 0, failed = 0, tooBigName = '';
  return files.reduce((chain, f)=> chain.then(()=>{
    if(f.size > MUSIC_MAX_BYTES){
      tooBig++;
      if(!tooBigName) tooBigName = String(f.name||'файл');
      return;
    }
    const id = 'tr_'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
    const key = 'audio_'+id;
    return musicPut(key, f).then(ok=>{
      if(!ok){ failed++; return; }
      const title = (String(f.name||'Трек').replace(/\.[a-z0-9]{2,5}$/i,'') || 'Трек').slice(0,160);
      music.tracks[id] = { id, key, title, artist:'', dur:0, size:+f.size||0, added:Date.now() };
      if(list) list.trackIds.push(id);
      added++;
      musicProbeDuration(id, f);
    });
  }), Promise.resolve()).then(()=>{
    musicSave(); musicRenderAll();
    const parts = [];
    if(added) parts.push(added === 1 ? 'Добавлен 1 трек' : 'Добавлено треков: '+added);
    if(tooBig) parts.push((tooBig === 1 ? '«'+tooBigName+'» весит больше ' : tooBig+' '+musicFilesWord(tooBig)+' весят больше ')+limitMb+' МБ — пропущено');
    if(failed) parts.push('не удалось сохранить: '+failed+' '+musicFilesWord(failed)+' (возможно, мало места)');
    if(notAudio) parts.push('не аудио: '+notAudio+' '+musicFilesWord(notAudio));
    toast(parts.length ? parts.join('; ') : 'Ничего не добавлено');
    return added;
  });
}

function musicRemoveFromList(id){
  const l = musicList(music.currentList);
  if(!l) return;
  l.trackIds = l.trackIds.filter(x=> x!==id);
  music.queue = music.queue.filter(x=> x!==id);
  musicSave(); musicRenderAll();
}
async function musicDeleteTrack(id){
  const tr = musicTrack(id);
  if(!tr) return;
  const ok = await uiConfirm('Удалить файл «'+tr.title+'»?\nОн исчезнет из всех плейлистов и из хранилища приложения.');
  if(!ok) return;
  delete music.tracks[id];
  music.lists.forEach(l=>{ l.trackIds = l.trackIds.filter(x=> x!==id); });
  music.queue = music.queue.filter(x=> x!==id);
  if(music.currentId === id){ musicStop(); music.currentId = null; }
  musicDel(tr.key);
  musicSave(); musicRenderAll();
  toast('Трек удалён');
}
async function musicNewList(){
  const name = await uiPrompt('Название плейлиста или сцены:', 'Сцена '+(music.lists.length+1));
  if(name == null) return;
  const nm = String(name).trim().slice(0,60);
  if(!nm) return;
  const id = 'ml_'+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
  music.lists.push({ id, name:nm, trackIds:[] });
  music.currentList = id;
  musicSave(); musicRenderAll();
  toast('Плейлист «'+nm+'» создан');
}
async function musicRenameList(){
  const l = musicList(music.currentList);
  if(!l) return;
  const name = await uiPrompt('Новое название плейлиста:', l.name);
  if(name == null) return;
  const nm = String(name).trim().slice(0,60);
  if(!nm) return;
  l.name = nm;
  musicSave(); musicRenderAll();
}
async function musicDeleteList(){
  const l = musicList(music.currentList);
  if(!l) return;
  const ok = await uiConfirm('Удалить плейлист «'+l.name+'»? Файлы останутся в «Все треки».');
  if(!ok) return;
  music.lists = music.lists.filter(x=> x.id!==l.id);
  music.currentList = MUSIC_ALL;
  musicSave(); musicRenderAll();
}

function musicRenderPick(){
  const el = document.getElementById('musicPickList');
  if(!el) return;
  const searchEl = document.getElementById('musicPickSearch');
  const q = normalizeLib((searchEl && searchEl.value) || '');
  const l = musicList(music.currentList);
  const inList = new Set(l ? l.trackIds : []);
  const items = Object.keys(music.tracks).map(k=> music.tracks[k])
    .filter(t=> !inList.has(t.id))
    .filter(t=> !q || normalizeLib(t.title).includes(q));
  if(!items.length){
    el.innerHTML = '<div class="lib-empty">'+(l ? 'В библиотеке нет треков для добавления.' : 'Выберите плейлист слева.')+'</div>';
    return;
  }
  el.innerHTML = items.map(t=>
    '<label class="mt-pick"><input type="checkbox" data-mpick="'+escapeHtml(t.id)+'"'+(musicPickSelection.has(t.id)?' checked':'')+'>'
    + '<span class="mt-pick-name">'+escapeHtml(t.title)+'</span>'
    + '<span class="mt-pick-dur">'+(t.dur?musicFmtTime(t.dur):'—')+'</span></label>'
  ).join('');
}
function musicPickAddSelected(){
  const l = musicList(music.currentList);
  const modal = document.getElementById('musicPickModal');
  if(!l){ closeModal(modal); return; }
  let n = 0;
  musicPickSelection.forEach(id=>{
    if(music.tracks[id] && !l.trackIds.includes(id)){ l.trackIds.push(id); n++; }
  });
  musicPickSelection = new Set();
  closeModal(modal);
  musicSave(); musicRenderAll();
  toast(n ? 'Добавлено в плейлист: '+n : 'Ничего не выбрано');
}

/* После импорта резервной копии на другом устройстве в плейлистах остаются описания без файлов */
function musicMarkMissing(){
  return openMusicDB().then(db=> new Promise(resolve=>{
    if(!db){ resolve(); return; }
    let req = null;
    try{ req = db.transaction(MUSIC_STORE,'readonly').objectStore(MUSIC_STORE).getAllKeys(); }
    catch(e){ resolve(); return; }
    req.onsuccess = ()=>{
      const have = new Set(req.result || []);
      Object.keys(music.tracks).forEach(id=>{ music.tracks[id].missing = !have.has(music.tracks[id].key); });
      resolve();
    };
    req.onerror = ()=> resolve();
  })).then(()=>{ musicRenderTracks(); });
}
function musicInit(){
  musicLoad();
  const volEl = document.getElementById('mbVol');
  if(volEl) volEl.value = Math.round(music.volume*100);
  const shEl = document.getElementById('musicShuffle');
  if(shEl) shEl.checked = music.shuffle;
  const rpEl = document.getElementById('musicRepeat');
  if(rpEl) rpEl.value = music.repeat;
  musicApplyVolume();
  musicRenderAll();
  musicBindMediaSession();
  musicMarkMissing();
}

(function bindMusic(){
  const on = (id, ev, fn)=>{
    const el = document.getElementById(id);
    if(el) el.addEventListener(ev, fn);
  };

  on('mbPrev','click', musicPrev);
  on('mbPlay','click', musicToggle);
  on('mbNext','click', ()=> musicNext(false));
  on('mbMute','click', musicToggleMute);
  on('mbTitle','click', ()=> showTab('music'));
  on('mbVol','input', ()=>{
    const v = document.getElementById('mbVol');
    musicSetVolume(v ? (+v.value||0)/100 : 0);
  });

  on('musicImport','click', ()=>{ const f = document.getElementById('musicFileInput'); if(f) f.click(); });
  on('musicFileInput','change', e=>{
    musicAddFiles(e.target.files);
    e.target.value = '';
  });
  on('musicNewList','click', musicNewList);
  on('musicPlayAll','click', ()=>{
    const list = musicListTracks(music.currentList);
    if(!list.length){ toast('В плейлисте нет треков'); return; }
    musicBuildQueue(music.currentList, null);
    if(music.queue.length) musicPlay(music.queue[0], music.currentList);
  });
  on('musicShuffle','change', e=>{
    music.shuffle = !!e.target.checked;
    musicBuildQueue(music.currentList, music.currentId);
    musicSave();
    toast(music.shuffle ? 'Треки перемешаны' : 'Треки по порядку');
  });
  on('musicRepeat','change', e=>{ music.repeat = e.target.value; musicSave(); });
  on('musicRename','click', musicRenameList);
  on('musicDelete','click', musicDeleteList);
  on('musicAddFromLib','click', ()=>{
    if(music.currentList === MUSIC_ALL){ toast('Выберите плейлист слева'); return; }
    musicPickSelection = new Set();
    const s = document.getElementById('musicPickSearch');
    if(s) s.value = '';
    musicRenderPick();
    openModal(document.getElementById('musicPickModal'), document.getElementById('musicAddFromLib'));
  });

  const listsEl = document.getElementById('musicLists');
  if(listsEl) listsEl.addEventListener('click', e=>{
    const b = e.target && e.target.closest ? e.target.closest('[data-mlist]') : null;
    if(!b) return;
    music.currentList = b.dataset.mlist;
    musicSave(); musicRenderAll();
  });
  const tracksEl = document.getElementById('musicTracks');
  if(tracksEl) tracksEl.addEventListener('click', e=>{
    const act = e.target && e.target.closest ? e.target.closest('[data-mact]') : null;
    const row = e.target && e.target.closest ? e.target.closest('[data-mid]') : null;
    if(!row) return;
    const id = row.dataset.mid;
    if(act){
      if(act.dataset.mact === 'remove') musicRemoveFromList(id);
      else if(act.dataset.mact === 'delete') musicDeleteTrack(id);
      return;
    }
    musicPlay(id, music.currentList);
  });

  const viewMusic = document.getElementById('view-music');
  const musicMainEl = document.querySelector('.music-main');
  if(viewMusic){
    viewMusic.addEventListener('dragover', e=>{
      if(!e.dataTransfer) return;
      e.preventDefault();
      if(musicMainEl) musicMainEl.classList.add('dragover');
    });
    viewMusic.addEventListener('dragleave', ()=>{ if(musicMainEl) musicMainEl.classList.remove('dragover'); });
    viewMusic.addEventListener('drop', e=>{
      e.preventDefault();
      if(musicMainEl) musicMainEl.classList.remove('dragover');
      const files = e.dataTransfer && e.dataTransfer.files;
      if(files && files.length) musicAddFiles(files);
    });
  }

  const pickModal = document.getElementById('musicPickModal');
  if(pickModal){
    on('musicPickClose','click', ()=> closeModal(pickModal));
    pickModal.addEventListener('click', e=>{ if(e.target === pickModal) closeModal(pickModal); });
    on('musicPickSearch','input', musicRenderPick);
    on('musicPickAdd','click', musicPickAddSelected);
    const pickList = document.getElementById('musicPickList');
    if(pickList) pickList.addEventListener('change', e=>{
      const cb = e.target && e.target.closest ? e.target.closest('[data-mpick]') : null;
      if(!cb) return;
      if(cb.checked) musicPickSelection.add(cb.dataset.mpick);
      else musicPickSelection.delete(cb.dataset.mpick);
    });
  }

  if(musicAudio){
    musicAudio.addEventListener('play', ()=> musicRenderBar());
    musicAudio.addEventListener('pause', ()=> musicRenderBar());
    musicAudio.addEventListener('ended', ()=>{
      if(music.repeat === 'one'){
        try{ musicAudio.currentTime = 0; }catch(e){}
        const p = musicAudio.play();
        if(p && p.catch) p.catch(()=>{});
        return;
      }
      musicNext(true);
    });
  }

  document.addEventListener('keydown', e=>{
    const tag = (e.target && e.target.tagName || '').toLowerCase();
    if(tag==='input' || tag==='textarea' || tag==='select' || (e.target && e.target.isContentEditable)) return;
    const ctrl = e.ctrlKey && !e.altKey && !e.metaKey;
    if(!ctrl) return;
    const code = e.code || '';
    if(!e.shiftKey && (code === 'Space' || e.key === ' ')){
      e.preventDefault();
      musicToggle();
    } else if(e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || code === 'ArrowLeft' || code === 'ArrowRight')){
      e.preventDefault();
      if(e.key === 'ArrowLeft' || code === 'ArrowLeft') musicPrev(); else musicNext(false);
    } else if(!e.shiftKey && (code === 'KeyM' || e.key === 'm' || e.key === 'M' || e.key === 'ь' || e.key === 'Ь')){
      e.preventDefault();
      musicToggleMute();
    }
  });
})();

const STORE_MAP = KEYS.map;
const MAP_MAX_BYTES = 8*1024*1024;      // лимит размера файла карты
const MAP_ALLOWED = ['image/png','image/jpeg','image/webp'];
let maps = [];                 // {id,name,bgKey,bg,baseW,baseH,zoom,scrollX,scrollY,markers:[],draw:[]}
let activeMapId = null;
let mapLocked = false;
let mapPenOn = false;
let mapGridOn = false;  // сетка отключена
let mapGridStep = 18;   // шаг сетки, px
let mapPlaceOn = false; // режим расстановки маркеров кликом
let selectedMarkerId = null;
let selectedPropId = null;
let mapRulerOn = false;
let mapFogMode = 'off';       // 'off' | 'hide' | 'reveal'
let mapZoneType = 'none';     // 'none' | 'circle' | 'cone' | 'line' | 'cube'
let rulerPt = null;     // {x,y} точка начала измерения (в координатах карты)

function curMap(){ return maps.find(m=>m.id===activeMapId) || null; }
function loadMap(){
  const data = safeParseRaw(localStorage.getItem(STORE_MAP), 'shirma_map');
  if(Array.isArray(data) && data.length){ maps = data.map(normMap); }
  else if(data && typeof data==='object' && !Array.isArray(data)){
    // миграция старого формата {bg, tokens, zoom, scrollX, scrollY, locked, combat, concentration}
    maps = [{
      id: 'm'+Date.now().toString(36), name:'Карта 1',
      bgKey: data.bgKey||null, bg: data.bg||null,
      baseW: data.baseW||800, baseH: data.baseH||600,
      zoom: data.zoom||1, scrollX: data.scrollX||0, scrollY: data.scrollY||0,
      markers: (data.tokens||[]).map(t=>({ id:t.id||('k'+Math.random().toString(36).slice(2,7)),
        x:t.x, y:t.y, label:t.title||'Маркер', color:t.color||'#7fb3e6' })),
      draw: []
    }];
  } else { maps = []; }
  if(!maps.length){ maps=[defaultScreenMap()]; }
  if(!activeMapId) activeMapId = maps[0].id;
  return true;
}
function normProp(p){
  return {
    id:String(p.id||('p'+Math.random().toString(36).slice(2,7))),
    file:String(p.file||''),
    x:+p.x||0, y:+p.y||0,
    w:Math.max(0.25, Math.min(4, +p.w||1)),
    rot:(((+p.rot||0)%360)+360)%360,
    flip:!!p.flip
  };
}
function normMap(m){
  return {
    id:String(m.id||('m'+Math.random().toString(36).slice(2,7))),
    name:String(m.name||'Карта').slice(0,40),
    bgKey:m.bgKey||null, bg:m.bg||null,
    baseW:Math.max(100, +m.baseW||800), baseH:Math.max(100, +m.baseH||600),
    zoom: (+m.zoom>0? +m.zoom : 1),
    userZoom: Math.min(6, Math.max(0.4, +m.userZoom || 1)),
    scrollX:+m.scrollX||0, scrollY:+m.scrollY||0,
    shape: m.shape==='square'? 'square' : 'hex',
    auto: !!m.auto,
    snap: !!m.snap,
    cellPx: Math.max(12, Math.min(160, +m.cellPx || 34.641)),
    feetPerCell: Math.max(1, Math.min(60, +m.feetPerCell || 5)),
    fogOn: !!m.fogOn,
    fog: Array.isArray(m.fog)? m.fog.map(s=>({ mode: s.mode==='hide'?'hide':'reveal',
      width: Math.max(8, +s.width||60), pts: Array.isArray(s.pts)? s.pts.map(p=>[+p[0],+p[1]]) : [] })) : [],
    zones: Array.isArray(m.zones)? m.zones.map(z=>({ id:String(z.id||('z'+Math.random().toString(36).slice(2,7))),
      type: ['circle','cone','line','cube'].includes(z.type)? z.type : 'circle',
      x:+z.x||0, y:+z.y||0, r:Math.max(8, +z.r||60), rot:+z.rot||0,
      color: z.color||'#c0564f' })) : [],
    markers: Array.isArray(m.markers)? m.markers.map(normMarker) : [],
    draw: Array.isArray(m.draw)? m.draw.map(normStroke) : [],
    props: Array.isArray(m.props)? m.props.map(normProp) : []
  };
}
function normMarker(t){
  const num = v => (v===undefined||v===null||v==='')? null : Math.max(0, Math.round(+v));
  return { id:String(t.id||('k'+Math.random().toString(36).slice(2,7))),
    x:+t.x||0, y:+t.y||0, label:String(t.label||'Маркер').slice(0,40), color:t.color||'#7fb3e6',
    kind: (t.kind==='pc'||t.kind==='mob')? t.kind : 'marker',
    size: (+t.size===2? 2 : 1),
    rot: (+t.rot===45? 45 : 0),
    hp: num(t.hp), hpMax: num(t.hpMax),
    ac: (t.ac===undefined||t.ac===null||t.ac==='')? '' : String(t.ac).slice(0,6),
    blockId: t.blockId||null, bestId: t.bestId||null };
}
function normStroke(s){
  const base={ color:s.color||'#c9a227', width:+s.width||2, wall:!!s.wall, rot:+s.rot||0 };
  if(s.type==='rect' || s.type==='ellipse' || s.type==='corridor'){
    return Object.assign(base, { type:s.type,
      x:Math.max(0,+s.x||0), y:Math.max(0,+s.y||0),
      w:Math.max(1,+s.w||1), h:Math.max(1,+s.h||1) });
  }
  if(s.type==='cpath'){
    return Object.assign(base, { type:'cpath', w:Math.max(2,+s.w||20),
      pts: Array.isArray(s.pts)? s.pts.map(p=>[+p[0],+p[1]]) : [] });
  }
  if(s.type==='poly'){
    return Object.assign(base, { type:'poly',
      pts: Array.isArray(s.pts)? s.pts.map(p=>[+p[0],+p[1]]) : [] });
  }
  return Object.assign(base, { pts: Array.isArray(s.pts)? s.pts.map(p=>[+p[0],+p[1]]) : [] });
}

/* Размер видимой области под карту (с учётом отступов .map-canvas) */
function mapViewportSize(){
  const mc=document.getElementById('mapCanvas');
  const pad=24;
  const w=Math.max(320, (mc && mc.clientWidth ? mc.clientWidth : window.innerWidth) - pad);
  const h=Math.max(240, (mc && mc.clientHeight ? mc.clientHeight : window.innerHeight-140) - pad);
  return { w:Math.round(w), h:Math.round(h) };
}
/* Карта по умолчанию: квадратная сетка на всё доступное пространство */
function defaultScreenMap(name){
  const v=mapViewportSize();
  return { id:'m'+Date.now().toString(36)+Math.random().toString(36).slice(2,5),
    name:name||'Карта 1', bgKey:null, bg:null, auto:true, shape:'square', snap:false,
    cellPx:40, feetPerCell:5, baseW:v.w, baseH:v.h,
    zoom:1, userZoom:1, scrollX:0, scrollY:0, markers:[], draw:[], fog:[], zones:[] };
}

function saveMap(){ try{ localStorage.setItem(STORE_MAP, JSON.stringify(maps)); }catch(e){} }

/* При изменении окна карта пересчитывает вписывание (с задержкой) */
let mapResizeTimer = null;
window.addEventListener('resize', ()=>{
  if(currentTab!=='map') return;
  clearTimeout(mapResizeTimer);
  mapResizeTimer = setTimeout(()=>{ const m=curMap(); if(!m) return;
    const mc=document.getElementById('mapCanvas'); if(mc){ m.scrollX=mc.scrollLeft; m.scrollY=mc.scrollTop; }
    renderMap(); }, 160);
});

function mapZoom(delta){
  const m=curMap(); if(!m || mapLocked) return;
  const mc=document.getElementById('mapCanvas'); if(!mc) return;
  const old=Math.min(6, Math.max(0.4, +m.userZoom || 1));
  const next=Math.min(6, Math.max(0.4, delta>0 ? old*1.2 : old/1.2));
  if(Math.abs(next-old)<0.001) return;
  const k=next/old;
  m.scrollX=Math.max(0, (mc.scrollLeft + mc.clientWidth/2)*k - mc.clientWidth/2);
  m.scrollY=Math.max(0, (mc.scrollTop + mc.clientHeight/2)*k - mc.clientHeight/2);
  m.userZoom=next;
  saveMap(); renderMap();
}
function updateMapLockBtn(){
  const btn=document.getElementById('mapLock'); if(!btn) return;
  btn.textContent = mapLocked ? 'Закреплено' : 'Закрепить';
  btn.title = mapLocked ? 'Карта закреплена: масштаб и прокрутка заблокированы' : 'Закрепить карту в текущем положении';
}
function updateMapPenBtn(){
  const btn=document.getElementById('mapPen');
  if(btn){
    btn.textContent = mapPenOn ? '✏ Перо (рисует)' : '✏ Перо';
    btn.classList.toggle('active', !!mapPenOn);
  }
  const clr=document.getElementById('mapPenClear'); if(clr) clr.hidden = !mapPenOn;
  const mc=document.getElementById('mapCanvas'); if(mc){
    const cv=mc.querySelector('canvas.map-draw');
    if(cv) cv.classList.toggle('drawing', !!mapPenOn || mapDrawToolValue()==='select');
  }
}

function renderMap(){
  if(typeof hideMapNoteTip==='function') hideMapNoteTip();
  const mc = document.getElementById('mapCanvas'); if(!mc) return;
  const m = curMap();
  renderMapTabs();
  mc.innerHTML='';
  if(!m){ return; }
  mc.classList.toggle('locked', !!mapLocked);
  mc.classList.toggle('no-grid', !mapGridOn);
  mc.style.setProperty('--grid-step', mapGridStep+'px');
  if(m.auto){                                  // полноэкранная карта тянется за окном
    const v=mapViewportSize(); m.baseW=v.w; m.baseH=v.h;
  }
  // вписывание в экран × ручной зум (кнопки и колесо)
  const fitZ = mapFitScale(mc, m);
  const z = Math.min(8, Math.max(0.05, fitZ * (m.userZoom||1)));
  const W = Math.max(1, Math.round(m.baseW * z));
  const H = Math.max(1, Math.round(m.baseH * z));
  const stage=document.createElement('div');
  stage.className='map-stage';
  stage.style.width=W+'px'; stage.style.height=H+'px';
  const wrapper=document.createElement('div');
  wrapper.className='map-zoom'+(m.shape==='square'?' shape-square':' shape-hex');
  wrapper.classList.toggle('mono', mapMonoOn());
  wrapper.style.width=W+'px'; wrapper.style.height=H+'px';
  wrapper.style.position='relative';
  const cellPx = mapCellPx(m);
  wrapper.style.setProperty('--cell', cellPx.toFixed(2)+'px');
  wrapper.style.setProperty('--cell-h', (cellPx*1.73205).toFixed(2)+'px');
  stage.appendChild(wrapper);
  mc.appendChild(stage);
  if(mapGridOn){
    const grid=document.createElement('div');
    grid.className='map-grid';
    wrapper.appendChild(grid);
  }
  // название карты
  const titleEl=document.createElement('div');
  titleEl.className='map-title';
  titleEl.textContent=m.name;
  titleEl.addEventListener('click', e=>{ e.stopPropagation(); renameMap(m.id); });
  wrapper.appendChild(titleEl);
  // линейка (визуал)
  if(mapRulerOn && rulerPt){
    const li=document.createElement('div'); li.className='map-ruler'; wrapper.appendChild(li);
  }
  const lbl=document.getElementById('mapZoomLabel'); if(lbl) lbl.textContent=Math.round(z*100)+'%';

  const bgSrc = (m.bgKey && mediaCache[m.bgKey]) || m.bg;
  if(bgSrc){
    mc.classList.add('has-bg');
    const img=document.createElement('img');
    img.className='map-bg';
    img.src=bgSrc; img.draggable=false;
    img.onload=()=>{   // размеры карты уточняются один раз, без цикла перерисовок
      const nw=img.naturalWidth||m.baseW, nh=img.naturalHeight||m.baseH;
      if(nw!==m.baseW || nh!==m.baseH){ m.baseW=nw; m.baseH=nh; saveMap(); renderMap(); }
    };
    wrapper.appendChild(img);
  } else { mc.classList.remove('has-bg'); }

  // маркеры и токены
  (m.markers||[]).forEach(k=>{
    const sel = k.id===selectedMarkerId;
    const isToken = k.kind==='pc' || k.kind==='mob';
    const el=document.createElement('div');
    if(isToken){
      const cell = mapCellPx(m);
      const d = Math.round(cell * (k.size===2 ? 1.8 : 0.92));
      el.className='map-token'+(sel?' selected':'')+(k.kind==='mob'?' npc':'');
      el.style.width=d+'px'; el.style.height=d+'px';
      el.style.left=percent(k.x,m.baseW)+'%'; el.style.top=percent(k.y,m.baseH)+'%';
      el.style.background=k.color||'#7fb3e6';
      el.style.fontSize=Math.round(d*0.34)+'px';
      el.dataset.id=k.id; el.title=k.label;
      if(k.size===2){
        const ft=document.createElement('i'); ft.className='tok-foot';
        ft.style.transform='rotate('+(k.rot||0)+'deg)';
        el.appendChild(ft);
      }
      const init=document.createElement('span'); init.className='tok-init'; init.textContent=tokenInitials(k.label);
      el.appendChild(init);
      if(k.hpMax){
        const bar=document.createElement('div'); bar.className='tok-hp';
        const fill=document.createElement('i');
        fill.style.width=Math.max(0,Math.min(100, Math.round((Number(k.hp||0)/Math.max(1,Number(k.hpMax)))*100)))+'%';
        bar.appendChild(fill); el.appendChild(bar);
      }
      const lbl=document.createElement('div'); lbl.className='tok-name'; lbl.textContent=k.label;
      el.appendChild(lbl);
    } else {
      const linked = !!k.blockId && (blocks||[]).some(b=>b.id===k.blockId);
      el.className='map-marker'+(sel?' selected':'')+(linked?' has-note':'');
      el.style.left=percent(k.x,m.baseW)+'%'; el.style.top=percent(k.y,m.baseH)+'%';
      el.style.background=k.color||'#7fb3e6';
      el.dataset.id=k.id;
      el.title = linked ? (k.label+' — открыть заметку (Shift — настройки метки)') : k.label;
      const lbl2=document.createElement('div'); lbl2.className='map-marker-label'; lbl2.textContent=k.label;
      el.appendChild(lbl2);
      if(linked){ const dot=document.createElement('span'); dot.className='mk-note-dot'; el.appendChild(dot); }
    }
    wrapper.appendChild(el);
    // клик: у метки с заметкой — переход к ней, иначе выбор и панель
    el.addEventListener('click', e=>{
      e.stopPropagation();
      if(el.__dragged){ el.__dragged=false; return; }
      if(!isToken && !e.shiftKey && k.blockId && (blocks||[]).some(b=>b.id===k.blockId)){
        if(typeof openMarkerNote==='function'){ openMarkerNote(m,k); return; }
      }
      selectedMarkerId = (selectedMarkerId===k.id)? null : k.id;
      renderMap();
    });
    if(!isToken){
      el.addEventListener('mouseenter', ()=>{ if(typeof showMapNoteTip==='function') showMapNoteTip(el,m,k); });
      el.addEventListener('mouseleave', ()=>{ if(typeof hideMapNoteTip==='function') hideMapNoteTip(); });
      el.addEventListener('pointerdown', ()=>{ if(typeof hideMapNoteTip==='function') hideMapNoteTip(); });
    }
    // drag маркера: указатель (мышь, палец, стилус) с захватом
    el.addEventListener('pointerdown', e=>{
      if(mapPenOn) return;
      if(e.button!==undefined && e.button!==0 && e.pointerType!=='touch') return;
      e.preventDefault(); e.stopPropagation();
      try{ el.setPointerCapture && el.setPointerCapture(e.pointerId); }catch(err){}
      const sx=e.clientX, sy=e.clientY, ox=k.x, oy=k.y;
      let moved=false;
      const move=ev=>{
        const dx=ev.clientX-sx, dy=ev.clientY-sy;
        if(Math.abs(dx)>2 || Math.abs(dy)>2) moved=true;
        let nx=Math.max(0,Math.min(m.baseW, ox + dx/z));
        let ny=Math.max(0,Math.min(m.baseH, oy + dy/z));
        const sp=snapPoint(m, nx, ny);
        k.x=sp.x; k.y=sp.y;
        el.style.left=percent(k.x,m.baseW)+'%'; el.style.top=percent(k.y,m.baseH)+'%';
      };
      const up=()=>{
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        if(moved){ el.__dragged=true; saveMap(); renderMap(); }
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  });
  // пропсы (ассеты)
  (m.props||[]).forEach(pr=>{
    const el=document.createElement('img');
    el.className='map-prop'+(pr.id===selectedPropId?' selected':'');
    el.src='assets/tiles/'+pr.file+'?v=2';
    el.draggable=false; el.alt='';
    el.style.left=percent(pr.x,m.baseW)+'%';
    el.style.top=percent(pr.y,m.baseH)+'%';
    const d=Math.max(8, pr.w*cellPx);
    el.style.width=d+'px'; el.style.height=d+'px';
    el.style.transform='translate(-50%,-50%) rotate('+pr.rot+'deg)'+(pr.flip?' scaleX(-1)':'');
    el.dataset.id=pr.id; el.title='Пропс';
    wrapper.appendChild(el);
    el.addEventListener('click', e=>{
      e.stopPropagation();
      selectedPropId = (selectedPropId===pr.id)? null : pr.id;
      renderMap();
    });
    el.addEventListener('pointerdown', e=>{
      if(mapPenOn) return;
      if(e.button!==undefined && e.button!==0 && e.pointerType!=='touch') return;
      e.preventDefault(); e.stopPropagation();
      try{ el.setPointerCapture && el.setPointerCapture(e.pointerId); }catch(err){}
      const sx=e.clientX, sy=e.clientY, ox=pr.x, oy=pr.y;
      let moved=false;
      const move=ev=>{
        const dx=ev.clientX-sx, dy=ev.clientY-sy;
        if(Math.abs(dx)>2 || Math.abs(dy)>2) moved=true;
        let nx=Math.max(0,Math.min(m.baseW, ox + dx/z));
        let ny=Math.max(0,Math.min(m.baseH, oy + dy/z));
        const sp=snapPoint(m,nx,ny);
        pr.x=sp.x; pr.y=sp.y;
        el.style.left=percent(pr.x,m.baseW)+'%'; el.style.top=percent(pr.y,m.baseH)+'%';
      };
      const up=()=>{
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        if(moved){ saveMap(); renderMap(); }
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  });
  // шаблоны зон (AoE)
  drawZones(wrapper, m);

  // слой тумана войны (выше токенов)
  const fog=document.createElement('canvas');
  fog.className='map-fog'+(mapFogMode!=='off'?' painting':'');
  wrapper.appendChild(fog);
  const fctx=fog.getContext('2d');
  fitFog(fog,m,z);
  drawFog(fctx,fog,m,z);
  bindFog(fog,wrapper,m,z);

  // слой рисования
  const cv=document.createElement('canvas');
  cv.className='map-draw';
  wrapper.appendChild(cv);
  fitCanvas(wrapper,m,z);
  let ctx=cv.getContext('2d');
  drawStrokes(ctx,cv,m,z);
  bindDraw(cv,wrapper,m,z);
  updateMapLockBtn();
  updateMapPenBtn();
  updateTokenPanel();
  if(window.updateMapMarkerCtl) window.updateMapMarkerCtl();
  if(window.updatePropCtl) window.updatePropCtl();
  syncMapControls();
  if(window.__msSync) window.__msSync();
  if(window.updateDrawCtl) window.updateDrawCtl();
  // прокрутка после рендера — в пределах краёв карты
  requestAnimationFrame(()=>{
    mc.scrollLeft=m.scrollX||0; mc.scrollTop=m.scrollY||0;
    clampMapScroll(mc); m.scrollX=mc.scrollLeft; m.scrollY=mc.scrollTop;
  });
}
/* ── Шаблоны зон (AoE) ── */
let zoneFeet = 20;
function zoneRadiusPx(m){
  const feet = Math.max(5, Math.min(240, zoneFeet||20));
  return Math.max(10, (feet / Math.max(1, m.feetPerCell||5)) * mapCellPx(m));
}
function placeZoneAt(m, x, y){
  const type = mapZoneType;
  if(type==='none') return;
  m.zones = m.zones || [];
  const feet = Math.max(5, Math.min(240, zoneFeet||20));
  m.zones.push({ id:'z'+Math.random().toString(36).slice(2,7), type, x, y, feet: feet,
    r: zoneRadiusPx(m), rot: 0, color: type==='circle'?'#c0564f':(type==='cone'?'#e68a4a':(type==='line'?'#7fb3e6':'#86c48f')) });
  saveMap(); renderMap();
  toast('Зона '+feet+' фт добавлена — тащите, чтобы переместить, Shift+тащите — повернуть, двойной клик удаляет');
}
function addZoneAtCenter(){
  const m=curMap(); if(!m) return;
  if(mapZoneType==='none'){ toast('Сначала выберите тип зоны'); return; }
  const mc=document.getElementById('mapCanvas');
  let x=m.baseW/2, y=m.baseH/2;
  if(mc){
    const z=Math.min(8, Math.max(0.05, mapFitScale(mc,m)*(m.userZoom||1)));
    x=(mc.scrollLeft + mc.clientWidth/2)/z;
    y=(mc.scrollTop + mc.clientHeight/2)/z;
  }
  placeZoneAt(m, Math.max(0, Math.min(m.baseW, x)), Math.max(0, Math.min(m.baseH, y)));
  mapZoneType='none';
  const zt=document.getElementById('mapZoneType'); if(zt) zt.value='none';
}
window.addZoneAtCenter = addZoneAtCenter;
function openZoneDialog(){
  const mbox=document.getElementById('zoneModal'); if(!mbox) return;
  const cur = mapZoneType!=='none' ? mapZoneType : 'circle';
  mbox.querySelectorAll('[data-ztype]').forEach(b=>b.classList.toggle('active', b.dataset.ztype===cur));
  const ft=document.getElementById('zoneFeetModal'); if(ft) ft.value=zoneFeet;
  if(typeof openModal==='function') openModal(mbox); else mbox.hidden=false;
}
function bindZoneDialog(){
  const mbox=document.getElementById('zoneModal'); if(!mbox || mbox.dataset.bound) return;
  mbox.dataset.bound='1';
  function close(){ if(typeof closeModal==='function') closeModal(mbox); else mbox.hidden=true; }
  const c=document.getElementById('zoneModalClose'); if(c) c.addEventListener('click', close);
  const cancel=document.getElementById('zoneAddCancel'); if(cancel) cancel.addEventListener('click', close);
  const types=Array.prototype.slice.call(mbox.querySelectorAll('[data-ztype]'));
  types.forEach(b=>b.addEventListener('click', ()=>{ types.forEach(x=>x.classList.toggle('active', x===b)); }));
  const add=document.getElementById('zoneAddConfirm');
  if(add) add.addEventListener('click', ()=>{
    const sel=types.find(b=>b.classList.contains('active')) || types[0];
    const type=sel ? sel.dataset.ztype : 'circle';
    const ft=document.getElementById('zoneFeetModal');
    const feet=Math.max(5, Math.min(240, Math.round((+(ft&&ft.value)||20)/5)*5));
    if(ft) ft.value=feet;
    mapZoneType=type; zoneFeet=feet;
    close();
    addZoneAtCenter();
  });
}
function zoneShapeEl(ns, z){
  const fill = (z.color||'#c0564f')+'55';
  const stroke = z.color||'#c0564f';
  const sw = 2;
  if(z.type==='circle'){
    const c=document.createElementNS(ns,'circle');
    c.setAttribute('cx',z.x); c.setAttribute('cy',z.y); c.setAttribute('r',z.r);
    c.setAttribute('fill',fill); c.setAttribute('stroke',stroke); c.setAttribute('stroke-width',sw);
    return c;
  }
  if(z.type==='cube'){
    const d=z.r, x=z.x-d/2, y=z.y-d/2;
    const r=document.createElementNS(ns,'rect');
    r.setAttribute('x',x); r.setAttribute('y',y); r.setAttribute('width',d); r.setAttribute('height',d);
    r.setAttribute('fill',fill); r.setAttribute('stroke',stroke); r.setAttribute('stroke-width',sw);
    return r;
  }
  if(z.type==='line'){
    const L=z.r, W=z.r*0.12;
    const dx=1, dy=0;
    const px=-dy*W/2, py=dx*W/2;
    const p=document.createElementNS(ns,'polygon');
    p.setAttribute('points', [
      [z.x+px, z.y+py],[z.x+dx*L+px, z.y+dy*L+py],
      [z.x+dx*L-px, z.y+dy*L-py],[z.x-px, z.y-py]
    ].map(a=>a[0].toFixed(1)+','+a[1].toFixed(1)).join(' '));
    p.setAttribute('fill',fill); p.setAttribute('stroke',stroke); p.setAttribute('stroke-width',sw);
    return p;
  }
  // конус: сектор 53° от точки
  const rad=0, half=Math.PI*53/180/2;
  const a1=rad-half, a2=rad+half;
  const x1=z.x+Math.cos(a1)*z.r, y1=z.y+Math.sin(a1)*z.r;
  const x2=z.x+Math.cos(a2)*z.r, y2=z.y+Math.sin(a2)*z.r;
  const p=document.createElementNS(ns,'path');
  p.setAttribute('d', `M ${z.x} ${z.y} L ${x1} ${y1} A ${z.r} ${z.r} 0 0 1 ${x2} ${y2} Z`);
  p.setAttribute('fill',fill); p.setAttribute('stroke',stroke); p.setAttribute('stroke-width',sw);
  return p;
}
function drawZones(wrapper, m){
  const list=m.zones||[];
  if(!list.length) return;
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('class','map-zones');
  svg.setAttribute('viewBox', '0 0 '+m.baseW+' '+m.baseH);
  svg.setAttribute('preserveAspectRatio','none');
  const z0 = mapFitScale(document.getElementById('mapCanvas'), m);
  list.forEach(z=>{
    const el=zoneShapeEl(ns, z);
    el.classList.add('zone');
    el.dataset.zid=z.id;
    el.setAttribute('transform', 'rotate('+((+z.rot||0))+' '+z.x+' '+z.y+')');
    el.addEventListener('mousedown', e=>{
      e.preventDefault(); e.stopPropagation();
      const wr=wrapper.getBoundingClientRect();
      const toBase=ev=>[ (ev.clientX-wr.left)/z0, (ev.clientY-wr.top)/z0 ];
      if(e.shiftKey){
        const b0=toBase(e);
        const a0=Math.atan2(b0[1]-z.y, b0[0]-z.x);
        const r0=+z.rot||0;
        pointerDrag(e, ev=>{
          const b1=toBase(ev);
          const a1=Math.atan2(b1[1]-z.y, b1[0]-z.x);
          z.rot=(((r0+(a1-a0)*180/Math.PI)%360)+360)%360;
          el.setAttribute('transform', 'rotate('+z.rot+' '+z.x+' '+z.y+')');
        }, ()=>{ saveMap(); renderMap(); });
        return;
      }
      const sx=e.clientX, sy=e.clientY, ox=z.x, oy=z.y;
      pointerDrag(e, ev=>{
        z.x=ox+(ev.clientX-sx)/z0; z.y=oy+(ev.clientY-sy)/z0;
        el.setAttribute('transform', 'translate('+(z.x-ox)+','+(z.y-oy)+') rotate('+((+z.rot||0))+' '+ox+' '+oy+')');
      }, ()=>{ saveMap(); renderMap(); });
    });
    el.addEventListener('dblclick', e=>{
      e.preventDefault(); e.stopPropagation();
      m.zones=m.zones.filter(x=>x.id!==z.id); saveMap(); renderMap();
    });
    svg.appendChild(el);
  });
  wrapper.appendChild(svg);
}

/* ── Туман войны ── */
function fitFog(fog, m, z){
  const dpr=window.devicePixelRatio||1;
  fog.style.width='100%'; fog.style.height='100%';
  fog.width=Math.round(m.baseW*(z||1)*dpr);
  fog.height=Math.round(m.baseH*(z||1)*dpr);
}
function drawFog(ctx, fog, m, z){
  if(!ctx) return;
  const dpr=window.devicePixelRatio||1;
  ctx.clearRect(0,0,fog.width,fog.height);
  if(!m.fogOn || !(m.fog||[]).length) return;
  ctx.save();
  ctx.scale(dpr*(z||1), dpr*(z||1));
  ctx.lineCap='round'; ctx.lineJoin='round';
  (m.fog||[]).forEach(s=>{
    if(!s.pts || !s.pts.length) return;
    const reveal = s.mode==='reveal';
    ctx.globalCompositeOperation = reveal ? 'destination-out' : 'source-over';
    ctx.strokeStyle = reveal ? 'rgba(0,0,0,1)' : 'rgba(10,12,16,0.94)';
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = Math.max(6, +s.width||60);
    ctx.beginPath();
    if(s.pts.length===1){
      ctx.arc(s.pts[0][0], s.pts[0][1], ctx.lineWidth/2, 0, Math.PI*2);
      ctx.fill();
    } else {
      s.pts.forEach((p,i)=> i? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]));
      ctx.stroke();
    }
  });
  ctx.restore();
}
function bindFog(fog, wrapper, m, z){
  const dpr=window.devicePixelRatio||1;
  let painting=false, cur=null;
  const toBase = e => {
    const r=fog.getBoundingClientRect();
    return [ (e.clientX-r.left)/(z||1), (e.clientY-r.top)/(z||1) ];
  };
  fog.addEventListener('pointerdown', e=>{
    if(mapFogMode==='off' || mapLocked) return;
    e.preventDefault(); e.stopPropagation();
    fog.setPointerCapture && fog.setPointerCapture(e.pointerId);
    painting=true;
    cur={ mode: mapFogMode==='reveal'?'reveal':'hide',
          width: Math.round(Math.max(24, mapCellPx(m)*2.6)),
          pts:[toBase(e)] };
  });
  fog.addEventListener('pointermove', e=>{
    if(!painting||!cur) return;
    e.preventDefault();
    cur.pts.push(toBase(e));
    // рисуем сразу, чтобы было видно мазок
    const ctx=fog.getContext('2d');
    ctx.save(); ctx.scale(dpr*(z||1), dpr*(z||1));
    const reveal = cur.mode==='reveal';
    ctx.globalCompositeOperation = reveal ? 'destination-out' : 'source-over';
    ctx.strokeStyle = reveal ? 'rgba(0,0,0,1)' : 'rgba(10,12,16,0.94)';
    ctx.lineWidth = cur.width; ctx.lineCap='round'; ctx.lineJoin='round';
    const p0=cur.pts[cur.pts.length-2]||cur.pts[0], p1=cur.pts[cur.pts.length-1];
    ctx.beginPath(); ctx.moveTo(p0[0],p0[1]); ctx.lineTo(p1[0],p1[1]); ctx.stroke();
    ctx.restore();
  });
  const end=()=>{
    if(!painting) return;
    painting=false;
    if(cur && cur.pts.length){ m.fog.push(cur); m.fogOn=true; saveMap(); }
    cur=null;
    renderMap();
  };
  fog.addEventListener('pointerup', end);
  fog.addEventListener('pointercancel', end);
  fog.addEventListener('pointerleave', end);
}

/* Переключатели карты: форма клетки, привязка, размер клетки */
function syncMapControls(){
  const m=curMap(); if(!m) return;
  const sh=document.getElementById('mapShape'); if(sh) sh.value = m.shape==='square'?'square':'hex';
  const sn=document.getElementById('mapSnap'); if(sn) sn.checked = !!m.snap;
  const cp=document.getElementById('mapCellPx'); if(cp) cp.value = Math.round(mapCellPx(m));
  const fm=document.getElementById('mapFogMode'); if(fm) fm.value = mapFogMode;
  const ft=document.getElementById('mapFeet'); if(ft) ft.value = String(Math.round(m.feetPerCell||5));
  const zt=document.getElementById('mapZoneType'); if(zt) zt.value = mapZoneType;
}
(function bindMapControls(){
  document.getElementById('mapShape')?.addEventListener('change', e=>{
    const m=curMap(); if(!m) return;
    m.shape = e.target.value==='square'? 'square' : 'hex';
    saveMap(); renderMap();
  });
  document.getElementById('mapSnap')?.addEventListener('change', e=>{
    const m=curMap(); if(!m) return;
    m.snap = !!e.target.checked; saveMap();
    toast(m.snap ? 'Привязка к клеткам включена' : 'Привязка к клеткам выключена');
  });
  document.getElementById('mapZoneType')?.addEventListener('change', e=>{
    mapZoneType = e.target.value;
    if(mapZoneType!=='none'){
      const sel=document.getElementById('mapDrawTool');
      if(sel && sel.value!=='none'){ sel.value='none'; sel.dispatchEvent(new Event('change',{bubbles:true})); }
      toast('Кликните по карте, чтобы поставить зону');
    }
  });
  const za=document.getElementById('mapZoneAdd');
  if(za && !za.dataset.bound){ za.dataset.bound='1'; za.addEventListener('click', ()=> openZoneDialog()); }
  bindZoneDialog();
  document.getElementById('mapZoneClear')?.addEventListener('click', ()=>{
    const m=curMap(); if(!m) return;
    m.zones=[]; saveMap(); renderMap(); toast('Зоны убраны');
  });
  document.getElementById('mapFeet')?.addEventListener('change', e=>{
    const m=curMap(); if(!m) return;
    m.feetPerCell = Math.max(1, Math.min(60, +e.target.value || 5));
    saveMap();
  });
  document.getElementById('mapFogMode')?.addEventListener('change', e=>{
    mapFogMode = e.target.value;
    const m=curMap(); if(m){ m.fogOn = mapFogMode!=='off'; saveMap(); }
    renderMap();
    if(mapFogMode!=='off') toast(mapFogMode==='hide'?'Туман: закрашиваем области':'Туман: открываем области');
  });
  document.getElementById('mapCellPx')?.addEventListener('change', e=>{
    const m=curMap(); if(!m) return;
    m.cellPx = Math.max(12, Math.min(160, +e.target.value || 34.641));
    saveMap(); renderMap();
  });
})();

/* ХП/КД: держим токен и карточку персонажа/монстра синхронными */
function tokenToBlock(k){
  if(!k || !k.blockId) return null;
  const b=findBlock(k.blockId);
  return b || null;
}
function syncTokenToBlock(k){
  const b=tokenToBlock(k);
  if(!b) return;
  const max=Math.max(0, Math.round(+k.hpMax||0));
  if(max){ b.props = b.props || {}; b.props['ХП'] = String(max); }
  if(k.hp!==null && k.hp!==undefined && max){
    b.dmg = Math.max(0, max - Math.max(0, Math.round(+k.hp||0)));
  }
  save();
  if(currentTab==='battle' && typeof renderBattle==='function'){ try{ renderBattle(); }catch(e){} }
}
function syncBlockToTokens(b){
  if(!b) return 0;
  const max=hpMaxOf(b);
  if(!max) return 0;
  const cur=hpCurOf(b);
  let n=0;
  (maps||[]).forEach(m=>{
    (m.markers||[]).forEach(k=>{
      if(k.blockId===b.id && (k.kind==='pc'||k.kind==='mob')){
        k.hp=cur; k.hpMax=max; n++;
      }
    });
  });
  return n;
}

/* Панель выбранного токена (персонаж/монстр на карте) */
function curToken(){
  const m=curMap();
  return (m && selectedMarkerId) ? (m.markers||[]).find(x=>x.id===selectedMarkerId) : null;
}
function updateTokenPanel(){
  const pnl=document.getElementById('tokenPanel'); if(!pnl) return;
  const k=curToken();
  const show = !!(k && (k.kind==='pc'||k.kind==='mob'));
  pnl.hidden = !show;
  if(!show) return;
  const t=document.getElementById('tokenPanelTitle'); if(t) t.textContent = k.kind==='mob'?'Монстр':'Персонаж';
  const nm=document.getElementById('tokenName'); if(nm) nm.value=k.label||'';
  const sz=document.getElementById('tokenSize'); if(sz) sz.value=String(k.size||1);
  const rt=document.getElementById('tokenRot'); if(rt) rt.checked = k.rot===45;
  const cl=document.getElementById('tokenColor'); if(cl) cl.value = /^#[0-9a-f]{6}$/i.test(k.color||'')? k.color : '#7fb3e6';
  const hp=document.getElementById('tokenHp'); if(hp) hp.value = (k.hp===null||k.hp===undefined)?'':k.hp;
  const hm=document.getElementById('tokenHpMax'); if(hm) hm.value = (k.hpMax===null||k.hpMax===undefined)?'':k.hpMax;
  const ac=document.getElementById('tokenAc'); if(ac) ac.value = k.ac||'';
}
(function bindTokenPanel(){
  const pnl=document.getElementById('tokenPanel'); if(!pnl) return;
  const upd = ()=>{ saveMap(); renderMap(); };
  document.getElementById('tokenName')?.addEventListener('change', e=>{
    const k=curToken(); if(!k) return;
    k.label=(e.target.value.trim()||'Токен').slice(0,40);
    const el=document.querySelector('.map-token.selected .tok-name'); if(el) el.textContent=k.label;
    const ini=document.querySelector('.map-token.selected .tok-init'); if(ini) ini.textContent=tokenInitials(k.label);
    saveMap();
  });
  document.getElementById('tokenSize')?.addEventListener('change', e=>{
    const k=curToken(); if(!k) return; k.size=(+e.target.value===2?2:1); upd();
  });
  document.getElementById('tokenRot')?.addEventListener('change', e=>{
    const k=curToken(); if(!k) return; k.rot=e.target.checked?45:0; upd();
  });
  document.getElementById('tokenColor')?.addEventListener('input', e=>{
    const k=curToken(); if(!k) return; k.color=e.target.value;
    const el=document.querySelector('.map-token.selected'); if(el) el.style.background=k.color;
    saveMap();
  });
  document.getElementById('tokenHp')?.addEventListener('change', e=>{
    const k=curToken(); if(!k) return;
    k.hp = Math.max(0, Math.round(+e.target.value||0));
    syncTokenToBlock(k); saveMap(); renderMap();
  });
  document.getElementById('tokenHpMax')?.addEventListener('change', e=>{
    const k=curToken(); if(!k) return;
    k.hpMax = Math.max(0, Math.round(+e.target.value||0));
    if(k.hp===null || k.hp>k.hpMax) k.hp = k.hpMax;
    syncTokenToBlock(k); saveMap(); renderMap();
  });
  document.getElementById('tokenAc')?.addEventListener('change', e=>{
    const k=curToken(); if(!k) return;
    k.ac = String(Math.max(0, Math.min(40, +e.target.value||0)));
    syncTokenToBlock(k); saveMap(); renderMap();
  });
  document.getElementById('tokenDelete')?.addEventListener('click', ()=>{
    const m=curMap(); const k=curToken(); if(!m||!k) return;
    m.markers=m.markers.filter(x=>x.id!==k.id);
    selectedMarkerId=null; saveMap(); renderMap();
    toast('Токен удалён');
  });
  document.getElementById('tokenClose')?.addEventListener('click', ()=>{
    selectedMarkerId=null; renderMap();
  });
})();

function percent(v,total){ return (total>0? (v/total*100) : 0).toFixed(2); }

/* Размер клетки карты в пикселях (гекс из hex.svg — 34.641 × 60) */
function mapCellPx(m){
  if(m && m.cellPx) return Math.max(8, +m.cellPx);
  return 34.641;
}
/* Инициалы для токена: до двух букв из имени */
function tokenInitials(label){
  const words = String(label||'').trim().split(/\s+/).filter(Boolean);
  if(!words.length) return '?';
  const a = words[0][0]||'';
  const b = words.length>1 ? (words[1][0]||'') : (words[0][1]||'');
  return (a+b).toUpperCase();
}
/* Привязка точки к центру клетки (включается в настройках карты) */
function snapPoint(m, x, y){
  if(!m || !m.snap) return {x:x, y:y};
  const cell = mapCellPx(m);
  if(m.shape==='square'){
    const cx = cell/2 + Math.round((x-cell/2)/cell)*cell;
    const cy = cell/2 + Math.round((y-cell/2)/cell)*cell;
    return {x:Math.max(0,Math.min(m.baseW,cx)), y:Math.max(0,Math.min(m.baseH,cy))};
  }
  // гекс: ближайший центр по осевым координатам
  const w = cell, h = cell*Math.sqrt(3);       // плоский гекс
  const col = Math.round(x / w);
  const rowOff = (col % 2) ? h/2 : 0;
  const row = Math.round((y - rowOff) / h);
  const cands = [];
  for(let dc=-1; dc<=1; dc++){
    for(let dr=-1; dr<=1; dr++){
      const c = col+dc, r = row+dr;
      const cx = c*w, cy = r*h + ((c%2)? h/2 : 0);
      cands.push({x:cx, y:cy, d:(cx-x)**2 + (cy-y)**2});
    }
  }
  cands.sort((a,b)=>a.d-b.d);
  const p = cands[0];
  return {x:Math.max(0,Math.min(m.baseW,p.x)), y:Math.max(0,Math.min(m.baseH,p.y))};
}
/* Масштаб вписывания карты в видимую область (не крупнее 1:1) */
function mapFitScale(mc, m){
  const pad = 24;                                  // отступы сцены (padding .map-canvas)
  const availW = Math.max(120, (mc.clientWidth || 0) - pad);
  const availH = Math.max(120, (mc.clientHeight || 0) - pad);
  const s = Math.min(availW / Math.max(1, m.baseW), availH / Math.max(1, m.baseH), 1);
  return Math.max(0.05, Math.round(s * 1000) / 1000);
}
/* Не даём уехать за края карты */
function clampMapScroll(mc){
  if(!mc) return;
  const maxX = Math.max(0, mc.scrollWidth - mc.clientWidth);
  const maxY = Math.max(0, mc.scrollHeight - mc.clientHeight);
  mc.scrollLeft = Math.max(0, Math.min(maxX, mc.scrollLeft || 0));
  mc.scrollTop = Math.max(0, Math.min(maxY, mc.scrollTop || 0));
}
function fitCanvas(wrapper,m,z){
  const cv=wrapper.querySelector('canvas.map-draw'); if(!cv) return;
  const dpr=window.devicePixelRatio||1;
  cv.style.width='100%'; cv.style.height='100%';
  cv.width=Math.round(m.baseW*(z||1)*dpr); cv.height=Math.round(m.baseH*(z||1)*dpr);
}
function polyCentroid(pts){
  let x=0,y=0; pts.forEach(p=>{ x+=p[0]; y+=p[1]; });
  return [x/pts.length, y/pts.length];
}
function offsetPolygon(pts, cx, cy, d){
  return pts.map(p=>{
    const dx=p[0]-cx, dy=p[1]-cy, len=Math.hypot(dx,dy)||1;
    return [p[0]+dx/len*d, p[1]+dy/len*d];
  });
}
function wallPaths(s, d){
  const outer=new Path2D(), inner=new Path2D();
  let bb=null;
  if(s.type==='rect' || s.type==='corridor'){
    outer.rect(s.x-d, s.y-d, s.w+2*d, s.h+2*d);
    inner.rect(s.x+d, s.y+d, Math.max(1,s.w-2*d), Math.max(1,s.h-2*d));
    bb={x:s.x-d, y:s.y-d, w:s.w+2*d, h:s.h+2*d};
  } else if(s.type==='ellipse'){
    const cx=s.x+s.w/2, cy=s.y+s.h/2, rx=Math.max(1,s.w/2), ry=Math.max(1,s.h/2);
    outer.ellipse(cx,cy,rx+d,ry+d,0,0,Math.PI*2);
    inner.ellipse(cx,cy,Math.max(1,rx-d),Math.max(1,ry-d),0,0,Math.PI*2);
    bb={x:cx-rx-d, y:cy-ry-d, w:2*(rx+d), h:2*(ry+d)};
  } else if(s.type==='poly' && s.pts && s.pts.length>=3){
    const c=polyCentroid(s.pts);
    const op=offsetPolygon(s.pts,c[0],c[1],d), ip=offsetPolygon(s.pts,c[0],c[1],-d);
    op.forEach((p,i)=>{ i?outer.lineTo(p[0],p[1]):outer.moveTo(p[0],p[1]); }); outer.closePath();
    ip.forEach((p,i)=>{ i?inner.lineTo(p[0],p[1]):inner.moveTo(p[0],p[1]); }); inner.closePath();
    const xs=op.map(p=>p[0]), ys=op.map(p=>p[1]);
    bb={x:Math.min.apply(null,xs), y:Math.min.apply(null,ys),
        w:Math.max.apply(null,xs)-Math.min.apply(null,xs),
        h:Math.max.apply(null,ys)-Math.min.apply(null,ys)};
  }
  return bb ? {outer:outer, inner:inner, bb:bb} : null;
}
let drawSel = -1;
window.__drawSelIndex = -1;
function setDrawSel(i){
  drawSel = (typeof i==='number' && i>=0) ? i : -1;
  window.__drawSelIndex = drawSel;
  const mm=curMap(); window.__drawSelMap = mm?mm.id:null;
  if(window.updateDrawCtl) window.updateDrawCtl();
}
window.drawSelectIndex = setDrawSel;
window.deleteDrawSel = function(){
  const m=curMap(); if(!m || drawSel<0 || !(m.draw||[])[drawSel]) return;
  m.draw.splice(drawSel,1);
  setDrawSel(-1);
  saveMap(); renderMap();
  if(typeof toast==='function') toast('Фигура удалена');
};
function shapeBBox(s){
  if(!s) return {x:0,y:0,w:0,h:0};
  if(s.pts && s.pts.length){
    let x1=Infinity,y1=Infinity,x2=-Infinity,y2=-Infinity;
    s.pts.forEach(p=>{ x1=Math.min(x1,p[0]); y1=Math.min(y1,p[1]); x2=Math.max(x2,p[0]); y2=Math.max(y2,p[1]); });
    const pad = s.type==='cpath' ? Math.max(0,(+s.w||0)/2) : 0;
    return {x:x1-pad, y:y1-pad, w:Math.max(1,x2-x1)+pad*2, h:Math.max(1,y2-y1)+pad*2};
  }
  return {x:+s.x||0, y:+s.y||0, w:Math.max(1,+s.w||1), h:Math.max(1,+s.h||1)};
}
function shapeHandles(bb){
  const cx=bb.x+bb.w/2, cy=bb.y+bb.h/2;
  return [['nw',bb.x,bb.y],['n',cx,bb.y],['ne',bb.x+bb.w,bb.y],['e',bb.x+bb.w,cy],
          ['se',bb.x+bb.w,bb.y+bb.h],['s',cx,bb.y+bb.h],['sw',bb.x,bb.y+bb.h],['w',bb.x,cy]];
}
function pointInPoly(p, pts){
  let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
    const xi=pts[i][0], yi=pts[i][1], xj=pts[j][0], yj=pts[j][1];
    if(((yi>p[1])!==(yj>p[1])) && (p[0] < (xj-xi)*(p[1]-yi)/(yj-yi)+xi)) inside=!inside;
  }
  return inside;
}
function localPoint(s,p){
  const rot=+s.rot||0;
  if(!rot) return p;
  const bb=shapeBBox(s);
  const cx=bb.x+bb.w/2, cy=bb.y+bb.h/2, a=-rot*Math.PI/180;
  const dx=p[0]-cx, dy=p[1]-cy;
  return [cx+dx*Math.cos(a)-dy*Math.sin(a), cy+dx*Math.sin(a)+dy*Math.cos(a)];
}
function hitShape(s,p){
  if(!s) return false;
  const q=localPoint(s,p);
  if(s.type==='rect'||s.type==='corridor') return q[0]>=s.x&&q[0]<=s.x+s.w&&q[1]>=s.y&&q[1]<=s.y+s.h;
  if(s.type==='ellipse'){
    const cx=s.x+s.w/2, cy=s.y+s.h/2, rx=Math.max(1,s.w/2), ry=Math.max(1,s.h/2);
    return ((q[0]-cx)/rx)*((q[0]-cx)/rx)+((q[1]-cy)/ry)*((q[1]-cy)/ry)<=1;
  }
  if(s.type==='poly'&&s.pts&&s.pts.length>=3) return pointInPoly(q,s.pts);
  if(s.type==='cpath'&&s.pts&&s.pts.length>=2){
    const r=Math.max(4, (+s.w||0)/2);
    for(let i=0;i<s.pts.length-1;i++){ if(distToSeg(q, s.pts[i], s.pts[i+1])<=r) return true; }
    return false;
  }
  return false;
}
function offsetPolyline(pts, d, sign){
  const res=[];
  for(let i=0;i<pts.length;i++){
    const p=pts[i];
    let dirIn=null, dirOut=null;
    if(i>0){ const a=pts[i-1], b=pts[i]; const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy)||1; dirIn=[dx/L,dy/L]; }
    if(i<pts.length-1){ const a=pts[i], b=pts[i+1]; const dx=b[0]-a[0], dy=b[1]-a[1], L=Math.hypot(dx,dy)||1; dirOut=[dx/L,dy/L]; }
    if(dirIn && dirOut){
      const nIn=[-dirIn[1],dirIn[0]], nOut=[-dirOut[1],dirOut[0]];
      const ax=p[0]+nIn[0]*d*sign, ay=p[1]+nIn[1]*d*sign;
      const bx=p[0]+nOut[0]*d*sign, by=p[1]+nOut[1]*d*sign;
      const den=dirIn[0]*dirOut[1]-dirIn[1]*dirOut[0];
      if(Math.abs(den)<1e-6){ res.push([bx,by]); continue; }
      const tt=((bx-ax)*dirOut[1]-(by-ay)*dirOut[0])/den;
      res.push([ax+dirIn[0]*tt, ay+dirIn[1]*tt]);
    } else {
      const dir=dirOut||dirIn; if(!dir){ res.push([p[0],p[1]]); continue; }
      res.push([p[0]-dir[1]*d*sign, p[1]+dir[0]*d*sign]);
    }
  }
  return res;
}
function distToSeg(p,a,b){
  const dx=b[0]-a[0], dy=b[1]-a[1];
  const L2=dx*dx+dy*dy;
  let t= L2 ? ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L2 : 0;
  t=Math.max(0,Math.min(1,t));
  return Math.hypot(p[0]-(a[0]+dx*t), p[1]-(a[1]+dy*t));
}
function drawStrokes(ctx,cv,m,z){
  if(!ctx) return;
  const dpr=window.devicePixelRatio||1;
  ctx.clearRect(0,0,cv.width,cv.height);
  ctx.save();
  ctx.scale(dpr*(z||1), dpr*(z||1));
  ctx.lineCap='round'; ctx.lineJoin='round';
  (m.draw||[]).forEach(s=>{
    const rot=+s.rot||0;
    if(rot){
      const bb=shapeBBox(s);
      const rcx=bb.x+bb.w/2, rcy=bb.y+bb.h/2;
      ctx.save();
      ctx.translate(rcx,rcy); ctx.rotate(rot*Math.PI/180); ctx.translate(-rcx,-rcy);
    }
    try{
    if(s.type==='cpath'){
      const cpts=s.pts||[], ct=Math.max(4, +s.w||0);
      if(cpts.length>=2 && ct>0){
        const cww=Math.max(6,(+s.width||2)*3);
        ctx.save(); ctx.lineCap='butt'; ctx.lineJoin='miter';
        ctx.strokeStyle=s.fill||'rgba(0,0,0,.06)'; ctx.lineWidth=ct;
        ctx.beginPath(); cpts.forEach((p,i)=>{ i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]); }); ctx.stroke();
        [1,-1].forEach(sgn=>{
          const op=offsetPolyline(cpts, ct/2, sgn);
          if(!op || op.length<2) return;
          ctx.beginPath(); op.forEach((p,i)=>{ i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]); });
          ctx.strokeStyle='#111'; ctx.lineWidth=cww; ctx.stroke();
          ctx.strokeStyle='#fff'; ctx.lineWidth=Math.max(1, cww-3); ctx.stroke();
        });
        ctx.restore();
      }
      return;
    }
    const col=s.color||'#111';
    const isShape = s.type==='rect' || s.type==='ellipse' || s.type==='corridor' || s.type==='poly';
    if(isShape){
      const fill = s.fill || (s.type==='corridor' ? 'rgba(0,0,0,.05)' : 'rgba(255,255,255,.5)');
      if(s.wall===false){
        ctx.beginPath();
        if(s.type==='rect' || s.type==='corridor') ctx.rect(s.x,s.y,s.w,s.h);
        else if(s.type==='ellipse') ctx.ellipse(s.x+s.w/2, s.y+s.h/2, Math.max(1,s.w/2), Math.max(1,s.h/2), 0, 0, Math.PI*2);
        else if(s.type==='poly' && s.pts && s.pts.length>=3){ s.pts.forEach((p,i)=>{ i ? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]); }); ctx.closePath(); }
        else return;
        ctx.fillStyle=fill; ctx.fill();
        if(s.type!=='corridor'){ ctx.strokeStyle=col; ctx.lineWidth=Math.max(1,+s.width||2); ctx.stroke(); }
        return;
      }
      const ww=Math.max(6,(+s.width||2)*3);
      const wp=wallPaths(s, ww/2);
      if(!wp) return;
      const openEnds = s.type==='corridor';
      const horiz = s.w >= s.h;
      ctx.fillStyle=fill;
      if(openEnds) ctx.fillRect(s.x, s.y, s.w, s.h); else ctx.fill(wp.inner);
      ctx.save();
      let hatchBB;
      if(openEnds){
        const band=new Path2D();
        band.rect(s.x, s.y, s.w, s.h);
        band.rect(s.x+ww, s.y+ww, Math.max(1, s.w-2*ww), Math.max(1, s.h-2*ww));
        ctx.clip(band, 'evenodd');
        const strips=new Path2D();
        if(horiz){
          const sx=s.x+ww, sw=Math.max(1, s.w-2*ww);
          strips.rect(sx, s.y, sw, ww); strips.rect(sx, s.y+s.h-ww, sw, ww);
        } else {
          const sy=s.y+ww, sh=Math.max(1, s.h-2*ww);
          strips.rect(s.x, sy, ww, sh); strips.rect(s.x+s.w-ww, sy, ww, sh);
        }
        ctx.clip(strips);
        hatchBB={x:s.x, y:s.y, w:s.w, h:s.h};
      } else {
        const band=new Path2D(); band.addPath(wp.outer); band.addPath(wp.inner);
        ctx.clip(band, 'evenodd');
        hatchBB=wp.bb;
      }
      ctx.fillStyle='#fff'; ctx.fillRect(hatchBB.x, hatchBB.y, hatchBB.w, hatchBB.h);
      ctx.strokeStyle='#111'; ctx.lineWidth=1;
      ctx.beginPath();
      const step=6, x0=hatchBB.x, y0=hatchBB.y, x1=x0+hatchBB.w, y1=y0+hatchBB.h;
      for(let q=x0-y1; q<x1; q+=step){ ctx.moveTo(q,y0); ctx.lineTo(q+(y1-y0), y1); }
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle='#111'; ctx.lineWidth=1.5;
      if(openEnds){
        ctx.beginPath();
        if(horiz){
          const a=s.y, b=s.y+ww, c=s.y+s.h-ww, d=s.y+s.h;
          const x1=s.x+ww, x2=Math.max(x1, s.x+s.w-ww);
          ctx.moveTo(x1,a); ctx.lineTo(x2,a);
          ctx.moveTo(x1,b); ctx.lineTo(x2,b);
          ctx.moveTo(x1,c); ctx.lineTo(x2,c);
          ctx.moveTo(x1,d); ctx.lineTo(x2,d);
        } else {
          const a=s.x, b=s.x+ww, c=s.x+s.w-ww, d=s.x+s.w;
          const y1=s.y+ww, y2=Math.max(y1, s.y+s.h-ww);
          ctx.moveTo(a,y1); ctx.lineTo(a,y2);
          ctx.moveTo(b,y1); ctx.lineTo(b,y2);
          ctx.moveTo(c,y1); ctx.lineTo(c,y2);
          ctx.moveTo(d,y1); ctx.lineTo(d,y2);
        }
        ctx.stroke();
      } else {
        ctx.stroke(wp.outer); ctx.stroke(wp.inner);
      }
      return;
    }
    if(!s.pts || s.pts.length<2) return;
    ctx.strokeStyle=col; ctx.lineWidth=Math.max(0.5,+s.width||2);
    ctx.beginPath();
    s.pts.forEach((p,i)=>{ i? ctx.lineTo(p[0],p[1]) : ctx.moveTo(p[0],p[1]); });
    ctx.stroke();
    } finally { if(rot) ctx.restore(); }
  });
  if(drawSel>=0 && window.__drawSelMap===m.id && (m.draw||[])[drawSel]){
    const sel=m.draw[drawSel];
    const bb=shapeBBox(sel), zz=z||1, hs=7/zz;
    const rot=+sel.rot||0;
    const rcx=bb.x+bb.w/2, rcy=bb.y+bb.h/2;
    ctx.save();
    if(rot){ ctx.translate(rcx,rcy); ctx.rotate(rot*Math.PI/180); ctx.translate(-rcx,-rcy); }
    ctx.strokeStyle='#2a6fdb'; ctx.lineWidth=1.5/zz; ctx.setLineDash([6/zz,4/zz]);
    ctx.strokeRect(bb.x,bb.y,bb.w,bb.h);
    ctx.setLineDash([]);
    ctx.fillStyle='#fff';
    shapeHandles(bb).forEach(hh=>{ ctx.beginPath(); ctx.rect(hh[1]-hs/2, hh[2]-hs/2, hs, hs); ctx.fill(); ctx.stroke(); });
    const rhy=bb.y-18/zz;
    ctx.beginPath(); ctx.moveTo(rcx,bb.y); ctx.lineTo(rcx,rhy); ctx.stroke();
    ctx.beginPath(); ctx.arc(rcx,rhy,5/zz,0,Math.PI*2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
}
function mapWallsEnabled(){ return true; }
function mapMonoOn(){
  const el=document.getElementById('mapMono');
  return el ? !!el.checked : false;
}
function mapDrawToolValue(){
  const el=document.getElementById('mapDrawTool');
  return el ? el.value : 'none';
}
function shapeFromDrag(tool, a, b, color, m){
  let x1=a[0], y1=a[1], x2=b[0], y2=b[1];
  if(mapSnap && m){
    const p1=snapPoint(m,x1,y1), p2=snapPoint(m,x2,y2);
    x1=p1.x; y1=p1.y; x2=p2.x; y2=p2.y;
  }
  const sx=Math.min(x1,x2), sy=Math.min(y1,y2), sw=Math.abs(x2-x1), sh=Math.abs(y2-y1);
  if(tool==='corridor'){
    const ct=Math.max(4, Math.min(sw,sh));
    const pts = sw>=sh ? [[sx, sy+sh/2],[sx+sw, sy+sh/2]] : [[sx+sw/2, sy],[sx+sw/2, sy+sh]];
    return { type:'cpath', pts:pts, w:ct, color:'#111', fill:'rgba(0,0,0,.06)', width:2 };
  }
  return { type: tool==='room' ? 'rect' : 'ellipse',
    x: sx, y: sy, w: sw, h: sh,
    color:'#111', fill:'rgba(255,255,255,.5)', width: 2, wall: true };
}
function bindDraw(cv,wrapper,m,z){
  const dpr=window.devicePixelRatio||1;
  let drawing=false, curStroke=null, curShape=null, startPt=null, ctx=cv.getContext('2d');
  let edit=null;
  let polyPts=null, polyHover=null, polyColor=null;
  function toBase(e){
    const r=cv.getBoundingClientRect();
    return [ (e.clientX-r.left) * (m.baseW/r.width), (e.clientY-r.top) * (m.baseH/r.height) ];
  }
  function repaint(){
    const list=(m.draw||[]).slice();
    if(polyPts && polyPts.length){
      const pts=polyPts.concat(polyHover? [polyHover] : []);
      if(pts.length>=2) list.push({ type:'poly', pts:pts, color:'#111', fill:'rgba(255,255,255,.5)', width:2, wall:true });
    }
    if(curShape) list.push(curShape);
    drawStrokes(ctx,cv,{ draw:list },z);
  }
  function closePoly(){
    if(polyPts && polyPts.length>=3){
      m.draw.push({ type:'poly', pts:polyPts.slice(), color:'#111', fill:'rgba(255,255,255,.5)', width:2, wall:true });
      saveMap(); toast('Полигон добавлен');
    }
    polyPts=null; polyHover=null; polyColor=null;
    renderMap();
  }
  cv.addEventListener('pointerdown', e=>{
    const tool=mapDrawToolValue();
    if(tool==='none') return;
    e.preventDefault();
    const p=toBase(e);
    if(tool==='select'){
      const hb=Math.max(4, 10/(z||1));
      const cur=(window.__drawSelIndex>=0)?(m.draw||[])[window.__drawSelIndex]:null;
      if(cur){
        const bb=shapeBBox(cur);
        const pl=localPoint(cur,p);
        const rh={x:bb.x+bb.w/2, y:bb.y-18/(z||1)};
        if(Math.hypot(pl[0]-rh.x, pl[1]-rh.y) <= 12/(z||1)){
          edit={mode:'rotate', idx:window.__drawSelIndex, start:p, rot0:+cur.rot||0, orig:JSON.parse(JSON.stringify(cur))};
          cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);
          return;
        }
        const h=shapeHandles(bb).find(hh=>Math.abs(pl[0]-hh[1])<=hb && Math.abs(pl[1]-hh[2])<=hb);
        if(h){
          edit={mode:'resize', handle:h[0], idx:window.__drawSelIndex, start:p, orig:JSON.parse(JSON.stringify(cur))};
          cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);
          return;
        }
      }
      let hit=-1;
      for(let i=(m.draw||[]).length-1;i>=0;i--){ if(hitShape(m.draw[i],p)){ hit=i; break; } }
      setDrawSel(hit);
      if(hit>=0){
        edit={mode:'move', handle:null, idx:hit, start:p, orig:JSON.parse(JSON.stringify(m.draw[hit]))};
        cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);
      } else repaint();
      return;
    }
    if(tool==='poly'){
      if(!polyPts){ polyPts=[]; polyColor=markerColor(); }
      if(polyPts.length>=3){
        const f=polyPts[0];
        const rr=cv.getBoundingClientRect().width / Math.max(1,m.baseW) * 14;
        if(Math.hypot(p[0]-f[0], p[1]-f[1]) <= rr){ closePoly(); return; }
      }
      polyPts.push(p); polyHover=p; repaint();
      return;
    }
    cv.setPointerCapture&&cv.setPointerCapture(e.pointerId);
    drawing=true;
    startPt=p;
    if(tool==='pen'){ curStroke={ color: markerColor(), width:2, pts:[p] }; }
    else { curShape=shapeFromDrag(tool, p, p, markerColor(), m); }
  });
  cv.addEventListener('pointermove', e=>{
    if(edit){
      e.preventDefault();
      const p=toBase(e);
      const s=(m.draw||[])[edit.idx];
      if(!s){ edit=null; return; }
      if(edit.mode==='rotate'){
        const ob=shapeBBox(edit.orig);
        const cx=ob.x+ob.w/2, cy=ob.y+ob.h/2;
        const a0=Math.atan2(edit.start[1]-cy, edit.start[0]-cx);
        const a1=Math.atan2(p[1]-cy, p[0]-cx);
        let deg=edit.rot0 + (a1-a0)*180/Math.PI;
        if(e.shiftKey) deg=Math.round(deg/15)*15;
        s.rot=((deg%360)+360)%360;
        repaint();
        return;
      }
      const dx=p[0]-edit.start[0], dy=p[1]-edit.start[1];
      if(edit.mode==='move'){
        if(s.pts&&edit.orig.pts) s.pts=edit.orig.pts.map(pt=>[pt[0]+dx,pt[1]+dy]);
        else { s.x=edit.orig.x+dx; s.y=edit.orig.y+dy; }
      } else {
        const o=edit.orig, h=edit.handle, ob=shapeBBox(o);
        const rot0=+o.rot||0;
        let pl=p;
        if(rot0){
          const cx=ob.x+ob.w/2, cy=ob.y+ob.h/2, a=-rot0*Math.PI/180;
          const ddx=p[0]-cx, ddy=p[1]-cy;
          pl=[cx+ddx*Math.cos(a)-ddy*Math.sin(a), cy+ddx*Math.sin(a)+ddy*Math.cos(a)];
        }
        let l=ob.x, t=ob.y, r=ob.x+ob.w, b=ob.y+ob.h;
        if(h.indexOf('w')>=0) l=Math.min(pl[0], r-4);
        if(h.indexOf('e')>=0) r=Math.max(pl[0], l+4);
        if(h.indexOf('n')>=0) t=Math.min(pl[1], b-4);
        if(h.indexOf('s')>=0) b=Math.max(pl[1], t+4);
        if(s.pts&&edit.orig.pts){
          const nb={x:l,y:t,w:r-l,h:b-t};
          s.pts=edit.orig.pts.map(pt=>[nb.x+(pt[0]-ob.x)*(nb.w/ob.w||1), nb.y+(pt[1]-ob.y)*(nb.h/ob.h||1)]);
        } else { s.x=l; s.y=t; s.w=Math.max(2,r-l); s.h=Math.max(2,b-t); }
      }
      repaint();
      return;
    }
    const tool=mapDrawToolValue();
    if(tool==='poly' && polyPts && polyPts.length){
      polyHover=toBase(e); repaint(); return;
    }
    if(!drawing) return;
    e.preventDefault();
    const p=toBase(e);
    if(curStroke){
      curStroke.pts.push(p);
      const [x,y]=p, prev=curStroke.pts[curStroke.pts.length-2]||p;
      ctx.save(); ctx.scale(dpr*(z||1), dpr*(z||1)); ctx.lineCap='round'; ctx.lineJoin='round';
      ctx.strokeStyle=curStroke.color; ctx.lineWidth=curStroke.width;
      ctx.beginPath(); ctx.moveTo(prev[0],prev[1]); ctx.lineTo(x,y); ctx.stroke(); ctx.restore();
      return;
    }
    if(curShape){
      curShape=shapeFromDrag(tool, startPt || [curShape.x,curShape.y], p, curShape.color, m);
      repaint();
    }
  });
  cv.addEventListener('dblclick', e=>{
    if(mapDrawToolValue()==='poly' && polyPts){ e.preventDefault(); closePoly(); }
  });
  const end=()=>{
    if(edit){ edit=null; saveMap(); renderMap(); return; }
    if(!drawing) return;
    drawing=false;
    if(curStroke && curStroke.pts.length>1){ m.draw.push(curStroke); saveMap(); }
    if(curShape){
      const okShape = curShape.type==='cpath'
        ? ((curShape.pts||[]).length>=2 && (+curShape.w||0)>=4)
        : (curShape.w>=4 && curShape.h>=4);
      if(okShape){ m.draw.push(curShape); saveMap(); }
      curShape=null; startPt=null; renderMap();
    }
    curStroke=null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', end);
}
function markerColor(){
  return '#111';
}
/* Создать квадратную карту на весь экран */
function addFullScreenMap(){
  const m=normMap(defaultScreenMap('Карта '+(maps.length+1)));
  m.auto=true; m.shape='square';
  maps.push(m); activeMapId=m.id; saveMap(); renderMap();
  toast('Квадратная карта на весь экран добавлена');
}

/* Быстрое переключение карт: Alt+1…9, а также «[» и «]» */
document.addEventListener('keydown', e=>{
  if(currentTab!=='map') return;
  const tag=(e.target && e.target.tagName || '').toLowerCase();
  if(tag==='input'||tag==='textarea'||tag==='select'||(e.target && e.target.isContentEditable)) return;
  if(e.altKey && e.ctrlKey){
    const d = digitFromEvent(e);
    if(d >= 1 && d <= 9 && maps[d-1]){
      e.preventDefault(); activeMapId=maps[d-1].id; saveMap(); renderMap();
    }
    return;
  }
  if(!e.altKey && !e.metaKey && !e.ctrlKey){
    const code = e.code || '';
    const isNext = code==='BracketRight' || e.key===']' || e.key==='ъ';
    const isPrev = code==='BracketLeft'  || e.key==='[' || e.key==='х';
    if(isNext || isPrev){
      if(!maps.length) return;
      const i=Math.max(0, maps.findIndex(m=>m.id===activeMapId));
      const j=isNext ? (i+1)%maps.length : (i-1+maps.length)%maps.length;
      e.preventDefault(); activeMapId=maps[j].id; saveMap(); renderMap();
    }
  }
});

function renderMapTabs(){
  const box=document.getElementById('mapTabs'); if(!box) return;
  const thumb = m => {
    const src=(m.bgKey && mediaCache[m.bgKey]) || m.bg;
    return src ? `<img class="mt-thumb" src="${escapeHtml(src)}" alt="">` : '<span class="mt-thumb mt-thumb-empty"></span>';
  };
  box.innerHTML = maps.map(m=>`<span class="map-tab ${m.id===activeMapId?'active':''}" data-mid="${m.id}" title="${escapeHtml(m.name)}">
    ${thumb(m)}
    <span class="mt-row"><span class="mt-name">${escapeHtml(m.name)}</span>
      <button class="mt-del" data-md="${m.id}" title="Удалить карту" aria-label="Удалить карту">✕</button></span>
  </span>`).join('') + `<button class="map-tab add" id="mapAddTab" title="Добавить карту">＋</button>`;
  box.querySelectorAll('[data-mid]').forEach(el=> el.addEventListener('click', e=>{
    if(e.target.closest('.mt-del')) return;
    activeMapId=el.dataset.mid; saveMap(); renderMap();
  }));
  box.querySelectorAll('[data-md]').forEach(btn=> btn.addEventListener('click', async e=>{
    e.stopPropagation();
    const id=btn.dataset.md; if(maps.length<=1){ toast('Карта одна — удалять не будем'); return; }
    if(!(await uiConfirm('Удалить эту карту?'))) return;
    const m=maps.find(x=>x.id===id);
    if(m&&m.bgKey){ idbDel(m.bgKey); delete mediaCache[m.bgKey]; }
    maps=maps.filter(x=>x.id!==id);
    if(activeMapId===id) activeMapId=maps[0].id;
    saveMap(); renderMap();
  }));
  const addTab=document.getElementById('mapAddTab');
  if(addTab) addTab.addEventListener('click', ()=> openMapAddMenu(addTab));
  const fullBtn=document.getElementById('mapFull');
  if(fullBtn && !fullBtn.dataset.bound){ fullBtn.dataset.bound='1'; fullBtn.addEventListener('click', addFullScreenMap); }
  const urlBtn=document.getElementById('mapFromUrl');
  if(urlBtn && !urlBtn.dataset.bound){ urlBtn.dataset.bound='1'; urlBtn.addEventListener('click', mapAddFromUrl); }
  if(!window.__mapPasteBound){
    window.__mapPasteBound = true;
    document.addEventListener('paste', e=>{
      if(currentTab!=='map') return;
      mapAddFromClipboard(e);
    });
  }
}
function mapAddFromFile(file){
  if(!file) return;
  if(!MAP_ALLOWED.includes(file.type) && !/^image\//.test(file.type)){ toast('Нужен файл изображения (PNG/JPG/WebP)'); return; }
  if(file.size > MAP_MAX_BYTES){ toast('Карта слишком большая: до 8 МБ'); return; }
  const reader=new FileReader();
  reader.onload=()=> createMapFromDataUrl(reader.result, file.name);
  reader.readAsDataURL(file);
}
/* Создаёт карту из dataURL (файл, URL или буфер обмена) */
function createMapFromDataUrl(data, name){
  if(!data) return;
  const key='mapbg_'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
  mediaCache[key]=data; idbPut(key,data);
  const m={ id:'m'+Math.random().toString(36).slice(2,8),
    name: String(name||'Карта '+(maps.length+1)).replace(/\.[a-z0-9]+$/i,'').slice(0,40) || ('Карта '+(maps.length+1)),
    bgKey:key, bg:null, baseW:800, baseH:600, zoom:1, scrollX:0, scrollY:0, markers:[], draw:[] };
  const im=new Image();
  im.onload=()=>{ m.baseW=im.naturalWidth||800; m.baseH=im.naturalHeight||600; saveMap(); renderMap(); };
  im.src=data;
  maps.push(m); activeMapId=m.id;
  saveMap(); renderMap();
  toast('Карта «'+m.name+'» добавлена');
}
/* Карта по ссылке */
async function mapAddFromUrl(){
  const url = await uiPrompt('Ссылка на изображение карты (https://…):','');
  if(!url) return;
  try{
    toast('Загружаю карту…');
    const res = await fetch(url, { mode:'cors' });
    if(!res.ok) throw new Error('HTTP '+res.status);
    const blob = await res.blob();
    if(!/^image\//.test(blob.type)) throw new Error('это не изображение');
    if(blob.size > MAP_MAX_BYTES) throw new Error('файл больше 8 МБ');
    const fr = new FileReader();
    fr.onload = ()=> createMapFromDataUrl(fr.result, url.split('/').pop() || 'Карта по ссылке');
    fr.readAsDataURL(blob);
  }catch(err){
    toast('Не удалось загрузить: '+(err && err.message ? err.message : 'ошибка сети'));
  }
}
/* Карта из буфера обмена (Ctrl+V на вкладке «Карта») */
function mapAddFromClipboard(e){
  const items = e.clipboardData && e.clipboardData.items; if(!items) return false;
  for(const it of items){
    if(it.type && it.type.indexOf('image')===0){
      const f = it.getAsFile(); if(f){ e.preventDefault(); mapAddFromFile(f); return true; }
    }
  }
  return false;
}
