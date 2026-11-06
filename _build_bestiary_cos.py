#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка монстров Curse of Strahd из data/bestiary/bestiary-cos.json.

Что делает:
  * разворачивает _copy-цепочки (база — bestiary-cos.json или bestiary-mm.json);
  * применяет _copy._mod (replaceTxt, напр. «Arrigal» вместо «the assassin»);
  * переводит на русский (имена по словарю MON + Google, прозу через кэш
    data/translation_cache.json и глоссарий _translate_bestiary_ru.py);
  * пишет bestiary-cos.js — отдельный файл, который приложение подхватывает,
    если он лежит рядом с index.html (в git не попадает).

Запуск:
    python3 _build_bestiary_cos.py            # собрать и записать
    python3 _build_bestiary_cos.py --dry      # только отчёт
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import _merge_bestiary as MB
import _translate_bestiary_ru as TR

COS = os.path.join(HERE, "data", "bestiary", "bestiary-cos.json")
MM = os.path.join(HERE, "data", "bestiary", "bestiary-mm.json")
OUT = os.path.join(HERE, "bestiary-cos.js")


def load_monsters(path):
    data = json.load(open(path, encoding="utf-8"))
    if isinstance(data, dict):
        return data.get("monster") or []
    return data if isinstance(data, list) else []


def apply_copy_mod(row, copy):
    """_copy._mod: {"*": {"mode": "replaceTxt", "replace": "...", "with": "..."}}."""
    mod = copy.get("_mod") or {}
    pairs = []
    for key, spec in mod.items():
        if isinstance(spec, dict) and spec.get("mode") == "replaceTxt":
            src, dst = spec.get("replace"), spec.get("with")
            if src and dst:
                pairs.append((str(src), str(dst)))
    if not pairs:
        return row
    for a in row.get("acts") or []:
        txt = a.get("text", "")
        for src, dst in pairs:
            txt = re.sub(re.escape(src), dst, txt, flags=re.I)
        a["text"] = txt
    return row


def build_rows():
    cos = load_monsters(COS)
    mm = load_monsters(MM)
    byname = {}
    for m in mm:
        if isinstance(m, dict) and m.get("name"):
            byname.setdefault(str(m["name"]).strip().lower(), m)
    for m in cos:
        byname.setdefault(str(m["name"]).strip().lower(), m)

    cache = {}

    def resolve(entry, depth=0):
        key = str(entry.get("name", "")).strip().lower()
        if key in cache:
            return cache[key]
        if depth > 6:
            return None
        copy = entry.get("_copy")
        if copy:
            base_entry = byname.get(str(copy.get("name", "")).strip().lower())
            if base_entry is None or base_entry is entry:
                return None
            base_row = resolve(base_entry, depth + 1)
            if base_row is None:
                return None
            row = MB.merge_copy(base_row, entry, {})
            row = apply_copy_mod(row, copy)
        else:
            row = MB.row_5e(entry, {})
        cache[key] = row
        return row

    rows, missing = [], []
    for m in cos:
        r = resolve(m)
        if r is None:
            missing.append(m.get("name"))
            continue
        rows.append(r)
    return rows, missing


def translate(rows):
    TR.load_cache()
    prose, names = [], []
    for r in rows:
        for a in r.get("acts") or []:
            if TR.has_latin(a.get("text", "")):
                prose.append(a["text"])
        if TR.has_latin(r.get("en", "")):
            names.append(r["en"])
    mon = MB.load_mon()
    tr_prose = TR.translate_texts(list(dict.fromkeys(prose)))
    tr_names = TR.translate_texts([n for n in dict.fromkeys(names) if n not in mon])

    for r in rows:
        en = r.get("en", "")
        r["n"] = mon.get(en) or TR.fix_ru(tr_names.get(en, en)).strip(" .")
        r["type"] = TR.tr_type(r.get("type", ""))
        r["sp"] = TR.tr_speed(r.get("sp", ""))
        r["sen"] = TR.tr_senses(r.get("sen", ""))
        r["lang"] = TR.tr_langs(r.get("lang", ""))
        r["sk"] = TR.tr_skills(r.get("sk", ""))
        r["cr"] = TR.tr_cr(r.get("cr", ""))
        for a in r.get("acts") or []:
            a["text"] = TR.fix_ru(tr_prose.get(a.get("text", ""), a.get("text", "")))
            if a.get("tag"):
                a["tag"] = TR.fix_ru(a["tag"])
    return rows


def main():
    rows, missing = build_rows()
    print(f"развёрнуто статблоков: {len(rows)} | без базы: {len(missing)} {missing[:6]}")
    rows = translate(rows)
    out = []
    for i, r in enumerate(rows):
        r = {k: v for k, v in r.items() if not k.startswith("_")}
        r["id"] = i
        out.append(r)
    left = sum(1 for r in out for a in (r.get("acts") or []) if TR.has_latin(a.get("text", "")))
    print("осталось английских текстов:", left)
    for r in out[:5]:
        print("  •", r["n"], "|", r["type"], "| КД", r["ac"], "| ХП", r["hp"], "|", r["cr"])
    if "--dry" in sys.argv:
        return
    header = ("// Монстры Curse of Strahd (CoS) — локальное дополнение к бестиарию, "
              f"{len(out)} статблоков. В git не входит.\n")
    open(OUT, "w", encoding="utf-8").write(header + "window.BESTIARY_COS = " + json.dumps(out, ensure_ascii=False) + ";\n")
    print("Готово:", OUT, len(out))


if __name__ == "__main__":
    main()
