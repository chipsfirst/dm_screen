#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает компактные данные о классах, видах и предысториях из SRD 5.2.1
(CC-BY-4.0, Wizards of the Coast) и переводит нужные поля на русский.

Источники лежат в data/srd521/ (classes.md, origins.md из
https://github.com/downfallx/dnd-5e-srd-markdown, SRD 5.2.1).
Результат: srd-chars-data.js — используется для автозаполнения листа персонажа.
"""
import json
import re
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent
SRC = BASE / 'data' / 'srd521'
OUT = BASE / "js" / "data" / "srd-chars-data.js"

# ── переводы ────────────────────────────────────────────────────────────────
CLASS_RU = {
    'Barbarian': 'Варвар', 'Bard': 'Бард', 'Cleric': 'Жрец', 'Druid': 'Друид',
    'Fighter': 'Воин', 'Monk': 'Монах', 'Paladin': 'Паладин', 'Ranger': 'Следопыт',
    'Rogue': 'Плут', 'Sorcerer': 'Чародей', 'Warlock': 'Колдун', 'Wizard': 'Волшебник',
}
ABILITY_RU = {
    'Strength': 'Сила', 'Dexterity': 'Ловкость', 'Constitution': 'Телосложение',
    'Intelligence': 'Интеллект', 'Wisdom': 'Мудрость', 'Charisma': 'Харизма',
}
SKILL_RU = {
    'Acrobatics': 'Акробатика', 'Animal Handling': 'Уход за животными',
    'Arcana': 'Аркана', 'Athletics': 'Атлетика', 'Deception': 'Обман',
    'History': 'История', 'Insight': 'Проницательность', 'Intimidation': 'Запугивание',
    'Investigation': 'Анализ', 'Medicine': 'Медицина', 'Nature': 'Природа',
    'Perception': 'Внимательность', 'Performance': 'Выступление', 'Persuasion': 'Убеждение',
    'Religion': 'Религия', 'Sleight of Hand': 'Ловкость рук', 'Stealth': 'Скрытность',
    'Survival': 'Выживание',
}
FEATURE_RU = {
    'Rage': 'Ярость', 'Unarmored Defense': 'Защита без доспехов',
    'Weapon Mastery': 'Владение оружием', 'Bardic Inspiration': 'Вдохновение барда',
    'Spellcasting': 'Использование заклинаний', 'Divine Order': 'Божественный орден',
    'Druidic': 'Друидический язык', 'Primal Order': 'Первобытный орден',
    'Fighting Style': 'Боевой стиль', 'Second Wind': 'Второе дыхание',
    'Martial Arts': 'Боевые искусства', 'Lay On Hands': 'Возложение рук',
    'Favored Enemy': 'Избранный враг', 'Expertise': 'Компетентность',
    'Sneak Attack': 'Скрытая атака', "Thieves' Cant": 'Воровской жаргон',
    'Innate Sorcery': 'Врождённое колдовство', 'Eldritch Invocations': 'Потусторонние воззвания',
    'Pact Magic': 'Магия договора', 'Ritual Adept': 'Мастер ритуалов',
    'Arcane Recovery': 'Восстановление магии',
}
ARMOR_RU = {
    'None': 'Нет',
    'Light armor': 'Лёгкие доспехи',
    'Light armor and Shields': 'Лёгкие доспехи, щиты',
    'Light, Medium, and Heavy armor and Shields': 'Лёгкие, средние и тяжёлые доспехи, щиты',
    'Light and Medium armor and Shields': 'Лёгкие и средние доспехи, щиты',
    'Light and Medium armor': 'Лёгкие и средние доспехи',
    'Medium armor and Shields': 'Средние доспехи, щиты',
    'Heavy armor': 'Тяжёлые доспехи',
    'Shields': 'Щиты',
}
WEAPON_RU = {
    'None': 'Нет',
    'Simple weapons': 'Простое оружие',
    'Simple weapons and Martial weapons that have the Finesse or Light property':
        'Простое оружие и воинское оружие со свойствами «фехтовальное» или «лёгкое»',
    'Simple weapons and Martial weapons that have the Light property':
        'Простое оружие и воинское оружие со свойством «лёгкое»',
    'Simple and Martial weapons': 'Простое и воинское оружие',
    'Martial weapons': 'Воинское оружие',
}
TOOL_RU = {
    'Herbalism Kit': 'Набор травника',
    "Thieves' Tools": 'Воровские инструменты',
    "Choose one type of Artisan's Tools or Musical Instrument (see Equipment)":
        'Инструменты ремесленника или музыкальный инструмент на выбор',
    "Choose 3 Musical Instruments (see Equipment)": 'Три музыкальных инструмента на выбор',
    "Choose one type of Artisan's Tools or one Musical Instrument (see Equipment)":
        'Инструменты ремесленника или музыкальный инструмент на выбор',
}
EQUIP_RU = {
    'Barbarian': '(A) секира, 4 ручных топора, набор путешественника и 15 зм; или (B) 75 зм',
    'Bard': '(A) кожаный доспех, 2 кинжала, музыкальный инструмент на выбор, набор артиста и 19 зм; или (B) 90 зм',
    'Cleric': '(A) кольчужная рубаха, щит, булава, символ веры, набор священника и 7 зм; или (B) 110 зм',
    'Druid': '(A) кожаный доспех, щит, серп, друидический фокус (посох), набор путешественника, набор травника и 9 зм; или (B) 50 зм',
    'Fighter': '(A) кольчуга, двуручный меч, цеп, 8 копий, набор исследователя подземелий и 4 зм; '
               '(B) клёпаный кожаный доспех, скимитар, короткий меч, длинный лук, 20 стрел, колчан, '
               'набор исследователя подземелий и 11 зм; или (C) 155 зм',
    'Monk': '(A) копьё, 5 кинжалов, инструменты ремесленника или музыкальный инструмент, набор путешественника и 11 зм; или (B) 50 зм',
    'Paladin': '(A) кольчуга, щит, длинный меч, 6 копий, символ веры, набор священника и 9 зм; или (B) 150 зм',
    'Ranger': '(A) клёпаный кожаный доспех, скимитар, короткий меч, длинный лук, 20 стрел, колчан, '
              'друидический фокус (веточка омелы), набор путешественника и 7 зм; или (B) 150 зм',
    'Rogue': '(A) кожаный доспех, 2 кинжала, короткий меч, короткий лук, 20 стрел, колчан, воровские инструменты, '
             'набор взломщика и 8 зм; или (B) 100 зм',
    'Sorcerer': '(A) копьё, 2 кинжала, арканный фокус (кристалл), набор исследователя подземелий и 28 зм; или (B) 50 зм',
    'Warlock': '(A) кожаный доспех, серп, 2 кинжала, арканный фокус (сфера), книга оккультных знаний, '
               'набор учёного и 15 зм; или (B) 100 зм',
    'Wizard': '(A) 2 кинжала, арканный фокус (посох), мантия, книга заклинаний, набор учёного и 5 зм; или (B) 55 зм',
}
SPECIES_RU = {
    'Dragonborn': 'Драконорождённый', 'Dwarf': 'Дварф', 'Elf': 'Эльф', 'Gnome': 'Гном',
    'Goliath': 'Голиаф', 'Halfling': 'Полурослик', 'Human': 'Человек', 'Orc': 'Орк',
    'Tiefling': 'Тифлинг',
}
TRAIT_RU = {
    'Draconic Ancestry': 'Драконье наследие', 'Breath Weapon': 'Оружие дыхания',
    'Damage Resistance': 'Сопротивление урону', 'Darkvision': 'Тёмное зрение',
    'Draconic Flight': 'Драконий полёт', 'Dwarven Resilience': 'Дварфская стойкость',
    'Dwarven Toughness': 'Дварфская выносливость', 'Stonecunning': 'Камнезнание',
    'Elven Lineage': 'Эльфийская родословная', 'Fey Ancestry': 'Наследие фей',
    'Keen Senses': 'Острые чувства', 'Trance': 'Транс',
    'Gnomish Cunning': 'Гномья хитрость', 'Gnomish Lineage': 'Гномья родословная',
    'Giant Ancestry': 'Наследие великанов', 'Large Form': 'Большая форма',
    'Powerful Build': 'Мощное телосложение', 'Brave': 'Бесстрашие',
    'Halfling Nimbleness': 'Полуросликовая юркость', 'Luck': 'Удача',
    'Naturally Stealthy': 'Природная скрытность', 'Resourceful': 'Изобретательность',
    'Skillful': 'Умелость', 'Versatile': 'Универсальность',
    'Adrenaline Rush': 'Прилив адреналина', 'Relentless Endurance': 'Неутомимость',
    'Fiendish Legacy': 'Дьявольское наследие', 'Otherworldly Presence': 'Потустороннее присутствие',
}
BACKGROUND_RU = {
    'Acolyte': 'Служитель храма', 'Criminal': 'Преступник', 'Sage': 'Мудрец', 'Soldier': 'Солдат',
}
BACKGROUND_ORDER = ['Acolyte', 'Criminal', 'Sage', 'Soldier']  # только SRD-предыстории
TOOL_BG_RU = {
    "Calligrapher's Supplies": 'Инструменты каллиграфа',
    "Thieves' Tools": 'Воровские инструменты',
    'Gaming Set': 'Игровой набор (один на выбор)',
}
FEAT_RU = {
    'Magic Initiate (Cleric)': 'Посвящённый в магию (жрец)',
    'Magic Initiate (Wizard)': 'Посвящённый в магию (волшебник)',
    'Alert': 'Бдительный',
    'Savage Attacker': 'Свирепый налётчик',
}
BG_EQUIP_RU = {
    'Acolyte': '(A) инструменты каллиграфа, книга молитв, символ веры, 10 листов пергамента, мантия и 8 зм; или (B) 50 зм',
    'Criminal': '(A) 2 кинжала, воровские инструменты, ломик, 2 кошеля, дорожная одежда и 16 зм; или (B) 50 зм',
    'Sage': '(A) посох, инструменты каллиграфа, книга по истории, 8 листов пергамента, мантия и 8 зм; или (B) 50 зм',
    'Soldier': '(A) копьё, короткий лук, 20 стрел, игровой набор, набор лекаря, колчан, дорожная одежда и 14 зм; или (B) 50 зм',
}
SIZE_RU = {'Medium': 'Средний', 'Small': 'Малый', 'Tiny': 'Крошечный', 'Large': 'Большой'}

missing = set()


def tr(table, value, kind):
    if value in table:
        return table[value]
    missing.add('%s: %s' % (kind, value))
    return value


def strip_tags(t):
    return re.sub(r'<[^>]+>', '', t).strip()


def split_and(text):
    return [p.strip() for p in re.split(r',|\band\b|\bor\b', text) if p.strip()]


def parse_classes(text):
    out = []
    for block in re.split(r'^## (?!#)', text, flags=re.M)[1:]:
        name = block.split('\n', 1)[0].strip()
        if 'Core %s Traits' % name not in block:
            continue
        rows = dict()
        for k, v in re.findall(r'<tr>\s*<td>(.*?)</td>\s*<td>(.*?)</td>\s*</tr>', block, flags=re.S):
            key = strip_tags(k)
            if key.isdigit():            # строки таблицы уровней сюда не нужны
                continue
            rows[key] = strip_tags(v)

        die = int(re.search(r'D(\d+)', rows.get('Hit Point Die', 'D8')).group(1))

        skills = {'count': 0, 'list': [], 'any': False}
        raw_skills = rows.get('Skill Proficiencies', '')
        m = re.search(r'Choose (?:any )?(\d+|one)', raw_skills)
        if m:
            n = m.group(1)
            skills['count'] = 1 if n == 'one' else int(n)
        if 'Choose any' in raw_skills:
            skills['any'] = True
        elif ':' in raw_skills:
            listing = raw_skills.split(':', 1)[1]
            listing = listing.replace('(see Playing the Game)', '')
            for part in split_and(listing):
                part = part.strip()
                if part:
                    skills['list'].append(tr(SKILL_RU, part, 'навык'))

        saves = []
        for part in split_and(rows.get('Saving Throw Proficiencies', '')):
            saves.append(tr(ABILITY_RU, part, 'спасбросок'))

        primary = []
        for part in split_and(rows.get('Primary Ability', '')):
            primary.append(tr(ABILITY_RU, part, 'характеристика'))

        armor = tr(ARMOR_RU, rows.get('Armor Training', ''), 'доспехи') if rows.get('Armor Training') else ''
        weapons = tr(WEAPON_RU, rows.get('Weapon Proficiencies', ''), 'оружие') if rows.get('Weapon Proficiencies') else ''
        tools = tr(TOOL_RU, rows.get('Tool Proficiencies', ''), 'инструменты') if rows.get('Tool Proficiencies') else ''

        feats = [tr(FEATURE_RU, f.strip(), 'особенность')
                 for f in re.findall(r'^#### Level 1: (.+)$', block, flags=re.M)]

        out.append({
            'id': name.lower(),
            'name': tr(CLASS_RU, name, 'класс'),
            'en': name,
            'die': die,
            'primary': primary,
            'saves': saves,
            'skills': skills,
            'armor': armor,
            'weapons': weapons,
            'tools': tools,
            'features': feats,
            'equip': tr(EQUIP_RU, name, 'снаряжение класса'),
        })
    return out


def parse_origins(text):
    species, backgrounds = [], []
    for block in re.split(r'^#### (?!#)', text, flags=re.M)[1:]:
        name = block.split('\n', 1)[0].strip()
        fields = dict((k.strip(), v.strip()) for k, v in
                      re.findall(r'^\*\*(.+?):\*\* (.+)$', block, flags=re.M))
        traits = [t.strip() for t in re.findall(r'^_(.+?)\._', block, flags=re.M)]

        if name in BACKGROUND_ORDER:
            equip_raw = fields.get('Equipment', '')
            equip_ru = BG_EQUIP_RU.get(name, '')
            tool_raw = strip_tags(fields.get('Tool Proficiency', ''))
            tool_ru = TOOL_BG_RU.get(tool_raw)
            if tool_ru is None and tool_raw:
                if 'Gaming Set' in tool_raw:
                    tool_ru = TOOL_BG_RU['Gaming Set']
                else:
                    tool_ru = tool_raw
                    missing.add('инструмент предыстории: ' + tool_raw)
            backgrounds.append({
                'id': name.lower(),
                'name': tr(BACKGROUND_RU, name, 'предыстория'),
                'en': name,
                'abilities': [tr(ABILITY_RU, a, 'характеристика') for a in split_and(fields.get('Ability Scores', ''))],
                'feat': tr(FEAT_RU, re.sub(r'\s*\(see "Feats"\)', '', fields.get('Feat', '')).strip(), 'черта'),
                'skills': [tr(SKILL_RU, s, 'навык') for s in split_and(fields.get('Skill Proficiencies', ''))],
                'tool': tool_ru or '',
                'equip': equip_ru,
            })
        elif name in SPECIES_RU:
            size_raw = fields.get('Size', 'Medium')
            size = 'Малый' if size_raw.startswith('Small') else SIZE_RU.get(size_raw.split()[0], 'Средний')
            if size_raw.startswith('Medium') and 'or Small' in size_raw:
                size = 'Средний или малый'
            speed = int(re.search(r'(\d+)', fields.get('Speed', '30')).group(1))
            dark = 0
            m = re.search(r'Darkvision[^.]*?(\d+)\s*feet', block)
            if m:
                dark = int(m.group(1))
            species.append({
                'id': name.lower(),
                'name': tr(SPECIES_RU, name, 'вид'),
                'en': name,
                'size': size,
                'speed': speed,
                'type': 'Гуманоид',
                'darkvision': dark,
                'traits': [tr(TRAIT_RU, t, 'черта вида') for t in traits],
            })
    order = {n: i for i, n in enumerate(SPECIES_RU)}
    species.sort(key=lambda s: order.get(s['en'], 99))
    return species, backgrounds


def main():
    classes = parse_classes((SRC / 'classes.md').read_text(encoding='utf-8'))
    species, backgrounds = parse_origins((SRC / 'origins.md').read_text(encoding='utf-8'))

    header = (
        '/* Данные персонажа из SRD 5.2.1 (D&D 2024).\n'
        '   Источник: System Reference Document 5.2.1, Wizards of the Coast,\n'
        '   лицензия CC BY 4.0 — https://creativecommons.org/licenses/by/4.0/\n'
        '   Собрано скриптом _build_srd_chars.py из data/srd521/ (текст правил). */\n'
    )
    body = []
    body.append('window.SRD_CLASSES = ' + json.dumps(classes, ensure_ascii=False, indent=0).replace('\n', '') + ';')
    body.append('window.SRD_SPECIES = ' + json.dumps(species, ensure_ascii=False, indent=0).replace('\n', '') + ';')
    body.append('window.SRD_BACKGROUNDS = ' + json.dumps(backgrounds, ensure_ascii=False, indent=0).replace('\n', '') + ';')
    OUT.write_text(header + '\n'.join(body) + '\n', encoding='utf-8')

    print('классов:', len(classes), '| видов:', len(species), '| предысторий:', len(backgrounds))
    if missing:
        print('НЕТ ПЕРЕВОДА:')
        for m in sorted(missing):
            print('  -', m)
    return 1 if missing else 0


if __name__ == '__main__':
    raise SystemExit(main())
