#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Оставляет в bestiary-data.js только монстров редакции 2024.

Эталон — data/monsters2024.json (510 статблоков). Записи 2014 года
(Aarakocra, Acolyte, Adult Blue Dracolich и прочие, которых нет в 2024)
удаляются. Сортировка и поля записей не меняются.

Запуск: python3 _filter_bestiary_2024.py
"""
import json
import re
import sys
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent.parent
SRC = BASE / 'data' / 'monsters2024.json'
TARGET = BASE / "js" / "data" / "bestiary-data.js"


def norm(s):
    return re.sub(r'\s+', ' ', str(s).replace('’', "'").replace('—', '-')).strip().lower()


def main():
    ref = json.loads(SRC.read_text(encoding='utf-8'))
    ref_names = {norm(m['name']) for m in ref}

    text = TARGET.read_text(encoding='utf-8')
    m = re.search(r'window\.BESTIARY = (\[.*\]);', text, re.S)
    if not m:
        print('Не нашёл window.BESTIARY в', TARGET)
        return 1
    items = json.loads(m.group(1))

    keep = [x for x in items if norm(x.get('en', '')) in ref_names]
    dropped = [x for x in items if norm(x.get('en', '')) not in ref_names]
    missing = sorted(ref_names - {norm(x['en']) for x in keep})

    header = (
        '// Бестиарий D&D 2024 — %d монстров. Сверено с data/monsters2024.json, '
        'записи редакции 2014 удалены.\n' % len(keep)
    )
    body = 'window.BESTIARY = ' + json.dumps(keep, ensure_ascii=False, separators=(',', ':')) + ';\n'
    TARGET.write_text(header + body, encoding='utf-8')

    print('было:', len(items), '| осталось:', len(keep), '| удалено:', len(dropped))
    if missing:
        print('нет в бестиарии, но есть в источнике:', len(missing), missing[:5])
    old2014 = [x for x in keep if 'БМ +' not in str(x.get('cr', ''))]
    print('осталось записей без формата 2024:', len(old2014))
    if old2014:
        print('  примеры:', [x['en'] for x in old2014[:8]])
    return 0


if __name__ == '__main__':
    sys.exit(main())
