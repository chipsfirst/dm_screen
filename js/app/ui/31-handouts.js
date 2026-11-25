/* Мастерская раздаток: письма, розыск, меню, записки и карточки предметов. */
(function(){
  const modal = document.getElementById('handoutModal');
  const btn = document.getElementById('btnHandouts');
  if(!modal || !btn) return;
  const template = document.getElementById('handoutTemplate');
  const title = document.getElementById('handoutTitle');
  const subtitle = document.getElementById('handoutSubtitle');
  const body = document.getElementById('handoutBody');
  const footer = document.getElementById('handoutFooter');
  const preview = document.getElementById('handoutPreview');
  const printBtn = document.getElementById('handoutPrint');
  const closeBtn = document.getElementById('handoutClose');

  const T = {
    letter:{
      cls:'letter', title:'Письмо', subtitle:'Герцог Валент',
      body:'Дорогой друг,\n\nмне нужна твоя помощь. В полночь у старой мельницы видели людей в серых плащах. Если ты согласен, приходи один и не говори никому о встрече.\n\nСожги это письмо после прочтения.',
      footer:'С уважением,\nгерцог Валент'
    },
    wanted:{
      cls:'wanted', title:'РАЗЫСКИВАЕТСЯ', subtitle:'За голову преступника',
      body:'Имя: Сэмюэл «Тихий» Кроу\nПриметы: шрам над левой бровью, серый плащ, хромает на правую ногу.\nНаграда: 500 золотых.',
      footer:'Обращаться к капитану городской стражи'
    },
    menu:{
      cls:'menu', title:'Меню таверны «Три совы»', subtitle:'Горячее, эль и ночлег',
      body:'Похлёбка дня — 2 см\nЖаркое с кореньями — 5 см\nПирог с дичью — 4 см\nЭль — 4 мм\nВино — 2 см\nНочлег — 5 см',
      footer:'Хозяин — Барнабас Толстый'
    },
    note:{
      cls:'note', title:'Записка', subtitle:'',
      body:'Встретимся в полночь у старой мельницы.\nПриходи один.\n\nЕсли увидишь серый плащ — уходи.',
      footer:'—'
    },
    item:{
      cls:'item', title:'Клинок сумерек', subtitle:'Оружие (длинный меч), редкое',
      body:'+1 к броскам атаки и урона.\nВ темноте клинок светится голубым.\nНастройка не требуется.',
      footer:'Вес: 1,5 кг'
    }
  };

  function load(id){
    const t = T[id] || T.letter;
    if(title) title.value = t.title;
    if(subtitle) subtitle.value = t.subtitle;
    if(body) body.value = t.body;
    if(footer) footer.value = t.footer;
    render();
  }
  function esc(v){
    return (typeof escapeHtml === 'function' ? escapeHtml(String(v || '')) : String(v || ''))
      .replace(/\n/g, '<br>');
  }
  function values(){
    const id = (template && template.value) || 'letter';
    const t = T[id] || T.letter;
    return {
      id, cls:t.cls,
      title:(title && title.value.trim()) || t.title,
      subtitle:(subtitle && subtitle.value.trim()) || '',
      body:(body && body.value.trim()) || t.body,
      footer:(footer && footer.value.trim()) || ''
    };
  }
  function sheetHtml(v){
    return `<div class="hs-kicker">Раздатка</div>
      <h2>${esc(v.title)}</h2>
      ${v.subtitle ? `<div class="hs-sub">${esc(v.subtitle)}</div>` : ''}
      <div class="hs-body">${esc(v.body)}</div>
      ${v.footer ? `<div class="hs-foot">${esc(v.footer)}</div>` : ''}`;
  }
  function render(){
    const v = values();
    if(preview){
      preview.innerHTML = `<article class="handout-sheet hs-${v.cls}">${sheetHtml(v)}</article>`;
    }
  }
  function open(){
    if(title && !title.value) load((template && template.value) || 'letter');
    else render();
    openModal(modal, document.activeElement);
  }
  function buildSheet(){
    const v = values();
    const sheet = document.createElement('article');
    sheet.className = 'print-sheet handout-sheet hs-' + v.cls;
    sheet.innerHTML = sheetHtml(v);
    return sheet;
  }
  function print(){
    const v = values();
    const sheet = buildSheet();
    closeModal(modal);
    if(typeof openPrintSheets === 'function') openPrintSheets([sheet], 'Печать: ' + v.title);
    else toast('Печать недоступна');
  }

  btn.addEventListener('click', open);
  if(closeBtn) closeBtn.addEventListener('click', ()=> closeModal(modal));
  modal.addEventListener('click', e=>{ if(e.target === modal) closeModal(modal); });
  [title, subtitle, body, footer].forEach(el=>{ if(el) el.addEventListener('input', render); });
  if(template) template.addEventListener('change', ()=> load(template.value));
  if(printBtn) printBtn.addEventListener('click', print);
  load('letter');
})();
