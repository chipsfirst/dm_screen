#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Собирает 97 монстров Curse of Strahd в записи формата проекта.

Источник данных — по приоритету:
  1. карточка dnd.su для самого монстра (официальная локализация);
  2. карточка dnd.su для базового статблока _copy + правки из 5e.tools;
  3. машинный перевод 5e.tools (если страницы нет).

Пишет bestiary-cos.js (window.BESTIARY_COS) и отчёт о расхождениях.
Запуск: python3 _assemble_cos.py [--write-inline]
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import _build_bestiary_cos as B
import _merge_bestiary as MB
import _parse_cos_ru as P
import _translate_bestiary_ru as TR

COS = os.path.join(HERE, "data", "bestiary", "bestiary-cos.json")
MAP = "/tmp/cos_ru_map.json"
PAGES = "/tmp/dndsu-cos"
OUT = os.path.join(HERE, "bestiary-cos.js")
NOISE = re.compile(r",\s*именной (НИП|NPC)\b", re.I)

# Имена, которых нет на dnd.su (варианты из CoS): латиница → русский
NAME_RU = {
    "Bray Martikov": "Брей Мартиков",
    "Brom Martikov": "Бром Мартиков",
    "Danika Dorakova": "Даника Доракова",
    "Urwin Martikov": "Урвин Мартиков",
    "Rosavalda \"Rose\" Durst": "Розавальда «Роза» Дюрст",
    "Thornboldt \"Thorn\" Durst": "Торнбольдт «Торн» Дюрст",
    "Sangzor": "Сангзор",
    "Cat Skeleton": "Скелет кошки",
    "Hungry Ghast": "Голодный вурдалак",
    "Lady Lydia Petrovna": "Леди Лидия Петровна",
    "Walking Corpse": "Ходячий труп",
    "Young Wereraven": "Молодой верворон",
    "Phantom Warrior (Archer)": "Призрачный воин (лучник)",
    "Baba Lysaga's Creeping Hut": "Ползучая избушка бабы Лысаги",
    "Strahd's Animated Armor": "Оживлённая броня Страда",
    "Ezmerelda d'Avenir": "Эсмерельда д’Авенир",
}
# как имя звучит внутри текста
SHORT_RU = {
    "Bray": "Брей", "Brom": "Бром", "Danika": "Даника", "Urwin": "Урвин",
    "Rose": "Роза", "Thorn": "Торн",
}
FEET_RE = re.compile(r"фут(ов|а|ах|ам|ами|е)?\b")
CURLY_RE = re.compile(r"\{@[^}]*\}")


TYPE_LOWER = re.compile(r"^(Крошечн\w+|Маленьк\w+|Средн\w+|Больш\w+|Огромн\w+|Гигантск\w+|Колоссальн\w+)\s+([А-ЯЁ])([а-яё]+)")


def cleanup_row(r):
    for f in ("n", "type", "ac", "hp", "sp", "sk", "sen", "lang", "cr", "imm", "sav"):
        v = r.get(f)
        if isinstance(v, str):
            v = CURLY_RE.sub("", v)
            v = FEET_RE.sub("фт", v)
            v = re.sub(r"\bфт(м|х|ам|ах)\b", "фт", v)
            v = re.sub(r"\.\s*\.", ".", v)
            r[f] = re.sub(r"\s+", " ", v).strip(" ,")
    for a in r.get("acts") or []:
        t = CURLY_RE.sub("", a.get("text", ""))
        t = FEET_RE.sub("фт", t)
        t = re.sub(r"\bфт(м|х|ам|ах)\b", "фт", t)
        t = re.sub(r"\.\s*\.", ".", t)
        t = re.sub(r"\s+", " ", t).strip()
        for en, ru in SHORT_RU.items():
            t = re.sub(rf"\b{en}\b", ru, t)
        a["text"] = t
    t = r.get("type", "")
    m = TYPE_LOWER.match(t)
    if m:
        r["type"] = m.group(1) + " " + m.group(2).lower() + m.group(3) + t[m.end():]
    if not r.get("init"):
        dex = next((a for a in (r.get("ab_list") or []) if a.get("k") == "Dex"), None)
        if dex:
            m = int(dex.get("m") or 0)
            r["init"] = f"{m:+d} ({10 + m})"
    en = r.get("en", "")
    if en in NAME_RU:
        r["n"] = NAME_RU[en]
    return r


def load_map():
    if not os.path.exists(MAP):
        return {}
    return json.load(open(MAP, encoding="utf-8"))


def page_of(entry, ru_map):
    """Возвращает разобранную карточку dnd.su для имени или None."""
    hit = ru_map.get(entry)
    if not hit:
        return None
    slug = hit["url"].strip("/").split("/")[-1]
    path = os.path.join(PAGES, slug + ".html")
    if not os.path.exists(path):
        return None
    p = P.parse(path)
    if not p:
        return None
    p["n"] = hit["ru"]
    p["type"] = NOISE.sub("", p.get("type", ""))
    return p


def num(s):
    m = re.search(r"\d+", str(s or ""))
    return int(m.group(0)) if m else None


def cr_num(s):
    s = str(s or "").strip()
    if "/" in s:
        a, b = s.split("/")[:2]
        try:
            return round(int(a) / int(b), 3)
        except Exception:
            return None
    return num(s)


def raw_overrides(entry):
    """Правки прямо из записи 5e.tools (когда базовый статблок не развернулся)."""
    ov = {}
    if "ac" in entry:
        ov["ac"] = MB.ac_5e(entry)
    if "hp" in entry:
        ov["hp"] = MB.hp_5e(entry)
    if "speed" in entry:
        ov["sp"] = MB.sp_5e(entry)
    if "cr" in entry:
        ov["cr"] = str(entry["cr"])
    if any(k in entry for k in ("type", "size", "alignment")):
        ov["type"] = MB.type_5e(entry)
    ab = []
    for k in MB.AB_ORDER:
        if isinstance(entry.get(MB.AB_LOW[k]), (int, float)):
            v = int(entry[MB.AB_LOW[k]])
            ab.append({"k": k, "v": v, "m": MB.mod_of(v), "s": None})
    if ab:
        ov["ab_list"] = ab
    return ov


def main():
    ru_map = load_map()
    raw_rows, missing = B.build_rows()          # 5e.tools, машинный перевод
    B.translate(raw_rows)
    by_en = {r["en"].lower(): r for r in raw_rows}

    cos = json.load(open(COS, encoding="utf-8"))["monster"]
    out, stat = [], {"page": 0, "base": 0, "mt": 0}
    diffs = []

    for m in cos:
        en = m["name"]
        base_en = str((m.get("_copy") or {}).get("name", ""))
        # «Молодой верворон» — вариант карточки верворона: берём базу и правим числа
        page = None if en == "Young Wereraven" else page_of(en, ru_map)
        src_row = by_en.get(en.lower())

        if page:
            row = dict(page)
            stat["page"] += 1
            # сверка механики с 5e.tools
            if src_row:
                for f, conv in (("ac", num), ("hp", num), ("cr", cr_num)):
                    a, b = conv(row.get(f)), conv(src_row.get(f))
                    if a is not None and b is not None and a != b:
                        diffs.append(f"{en}: {f} dnd.su={row.get(f)} / 5e.tools={src_row.get(f)}")
            row["en"] = en
        else:
            base_page = page_of(base_en, ru_map) if base_en else None
            if not base_page and en == "Young Wereraven":
                base_page = page_of("Wereraven", ru_map)
            if base_page:
                ov = raw_overrides(m)
                src_row = dict(src_row or {})
                src_row.update({k: v for k, v in ov.items() if k != "type"})
            if base_page:
                row = dict(base_page)
                stat["base"] += 1
                for f in ("ac", "hp", "sp", "cr", "sk", "sen", "lang", "imm", "sav"):
                    v = src_row.get(f)
                    if v:
                        row[f] = v
                row["ab_list"] = src_row.get("ab_list") or base_page.get("ab_list") or []
                if row["ab_list"]:
                    row["ab"] = ", ".join(f"{x['k']} {x['v']} ({x['m']:+d})" for x in row["ab_list"])
                # имя из 5e.tools-цепи + правки «the wereraven» → имя НИПа
                row["en"] = en
                with_name = (m.get("_copy") or {}).get("_mod", {}).get("*", {}).get("with") or ""
                row["acts"] = [dict(a) for a in (base_page.get("acts") or [])]
                if with_name:
                    for a in row["acts"]:
                        a["text"] = re.sub(r"вервор[а-я]+", with_name, a["text"], flags=re.I)
                row["n"] = with_name or base_page.get("n", en)
            elif src_row:
                row = dict(src_row)
                stat["mt"] += 1
            else:
                continue
            if not row.get("n"):
                row["n"] = en

        row.setdefault("img", "")
        row["id"] = len(out)
        out.append(row)

    out = [cleanup_row(r) for r in out]
    print(f"из dnd.su: {stat['page']} | из базовой карточки: {stat['base']} | машинный перевод: {stat['mt']}")
    print(f"всего: {len(out)}")
    if diffs:
        print("расхождения механики (dnd.su vs 5e.tools):")
        for d in diffs[:15]:
            print("  -", d)
    no_acts = [r["n"] for r in out if not r.get("acts")]
    print("без действий/черт:", len(no_acts), no_acts[:6])

    header = ("// Монстры Curse of Strahd (CoS) — локальное дополнение к бестиарию, "
              f"{len(out)} статблоков. В git не входит.\n")
    open(OUT, "w", encoding="utf-8").write(header + "window.BESTIARY_COS = " + json.dumps(out, ensure_ascii=False) + ";\n")
    print("Готово:", OUT)


if __name__ == "__main__":
    main()
