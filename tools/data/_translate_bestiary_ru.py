#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Перевод бестиария на русский: словарь терминов + машинный перевод прозы.

Что переводит:
  * n        — имена монстров (если осталась латиница);
  * type     — размер/тип/подтип/мировоззрение с согласованием рода;
  * sp       — скорости (ft. → фт, Fly → полёт …);
  * sen      — чувства;
  * lang     — языки;
  * sk       — навыки (остатки английского);
  * cr       — «XP 1 100; PB +2» → «опыт 1 100; БМ +2»;
  * acts[].text / acts[].name — проза действий и черт.

Машинный перевод: Google (client=gtx), батчами по строкам, с кэшем
data/translation_cache.json. После перевода прогоняется глоссарий D&D-терминов,
который правит типичные машинные варианты («Режущий урон» → «рубящий урон»).

Запуск:
    python3 _translate_bestiary_ru.py            # перевод + запись bestiary-data.js
    python3 _translate_bestiary_ru.py --dry      # только отчёт, без записи
    python3 _translate_bestiary_ru.py --sample N # перевести N записей и показать
"""
import json
import os
import random
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from _langs_fix import LANGS_FIX

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(HERE, "js", "data", "bestiary-data.js")
CACHE = os.path.join(HERE, "data", "translation_cache.json")
ENDPOINT = "https://translate.googleapis.com/translate_a/single"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

# ─────────────────────────── словари ───────────────────────────
SIZE_AGREE = {
    "Крошечный": ("Крошечный", "Крошечная", "Крошечное"),
    "Маленький": ("Маленький", "Маленькая", "Маленькое"),
    "Средний": ("Средний", "Средняя", "Среднее"),
    "Большой": ("Большой", "Большая", "Большое"),
    "Огромный": ("Огромный", "Огромная", "Огромное"),
    "Гигантский": ("Гигантский", "Гигантская", "Гигантское"),
}

TYPE_GENDER = {
    "аберрация": "f", "зверь": "m", "небожитель": "m", "конструкт": "m", "дракон": "m",
    "элементаль": "m", "фея": "f", "исчадие": "n", "гигант": "m", "гуманоид": "m",
    "чудовище": "n", "тварь-желе": "f", "растение": "n", "нежить": "f",
}

ALIGN = {
    "Законоправный Добрый": "законно-добрый",
    "Законоправный Нейтральный": "законно-нейтральный",
    "Законоправный Злой": "законно-злой",
    "Нейтральный Добрый": "нейтрально-добрый",
    "Нейтральный Злой": "нейтрально-злой",
    "Хаотичный Добрый": "хаотично-добрый",
    "Хаотичный Нейтральный": "хаотично-нейтральный",
    "Хаотичный Злой": "хаотично-злой",
    "Нейтральный": "нейтральный",
    "Без мировоззрения": "без мировоззрения",
    "Любое": "любое мировоззрение",
    "Любой": "любое мировоззрение",
}

TYPE_RU = {
    "aberration": "аберрация", "beast": "зверь", "celestial": "небожитель",
    "construct": "конструкт", "dragon": "дракон", "elemental": "элементаль",
    "fey": "фея", "fiend": "исчадие", "giant": "гигант", "humanoid": "гуманоид",
    "monstrosity": "чудовище", "ooze": "тварь-желе", "plant": "растение",
    "undead": "нежить", "swarm of": "стая",
}

LANG_RU = {
    "Common": "Общий", "Dwarvish": "дварфийский", "Elvish": "эльфийский",
    "Giant": "великаний", "Gnomish": "гномий", "Goblin": "гоблинский",
    "Halfling": "полуросличий", "Orc": "орочий", "Abyssal": "язык Бездны",
    "Celestial": "небесный", "Draconic": "драконий", "Deep Speech": "глубинная речь",
    "Infernal": "инфернальный", "Primordial": "первобытный", "Sylvan": "сильванский",
    "Undercommon": "подземный", "Telepathy": "телепатия", "Terran": "терран",
    "Aquan": "акван", "Auran": "ауран", "Ignan": "игнан", "Slaad": "слаадский",
    "Gnoll": "гнолльский", "Druidic": "друидический", "Thieves' Cant": "воровской жаргон",
    "All": "все", "None": "—", "any": "любой", "understands": "понимает",
    "but can't speak": "но не говорит", "the languages you know": "языки, которые вы знаете",
}

GLOSSARY = [
    # оружие/атаки
    (r"\bБросок рукопашной атаки\b", "Бросок атаки в ближнем бою"),
    (r"\bбросок рукопашной атаки\b", "бросок атаки в ближнем бою"),
    (r"\bБросок дальней атаки\b", "Бросок атаки на расстоянии"),
    (r"\bбросок дальней атаки\b", "бросок атаки на расстоянии"),
    (r"\bБроски? рукопашной атаки\b", "Бросок атаки в ближнем бою"),
    (r"\bРукопашн(ый|ая|ое|ые|ого|ой)\b", r"ближн\1"),
    (r"\bДальнобойн(ый|ая|ое|ые|ого|ой)\b", r"дистанционн\1"),
    # урон
    (r"\bРежущ", "рубящ"), (r"\bрежущ", "рубящ"),
    (r"\bПорез(ы|а|ов)?\b", "рубящий урон"),
    (r"\bОглушающ(ий|его|им|ем)\s+урон", "дробящий урон"),
    (r"\bТуп(ой|ого|ым|ая)\s+урон", "дробящий урон"),
    (r"\bДробящ", "дробящ"), (r"\bКол(ющий|ющего|ющим)", "колющий"),
    (r"\bПроникающ(ий|его|им|ем)\s+урон", "колющий урон"),
    (r"\bГромов(ой|ого|ым)\s+урон", "урон звуком"),
    (r"\bСилов(ое|ого|ым)\s+поле", "силовое поле"),
    (r"\bПсихическ(ий|ого|им)\s+урон", "психический урон"),
    (r"\bИзлучающ(ий|его|им)\s+урон", "урон излучением"),
    # спасброски/условия
    (r"\bУС уклонения\b", "КД спасения"),
    (r"\bУС\b", "КД"),
    (r"\bНевыгодное положение\b", "Помеха"),
    (r"\bневыгодное положение\b", "помеха"),
    (r"\bПреимуществ(о|а|ом)\b", r"Преимуществ\1"),
    (r"\bСостояние\s+«?([А-Яа-яё]+)»?", r"состояние «\1»"),
    (r"\bСхваченный\b", "Схвачен"),
    (r"\bОглушённый\b", "Оглушён"),
    # дистанции и прочее
    (r"\bфутов\b", "фт"), (r"\bфута\b", "фт"), (r"\bфут\b", "фт"),
    (r"\bХитов\b", "хитов"), (r"\bхитпоинт", "хит"),
    (r"\bКласс доспеха\b", "КД"),
    (r"\bчерный\b", "чёрный"), (r"\bЧерный\b", "Чёрный"),
    (r"\bзеленый\b", "зелёный"), (r"\bЗеленый\b", "Зелёный"),
    (r"\bжелтый\b", "жёлтый"), (r"\bЖелтый\b", "Жёлтый"),
    (r"\bСпасбросок\b", "спасбросок"), (r"\bСпасброски\b", "спасброски"),
    (r"\bдействие\b(?=\s*[:.])", "действие"),
]

GLOSSARY += [
    (r"\bDC\s*(\d+)", r"КД \1"),
    (r"\bDC уклонения\b", "КД спасения"),
    (r"\bDC\b", "КД"),
    (r"\bDM\b", "Мастер"),
    (r"\bDM's\b", "Мастера"),
    (r"\bAC\b", "КД"),
    (r"\bHP\b", "хиты"),
    (r"\bPB\b", "БМ"),
    (r"\bGP\b", "зм"),
    (r"\bCR\b", "ПО"),
    (r"атаки Рэнда", "атаки Раздиранием"),
    (r"\bRend\b", "Раздирание"),
    (r"\bMind Spike\b", "Психический шип"),
    (r"\bTail Spike\b", "Хвостовой шип"),
    (r"\bRock Launch\b", "Метание камня"),
    (r"\bForce Bolt\b", "Силовой снаряд"),
    (r"\bObject Slam\b", "Удар предметом"),
    (r"\bInvitation\b", "Приглашение"),
    (r"\bSlam\b", "Удар"),
    (r"\bBash\b", "Удар"),
    (r"\bBolt\b", "Снаряд"),
    (r"\bStorm\b", "Шторм"),
    (r"\bBlade\b", "Клинок"),
    (r"\bFlame\b", "Пламя"),
    (r"\bShield\b", "Щит"),
    (r"\bVine\b", "Лоза"),
    (r"\bStaff\b", "Посох"),
    (r"\bWisp\b", "Огонёк"),
    (r"\bRock\b", "Камень"),
    (r"\bBurst\b", "Вспышка"),
    (r"\bAvenger\b", "Мститель"),
    (r"\bVerdant\b", "Зелёный"),
    (r"(^|[.!?]\s+)спасбросок", r"\1Спасбросок"),
    (r"\bКонус(ом|е|а)?\b", r"конус\1"),
    (r"\bСфер(а|ы|е|у|ой)\b", r"сфер\1"),
    (r"\bЭманаци(я|и|ю|ей)\b", r"эманаци\1"),
    (r"\bЛини(я|и|ю|ей)\b", r"лини\1"),
    (r"\bКуб(ом|е|а)?\b", r"куб\1"),
    (r"\bЦилиндр(ом|е|а)?\b", r"цилиндр\1"),
    (r"состоянии Склонности", "состоянии «Сбит с ног»"),
    (r"\bСклонность\b", "«Сбит с ног»"),
    (r"состоянии удержания", "состоянии «Схвачен»"),
    (r"очками жизни", "хитами"),
    (r"очков жизни", "хитов"),
    (r"дальность действия", "дистанция"),
    (r"\bКолдовство\b", "использование заклинаний"),
    (r"Волшебная веревка", "волшебная верёвка"),
    (r"\bверевка\b", "верёвка"),
]

GLOSSARY += [
    (r"Radiant Вспышка", "Излучающая вспышка"),
    (r"Fey Клинок", "Клинок фей"),
    (r"Пламя Scepter", "Огненный скипетр"),
    (r"Hurl Пламя", "Метание пламени"),
    (r"Web Снаряд", "Паутинный снаряд"),
    (r"Tree Club", "Дубина из дерева"),
    (r"Trash Lob", "Метание мусора"),
    (r"Bladed Arm", "Клинковый удар"),
    (r"Fiery Снаряд", "Огненный снаряд"),
    (r"Corrupting Touch", "Портящее касание"),
    (r"Fell Glare", "Гибельный взгляд"),
    (r"Enthralling Panache", "Пленительный шик"),
    (r"Шторм Sword", "Меч шторма"),
    (r"Thunderbolt", "Громовая стрела"),
    (r"Grave Strike", "Могильный удар"),
    (r"Shape-Shift", "Смена облика"),
    (r"Life Drain", "Вытягивание жизни"),
    (r"Sleep Breath", "Сонное дыхание"),
    (r"Alter Self", "Изменение себя"),
    (r"\bConstrict\b", "Сдавливание"),
    (r"\bBite\b", "Укус"),
    (r"\(только Spider\)", "(только паук)"),
    (r"для попадания, достигните (\d+) фт, одна цель", r"досягаемость \1 фт, одна цель"),
    (r"\bв пределах (\d+) фт может видеть (\w+)", r"в пределах \1 фт, которых может видеть \2"),
]

GLOSSARY += [
    (r"\bHeavy Crossbow\b", "тяжёлый арбалет"),
    (r"\bHand Crossbow\b", "ручной арбалет"),
    (r"\bLight Crossbow\b", "лёгкий арбалет"),
    (r"\bWarhammer\b", "боевой молот"),
    (r"\bHandaxe\b", "ручной топор"),
    (r"\bLongsword\b", "длинный меч"),
    (r"\bShortsword\b", "короткий меч"),
    (r"\bGreatsword\b", "двуручный меч"),
    (r"\bDagger\b", "кинжал"),
    (r"\bLongbow\b", "длинный лук"),
    (r"\bShortbow\b", "короткий лук"),
    (r"\bJavelin\b", "метательное копьё"),
    (r"\bHold Monster\b", "Удержание чудовища"),
    (r"\bWall of Fire\b", "Стена огня"),
    (r"\bFireball\b", "Огненный шар"),
    (r"\bCounterspell\b", "Контрзаклинание"),
    (r"\bShield\s*\(spell\)", "Щит"),
    (r"\bMagic Missile\b", "Волшебная стрела"),
    (r"\bMisty Step\b", "Туманный шаг"),
    (r"\bInvisibility\b", "Невидимость"),
    (r"\bPolymorph\b", "Превращение"),
    (r"\bFly\s*\(spell\)", "Полёт"),
    (r"\bDispel Magic\b", "Рассеивание магии"),
    (r"\bDarkness\b", "Тьма"),
    (r"\bCharm Person\b", "Очарование личности"),
]

GLOSSARY += [
    (r"Урон от холода", "урон холодом"),
    (r"урон от холода", "урон холодом"),
    (r"Урон от огня", "урон огнём"),
    (r"урон от огня", "урон огнём"),
    (r"Урон от электричества", "урон электричеством"),
    (r"урон от электричества", "урон электричеством"),
    (r"Урон от кислоты", "урон кислотой"),
    (r"урон от кислоты", "урон кислотой"),
    (r"Урон от яда", "урон ядом"),
    (r"урон от яда", "урон ядом"),
    (r"Урон от излучения", "урон излучением"),
    (r"состоянии Паралича", "состоянии «Парализован»"),
    (r"состояние Паралича", "состояние «Парализован»"),
    (r"\bПаралич\b", "«Парализован»"),
    (r"состоянии Отравления", "состоянии «Отравлен»"),
    (r"состояние Отравления", "состояние «Отравлен»"),
    (r"состоянии Испуга", "состоянии «Испуган»"),
    (r"состоянии Оглушения", "состоянии «Оглушён»"),
    (r"состоянии Окаменения", "состоянии «Окаменел»"),
    (r"состоянии Ослепления", "состоянии «Ослеплён»"),
    (r"состоянии Склонения", "состоянии «Сбит с ног»"),
    (r"состоянии Склонности", "состоянии «Сбит с ног»"),
    (r"состоянии Склон", "состоянии «Сбит с ног»"),
    (r"\bСклонение\b", "«Сбит с ног»"),
    (r"\bСклонность\b", "«Сбит с ног»"),
    (r"состоянии Удержания", "состоянии «Схвачен»"),
    (r"\bУдержание\b", "«Схвачен»"),
    (r"\bСклон\b", "«Сбит с ног»"),
    (r"\bСклониться\b", "«Сбит с ног»"),
    (r"\bПаралича\b", "«Парализован»"),
    (r"\bПараличом\b", "«Парализован»"),
]

GLOSSARY += [
    (r"\bКусать\s*\.", "Укус."),
    (r"\bПрыгнуть\s*\.", "Прыжок."),
    (r"\bЦарапать\s*\.", "Царапина."),
    (r"Родословная Фей", "Фейское наследие"),
    (r"против бытия", "против очарования"),
    (r"\)\s+урон ядом", r") урона ядом"),
    (r"\)\s+урон огнём", r") урона огнём"),
    (r"\)\s+урон холодом", r") урона холодом"),
    (r"\)\s+урон кислотой", r") урона кислотой"),
    (r"\)\s+урон электричеством", r") урона электричеством"),
    (r"\)\s+урон излучением", r") урона излучением"),
    (r"\)\s+урон\b", r") урона"),
    (r"\)\s+колющий урона", r") колющего урона"),
    (r"\)\s+рубящий урона", r") рубящего урона"),
    (r"\)\s+дробящий урона", r") дробящего урона"),
    (r"\)\s+некротический урона", r") некротического урона"),
    (r"\)\s+психический урона", r") психического урона"),
    (r"\)\s+огненный урона", r") огненного урона"),
    (r"\)\s+холодный урона", r") холодного урона"),
    (r"\)\s+кислотный урона", r") кислотного урона"),
    (r"\)\s+ядовитый урона", r") ядовитого урона"),
    (r"\)\s+силовой урона", r") силового урона"),
    (r"\)\s+громовой урона", r") громового урона"),
    (r"Успех: Половина", "Успех: половина"),
    (r"Провал: Цель", "Провал: цель"),
    (r"Попадание: Цель", "Попадание: цель"),
]

GLOSSARY += [
    (r"«Удержания»", "«Схвачен»"),
    (r"«Удержание»", "«Схвачен»"),
    (r"Склонный дефицит", "Неустойчивость"),
    (r"«Склонен»", "«Сбит с ног»"),
    (r"состояние Склонения на землю", "состояние «Сбит с ног»"),
    (r"состояние Склонения", "состояние «Сбит с ног»"),
    (r"«Склонённый к земле»", "«Сбит с ног»"),
    (r"состояние «Склонённый к земле»", "состояние «Сбит с ног»"),
    (r"в состояние Склонности", "в состояние «Сбит с ног»"),
    (r"Урон от молнии", "урон электричеством"),
    (r"урон от молнии", "урон электричеством"),
]

GLOSSARY += [
    (r"\)\s+колющий урон\b", r") колющего урона"),
    (r"\)\s+рубящий урон\b", r") рубящего урона"),
    (r"\)\s+дробящий урон\b", r") дробящего урона"),
    (r"\)\s+некротический урон\b", r") некротического урона"),
    (r"\)\s+психический урон\b", r") психического урона"),
    (r"\)\s+огненный урон\b", r") огненного урона"),
    (r"\)\s+холодный урон\b", r") холодного урона"),
    (r"\)\s+кислотный урон\b", r") кислотного урона"),
    (r"\)\s+ядовитый урон\b", r") ядовитого урона"),
    (r"\)\s+силовой урон\b", r") силового урона"),
    (r"\)\s+громовой урон\b", r") громового урона"),
    (r"\)\s+излучающий урон\b", r") урона излучением"),
]

ADJ_GEN = {"колющий": "колющего", "рубящий": "рубящего", "дробящий": "дробящего",
           "некротический": "некротического", "психический": "психического",
           "огненный": "огненного", "холодный": "холодного", "кислотный": "кислотного",
           "ядовитый": "ядовитого", "силовой": "силового", "громовой": "громового"}

GLOSSARY += [
    (r"уровень заклинания (колющий|рубящий|дробящий|некротический|психический|огненный|холодный|кислотный|ядовитый|силовой|громовой) урон\b",
     lambda m: f"уровень заклинания {ADJ_GEN[m.group(1)]} урона"),
    (r"\bПровал: (колющий|рубящий|дробящий|некротический|психический|огненный|холодный|кислотный|ядовитый) урон\b",
     lambda m: f"Провал: {ADJ_GEN[m.group(1)]} урона"),
]

SKILL_RU = {
    "Acrobatics": "Акробатика", "Animal Handling": "Уход за животными", "Arcana": "Аркана",
    "Athletics": "Атлетика", "Deception": "Обман", "History": "История", "Insight": "Проницательность",
    "Intimidation": "Запугивание", "Investigation": "Расследование", "Medicine": "Медицина",
    "Nature": "Природа", "Perception": "Восприятие", "Performance": "Выступление",
    "Persuasion": "Убеждение", "Religion": "Религия", "Sleight of Hand": "Ловкость рук",
    "Stealth": "Скрытность", "Survival": "Выживание",
}

# ─────────────────────────── MT ───────────────────────────
_cache = {}


def load_cache():
    global _cache
    if os.path.exists(CACHE):
        try:
            _cache = json.load(open(CACHE, encoding="utf-8"))
        except Exception:
            _cache = {}


def save_cache():
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(_cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)


def has_latin(s):
    return bool(re.search(r"[A-Za-z]{2,}", s or ""))


def gtx_batch(texts, tries=4):
    """Переводит список строк одним запросом (переводы строк сохраняются)."""
    payload = "\n".join(texts)
    params = urllib.parse.urlencode({"client": "gtx", "sl": "en", "tl": "ru", "dt": "t", "q": payload})
    url = ENDPOINT + "?" + params
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            raw = urllib.request.urlopen(req, timeout=45).read().decode("utf-8", "replace")
            data = json.loads(raw)
            out = "".join(seg[0] for seg in data[0] if seg and seg[0])
            parts = out.split("\n")
            if len(parts) == len(texts):
                return parts
            # выравнивание, если сервис склеил строки
            if len(parts) > len(texts):
                return parts[: len(texts)]
            return parts + [""] * (len(texts) - len(parts))
        except Exception as e:
            if attempt == tries - 1:
                print("  ! перевод не удался:", type(e).__name__, str(e)[:80])
                return texts
            time.sleep(1.5 * (attempt + 1))
    return texts


def translate_texts(texts):
    """Переводит строки батчами, кэшируя результаты."""
    todo = [t for t in dict.fromkeys(texts) if has_latin(t) and t not in _cache]
    done = 0
    batch, size = [], 0
    def flush():
        nonlocal batch, size, done
        if not batch:
            return
        res = gtx_batch(batch)
        for src, dst in zip(batch, res):
            _cache[src] = dst
        done += len(batch)
        batch, size = [], 0
        if done % 200 < 14:
            print(f"  переведено строк: {done}")
        time.sleep(0.15)
    for t in todo:
        if len(t) > 2200:                      # длинные — по одной
            flush()
            res = gtx_batch([t])
            _cache[t] = res[0]
            done += 1
            continue
        if size + len(t) > 3500 or len(batch) >= 25:
            flush()
        batch.append(t)
        size += len(t)
    flush()
    save_cache()
    return {t: _cache.get(t, t) for t in texts}


def fix_ru(s):
    if not isinstance(s, str):
        return s
    for pat, rep in GLOSSARY:
        s = re.sub(pat, rep, s)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


# ─────────────────────────── поля ───────────────────────────
SPEED_MAP = [("Fly", "полёт"), ("Swim", "плавание"), ("Climb", "лазание"),
             ("Burrow", "копание"), ("Walk", "ходьба"), ("Hover", "зависание")]


FORM_RU = {"wolf": "волка", "bear": "медведя", "snake": "змеи", "ape": "обезьяны",
           "boar": "кабана", "tiger": "тигра", "rat": "крысы", "human": "человека",
           "hybrid": "гибрида", "bat": "летучей мыши", "beast": "зверя"}


def tr_speed(s):
    if not s:
        return s
    out = s.replace("ft.", "фт").replace("(hover)", "(зависание)")
    def _form(m):
        w = m.group(1).lower()
        return f"(только в облике {FORM_RU.get(w, w)})"
    out = re.sub(r"\(only in (\w+) form\)", _form, out, flags=re.I)
    out = re.sub(r"\((\w+) form only\)", lambda m: f"(только в облике {FORM_RU.get(m.group(1).lower(), m.group(1).lower())})", out, flags=re.I)
    out = out.replace("(Мастер's choice)", "(на выбор Мастера)")
    out = out.replace("(when rolling, 60 фт rolling downhill)", "(при качении, 60 фт при качении под уклон)")
    out = out.replace("(Land only)", "(только по земле)").replace("(Air only)", "(только по воздуху)")
    out = out.replace("(Swim only)", "(только в воде)").replace("(Earth only)", "(только по земле)")
    out = out.replace("(Demon only)", "(только демон)").replace("(Devil only)", "(только дьявол)")
    out = out.replace("(Wasp only)", "(только оса)").replace("(Ghostly only)", "(только призрачный)")
    out = out.replace("(Beholderkin only)", "(только созерцатель)")
    out = out.replace("(requires level 4+ spell)", "(требуется заклинание 4+ уровня)")
    out = re.sub(r"\bonly in (\w+) form\b", _form, out, flags=re.I)
    for en, ru in SPEED_MAP:
        out = re.sub(rf"\b{en}\b", ru, out)
    return re.sub(r"\s+", " ", out).strip()


def tr_senses(s):
    if not s:
        return s
    out = s.replace("ft.", "фт")
    out = re.sub(r"\(blind beyond this radius\)", "(слеп за пределами этого радиуса)", out, flags=re.I)
    out = re.sub(r"\(unimpeded by magical darkness\)", "(не ограничено магической тьмой)", out, flags=re.I)
    out = re.sub(r"\(unimpeded by magic\)", "(не ограничено магией)", out, flags=re.I)
    out = re.sub(r"\(unimpeded by magical [Тт]ьма\)", "(не ограничено магической тьмой)", out)
    pairs = {
        "blindsight": "слепое зрение", "darkvision": "тёмное зрение",
        "truesight": "истинное зрение", "tremorsense": "чувство вибрации",
        "Passive Perception": "Пассивное Восприятие",
    }
    for en, ru in pairs.items():
        out = re.sub(rf"\b{en}\b", ru, out, flags=re.I)
    return fix_ru(out)


NUM_WORDS = {"one": "один", "two": "два", "three": "три", "four": "четыре",
             "five": "пять", "six": "шесть", "any": "любой"}


def tr_langs(s):
    if not s:
        return s
    out = s.replace("ft.", "фт")
    out = re.sub(r"\bplus (one|two|three|four|any) other languages?\b",
                 lambda m: f"плюс {NUM_WORDS.get(m.group(1), m.group(1))} других языка", out, flags=re.I)
    out = re.sub(r"\bplus (one|two|three|four|any) other language\b",
                 lambda m: f"плюс {NUM_WORDS.get(m.group(1), m.group(1))} другой язык", out, flags=re.I)
    out = re.sub(r"\bany (two|three) languages\b",
                 lambda m: f"любые {NUM_WORDS.get(m.group(1), m.group(1))} языка", out, flags=re.I)
    out = LANGS_FIX.get(out.strip(), out)
    out = re.sub(r"Otyugh; Телепатия 120 фт \(doesn't allow the receiving creature to respond telep.*",
                 "Отьюг; телепатия 120 фт (получатель не может ответить телепатически)", out)
    out = re.sub(r"\bunderstands?\b", "понимает", out, flags=re.I)
    out = re.sub(r"\bbut can't speak\b", "но не говорит", out)
    out = re.sub(r"\bone other language\b", "один другой язык", out, flags=re.I)
    for en, ru in sorted(LANG_RU.items(), key=lambda kv: -len(kv[0])):
        out = re.sub(rf"\b{re.escape(en)}\b", ru, out)
    out = re.sub(r"\band\b", "и", out)
    out = re.sub(r"^(Понимает|понимает)\b", "Понимает", out)
    return fix_ru(re.sub(r"\s+", " ", out))


def tr_type(s):
    if not s:
        return s
    out = s
    # «Средний or Маленький Нежить, Хаотичный Нейтральный»
    parts = [p.strip() for p in out.split(",")]
    body = parts[0] if parts else out
    rest = parts[1:]

    def size_word(word, gender):
        forms = SIZE_AGREE.get(word)
        if not forms:
            return word
        return forms[0] if gender == "m" else forms[1] if gender == "f" else forms[2]

    # тип в конце body
    words = body.split()
    ctype = words[-1].lower() if words else ""
    gender = TYPE_GENDER.get(ctype, "m")
    head = " ".join(words[:-1]) if words else ""
    head = re.sub(r"\bor\b", "или", head)
    head_words = head.split()
    if head_words:
        head_words[0] = size_word(head_words[0], gender)
        if len(head_words) > 2 and head_words[2] in SIZE_AGREE:
            head_words[2] = size_word(head_words[2], gender)
    out = " ".join(head_words + [ctype])
    out = re.sub(r"\(([A-Za-z' -]+)\)", lambda m: "(" + m.group(1).lower() + ")", out)
    if rest:
        al = " ".join(rest).strip()
        out += ", " + ALIGN.get(al, al.lower())
    return out


def tr_cr(s):
    if not s:
        return s
    out = re.sub(r"^None\b", "0", s)
    out = out.replace("XP", "опыт").replace("PB", "БМ")
    out = re.sub(r"БМ equals your Proficiency Bonus", "БМ равен вашему бонусу мастерства", out)
    out = re.sub(r",\s*or\s*([\d ]+)\s*i\b", r", или \1 в логове", out)
    out = re.sub(r",\s*or\s*([\d ]+)\s*in lair", r", или \1 в логове", out)
    out = re.sub(r"\bin lair\b", "в логове", out)
    return re.sub(r"\s+", " ", out).strip()


def tr_skills(s):
    if not s:
        return s
    out = s
    for en, ru in SKILL_RU.items():
        out = out.replace(en, ru)
    out = re.sub(r"\bwhile in snake form\b", "в облике змеи", out)
    out = re.sub(r"\bwhile in .*? form\b", lambda m: "в ином облике", out)
    return out


# ─────────────────────────── основной цикл ───────────────────────────
def fix_only():
    load_cache()
    src = open(OUT, encoding="utf-8").read()
    head = src[: src.index("[")]
    monsters = json.loads(src[src.index("["): src.rindex("]") + 1])
    for m in monsters:
        m["n"] = fix_ru(m.get("n", ""))
        for f in ("type", "sp", "sen", "lang", "sk", "cr"):
            m[f] = fix_ru(m.get(f, ""))
        for a in m.get("acts") or []:
            for k in ("text", "name", "tag"):
                if isinstance(a.get(k), str):
                    a[k] = fix_ru(a[k])
    body = json.dumps(monsters, ensure_ascii=False, separators=(", ", ": "))
    open(OUT, "w", encoding="utf-8").write(head + body + ";\n")
    left = sum(1 for m in monsters for a in (m.get("acts") or [])
               if re.search(r"[A-Za-z]{2,}", a.get("text", "")))
    print("готово, текстов с латиницей:", left)


def main():
    if "--fix" in sys.argv:
        return fix_only()
    dry = "--dry" in sys.argv
    sample = 0
    if "--sample" in sys.argv:
        sample = int(sys.argv[sys.argv.index("--sample") + 1])

    load_cache()
    src = open(OUT, encoding="utf-8").read()
    head = src[: src.index("[")]
    monsters = json.loads(src[src.index("["): src.rindex("]") + 1])
    print("монстров:", len(monsters))

    # 1. собрать все строки, требующие перевода
    prose_keys = []
    for m in monsters:
        for a in m.get("acts") or []:
            for k in ("text", "name", "tag"):
                v = a.get(k)
                if isinstance(v, str) and has_latin(v):
                    prose_keys.append(v)
    names = [m["n"] for m in monsters if has_latin(m.get("n", ""))]
    print("имён с латиницей:", len(names), "| строк прозы:", len(set(prose_keys)))

    if sample:
        prose_keys = random.Random(0).sample(list(set(prose_keys)), min(sample, len(set(prose_keys))))

    t0 = time.time()
    tr_prose = translate_texts(prose_keys)
    tr_names = translate_texts(names)
    print(f"перевод за {time.time() - t0:.0f}s")

    # 2. записать обратно
    for m in monsters:
        if has_latin(m.get("n", "")) and m["n"] in tr_names:
            m["n"] = fix_ru(tr_names[m["n"]]).strip(" .")
        m["type"] = tr_type(m.get("type", ""))
        m["sp"] = tr_speed(m.get("sp", ""))
        m["sen"] = tr_senses(m.get("sen", ""))
        m["lang"] = tr_langs(m.get("lang", ""))
        m["sk"] = tr_skills(m.get("sk", ""))
        m["cr"] = tr_cr(m.get("cr", ""))
        for a in m.get("acts") or []:
            for k in ("text", "name", "tag"):
                v = a.get(k)
                if isinstance(v, str) and v in tr_prose:
                    a[k] = fix_ru(tr_prose[v])

    # 3. отчёт
    left = sum(1 for m in monsters for a in (m.get("acts") or []) if has_latin(a.get("text", "")))
    print("осталось английских текстов:", left)
    for m in monsters[:3]:
        print("  •", m["n"], "|", m["type"], "|", m["sp"], "|", m["lang"])
        for a in (m.get("acts") or [])[:1]:
            print("    -", a.get("text", "")[:180])

    if dry or sample:
        return
    body = json.dumps(monsters, ensure_ascii=False, separators=(", ", ": "))
    open(OUT, "w", encoding="utf-8").write(head + body + ";\n")
    print("записано:", OUT)


if __name__ == "__main__":
    main()
