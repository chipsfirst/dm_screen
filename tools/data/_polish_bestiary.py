#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Финальная полировка полей бестиария: типы, скорости, CR.

Чинит то, что осталось после машинного перевода:
  * согласование размера с родом типа («Крошечный Исчадие» → «Крошечное исчадие»);
  * английские подтипы в скобках (mongrelfolk, wizard, devil …);
  * обрезанные хвосты строк из исходного мержа («… (bear form onl», «… БМ equals yo»);
  * «(hover; X only)» и «when rolling».
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(HERE, "js", "data", "bestiary-data.js")

SIZE_FORMS = {
    "крошечн": ("ый", "ая", "ое"), "маленьк": ("ий", "ая", "ое"),
    "средн": ("ий", "яя", "ее"), "больш": ("ой", "ая", "ое"),
    "огромн": ("ый", "ая", "ое"), "гигантск": ("ий", "ая", "ое"),
}
TYPE_GENDER = {
    "аберрация": "f", "зверь": "m", "небожитель": "m", "конструкт": "m", "дракон": "m",
    "элементаль": "m", "фея": "f", "исчадие": "n", "гигант": "m", "гуманоид": "m",
    "чудовище": "n", "тварь-желе": "f", "растение": "n", "нежить": "f", "стая": "f",
}
TAG_RU = {
    "mongrelfolk": "полукровки", "lycanthrope": "ликантроп", "wizard": "волшебник",
    "devil": "дьявол", "demon": "демон", "beast": "зверь", "yugoloth": "юголот",
    "gith": "гиф", "dinosaur": "динозавр", "beholder": "созерцатель", "angel": "ангел",
    "titan": "титан", "genie": "джинн", "goblinoid": "гоблиноид", "cleric": "жрец",
    "human": "человек", "elf": "эльф", "dwarf": "дварф", "any race": "любая раса",
    "your choice": "на выбор", "shapechanger": "оборотень", "kobold": "кобольд",
    "orc": "орк", "goblin": "гоблин", "gnoll": "гнолл", "lizardfolk": "ящеролюд",
    "bullywug": "булливуг", "aarakocra": "ааракокра", "merfolk": "тритон",
    "yuan-ti": "юань-ти", "thri-kreen": "три-крин", "sahuagin": "сагуагин",
    "kuo-toa": "куо-тоа", "gnome": "гном", "halfling": "полурослик", "troll": "тролль",
    "beholderkin": "созерцатель", "ghostly": "призрачный",
    "vampire": "вампир", "wererat": "крысооборотень", "swarm of": "стая",
}


def agree(size_word, gender):
    low = size_word.lower()
    for stem, (m, f, n) in SIZE_FORMS.items():
        if low.startswith(stem):
            base = size_word[: len(stem)]
            return base + (m if gender == "m" else f if gender == "f" else n)
    return size_word


def repair_type(s):
    if not s:
        return s
    out = s.strip()
    body, al = out, ""
    m = re.match(r"^(.*?),\s*([а-яё-]+)$", out)
    if m:
        body, al = m.group(1), m.group(2)
    # подписи в скобках
    def tag(m):
        t = m.group(1).strip().lower()
        return f"({TAG_RU.get(t, t)})"
    body = re.sub(r"\(([A-Za-z' -]+)\)", tag, body)
    # размер + [или размер] + тип
    m = re.match(r"^(\S+?(?:ый|ий|ой|ая|яя|ое|ее))(\s+или\s+(\S+))?\s+([А-Яа-яЁё][а-яё-]*)(\s*\(.*\))?$", body)
    if m:
        first, _, second, tname, tail = m.groups()
        gender = TYPE_GENDER.get(tname.lower(), "m")
        first = agree(first, gender)
        second = agree(second, gender).lower() if second else None
        mid = f" или {second}" if second else ""
        body = f"{first}{mid} {tname.lower()}{tail or ''}"
    return body + (f", {al}" if al else "")


def tidy_tail(s):
    """Убирает обрезанные хвосты исходных данных и закрывает скобки."""
    if not s:
        return s
    out = s.rstrip(" ,;")
    while out.count("(") > out.count(")"):
        cut = out.rfind("(")
        frag = out[cut:]
        if re.search(r"[А-Яа-яЁё]{2,}", frag):
            out = out + ")"          # содержимое осмысленное — просто закрываем скобку
        else:
            out = out[:cut].rstrip(" ,;")
    if re.search(r"\s(?:[a-z]{1,3}|[A-ZА-Я][a-z]{0,2})$", out) and not re.search(r"[)]$", out):
        out = re.sub(r"\s+\S+$", "", out).rstrip(" ,;")
    return out


def repair_speed(s):
    if not s:
        return s
    out = s
    out = re.sub(r"\(hover;\s*(\w+) only\)",
                 lambda m: f"(зависание; только {TAG_RU.get(m.group(1).lower(), m.group(1).lower())})", out)
    out = out.replace("(30 фт when rolling, 60 фт rolling downhill)",
                      "(30 фт на ровном месте, 60 фт под уклон)")
    out = out.replace("(bear form only)", "(только в облике медведя)")
    out = tidy_tail(out)
    return out


def main():
    src = open(OUT, encoding="utf-8").read()
    head = src[: src.index("[")]
    mons = json.loads(src[src.index("["): src.rindex("]") + 1])
    for x in mons:
        x["type"] = repair_type(x.get("type", ""))
        x["sp"] = repair_speed(x.get("sp", ""))
        x["cr"] = tidy_tail((x.get("cr") or "").replace("БМ equals yo", "БМ равен вашему бонусу мастерства"))
        x["sen"] = tidy_tail(x.get("sen", ""))
        x["lang"] = tidy_tail(x.get("lang", ""))
    if "--dry" in sys.argv:
        for x in mons[:5]:
            print(x["n"], "|", x["type"], "|", x["sp"], "|", x["cr"])
        return
    body = json.dumps(mons, ensure_ascii=False, separators=(", ", ": "))
    open(OUT, "w", encoding="utf-8").write(head + body + ";\n")
    left = sum(1 for x in mons if re.search(r"[A-Za-z]{3,}", x.get("sp", "") + x.get("type", "") + x.get("cr", "")))
    print("готово, полей с латиницей:", left)


if __name__ == "__main__":
    main()
