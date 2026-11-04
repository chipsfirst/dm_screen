#!/usr/bin/env python3
"""Чистит английские остатки в полях КД и ХП бестиария.

Что делает:
  * переводит формулы от заклинаний-призывов («11 + the spell's level»,
    «40 + 10 for each spell level above 4»);
  * раскрывает разметку 5e.tools ({@item studded leather armor|phb}) в русские
    названия доспехов;
  * переводит «natural armor», убирает обрезанные хвосты строк (источник —
    data/monsters2024.json).

Запуск: python3 _fix_bestiary_fields.py
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "bestiary-data.js"
SRC = ROOT / "data" / "monsters2024.json"

HEAD = "// Бестиарий D&D — 677 монстров. Собран _merge_bestiary.py из data/. Источники: 5e.tools / SRD.\nwindow.BESTIARY = "

ARMOR = {
    "leather armor": "кожаный доспех",
    "studded leather armor": "проклёпанный кожаный доспех",
    "hide armor": "шкурный доспех",
    "chain shirt": "кольчужная рубаха",
    "chain mail": "кольчуга",
    "ring mail": "кольчужный доспех",
    "scale mail": "чешуйчатый доспех",
    "splint armor": "наборный доспех",
    "half plate armor": "полулаты",
    "plate armor": "латный доспех",
    "shield": "щит",
}

# Призывы: в исходнике текст полный, в бестиарии часть строк обрезана.
SPIRITS = {
    "Aberrant Spirit": ("11 + уровень заклинания",
                        "40 + 10 за каждый уровень заклинания выше 4-го"),
    "Bestial Spirit": ("11 + уровень заклинания",
                       "20 (только воздух) или 30 (только земля и вода) + 5 за каждый уровень заклинания выше 2-го"),
    "Celestial Spirit": ("11 + уровень заклинания + 2 (только защитник)",
                         "40 + 10 за каждый уровень заклинания выше 5-го"),
    "Construct Spirit": ("13 + уровень заклинания",
                         "40 + 15 за каждый уровень заклинания выше 4-го"),
    "Draconic Spirit": ("14 + уровень заклинания",
                        "50 + 10 за каждый уровень заклинания выше 5-го"),
    "Elemental Spirit": ("11 + уровень заклинания",
                         "50 + 10 за каждый уровень заклинания выше 4-го"),
    "Fey Spirit": ("12 + уровень заклинания",
                   "30 + 10 за каждый уровень заклинания выше 3-го"),
    "Fiendish Spirit": ("12 + уровень заклинания",
                        "50 (только демон) или 40 (только дьявол) или 60 (только юголот) + 15 за каждый уровень заклинания выше 6-го"),
    "Giant Insect": ("11 + уровень заклинания",
                     "30 + 10 за каждый уровень заклинания выше 4-го*"),
    "Otherworldly Steed": ("10 + 1 за уровень заклинания",
                           "5 + 10 за уровень заклинания (у скакуна столько костей хитов [d10], каков уровень заклинания)"),
    "Undead Spirit": ("11 + уровень заклинания",
                      "30 (только призрачный и гнилостный) или 20 (только скелет) + 10 за каждый уровень заклинания выше 3-го"),
}

# Строки, которые в бестиарии обрезаны по ширине поля.
EXPLICIT_HP = {
    "Animated Object": "10 (средний или меньше), 20 (большой), 40 (огромный)",
}

RENAME = {"Construct Spirit": "Дух конструкции"}

ITEM_RE = re.compile(r"\{@item ([^}|]+)(?:\|[^}|]*)?(?:\|([^}]*))?\}")
TRUNC_RE = re.compile(r"\{@item ([^}|]+)(?:\|[^}]*)?$")
LATIN = re.compile(r"[A-Za-z]")
DICE = re.compile(r"\d*\s*[dD]\s*\d+")


def armor_ru(name: str) -> str:
    key = name.strip().lower()
    if key in ARMOR:
        return ARMOR[key]
    for full, ru in sorted(ARMOR.items(), key=lambda kv: -len(kv[0])):
        if full.startswith(key) or key.startswith(full):
            return ru
    return key


def translate_items(text: str) -> str:
    def repl(m):
        name = (m.group(2) or m.group(1)).strip()
        prefix = "+1 " if name.lower().startswith("+1 ") else ""
        return prefix + armor_ru(name.replace("+1 ", "", 1))

    return ITEM_RE.sub(repl, text)


def close_truncated_items(text: str) -> str:
    """Строки вида «16 (шкурный доспех, {@item shiel» — тег обрезан при выгрузке."""
    text = TRUNC_RE.sub(lambda m: armor_ru(m.group(1)), text)
    if text.count("(") > text.count(")"):
        text += ")" * (text.count("(") - text.count(")"))
    return text


def cleanup(text: str) -> str:
    if not text:
        return text
    text = close_truncated_items(text)
    text = translate_items(text)
    text = text.replace("(natural armor", "(природная броня")
    text = text.replace("(broken chainmail)", "(сломанная кольчуга)")
    return text


def has_latin(text: str) -> bool:
    if not text:
        return False
    stripped = DICE.sub("", text)
    return bool(LATIN.search(stripped))


def main() -> None:
    raw = DATA.read_text(encoding="utf-8")
    body = raw[raw.index("=") + 1:].strip()
    monsters, _ = json.JSONDecoder().raw_decode(body)

    changed = 0
    for m in monsters:
        before = (m.get("ac", ""), m.get("hp", ""))

        en = m.get("en")
        if en in SPIRITS:
            m["ac"], m["hp"] = SPIRITS[en]
        if en in EXPLICIT_HP:
            m["hp"] = EXPLICIT_HP[en]
        if en in RENAME:
            m["n"] = RENAME[en]

        m["ac"] = cleanup(m.get("ac", ""))
        m["hp"] = cleanup(m.get("hp", ""))

        if (m.get("ac", ""), m.get("hp", "")) != before or en in RENAME:
            changed += 1

    DATA.write_text(HEAD + json.dumps(monsters, ensure_ascii=False, separators=(", ", ": ")) + ";\n",
                    encoding="utf-8")

    leftovers = [(m["n"], m.get("ac"), m.get("hp")) for m in monsters
                 if has_latin(m.get("ac", "")) or has_latin(m.get("hp", ""))]
    print(f"изменено записей: {changed}")
    print(f"осталось с латиницей: {len(leftovers)}")
    for row in leftovers[:10]:
        print("  ", row)
    if not leftovers:
        print("готово: формул на английском не осталось")


if __name__ == "__main__":
    main()
