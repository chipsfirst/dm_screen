/* ════════════ Генераторы: сокровища, травмы, критические эффекты, бой ════════════ */
(function(){
  const modal = document.getElementById('genModal');
  if(!modal) return;
  const body = document.getElementById('genBody');
  const tabs = Array.prototype.slice.call(modal.querySelectorAll('[data-gen]'));
  let tab = 'treasure';
  let lastText = '', lastPicks = [];
  const st = { band:'0-4', mode:'hoard', level:5, count:4, diff:'medium', habitat:'all', kind:'mixed' };

  const d = n => 1 + Math.floor(Math.random()*n);
  const roll = (n, s) => { let t=0; for(let i=0;i<n;i++) t += d(s); return t; };
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const esc = s => escapeHtml(String(s));
  const money = n => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const cnt = x => typeof x === 'number' ? x : d(parseInt(String(x).slice(1), 10) || 1);

  /* ── монеты ── */
  const COINS = {
    '0-4':  [['мм',6,100],['см',3,100],['зм',2,10]],
    '5-10': [['мм',2,100],['см',2,1000],['зм',6,100],['пм',3,10]],
    '11-16':[['зм',4,1000],['пм',5,100]],
    '17+':  [['зм',12,1000],['пм',8,1000]]
  };
  function coinsLine(band){
    return COINS[band].map(([u,n,m]) => {
      const v = roll(n,6)*m;
      return v ? money(v)+' '+u : '';
    }).filter(Boolean).join(' · ') || '—';
  }

  /* ── камни и искусство ── */
  const GEMS = {
    10:['азурит','бирюза','гематит','глазчатый агат','голубой кварц','лазурит','малахит','моховой агат','обсидиан','полосчатый агат','родохрозит','тигровый глаз'],
    50:['гелиотроп','звёздчатый розовый кварц','кварц','лунный камень','оникс','сардоникс','сердолик','халцедон','хризопраз','циркон','цитрин','яшма'],
    100:['аметист','гагат','гранат','жемчуг','коралл','нефрит','турмалин','хризоберилл','шпинель','янтарь'],
    500:['аквамарин','александрит','синяя шпинель','топаз','хризолит','чёрный жемчуг'],
    1000:['голубой сапфир','жёлтый сапфир','звёздчатый рубин','звёздчатый сапфир','изумруд','огненный опал','опал','чёрный опал'],
    5000:['алмаз','гиацинт','рубин','чёрный сапфир']
  };
  const ART = {
    25:['серебряный кувшин','резная костяная статуэтка','маленький золотой браслет','одеяние из золотой парчи','бархатная маска с серебряной вышивкой','медная чаша с филигранью','гравированные игральные кости','зеркальце в расписной раме','вышитый шёлковый платок','золотой медальон с портретом'],
    250:['золотое кольцо с гелиотропом','резная статуэтка из слоновой кости','большой золотой браслет','серебряное ожерелье с камнем','бронзовая корона','шёлковая мантия с золотой вышивкой','большой тканый гобелен','латунная кружка с нефритом','коробочка с фигурками животных','золотая клетка для птиц'],
    750:['серебряная чаша с лунным камнем','длинный меч из посеребрённой стали','резная арфа с инкрустацией','небольшой золотой идол','гребень в виде дракона с гранатами','бутыль с золотой фольгой и аметистами','церемониальный кинжал с чёрным жемчугом','серебряно-золотая брошь','обсидиановая статуэтка с золотом','расписная боевая маска'],
    2500:['золотая цепь с огненным опалом','старинный шедевр живописи','мантилья с лунными камнями','платиновый браслет с сапфиром','перчатки, усыпанные камнями','ножной браслет с самоцветами','золотая музыкальная шкатулка','браслет с аквамаринами','повязка с глазом из сапфира','ожерелье из розового жемчуга'],
    7500:['золотая корона с самоцветами','платиновое кольцо с камнями','золотая статуэтка с рубинами','золотой кубок с изумрудами','золотая шкатулка с филигранью','расписной саркофаг','нефритовая игральная доска','рог из слоновой кости']
  };
  function gemsLine(values, n){
    const out = [];
    for(let i=0;i<n;i++){ const v = pick(values); out.push(pick(GEMS[v])+' ('+v+' зм)'); }
    return out.join(', ');
  }
  function artLine(values, n){
    const out = [];
    for(let i=0;i<n;i++){ const v = pick(values); out.push(pick(ART[v])+' ('+v+' зм)'); }
    return out.join(', ');
  }

  /* ── безделушки (d100) ── */
  const TRINKETS = ['Мумифицированная рука гоблина','Кусок хрусталя, светящийся в темноте','Золотая монета несуществующего королевства','Дневник безумца с обрывками карт','Кольцо с фальшивым камнем','Ключ без замка','Пёрышко, которое не сминается','Стеклянный глаз','Кость с вырезанными рунами','Колода карт с одним тузом','Медный медальон с чужим именем','Записная книжка с вырванными страницами','Прядь серебряных волос','Камешек, который всегда тёплый','Флакон с мутной жидкостью','Кусок мыла с запахом лаванды','Деревянная свистулька','Кожаный ремешок с зубом','Старая театральная маска','Карта поместья без подписи','Глиняная фигурка кошки','Ножницы с позолотой','Перо ворона','Клубок шерсти с иглой','Кольцо из конского волоса','Катушка чёрной нити','Мешочек с сушёными грибами','Моток медной проволоки','Квадратный камень с дырой','Футляр для свитков','Огарок свечи с запахом воска','Гребень с двумя зубьями','Монета с дыркой','Стеклянная бусина','Маленький компас без стрелки','Обломок меча','Значок гильдии','Кусочек мела','Пузырёк чернил','Стальное перо','Игральная кость с двумя шестёрками','Платок с вышитым гербом','Ржавый ключ','Кусок угля','Роговая ложка','Глиняная трубка','Фляга с гравировкой','Пластина доспеха','Перчатка без пары','Мешочек с песком','Маленький колокольчик','Седло для мыши','Кусок верёвки с узлом','Флакон духов','Зеркальце в оправе','Деревянный гребень','Каменный шарик','Письмо без адреса','Шёлковая лента','Монета с профилем','Кусок воска','Булавка с жемчужиной','Носовой платок','Свиток с каракулями','Кожаный браслет','Деревянная дудочка','Кольцо с гравировкой','Кость с насечками','Мешочек с семенами','Стеклянный флакон','Каменная печатка','Лента с гербом','Маленький молоток','Гвоздь из белого металла','Пряжка от пояса','Клок волос','Кусок пергамента','Чернильница','Кисть художника','Глиняная чашка','Осколок зеркала','Медная цепочка','Замочная скважина в дереве','Пустая шкатулка','Стеклянная сфера','Каменный диск','Лоскут шёлка','Кожаный мешочек','Кость животного','Пёрышко сойки','Медная монета','Кусок коры','Кремень и огниво','Письменный прибор','Мелкий колокольчик','Глиняная свинья','Деревянный меч','Платок с вышивкой','Детская погремушка','Кусок слюды','Шнурок с бусиной','Металлическая урна с прахом героя'];

  /* ── таблицы магических предметов ── */
  const TABLE_RARITY = {
    A:['обычный'], B:['необычный'], C:['необычный'], D:['редкий'], E:['редкий'],
    F:['необычный'], G:['очень редкий'], H:['легендарный'], I:['очень редкий','легендарный']
  };
  const COMMON_ITEMS = ['Зелье лечения','Свиток (заговор)','Зелье лазания','Свиток (1 уровень)','Свиток (2 уровня)','Зелье большого лечения'];
  function magicItem(letter){
    const it = (window.SRD_ITEMS && window.SRD_ITEMS.items) || [];
    const want = TABLE_RARITY[letter] || ['необычный'];
    const pool = it.filter(x => want.indexOf(x.rarity) >= 0);
    if(pool.length) return pick(pool).n;
    return pick(COMMON_ITEMS);
  }

  /* ── клад по полосе КР ── */
  const HOARD = {
    '0-4': [
      {r:[1,6]}, {r:[7,16], g:[2,6,10]}, {r:[17,26], a:[2,4,25]}, {r:[27,36], g:[2,6,50]},
      {r:[37,44], g:[2,6,10], it:[['A','d6']]}, {r:[45,52], a:[2,4,25], it:[['A','d6']]},
      {r:[53,60], g:[2,6,50], it:[['A','d6']]}, {r:[61,65], g:[2,6,10], it:[['B','d4']]},
      {r:[66,70], a:[2,4,25], it:[['B','d4']]}, {r:[71,75], g:[2,6,50], it:[['B','d4']]},
      {r:[76,78], g:[2,6,10], it:[['C','d4']]}, {r:[79,80], a:[2,4,25], it:[['C','d4']]},
      {r:[81,85], g:[2,6,50], it:[['C','d4']]}, {r:[86,92], a:[2,4,25], it:[['F','d4']]},
      {r:[93,97], g:[2,6,50], it:[['F','d4']]}, {r:[98,99], a:[2,4,25], it:[['G',1]]},
      {r:[100,100], g:[2,6,50], it:[['G',1]]}
    ],
    '5-10': [
      {r:[1,4]}, {r:[5,10], a:[2,4,25]}, {r:[11,16], g:[3,6,50]}, {r:[17,22], g:[3,6,100]},
      {r:[23,28], a:[2,4,250]}, {r:[29,32], a:[2,4,25], it:[['A','d6']]}, {r:[33,36], g:[3,6,50], it:[['A','d6']]},
      {r:[37,40], g:[3,6,100], it:[['A','d6']]}, {r:[41,44], a:[2,4,250], it:[['A','d6']]},
      {r:[45,49], a:[2,4,25], it:[['B','d4']]}, {r:[50,54], g:[3,6,50], it:[['B','d4']]},
      {r:[55,59], g:[3,6,100], it:[['B','d4']]}, {r:[60,63], a:[2,4,250], it:[['B','d4']]},
      {r:[64,66], a:[2,4,25], it:[['C','d4']]}, {r:[67,69], g:[3,6,50], it:[['C','d4']]},
      {r:[70,72], g:[3,6,100], it:[['C','d4']]}, {r:[73,74], a:[2,4,250], it:[['C','d4']]},
      {r:[75,76], a:[2,4,25], it:[['D',1]]}, {r:[77,78], g:[3,6,50], it:[['D',1]]},
      {r:[79,79], g:[3,6,100], it:[['D',1]]}, {r:[80,80], a:[2,4,250], it:[['D',1]]},
      {r:[81,84], a:[2,4,25], it:[['F','d4']]}, {r:[85,88], g:[3,6,50], it:[['F','d4']]},
      {r:[89,91], g:[3,6,100], it:[['F','d4']]}, {r:[92,94], a:[2,4,250], it:[['F','d4']]},
      {r:[95,96], g:[3,6,100], it:[['G','d4']]}, {r:[97,98], a:[2,4,250], it:[['G','d4']]},
      {r:[99,99], g:[3,6,100], it:[['H',1]]}, {r:[100,100], a:[2,4,250], it:[['H',1]]}
    ],
    '11-16': [
      {r:[1,3]}, {r:[4,6], a:[2,4,250]}, {r:[7,9], a:[2,4,750]}, {r:[10,12], g:[3,6,500]},
      {r:[13,15], g:[3,6,1000]}, {r:[16,29], it:[['A','d4'],['B','d6']]}, {r:[30,50], it:[['C','d6']]},
      {r:[51,66], it:[['D','d4']]}, {r:[67,74], it:[['E',1]]}, {r:[75,82], it:[['E',1],['G','d4']]},
      {r:[83,92], it:[['H','d4']]}, {r:[93,100], it:[['I',1]]}
    ],
    '17+': [
      {r:[1,2]}, {r:[3,5], g:[3,6,1000], it:[['C','d8']]}, {r:[6,8], a:[1,10,2500], it:[['C','d8']]},
      {r:[9,11], a:[1,4,7500], it:[['C','d8']]}, {r:[12,14], g:[1,8,5000], it:[['C','d8']]},
      {r:[15,46], it:[['D','d6']]}, {r:[47,68], it:[['E','d6']]}, {r:[69,72], it:[['G','d4']]},
      {r:[73,80], it:[['H','d4']]}, {r:[81,100], it:[['I','d4']]}
    ]
  };

  /* ── индивидуальная добыча ── */
  const INDIVIDUAL = {
    '0-4': [[1,30,{мм:[5,6]}],[31,60,{см:[4,6]}],[61,70,{эм:[3,6]}],[71,95,{зм:[3,6]}],[96,100,{пм:[1,6]}]],
    '5-10':[[1,30,{мм:[4,6,100],эм:[1,6,10]}],[31,60,{см:[6,6,10],зм:[2,6,10]}],[61,70,{эм:[3,6,10],зм:[2,6,10]}],[71,95,{зм:[4,6,10]}],[96,100,{зм:[2,6,10],пм:[3,6]}]],
    '11-16':[[1,20,{см:[4,6,100],зм:[1,6,100]}],[21,35,{эм:[1,6,100],зм:[1,6,100]}],[36,75,{зм:[2,6,100],пм:[1,6,10]}],[76,100,{зм:[2,6,100],пм:[2,6,10]}]],
    '17+':[[1,15,{эм:[2,6,1000],зм:[8,6,100]}],[16,55,{зм:[1,6,1000],пм:[1,6,100]}],[56,100,{зм:[1,6,1000],пм:[2,6,100]}]]
  };

  function hoard(band){
    const roll100 = d(100);
    const row = HOARD[band].find(x => roll100 >= x.r[0] && roll100 <= x.r[1]) || HOARD[band][0];
    const lines = ['Монеты: '+coinsLine(band)];
    let html = '<div class="gen-block"><b>Монеты</b><div>'+esc(coinsLine(band))+'</div></div>';
    if(row.g){
      const s = gemsLine([row.g[2]], roll(row.g[0], row.g[1]));
      html += '<div class="gen-block"><b>Самоцветы</b><div>'+esc(s)+'</div></div>';
      lines.push('Самоцветы: '+s);
    }
    if(row.a){
      const s = artLine([row.a[2]], roll(row.a[0], row.a[1]));
      html += '<div class="gen-block"><b>Предметы искусства</b><div>'+esc(s)+'</div></div>';
      lines.push('Предметы искусства: '+s);
    }
    if(row.it){
      const items = [];
      row.it.forEach(([letter, c]) => { const n = cnt(c); for(let i=0;i<n;i++) items.push(magicItem(letter)); });
      html += '<div class="gen-block"><b>Магические предметы ('+row.it.map(x=>x[0]).join('+')+')</b><div>'+esc(items.join(', '))+'</div></div>';
      lines.push('Магические предметы: '+items.join(', '));
    }
    html += '<div class="gen-block"><b>d100 по таблице клада</b><div>'+roll100+'</div></div>';
    return { html, text: 'Клад (КР '+band+')\n'+lines.join('\n') };
  }
  function individual(band){
    const roll100 = d(100);
    const row = INDIVIDUAL[band].find(x => roll100 >= x[0] && roll100 <= x[1]) || INDIVIDUAL[band][0];
    const coins = Object.keys(row[2]).map(u => {
      const [n, s, m] = row[2][u];
      return money(roll(n, s) * (m || 1)) + ' ' + u;
    }).join(' · ');
    return {
      html: '<div class="gen-block"><b>Монеты</b><div>'+esc(coins)+'</div></div><div class="gen-block"><b>d100 по таблице индивидуальной добычи</b><div>'+roll100+'</div></div>',
      text: 'Индивидуальная добыча (КР '+band+')\nМонеты: '+coins
    };
  }
  function trinket(){
    const r = d(100);
    return {
      html: '<div class="gen-big">d100 = '+r+'</div><div class="gen-block"><b>Безделушка</b><div>'+esc(TRINKETS[r-1])+'</div></div>',
      text: 'Безделушка (d100='+r+'): '+TRINKETS[r-1]
    };
  }
  function treasure(){
    if(st.mode === 'individual') return individual(st.band);
    if(st.mode === 'trinket') return trinket();
    return hoard(st.band);
  }

  /* ── травмы (d20) ── */
  const INJURIES = [
    [1,1,'Потеря глаза','Помеха на проверки Мудрости (Восприятие), опирающиеся на зрение, и на дальнобойные атаки. Без обоих глаз персонаж ослеплён.'],
    [2,2,'Потеря руки или кисти','Нельзя держать два предмета и пользоваться двуручным оружием.'],
    [3,3,'Потеря ступни или ноги','Скорость уменьшается вдвое, нужен посох или протез. После Рывка персонаж падает ничком.'],
    [4,4,'Хромота','Скорость −5 футов. После Рывка — спасбросок Ловкости Сл 10, иначе ничком. Снимается магическим лечением.'],
    [5,7,'Внутренняя травма','Действием в бою — спасбросок Телосложения Сл 15, иначе теряешь действие и реакцию до начала следующего хода.'],
    [8,10,'Сломанные рёбра','То же, но Сл 10. Лечится магией или 10 днями покоя.'],
    [11,13,'Ужасный шрам','Помеха на Харизму (Убеждение), преимущество на Харизму (Запугивание). Снимается магическим лечением.'],
    [14,16,'Гноящаяся рана','Максимум хитов снижается на 1 каждые 24 часа. При 0 — смерть. Снимается магией или 10 успешными проверками Медицины Сл 15.'],
    [17,20,'Малый шрам','Косметический след, механических эффектов нет.']
  ];
  function injury(){
    const r = d(20);
    const row = INJURIES.find(x => r >= x[0] && r <= x[1]);
    return {
      html: '<div class="gen-big">d20 = '+r+'</div><div class="gen-block"><b>'+esc(row[2])+'</b><div>'+esc(row[3])+'</div></div>',
      text: 'Травма (d20='+r+'): '+row[2]+'. '+row[3]
    };
  }

  /* ── критические эффекты ── */
  const CRITS = [
    'Глубокая рана: цель получает 1к6 урона в начале своего следующего хода.',
    'Оглушение: спасбросок Телосложения Сл 15, иначе цель ошеломлена до конца своего следующего хода.',
    'Сбит с ног: спасбросок Силы Сл 13, иначе цель падает ничком.',
    'Кровотечение: 1к4 урона в начале каждого хода цели, пока рана не обработана.',
    'Вывих: помеха на броски атаки цели до конца её следующего хода.',
    'Замешательство: цель не может совершать реакции до конца своего следующего хода.',
    'Слабость: скорость цели −10 футов до конца боя.',
    'Паника: спасбросок Мудрости Сл 13, иначе цель испугана тобой до конца своего следующего хода.',
    'Точный удар: дополнительно 1к8 урона того же типа.',
    'Сокрушение: следующая атака по цели совершается с преимуществом.'
  ];
  const FUMBLES = [
    'Оружие выбито из рук: подобрать его — действие.',
    'Задеваешь союзника в пределах 5 футов: 1к4 урона.',
    'Ты падаешь ничком.',
    'Оружие застревает: проверка Силы Сл 10, чтобы вытащить.',
    'Теряешь равновесие: помеха на следующую атаку.',
    'Тетива или крепление повреждено: починка — действие.',
    'Открываешься: противник получает преимущество на следующую атаку по тебе.',
    'Оружие или снаряд отлетает на 10 футов в случайную сторону.',
    'Растяжение: помеха на проверки Силы до конца боя.',
    'Конфуз: помеха на проверки Харизмы до конца боя.'
  ];
  function crit(kind){
    const table = kind === 'fumble' ? FUMBLES : CRITS;
    const r = d(10);
    const title = kind === 'fumble' ? 'Критический промах' : 'Критическое попадание';
    return {
      html: '<div class="gen-big">d10 = '+r+'</div><div class="gen-block"><b>'+title+'</b><div>'+esc(table[r-1])+'</div></div>',
      text: title+' (d10='+r+'): '+table[r-1]
    };
  }

  /* ── бой ── */
  const XP = {
    1:[25,50,75,100], 2:[50,100,150,200], 3:[75,150,225,400], 4:[125,250,375,500],
    5:[250,500,750,1100], 6:[300,600,900,1400], 7:[350,750,1100,1700], 8:[450,900,1400,2100],
    9:[550,1100,1600,2400], 10:[600,1200,1900,2800], 11:[800,1600,2400,3600], 12:[1000,2000,3000,4500],
    13:[1100,2200,3400,5100], 14:[1250,2500,3800,5700], 15:[1400,2800,4300,6400], 16:[1600,3200,4800,7200],
    17:[2000,3900,5900,8800], 18:[2100,4200,6300,9500], 19:[2400,4900,7300,10900], 20:[2800,5700,8500,12700]
  };
  const XP_DIFF = { easy:0, medium:1, hard:2, deadly:3 };
  const CR2XP = {'0':10,'0.125':25,'0.25':50,'0.5':100,'1':200,'2':450,'3':700,'4':1100,'5':1800,'6':2300,'7':2900,'8':3900,'9':5000,'10':5900,'11':7200,'12':8400,'13':10000,'14':11500,'15':13000,'16':15000,'17':18000,'18':20000,'19':22000,'20':25000,'21':33000,'22':41000,'23':50000,'24':62000,'25':75000,'26':90000,'27':105000,'28':120000,'29':135000,'30':155000};
  function crNum(s){
    const t = String(s||'').trim();
    const f = t.match(/^(\d+)\s*\/\s*(\d+)/);
    if(f) return String(+f[1]/+f[2]);
    const n = t.match(/^(\d+)/);
    return n ? String(+n[1]) : null;
  }
  function mult(n){ return n<=1?1 : n===2?1.5 : n<=6?2 : n<=10?2.5 : 3; }
  function habitats(){
    const set = {};
    (window.BESTIARY||[]).forEach(m => {
      if(m._src === 'CoS') return;
      String(m.hab||'').split(', ').forEach(h => { if(h) set[h] = 1; });
    });
    return Object.keys(set).sort();
  }
  function fillHabitats(){
    const sel = body.querySelector('[data-st="habitat"]');
    if(!sel) return;
    const hs = habitats();
    if(!hs.length) return;
    const cur = sel.value || st.habitat || 'all';
    sel.innerHTML = '<option value="all">Любая</option>' + hs.map(h => '<option value="'+esc(h)+'">'+esc(h)+'</option>').join('');
    sel.value = (cur === 'all' || hs.indexOf(cur) >= 0) ? cur : 'all';
  }
  function poolFor(){
    const hab = st.habitat;
    return (window.BESTIARY||[])
      .filter(m => m._src !== 'CoS')
      .map(m => ({ m, cr: crNum(m.cr), hab: String(m.hab||''), xp: CR2XP[crNum(m.cr)] }))
      .filter(x => x.xp && parseFloat(x.cr) <= st.level + 3)
      .filter(x => hab === 'all' || !x.hab ? hab === 'all' : (x.hab.split(', ').indexOf(hab) >= 0 || x.hab.indexOf('Любая') >= 0))
      .map(x => ({ m: x.m, cr: x.cr, xp: x.xp }));
  }
  function pickCr(pool, min, max){
    const c = pool.filter(x => parseFloat(x.cr) >= min && parseFloat(x.cr) <= max);
    return c.length ? pick(c) : null;
  }
  function encounter(){
    const pool = poolFor();
    if(!pool.length) return null;
    const lvl = Math.max(1, Math.min(20, st.level));
    const c = Math.max(1, Math.min(8, st.count));
    const target = XP[lvl][XP_DIFF[st.diff]] * c;
    let best = null;
    for(let a=0; a<400; a++){
      const picks = [];
      if(st.kind === 'boss'){
        const b = pickCr(pool, lvl, lvl+3) || pickCr(pool, Math.max(0, lvl-1), lvl+3);
        if(b) picks.push(b);
      } else if(st.kind === 'boss_minions'){
        const b = pickCr(pool, Math.max(0, lvl-1), lvl+3);
        if(b) picks.push(b);
        const n = 2 + d(5);
        for(let i=0;i<n;i++){ const m = pickCr(pool, 0, Math.max(0.25, lvl-3)); if(m) picks.push(m); }
      } else if(st.kind === 'horde'){
        const n = 4 + d(7);
        for(let i=0;i<n;i++){ const m = pickCr(pool, 0, Math.max(0.25, lvl-3)); if(m) picks.push(m); }
      } else if(st.kind === 'pair'){
        const n = 2 + d(2);
        for(let i=0;i<n;i++){ const m = pickCr(pool, Math.max(0.5, lvl-2), lvl+1); if(m) picks.push(m); }
      } else {
        const size = 1 + d(6);
        for(let i=0;i<size;i++){ const cand = pool.filter(x => x.xp <= target); if(!cand.length) break; picks.push(pick(cand)); }
      }
      if(!picks.length) continue;
      const raw = picks.reduce((s,x)=>s+x.xp, 0);
      const k = mult(picks.length);
      const score = Math.abs(target - raw*k);
      if(!best || score < best.score) best = { score, picks, raw, k, target };
    }
    return best;
  }
  function battle(){
    const r = encounter();
    if(!r) return { html: '<div class="lib-empty">Бестиарий ещё не загружен или под фильтр не подошёл ни один монстр.</div>', text: '' };
    lastPicks = r.picks;
    const groups = {};
    r.picks.forEach(x => {
      const k = x.m.n;
      if(!groups[k]) groups[k] = { n:k, cr:x.cr, xp:x.xp, c:0, idx: lastPicks.indexOf(x) };
      groups[k].c++;
    });
    let html = '<div class="gen-block"><b>Порог сложности</b><div>'+money(r.target)+' опыта · множитель ×'+r.k+' · итог '+money(Math.round(r.raw*r.k))+'</div></div>';
    const lines = [];
    Object.keys(groups).forEach(k => {
      const g = groups[k];
      html += '<div class="lib-row"><span class="lib-kind">ПО '+esc(g.cr)+'</span><div class="lib-main"><div class="lib-title">'+esc(g.n)+(g.c>1?' × '+g.c:'')+'</div><div class="lib-meta">'+money(g.xp*g.c)+' опыта</div></div><span class="lib-add" data-add-monster="'+g.idx+'" title="Добавить на ширму">＋</span></div>';
      lines.push(g.n+(g.c>1?' × '+g.c:'')+' (ПО '+g.cr+')');
    });
    return { html, text: 'Бой ('+st.kind+', среда: '+(st.habitat==='all'?'любая':st.habitat)+')\n'+lines.join('\n')+'\nПорог: '+money(r.target)+' опыта' };
  }

  /* ── квесты ── */
  const QUEST = {
    task: ['убить чудовище','найти пропавшего человека','доставить груз','защитить деревню','расследовать убийство','украсть реликвию','договориться с врагом','очистить руины','сопроводить караван','разгадать тайну'],
    patron: ['гильдия воров','староста деревни','храм','обедневший дворянин','купеческий дом','таинственный незнакомец','капитан стражи','странствующий маг'],
    place: ['в лесу','в подземелье','в городе','в заброшенных руинах','в горах','на болоте','на побережье','в катакомбах'],
    twist: ['заказчик лжёт','у задания есть соперник','цель на самом деле невиновна','награда окажется проклятой','вмешивается третья сила','нужно успеть до рассвета'],
    reward: ['200 зм','магический предмет','услуга влиятельного лица','информация о враге','титул','редкий компонент']
  };
  function quest(){
    const t = pick(QUEST.task), p = pick(QUEST.patron), pl = pick(QUEST.place), tw = pick(QUEST.twist), rw = pick(QUEST.reward);
    return {
      html: '<div class="gen-block"><b>Заказчик</b><div>'+esc(p)+'</div></div>'+
            '<div class="gen-block"><b>Задача</b><div>'+esc(t)+'</div></div>'+
            '<div class="gen-block"><b>Место</b><div>'+esc(pl)+'</div></div>'+
            '<div class="gen-block"><b>Осложнение</b><div>'+esc(tw)+'</div></div>'+
            '<div class="gen-block"><b>Награда</b><div>'+esc(rw)+'</div></div>',
      text: 'Квест\nЗаказчик: '+p+'\nЗадача: '+t+'\nМесто: '+pl+'\nОсложнение: '+tw+'\nНаграда: '+rw
    };
  }

  /* ── НПС ── */
  const NPC = {
    first: ['Альберт','Бриана','Виллем','Гарольд','Далия','Ирма','Кас','Лира','Марк','Нора','Орен','Перси','Руфус','Селина','Тобиас','Уна','Феликс','Хельга','Эдвин','Яна'],
    last: ['из Восточной заставы','Камнещит','Тихий','Рыжий','Медный','Верный','Полуночный','Косой','Быстрый','Седой'],
    race: ['человек','эльф','полуэльф','дварф','полурослик','гном','тифлинг','полуорк','драконорождённый','аасимар'],
    job: ['трактирщик','кузнец','стражник','писарь','торговец','охотник','лекарь','моряк','наёмник','жрец','вор','картограф','учёный','скотовод'],
    face: ['шрам через бровь','седые волосы, заплетённые в косу','обветренное лицо','бритоголовый','веснушки и рыжие брови','ледяные серые глаза','косой взгляд исподлобья','борода с проседью','высокий лоб и тонкие губы'],
    cloth: ['не по росту большой плащ','кожаный фартук ремесленника','поношенный, но опрятный камзол','тяжёлые сапоги в грязи','шерстяной шарф до подбородка','перчатки без пальцев','парадная перевязь через плечо','плащ с чужой вышивкой'],
    mark: ['золотое кольцо на шнурке на шее','обожжённые руки','прихрамывает на левую ногу','татуировка на шее','хриплый голос','пахнет травами и дымом','всегда в перчатках','небольшой шрам на подбородке','не расстаётся с деревянной флягой'],
    trait: ['говорит быстро и перебивает','отвечает вопросом на вопрос','постоянно что-то вертит в руках','смотрит в глаза дольше, чем нужно','смеётся невпопад','шепчет, даже когда не нужно','называет всех «друг»','никогда не садится спиной к двери'],
    want: ['расплатиться с долгом','найти пропавшего брата','получить место в гильдии','защитить семью','разбогатеть','отомстить','уехать из города','доказать свою правоту'],
    secret: ['скрывает прошлое в другом городе','работает на гильдию воров','влюблён в чужую жену или мужа','знает, где спрятан клад','подменяет товар','болен и скрывает это','видел то, чего видеть не должен'],
    hook: ['просит проводить до дома','предлагает работу','ищет защитника','хочет продать странную вещь','просит найти пропажу','предупреждает об опасности']
  };
  function npc(){
    const name = pick(NPC.first) + ' ' + pick(NPC.last);
    const race = pick(NPC.race), job = pick(NPC.job);
    const look = [pick(NPC.face), pick(NPC.cloth), pick(NPC.mark)].join('; ');
    const trait = pick(NPC.trait), want = pick(NPC.want), secret = pick(NPC.secret), hook = pick(NPC.hook);
    return {
      html: '<div class="gen-block"><b>Имя</b><div>'+esc(name)+'</div></div>'+
            '<div class="gen-block"><b>Кто</b><div>'+esc(race)+', '+esc(job)+'</div></div>'+
            '<div class="gen-block"><b>Внешность</b><div>'+esc(look)+'</div></div>'+
            '<div class="gen-block"><b>Манера</b><div>'+esc(trait)+'</div></div>'+
            '<div class="gen-block"><b>Хочет</b><div>'+esc(want)+'</div></div>'+
            '<div class="gen-block"><b>Секрет</b><div>'+esc(secret)+'</div></div>'+
            '<div class="gen-block"><b>Зацепка</b><div>'+esc(hook)+'</div></div>',
      text: 'НПС: '+name+'\nКто: '+race+', '+job+'\nВнешность: '+look+'\nМанера: '+trait+'\nХочет: '+want+'\nСекрет: '+secret+'\nЗацепка: '+hook
    };
  }

  /* ── подземелья ── */
  const DUNGEON = {
    kind: ['заброшенная шахта','храм забытого бога','катакомбы','подземная крепость','лаборатория мага','затопленные тоннели','гробница','канализация'],
    entrance: ['обвал в лесу','замаскированная дверь в подвале','колодец','расщелина в скале','люк в часовне','пещера у реки'],
    room: ['сторожевая','трапезная','кузня','склад','библиотека','алтарь','тюрьма','лаборатория','сокровищница','колодец','мост над пропастью','усыпальница','казарма','кухня','сад'],
    enc: ['стайка гоблинов','скелеты-стражи','гигантские крысы','банда контрабандистов','ожившая броня','паук-охотник','культисты','мимик','призрак','только ловушка, врагов нет'],
    trap: ['нажимная плита с дротиками','падающая решётка','кислотный туман','обвал','руна сна','яма с кольями','сигнальная нить','нет'],
    loot: ['20 зм в кожаном мешке','зелье лечения','старинная карта','серебряный кубок','свиток 1 уровня','ключ без замка','флакон с неизвестной жидкостью'],
    boss: ['огр-страж','некромант','гигантский паук','рыцарь-скелет','маг-отступник','старейшина культистов','нет — подземелье заброшено'],
    cond: ['затоплен по колено','потолок обвалился','выгорел','зарос грибницей','завален костями','покрыт инеем','пахнет серой'],
    atm: ['капает вода','слышен скрип','гулкое эхо шагов','ветер в щелях','давящая тишина','шорох за стеной'],
    feature: ['фреска с картой','алтарь с чашей','зеркало в раме','колодец без дна','статуя без головы','рычаг в стене'],
    history: ['здесь жили шахтёры, пока не пробили древнюю кладку','храм перестроили из чужого святилища','лабораторию бросили в спешке','гробницу разграбили, но не до конца','крепость пала от предательства']
  };

  function dungeonMap(cells){
    const W=86, H=52, GX=42, GY=36;
    const maxX = Math.max.apply(null, cells.map(c=>c.x));
    const maxY = Math.max.apply(null, cells.map(c=>c.y));
    const w = (maxX+1)*(W+GX)-GX, h = (maxY+1)*(H+GY)-GY;
    const pos = c => ({ x: c.x*(W+GX), y: c.y*(H+GY) });
    let lines='', rects='';
    for(let i=1;i<cells.length;i++){
      const a=pos(cells[i-1]), b=pos(cells[i]);
      lines += '<line x1="'+(a.x+W/2)+'" y1="'+(a.y+H/2)+'" x2="'+(b.x+W/2)+'" y2="'+(b.y+H/2)+'" stroke="var(--line)" stroke-width="2"/>';
    }
    cells.forEach((c,i)=>{
      const q=pos(c);
      rects += '<rect x="'+q.x+'" y="'+q.y+'" width="'+W+'" height="'+H+'" rx="7" fill="var(--panel2)" stroke="var(--line)"/>'+
               '<text x="'+(q.x+W/2)+'" y="'+(q.y+H/2+5)+'" text-anchor="middle" fill="var(--text)" font-size="15" font-family="sans-serif">'+(i+1)+'</text>';
    });
    return '<svg viewBox="0 0 '+w+' '+h+'" width="100%" style="max-width:'+w+'px;height:auto;display:block;margin:10px auto" role="img" aria-label="Схема подземелья">'+lines+rects+'</svg>';
  }

  function dungeon(){
    const kind = pick(DUNGEON.kind), entry = pick(DUNGEON.entrance), history = pick(DUNGEON.history);
    const n = 4 + d(3);
    const rooms = [];
    const pool = DUNGEON.room.slice();
    let x=0, y=0;
    const cells=[{x:0,y:0}];
    for(let i=0;i<n;i++){
      const idx = Math.floor(Math.random()*pool.length);
      const name = pool.splice(idx,1)[0] || 'зал';
      rooms.push({ n:name, cond:pick(DUNGEON.cond), atm:pick(DUNGEON.atm), feat:pick(DUNGEON.feature),
                   enc:pick(DUNGEON.enc), trap:pick(DUNGEON.trap), loot:pick(DUNGEON.loot) });
      if(i>0){
        if(x >= 3) y++;
        else if(Math.random() < 0.5) x++;
        else y++;
        cells.push({x,y});
      }
    }
    const boss = pick(DUNGEON.boss);
    let html = '<div class="gen-block"><b>Тип</b><div>'+esc(kind)+'</div></div>'+
               '<div class="gen-block"><b>Вход</b><div>'+esc(entry)+'</div></div>'+
               '<div class="gen-block"><b>История</b><div>'+esc(history)+'</div></div>'+
               dungeonMap(cells);
    const lines = ['Подземелье: '+kind, 'Вход: '+entry, 'История: '+history];
    rooms.forEach((r,i)=>{
      html += '<div class="gen-block"><b>Зал '+(i+1)+': '+esc(r.n)+'</b><div>Состояние: '+esc(r.cond)+'<br>Атмосфера: '+esc(r.atm)+'<br>Особенность: '+esc(r.feat)+'<br>Обитатели: '+esc(r.enc)+'<br>Ловушка: '+esc(r.trap)+'<br>Добыча: '+esc(r.loot)+'</div></div>';
      lines.push('Зал '+(i+1)+' ('+r.n+'): '+r.cond+'; '+r.atm+'; '+r.feat+'; '+r.enc+'; ловушка: '+r.trap+'; добыча: '+r.loot);
    });
    html += '<div class="gen-block"><b>Финал</b><div>'+esc(boss)+'</div></div>';
    lines.push('Финал: '+boss);
    return { html, text: lines.join('\n') };
  }

  /* ── отрисовка ── */
  function render(){
    tabs.forEach(b => b.classList.toggle('on', b.dataset.gen === tab));
    if(tab === 'treasure'){
      body.innerHTML = '<div class="gen-row"><label>Класс опасности</label>'+
        '<select data-st="band">'+['0-4','5-10','11-16','17+'].map(b=>'<option value="'+b+'"'+(b===st.band?' selected':'')+'>'+b+'</option>').join('')+'</select>'+
        '<label>Что</label><select data-st="mode">'+
        [['hoard','Клад'],['individual','Индивидуальная добыча'],['trinket','Безделушка']].map(([v,t])=>'<option value="'+v+'"'+(v===st.mode?' selected':'')+'>'+t+'</option>').join('')+
        '</select><button class="btn" data-roll="treasure">Сгенерировать</button></div><div id="genOut" class="gen-out">Нажмите «Сгенерировать».</div>';
    } else if(tab === 'injury'){
      body.innerHTML = '<div class="gen-row"><button class="btn" data-roll="injury">Бросить d20</button></div><div id="genOut" class="gen-out"></div>';
    } else if(tab === 'crit'){
      body.innerHTML = '<div class="gen-row"><button class="btn" data-roll="crit">Критическое попадание</button>'+
        '<button class="btn" data-roll="fumble">Критический промах</button></div><div id="genOut" class="gen-out"></div>';
    } else if(tab === 'quest'){
      body.innerHTML = '<div class="gen-row"><button class="btn" data-roll="quest">Сгенерировать квест</button></div><div id="genOut" class="gen-out"></div>';
    } else if(tab === 'npc'){
      body.innerHTML = '<div class="gen-row"><button class="btn" data-roll="npc">Сгенерировать НПС</button></div><div id="genOut" class="gen-out"></div>';
    } else if(tab === 'dungeon'){
      body.innerHTML = '<div class="gen-row"><button class="btn" data-roll="dungeon">Сгенерировать подземелье</button></div><div id="genOut" class="gen-out"></div>';
    } else {
      const habs = habitats();
      body.innerHTML = '<div class="gen-row"><label>Уровень</label><input type="number" min="1" max="20" value="'+st.level+'" data-st="level">'+
        '<label>Персонажей</label><input type="number" min="1" max="8" value="'+st.count+'" data-st="count">'+
        '<select data-st="diff">'+[['easy','Легко'],['medium','Средне'],['hard','Сложно'],['deadly','Смертельно']].map(([v,t])=>'<option value="'+v+'"'+(v===st.diff?' selected':'')+'>'+t+'</option>').join('')+'</select></div>'+
        '<div class="gen-row"><label>Среда</label><select data-st="habitat"><option value="all"'+ (st.habitat==='all'?' selected':'') +'>Любая</option>'+
        habs.map(h=>'<option value="'+esc(h)+'"'+(h===st.habitat?' selected':'')+'>'+esc(h)+'</option>').join('')+'</select>'+
        '<label>Тип встречи</label><select data-st="kind">'+
        [['mixed','Смешанная'],['boss','Один босс'],['boss_minions','Босс и миньоны'],['horde','Орда'],['pair','Пара/тройка']].map(([v,t])=>'<option value="'+v+'"'+(v===st.kind?' selected':'')+'>'+t+'</option>').join('')+'</select>'+
        '<button class="btn" data-roll="battle">Подобрать бой</button></div><div id="genOut" class="gen-out"></div>';
    }
  }
  function out(html, withAdd){
    const el = document.getElementById('genOut');
    if(!el) return;
    el.innerHTML = html + (withAdd ? '<div class="gen-row"><button class="btn" data-add-last="1">Добавить на ширму</button></div>' : '');
  }

  modal.addEventListener('click', e=>{
    const t = e.target.closest('[data-gen]');
    if(t){ tab = t.dataset.gen; render(); if(tab==='battle') ensureBestiary().then(()=>{ if(tab==='battle') fillHabitats(); }).catch(()=>{}); return; }
    const a = e.target.closest('[data-add-last],[data-add-monster]');
    if(a){
      if(a.dataset.addLast !== undefined){
        if(lastText){ addRuleBlock({ title:'Генератор', text:lastText }); toast('Добавлено на ширму'); }
      } else {
        const x = lastPicks[+a.dataset.addMonster];
        if(x){ addMonsterBlock(x.m); toast('Монстр добавлен на ширму'); }
      }
      return;
    }
    const r = e.target.closest('[data-roll]');
    if(r){
      const kind = r.dataset.roll;
      if(kind === 'treasure'){ const o = treasure(); lastText = o.text; out(o.html, true); }
      else if(kind === 'injury'){ const o = injury(); lastText = o.text; out(o.html, true); }
      else if(kind === 'battle'){ const o = battle(); lastText = o.text; out(o.html, false); }
      else if(kind === 'quest'){ const o = quest(); lastText = o.text; out(o.html, true); }
      else if(kind === 'npc'){ const o = npc(); lastText = o.text; out(o.html, true); }
      else if(kind === 'dungeon'){ const o = dungeon(); lastText = o.text; out(o.html, true); }
      else { const o = crit(kind); lastText = o.text; out(o.html, true); }
      return;
    }
  });
  modal.addEventListener('change', e=>{
    const el = e.target.closest('[data-st]');
    if(!el) return;
    const k = el.dataset.st;
    st[k] = (k==='level'||k==='count') ? (parseInt(el.value,10)||1) : el.value;
    if(k==='habitat' || k==='kind' || k==='diff') render();
  });

  const openBtn = document.getElementById('btnGen');
  if(openBtn) openBtn.addEventListener('click', ()=>{
    render();
    if(tab === 'battle') ensureBestiary().then(()=>{ if(tab==='battle') fillHabitats(); }).catch(()=>{});
    openModal(modal, openBtn);
  });
  const closeBtn = document.getElementById('genClose');
  if(closeBtn) closeBtn.addEventListener('click', ()=> closeModal(modal));
  modal.addEventListener('click', e=>{ if(e.target === modal) closeModal(modal); });
})();

/* ═══ Совет мастеру ═══ */
(function(){
  const modal = document.getElementById('tipsModal');
  const body = document.getElementById('tipsBody');
  if(!modal || !body) return;
  const TIPS = [
    'Описывайте сцену двумя-тремя деталями, а не списком — остальное дорисует воображение игроков.',
    'Спрашивайте «что ты делаешь?», а не «ты делаешь?» — так решение принимает игрок.',
    'Давайте выбор без единственно верного ответа: оба варианта должны чего-то стоить.',
    'Провал броска не должен останавливать историю — пусть он меняет ситуацию, а не обрывает её.',
    'Напоминайте игрокам об их возможностях: вдохновение, преимущество, помощь союзника.',
    'Держите инициативу короткой: спрашивайте по кругу и не перескакивайте.',
    'Не прячьте важную информацию за один бросок — дайте минимум два пути к разгадке.',
    'Описывайте урон через последствия, а не только через цифры.',
    'Дайте каждому персонажу момент, где его навык решает задачу.',
    'Если бой затянулся, добавьте цель, таймер или угрозу третьей стороны.',
    'Отмечайте успехи игроков вслух — это поощряет их рисковать.',
    'Готовьте не сюжет, а ситуацию: кто чего хочет и что произойдёт без вмешательства героев.',
    'Именуйте второстепенных персонажей — имя делает мир живым.',
    'Пусть враги действуют по своим целям, а не ждут героев.',
    'Дайте игрокам возможность отступить — и покажите, что это разумный выбор.',
    'Не бойтесь говорить «да, но…» вместо «нет».',
    'Записывайте имена и обещания игроков — возвращайте их в игру позже.',
    'Смена темпа важнее разнообразия монстров: после напряжённой сцены дайте передышку.',
    'Покажите последствия прошлых решений — мир должен помнить.',
    'Один яркий NPC запоминается лучше десяти безымянных.',
    'Если правило мешает игре, решите быстро и разберитесь после сессии.',
    'Описывайте окружение через звуки и запахи — это дешевле картинок.',
    'Дайте игрокам право придумывать детали мира в рамках их предысторий.',
    'Не наказывайте за креативность — награждайте преимуществом, а не отказом.',
    'Держите угрозу понятной: игроки должны понимать, чем рискуют.',
    'Заканчивайте сессию на вопросе или выборе, а не на точке.',
    'Спрашивайте игроков о их персонажах между сценами — это оживляет игру.',
    'Провал спасброска от смерти — не конец, а поворот: дайте шанс и цену.',
    'Покажите, что мир живёт без героев: слухи, новости, изменения.',
    'Хвалите конкретные решения, а не «молодцы».'
  ];
  function show(){
    body.innerHTML = '<div class="gen-block"><div>'+escapeHtml(TIPS[Math.floor(Math.random()*TIPS.length)])+'</div></div>';
  }
  const btn = document.getElementById('btnTips');
  if(btn) btn.addEventListener('click', ()=>{ show(); openModal(modal, btn); });
  const next = document.getElementById('tipsNext');
  if(next) next.addEventListener('click', show);
  const close = document.getElementById('tipsClose');
  if(close) close.addEventListener('click', ()=> closeModal(modal));
  modal.addEventListener('click', e=>{ if(e.target === modal) closeModal(modal); });
})();

/* ═══ Правила D&D 5.5 ═══ */
(function(){
  const modal = document.getElementById('rulesModal');
  if(!modal) return;
  const btn = document.getElementById('btnRules');
  if(btn) btn.addEventListener('click', ()=> openModal(modal, btn));
  const close = document.getElementById('rulesClose');
  if(close) close.addEventListener('click', ()=> closeModal(modal));
  modal.addEventListener('click', e=>{ if(e.target === modal) closeModal(modal); });
})();
