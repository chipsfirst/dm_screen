#!/usr/bin/env python3
"""Дочищает прозу бестиария: английские названия приёмов, оборванные тексты.

  * подставляет русские названия атак и заклинаний, которые переводчик
    оставил латиницей («Mind Spike», «Slam», «Shield Bash» …);
  * заново переводит тексты, оборванные на середине;
  * добирает пустые поля из исходника.

Запуск: python3 _fix_bestiary_terms.py
"""
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "js" / "data" / "bestiary-data.js"
SRC = ROOT / "data" / "monsters2024.json"
CACHE = ROOT / "data" / "translation_cache.json"

HEAD = "// Бестиарий D&D — 677 монстров. Собран _merge_bestiary.py из data/. Источники: 5e.tools / SRD.\nwindow.BESTIARY = "

ENDPOINT = "https://translate.googleapis.com/translate_a/single"
UA = {"User-Agent": "Mozilla/5.0"}

TERMS = {
    "Mind Spike": "Шип разума",
    "Radiant Burst": "Сияющий взрыв",
    "Storm Blade": "Штормовой клинок",
    "Storm Bolt": "Штормовая стрела",
    "Storm Sword": "Штормовой меч",
    "Vine Staff": "Лозовый посох",
    "Verdant Wisp": "Зелёный огонёк",
    "Rock Launch": "Запуск камня",
    "Fey Blade": "Клинок фей",
    "Flame Scepter": "Пламенный скипетр",
    "Hurl Flame": "Метание пламени",
    "Web Bolt": "Паутинная стрела",
    "Shield Bash": "Удар щитом",
    "Object Slam": "Удар предметом",
    "Tree Club": "Дубина-дерево",
    "Trash Lob": "Метание мусора",
    "Bladed Arm": "Клинковая рука",
    "Fiery Bolt": "Огненная стрела",
    "Force Bolt": "Силовая стрела",
    "Corrupting Touch": "Портящее касание",
    "Tail Spike": "Хвостовой шип",
    "Fell Glare": "Злобный взгляд",
    "Enthralling Panache": "Пленительный шик",
    "Hold Monster": "Удержание чудовища",
    "Wall of Fire": "Стена огня",
    "Life Drain": "Похищение жизни",
    "Sleep Breath": "Сонное дыхание",
    "Grave Strike": "Могильный удар",
    "Shape-Shift": "Смена облика",
    "Heavy Crossbow": "Тяжёлый арбалет",
    "Warhammer": "Боевой молот",
    "Handaxe": "Ручной топор",
    "Thunderbolt": "Громовая стрела",
    "Constrict": "Сжатие",
    "Invitation": "Приглашение",
    "Avenger": "Мститель",
    "Spider": "паук",
    "Rend": "Раздирание",
    "Slam": "Удар",
    "Bite": "Укус",
}

ENDINGS = (".", "!", "?", ":", ")", "»", "…")


def translate(text):
    params = urllib.parse.urlencode({"client": "gtx", "sl": "en", "tl": "ru", "dt": "t", "q": text})
    for attempt in range(3):
        try:
            req = urllib.request.Request(ENDPOINT + "?" + params, headers=UA)
            raw = urllib.request.urlopen(req, timeout=30).read().decode("utf-8", "replace")
            data = json.loads(raw)
            out = "".join(seg[0] for seg in data[0] if seg and seg[0]).strip()
            if out:
                return out
        except Exception:
            time.sleep(1.5 * (attempt + 1))
    return None


def apply_terms(text):
    for en, ru in sorted(TERMS.items(), key=lambda kv: -len(kv[0])):
        text = re.sub(r"(?<![A-Za-z])" + re.escape(en) + r"(?![A-Za-z])", ru, text)
    return text


def main():
    raw = DATA.read_text(encoding="utf-8")
    monsters, _ = json.JSONDecoder().raw_decode(raw[raw.index("=") + 1:].strip())
    source = {m["name"]: m for m in json.loads(SRC.read_text(encoding="utf-8"))}
    cache = json.loads(CACHE.read_text(encoding="utf-8"))

    by_ru = {}
    for en, ru in cache.items():
        by_ru.setdefault(ru, en)

    terms_fixed = retranslated = fields = 0

    for m in monsters:
        for a in m.get("acts") or []:
            text = a.get("text", "")
            new = apply_terms(text)
            if new != text:
                a["text"] = new
                terms_fixed += 1

            text = a.get("text", "").strip()
            if text and not text.endswith(ENDINGS):
                en = by_ru.get(text)
                if en:
                    fresh = translate(en)
                    if fresh and fresh != text:
                        cache[en] = fresh
                        a["text"] = apply_terms(fresh)
                        retranslated += 1

        rec = source.get(m.get("en", ""))
        if rec:
            for field, key in (("sp", "Speed"), ("ac", "AC"), ("hp", "HP"), ("cr", "CR")):
                if not str(m.get(field, "")).strip() and rec.get(key):
                    m[field] = str(rec[key]).strip()
                    fields += 1

    print(f"названий переведено: {terms_fixed}")
    print(f"оборванных текстов переведено заново: {retranslated}")
    print(f"заполнено пустых полей: {fields}")

    DATA.write_text(HEAD + json.dumps(monsters, ensure_ascii=False, separators=(", ", ": ")) + ";\n",
                    encoding="utf-8")
    CACHE.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    print("файлы обновлены")


if __name__ == "__main__":
    main()
