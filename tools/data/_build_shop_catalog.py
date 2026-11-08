# -*- coding: utf-8 -*-
"""Разбор PDF «D&D Shop Catalog, V-1.8» в shop-catalog-data.js.

Запуск:  python3 _build_shop_catalog.py --write
Текст PDF предварительно извлекается в _tmp/catalog.txt (см. README-скрипт ниже).
"""
import json
import re
import sys

SRC = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "tools", "data", "_tmp", "catalog.txt")

SECTIONS = [
    "Blacksmith/Armory", "Fletcher/Bowyer", "Leatherworker", "Temple/Faith Supplies",
    "Book Prices (Library or Otherwise)", "General Store", "Adventuring Supplies",
    "Water -side Theme", "Magical  Theme", "Shady Dealer Theme", "Art and Games  Theme",
    "Tailor/Textiles", "Transportation", "Jeweler/Stonecutter", "Potion Shop",
    "Arcane Shop", "Common Meal & Inn Prices", "Market Produce/ Foods",
    "Creature Parts Values", "High End Clothing",
    "Special Materials, Leather Armor Pieces", "Special Crafting Materials", "Tattoo Shop",
]

GROUPS = [
    "[Armor]", "Light Armor", "Medium Armor", "Heavy Armor", "Shield",
    "[Weapons]", "Simple Melee Weapons", "Martial Melee Weapons",
    "Simple Ranged Weapons", "Martial Ranged Weapons", "Ammunition",
    "[Adventuring Gear]", "[Tools]", "Artisan's Tools", "Musical Instrument",
    "Gaming Set", "[Services]", "Spellcasting", "Holy Symbol", "Arcane Focus",
    "Druidic Focus", "[Miscellaneous]", "[Trade Goods]", "[Waterborne Vehicles]",
    "[Mounts & Other Animals]", "[Tack & Drawn Vehicles]", "[Genstones by Value]",
    "[10 GP Gemstones]", "[50 GP Gemstones]", "[100 GP Gemstones]",
    "[500 GP Gemstones]", "[1000 GP Gemstones]", "[5000 GP Gemstones]",
    "[Powdering of Gems]", "[Alchemy Ingredients]", "[Magic Items]", "Potions",
    "Spell Scrolls/ Gems", "[Typical Breakfast Options]", "[Typical Lunch Options]",
    "[Typical Dinner Options]", "[Room Prices, Inns/ Taverns]", "[Vendor/ Stand Items}",
    "[Selling Value (Creature XP %)]", "[Custom Clothing Items]", "[Extras]",
    "Closure Devices (Options)", "Lining (Material Options)",
    "Misc. (At vendor’s Discretion)", "[Custom Armor Parts]", "[Custom Accessories]",
    "[Name] (Per unit Price)", "[Specialty Inks, Price per Size]",
    "[1 oz Bottles of Basic Colors]", "[Tattoo + Complexity]", "Commoner", "Merchant",
    "Noble", "Small", "Medium", "Large", "In Season", "Out of Season",
    "Non-Alcoholic Drinks – Cup", "Fruits – A Piece", "Vegetables – Each/ Bushel",
    "Grains – Per lb./ Flour – ½ lb.", "Baked Goods – Per Item", "Protein – Per lb.",
    "Cheeses – Per ½ lb.", "Spices – Per ½ Ounce Ground",
]

INKS = [
    "Beastial Ink", "Detection Ink (Colors Vary)", "Elemental Ink (Choice Varies)",
    "Glamor Ink (Choice Varies)", "Glow Ink (Choice Varies)",
    "Metallic-Ink (Basic Metals)", "Mood Ink (Single Color)",
    "Prismatic Ink (Single Color)", "Shifting Ink (GM Choice)",
    "Temporary Ink (Black Only)", "3-D Ink (Colors Vary)",
]

MONEY = r"(?:[\d.,]+\s*(?:gp|sp|cp|pp|GP|SP|CP)|[+×]\s?[\d.,]+\s*(?:gp|sp|cp)|CR%|\(n/a\)|\(na/\)|[\d.,]+)"
ROW = re.compile(
    r"^(?P<name>\S.*?)\s{2,}(?P<a>" + MONEY + r")\s+(?P<b>" + MONEY + r")\s+(?P<c>" + MONEY + r")\s*(?P<flags>[XO\s]*)$")
ROW2 = re.compile(
    r"^(?P<name>\S.*?)\s+(?P<a>[\d.,]+\s*(?:gp|sp|cp|pp|GP))\s+(?P<b>[\d.,]+\s*(?:sp|gp|cp|GP))\s+(?P<c>[\d.,]+\s*(?:cp|gp|sp|GP))\s*(?P<flags>[XO\s]*)$")
TATTOO = re.compile(
    r"^(?P<name>\S.*?)\s+(?P<cost>[\d.,]+\s*gp)\s+(?P<size>Small|Medium|Large)\s+(?P<cx>Simple|Average|Ornate)\s*(?P<flags>[XO\s]*)$")
PCT = re.compile(r"^(?P<name>CR: \S+.*?)\s+(?P<a>[\d.]+%)\s+(?P<b>[\d.]+%)\s+(?P<c>[\d.]+%)")


def norm_money(s):
    s = s.strip().replace(",", "")
    m = re.match(r"([\d.]+)\s*(gp|sp|cp|pp|GP|SP|CP)", s)
    if m:
        unit = {"GP": "gp", "SP": "sp", "CP": "cp"}.get(m.group(2), m.group(2))
        val = m.group(1)
        if val.endswith(".0"):
            val = val[:-2]
        return val + unit
    return s


UNITS = {"gp": "зм", "sp": "см", "cp": "мм", "ep": "эм", "pp": "пм"}


def ru_money(v):
    m = re.match(r"^([\d.]+)(gp|sp|cp|ep|pp)$", v or "")
    if m:
        return f"{m.group(1)} {UNITS[m.group(2)]}"
    return v.replace("×", "×")


def write_js(rows):
    import _shop_ru as RU

    out, missing = [], []
    used = set()
    for r in rows:
        sec = RU.SECTIONS.get(r["sec"])
        if not sec:
            missing.append(("секция", r["sec"]))
            continue
        raw_name = r["name"]
        note = r["note"]
        grp_raw = r["grp"] or ""
        name_en = raw_name
        if raw_name not in RU.NAMES and " – " in raw_name:  # животные: «Camel – 50 ft – 480 lbs»
            parts = [p.strip() for p in raw_name.split(" – ")]
            name_en = parts[0]
            note = " · ".join(parts[1:]).replace(" ft", " фт").replace(" lbs", " фнт")
        ru_name = RU.NAMES.get(name_en)
        if not ru_name:
            missing.append(("товар", raw_name))
            ru_name = name_en
        grp = (RU.INKS.get(grp_raw) or RU.GROUPS.get(grp_raw)
               or RU.GROUPS.get(grp_raw.strip("[]")) or grp_raw.strip("[]"))
        if grp_raw in RU.INKS:
            ru_name = f"{grp}: {ru_name.lower()}"
            grp = "Чернила"
        if r["sec"] == "Book Prices (Library or Otherwise)" and not grp:
            grp = "Книги"
        key = (sec, ru_name)
        if key in used:
            continue
        used.add(key)
        item = {"n": ru_name, "c": sec, "g": grp, "v": ru_money(r["v"]),
                "vc": ru_money(r["vc"]), "ve": ru_money(r["ve"])}
        if r["limited"]:
            item["l"] = 1
        if note:
            item["d"] = note
        out.append(item)

    body = ",\n".join("  " + json.dumps(i, ensure_ascii=False, separators=(", ", ": ")) for i in out)
    js = (
        "// Каталог магазина: «D&D Shop Catalog, V-1.8» (Reddit: /u/jrobharing, /u/Inalisk,\n"
        "// /u/Shinotama). Свободно распространяемый фанатский материал; перевод на русский.\n"
        "// Файл создан скриптом _build_shop_catalog.py — правки вручную будут перезаписаны.\n"
        "// v — обычная цена, vc — дешёвая, ve — дорогая, l — ограниченный запас, d — примечание.\n"
        "window.SHOP_CATALOG = [\n" + body + "\n];\n"
    )
    open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "js", "data", "shop-catalog-data.js"), "w", encoding="utf-8").write(js)
    print("записано позиций:", len(out))
    if missing:
        print("НЕ ПЕРЕВЕДЕНО:", len(missing))
        for m in missing:
            print("   ", m)
    from collections import Counter
    c = Counter(i["c"] for i in out)
    for k, v in c.most_common():
        print(f"{v:4}  {k}")


def main():
    lines = [l.rstrip() for l in open(SRC, encoding="utf-8")]
    cur_sec = cur_grp = cur_ink = None
    rows, seen = [], set()

    def add(name, v, vc, ve, flags="", grp=None, note=""):
        g = grp if grp is not None else cur_grp
        if cur_ink and not grp:
            g = cur_ink
        key = (cur_sec, g, name, v)
        if key in seen:
            return
        seen.add(key)
        rows.append({"sec": cur_sec, "grp": g, "name": name, "v": v, "vc": vc,
                     "ve": ve, "limited": "X" in flags, "note": note})

    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("Created by Reddit") or line.startswith("="):
            continue
        if line in SECTIONS:
            cur_sec, cur_grp, cur_ink = line, None, None
            continue
        if line in GROUPS:
            cur_grp, cur_ink = line.strip("[]"), None
            continue
        if cur_sec == "Tattoo Shop" and line in INKS:
            cur_ink, cur_grp = line, None
            continue
        m = TATTOO.match(line)
        if m and cur_sec == "Tattoo Shop":
            add(m.group("name"), norm_money(m.group("cost")), "", "", m.group("flags") or "",
                grp="Tattoo + Complexity", note=f"{m.group('size')} · {m.group('cx')}")
            continue
        m = PCT.match(line)
        if m and cur_sec == "Creature Parts Values":
            add(m.group("name"), m.group("a"), m.group("b"), m.group("c"))
            continue
        m = ROW.match(line) or ROW2.match(line)
        if not m:
            continue
        name = m.group("name").strip()
        if not name or name in GROUPS:
            continue
        a, b, c = (norm_money(m.group("a")), norm_money(m.group("b")), norm_money(m.group("c")))
        if not (re.search(r"\d", a) and re.search(r"\d", b)):
            continue
        # «Beastial Ink» + «Small» в одной строке иногда склеиваются
        add(name, a, b, c, m.group("flags") or "")

    # спец-строки, которые не подошли под шаблон
    rows.extend([
        {"sec": "Transportation", "grp": "Tack & Drawn Vehicles", "name": "Barding",
         "v": "×4", "vc": "×3", "ve": "×6", "limited": False,
         "note": "попона: цена доспеха ×4 (дешевле ×3, дороже ×6)"},
        {"sec": "Jeweler/Stonecutter", "grp": "[Services]", "name": "Stonecutting (+ value)",
         "v": "+25%", "vc": "(—)", "ve": "(—)", "limited": False,
         "note": "огранка: +25% от стоимости камня"},
        {"sec": "Tattoo Shop", "grp": "[Specialty Inks, Price per Size]", "name": "Full Ink Set",
         "v": "200gp", "vc": "140gp", "ve": "300gp", "limited": True, "note": ""},
    ])
    json.dump(rows, open(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "tools", "data", "_tmp", "rows.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    if "--write" in sys.argv:
        write_js(rows)

    from collections import Counter
    cnt = Counter(r["sec"] for r in rows)
    print("строк:", len(rows))
    for s in SECTIONS:
        print(f"{cnt.get(s,0):4}  {s}")
    names = []
    for r in rows:
        if r["name"] not in names:
            names.append(r["name"])
    print("уникальных названий:", len(names))
    if "--names" in sys.argv:
        for n in names:
            print(n)


if __name__ == "__main__":
    main()
