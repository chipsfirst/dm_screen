#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборщик компактного бестиария D&D 5e 2024 из monsters2024.json."""
import json, os, re

def abil_str(a):
    """Краткая строка характеристик."""
    M = ('Сил','Лов','Тел','Инт','Муд','Хар')
    out=[]
    for k,i in zip(('Str','Dex','Con','Int','Wis','Cha'), range(6)):
        v=a.get(k,{}).get('score',10)
        mod=(v-10)//2
        out.append(f"{M[i]} {v} ({mod:+})")
    return ', '.join(out)

def strip_tags(s):
    if not s: return ''
    s = re.sub(r'<[^>]+>', '', s)
    # remove {@dice 1d6} style
    s = re.sub(r'\{@[^}]+\}', '', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s

def actions_list(x):
    """Собрать список действий/реакций/черт из item-like структур."""
    if not x: return []
    if isinstance(x, dict):
        items = x.get('items') or []
        return [strip_tags(i) for i in items if strip_tags(i)]
    return []

def tr_name(name, mon_map):
    return mon_map.get(name, name)

def build(src, outpath, mon_map):
    data=json.load(open(src))
    rows=[]
    for m in data:
        abilities=m.get('abilities',{})
        # построим поля
        row={
            'id': len(rows),
            'n': tr_name(m.get('name',''), mon_map),
            'en': m.get('name',''),
            'type': str(m.get('type',''))[:60],
            'cr': str(m.get('CR',''))[:12],
            'ac': str(m.get('AC',''))[:12],
            'hp': str(m.get('HP',''))[:20],
            'sp': str(m.get('Speed',''))[:40],
            'init': str(m.get('initiative',''))[:12],
            'ab': abil_str(abilities),
            'sk': str(m.get('skills',''))[:80],
            'sen': str(m.get('senses',''))[:50],
            'lang': str(m.get('languages',''))[:60],
            'img': m.get('image_src','') if m.get('image_src') else '',
        }
        # structured abilities
        ABORDER=['Str','Dex','Con','Int','Wis','Cha']
        ab_list=[]
        for k in ABORDER:
            a=abilities.get(k,{})
            sc=int(a.get('score',10))
            mod=(sc-10)//2
            ab_list.append({'k':k,'v':sc,'m':mod,'s':a.get('save')})
        def cat_acts(name,src):
            out=[]
            for b in actions_list(src):
                out.append({'tag':name,'text':b})
            return out
        acts=[]
        acts+=cat_acts('Действия', m.get('actions'))
        acts+=cat_acts('Бонус', m.get('bonus_actions'))
        acts+=cat_acts('Реакция', m.get('reactions'))
        acts+=cat_acts('Черты', m.get('traits'))
        acts+=cat_acts('Легендарные', m.get('legendary_actions'))
        row['ab_list']=ab_list
        row['acts']=acts[:50]
        rows.append(row)
    js = "// Компактный бестиарий D&D 5e (2024) — 510 монстров. Русские названия.\n"
    js += "window.BESTIARY = " + json.dumps(rows, ensure_ascii=False) + ";\n"
    open(outpath,'w',encoding='utf-8').write(js)
    print("written", outpath, os.path.getsize(outpath), "bytes, monsters:", len(rows))

# Русские названия монстров (наиболее частые; остальные оставим англ.)
MON = {
"Aarakocra":"Ааракокра","Ape":"Обезьяна","Adult Black Dragon":"Взрослый чёрный дракон","Adult Blue Dragon":"Взрослый синий дракон",
"Adult Brass Dragon":"Взрослый латунный дракон","Adult Bronze Dragon":"Взрослый бронзовый дракон","Adult Copper Dragon":"Взрослый медный дракон",
"Adult Gold Dragon":"Взрослый золотой дракон","Adult Green Dragon":"Взрослый зелёный дракон","Adult Red Dragon":"Взрослый красный дракон",
"Adult Silver Dragon":"Взрослый серебряный дракон","Adult White Dragon":"Взрослый белый дракон","Air Elemental":"Элементаль воздуха",
"Allosaurus":"Аллозавр","Ancient Black Dragon":"Древний чёрный дракон","Ancient Blue Dragon":"Древний синий дракон",
"Ancient Brass Dragon":"Древний латунный дракон","Ancient Bronze Dragon":"Древний бронзовый дракон","Ancient Copper Dragon":"Древний медный дракон",
"Ancient Gold Dragon":"Древний золотой дракон","Ancient Green Dragon":"Древний зелёный дракон","Ancient Red Dragon":"Древний красный дракон",
"Ancient Silver Dragon":"Древний серебряный дракон","Ancient White Dragon":"Древний белый дракон","Animated Armor":"Ожившие доспехи",
"Animated Broom":"Ожившая метла","Animated Flying Sword":"Оживший летающий меч","Animated Rug of Smothering":"Оживший удушающий ковёр",
"Ankheg":"Анкег","Ankylosaurus":"Анкилозавр","Arcanaloth":"Арканалот","Archmage":"Архимаг","Archpriest":"Верховный жрец","Assassin":"Убийца",
"Awakened Shrub":"Пробуждённый куст","Awakened Tree":"Пробуждённое дерево","Axe Beak":"Топоронос","Baboon":"Бабуин","Badger":"Барсук","Balor":"Балор",
"Bandit":"Разбойник","Bandit Captain":"Атаман разбойников","Banshee":"Баньши","Basilisk":"Василиск","Bat":"Летучая мышь","Bearded Devil":"Бородатый дьявол",
"Behir":"Бехир","Beholder":"Созерцатель","Beholder Zombie":"Зомби созерцателя","Berserker":"Берсерк","Black Bear":"Чёрный медведь",
"Black Dragon Wyrmling":"Дракончик чёрного дракона","Black Pudding":"Чёрная слизь","Blink Dog":"Мерцающая собака","Blood Hawk":"Кровавый ястреб",
"Blue Dragon Wyrmling":"Дракончик синего дракона","Blue Slaad":"Синий слаад","Boar":"Кабан","Bone Devil":"Костяной дьявол","Brass Dragon Wyrmling":"Дракончик латунного дракона",
"Bronze Dragon Wyrmling":"Дракончик бронзового дракона","Brown Bear":"Бурый медведь","Bulette":"Бульт","Camel":"Верблюд","Carrion Crawler":"Падальный ползун",
"Cat":"Кошка","Centaur":"Кентавр","Chain Devil":"Цепной дьявол","Chimera":"Химера","Chuul":"Чуул","Clay Golem":"Глиняный голем","Cloaker":"Плащевик",
"Cloud Giant":"Гигант облаков","Cockatrice":"Василиск-петух","Commoner":"Простолюдин","Constrictor Snake":"Удав","Copper Dragon Wyrmling":"Дракончик медного дракона",
"Couatl":"Коатль","Crab":"Краб","Crawling Claw":"Ползучая клешня","Crocodile":"Крокодил","Cultist":"Культист","Cultist Fanatic":"Фанатик-культист",
"Dao":"Дао","Darkmantle":"Тьмоед","Death Dog":"Смертоносный пёс","Death Knight":"Рыцарь смерти","Deer":"Олень","Demilich":"Демилич","Deva":"Дева",
"Dire Wolf":"Ужасный волк","Displacer Beast":"Сместитель","Djinni":"Джинн","Doppelganger":"Двойник","Dracolich":"Драко-лич","Draft Horse":"Ломовая лошадь",
"Dragon Turtle":"Драконья черепаха","Dretch":"Дретч","Drider":"Дридер","Druid":"Друид","Dryad":"Дриада","Dust Mephit":"Пыльной мефит","Eagle":"Орёл",
"Earth Elemental":"Элементаль земли","Efreeti":"Ифриты","Elephant":"Слон","Elk":"Лось","Empyrean":"Эмпирей","Erinyes":"Эриния","Ettercap":"Этттеркап","Ettin":"Эттин",
"Faerie Dragon":"Фейский дракон","Fire Elemental":"Элементаль огня","Fire Giant":"Гигант огня","Flameskull":"Огненный череп","Flesh Golem":"Плоть-голем",
"Flumph":"Фламф","Flying Snake":"Летающая змея","Fomorian":"Фомор","Frog":"Лягушка","Frost Giant":"Ледяной гигант","Galeb Duhr":"Галеб дух","Gargoyle":"Горгулья",
"Gelatinous Cube":"Желеобразный куб","Ghast":"Мерзость","Ghost":"Призрак","Ghoul":"Гуль","Giant Ape":"Гигантская обезьяна","Giant Badger":"Гигантский барсук",
"Giant Bat":"Гигантская летучая мышь","Giant Boar":"Гигантский кабан","Giant Centipede":"Гигантская многоножка","Giant Crab":"Гигантский краб",
"Giant Crocodile":"Гигантский крокодил","Giant Eagle":"Гигантский орёл","Giant Elk":"Гигантский лось","Giant Fire Beetle":"Гигантский жук-светляк",
"Giant Frog":"Гигантская лягушка","Giant Goat":"Гигантский козёл","Giant Hyena":"Гигантская гиена","Giant Lizard":"Гигантская ящерица",
"Giant Octopus":"Гигантский осьминог","Giant Owl":"Гигантская сова","Giant Rat":"Гигантская крыса","Giant Scorpion":"Гигантский скорпион",
"Giant Seahorse":"Гигантский морской конёк","Giant Shark":"Гигантская акула","Giant Spider":"Гигантский паук","Giant Squid":"Гигантский кальмар",
"Giant Toad":"Гигантская жаба","Giant Venomous Snake":"Гигантская ядовитая змея","Giant Vulture":"Гигантский стервятник","Giant Wasp":"Гигантская оса",
"Giant Weasel":"Гигантский хорёк","Giant Wolf Spider":"Гигантский паук-волк","Gibbering Mouther":"Бормочущий рот","Glabrezu":"Глабрезу","Gladiator":"Гладиатор",
"Gnoll":"Гнолл","Goat":"Козёл","Goblin":"Гоблин","Goblin Boss":"Гоблин-вожак","Goblin Warrior":"Гоблин-воин","Gold Dragon Wyrmling":"Дракончик золотого дракона",
"Gorgon":"Горгон","Gray Ooze":"Серая слизь","Green Dragon Wyrmling":"Дракончик зелёного дракона","Green Hag":"Зелёная ведьма","Grell":"Грелл","Grick":"Грик",
"Griffon":"Грифон","Grimlock":"Гримлок","Guard":"Стражник","Guardian Naga":"Нага-страж","Hell Hound":"Адская гончая","Helmed Horror":"Шлемный ужас","Hill Giant":"Холмовой гигант",
"Hippogriff":"Гиппогриф","Hobgoblin":"Хобгоблин","Homunculus":"Гомункул","Hook Horror":"Крюкоголос труд","Horned Devil":"Рогатый дьявол","Hunter Shark":"Акула-охотник",
"Hydra":"Гидра","Hyena":"Гиена","Ice Devil":"Ледяной дьявол","Ice Mephit":"Ледяной мефит","Imp":"Бес","Incubus":"Инкуб","Intellect Devourer":"Пожиратель разума",
"Invisible Stalker":"Невидимый преследователь","Iron Golem":"Железный голем","Jackal":"Шакал","Kenku":"Кенку","Killer Whale":"Косатка","Knight":"Рыцарь",
"Kobold":"Кобольд","Kraken":"Кракен","Kuo-toa":"Куо-тоа","Lamia":"Ламия","Lemure":"Лемур","Lich":"Лич","Lion":"Лев","Lizard":"Ящерица","Lizardfolk":"Ящеролюд",
"Mage":"Маг","Mage Apprentice":"Ученик мага","Magma Mephit":"Магмовый мефит","Magmin":"Магма","Mammoth":"Мамонт","Manticore":"Мантикора","Marid":"Марид",
"Marilith":"Марилит","Mastiff":"Мастиф","Medusa":"Медуза","Merfolk":"Тритон","Merrow":"Мерроу","Mimic":"Мимик","Mind Flayer":"Пожиратель разума (Иллитид)",
"Minotaur":"Минотавр","Mud Mephit":"Грязевой мефит","Mule":"Мул","Mummy":"Мумия","Mummy Lord":"Повелитель мумий","Myconid":"Миконид","Nalfeshnee":"Налфешни",
"Needle Blight":"Игольный язв","Night Hag":"Ночная ведьма","Nightmare":"Кошмар","Noble":"Дворянин","Nothic":"Нотик","Ochre Jelly":"Охровая слизь","Octopus":"Осьминог",
"Ogre":"Огр","Ogre Zombie":"Огр-зомби","Oni":"Они","Otyugh":"Отиуг","Owl":"Сова","Owlbear":"Совомед","Panther":"Пантера","Pegasus":"Пегас","Peryton":"Перитон",
"Phase Spider":"Фазовый паук","Pit Fiend":"Ямный дьявол","Pixie":"Пикси","Planetar":"Планетар","Plesiosaurus":"Плезиозавр","Polar Bear":"Белый медведь",
"Poltergeist":"Полтергейст","Pony":"Пони","Priest":"Жрец","Pseudodragon":"Лжедракон","Pteranodon":"Птеранодон","Purple Worm":"Пурпурный червь","Quaggoth":"Куаггот",
"Quasit":"Квазит","Rakshasa":"Ракшасы","Rat":"Крыса","Raven":"Ворон","Red Dragon Wyrmling":"Дракончик красного дракона","Reef Shark":"Рифовая акула",
"Remorhaz":"Ремораз","Revenant":"Мститель","Rhinoceros":"Носорог","Riding Horse":"Верховая лошадь","Roc":"Рок","Roper":"Роуп","Rust Monster":"Ржавый монстр",
"Saber-Toothed Tiger":"Саблезубый тигр","Sahuagin":"Сагуагин","Salamander":"Саламандра","Satyr":"Сатир","Scarecrow":"Пугало","Scorpion":"Скорпион","Scout":"Разведчик",
"Sea Hag":"Морская ведьма","Seahorse":"Морской конёк","Shadow":"Тень","Shadow Demon":"Демон тени","Shadow Dragon":"Дракон тени","Shambling Mound":"Шамблер-курган",
"Shield Guardian":"Щитовой страж","Silver Dragon Wyrmling":"Дракончик серебряного дракона","Skeleton":"Скелет","Slaad Tadpole":"Головастик слаада","Smoke Mephit":"Дымный мефит",
"Solar":"Соляр","Spectator":"Наблюдатель","Specter":"Спектр","Spider":"Паук","Sprite":"Спригган","Spy":"Шпион","Steam Mephit":"Паровой мефит","Stirge":"Стиргей",
"Stone Giant":"Каменный гигант","Stone Golem":"Каменный голем","Storm Giant":"Штормовой гигант","Succubus":"Суккуб","Swarm of Bats":"Рой летучих мышей",
"Swarm of Rats":"Рой крыс","Swarm of Ravens":"Рой воронов","Swarm of Insects":"Рой насекомых","Tarrasque":"Тарраска","Thri-kreen":"Три-кин","Tiger":"Тигр",
"Treant":"Треант","Triceratops":"Трицератопс","Troglodyte":"Троглодит","Troll":"Тролль","Tyrannosaurus Rex":"Тираннозавр рекс","Ultroloth":"Ультролот","Umber Hulk":"Умбер-холк",
"Unicorn":"Единорог","Vampire":"Вампир","Vampire Spawn":"Вампирский отпрыск","Venomous Snake":"Ядовитая змея","Vine Blight":"Лозовый язв","Violet Fungus":"Фиолетовый гриб",
"Vrock":"Врок","Vulture":"Стервятник","Warhorse":"Боевой конь","Warhorse Skeleton":"Скелет боевого коня","Water Elemental":"Элементаль воды","Weasel":"Хорёк",
"Werebear":"Оборотень-медведь","Wereboar":"Оборотень-кабан","Wererat":"Оборотень-крыса","Weretiger":"Оборотень-тигр","Werewolf":"Оборотень-волк",
"White Dragon Wyrmling":"Дракончик белого дракона","Wight":"Вайт","Will-o'-Wisp":"Блуждающий огонёк","Winged Kobold":"Крылатый кобольд","Winter Wolf":"Зимний волк",
"Wolf":"Волк","Worg":"Ворг","Wraith":"Рейт","Wyvern":"Виверна","Xorn":"Ксорн","Yeti":"Йети","Yochlol":"Йохлол","Young Black Dragon":"Молодой чёрный дракон",
"Young Blue Dragon":"Молодой синий дракон","Young Brass Dragon":"Молодой латунный дракон","Young Bronze Dragon":"Молодой бронзовый дракон",
"Young Copper Dragon":"Молодой медный дракон","Young Gold Dragon":"Молодой золотой дракон","Young Green Dragon":"Молодой зелёный дракон",
"Young Red Dragon":"Молодой красный дракон","Young White Dragon":"Молодой белый дракон","Young Silver Dragon":"Молодой серебряный дракон",
"Zombie":"Зомби","Aboleth":"Аболет","Abominable Yeti":"Жуткий йети","Barlgura":"Барлгура","Bearded Devil":"Бородатый дьявол",
"Chasme":"Хазма","Cockatrice Regent":"Василиск-повелитель","Death Dog":"Смертоносный пёс","Death Tyrant":"Смертоносный тиран",
"Demi":"Деми","Dracolich":"Драко-лич","Dust Mephit":"Пыльной мефит","Elemental":"Элементаль","Wyrmling":"Дракончик",
}

old="\n".split()
src=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'monsters2024.json')
out='/Users/vladimirkartashov/Documents/MultiTool/HomeChats/Chat-4/shirma-app/bestiary-data.js'
build(src,out,MON)