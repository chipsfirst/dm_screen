#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import json, os, sys, importlib.util

# load Russian spell descriptions from sibling module
_dd = os.path.join(os.path.dirname(os.path.abspath(__file__)), '_spell_descs_ru.py')
spec = importlib.util.spec_from_file_location('spelldesc', _dd)
m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
RU_DESC = m.RU_DESC

school_map={'A':'Ограждение','C':'Вызов','D':'Прорицание','E':'Очарование','I':'Иллюзия','N':'Некромантия','V':'Воплощение','T':'Преобразование'}
ity_map={'M':'Простое рукопашное','R':'Простое дальнобойное','A':'Доспех','LA':'Лёгкий доспех','MA':'Средний доспех','HA':'Тяжёлый доспех','S':'Щит','AF':'Фокусировка'}
prop_map={'A':'амфибия','-':'—','F':'фехтовальное','T':'метательное','L':'лёгкое','H':'тяжёлое','R':'дальнобойное','S':'специальное','V':'простое','2H':'двуручное','LD':'область поражения','RE':'перезарядка','BF':'боеприпасы','C':'психич. выстрел'}

ru = {}
# 361 spells translation (2024 PHB)
spells = [
"Acid Splash|Брызги кислоты","Aid|Подмога","Alarm|Сигнал тревоги","Alter Self|Смена обличья","Animal Friendship|Дружба с животными","Animal Messenger|Почтовое животное","Animal Shapes|Превращение в животных","Animate Dead|Оживление мертвецов","Animate Objects|Оживление вещей","Antilife Shell|Преграда жизни","Antimagic Field|Поле антимагии","Antipathy/Sympathy|Антипатия/симпатия","Arcane Eye|Магический глаз","Arcane Gate|Магические врата","Arcane Lock|Волшебный замок","Armor of Agathys|Доспех Агатиса","Arms of Hadar|Руки Хадара","Astral Projection|Проекция в астрал","Augury|Гадание","Aura of Life|Аура жизни","Aura of Purity|Аура очищения","Aura of Vitality|Аура живучести","Awaken|Пробуждение разума","Bane|Порча","Banishing Smite|Изгоняющая кара","Banishment|Изгнание","Barkskin|Дубовая кожа","Beacon of Hope|Маяк надежды","Beast Sense|Животные чувства","Bestow Curse|Проклятие","Bigby's Hand|Длань Бигби","Blade Barrier|Стена клинков","Blade Ward|Защита от оружия","Bless|Благословение","Blight|Усыхание","Blinding Smite|Ослепляющая кара","Blindness/Deafness|Глухота/слепота","Blink|Мерцание","Blur|Размытый образ","Branding Smite|Сияющая кара","Burning Hands|Огненные ладони","Call Lightning|Призыв молнии","Calm Emotions|Умиротворение","Chain Lightning|Цепная молния","Charm Person|Очарование личности","Chill Touch|Леденящее прикосновение","Chromatic Orb|Цветной шарик","Circle of Death|Круг смерти","Circle of Power|Круг силы","Clairvoyance|Подсматривание","Clone|Двойник","Cloud of Daggers|Облако кинжалов","Cloudkill|Облако смерти","Color Spray|Сверкающие брызги","Command|Приказ","Commune|Общение","Commune with Nature|Общение с природой","Compelled Duel|Вызов на дуэль","Comprehend Languages|Понимание языков","Compulsion|Принуждение","Cone of Cold|Конус холода","Confusion|Смятение","Conjure Animals|Вызов животных","Conjure Barrage|Вызов шквала снарядов","Conjure Celestial|Вызов небожителя","Conjure Elemental|Вызов элементаля","Conjure Fey|Вызов феи","Conjure Minor Elementals|Вызов малых элементалей","Conjure Volley|Вызов залпа","Conjure Woodland Beings|Вызов лесных обитателей","Contact Other Plane|Связь с иным планом","Contagion|Заражение","Contingency|Предосторожность","Continual Flame|Вечный огонь","Control Water|Власть над водами","Control Weather|Власть над погодой","Cordon of Arrows|Завеса стрел","Counterspell|Контрзаклинание","Create Food and Water|Сотворение пищи и воды","Create Undead|Сотворение нежити","Create or Destroy Water|Сотворение или уничтожение воды","Creation|Сотворение","Crown of Madness|Корона безумия","Crusader's Mantle|Мантия крестоносца","Cure Wounds|Лечение ран","Dancing Lights|Пляшущие огоньки","Darkness|Тьма","Darkvision|Тёмное зрение","Daylight|Дневной свет","Death Ward|Защита от смерти","Delayed Blast Fireball|Замедленный огненный шар","Demiplane|Демиплан","Destructive Wave|Разрушительная волна","Detect Evil and Good|Обнаружение добра и зла","Detect Magic|Обнаружение магии","Detect Poison and Disease|Обнаружение болезней и яда","Detect Thoughts|Обнаружение мыслей","Dimension Door|Переносящая дверь","Disguise Self|Маскировка","Disintegrate|Распад","Dispel Evil and Good|Рассеивание добра и зла","Dispel Magic|Рассеивание магии","Dissonant Whispers|Диссонирующий шёпот","Divination|Предсказание","Divine Favor|Божественное благоволение","Divine Word|Божественное слово","Dominate Beast|Подчинение зверя","Dominate Monster|Подчинение чудовища","Dominate Person|Подчинение личности","Drawmij's Instant Summons|Дромиджево появление","Dream|Сновидение","Druidcraft|Искусство друидов","Earthquake|Землетрясение","Eldritch Blast|Мистический заряд","Elemental Weapon|Стихийное оружие","Enhance Ability|Улучшение характеристики","Enlarge/Reduce|Увеличение/уменьшение","Ensnaring Strike|Опутывающий удар","Entangle|Опутывание","Enthrall|Речь златоуста","Etherealness|Эфирность","Evard's Black Tentacles|Эвардовы чёрные щупальца","Expeditious Retreat|Поспешное отступление","Eyebite|Разящее око","Fabricate|Изготовление","Faerie Fire|Огонь фей","False Life|Псевдожизнь","Fear|Ужас","Feather Fall|Падение пёрышком","Feeblemind|Замешательство","Feign Death|Притворная смерть","Find Familiar|Поиск фамильяра","Find Steed|Поиск скакуна","Find Traps|Поиск ловушек","Find the Path|Поиск пути","Finger of Death|Перст смерти","Fire Bolt|Огненный снаряд","Fire Shield|Огненный щит","Fire Storm|Огненная буря","Fireball|Огненный шар","Flame Blade|Горящий клинок","Flame Strike|Небесный огонь","Flaming Sphere|Пылающий шар","Flesh to Stone|Окаменение","Fly|Полёт","Fog Cloud|Туманное облако","Forbiddance|Запрет","Forcecage|Силовая клетка","Foresight|Предвидение","Freedom of Movement|Свобода перемещения","Friends|Дружба","Gaseous Form|Газообразная форма","Gate|Врата","Geas|Обет","Gentle Repose|Нетленные останки","Giant Insect|Гигантское насекомое","Glibness|Находчивость","Globe of Invulnerability|Сфера неуязвимости","Glyph of Warding|Охранные руны","Goodberry|Чудо-ягоды","Grasping Vine|Цепкая лоза","Grease|Скольжение","Greater Invisibility|Высшая невидимость","Greater Restoration|Высшее восстановление","Guardian of Faith|Страж веры","Guards and Wards|Стражи","Guidance|Наставление","Guiding Bolt|Направляющий снаряд","Gust of Wind|Порыв ветра","Hail of Thorns|Град шипов","Hallow|Святилище","Hallucinatory Terrain|Мираж","Harm|Поражение","Haste|Ускорение","Heal|Исцеление","Healing Word|Лечащее слово","Heat Metal|Раскалённый металл","Hellish Rebuke|Адское возмездие","Heroes' Feast|Пир героев","Heroism|Героизм","Hex|Сглаз","Hold Monster|Удержание чудовища","Hold Person|Удержание личности","Holy Aura|Аура святости","Hunger of Hadar|Голод Хадара","Hunter's Mark|Метка охотника","Hypnotic Pattern|Гипнотический узор","Ice Storm|Град","Identify|Опознание","Illusory Script|Иллюзорные письмена","Imprisonment|Заточение","Incendiary Cloud|Воспламеняющаяся туча","Inflict Wounds|Нанесение ран","Insect Plague|Нашествие насекомых","Invisibility|Невидимость","Jump|Прыжок","Knock|Стук","Legend Lore|Знание легенд","Leomund's Secret Chest|Леомундов потайной сундук","Leomund's Tiny Hut|Леомундова хижина","Lesser Restoration|Малое восстановление","Levitate|Левитация","Light|Свет","Lightning Arrow|Стрела-молния","Lightning Bolt|Молния","Locate Animals or Plants|Поиск животных или растений","Locate Creature|Поиск существа","Locate Object|Поиск объекта","Longstrider|Скороход","Mage Armor|Доспехи мага","Mage Hand|Волшебная рука","Magic Circle|Магический круг","Magic Jar|Волшебный сосуд","Magic Missile|Волшебная стрела","Magic Mouth|Волшебные уста","Magic Weapon|Магическое оружие","Major Image|Образ","Mass Cure Wounds|Множественное лечение ран","Mass Heal|Множественное исцеление","Mass Healing Word|Множественное лечащее слово","Mass Suggestion|Множественное внушение","Maze|Лабиринт","Meld into Stone|Слияние с камнем","Melf's Acid Arrow|Мельфова кислотная стрела","Mending|Починка","Message|Сообщение","Meteor Swarm|Метеоритный дождь","Mind Blank|Сокрытие разума","Minor Illusion|Малая иллюзия","Mirage Arcane|Таинственный мираж","Mirror Image|Отражения","Mislead|Фальшивый двойник","Misty Step|Туманный шаг","Modify Memory|Изменение памяти","Moonbeam|Лунный луч","Mordenkainen's Faithful Hound|Верный пёс Морденкайнена","Mordenkainen's Magnificent Mansion|Морденкайнена","Mordenkainen's Private Sanctum|Кабинет Морденкайнена","Mordenkainen's Sword|Меч Морденкайнена","Move Earth|Движение почвы","Nondetection|Необнаружимость","Nystul's Magic Aura|Нистулова ложная магия","Otiluke's Freezing Sphere|Отилюков ледяной шар","Otiluke's Resilient Sphere|Отилюков упругий шар","Otto's Irresistible Dance|Неудержимая пляска Отто","Pass Without Trace|Бесследное передвижение","Passwall|Создание прохода","Phantasmal Force|Воображаемая сила","Phantasmal Killer|Воображаемый убийца","Phantom Steed|Призрачный скакун","Planar Ally|Планарный союзник","Planar Binding|Планарные узы","Plane Shift|Уход в иной план","Plant Growth|Рост растений","Poison Spray|Ядовитые брызги","Polymorph|Полиморф","Power Word Heal|Слово силы: исцеление","Power Word Kill|Слово силы: смерть","Power Word Stun|Слово силы: ошеломление","Prayer of Healing|Молебен лечения","Prestidigitation|Фокусы","Prismatic Spray|Радужные брызги","Prismatic Wall|Радужная стена","Produce Flame|Сотворение пламени","Programmed Illusion|Заданная иллюзия","Project Image|Проекция","Protection from Energy|Защита от энергии","Protection from Evil and Good|Защита от зла и добра","Protection from Poison|Защита от яда","Purify Food and Drink|Очищение пищи и питья","Raise Dead|Воскрешение","Rary's Telepathic Bond|Ментальная связь Рэри","Ray of Enfeeblement|Луч слабости","Ray of Frost|Луч холода","Ray of Sickness|Луч болезни","Regenerate|Регенерация","Reincarnate|Реинкарнация","Remove Curse|Снятие проклятья","Resistance|Сопротивление","Resurrection|Высшее воскрешение","Reverse Gravity|Изменение тяготения","Revivify|Низшее воскрешение","Rope Trick|Трюк с верёвкой","Sacred Flame|Священное пламя","Sanctuary|Убежище","Scorching Ray|Палящий луч","Scrying|Наблюдение","Searing Smite|Палящая кара","See Invisibility|Видение невидимого","Seeming|Притворство","Sending|Послание","Sequester|Изоляция","Shapechange|Полное превращение","Shatter|Дребезги","Shield|Щит","Shield of Faith|Щит веры","Shillelagh|Дубинка","Shocking Grasp|Электрошок","Silence|Тишина","Silent Image|Безмолвный образ","Simulacrum|Подобие","Sleep|Усыпление","Sleet Storm|Метель","Slow|Замедление","Spare the Dying|Уход за умирающим","Speak with Animals|Разговор с животными","Speak with Dead|Разговор с мёртвыми","Speak with Plants|Разговор с растениями","Spider Climb|Паук","Spike Growth|Шипастая поросль","Spirit Guardians|Духовные стражи","Spiritual Weapon|Божественное оружие","Staggering Smite|Оглушающая кара","Stinking Cloud|Зловонное облако","Stone Shape|Изменение формы камня","Stoneskin|Каменная кожа","Storm of Vengeance|Гроза гнева","Suggestion|Внушение","Sunbeam|Солнечный луч","Sunburst|Солнечный ожог","Swift Quiver|Быстрый колчан","Symbol|Знак","Tasha's Hideous Laughter|Жуткий смех Таши","Telekinesis|Телекинез","Telepathy|Телепатия","Teleport|Телепортация","Teleportation Circle|Круг телепортации","Tenser's Floating Disk|Тензеров парящий диск","Thaumaturgy|Чудотворство","Thorn Whip|Терновый кнут","Thunderous Smite|Громовая кара","Thunderwave|Волна грома","Time Stop|Остановка времени","Tongues|Языки","Transport via Plants|Путешествие через растения","Tree Stride|Древесный путь","True Polymorph|Истинный полиморф","True Resurrection|Истинное воскрешение","True Seeing|Истинное зрение","True Strike|Меткий удар","Tsunami|Цунами","Unseen Servant|Невидимый слуга","Vampiric Touch|Прикосновение вампира","Vicious Mockery|Злая насмешка","Wall of Fire|Стена огня","Wall of Force|Стена силы","Wall of Ice|Стена льда","Wall of Stone|Стена камня","Wall of Thorns|Стена шипов","Warding Bond|Охраняющая связь","Water Breathing|Подводное дыхание","Water Walk|Хождение по воде","Web|Паутина","Weird|Жуть","Wind Walk|Хождение по ветру","Wind Wall|Стена ветра","Wish|Желание","Witch Bolt|Ведьмин снаряд","Word of Recall|Слово возврата","Wrathful Smite|Гневная кара","Zone of Truth|Область истины",
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
open('/Users/vladimirkartashov/Documents/MultiTool/HomeChats/Chat-4/shirma-app/js/data/library-data.js','w',encoding='utf-8').write(js)
print("written library-data.js")
import os
print("bytes:", os.path.getsize('/Users/vladimirkartashov/Documents/MultiTool/HomeChats/Chat-4/shirma-app/js/data/library-data.js'))
print("spells:", len(srows), "items:", len(irows))
print("sample spell:", json.dumps(srows[0],ensure_ascii=False))
print("sample item:", json.dumps(irows[0],ensure_ascii=False))