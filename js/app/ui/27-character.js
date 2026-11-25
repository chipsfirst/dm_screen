/* Пошаговое создание персонажа: вид, предыстория, класс и уровень. */
(function(){
  const modal = document.getElementById('characterModal');
  if(!modal) return;
  const $ = id => document.getElementById(id);
  const species = [
    ['dragonborn','Дракорождённый'],['dwarf','Дварф'],['elf','Эльф'],['gnome','Гном'],
    ['goliath','Голиаф'],['halfling','Полурослик'],['human','Человек'],['orc','Орк'],['tiefling','Тифлинг']
  ];
  const backgrounds = {
    acolyte:{label:'Послушник',bonus:['int','wis'],skills:'Проницательность, Религия',feat:'Magic Initiate (Cleric)'},
    criminal:{label:'Преступник',bonus:['dex','con'],skills:'Ловкость рук, Скрытность',feat:'Alert'},
    sage:{label:'Мудрец',bonus:['con','int'],skills:'Аркана, История',feat:'Magic Initiate (Wizard)'},
    soldier:{label:'Солдат',bonus:['str','dex'],skills:'Атлетика, Запугивание',feat:'Savage Attacker'}
  };
  const classes = {
    barbarian:{label:'Варвар',die:12,primary:'str',saves:'Сила, Телосложение',skills:'Атлетика, Запугивание'},
    bard:{label:'Бард',die:8,primary:'cha',saves:'Ловкость, Харизма',skills:'Выступление, Убеждение'},
    cleric:{label:'Жрец',die:8,primary:'wis',saves:'Мудрость, Харизма',skills:'Проницательность, Религия'},
    druid:{label:'Друид',die:8,primary:'wis',saves:'Интеллект, Мудрость',skills:'Природа, Внимательность'},
    fighter:{label:'Воин',die:10,primary:'str',saves:'Сила, Телосложение',skills:'Атлетика, Внимательность'},
    monk:{label:'Монах',die:8,primary:'dex',saves:'Сила, Ловкость',skills:'Акробатика, Скрытность'},
    paladin:{label:'Паладин',die:10,primary:'cha',saves:'Мудрость, Харизма',skills:'Атлетика, Убеждение'},
    ranger:{label:'Следопыт',die:10,primary:'dex',saves:'Сила, Ловкость',skills:'Внимательность, Выживание'},
    rogue:{label:'Плут',die:8,primary:'dex',saves:'Ловкость, Интеллект',skills:'Скрытность, Ловкость рук'},
    sorcerer:{label:'Чародей',die:6,primary:'cha',saves:'Телосложение, Харизма',skills:'Аркана, Убеждение'},
    warlock:{label:'Колдун',die:8,primary:'cha',saves:'Мудрость, Харизма',skills:'Аркана, Обман'},
    wizard:{label:'Волшебник',die:6,primary:'int',saves:'Интеллект, Мудрость',skills:'Аркана, История'}
  };
  const abbr = {str:'Сил',dex:'Лов',con:'Тел',int:'Инт',wis:'Муд',cha:'Хар'};
  const full = {str:'Сила',dex:'Ловкость',con:'Телосложение',int:'Интеллект',wis:'Мудрость',cha:'Харизма'};
  const mod = v => Math.floor((v - 10) / 2);
  const sgn = v => (v >= 0 ? '+' : '') + v;

  function fill(){
    $('charSpecies').innerHTML = species.map(([id,n]) => `<option value="${id}">${n}</option>`).join('');
    $('charBackground').innerHTML = Object.entries(backgrounds).map(([id,b]) => `<option value="${id}">${b.label}</option>`).join('');
    $('charClass').innerHTML = Object.entries(classes).map(([id,c]) => `<option value="${id}">${c.label}</option>`).join('');
    $('charLevel').innerHTML = Array.from({length:20}, (_,i) => `<option value="${i+1}">${i+1}</option>`).join('');
    $('charSpecies').value = 'human';
    $('charBackground').value = 'soldier';
    $('charClass').value = 'fighter';
    $('charLevel').value = '1';
  }
  function stats(cls, bg){
    const order = [cls.primary, 'con', 'dex', 'wis', 'int', 'cha', 'str'].filter((v,i,a) => a.indexOf(v) === i);
    const arr = [15,14,13,12,10,8];
    const out = {str:8,dex:8,con:8,int:8,wis:8,cha:8};
    order.forEach((k,i) => { if(arr[i] !== undefined) out[k] = arr[i]; });
    const b = (backgrounds[bg] || backgrounds.acolyte).bonus;
    out[b[0]] = Math.min(20, out[b[0]] + 2);
    out[b[1]] = Math.min(20, out[b[1]] + 1);
    return out;
  }
  function build(){
    const clsId = $('charClass').value;
    const bgId = $('charBackground').value;
    const lvl = Math.max(1, Math.min(20, +$('charLevel').value || 1));
    const cls = classes[clsId] || classes.fighter;
    const bg = backgrounds[bgId] || backgrounds.acolyte;
    const st = stats(cls, bg);
    const conMod = mod(st.con), dexMod = mod(st.dex);
    const hp = Math.max(1, cls.die + conMod) + (lvl - 1) * Math.max(1, Math.floor(cls.die/2) + 1 + conMod);
    const ac = 10 + dexMod;
    const pb = 2 + Math.floor((lvl - 1) / 4);
    const prog = window.CLASS_PROGRESS && window.CLASS_PROGRESS[clsId];
    const feats = prog ? Object.entries(prog.features).filter(([l]) => +l <= lvl).slice(-4).map(([l,t]) => `${l}: ${t}`) : [];
    return {clsId,bgId,lvl,cls,bg,st,hp,ac,pb,feats};
  }
  function preview(){
    const d = build();
    const statsLine = Object.keys(full).map(k => `${abbr[k]} ${d.st[k]} (${sgn(mod(d.st[k]))})`).join(' · ');
    $('charPreview').textContent = `${$('charName').value.trim() || 'Новый герой'} — ${d.cls.label} ${d.lvl}
${species.find(s => s[0] === $('charSpecies').value)[1]} · ${d.bg.label}
Хиты: ${d.hp} · КД: ${d.ac} (10 + Лов) · Инициатива: ${sgn(mod(d.st.dex))} · БМ: +${d.pb}
Спасброски: ${d.cls.saves}
Навыки: ${d.cls.skills}; ${d.bg.skills}
Характеристики: ${statsLine}
Ключевые умения: ${d.feats.join('; ') || '—'}
Предыстория: ${d.bg.feat}`;
  }
  function open(){
    if(!$('charSpecies').options.length) fill();
    $('charName').value = '';
    $('charLevel').value = '1';
    preview();
    openModal(modal, document.getElementById('addPcTop'));
    setTimeout(() => $('charName').focus(), 40);
  }
  function create(){
    const d = build();
    const name = $('charName').value.trim() || 'Новый герой';
    const statsLine = Object.keys(full).map(k => `${abbr[k]} ${d.st[k]} (${sgn(mod(d.st[k]))})`).join(' · ');
    const b = makeBlock('pc', name);
    Object.assign(b, freeCascadePos());
    b.props = {
      'Класс': `${d.cls.label} ${d.lvl}`, 'Раса': species.find(s => s[0] === $('charSpecies').value)[1],
      'Предыстория': d.bg.label, 'HP': d.hp, 'Броня КК': d.ac, 'Инициат': sgn(mod(d.st.dex)), 'БМ': `+${d.pb}`
    };
    b.stats = ['str','dex','con','int','wis','cha'].map(k => d.st[k]);
    b.res = [{name:'Вдохновение',cur:1,max:1},{name:'Кости хитов',cur:d.lvl,max:d.lvl}];
    b.text = `Спасброски: ${d.cls.saves}\nНавыки: ${d.cls.skills}; ${d.bg.skills}\nХарактеристики: ${statsLine}\n\nКлючевые умения:\n${d.feats.join('\n') || '—'}\n\nПредыстория: ${d.bg.feat}`;
    blocks.push(b);
    save(); render(); showTab('chars');
    closeModal(modal);
    toast('Персонаж создан');
  }

  $('addPcTop')?.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); open(); }, true);
  $('addPc')?.addEventListener('click', e => { e.preventDefault(); e.stopImmediatePropagation(); open(); }, true);
  $('characterClose')?.addEventListener('click', () => closeModal(modal));
  modal.addEventListener('click', e => { if(e.target === modal) closeModal(modal); });
  ['charName','charSpecies','charBackground','charClass','charLevel'].forEach(id => {
    $(id).addEventListener('input', preview);
    $(id).addEventListener('change', preview);
  });
  $('charCreate').addEventListener('click', create);
  $('charBlank').addEventListener('click', () => { addBlock('pc'); closeModal(modal); });
  window.openCharacterBuilder = open;
})();
