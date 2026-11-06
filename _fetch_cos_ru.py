#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Поиск русских статблоков Curse of Strahd на dnd.su.

Для каждого английского имени из data/bestiary/bestiary-cos.json ищет карточку
на dnd.su (официальная локализация), скачивает HTML в /tmp/dndsu-cos и пишет
карту имён /tmp/cos_ru_map.json: {en: {ru, url, slug}}.

Запуск: python3 _fetch_cos_ru.py [--limit N]
"""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
COS = os.path.join(HERE, "data", "bestiary", "bestiary-cos.json")
OUTDIR = "/tmp/dndsu-cos"
MAP = "/tmp/cos_ru_map.json"
UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}

LINK_RE = re.compile(r'href="(/bestiary/[^"]+)"[^>]*>\s*([^<]{2,120})<')


def norm(s):
    s = s.replace("’", "'").replace("‘", "'").replace("—", "-")
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def fetch(url, tries=3):
    for i in range(tries):
        try:
            r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25)
            return r.read().decode("utf-8", "ignore")
        except Exception:
            time.sleep(1.5 * (i + 1))
    return None


def search(name):
    q = urllib.parse.quote(name)
    html = fetch(f"https://dnd.su/bestiary/?search={q}")
    if not html:
        return None
    for href, title in LINK_RE.findall(html):
        m = re.search(r"\[(.+?)\]", title)
        if not m:
            continue
        if norm(m.group(1)) == norm(name):
            ru = re.sub(r"\s*\[.+?\]\s*$", "", title).strip()
            return {"ru": ru, "url": "https://dnd.su" + href,
                    "slug": href.strip("/").split("-", 1)[-1]}
    return None


def main():
    cos = json.load(open(COS, encoding="utf-8"))["monster"]
    names = []
    for m in cos:
        names.append(m["name"])
        if m.get("_copy"):
            names.append(m["_copy"]["name"])
    names = list(dict.fromkeys(names))
    if "--limit" in sys.argv:
        names = names[: int(sys.argv[sys.argv.index("--limit") + 1])]

    os.makedirs(OUTDIR, exist_ok=True)
    found = {}
    if os.path.exists(MAP):
        found = json.load(open(MAP, encoding="utf-8"))

    for i, en in enumerate(names, 1):
        if en in found and found[en]:
            continue
        hit = search(en)
        found[en] = hit
        print(f"{i:3}/{len(names)} {en} -> {hit['ru'] if hit else '—'}")
        if hit:
            slug = hit["url"].strip("/").split("/")[-1]
            path = os.path.join(OUTDIR, slug + ".html")
            if not os.path.exists(path):
                h = fetch(hit["url"])
                if h:
                    open(path, "w", encoding="utf-8").write(h)
        json.dump(found, open(MAP, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
        time.sleep(0.4)

    ok = sum(1 for v in found.values() if v)
    print(f"\nнайдено {ok} из {len(names)}")


if __name__ == "__main__":
    main()
