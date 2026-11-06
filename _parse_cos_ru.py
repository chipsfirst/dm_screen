#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Разбор карточек монстров с dnd.su в формат проекта.

parse(path) -> dict с полями n, type, ac, hp, sp, ab, ab_list, sk, sav, imm,
sen, lang, cr, acts.
"""
import html as H
import json
import re

AB_TITLES = {"Сила": "Str", "Ловкость": "Dex", "Телосложение": "Con",
             "Интеллект": "Int", "Мудрость": "Wis", "Харизма": "Cha"}
AB_RU = {"Str": "Сил", "Dex": "Лов", "Con": "Тел", "Int": "Инт", "Wis": "Мудр", "Cha": "Хар"}

SECTION_TAG = {
    "Действия": "Действия",
    "Бонусные действия": "Бонус",
    "Реакции": "Реакция",
    "Легендарные действия": "Легендарные",
}
CURLY = re.compile(r"\{@[^}]*\}")
TAGS = re.compile(r"<[^>]+>")


def clean(s, strip_curly=False):
    if not isinstance(s, str):
        return ""
    s = re.sub(r"<sup>.*?</sup>", "", s, flags=re.S)
    s = re.sub(r'<span[^>]*class="icon-dice"[^>]*>.*?</span>', "", s, flags=re.S)
    s = re.sub(r'<span[^>]*class="rolled-hits"[^>]*>.*?</span>', "", s, flags=re.S)
    s = re.sub(r"<br\s*/?>", " ", s)
    s = re.sub(r"</(p|li)>", " ", s)
    s = TAGS.sub("", s)
    s = H.unescape(s)
    if strip_curly:
        s = CURLY.sub("", s)
    s = s.replace("\u00a0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def dice_ru_to_en(s):
    """«4к8 + 12» → «4d8 + 12», «футов» → «фт»."""
    s = re.sub(r"(\d+)\s*к\s*(\d+)", r"\1d\2", s)
    s = s.replace("футов", "фт").replace("фута", "фт").replace("фут ", "фт ")
    s = s.replace(" фт,", " фт,").replace("фт ,", "фт,")
    s = re.sub(r"\bлетая\b", "полёт", s)
    s = re.sub(r"\bплавая\b", "плавание", s)
    s = re.sub(r"\bлазая\b", "лазание", s)
    s = re.sub(r"\bкопая\b", "копание", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip(" ,")


def parse(path):
    raw = open(path, encoding="utf-8").read()
    i = raw.find("card__body new-article")
    if i < 0:
        return None
    body = raw[i:]
    j = body.find("card__footer")
    if j > 0:
        body = body[:j]

    out = {}
    m = re.search(r'<li class=["\']size-type-alignment["\']>(.*?)</li>', body, re.S)
    if m:
        t = clean(m.group(1))
        t = re.sub(r"\s*\(([^)]*)\)\s*$", r" (\1)", t)
        words = t.split(" ")
        if len(words) > 1:
            t = words[0] + " " + words[1].lower() + (" " + " ".join(words[2:]) if len(words) > 2 else "")
        out["type"] = t[:80]

    def field(label):
        mm = re.search(r"<strong>" + re.escape(label) + r"</strong>(.*?)</li>", body, re.S)
        return clean(mm.group(1)) if mm else ""

    out["ac"] = field("Класс Доспеха")[:40]
    hp = field("Хиты")
    out["hp"] = dice_ru_to_en(hp)[:30]
    out["sp"] = dice_ru_to_en(field("Скорость"))[:60]
    out["sav"] = dice_ru_to_en(field("Спасброски"))[:80]
    out["sk"] = dice_ru_to_en(field("Навыки"))[:120]
    out["sen"] = dice_ru_to_en(field("Чувства"))[:80]
    out["lang"] = field("Языки")[:100]
    cr = field("Опасность")
    cr = re.sub(r"\s*\(.*?опыт[^)]*\)", "", cr)
    out["cr"] = cr.strip()[:24]

    imm = []
    for lbl, tag in (("Сопротивление урону", "Сопротивление"), ("Иммунитет к урону", "Иммунитет"),
                     ("Уязвимость к урону", "Уязвимость"), ("Иммунитет к состоянию", "Иммунитет к состоянию")):
        v = field(lbl)
        if v:
            imm.append(f"{tag}: {v}")
    out["imm"] = "; ".join(imm)[:200]

    ab_list, saves = [], {}
    saves_raw = out.get("sav", "")
    for ttl, key in AB_TITLES.items():
        mm = re.search(r"class=['\"]stat['\"] title=['\"]" + ttl + r"['\"]><div>[^<]*</div><div>(\d+)\s*\(<strong>([+-]?\d+)</strong>\)", body)
        if mm:
            v = int(mm.group(1))
            ab_list.append({"k": key, "v": v, "m": int(mm.group(2)), "s": None})
    for m2 in re.finditer(r"(Сил|Лов|Тел|Инт|Мдр|Хар)\s*<strong>([+-]\d+)</strong>", saves_raw):
        saves[m2.group(1)] = m2.group(2)
    for a in ab_list:
        a["s"] = saves.get(AB_RU[a["k"]])
    out["ab_list"] = ab_list
    out["ab"] = ", ".join(f"{AB_RU[a['k']]} {a['v']} ({a['m']:+d})" for a in ab_list) if ab_list else ""

    acts = []
    blocks = re.findall(r'<li class="subsection desc">(.*?)</li>', body, re.S)
    for blk in blocks:
        hm = re.search(r'<h3 class="subsection-title">(.*?)</h3>', blk, re.S)
        tag = "Черты"
        if hm:
            tag = SECTION_TAG.get(clean(hm.group(1)), clean(hm.group(1)))
            blk = blk[hm.end():]
        for pm in re.finditer(r"<p>(.*?)</p>", blk, re.S):
            inner = pm.group(1)
            nm = re.match(r"\s*(?:<(?:strong|em)>\s*)+(.+?)(?:</(?:strong|em)>\s*)+", inner, re.S)
            if nm:
                name = clean(nm.group(1)).strip(" .")
                text = clean(inner[nm.end():])
                txt = (name + ". " + text).strip() if name else text
            else:
                txt = clean(inner)
            txt = dice_ru_to_en(txt)
            if len(txt) > 2:
                acts.append({"tag": tag, "text": txt[:1200]})
    out["acts"] = acts
    return out


if __name__ == "__main__":
    import sys
    p = parse(sys.argv[1])
    print(json.dumps(p, ensure_ascii=False, indent=1)[:4000])
