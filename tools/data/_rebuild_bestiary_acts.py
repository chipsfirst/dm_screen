#!/usr/bin/env python3
"""Пересобирает действия монстров из исходника и кэша перевода.

Лечит обрезанные и потерянные тексты: берёт полные английские строки из
data/monsters2024.json и подставляет готовый русский перевод из
data/translation_cache.json (все строки уже переведены).

Запуск: python3 _rebuild_bestiary_acts.py [--dry]
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
DATA = ROOT / "js" / "data" / "bestiary-data.js"
SRC = ROOT / "data" / "monsters2024.json"
CACHE = ROOT / "data" / "translation_cache.json"

HEAD = "// Бестиарий D&D — 677 монстров. Собран _merge_bestiary.py из data/. Источники: 5e.tools / SRD.\nwindow.BESTIARY = "

TAGS = (
    ("traits", "Черты"),
    ("actions", "Действия"),
    ("bonus_actions", "Бонус"),
    ("reactions", "Реакция"),
    ("legendary_actions", "Легендарные"),
)


def section_items(block):
    if isinstance(block, dict):
        return [x for x in (block.get("items") or []) if isinstance(x, str) and x.strip()]
    if isinstance(block, list):
        return [x for x in block if isinstance(x, str) and x.strip()]
    return []


def build_acts(rec, cache):
    out, untranslated = [], 0
    for key, tag in TAGS:
        for text in section_items(rec.get(key)):
            ru = cache.get(text)
            if not ru:
                untranslated += 1
                continue
            out.append({"tag": tag, "text": ru.strip()})
    return out, untranslated


UNITS = [
    (re.compile(r"\bDC\b"), "КД"),
    (re.compile(r"\bфут(ов|а|ы)?\b"), "фт"),
    (re.compile(r"\bфутах\b"), "фт"),
    (re.compile(r"\bft\.?\b"), "фт"),
]


def cleanup(text):
    for rx, repl in UNITS:
        text = rx.sub(repl, text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    return text.strip()


def main():
    raw = DATA.read_text(encoding="utf-8")
    monsters, _ = json.JSONDecoder().raw_decode(raw[raw.index("=") + 1:].strip())
    source = {m["name"]: m for m in json.loads(SRC.read_text(encoding="utf-8"))}
    cache = json.loads(CACHE.read_text(encoding="utf-8"))

    dry = "--dry" in sys.argv
    rebuilt = cleaned = skipped = no_src = 0

    for m in monsters:
        rec = source.get(m.get("en", ""))
        if not rec:
            no_src += 1
        else:
            acts, untranslated = build_acts(rec, cache)
            old = m.get("acts") or []
            if acts and len(acts) >= len(old):
                if acts != old:
                    m["acts"] = acts
                    rebuilt += 1
            elif untranslated:
                skipped += 1

        for a in m.get("acts") or []:
            before = a.get("text", "")
            after = cleanup(before)
            if after != before:
                a["text"] = after
                cleaned += 1

        for field, src_key in (("sp", "Speed"), ("ac", "AC"), ("hp", "HP"), ("cr", "CR")):
            if rec and not str(m.get(field, "")).strip():
                m[field] = str(rec.get(src_key, "")).strip()

    print(f"пересобрано действий: {rebuilt}")
    print(f"почищено пробелов: {cleaned}")
    print(f"пропущено (нет перевода): {skipped}")
    print(f"без исходника: {no_src}")

    if dry:
        print("режим проверки — файл не изменён")
        return

    DATA.write_text(HEAD + json.dumps(monsters, ensure_ascii=False, separators=(", ", ": ")) + ";\n",
                    encoding="utf-8")
    print("файл обновлён")


if __name__ == "__main__":
    main()
