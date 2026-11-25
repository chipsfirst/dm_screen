/* Атмосферный микшер: локальные сэмплы через Web Audio. */
(function(){
  const panel = document.getElementById('ambiencePanel');
  if(!panel) return;
  const grid = document.getElementById('ambGrid');
  const master = document.getElementById('ambMaster');
  const startBtn = document.getElementById('ambStart');
  const stopBtn = document.getElementById('ambStop');
  const presets = document.getElementById('ambPresets');
  const KEY = 'shirma_ambience_v1';

  const CHANNELS = [
    { id:'rain', name:'Дождь', file:'assets/ambience/rain.mp3', boost:1.2, filter:{ type:'highpass', freq:90 } },
    { id:'wind', name:'Ветер', file:'assets/ambience/wind.ogg' },
    { id:'fire', name:'Огонь', file:'assets/ambience/fire.m4a', boost:3, filter:{ type:'highpass', freq:60 } },
    { id:'tavern', name:'Таверна', file:'assets/ambience/tavern.ogg', filter:{ type:'lowpass', freq:1800 } },
    { id:'cave', name:'Пещера', file:'assets/ambience/cave.ogg', boost:1.5, filter:{ type:'lowpass', freq:4000 } }
  ];
  const PRESETS = {
    tavern:{ fire:35, tavern:65, wind:8 },
    rain:{ rain:75, wind:30 },
    forest:{ wind:55, rain:20, fire:8 },
    cave:{ cave:65, wind:18 }
  };
  const DEFAULTS = { rain:40, wind:24, fire:30, tavern:0, cave:0 };
  const state = {
    v:2,
    levels:{ ...DEFAULTS },
    master:80
  };
  try{
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if(saved && saved.v === 2 && saved.levels && typeof saved.levels === 'object'){
      CHANNELS.forEach(ch=>{
        const v = +saved.levels[ch.id];
        if(Number.isFinite(v)) state.levels[ch.id] = Math.max(0, Math.min(100, v));
      });
    }
    if(saved && saved.v === 2 && Number.isFinite(+saved.master)) state.master = Math.max(0, Math.min(100, +saved.master));
  }catch(e){}

  let ctx = null;
  let masterGain = null;
  let running = false;
  const nodes = {};

  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify(state)); }catch(e){}
  }
  function apply(){
    if(!ctx || !masterGain) return;
    const now = ctx.currentTime;
    CHANNELS.forEach(ch=>{
      const node = nodes[ch.id];
      if(!node) return;
      node.gain.gain.setTargetAtTime((state.levels[ch.id] || 0) / 100 * 0.5 * (ch.boost || 1), now, 0.08);
    });
    masterGain.gain.setTargetAtTime(state.master / 100 * 0.9, now, 0.08);
  }
  function build(){
    if(ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC){ toast('Браузер не поддерживает Web Audio'); return false; }
    try{ ctx = new AC(); }
    catch(e){ toast('Не удалось запустить аудио'); return false; }
    masterGain = ctx.createGain();
    masterGain.gain.value = 0;
    masterGain.connect(ctx.destination);
    CHANNELS.forEach(ch=>{
      const audio = new Audio(ch.file);
      audio.loop = true;
      audio.preload = 'auto';
      audio.style.display = 'none';
      document.body.appendChild(audio);
      let last = ctx.createMediaElementSource(audio);
      if(ch.filter){
        const filter = ctx.createBiquadFilter();
        filter.type = ch.filter.type;
        filter.frequency.value = ch.filter.freq;
        last.connect(filter);
        last = filter;
      }
      const gain = ctx.createGain();
      gain.gain.value = 0;
      last.connect(gain);
      gain.connect(masterGain);
      nodes[ch.id] = { audio, gain };
    });
    return true;
  }
  function stopAll(){
    CHANNELS.forEach(ch=>{
      const node = nodes[ch.id];
      if(!node || !node.audio) return;
      try{
        node.audio.pause();
        node.audio.muted = true;
        node.audio.currentTime = 0;
        node.audio.removeAttribute('src');
        node.audio.load();
        if(node.audio.parentNode) node.audio.parentNode.removeChild(node.audio);
      }catch(e){}
    });
    Object.keys(nodes).forEach(k=>delete nodes[k]);
    const old = ctx;
    ctx = null;
    masterGain = null;
    if(old){
      try{
        const p = old.close();
        if(p && p.catch) p.catch(()=>{});
      }catch(e){}
    }
  }
  function setRunning(on){
    if(on){
      if(!build()) return;
      if(ctx.state === 'suspended') ctx.resume().catch(()=>{});
      CHANNELS.forEach(ch=>{
        const node = nodes[ch.id];
        if(!node || !node.audio) return;
        node.audio.muted = false;
        const p = node.audio.play();
        if(p && p.catch) p.catch(()=>{});
      });
      running = true;
      apply();
    }else{
      running = false;
      stopAll();
    }
    if(startBtn) startBtn.hidden = running;
    if(stopBtn) stopBtn.hidden = !running;
    panel.dataset.running = running ? '1' : '0';
    panel.dataset.ctx = ctx ? ctx.state : 'off';
  }
  function render(){
    if(!grid) return;
    grid.innerHTML = CHANNELS.map(ch=>`<label class="amb-ch">
      <span>${ch.name}</span>
      <input type="range" min="0" max="100" step="1" value="${state.levels[ch.id] || 0}" data-amb="${ch.id}" aria-label="${ch.name}">
      <output>${state.levels[ch.id] || 0}</output>
    </label>`).join('');
    grid.querySelectorAll('input[data-amb]').forEach(inp=>{
      inp.addEventListener('input', ()=>{
        const id = inp.dataset.amb;
        state.levels[id] = Math.max(0, Math.min(100, +inp.value || 0));
        const out = inp.parentElement && inp.parentElement.querySelector('output');
        if(out) out.textContent = String(state.levels[id]);
        apply(); save();
      });
    });
  }
  render();
  if(master) master.value = String(state.master);
  master?.addEventListener('input', ()=>{
    state.master = Math.max(0, Math.min(100, +master.value || 0));
    apply(); save();
  });
  startBtn?.addEventListener('click', ()=> setRunning(true));
  stopBtn?.addEventListener('click', ()=> setRunning(false));
  presets?.addEventListener('click', e=>{
    const btn = e.target.closest('[data-amb-preset]');
    if(!btn) return;
    const preset = PRESETS[btn.dataset.ambPreset];
    if(!preset) return;
    CHANNELS.forEach(ch=>{ state.levels[ch.id] = preset[ch.id] || 0; });
    render();
    if(running) apply();
    save();
  });
  setRunning(false);
})();
