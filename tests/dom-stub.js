// Минимальная заглушка DOM для проверки загрузки app.js
const noop = function(){};
function makeEl(){
  const store = { style:new Proxy({}, { get:(t,p)=> (p in t? t[p] : noop), set:(t,p,v)=>{ t[p]=v; return true; } }), dataset:{}, classList:{add:noop,remove:noop,toggle:noop,contains:()=>false},
    children:[], childNodes:[], options:[], files:[], value:'', textContent:'', innerHTML:'',
    hidden:false, disabled:false, width:0, height:0, checked:false };
  return new Proxy(store, {
    get(t,p){
      if(p in t) return t[p];
      if(p==='querySelector'||p==='closest') return ()=>null;
      if(p==='contains'||p==='matches'||p==='compareDocumentPosition') return ()=>false;
      if(p==='querySelectorAll') return ()=>[];
      if(p==='getContext') return ()=>ctxStub;
      if(p==='getBoundingClientRect') return ()=>({left:0,top:0,width:100,height:100,right:100,bottom:100});
      if(p==='appendChild'||p==='insertBefore'||p==='removeChild'||p==='remove'||p==='click'||p==='focus'||p==='blur'||p==='select'||p==='scrollIntoView'||p==='setAttribute'||p==='removeAttribute'||p==='setPointerCapture'||p==='releasePointerCapture'||p==='addEventListener'||p==='removeEventListener'||p==='preventDefault'||p==='stopPropagation'||p==='insertAdjacentHTML') return noop;
      if(p==='firstChild'||p==='lastChild'||p==='parentNode'||p==='parentElement'||p==='nextSibling') return null;
      return undefined;
    },
    set(t,p,v){ t[p]=v; return true; }
  });
}
const ctxStub = new Proxy({}, { get:(t,p)=> (p in t? t[p] : (typeof p==='string' && /^(scale|clearRect|beginPath|moveTo|lineTo|stroke|fill|arc|save|restore|drawImage|fillRect|closePath|translate|rotate|measureText)$/.test(p) ? noop : (p==='canvas'? makeEl() : noop))), set:(t,p,v)=>{t[p]=v;return true;} });
const doc = {
  readyState:'complete',
  documentElement: makeEl(),
  body: makeEl(),
  head: makeEl(),
  getElementById: ()=> makeEl(),
  querySelector: ()=> makeEl(),
  querySelectorAll: ()=> [],
  createElement: ()=> makeEl(),
  createElementNS: ()=> makeEl(),
  createTextNode: ()=> makeEl(),
  addEventListener: noop,
  removeEventListener: noop,
  execCommand: ()=>true,
  elementFromPoint: ()=> null,
  activeElement: null,
  hidden:false,
  visibilityState:'visible'
};
globalThis.document = doc;
globalThis.window = globalThis;
globalThis.navigator = { userAgent:'harness', clipboard:{ writeText:()=>Promise.resolve() } };
globalThis.localStorage = { getItem:()=>null, setItem:noop, removeItem:noop };
globalThis.sessionStorage = globalThis.localStorage;
globalThis.indexedDB = { open: ()=>({ addEventListener:noop, onsuccess:null, onerror:null }) };
globalThis.requestAnimationFrame = (fn)=> setTimeout(fn,0);
globalThis.cancelAnimationFrame = noop;
globalThis.matchMedia = ()=> ({ matches:false, addEventListener:noop, removeEventListener:noop, addListener:noop });
globalThis.Image = function(){ return makeEl(); };
globalThis.Audio = function(){ return { play:noop, pause:noop, volume:1, currentTime:0 }; };
globalThis.Blob = function(parts,opts){ this.parts=parts; this.type=(opts||{}).type||''; this.size=1;
  this.arrayBuffer=()=>Promise.resolve(new ArrayBuffer(1)); };
globalThis.FileReader = function(){ this.readAsDataURL=noop; this.readAsText=noop; };
globalThis.URL = { createObjectURL:()=> 'blob:x', revokeObjectURL:noop };
globalThis.fetch = ()=> Promise.resolve({ ok:true, json:()=>Promise.resolve({}), blob:()=>Promise.resolve(new Blob([],{})), text:()=>Promise.resolve('') });
globalThis.setTimeout = function(fn){ return 0; };
globalThis.clearTimeout = function(){};
globalThis.setInterval = function(){ return 0; };
globalThis.clearInterval = function(){};
globalThis.alert=noop; globalThis.confirm=()=>true; globalThis.prompt=()=>'x';
globalThis.addEventListener = noop;
globalThis.removeEventListener = noop;
globalThis.dispatchEvent = ()=>true;
globalThis.location = { href:'http://localhost/', protocol:'http:', host:'localhost', search:'', hash:'', reload:noop };
globalThis.history = { replaceState:noop, pushState:noop };
globalThis.screen = { width:1200, height:800 };
globalThis.devicePixelRatio = 1;
globalThis.getComputedStyle = ()=> ({ getPropertyValue:()=> '' });
globalThis.CustomEvent = function(){}; globalThis.Event = function(){};
globalThis.DOMParser = function(){ this.parseFromString=()=> makeEl(); };
globalThis.MutationObserver = function(){ this.observe=noop; this.disconnect=noop; };
globalThis.ResizeObserver = function(){ this.observe=noop; this.disconnect=noop; };
globalThis.IntersectionObserver = function(){ this.observe=noop; this.disconnect=noop; };
globalThis.structuredClone = (x)=> JSON.parse(JSON.stringify(x));
globalThis.crypto = { randomUUID: ()=> '00000000-0000-0000-0000-000000000000' };
globalThis.performance = { now: ()=> Date.now() };
globalThis.innerWidth = 1200; globalThis.innerHeight = 800;
globalThis.scrollTo = noop;
