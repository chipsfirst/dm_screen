#!/usr/bin/env python3
"""Проверка бестиария: пропавшие действия, пустые поля, обрывки и опечатки.

Сверяет bestiary-data.js с исходником data/monsters2024.json по английскому
имени и печатает отчёт по категориям проблем.

Запуск: python3 _audit_bestiary.py [--json отчёт.json]
"""
import json
import re
import sys
from difflib import SequenceMatcher
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BESTIARY = ROOT / "bestiary-data.js"
SRC = ROOT / "data" / "monsters2024.json"

MARKUP = re.compile(r"\{@\w+")
LATIN_RUN = re.compile(r"[A-Za-z]{3,}")
ALLOWED_LATIN = {
    "d", "hp", "ac", "xp", "pb", "dc", "ft", "ft.", "lb", "lbs", "gp", "sp", "cp", "pp", "mm",
    "srd", "cr", "au", "dmg", "phb", "mm",
}
SENT_END = (".", "!", "?", ")", "»", ":", "…”")


def load_bestiary():
    raw = BESTIARY.read_text(encoding="utf-8")
    body = raw[raw.index("=") + 1:].strip()
    data, _ = json.JSONDecoder().raw_decode(body)
    return data


def load_source():
    src = json.loads(SRC.read_text(encoding="utf-8"))
    return {m["name"]: m for m in src}


def source_act_count(s):
    if not s:
        return None
    total = 0
    for key in ("traits", "actions", "bonus_actions", "reactions", "legendary_actions"):
        block = s.get(key) or {}
        items = block.get("items") if isinstance(block, dict) else block
        if isinstance(items, list):
            total += len([i for i in items if str(i).strip()])
    return total or None


def match(entry, source):
    en = entry.get("en") or ""
    if en in source:
        return source[en]
    key = en.strip().lower()
    for name, rec in source.items():
        if name.strip().lower() == key:
            return rec
    return None


def latin_words(text):
    out = []
    for w in LATIN_RUN.findall(text or ""):
        if w.lower() not in ALLOWED_LATIN:
            out.append(w)
    return out


def main():
    monsters = load_bestiary()
    source = load_source()

    problems = {
        "no_actions": [],
        "fewer_actions": [],
        "empty_field": [],
        "markup": [],
        "latin": [],
        "truncated": [],
        "double_space": [],
        "no_source": [],
    }

    for m in monsters:
        name = m.get("n", "?")
        acts = m.get("acts") or []
        texts = [str(a.get("text", "")) for a in acts]
        joined = " ".join(texts)

        if not texts or not any(t.strip() for t in texts):
            problems["no_actions"].append(name)

        for field in ("type", "cr", "ac", "hp", "sp", "ab"):
            if not str(m.get(field, "")).strip():
                problems["empty_field"].append(f"{name}: {field}")

        if not m.get("ab_list") or len(m.get("ab_list") or []) != 6:
            problems["empty_field"].append(f"{name}: характеристики")

        if MARKUP.search(joined) or MARKUP.search(str(m.get("ac", "")) + str(m.get("hp", ""))):
            problems["markup"].append(name)

        bad_latin = latin_words(joined) + latin_words(m.get("type", "")) + latin_words(m.get("sk", ""))
        if bad_latin:
            problems["latin"].append(f"{name}: {', '.join(sorted(set(bad_latin))[:4])}")

        for a in acts:
            t = str(a.get("text", "")).strip()
            if len(t) > 12 and not t.endswith(SENT_END):
                problems["truncated"].append(f"{name}: {t[-45:]}")
                break

        if re.search(r"\s{2,}| [,.;:]", joined):
            problems["double_space"].append(name)

        rec = match(m, source)
        if not rec:
            problems["no_source"].append(name)
        else:
            src_acts = source_act_count(rec)
            if src_acts and len([t for t in texts if t.strip()]) < src_acts:
                problems["fewer_actions"].append(
                    f"{name}: {len([t for t in texts if t.strip()])}/{src_acts}")

    print(f"монстров в бестиарии: {len(monsters)}")
    print(f"сверено с исходником: {len(monsters) - len(problems['no_source'])}")
    print()
    for key, title in (
        ("no_actions", "без действий"),
        ("fewer_actions", "действий меньше, чем в исходнике"),
        ("empty_field", "пустые поля"),
        ("markup", "разметка 5e.tools"),
        ("latin", "английские слова в тексте"),
        ("truncated", "оборванный текст"),
        ("double_space", "двойные пробелы/пробел перед знаком"),
        ("no_source", "нет исходника для сверки"),
    ):
        items = problems[key]
        print(f"{title}: {len(items)}")
        for it in items[:5]:
            print("   ", it)
        if len(items) > 5:
            print(f"    … ещё {len(items)-5}")
        print()

    if "--json" in sys.argv:
        out = Path(sys.argv[sys.argv.index("--json") + 1])
        out.write_text(json.dumps(problems, ensure_ascii=False, indent=1), encoding="utf-8")
        print("отчёт сохранён:", out)


if __name__ == "__main__":
    main()
