#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, os, sys, importlib.util

# load Russian spell descriptions from sibling module
_dd = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_spell_descs_ru.py')
spec = importlib.util.spec_from_file_location('spelldesc', _dd)
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
RU_DESC = m.RU_DESC

school_map={'A':'Ограждение','C':'Вызов','D':'Прорицание','E':'Очарование','I':'Иллюзия','N':'Некромантия','V':'Преображение','T':'Приказ'}
ity_map={'M':'Простое рукопашное','R':'Простое дальнобойное','A':'Доспех','LA':'Лёгкий доспех','MA':'Средний доспех','HA':'Тяжёлый доспех','S':'Щит','AF':'Фокусировка'}
prop_map={'A':'амфибия','-':'—','F':'фехтовальное','T':'метательное','L':'лёгкое','H':'тяжёлое','R':'дальнобойное','S':'специальное','V':'простое','2H':'двуручное','LD':'область поражения','RE':'перезарядка','BF':'боеприпасы','C':'психич. выстрел'}

ru = {}
# 361 spells translation (2024 PHB)
spells = [
"Acid Splash|Кислотные брызги","Aid|Поддержка","Alarm|Сигнал тревоги","Alter Self|Изменение себя","Animal Friendship|Дружба с животными","Animal Messenger|Гонец-зверь","Animal Shapes|Облики животных","Animate Dead|Оживление мёртвых","Animate Objects|Оживление предметов","Antilife Shell|Оболочка антижизни","Antimagic Field|Поле антимагии","Antipathy/Sympathy|Антипатия/Симпатия","Arcane Eye|Мистическое око","Arcane Gate|Мистические врата","Arcane Lock|Мистический замок","Armor of Agathys|Доспехи Агатис","Arms of Hadar|Руки Хадара","Astral Projection|Астральная проекция","Augury|Предсказание","Aura of Life|Аура жизни","Aura of Purity|Аура чистоты","Aura of Vitality|Аура жизненности","Awaken|Пробуждение","Bane|Угроза","Banishing Smite|Изгоняющий удар","Banishment|Изгнание","Barkskin|Дубовая кора","Beacon of Hope|Луч надежды","Beast Sense|Чувства зверя","Bestow Curse|Наложение проклятия","Bigby's Hand|Рука Бигби","Blade Barrier|Клинковый барьер","Blade Ward|Защита клинка","Bless|Благословение","Blight|Увядание","Blinding Smite|Ослепляющий удар","Blindness/Deafness|Слепота/Глухота","Blink|Пульсация","Blur|Размытость","Branding Smite|Клеймящий удар","Burning Hands|Пылающие ладони","Call Lightning|Призыв молнии","Calm Emotions|Умиротворение чувств","Chain Lightning|Цепная молния","Charm Person|Очарование личности","Chill Touch|Ангельское касание","Chromatic Orb|Хроматическая сфера","Circle of Death|Круг смерти","Circle of Power|Круг силы","Clairvoyance|Ясновидение","Clone|Клон","Cloud of Daggers|Облако кинжалов","Cloudkill|Облако смерти","Color Spray|Цветовой спрей","Command|Приказ","Commune|Общение с богом","Commune with Nature|Общение с природой","Compelled Duel|Вызванная дуэль","Comprehend Languages|Понимание языков","Compulsion|Принуждение","Cone of Cold|Конус холода","Confusion|Замешательство","Conjure Animals|Призыв животных","Conjure Barrage|Призыв заграждения","Conjure Celestial|Призыв небожителя","Conjure Elemental|Призыв элькомeнталя","Conjure Fey|Призыв фей","Conjure Minor Elementals|Призыв малых элементалей","Conjure Volley|Призыв залпа","Conjure Woodland Beings|Призыв лесных существ","Contact Other Plane|Контакт с другим планом","Contagion|Заражение","Contingency|Чрезвычайная защита","Continual Flame|Вечное пламя","Control Water|Управление водой","Control Weather|Управление погодой","Cordon of Arrows|Заградительные стрелы","Counterspell|Контрзаклинание","Create Food and Water|Создание еды и воды","Create Undead|Создание нежити","Create or Destroy Water|Создание или уничтожение воды","Creation|Сотворение","Crown of Madness|Корона безумия","Crusader's Mantle|Плащ крестоносца","Cure Wounds|Исцеление ран","Dancing Lights|Танцующие огни","Darkness|Тьма","Darkvision|Тёмное зрение","Daylight|Дневной свет","Death Ward|Защита от смерти","Delayed Blast Fireball|Отложенный огненный шар","Demiplane|Полуплоскость","Destructive Wave|Разрушительная волна","Detect Evil and Good|Обнаружение добра и зла","Detect Magic|Обнаружение магии","Detect Poison and Disease|Обнаружение яда и болезней","Detect Thoughts|Обнаружение мыслей","Dimension Door|Планарные врата","Disguise Self|Маскировка","Disintegrate|Дезинтеграция","Dispel Evil and Good|Развеяние добра и зла","Dispel Magic|Развеяние магии","Dissonant Whispers|Диссонирующий шёпот","Divination|Гадание","Divine Favor|Божественное благоволение","Divine Word|Божественное слово","Dominate Beast|Подчинение зверя","Dominate Monster|Подчинение монстра","Dominate Person|Подчинение личности","Drawmij's Instant Summons|Мгновенный призыв Дравмиджа","Dream|Сон","Druidcraft|Ремесло друида","Earthquake|Землетрясение","Eldritch Blast|Выброс эльдрического удара","Elemental Weapon|Элементальное оружие","Enhance Ability|Усиление способности","Enlarge/Reduce|Увеличение/Уменьшение","Ensnaring Strike|Опутывающий удар","Entangle|Опутывание","Enthrall|Очарование толпы","Etherealness|Бесплотность","Evard's Black Tentacles|Чёрные щупальца Эварда","Expeditious Retreat|Стремительный отход","Eyebite|Взгляд","Fabricate|Создание","Faerie Fire|Фейское пламя","False Life|Ложная жизнь","Fear|Страх","Feather Fall|Падение перышка","Feeblemind|Безумие изумления","Feign Death|Притворная смерть","Find Familiar|Поиск фамильярa","Find Steed|Поиск скакуна","Find Traps|Поиск ловушек","Find the Path|Поиск пути","Finger of Death|Палец смерти","Fire Bolt|Огненный снаряд","Fire Shield|Огненный щит","Fire Storm|Огненный шторм","Fireball|Огненный шар","Flame Blade|Огненный клинок","Flame Strike|Удар пламени","Flaming Sphere|Пылающая сфера","Flesh to Stone|Превращение в камень","Fly|Полёт","Fog Cloud|Облако тумана","Forbiddance|Запрет","Forcecage|Силовая клетка","Foresight|Предвидение","Freedom of Movement|Свобода движения","Friends|Друзья","Gaseous Form|Газообразная форма","Gate|Врата","Geas|Геас","Gentle Repose|Лёгкий покой","Giant Insect|Гигантское насекомое","Glibness|Убедительность","Globe of Invulnerability|Сфера неуязвимости","Glyph of Warding|Глиф предупреждения","Goodberry|Добрая ягода","Grasping Vine|Цепкая лоза","Grease|Смазка","Greater Invisibility|Великая невидимость","Greater Restoration|Великое восстановление","Guardian of Faith|Страж веры","Guards and Wards|Охрана и защита","Guidance|Напутствие","Guiding Bolt|Направляющий луч","Gust of Wind|Порыв ветра","Hail of Thorns|Град шипов","Hallow|Освящение","Hallucinatory Terrain|Иллюзорная местность","Harm|Вред","Haste|Спешка","Heal|Исцеление","Healing Word|Исцеляющее слово","Heat Metal|Нагрев металла","Hellish Rebuke|Адское противодействие","Heroes' Feast|Пир героев","Heroism|Героизм","Hex|Порча","Hold Monster|Удержание монстра","Hold Person|Удержание личности","Holy Aura|Святая аура","Hunger of Hadar|Голод Хадара","Hunter's Mark|Метка охотника","Hypnotic Pattern|Гипнотический узор","Ice Storm|Ледяной шторм","Identify|Опознание","Illusory Script|Иллюзорный текст","Imprisonment|Заточение","Incendiary Cloud|Зажигательное облако","Inflict Wounds|Нанесение ран","Insect Plague|Нашествие насекомых","Invisibility|Невидимость","Jump|Прыжок","Knock|Открывание","Legend Lore|Легенды","Leomund's Secret Chest|Тайный сундук Леомунда","Leomund's Tiny Hut|Малая хижина Леомунда","Lesser Restoration|Малое восстановление","Levitate|Левитация","Light|Свет","Lightning Arrow|Громовая стрела","Lightning Bolt|Молния","Locate Animals or Plants|Поиск животных или растений","Locate Creature|Поиск существа","Locate Object|Поиск предмета","Longstrider|Длинный шаг","Mage Armor|Доспехи мага","Mage Hand|Рука мага","Magic Circle|Магический круг","Magic Jar|Магический сосуд","Magic Missile|Магическая стрела","Magic Mouth|Волшебный рот","Magic Weapon|Магическое оружие","Major Image|Большой образ","Mass Cure Wounds|Массовое исцеление ран","Mass Heal|Массовое исцеление","Mass Healing Word|Массовое исцеляющее слово","Mass Suggestion|Массовое внушение","Maze|Лабиринт","Meld into Stone|Слияние с камнем","Melf's Acid Arrow|Кислотная стрела Мельфа","Mending|Починка","Message|Сообщение","Meteor Swarm|Метеоритный дождь","Mind Blank|Пустота разума","Minor Illusion|Малая иллюзия","Mirage Arcane|Мираж","Mirror Image|Зеркальные образы","Mislead|Введение в заблуждение","Misty Step|Туманный шаг","Modify Memory|Изменение памяти","Moonbeam|Лунный луч","Mordenkainen's Faithful Hound|Верный пёс Морденкайнена","Mordenkainen's Magnificent Mansion|Великолепный особняк Морденкайнена","Mordenkainen's Private Sanctum|Личный священный храм Морденкайнена","Mordenkainen's Sword|Меч Морденкайнена","Move Earth|Движение земли","Nondetection|Защита от обнаружения","Nystul's Magic Aura|Магическая аура Нистула","Otiluke's Freezing Sphere|Замораживающая сфера Отилюка","Otiluke's Resilient Sphere|Прочная сфера Отилюка","Otto's Irresistible Dance|Неотразимый танец Отто","Pass Without Trace|Бесшумное прохождение","Passwall|Проход сквозь стену","Phantasmal Force|Фантазматическая сила","Phantasmal Killer|Фантазматический убийца","Phantom Steed|Призрачный скакун","Planar Ally|Планарное союзничество","Planar Binding|Планарное связывание","Plane Shift|Плановая смена мира","Plant Growth|Рост растений","Poison Spray|Ядовитый спрей","Polymorph|Изменение облика","Power Word Heal|Исцеляющее слово власти","Power Word Kill|Убивающее слово власти","Power Word Stun|Оглушающее слово власти","Prayer of Healing|Молитва исцеления","Prestidigitation|Фокус","Prismatic Spray|Призматический спрей","Prismatic Wall|Призматическая стена","Produce Flame|Сотворение пламени","Programmed Illusion|Запрограммированная иллюзия","Project Image|Проекция образа","Protection from Energy|Защита от энергии","Protection from Evil and Good|Защита от добра и зла","Protection from Poison|Защита от яда","Purify Food and Drink|Очищение еды и напитков","Raise Dead|Воскрешение","Rary's Telepathic Bond|Телепатическая связь Рэри","Ray of Enfeeblement|Луч ослабления","Ray of Frost|Луч холода","Ray of Sickness|Луч болезни","Regenerate|Регенерация","Reincarnate|Реинкарнация","Remove Curse|Снятие проклятия","Resistance|Сопротивление","Resurrection|Воскрешение из мёртвых","Reverse Gravity|Обратная гравитация","Revivify|Возрождение","Rope Trick|Фокус с верёвкой","Sacred Flame|Священное пламя","Sanctuary|Святилище","Scorching Ray|Обжигающий луч","Scrying|Ясновидение (наблюдение)","Searing Smite|Палящий удар","See Invisibility|Видение невидимого","Seeming|Иллюзия внешности","Sending|Послание","Sequester|Уединение","Shapechange|Смена облика","Shatter|Раскат","Shield|Щит","Shield of Faith|Щит веры","Shillelagh|Шиллия","Shocking Grasp|Поражающий захват","Silence|Тишина","Silent Image|Бесшумный образ","Simulacrum|Симулакр","Sleep|Сон","Sleet Storm|Ледяной шторм (град)","Slow|Замедление","Spare the Dying|Отсрочка смерти","Speak with Animals|Разговор с животными","Speak with Dead|Разговор с мёртвыми","Speak with Plants|Разговор с растениями","Spider Climb|Паучье лазание","Spike Growth|Рост шипов","Spirit Guardians|Духи-стражи","Spiritual Weapon|Духовное оружие","Staggering Smite|Ошеломляющий удар","Stinking Cloud|Вонючее облако","Stone Shape|Формовка камня","Stoneskin|Каменная кожа","Storm of Vengeance|Буря мщения","Suggestion|Внушение","Sunbeam|Солнечный луч","Sunburst|Солнечный взрыв","Swift Quiver|Быстрый колчан","Symbol|Символ","Tasha's Hideous Laughter|Жуткий смех Таши","Telekinesis|Телекинез","Telepathy|Телепатия","Teleport|Телепортация","Teleportation Circle|Круг телепортации","Tenser's Floating Disk|Парящий диск Тенсера","Thaumaturgy|Чудотворство","Thorn Whip|Колючий хлыст","Thunderous Smite|Громовой удар","Thunderwave|Волна грома","Time Stop|Остановка времени","Tongues|Языки","Transport via Plants|Перемещение через растения","Tree Stride|Шаг дерева","True Polymorph|Истинное превращение","True Resurrection|Истинное воскрешение","True Seeing|Истинное зрение","True Strike|Верный удар","Tsunami|Цунами","Unseen Servant|Невидимый слуга","Vampiric Touch|Вампирическое касание","Vicious Mockery|Язвительная насмешка","Wall of Fire|Стена огня","Wall of Force|Стена силы","Wall of Ice|Стена льда","Wall of Stone|Стена камня","Wall of Thorns|Стена шипов","Warding Bond|Охраняющий союз","Water Breathing|Дыхание под водой","Water Walk|Хождение по воде","Web|Паутина","Weird|Жуть","Wind Walk|Ходьба по ветру","Wind Wall|Стена ветра","Wish|Желание","Witch Bolt|Ведьмин разряд","Word of Recall|Слово возвращения","Wrathful Smite|Гневный удар","Zone of Truth|Зона истины",
]
for line in spells:
    if '|' in line:
        en, rn = line.split('|',1)
        ru[en.strip()] = rn.strip()

def tr(name):
    return ru.get(name, name)

def time_str(t):
    if not t: return ''
    t=t[0]
    if isinstance(t.get('unit'),list):
        return t['unit'][1] if len(t['unit'])>1 and isinstance(t['unit'][1],str) else '—'
    n=t.get('number',1); u=t.get('unit','')
    unit_ru={'action':'действие','bonus':'бонус. действие','reaction':'реакция','minute':'мин','hour':'час','day':'день','free':'своб. действие'}
    return f"{n} {unit_ru.get(u,u)}"

def range_str(r):
    if not r: return ''
    ty=r.get('type')
    if ty=='point':
        d=r.get('distance',{})
        amt=d.get('amount'); u=d.get('type')
        if u=='self': return 'Сам'
        if isinstance(u,list):
            return 'сам' if u and u[0]=='self' else (u[1] if len(u)>1 else '—')
        if amt is None: return str(u)
        return f"{amt} {u}"
    if ty=='self':
        d=r.get('distance',{})
        if isinstance(d.get('type'),str) and d['type']=='self': return 'Сам'
        return 'Сам'
    if ty=='radius': return f"Сфер. {r.get('distance',{}).get('amount','')}"
    if ty=='cone': return 'Конус'
    if ty=='line': return 'Линия'
    if ty=='special': return 'Особ.'
    if ty=='unlimited': return 'Без границ'
    if ty=='touch': return 'Касание'
    return ty

def dur_str(d):
    if not d: return ''
    d=d[0]
    if 'unit' in d:
        if d.get('unit')=='instant': return 'Мгновенно'
        umap={'instant':'Мгновенно','round':'раунд','minute':'мин','hour':'час','day':'день','year':'год','perm':'постоянно'}
        if isinstance(d['unit'],list):
            return d['unit'][1] if len(d['unit'])>1 and isinstance(d['unit'][1],str) else '—'
        return f"{d.get('number',1)} {umap.get(d['unit'],d['unit'])}"
    if 'type' in d:
        return {'instant':'Мгновенно','timed':'по времени','permanent':'Постоянно','special':'Особ.'}.get(d['type'],d['type'])
    return '—'

def classes_str(c):
    if not c: return ''
    if 'fromClassList' in c:
        clmap={'Bard':'Бард','Cleric':'Жрец','Druid':'Друид','Sorcerer':'Чародей','Warlock':'Колдун',
               'Wizard':'Волшебник','Paladin':'Паладин','Ranger':'Следопыт','Fighter':'Воин','Rogue':'Плут',
               'Monk':'Монах','Barbarian':'Варвар','Artificer':'Изобретатель'}
        return ', '.join(clmap.get(x['name'],x['name']) for x in c['fromClassList'])
    return ''

sp=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'data','spells-phb2024.json')))['spell']
srows=[]
for s in sp:
    lvl=s.get('level',0)
    en=s.get('name','')
    srows.append({
        'n':tr(en), 'l':lvl,
        'sc':school_map.get(s.get('school',''),s.get('school','')),
        't':time_str(s.get('time')), 'r':range_str(s.get('range')),
        'c':'ритуал' if s.get('ritual') else ('конц.' if s.get('concentration') else ''),
        'd':dur_str(s.get('duration')),
        'cls':classes_str(s.get('classes')),
        'desc':RU_DESC.get(en,''),
    })

it=json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)),'data','basic-items2024.json')))['basicitem']
def prop_ru(p):
    if not p: return ''
    return ', '.join(prop_map.get(x,x) for x in p)

# Russian names for PHB items
item_ru = {
"Battleaxe":"Боевой топор","Blowgun":"Духовая трубка","Club":"Дубинка","Dagger":"Кинжал",
"Flail":"Цеп","Glaive":"Глефа","Greataxe":"Секира","Greatclub":"Палица","Greatsword":"Двуручный меч",
"Halberd":"Алебарда","Handaxe":"Ручной топор","Javelin":"Метательное копьё","Lance":"Кавалерийское копьё",
"Light Hammer":"Лёгкий молот","Longsword":"Длинный меч","Mace":"Булава","Maul":"Молот",
"Morningstar":"Моргенштерн","Net":"Сеть","Pike":"Пика","Quarterstaff":"Боевой посох","Rapier":"Рапира",
"Scimitar":"Скимитар","Shortsword":"Короткий меч","Sickle":"Серп","Spear":"Копьё","Trident":"Трезубец",
"War Pick":"Боевая кирка","Warhammer":"Боевой молот","Whip":"Кнут","Yklwa":"Иклва",
"Shortbow":"Короткий лук","Sling":"Праща","Dart":"Дротик","Light Crossbow":"Лёгкий арбалет",
"Longbow":"Длинный лук","Hand Crossbow":"Ручной арбалет","Heavy Crossbow":"Тяжёлый арбалет",
"Arrow":"Стрела","Arrows (20)":"Стрелы (20 шт.)","Crossbow Bolt":"Арбалетный болт","Crossbow Bolts (20)":"Болты (20 шт.)",
"Sling Bullet":"Пращевой снаряд","Sling Bullets (20)":"Пращевые снаряды (20 шт.)","Blowgun Needle":"Игла для духовой трубки","Blowgun Needles (50)":"Иглы (50 шт.)",
"Leather Armor":"Кожаный доспех","Padded Armor":"Стёганый доспех","Studded Leather Armor":"Клёпаная кожа",
"Breastplate":"Кираса","Chain Shirt":"Кольчужная рубаха","Half Plate Armor":"Полулаты","Hide Armor":"Шкурный доспех","Scale Mail":"Чешуйчатый доспех",
"Chain Mail":"Кольчуга","Plate Armor":"Латы","Ring Mail":"Кольчатый доспех","Splint Armor":"Наборный доспех",
"Shield":"Щит",
}
itru=lambda n: item_ru.get(n,n)
irows=[]
for i in it:
    if i.get('source')!='PHB': continue
    irows.append({
        'n':itru(i.get('name','')), 't':ity_map.get(i.get('type'),i.get('type','')),
        'v':i.get('value','') if i.get('value') else '',
        'w':(i.get('weight')+' ф.') if i.get('weight') else '',
        'd1':i.get('dmg1',''), 'd2':i.get('dmg2',''),
        'dt':{'S':'руб.','P':'колющее','B':'дробящее','N':'электро'}.get(i.get('dmgType',''),i.get('dmgType','')),
        'p':prop_ru(i.get('property',[])),
    })

os.makedirs('/Users/vladimirkartashov/Documents/MultiTool/HomeChats/Chat-4/shirma-app', exist_ok=True)
# Build JS file exposing global LIBRARY
js = "// Локальная библиотека D&D 5.5 (2024) — заклинания и снаряжение PHB. Русская локализация.\n"
js += "window.LIBRARY = " + json.dumps({'spells':srows,'items':irows}, ensure_ascii=False) + ";\n"
open('/Users/vladimirkartashov/Documents/MultiTool/HomeChats/Chat-4/shirma-app/library-data.js','w',encoding='utf-8').write(js)
print("written library-data.js")
import os
print("bytes:", os.path.getsize('/Users/vladimirkartashov/Documents/MultiTool/HomeChats/Chat-4/shirma-app/library-data.js'))
print("spells:", len(srows), "items:", len(irows))
print("sample spell:", json.dumps(srows[0],ensure_ascii=False))
print("sample item:", json.dumps(irows[0],ensure_ascii=False))