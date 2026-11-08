#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка полного бестиария из локальных источников.

Что читает (что положишь — то и соберётся):
  * data/monsters2024.json        — уже выгруженные монстры (текущие 510), формат проекта;
  * data/bestiary/bestiary-*.json — СЫРЫЕ файлы 5e.tools (репозиторий 5etools-src:
                                    data/bestiary/*.json). Клади их в data/bestiary/.

Куда пишет:
  * bestiary-data.js (window.BESTIARY) — им пользуется приложение.

Как пользоваться:
  1. Скачай нужные файлы 5e.tools в data/bestiary/, например:
       bestiary-mm.json   (Monster Manual 2014)
       bestiary-xmm.json  (Monster Manual 2024)
       bestiary-vgm.json  (Volo's Guide)
       bestiary-mpmm.json (Mordenkainen Presents)
       bestiary-mtf.json  (Mordenkainen's Tome of Foes)
       bestiary-ftd.json  (Fizban's Treasury)
       ... любые другие bestiary-*.json
  2. Запусти:  python3 _merge_bestiary.py

Дубликаты по английскому имени пропускаются: первым идёт data/monsters2024.json
(у него уже русские названия), затем файлы из data/bestiary/.

⚠ Юридически: свободно распространять можно только SRD (CC-BY 5.2 / OGL 5.1).
Статблоки из платных книг копировать в публичный доступ нельзя — используй их
только в личной локальной копии. Ответственность за соблюдение лицензий — на тебе.
"""
import json, os, re, ast, glob, copy

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA = os.path.join(HERE, 'data')
RAWDIR = os.path.join(DATA, 'bestiary')
OUT = os.path.join(HERE, "js", "data", "bestiary-data.js")

TAG_RE = re.compile(r'<[^>]+>')
CURLY_RE = re.compile(r'\{@[^}]+\}')
AB_ORDER = ['Str', 'Dex', 'Con', 'Int', 'Wis', 'Cha']
AB_LOW = {'Str': 'str', 'Dex': 'dex', 'Con': 'con', 'Int': 'int', 'Wis': 'wis', 'Cha': 'cha'}
AB_RU = {'Str': 'Сил', 'Dex': 'Лов', 'Con': 'Тел', 'Int': 'Инт', 'Wis': 'Муд', 'Cha': 'Хар'}
SIZE_RU = {'T': 'Крошечный', 'S': 'Маленький', 'M': 'Средний', 'L': 'Большой', 'H': 'Огромный', 'G': 'Гигантский'}
ALIGN_MAP = {'L': 'Законоправный', 'C': 'Хаотичный', 'N': 'Нейтральный', 'G': 'Добрый', 'E': 'Злой', 'U': 'Без мировоззрения', 'A': 'Любое'}
# Распространённые соответствия EN->RU для структурированных полей (актуально для SRD/официальной лексики).
TYPE_RU = {
    'aberration': 'Аберрация', 'beast': 'Зверь', 'celestial': 'Небожитель', 'construct': 'Конструкт',
    'dragon': 'Дракон', 'elemental': 'Элементаль', 'fey': 'Фея', 'fiend': 'Исчадие',
    'giant': 'Гигант', 'humanoid': 'Гуманоид', 'monstrosity': 'Чудовище', 'ooze': 'Тварь-желе',
    'plant': 'Растение', 'undead': 'Нежить',
}
TAG_RU = {
    'aatype': 'людоед', 'aarakocra': 'ааракокра', 'aboloth': 'аболет', 'acolyte': 'послушник',
    'aesimon': 'э́симон', 'angel': 'ангел', 'any race': 'любая раса', 'baddut': 'баддун',
    'balorn': 'балор', 'bird': 'птица', 'bugbear': 'бугбер', 'bullywug': 'булливуг',
    'cat': 'кошка', 'centaur': 'кентавр', 'changeling': 'перевертень', 'commoner': 'простолюдин',
    'dog': 'собака', 'druid': 'друид', 'dwarf': 'дварф', 'elf': 'эльф', 'gith': 'гиф',
    'githyanki': 'гитянки', 'gnoll': 'гнолл', 'gnome': 'гном', 'goblinoid': 'гоблиноид',
    'goblins': 'гоблины', 'grimlock': 'гримлок', 'grung': 'грунг', 'guard': 'стражник',
    'hag': 'ведьма', 'halfling': 'полурослик', 'human': 'человек', 'kobold': 'кобольд',
    'krakull': 'кракен', 'kuo-toa': 'куо-тоа', 'leonin': 'львин', 'lizardfolk': 'ящеролюд',
    'locathah': 'локатх', 'merfolk': 'тритон', 'minotaur': 'минотавр', 'nagpa': 'нагпа',
    'orc': 'орк', 'outlander': 'дикарь', 'rat': 'крыса', 'sahuagin': 'сагуагин',
    'satyr': 'сатир', 'skeleton': 'скелет', 'snake': 'змея', 'spider': 'паук',
    'thri-kreen': 'три-кин', 'troll': 'тролль', 'vampire': 'вампир', 'wererat': 'крысооборотень',
    'wolf': 'волк', 'yakfolk': 'яколид', 'zilla': 'ящер',
    'shapechanger': 'оборотень', 'constructs': 'конструкты', 'undead': 'нежить',
    'titan': 'титан', 'devil': 'дьявол', 'demon': 'демон',
}
SKILL_RU = {
    'Acrobatics': 'Акробатика', 'Animal Handling': 'Уход за животными', 'Arcana': 'Аркана',
    'Athletics': 'Атлетика', 'Deception': 'Обман', 'History': 'История', 'Insight': 'Проницательность',
    'Intimidation': 'Запугивание', 'Investigation': 'Расследование', 'Medicine': 'Медицина',
    'Nature': 'Природа', 'Perception': 'Восприятие', 'Performance': 'Выступление',
    'Persuasion': 'Убеждение', 'Religion': 'Религия', 'Sleight of Hand': 'Ловкость рук',
    'Stealth': 'Скрытность', 'Survival': 'Выживание',
}
SENSE_RU = {
    'blindsight': 'слепое зрение', 'darkvision': 'тёмное зрение', 'truesight': 'истинное зрение',
    'tremorsense': 'чувство вибрации', 'Passive Perception': 'Пассивное Восприятие',
    'hover': 'зависание',
}
LANG_RU = {
    'Common': 'Общий', 'Dwarvish': 'Дварфийский', 'Elvish': 'Эльфийский', 'Giant': 'Гигантский',
    'Gnomish': 'Гномий', 'Goblin': 'Гоблинский', 'Halfling': 'Полурослический', 'Orc': 'Оркский',
    'Abyssal': 'Бездны', 'Celestial': 'Небесный', 'Draconic': 'Драконий', 'Deep Speech': 'Глубинная речь',
    'Infernal': 'Инфернальный', 'Primordial': 'Первобытный', 'Sylvan': 'Сильванский',
    'Undercommon': 'Подобщий', 'Telepathy': 'Телепатия',
}


def localize(s, *maps):
    """Заменяет английские слова на русские по порядку словарей (по токенам)."""
    if not isinstance(s, str):
        return s
    out = s
    for mp in maps:
        for en, ru in mp.items():
            out = re.sub(rf'(?i)\b{re.escape(en)}\b', ru, out)
    return out


def strip(s):
    if not isinstance(s, str):
        return ''
    s = CURLY_RE.sub('', s)
    s = TAG_RE.sub('', s)
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def load_mon():
    """Достаём словарь русских названий из _build_bestiary.py (если он есть)."""
    path = os.path.join(HERE, '_build_bestiary.py')
    try:
        src = open(path, encoding='utf-8').read()
        i = src.index('MON = {')
        start = src.index('{', i)
        depth = 0
        for j in range(start, len(src)):
            if src[j] == '{':
                depth += 1
            elif src[j] == '}':
                depth -= 1
                if depth == 0:
                    return ast.literal_eval(src[start:j + 1])
    except Exception as e:
        print('  (русские названия не загружены:', e, ')')
    return {}


def mod_of(score):
    return (int(score) - 10) // 2


def signed(n):
    return f'+{n}' if n >= 0 else str(n)


def flat_entries(entries):
    """5e.tools entries → список строк."""
    out = []
    if isinstance(entries, str):
        return [strip(entries)]
    if isinstance(entries, list):
        for e in entries:
            out += flat_entries(e)
    elif isinstance(entries, dict):
        if 'entries' in entries:
            out += flat_entries(entries['entries'])
        elif 'items' in entries:
            out += flat_entries(entries['items'])
        elif 'entry' in entries:
            out += flat_entries(entries['entry'])
    return out


def acts_custom(m):
    """Действия из формата проекта (actions — список строк; остальные — {items})."""
    def tag(tag, x):
        if not x:
            return []
        items = x if isinstance(x, list) else (x.get('items') if isinstance(x, dict) else [])
        return [{'tag': tag, 'text': strip(s)} for s in (items or []) if strip(s)]
    out = []
    out += tag('Действия', m.get('actions'))
    out += tag('Бонус', m.get('bonus_actions'))
    out += tag('Реакция', m.get('reactions'))
    out += tag('Черты', m.get('traits'))
    out += tag('Легендарные', m.get('legendary_actions'))
    return out


def acts_5e(m):
    out = []
    for key, tag in (('trait', 'Черты'), ('action', 'Действия'), ('bonus', 'Бонус'),
                     ('reaction', 'Реакция'), ('legendary', 'Легендарные')):
        for it in (m.get(key) or []):
            if isinstance(it, str):
                txt = strip(it)
            elif isinstance(it, dict):
                nm = strip(it.get('name', ''))
                body = ' '.join(flat_entries(it.get('entries') or it.get('entriesHigherLevel') or []))
                txt = (nm + '. ' + body) if nm else body
                txt = strip(txt)
            else:
                txt = ''
            if txt:
                out.append({'tag': tag, 'text': txt})
    out += acts_spellcasting(m)
    return out


def acts_spellcasting(m):
    out = []
    for sc in (m.get('spellcasting') or []):
        if not isinstance(sc, dict):
            continue
        nm = strip(sc.get('name', 'Spellcasting'))
        parts = []
        parts += flat_entries(sc.get('headerEntries') or [])
        for k in ('will', 'daily', 'recharge'):
            if isinstance(sc.get(k), list):
                parts += flat_entries(sc[k])
        for lvl in (sc.get('spells') or []):
            if isinstance(lvl, dict):
                parts += flat_entries(lvl.get('spells') or [])
        txt = strip((nm + '. ' + ' '.join(parts)) if parts else nm)
        if txt:
            out.append({'tag': 'Черты', 'text': txt})
    return out


SIZE_WORD_RU = {
    'Tiny': 'Крошечный', 'Small': 'Маленький', 'Medium': 'Средний', 'Large': 'Большой',
    'Huge': 'Огромный', 'Gargantuan': 'Гигантский', 'Colossal': 'Колоссальный',
}
TYPE_WORD_RU = {
    'Aberration': 'Аберрация', 'Beast': 'Зверь', 'Celestial': 'Небожитель', 'Construct': 'Конструкт',
    'Dragon': 'Дракон', 'Elemental': 'Элементаль', 'Fey': 'Фея', 'Fiend': 'Исчадие',
    'Giant': 'Гигант', 'Humanoid': 'Гуманоид', 'Monstrosity': 'Чудовище', 'Ooze': 'Тварь-желе',
    'Plant': 'Растение', 'Undead': 'Нежить',
}
ALIGN_WORD_RU = {
    'Lawful': 'Законоправный', 'Chaotic': 'Хаотичный', 'Neutral': 'Нейтральный',
    'Good': 'Добрый', 'Evil': 'Злой', 'Unaligned': 'Без мировоззрения', 'Any': 'Любое',
    'Neutral Evil': 'Нейтрально-злой', 'Neutral Good': 'Нейтрально-добрый', 'Any Alignment': 'Любое',
}
DRAGON_WORD_RU = {
    'Chromatic': 'Хроматический', 'Metallic': 'Металлический', 'Gem': 'Самоцветный',
}
SIZE_ABBR_WORD_RU = {'T': 'Крошечный', 'S': 'Маленький', 'M': 'Средний', 'L': 'Большой', 'H': 'Огромный', 'G': 'Гигантский'}


def type_custom(m):
    return localize(str(m.get('type', '')), SIZE_WORD_RU, TYPE_WORD_RU, ALIGN_WORD_RU, DRAGON_WORD_RU)[:80]


def type_5e(m):
    size = m.get('size')
    sz = ''
    if isinstance(size, list) and size:
        sz = SIZE_RU.get(size[0], '')
    elif isinstance(size, str):
        sz = SIZE_RU.get(size, '')
    t = m.get('type')
    tags = []
    if isinstance(t, dict):
        tt = str(t.get('type', ''))
        tags = t.get('tags') or []
    else:
        tt = str(t or '')
    tt = TYPE_RU.get(tt.lower(), tt.capitalize() if tt else '')
    base = ' '.join(x for x in [sz, tt] if x)
    if tags:
        tag_words = []
        for x in tags:
            if isinstance(x, dict):
                tag_words.append(localize(str(x.get('tag', '')), TAG_RU))
            else:
                tag_words.append(localize(str(x), TAG_RU))
        base += ' (' + ', '.join(w for w in tag_words if w) + ')'
    al = m.get('alignment')
    if isinstance(al, list) and al:
        flat = []
        for c in al:
            if isinstance(c, dict):
                v = c.get('alignment')
                if isinstance(v, list): flat.extend(v)
                elif v is not None: flat.append(v)
                else:
                    for k, v2 in c.items():
                        if k == 'chance': continue
                        if isinstance(v2, list): flat.extend(v2)
                        elif v2 is not None: flat.append(v2)
            elif isinstance(c, str):
                flat.append(c)
        words = [ALIGN_MAP.get(str(x), str(x)) for x in flat if str(x).strip()]
        if words:
            base += ', ' + ' '.join(words)
    return base.strip()[:80]


def ac_5e(m):
    ac = m.get('ac')
    if ac is None:
        return ''
    if isinstance(ac, (int, float, str)):
        return str(ac)
    if isinstance(ac, dict):
        ac = [ac]
    parts = []
    for e in ac:
        if isinstance(e, dict):
            v = e.get('ac')
            frm = e.get('from')
            if frm:
                frm = ', '.join(frm) if isinstance(frm, list) else str(frm)
                parts.append(f'{v} ({frm})')
            elif v is not None:
                parts.append(str(v))
        else:
            parts.append(str(e))
    return ', '.join(parts)[:40]


def hp_5e(m):
    hp = m.get('hp')
    if hp is None:
        return ''
    if isinstance(hp, list):
        hp = hp[0] if hp else {}
    if isinstance(hp, dict):
        avg = hp.get('average')
        formula = hp.get('formula')
        return f'{avg} ({formula})' if formula else str(avg if avg is not None else '')
    return str(hp)[:30]


def sp_5e(m):
    sp = m.get('speed')
    if sp is None:
        return ''
    if isinstance(sp, (int, float, str)):
        return f'{sp} ft.'
    if isinstance(sp, dict):
        parts = []
        for k in ('walk', 'fly', 'swim', 'climb', 'burrow'):
            if k in sp:
                v = sp[k]
                if isinstance(v, dict):
                    v = v.get('number')
                label = '' if k == 'walk' else k.capitalize() + ' '
                parts.append(f'{label}{v} ft.')
        if sp.get('hover') and parts:
            parts[0] += ' (hover)'
        return ', '.join(p for p in parts if p.strip())[:60]
    return ''


def ab_list_custom(m):
    abl = m.get('abilities') or {}
    out = []
    for k in AB_ORDER:
        a = abl.get(k) or {}
        sc = int(a.get('score', 10))
        out.append({'k': k, 'v': sc, 'm': mod_of(sc), 's': a.get('save')})
    return out


def ab_list_5e(m):
    saves = m.get('save') or {}
    out = []
    for k in AB_ORDER:
        sc = int(m.get(AB_LOW[k], 10) or 10)
        out.append({'k': k, 'v': sc, 'm': mod_of(sc), 's': saves.get(AB_LOW[k])})
    return out


def ab_str(ab_list):
    return ', '.join(f"{AB_RU[x['k']]} {x['v']} ({signed(x['m'])})" for x in ab_list)


def row_custom(m, mon):
    name = str(m.get('name', ''))
    ab = ab_list_custom(m)
    return {
        'n': mon.get(name, name), 'en': name,
        'type': type_custom(m), 'cr': str(m.get('CR', ''))[:24],
        'ac': str(m.get('AC', ''))[:24], 'hp': str(m.get('HP', ''))[:30],
        'sp': str(m.get('Speed', ''))[:60], 'init': str(m.get('initiative', ''))[:16],
        'ab': ab_str(ab), 'sk': localize(str(m.get('skills', '')), SKILL_RU)[:120],
        'sen': localize(str(m.get('senses', '')), SENSE_RU)[:80], 'lang': localize(str(m.get('languages', '')), LANG_RU)[:80],
        'img': m.get('image_src', '') or '', 'ab_list': ab, 'acts': acts_custom(m)[:60],
        '_src': str(m.get('source', '')),
    }


def row_5e(m, mon):
    name = str(m.get('name', ''))
    ab = ab_list_5e(m)
    init = signed(mod_of(m.get('dex', 10))) + f' ({10 + mod_of(m.get("dex", 10))})'
    sk = m.get('skill') or {}
    sk_s = ', '.join(f'{k.capitalize()} {v}' for k, v in sk.items()) if isinstance(sk, dict) else ''
    sen = m.get('senses') or []
    sen_s = ', '.join(str(x) for x in sen) if isinstance(sen, list) else str(sen)
    if m.get('passive') and 'Passive' not in sen_s:
        sen_s = (sen_s + ', ' if sen_s else '') + f"Passive Perception {m['passive']}"
    lang = m.get('languages') or []
    lang_s = ', '.join(str(x) for x in lang) if isinstance(lang, list) else str(lang)
    cr = m.get('cr')
    if isinstance(cr, dict):
        cr = cr.get('cr', '')
    return {
        'n': mon.get(name, name), 'en': name,
        'type': type_5e(m), 'cr': str(cr)[:24],
        'ac': ac_5e(m), 'hp': hp_5e(m), 'sp': sp_5e(m), 'init': init[:16],
        'ab': ab_str(ab), 'sk': localize(sk_s, SKILL_RU)[:120],
        'sen': localize(sen_s, SENSE_RU)[:80], 'lang': localize(lang_s, LANG_RU)[:80],
        'img': '', 'ab_list': ab, 'acts': acts_5e(m)[:60],
        '_src': str(m.get('source', '')),
    }


def load_list(path):
    data = json.load(open(path, encoding='utf-8'))
    if isinstance(data, dict):
        return data.get('monster') or []
    return data if isinstance(data, list) else []


def merge_copy(base_row, entry, mon):
    """Разворачивает _copy: клонирует базовый статблок и применяет правки записи."""
    import copy as _copy
    row = _copy.deepcopy(base_row)
    name = str(entry.get('name', ''))
    row['en'] = name
    row['n'] = mon.get(name, name)
    if 'ac' in entry:
        v = ac_5e(entry)
        if v:
            row['ac'] = v
    if 'hp' in entry:
        v = hp_5e(entry)
        if v:
            row['hp'] = v
    if 'cr' in entry:
        row['cr'] = str(entry['cr'])[:24]
    if 'speed' in entry:
        v = sp_5e(entry)
        if v:
            row['sp'] = v
    ab = row.get('ab_list') or []
    changed = False
    for k in AB_ORDER:
        low = AB_LOW[k]
        if isinstance(entry.get(low), (int, float)):
            v = int(entry[low])
            for x in ab:
                if x['k'] == k:
                    x['v'] = v
                    x['m'] = mod_of(v)
                    changed = True
    if changed:
        row['ab_list'] = ab
        row['ab'] = ab_str(ab)
    if any(k in entry for k in ('type', 'size', 'alignment')):
        t = type_5e(entry)
        if t:
            if 'size' not in entry:
                bsz = (base_row.get('type', '').split(' ')[0] or '')
                if bsz and not t.lower().startswith(bsz.lower()):
                    t = (bsz + ' ' + t).strip()
            row['type'] = t[:80]
    extra = []
    for key, tag in (('trait', 'Черты'), ('action', 'Действия'), ('bonus', 'Бонус'),
                     ('reaction', 'Реакция'), ('legendary', 'Легендарные')):
        for it in (entry.get(key) or []):
            if isinstance(it, str):
                txt = strip(it)
            elif isinstance(it, dict):
                nm = strip(it.get('name', ''))
                body = ' '.join(flat_entries(it.get('entries') or []))
                txt = strip((nm + '. ' + body) if nm else body)
            else:
                txt = ''
            if txt:
                extra.append({'tag': tag, 'text': txt})
    extra += acts_spellcasting(entry)
    if extra:
        row['acts'] = (row.get('acts') or []) + extra
    return row


def main():
    mon = load_mon()
    rows = []
    byname = {}
    pending = []

    def add(row):
        key = (row['en'] or '').strip().lower()
        if not key or key in byname:
            return False
        byname[key] = row
        rows.append(row)
        return True

    # 1) уже выгруженные монстры проекта
    custom = os.path.join(DATA, 'monsters2024.json')
    if os.path.exists(custom):
        for m in load_list(custom):
            add(row_custom(m, mon))
        print(f'monsters2024.json: всего {len(rows)}')

    # 2) сырые файлы 5e.tools (+ собираем _copy-алиасы на развёртывание)
    files = sorted(glob.glob(os.path.join(RAWDIR, 'bestiary-*.json')))
    if not files:
        print(f'Нет файлов в {RAWDIR}. Положи туда data/bestiary/*.json из 5etools-src и запусти снова.')
    for path in files:
        before = len(rows)
        try:
            items = load_list(path)
        except Exception as e:
            print('  ! пропуск', os.path.basename(path), '—', e)
            continue
        for m in items:
            if not isinstance(m, dict) or not m.get('name'):
                continue
            if '_copy' in m:
                pending.append(m)
                continue
            add(row_5e(m, mon))
        print(f'  + {os.path.basename(path)}: +{len(rows) - before} новых')

    # 3) разворачиваем _copy-алиасы в несколько проходов (копия может ссылаться на копию)
    resolved = 0
    passes = 0
    while pending and passes < 12:
        passes += 1
        still = []
        progress = False
        for m in pending:
            base = byname.get(str(m.get('_copy', {}).get('name', '')).strip().lower())
            if not base:
                still.append(m)
                continue
            if add(merge_copy(base, m, mon)):
                resolved += 1
                progress = True
        pending = still
        if not progress:
            break
    skipped_ref = len(pending)

    # финальный формат для приложения
    out = []
    for i, r in enumerate(rows):
        r2 = {k: v for k, v in r.items() if not k.startswith('_')}
        r2['id'] = i
        out.append(r2)

    header = (f'// Бестиарий D&D — {len(out)} монстров. '
              f'Собран _merge_bestiary.py из data/. Источники: 5e.tools / SRD.\n')
    open(OUT, 'w', encoding='utf-8').write(header + 'window.BESTIARY = ' + json.dumps(out, ensure_ascii=False) + ';\n')
    print(f'Готово: {OUT} — {len(out)} монстров '
          f'(развёрнуто _copy-алиасов: {resolved}, без базы: {skipped_ref})')


if __name__ == '__main__':
    main()
