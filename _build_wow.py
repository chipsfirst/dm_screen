#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка контента World of Warcraft (5e-конверсия) в wow-data.js.

Читает:
  data/wow/bestiary-wow.json — статблоки (86);
  data/wow/spells-wow.json   — заклинания (69);
  data/wow/items.json        — предметы с source=WoW (64).

Пишет:
  wow-data.js — window.WOW_DATA = { monsters, spells, items };
  app.js подмешивает его в бестиарий, библиотеку и магазин.

Теги 5e.tools ({@spell}, {@hit}, {@damage}, {@dc}, {@recharge}, {@atk} …)
подставляются русским текстом, а в перевод уходят заглушками [#0#], чтобы
Google не портил имена заклинаний и формулы.

Запуск: python3 _build_wow.py [--dry]
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import _merge_bestiary as MB
import _translate_bestiary_ru as TR

SRC = os.path.join(HERE, "data", "wow")
OUT = os.path.join(HERE, "wow-data.js")

TAGS = re.compile(r"<[^>]+>")
TAG_RE = re.compile(r"\{@(\w+)(?:\s+([^{}]*))?\}")
MARK = re.compile(r"\[#(\d+)#\]")
FEET = re.compile(r"фут(ов|а|ах|ам|ами|е)?\b")
TYPE_LOWER = re.compile(r"^(Крошечн\w+|Маленьк\w+|Средн\w+|Больш\w+|Огромн\w+|Гигантск\w+|Колоссальн\w+)\s+([А-ЯЁ])([а-яё]+)")

SCHOOL = {"A": "Ограждение", "C": "Вызов", "D": "Прорицание", "E": "Приказ",
          "V": "Воплощение", "I": "Иллюзия", "N": "Некромантия", "T": "Преображение"}
UNIT = {"action": "действие", "bonus": "бонусное действие", "reaction": "реакция",
        "minute": "мин.", "hour": "ч.", "round": "раунд", "day": "день"}
RARITY = {"common": "обычный", "uncommon": "необычный", "rare": "редкий",
          "very rare": "очень редкий", "legendary": "легендарный",
          "artifact": "артефакт", "varies": "варьируется", "none": "—", "unknown": "—"}
ITYPE = {"M": "оружие", "R": "оружие", "LA": "лёгкий доспех", "MA": "средний доспех",
         "HA": "тяжёлый доспех", "S": "щит", "P": "зелье", "SC": "свиток", "RD": "жезл",
         "WD": "волшебная палочка", "RG": "кольцо", "W": "чудесный предмет",
         "MNT": "скакун", "VEH": "транспорт", "AIR": "воздушный транспорт",
         "G": "снаряжение", "T": "инструмент", "GUN": "оружие", "AF": "боеприпасы"}
ATK = {"mw": "рукопашная атака оружием", "rw": "дальнобойная атака оружием",
       "ms": "рукопашная атака заклинанием", "rs": "дальнобойная атака заклинанием"}

SPELL_RU = {}


def load_js(path, var):
    t = open(os.path.join(HERE, path), encoding="utf-8").read()
    i = t.index(var)
    return json.loads(t[i:][t[i:].index("=") + 1:].strip().rstrip(";"))


def load_spell_map():
    """Английские заклинания PHB 2024 → русские названия из library-data.js (по индексу)."""
    try:
        en = json.load(open(os.path.join(HERE, "data", "spells-phb2024.json"), encoding="utf-8"))["spell"]
        lib = load_js("library-data.js", "window.LIBRARY")["spells"]
        for a, b in zip(en, lib):
            if a.get("name") and b.get("n"):
                SPELL_RU[a["name"].lower()] = b["n"]
        print(f"  карта заклинаний: {len(SPELL_RU)}")
    except Exception as e:
        print("  (карта заклинаний не загружена:", e, ")")


TERM_RU = {}
SAVE_RU = {"str": "Силы", "dex": "Ловкости", "con": "Телосложения",
           "int": "Интеллекта", "wis": "Мудрости", "cha": "Харизмы"}


def render_tag(tag, args):
    seg = [a.strip() for a in str(args or "").split("|")]
    first = seg[0] if seg else ""
    disp = next((x for x in reversed(seg[1:]) if x and not x.replace("-", "").isupper()), "")
    t = tag.lower()
    if t == "spell":
        return SPELL_RU.get(first.lower(), disp or first)
    if t == "dc":
        return "Сл " + first
    if t == "hit":
        return ("+" + first) if not first.startswith("-") else first
    if t == "h":
        return "Попадание: "
    if t in ("damage", "dice"):
        return first
    if t in ("scaledamage", "scaledice"):
        return seg[-1]
    if t == "recharge":
        return "перезарядка " + first
    if t in ("atk", "atkr", "atkroll"):
        parts = []
        for x in re.split(r"[,;]", first):
            x = x.strip().lower()
            parts.append({"m": "рукопашная атака", "r": "дальнобойная атака",
                          "mw": "рукопашная атака оружием", "rw": "дальнобойная атака оружием",
                          "ms": "рукопашная атака заклинанием", "rs": "дальнобойная атака заклинанием"
                          }.get(x, x))
        return " или ".join(p for p in parts if p)
    if t == "actsave":
        return "спасбросок " + SAVE_RU.get(first.lower(), first)
    if t == "actsavefail":
        return "При провале: "
    if t == "actsavesuccess":
        return "При успехе: "
    if t == "actsavesuccessorfail":
        return "При успехе или провале: "
    if t == "acttrigger":
        return "Триггер: "
    if t == "actresponse":
        return "Отклик: "
    if t == "hom":
        return "Попадание или промах: "
    if t == "hityourspellattack":
        return "ваш бонус атаки заклинанием"
    if t == "skill":
        return MB.SKILL_RU.get(first, first)
    if t in ("condition", "status"):
        return TERM_RU.get(first.lower(), first)
    if t in ("variantrule", "action", "sense", "hazard", "item", "creature", "object", "reward"):
        key = (disp or first).lower()
        return TERM_RU.get(key, disp or first)
    return disp or first


def collect_terms(texts):
    """Собирает термины из тегов (условия, правила, действия), которые надо перевести."""
    terms = set()
    for text in texts:
        for m in TAG_RE.finditer(str(text or "")):
            tag = m.group(1).lower()
            if tag not in ("condition", "status", "variantrule", "action", "sense", "hazard",
                           "item", "creature", "object", "reward"):
                continue
            seg = [a.strip() for a in str(m.group(2) or "").split("|")]
            first = seg[0] if seg else ""
            disp = next((x for x in reversed(seg[1:]) if x and not x.replace("-", "").isupper()), "")
            term = (disp or first).strip()
            if term and term.lower() not in TERM_RU:
                terms.add(term)
    return terms


def load_terms(texts):
    """Переводит термины тегов и заполняет TERM_RU."""
    TR.load_cache()
    terms = collect_terms(texts)
    if not terms:
        return
    tr = TR.translate_texts(sorted(terms))
    for t in terms:
        TERM_RU[t.lower()] = polish(TR.fix_ru(tr.get(t, t))).lower()


GLOBAL_REPL = {}
GID = [0]


def new_marker(value):
    GID[0] += 1
    GLOBAL_REPL[GID[0]] = value
    return f"[#{GID[0]}#]"


def mask_tags(text, repl=None):
    """Заменяет теги уникальными заглушками; возвращает (текст, список подстановок)."""
    repl = repl if repl is not None else []

    def sub(m):
        val = render_tag(m.group(1), m.group(2))
        repl.append(val)
        return new_marker(val)

    s = TAG_RE.sub(sub, str(text or ""))
    s = TAGS.sub("", s)
    return s, repl


def mask_names(text, names, repl):
    """Прячет названия приёмов заглушками, чтобы переводчик их не портил."""
    s = str(text or "")
    for en, ru in sorted(names.items(), key=lambda kv: -len(kv[0])):
        if not en:
            continue
        pat = re.compile(rf"(?<![\w-]){re.escape(en)}(?![\w-])", re.I)
        if pat.search(s):
            repl.append(ru)
            s = pat.sub(new_marker(ru), s)
    return s


def unmask(text, repl=None):
    return MARK.sub(lambda m: GLOBAL_REPL.get(int(m.group(1)), ""), str(text or ""))


def polish(t):
    t = re.sub(r"\s+", " ", str(t or "")).strip()
    t = FEET.sub("фт", t)
    t = re.sub(r"\bфт(м|х|ам|ах)\b", "фт", t)
    t = re.sub(r"\s+([,.;:!?)])", r"\1", t)
    t = re.sub(r"\(\s*\)", "", t)
    t = re.sub(r"\s{2,}", " ", t)
    return t.strip(" ,;")


FIXES = [
    (r"\bвременные очки жизни\b", "временные хиты"),
    (r"(\d+) временные хиты\b", r"\1 временных хитов"),
    (r"\bполучает (\d+) временных хитов\b", r"получает \1 временных хитов"),
    (r"\bочки жизни\b", "хиты"),
    (r"\bиспользованием Использование заклинаний\b", "использованием заклинаний"),
    (r"\bспособность Использование заклинаний\b", "способность к заклинаниям"),
    (r"\bспособности Использование заклинаний\b", "способности к заклинаниям"),
    (r"\bатаки возможностей\b", "атаки по возможности"),
    (r"\bсохранение заклинания\b", "Сл спасброска от заклинаний"),
    (r"\bспасение заклинания\b", "Сл спасброска от заклинаний"),
    (r"\bпреимущество спасброски\b", "преимущество на спасброски"),
    (r"\bпреимущество бросок\b", "преимущество на бросок"),
    (r"\bпреимущества спасброски\b", "преимущество на спасброски"),
    (r"\bпомеха спасброски\b", "помеха на спасброски"),
    (r"(\d+)-футовом эманация\b", r"\1-футовой эманации"),
    (r"(\d+)-футовой эманация\b", r"\1-футовой эманации"),
    (r"\bэманация (\d+) фт\b", r"эманация \1 фт"),
    (r"\bфутовом эманация\b", "футовой эманации"),
    (r"\bв эманация\b", "в эманации"),
    (r"\s+([,.;:!?])", r"\1"),
]


def post_fix(t):
    for pat, rep in FIXES:
        t = re.sub(pat, rep, t, flags=re.I)
    t = re.sub(r"\s{2,}", " ", t).strip()
    return t


def fix_type(t):
    m = TYPE_LOWER.match(t or "")
    if not m:
        return t
    return m.group(1) + " " + m.group(2).lower() + m.group(3) + t[m.end():]


def flat(entries):
    out = []
    if isinstance(entries, str):
        return [entries]
    if isinstance(entries, list):
        for e in entries:
            out += flat(e)
    elif isinstance(entries, dict):
        if entries.get("name"):
            out.append(str(entries["name"]) + ".")
        for k in ("entries", "items", "entry"):
            if isinstance(entries.get(k), (list, str)):
                out += flat(entries[k])
        if isinstance(entries.get("rows"), list):
            for row in entries["rows"]:
                cells = [str(c) for c in row if isinstance(c, str) and str(c).strip()]
                if cells:
                    out.append(" · ".join(cells))
    return out


def time_ru(t):
    if not isinstance(t, list) or not t:
        return ""
    parts = []
    for x in t:
        if isinstance(x, str):
            parts.append(x)
            continue
        n = x.get("number")
        u = UNIT.get(str(x.get("unit")), str(x.get("unit") or ""))
        parts.append((str(n) + " " if n else "") + u)
    return ", ".join(p for p in parts if p)


def range_ru(r):
    if not isinstance(r, dict):
        return ""
    t = r.get("type")
    d = r.get("distance") or {}
    if not t and d:
        t = "point"
    if t == "point":
        if d.get("type") == "self":
            return "на себя"
        if d.get("type") == "touch":
            return "касание"
        if d.get("type") == "sight":
            return "в пределах видимости"
        if d.get("type") == "unlimited":
            return "без ограничений"
        amt, unit = d.get("amount"), str(d.get("type") or "")
        unit = {"feet": "фт", "miles": "миль", "mile": "миля"}.get(unit, unit)
        return f"{amt} {unit}".strip()
    if t == "self":
        return "на себя"
    if t == "touch":
        return "касание"
    if t == "special":
        return "особая"
    if t == "emanation":
        return f"эманация {d.get('amount')} фт"
    if t in ("radius", "sphere", "cone", "line", "cube"):
        base = {"radius": "радиус", "sphere": "сфера", "cone": "конус", "line": "линия", "cube": "куб"}
        return f"{base[t]} {d.get('amount')} фт"
    return ""


def duration_ru(dur):
    if not isinstance(dur, list) or not dur:
        return ""
    parts = []
    for x in dur:
        if isinstance(x, str):
            parts.append(x)
            continue
        t = x.get("type")
        if t == "instant":
            parts.append("Мгновенно")
        elif t == "permanent":
            parts.append("Постоянно")
        elif t == "special":
            parts.append("Особая")
        elif t == "timed":
            d = x.get("duration") or {}
            amt = d.get("amount")
            unit = {"minute": "мин.", "hour": "ч.", "round": "раунд", "day": "день",
                    "week": "неделя", "year": "год"}.get(str(d.get("type")), str(d.get("type") or ""))
            s = (f"{amt} " if amt else "") + unit
            if x.get("concentration"):
                s = "Концентрация, до " + s
            parts.append(s)
    return ", ".join(p for p in parts if p)


def comps_ru(c, tr):
    if not isinstance(c, dict):
        return ""
    parts = []
    if c.get("v"):
        parts.append("В")
    if c.get("s"):
        parts.append("С")
    m = c.get("m")
    if m:
        if isinstance(m, dict):
            m = m.get("text") or ""
        m = str(m)
        m = TR.fix_ru(tr.get(m, m))
        parts.append("М (" + polish(m)[:60] + ")" if m else "М")
    return ", ".join(parts)


def translate_texts(items):
    """items: список (text, repl) → список переведённых с восстановленными тегами."""
    TR.load_cache()
    masked = [t for t, _ in items]
    tr = TR.translate_texts([t for t in dict.fromkeys(masked) if t and TR.has_latin(t)])
    out = []
    for text, repl in items:
        translated = tr.get(text, text)
        out.append(polish(TR.fix_ru(unmask(translated, repl))))
    return out


def monster_acts(m):
    """Действия статблока: свои записи + блоки заклинаний, теги в заглушки."""
    raw = []

    def add(name, entries, tag):
        body = " ".join(flat(entries))
        raw.append(((name or ""), body, tag))

    for key, tag in (("trait", "Черты"), ("action", "Действия"), ("bonus", "Бонус"),
                     ("reaction", "Реакция"), ("legendary", "Легендарные")):
        for it in (m.get(key) or []):
            if isinstance(it, dict):
                add(it.get("name", ""), it.get("entries") or it.get("entry") or [], tag)
            elif isinstance(it, str):
                add("", it, tag)

    for sc in (m.get("spellcasting") or []):
        if not isinstance(sc, dict):
            continue
        parts = list(sc.get("headerEntries") or [])
        for key, label in (("will", "По желанию"),):
            val = sc.get(key)
            if isinstance(val, list) and val:
                parts.append(label + ": " + ", ".join(str(x) for x in val) + ".")
        daily = sc.get("daily")
        if isinstance(daily, dict):
            for freq, arr in daily.items():
                if isinstance(arr, list) and arr:
                    n = freq[:-1] if freq.endswith("e") else freq
                    parts.append(f"{n}/день: " + ", ".join(str(x) for x in arr) + ".")
        for lvl in (sc.get("spells") or []):
            if isinstance(lvl, dict):
                items = [str(x) for x in flat(lvl.get("spells"))]
                if items:
                    parts.append(f"{lvl.get('level', '')} уровень: " + ", ".join(items) + ".")
        add(sc.get("name") or "Использование заклинаний", parts, "Черты")
    return raw


def build_monsters():
    data = json.load(open(os.path.join(SRC, "bestiary-wow.json"), encoding="utf-8"))
    mons = data["monster"] if isinstance(data, dict) else data
    prepared, jobs = [], []
    for m in mons:
        if not m.get("name"):
            continue
        try:
            base = MB.row_5e(m, {})
        except Exception:
            continue
        acts = []
        for name, body, tag in monster_acts(m):
            acts.append({"tag": tag, "_en": name, "_raw": body})
        prepared.append((m, base, acts))

    # проход 1: названия приёмов
    name_jobs = []
    for m, base, acts in prepared:
        for a in acts:
            nm, _ = mask_tags(a.get("_en") or "")
            a["_name_m"] = nm
            name_jobs.append(nm)
    tr_names = translate_texts([(n, []) for n in name_jobs])
    name_map = {}
    for key, val in zip(name_jobs, tr_names):
        if key:
            name_map.setdefault(key, val[0].upper() + val[1:] if val else val)

    # проход 2: тексты с подстановкой названий приёмов и тегов
    jobs = []
    for m, base, acts in prepared:
        names = {}
        for a in acts:
            en = (a.get("_en") or "").strip()
            ru = name_map.get(a.get("_name_m") or "", "")
            if en and ru:
                names[en] = ru
        for a in acts:
            repl = []
            body_m, repl = mask_tags(a.get("_raw") or "", repl)
            body_m = mask_names(body_m, names, repl)
            a["_body_m"] = body_m
            a["_job"] = len(jobs)
            jobs.append((body_m, repl))

    translated = translate_texts(jobs)

    out = []
    for m, base, acts in prepared:
        en = m.get("name", "")
        nm, nm_r = mask_tags(en)
        name_ru = polish(TR.fix_ru(translated_name(nm, nm_r, en)))
        res = {
            "n": name_ru, "en": en,
            "type": fix_type(TR.tr_type(polish(mask_plain(base.get("type", ""))))),
            "cr": TR.tr_cr(base.get("cr", "")),
            "ac": polish(mask_plain(base.get("ac", ""))),
            "hp": polish(base.get("hp", "")),
            "sp": TR.tr_speed(polish(mask_plain(base.get("sp", "")))),
            "init": base.get("init", ""),
            "ab": base.get("ab", ""),
            "ab_list": base.get("ab_list") or [],
            "sk": TR.tr_skills(polish(mask_plain(base.get("sk", "")))),
            "sen": TR.tr_senses(polish(mask_plain(base.get("sen", "")))),
            "lang": TR.tr_langs(polish(mask_plain(base.get("lang", "")))),
            "img": base.get("img") or "",
            "acts": [],
        }
        for a in acts:
            name_txt = name_map.get(a.get("_name_m") or "", "").rstrip(" .:")
            job = a.get("_job")
            body_txt = (translated[job] if job is not None and job < len(translated) else a.get("_body_m") or "").rstrip(" .")
            txt = (name_txt + ". " + body_txt).strip(". ") if name_txt else body_txt
            txt = re.sub(r"\[#\d+#\]", "", txt)
            txt = post_fix(re.sub(r"\s+", " ", txt).strip())
            if len(txt) > 3:
                res["acts"].append({"tag": a["tag"], "text": (txt.rstrip(" .,") + ".") if len(txt) > 12 else txt})
        out.append(res)
    return out


def translated_name(masked, repl, en):
    TR.load_cache()
    tr = TR.translate_texts([masked]) if TR.has_latin(masked) else {}
    return tr.get(masked, masked)


def mask_plain(text):
    masked, repl = mask_tags(text)
    if repl:
        return unmask(masked, repl)
    return masked


def build_spells():
    data = json.load(open(os.path.join(SRC, "spells-wow.json"), encoding="utf-8"))
    sp = data["spell"] if isinstance(data, dict) else data
    jobs, prepared = [], []
    for s in sp:
        body = " ".join(flat(s.get("entries")))
        higher = " ".join(flat(s.get("entriesHigherLevel")))
        if higher:
            body = (body + " На более высоких уровнях: " + higher).strip()
        nm_m, nm_r = mask_tags(s.get("name", ""))
        bd_m, bd_r = mask_tags(body)
        m = (s.get("components") or {}).get("m")
        mat = str(m) if isinstance(m, str) else ""
        jobs += [(nm_m, nm_r), (bd_m, bd_r)]
        prepared.append((s, nm_m, bd_m, mat))
    translated = translate_texts(jobs)
    tmap = {}
    for (key, _), val in zip(jobs, translated):
        tmap.setdefault(key, val)
    out = []
    for s, nm_m, bd_m, mat in prepared:
        out.append({
            "n": tmap.get(nm_m, nm_m),
            "en": s.get("name", ""),
            "l": s.get("level", 0),
            "sc": SCHOOL.get(str(s.get("school")), str(s.get("school") or "")),
            "t": time_ru(s.get("time")),
            "r": range_ru(s.get("range")),
            "c": comps_ru(s.get("components"), tmap),
            "d": duration_ru(s.get("duration")),
            "cls": "",
            "desc": tmap.get(bd_m, bd_m),
        })
    return out


def build_items():
    path = os.path.join(SRC, "items-wow.json")
    data = json.load(open(path, encoding="utf-8"))
    itw = data["item"] if isinstance(data, dict) else data
    jobs, prepared = [], []
    for it in itw:
        body = " ".join(flat(it.get("entries")))
        nm_m, nm_r = mask_tags(it.get("name", ""))
        bd_m, bd_r = mask_tags(body)
        jobs += [(nm_m, nm_r), (bd_m, bd_r)]
        prepared.append((it, nm_m, bd_m))
    translated = translate_texts(jobs)
    tmap = {}
    for (key, _), val in zip(jobs, translated):
        tmap.setdefault(key, val)
    out = []
    for it, nm_m, bd_m in prepared:
        tcode = str(it.get("type") or "").split("|")[0]
        out.append({
            "n": tmap.get(nm_m, nm_m),
            "en": it.get("name", ""),
            "rarity": RARITY.get(str(it.get("rarity")).lower(), "—"),
            "att": bool(it.get("reqAttune")),
            "type": ITYPE.get(tcode, "чудесный предмет" if it.get("wondrous") else "предмет"),
            "d": tmap.get(bd_m, ""),
        })
    return out


def all_raw_texts():
    """Все тексты источников — для предварительного перевода терминов из тегов."""
    out = []
    mon = json.load(open(os.path.join(SRC, "bestiary-wow.json"), encoding="utf-8"))
    mon = mon["monster"] if isinstance(mon, dict) else mon
    for m in mon:
        for k in ("trait", "action", "bonus", "reaction", "legendary", "spellcasting"):
            out.append(json.dumps(m.get(k) or [], ensure_ascii=False))
    sp = json.load(open(os.path.join(SRC, "spells-wow.json"), encoding="utf-8"))
    sp = sp["spell"] if isinstance(sp, dict) else sp
    for x in sp:
        out.append(json.dumps(x.get("entries") or [], ensure_ascii=False))
        out.append(json.dumps(x.get("entriesHigherLevel") or [], ensure_ascii=False))
    it = json.load(open(os.path.join(SRC, "items-wow.json"), encoding="utf-8"))
    it = it["item"] if isinstance(it, dict) else it
    for x in it:
        out.append(json.dumps(x.get("entries") or [], ensure_ascii=False))
    return out


LATIN_PHRASE = re.compile(r"\b[A-Za-z][A-Za-z'’\-]*(?:\s+[A-Za-z][A-Za-z'’\-]*)*\b")


def clean_leftovers(monsters):
    """Переводит оставшиеся в тексте латинские куски (имена, термины, приёмы)."""
    TR.load_cache()
    found = set()
    for m in monsters:
        for a in m["acts"]:
            for w in LATIN_PHRASE.findall(a["text"]):
                if len(w) > 2 and w.lower() not in {"dc", "hp", "ac", "ft", "xp", "pb"}:
                    found.add(w)
    if not found:
        return monsters
    tr = TR.translate_texts(sorted(found, key=len, reverse=True))
    pairs = sorted(((w, polish(TR.fix_ru(tr.get(w, w)))) for w in found), key=lambda kv: -len(kv[0]))
    for m in monsters:
        for a in m["acts"]:
            txt = a["text"]
            for en, ru in pairs:
                if en and ru and en.lower() != ru.lower():
                    txt = re.sub(rf"(?<![\w-]){re.escape(en)}(?![\w-])", ru, txt)
            a["text"] = post_fix(txt)
    return monsters


def main():
    load_spell_map()
    load_terms(all_raw_texts())
    print("  терминов из тегов:", len(TERM_RU))
    monsters = clean_leftovers(build_monsters())
    spells = build_spells()
    items = build_items()
    print(f"монстров: {len(monsters)} | заклинаний: {len(spells)} | предметов: {len(items)}")
    for m in monsters[:3]:
        print("  М:", m["n"], "|", m["type"], "| КД", m["ac"], "| ХП", m["hp"])
    casters = [m for m in monsters if any("Использование заклинаний" in a["text"] or "произносит" in a["text"] for a in m["acts"])]
    print("  со заклинаниями в статблоке:", len(casters))
    for s in spells[:3]:
        print("  З:", s["n"], "| ур.", s["l"], s["sc"], "|", s["t"], "|", s["r"], "|", s["d"])
    for i in items[:3]:
        print("  П:", i["n"], "|", i["type"], "|", i["rarity"], "|", i["d"][:60])
    if "--dry" in sys.argv:
        return
    payload = {"monsters": monsters, "spells": spells, "items": items}
    header = ("// World of Warcraft для D&D 5e (конверсия) — бестиарий, заклинания, предметы. "
              f"{len(monsters)}/{len(spells)}/{len(items)}.\n")
    open(OUT, "w", encoding="utf-8").write(header + "window.WOW_DATA = " + json.dumps(payload, ensure_ascii=False) + ";\n")
    print("Готово:", OUT)


if __name__ == "__main__":
    main()
