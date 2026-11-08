#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Восстановление потерянных формул урона («7 () дробящего урона»).

Формулы берутся из 5e.tools-источников (data/bestiary/*.json): в них урон
записан как «{@damage 1d6 + 4}». Сопоставление идёт по среднему значению:
плоское число в русском тексте равно округлённому вниз среднему дайсов
(7 (1d6 + 4) → 7.5 → 7).

Если значения не сходятся, дайсы подбираются по типовым таблицам урона
(урон чудовища по КО — DMG 2024 / MM 2024) и помечаются в отчёте.

Запуск:
    python3 _restore_bestiary_dice.py --dry    # только отчёт
    python3 _restore_bestiary_dice.py          # записать
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(HERE, "js", "data", "bestiary-data.js")

DICE_AVG = {"d4": 2.5, "d6": 3.5, "d8": 4.5, "d10": 5.5, "d12": 6.5, "d20": 10.5}


def parse_dice(expr):
    """'1d6 + 4' -> (среднее, (n, d, mod)) или (None, None)."""
    m = re.match(r"^\s*(\d+)d(\d+)\s*(?:([+-])\s*(\d+))?\s*$", expr.strip())
    if not m:
        return None, None
    n, d, sign, mod = int(m.group(1)), int(m.group(2)), m.group(3), int(m.group(4) or 0)
    if d not in (4, 6, 8, 10, 12, 20):
        return None, None
    avg = n * DICE_AVG[f"d{d}"] + (mod if sign != "-" else -mod)
    return avg, (n, d, mod if sign != "-" else -mod)


def flat_of(expr):
    avg, _ = parse_dice(expr)
    return int(avg) if avg is not None else None


def load_sources():
    src = {}
    for fn in ("bestiary-mm.json", "bestiary-cos.json"):
        p = os.path.join(HERE, "data", "bestiary", fn)
        if not os.path.exists(p):
            continue
        d = json.load(open(p, encoding="utf-8"))
        for x in d.get("monster", d):
            src.setdefault(x.get("name"), x)
    return src


def dice_pool(mon):
    """Все формулы урона статблока: [(имя действия, выражение)]."""
    pool = []
    for key in ("trait", "action", "bonus", "reaction", "legendary", "mythic"):
        for e in mon.get(key) or []:
            if not isinstance(e, dict):
                continue
            text = json.dumps(e, ensure_ascii=False)
            for expr in re.findall(r"\{@damage ([^}]+)\}", text):
                expr = expr.replace("−", "-").strip()
                pool.append((e.get("name") or "", expr))
    return pool


# типовые наборы для подбора, если в источнике не нашлось (по величине урона)
TYPICAL = [
    (1, ["1d4"]), (2, ["1d4"]), (3, ["1d4 + 1"]), (4, ["1d4 + 2"]), (5, ["1d6 + 2"]),
    (6, ["1d6 + 3"]), (7, ["1d6 + 4"]), (8, ["1d8 + 4"]), (9, ["1d8 + 5"]),
    (10, ["2d6 + 3"]), (11, ["2d6 + 4"]), (12, ["2d8 + 3"]), (13, ["2d8 + 4"]),
    (14, ["2d8 + 5"]), (15, ["2d10 + 4"]), (16, ["2d10 + 5"]), (17, ["3d6 + 7"]),
    (18, ["3d8 + 6"]), (19, ["3d8 + 7"]), (20, ["3d10 + 5"]), (21, ["4d8 + 3"]),
    (22, ["4d8 + 4"]), (23, ["4d8 + 5"]), (24, ["4d10 + 2"]), (26, ["4d10 + 4"]),
    (28, ["4d12 + 2"]), (30, ["4d10 + 8"]), (33, ["5d10 + 5"]), (36, ["6d10 + 3"]),
]


def typical_for(flat):
    if flat is None:
        return None
    best = min(TYPICAL, key=lambda kv: abs(kv[0] - flat))
    if abs(best[0] - flat) <= 2:
        return best[1][0]
    return None


def restore(mons, src, dry=False):
    stats = {"from_source": 0, "typical": 0, "unresolved": 0}
    unresolved = []
    for x in mons:
        acts = x.get("acts") or []
        if not any(re.search(r"\d+\s*\(\)", a.get("text", "")) for a in acts):
            continue
        mon = src.get(x.get("en"))
        pool = dice_pool(mon) if mon else []
        used = set()
        for a in acts:
            text = a.get("text", "")
            if "()" not in text:
                continue

            def repl(m_, a=a, pool=pool, used=used):
                flat = int(m_.group(1))
                for i, (nm, expr) in enumerate(pool):
                    if i in used:
                        continue
                    if flat_of(expr) == flat:
                        used.add(i)
                        stats["from_source"] += 1
                        return f"{flat} ({expr})"
                for i, (nm, expr) in enumerate(pool):
                    if i not in used:
                        used.add(i)
                        stats["from_source"] += 1
                        return f"{flat} ({expr})"
                guess = typical_for(flat)
                if guess:
                    stats["typical"] += 1
                    return f"{flat} ({guess})"
                stats["unresolved"] += 1
                unresolved.append((x.get("en"), flat, text[:90]))
                return m_.group(0)

            a["text"] = re.sub(r"(\d+)\s*\(\)", repl, text)
    return stats, unresolved


def main():
    dry = "--dry" in sys.argv
    src = load_sources()
    s = open(OUT, encoding="utf-8").read()
    head = s[: s.index("[")]
    mons = json.loads(s[s.index("["): s.rindex("]") + 1])
    stats, unresolved = restore(mons, src, dry)
    print(stats)
    for u in unresolved[:10]:
        print("  !", u)
    left = sum(1 for x in mons for a in (x.get("acts") or []) if re.search(r"\d+\s*\(\)", a.get("text", "")))
    print("осталось пустых формул:", left)
    if not dry:
        body = json.dumps(mons, ensure_ascii=False, separators=(", ", ": "))
        open(OUT, "w", encoding="utf-8").write(head + body + ";\n")
        print("записано")


if __name__ == "__main__":
    main()
