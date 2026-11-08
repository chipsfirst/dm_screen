#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Точная пересборка поля type у бестиария из английских источников.

Берёт английские типы из data/monsters2024.json (строкой) и
data/bestiary/bestiary-*.json (size/type/alignment отдельными полями),
сопоставляет по английскому имени (поле en) и строит русскую строку
с согласованием рода и падежа.

Запуск: python3 _fix_bestiary_types.py [--dry]
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(HERE, "js", "data", "bestiary-data.js")

SIZE_ADJ = {
    "Tiny": ("Крошечный", "Крошечная", "Крошечное", "крошечных"),
    "Small": ("Маленький", "Маленькая", "Маленькое", "маленьких"),
    "Medium": ("Средний", "Средняя", "Среднее", "средних"),
    "Large": ("Большой", "Большая", "Большое", "больших"),
    "Huge": ("Огромный", "Огромная", "Огромное", "огромных"),
    "Gargantuan": ("Гигантский", "Гигантская", "Гигантское", "гигантских"),
}

TYPE_RU = {
    "aberration": ("аберрация", "аберраций", "f"),
    "beast": ("зверь", "зверей", "m"),
    "celestial": ("небожитель", "небожителей", "m"),
    "construct": ("конструкт", "конструктов", "m"),
    "dragon": ("дракон", "драконов", "m"),
    "elemental": ("элементаль", "элементалей", "m"),
    "fey": ("фея", "фей", "f"),
    "fiend": ("исчадие", "исчадий", "n"),
    "giant": ("гигант", "гигантов", "m"),
    "humanoid": ("гуманоид", "гуманоидов", "m"),
    "monstrosity": ("чудовище", "чудовищ", "n"),
    "ooze": ("тварь-желе", "тварей-желе", "f"),
    "plant": ("растение", "растений", "n"),
    "undead": ("нежить", "нежити", "f"),
    "swarm of": ("стая", "стай", "f"),
    "beasts": ("звери", "зверей", "m"), "fiends": ("исчадия", "исчадий", "n"),
    "monstrosities": ("чудовища", "чудовищ", "n"), "undead": ("нежить", "нежити", "f"),
}

TAG_RU = {
    "chromatic": "хроматический", "metallic": "металлический", "gem": "самоцветный",
    "demon": "демон", "devil": "дьявол", "yugoloth": "юголот", "slaad": "слаад",
    "dinosaur": "динозавр", "gith": "гиф", "beholder": "созерцатель", "angel": "ангел",
    "titan": "титан", "genie": "джинн", "goblinoid": "гоблиноид", "wizard": "волшебник",
    "cleric": "жрец", "human": "человек", "elf": "эльф", "dwarf": "дварф",
    "lycanthrope": "ликантроп", "any race": "любая раса", "your choice": "на выбор",
    "shapechanger": "оборотень", "kobold": "кобольд", "orc": "орк", "goblin": "гоблин",
    "gnoll": "гнолл", "lizardfolk": "ящеролюд", "bullywug": "булливуг", "aarakocra": "ааракокра",
    "merfolk": "тритон", "yuan-ti": "юань-ти", "thri-kreen": "три-крин", "sahuagin": "сагуагин",
    "kuo-toa": "куо-тоа", "gnome": "гном", "halfling": "полурослик", "troll": "тролль",
    "vampire": "вампир", "wererat": "крысооборотень", "mongoose": "мангуст",
}

ALIGN = {
    "Lawful Good": "законно-добрый", "Lawful Neutral": "законно-нейтральный",
    "Lawful Evil": "законно-злой", "Neutral Good": "нейтрально-добрый",
    "Neutral Evil": "нейтрально-злой", "Chaotic Good": "хаотично-добрый",
    "Chaotic Neutral": "хаотично-нейтральный", "Chaotic Evil": "хаотично-злой",
    "Neutral": "нейтральный", "Unaligned": "без мировоззрения",
    "Any Alignment": "любое мировоззрение", "Any alignment": "любое мировоззрение",
    "Any Good": "любое доброе", "Any Evil": "любое злое", "Any Chaotic": "любое хаотичное",
    "Any Lawful": "любое законное", "Any Non-Good": "любое не-доброе",
}

ALIGN_LETTERS = {
    "L": "законно", "N": "нейтрально", "C": "хаотично", "G": "добрый", "E": "злой",
    "U": "без мировоззрения", "A": "любое мировоззрение", "NX": "нейтрально",
    "NY": "нейтрально", "NG": "нейтрально-добрый", "NE": "нейтрально-злой",
}


def align_from_letters(parts):
    """['C','E'] -> 'хаотично-злой'; ['N'] -> 'нейтральный'."""
    letters = [str(p).strip().upper() for p in parts if str(p).strip()]
    if not letters:
        return None
    if len(letters) == 1:
        one = letters[0]
        if one in ("U", "A", "N"):
            return {"U": "без мировоззрения", "A": "любое мировоззрение", "N": "нейтральный"}[one]
        return ALIGN_LETTERS.get(one)
    law = {"L": "законно", "N": "нейтрально", "C": "хаотично"}
    moral = {"G": "-добрый", "E": "-злой", "N": ""}
    a = next((law[x] for x in letters if x in law), "нейтрально")
    b = next((moral[x] for x in letters if x in moral and x != "N" or (x == "N" and len(letters) == 2)), "")
    if not b or b == "-" :
        return a + "-нейтральный"
    return a + b


def align_ru(s):
    s = s.strip().rstrip(".")
    if s in ALIGN:
        return ALIGN[s]
    low = s.lower()
    for k, v in ALIGN.items():
        if k.lower() == low:
            return v
    return None


def size_adj(size, gender):
    forms = SIZE_ADJ.get(size)
    if not forms:
        return size
    return forms[0] if gender == "m" else forms[1] if gender == "f" else forms[2]


def size_gen(size):
    forms = SIZE_ADJ.get(size)
    return forms[3] if forms else size.lower()


def decline_align(al, gender):
    """Согласует прилагательное мировоззрения с родом типа."""
    if not al or gender == "m":
        return al
    if al in ("без мировоззрения", "любое мировоззрение", "любое доброе", "любое злое",
              "любое хаотичное", "любое законное", "любое не-доброе"):
        return al
    end = {"f": ("ый", "ая"), "n": ("ый", "ое")}.get(gender)
    if not end:
        return al
    a, b = end
    if al.endswith(a):
        return al[: -len(a)] + b
    return al


def parse(en_type):
    """EN строка типа -> RU строка."""
    if not en_type:
        return None
    en_type = re.sub(r"\s+", " ", en_type.strip())
    body, al = en_type, None
    m = re.match(r"^(.*?[,)])\s*([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё -]+)$", en_type)
    if m:
        tail = m.group(2).strip()
        guess = align_ru(tail)
        if guess:
            body, al = m.group(1).rstrip(", "), guess
        elif re.search(r"[А-Яа-яЁё]", tail) and any(
                w in tail.lower() for w in ("добр", "злой", "нейтральн", "мировоззрен", "законн", "хаотичн")):
            body, al = m.group(1).rstrip(", "), tail.lower()

    # стая
    sw = re.match(r"^(\w+)(?: or (\w+))? [sS]warm of (\w+) ([A-Za-z-]+)(?: \(([^)]+)\))?$", body)
    if sw:
        cnt = size_adj(sw.group(1), "f")
        inner_size = size_gen(sw.group(3))
        itype = TYPE_RU.get(sw.group(4).lower(), (sw.group(4).lower(), sw.group(4).lower(), "m"))
        tag = f" ({TAG_RU.get(sw.group(5).lower(), sw.group(5).lower())})" if sw.group(5) else ""
        out = f"{cnt} стая {inner_size} {itype[1]}{tag}"
        return out + (f", {decline_align(al, 'f')}" if al else "")

    m = re.match(r"^(\w+)(?: or (\w+))? ([A-Za-z -]+?)(?: \(([^)]+)\))?$", body)
    if not m:
        return None
    size1, size2, tname, tag = m.group(1), m.group(2), m.group(3).strip(), m.group(4)
    parts = [p.strip() for p in tname.split(" or ")]
    info = [TYPE_RU.get(p.lower(), (p.lower(), p.lower(), "m")) for p in parts]
    gender = info[0][2]
    adj1 = size_adj(size1, gender)
    if size2:
        if size2 == "Smaller":
            adj2 = {"m": "меньший", "f": "меньшая", "n": "меньшее"}[gender]
        else:
            adj2 = size_adj(size2, gender)
        size_part = f"{adj1} или {adj2.lower() if size2 != 'Smaller' else adj2}"
    else:
        size_part = adj1
    tpart = " или ".join(i[0] for i in info)
    tag_part = f" ({TAG_RU.get(tag.lower(), tag.lower())})" if tag else ""
    out = f"{size_part} {tpart}{tag_part}"
    return out + (f", {decline_align(al, gender)}" if al else "")


def collect_english():
    """en-имя -> английская строка типа."""
    m = {}
    p = os.path.join(HERE, "data", "monsters2024.json")
    if os.path.exists(p):
        for x in json.load(open(p, encoding="utf-8")):
            if x.get("name") and x.get("type"):
                m[x["name"]] = x["type"]
    for fn in ("bestiary-mm.json", "bestiary-cos.json"):
        p = os.path.join(HERE, "data", "bestiary", fn)
        if not os.path.exists(p):
            continue
        d = json.load(open(p, encoding="utf-8"))
        arr = d.get("monster", d) if isinstance(d, dict) else d
        for x in arr:
            name = x.get("name")
            if not name or name in m:
                continue
            size = x.get("size") or []
            size = size[0] if isinstance(size, list) and size else "M"
            t = x.get("type") or {}
            if isinstance(t, dict):
                tname = (t.get("type") or "").capitalize()
                tags = t.get("tags") or []
                if isinstance(tags, dict):
                    tags = list(tags.values())
                tags = [str(v).strip() for v in tags if not isinstance(v, (dict, list))]
                tag = f" ({tags[0].title()})" if tags else ""
            else:
                tname, tag = str(t).capitalize(), ""
            al = x.get("alignment") or []
            if isinstance(al, list):
                al_ru = align_from_letters(al)
                al = al_ru or " ".join(str(v) for v in al)
            else:
                al = str(al)
            if not al:
                al = "Unaligned"
            size_map = {"T": "Tiny", "S": "Small", "M": "Medium", "L": "Large", "H": "Huge", "G": "Gargantuan"}
            m[name] = f"{size_map.get(size, size)} {tname}{tag}, {al}"
    return m


def main():
    dry = "--dry" in sys.argv
    src = open(OUT, encoding="utf-8").read()
    head = src[: src.index("[")]
    mons = json.loads(src[src.index("["): src.rindex("]") + 1])
    eng = collect_english()
    print("английских типов собрано:", len(eng))

    ok, bad = 0, []
    for x in mons:
        en = x.get("en") or x.get("n")
        raw = eng.get(en)
        ru = parse(raw) if raw else None
        if ru:
            x["type"] = ru
            ok += 1
        else:
            bad.append((x.get("n"), en, raw, x.get("type")))
    print(f"пересобрано: {ok}, без источника/разбора: {len(bad)}")
    for b in bad[:10]:
        print("  !", b)

    if not dry:
        body = json.dumps(mons, ensure_ascii=False, separators=(", ", ": "))
        open(OUT, "w", encoding="utf-8").write(head + body + ";\n")
        print("записано")


if __name__ == "__main__":
    main()
