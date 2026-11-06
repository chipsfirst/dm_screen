#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Вливает монстров Curse of Strahd (bestiary-cos.js) в основной бестиарий.

Дубли по английскому имени и по русскому названию пропускаются.
Запуск: python3 _merge_cos_into_bestiary.py
"""
import json
import shutil

BASE = "bestiary-data.js"
COS = "bestiary-cos.js"


def load(path, var):
    t = open(path, encoding="utf-8").read()
    i = t.index(var)
    body = t[i:]
    body = body[body.index("=") + 1:].strip().rstrip(";")
    return json.loads(body)


def main():
    base = load(BASE, "window.BESTIARY")
    cos = load(COS, "window.BESTIARY_COS")
    en = {e["en"].lower() for e in base}
    ru = {e["n"].lower() for e in base}
    added, skipped = 0, []
    for r in cos:
        if r["en"].lower() in en or r["n"].lower() in ru:
            skipped.append(r["en"])
            continue
        r = dict(r)
        r["id"] = len(base)
        base.append(r)
        en.add(r["en"].lower())
        ru.add(r["n"].lower())
        added += 1
    shutil.copy(BASE, "/tmp/bestiary-before-cos.js")
    header = (f"// Бестиарий D&D — {len(base)} монстров (SRD 5.2.1 / 2024 + Curse of Strahd). "
              "Сверено с data/monsters2024.json и dnd.su.\n")
    open(BASE, "w", encoding="utf-8").write(header + "window.BESTIARY = " + json.dumps(base, ensure_ascii=False) + ";\n")
    print(f"добавлено: {added} | пропущено дублей: {len(skipped)} {skipped} | всего: {len(base)}")


if __name__ == "__main__":
    main()
