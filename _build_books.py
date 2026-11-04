#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка books-data.js: индекс заклинаний и магических предметов из AU.

Берёт _tmp/au_index.json (таблицы книги) и переводит названия/термины.
Описаний в источнике нет (статблоки-заглушки), поэтому в справочник идут
уровень, школа, компоненты, классы — для заклинаний; редкость и настройка —
для предметов.

Запуск: python3 _build_books.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "_tmp", "au_index.json")
OUT = os.path.join(HERE, "books-data.js")

SPELL_NAMES = {
    "Battle Familiar": "Боевой фамильяр",
    "Disruptive Tune": "Сбивающий напев",
    "Dueling Ground": "Дуэльная площадка",
    "Uncertain Footing": "Ненадёжная опора",
    "Wither and Bloom": "Увядание и цветение",
    "Catnap": "Короткий сон",
    "Inflict Doubt": "Посеять сомнение",
    "Distorted Distance": "Искажённое расстояние",
    "Festering Blast": "Вспышка гниения",
    "Zone of Amicability": "Зона дружелюбия",
    "Enervation": "Истощение",
    "Grave Ground": "Могильная земля",
    "Mordenkainen's Lucubration": "Ночные бдения Морденкайнена",
    "Negative Energy Flood": "Поток негативной энергии",
    "Spirit Lantern": "Фонарь духов",
    "Summon Plant": "Призыв растения",
    "Waves of Exhaustion": "Волны истощения",
    "Summon Dinosaur": "Призыв динозавра",
    "Aura of Evasion": "Аура уклонения",
    "Fractured Awareness": "Расколотое сознание",
    "Power Word Pain": "Слово силы: боль",
    "Reweave Fate": "Переплетение судьбы",
    "Transfix": "Оцепенение",
    "Entrancing Mirrors": "Чарующие зеркала",
    "Illusory Dragon": "Иллюзорный дракон",
    "Iron Body": "Железное тело",
    "Lightning Ring": "Кольцо молний",
    "Moment of Prescience": "Мгновение предвидения",
    "Detonate": "Детонация",
    "Hindsight": "Взгляд в прошлое",
    "Invulnerability": "Неуязвимость",
    "Vision of Elapsing Eons": "Видение минувших эпох",
    "Wail of the Banshee": "Вопль банши",
}

SCHOOLS = {
    "Conjuration": "Вызов", "Abjuration": "Ограждение", "Illusion": "Иллюзия",
    "Necromancy": "Некромантия", "Enchantment": "Очарование", "Divination": "Прорицание",
    "Transmutation": "Преобразование", "Evocation": "Воплощение",
}

CLASSES = {
    "Bard": "Бард", "Cleric": "Жрец", "Druid": "Друг", "Paladin": "Паладин",
    "Ranger": "Следопыт", "Sorcerer": "Чародей", "Warlock": "Колдун",
    "Wizard": "Волшебник", "Artificer": "Изобретатель",
}

COMPONENTS = {"C": "В", "R": "С", "M": "М"}

RARITY = {
    "Common": "обычный", "Uncommon": "необычный", "Rare": "редкий",
    "Very Rare": "очень редкий", "Legendary": "легендарный",
    "Artifact": "артефакт", "Varies": "варьируется",
}

ITEM_NAMES = {
    "Necklace of the Beastly Familiar": "Ожерелье звериного фамильяра",
    "Conjurer's Canopy": "Навес вызывателя",
    "Dictation Quill": "Перо для диктовки",
    "Elocutionist's Lexicon": "Лексикон оратора",
    "Ensorcelled Missive": "Заколдованное послание",
    "Evergreen Fertilizer": "Вечноцветное удобрение",
    "Homeward Compass": "Компас возвращения домой",
    "Lucky Foot": "Счастливая лапка",
    "Spell Component Ring": "Кольцо для компонентов",
    "Sweeping Broom": "Метла-уборщица",
    "Boon Companions' Bands": "Браслеты верных спутников",
    "Dispelling Ammunition": "Рассеивающие боеприпасы",
    "Goading Ammunition": "Провоцирующие боеприпасы",
    "Magewright's Gloves": "Перчатки мага-ремесленника",
    "Martialist's Quarterstaff": "Боевой посох воителя",
    "Orb of Divination Detection": "Сфера обнаружения прорицания",
    "Orb of Sorcery": "Сфера чародейства",
    "Potion of Dragon's Breath": "Зелье драконьего дыхания",
    "Potion of Tirelessness": "Зелье неутомимости",
    "Ring of Dedicated Focus": "Кольцо сосредоточения",
    "Spell-Slinger's Puppet": "Кукла заклинателя",
    "Thespian's Playbill": "Афиша лицедея",
    "Thief's Thimble": "Напёрсток вора",
    "Wand of Freshness": "Палочка свежести",
    "Arcane Chatelaine": "Шателен арканы",
    "Arcanist's Bestiary": "Бестиарий арканиста",
    "Bellows of Strangulation": "Мехи удушения",
    "Blood Amulet": "Кровавый амулет",
    "Dissuader": "Отпугиватель",
    "Dream Weaver": "Ткач снов",
    "Mage Breaker": "Магобой",
    "Mage's Manacle": "Кандалы мага",
    "Namer's Needle": "Игла именующего",
    "Prismatic Rune": "Призматическая руна",
    "Scholar's Anchoring Bangle": "Браслет-якорь учёного",
    "Secret Keeper's Circlet": "Венец хранителя тайн",
    "Spell Duelist's Trophy": "Трофей дуэлянта",
    "Wand of Slumber": "Палочка дремоты",
    "Wand of Teeth": "Палочка зубов",
    "Staff of the Lost": "Посох заблудших",
    "Tramontane Armor": "Доспех трамонтаны",
    "Workshop Wrecker": "Крушитель мастерской",
    "Diamond Staff": "Алмазный посох",
    "Grave Reaper": "Могильный жнец",
    "Traveler's Pearl": "Жемчужина странника",
    "Queen Ehlissa's Marvelous Nightingale": "Изумительный соловей королевы Элиссы",
    "Universal Pantograph": "Универсальный пантограф",
    "Blossom Rod": "Жезл цветения",
    "Idol of Good Fortunes": "Идол добрых удач",
    "Keyholes Dagger": "Кинжал «Скважины»",
    "Staff of Skulls": "Посох черепов",
    "Wave-Swept Weapon": "Оружие морских волн",
}


def main():
    data = json.load(open(SRC, encoding="utf-8"))
    spells, items, miss = [], [], []

    for level, name, school, special, classes in data["spells"]:
        ru = SPELL_NAMES.get(name)
        if not ru:
            miss.append(name)
            ru = name
        comp = special.replace("—", "").strip()
        comp = ", ".join(COMPONENTS.get(c.strip(), c.strip()) for c in comp.split(",") if c.strip())
        cls = ", ".join(CLASSES.get(c.strip(), c.strip()) for c in classes.split(",") if c.strip())
        spells.append({"n": ru, "en": name, "l": int(level),
                       "sc": SCHOOLS.get(school, school), "sch": SCHOOLS.get(school, school),
                       "comp": comp, "cls": [c.strip() for c in cls.split(", ") if c.strip()],
                       "src": "AU"})

    for rarity, name, att in data["items"]:
        ru = ITEM_NAMES.get(name)
        if not ru:
            miss.append(name)
            ru = name
        items.append({"n": ru, "en": name,
                      "rarity": RARITY.get(rarity, rarity.lower()),
                      "r": RARITY.get(rarity, rarity.lower()),
                      "attune": att.strip().lower() == "yes",
                      "att": att.strip().lower() == "yes",
                      "src": "AU"})

    spells.sort(key=lambda s: (s["l"], s["n"]))
    items.sort(key=lambda i: (["варьируется", "обычный", "необычный", "редкий",
                               "очень редкий", "легендарный", "артефакт"].index(i["r"])
                              if i["r"] in ["варьируется", "обычный", "необычный", "редкий",
                                            "очень редкий", "легендарный", "артефакт"] else 9, i["n"]))

    import _dmg_notes as DMG
    body = json.dumps({"source": "Arcana Unleashed (AU) + конспекты DMG",
                       "spells": spells, "items": items,
                       "rules": DMG.RULES, "tables": DMG.TABLES},
                      ensure_ascii=False, separators=(", ", ": "))
    js = ("// Справочник по книге «Arcana Unleashed» (AU): индекс заклинаний и магических предметов.\n"
          "// Только фактические данные (уровень, школа, компоненты, классы, редкость, настройка).\n"
          "// Сгенерировано _build_books.py.\n"
          "window.BOOKS = " + body + ";\n")
    open(OUT, "w", encoding="utf-8").write(js)
    print("заклинаний:", len(spells), "| предметов:", len(items), "| без перевода:", len(miss), miss[:5])


if __name__ == "__main__":
    main()
