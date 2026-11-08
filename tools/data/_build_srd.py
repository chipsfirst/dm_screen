#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка srd-data.js: магические предметы SRD 5.1 (CC-BY-4.0) с механикой.

Источник: 5e-bits/5e-database (SRD 5.1, лицензия CC-BY-4.0).
Названия и механику переводим машинно, затем правим термины глоссарием.
Механика обрезается до 1–2 предложений (≤320 символов), чтобы справочник
оставался компактным.

Запуск: python3 _build_srd.py
"""
import json
import os
import re
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(HERE, "_tmp", "srd-items.json")
OUT = os.path.join(HERE, "js", "data", "srd-data.js")
CACHE = os.path.join(HERE, "_tmp", "srd_cache.json")
ENDPOINT = "https://translate.googleapis.com/translate_a/single"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

RARITY = {
    "Common": "обычный", "Uncommon": "необычный", "Rare": "редкий",
    "Very Rare": "очень редкий", "Legendary": "легендарный",
    "Artifact": "артефакт", "Varies": "варьируется",
}

TYPES = [
    ("Wondrous item", "чудесный предмет"), ("Ring", "кольцо"), ("Rod", "жезл"),
    ("Staff", "посох"), ("Wand", "волшебная палочка"), ("Potion", "зелье"),
    ("Scroll", "свиток"), ("Armor", "доспех"), ("Weapon", "оружие"),
    ("Shield", "щит"), ("Wondrous", "чудесный предмет"),
]

GLOSSARY = [
    (r"требует настройки", "требует настройки"),
    (r"Требуется настройка", "требует настройки"),
    (r"\bхитпоинт", "хит"), (r"\bочк(и|ов) здоровья\b", "хиты"),
    (r"\bдействие бонуса\b", "бонусное действие"),
    (r"\bбонусное действие\b", "бонусное действие"),
    (r"\bкласс доспеха\b", "КД"),
    (r"\bпреимуществ(о|а|ом)\b", r"Преимуществ\1"),
    (r"\bневыгодное положение\b", "Помеха"),
    (r"\bспасброс(ок|ка|ку|ки|ков)\b", r"спасброс\1"),
    (r"\bрежущ", "рубящ"),
    (r"\bпоражающ(ий|его)\s+урон", "колющий урон"),
    (r"\bдробящий урон\b", "дробящий урон"),
    (r"\bфутов\b", "фт"), (r"\bфута\b", "фт"), (r"\bфут\b", "фт"),
    (r"\bсущество\b", "существо"),
    (r"Вы можете", "Вы можете"),
    (r"\bпока вы носите\b", "пока вы это носите"),
]

_cache = {}


def load_cache():
    global _cache
    if os.path.exists(CACHE):
        try:
            _cache = json.load(open(CACHE, encoding="utf-8"))
        except Exception:
            _cache = {}


def save_cache():
    json.dump(_cache, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False)


def gtx(texts):
    payload = "\n".join(texts)
    params = urllib.parse.urlencode({"client": "gtx", "sl": "en", "tl": "ru", "dt": "t", "q": payload})
    for attempt in range(4):
        try:
            req = urllib.request.Request(ENDPOINT + "?" + params, headers=UA)
            data = json.loads(urllib.request.urlopen(req, timeout=45).read().decode("utf-8", "replace"))
            out = "".join(seg[0] for seg in data[0] if seg and seg[0])
            parts = out.split("\n")
            if len(parts) >= len(texts):
                return parts[: len(texts)]
            return parts + [""] * (len(texts) - len(parts))
        except Exception as e:
            if attempt == 3:
                print("  ! ошибка перевода:", type(e).__name__, str(e)[:70])
                return texts
            time.sleep(1.5 * (attempt + 1))
    return texts


def translate(items):
    todo = [t for t in dict.fromkeys(items) if t and t not in _cache]
    done, batch, size = 0, [], 0

    def flush():
        nonlocal batch, size, done
        if not batch:
            return
        res = gtx(batch)
        for s, d in zip(batch, res):
            _cache[s] = d
        done += len(batch)
        batch, size = [], 0
        if done % 100 < 12:
            print("  переведено:", done)
        time.sleep(0.12)

    for t in todo:
        if len(t) > 2200:
            flush()
            _cache[t] = gtx([t])[0]
            continue
        if size + len(t) > 3500 or len(batch) >= 25:
            flush()
        batch.append(t)
        size += len(t)
    flush()
    save_cache()
    return {t: _cache.get(t, t) for t in items}


def fix(s):
    for pat, rep in GLOSSARY:
        s = re.sub(pat, rep, s)
    return re.sub(r"\s+", " ", s).strip()


def item_type(desc0):
    low = desc0.lower()
    for en, ru in TYPES:
        if low.startswith(en.lower()):
            return ru
    return "магический предмет"


def clip(text, limit=320):
    text = text.strip()
    if len(text) <= limit:
        return text
    cut = text[:limit]
    for sep in (". ", "; ", ", "):
        i = cut.rfind(sep)
        if i > limit * 0.5:
            return cut[: i + 1].strip()
    return cut.rsplit(" ", 1)[0] + "…"


def main():
    load_cache()
    src = json.load(open(SRC, encoding="utf-8"))
    records, to_tr = [], []
    for it in src:
        desc = it.get("desc") or []
        if not desc:
            continue
        head = desc[0]
        rarity_obj = it.get("rarity")
        rarity = rarity_obj.get("name") if isinstance(rarity_obj, dict) else str(rarity_obj or "")
        body = " ".join(desc[1:]) if len(desc) > 1 else ""
        attune = "attunement" in (head + " " + body).lower()
        rec = {
            "en": it.get("name"),
            "type": item_type(head),
            "rarity": RARITY.get(rarity, rarity.lower()),
            "att": attune,
            "mech": clip(body),
        }
        records.append(rec)
        to_tr.append(rec["en"])
        if rec["mech"]:
            to_tr.append(rec["mech"])

    print("предметов:", len(records), "| строк к переводу:", len(set(to_tr)))
    tr = translate(to_tr)

    out = []
    seen = set()
    for r in records:
        n = fix(tr.get(r["en"], r["en"])).strip(" .")
        if not n or n in seen:
            continue
        seen.add(n)
        out.append({
            "n": n,
            "en": r["en"],
            "rarity": r["rarity"],
            "att": r["att"],
            "type": r["type"],
            "d": fix(tr.get(r["mech"], r["mech"])) if r["mech"] else "",
        })

    body = json.dumps({"source": "SRD 5.1 (CC-BY-4.0)", "items": out}, ensure_ascii=False, separators=(", ", ": "))
    js = ("// Магические предметы SRD 5.1 (System Reference Document), лицензия CC-BY-4.0.\n"
          "// Источник: 5e-bits/5e-database. Механика сокращена до 1–2 предложений.\n"
          "// Сгенерировано _build_srd.py.\n"
          "window.SRD_ITEMS = " + body + ";\n")
    open(OUT, "w", encoding="utf-8").write(js)
    print("записано предметов:", len(out))


if __name__ == "__main__":
    main()
