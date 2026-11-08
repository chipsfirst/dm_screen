#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Перевод бестиария на русский (прозы действий/черт, имён и остатков лексики).

Локальную лексику (типы, размеры, мировоззрения, навыки, чувства, языки)
уже переводит _merge_bestiary.py. Этот скрипт переводит то, что осталось:
  * длинные тексты acts[].text (действия, черты, реакции);
  * английские имена монстров (поле n, где n == en);
  * остатки английских слов в sk/sen/lang/type (если встречаются буквы ASCII).

Перевод идёт через HTTP-сервис. По умолчанию — LibreTranslate на локальном
порту (не требует ключа), но эндпоинт/ключ настраиваются:

    ENDPOINT = "http://localhost:5000/translate"     # LibreTranslate
    TARGET   = "ru"
    API_KEY  = None                                   # если нужен ещё ключ

Запуск (после _merge_bestiary.py):
    python3 _translate_bestiary.py

Переведённые строки кэшируются в data/translation_cache.json, чтобы повторный
запуск не переводил всё заново. Работает, только если у тебя есть доступ к
сервису перевода (в этой среде сеть для пакетного перевода недоступна).
"""
import json, os, re, sys, time, urllib.request, urllib.parse

HERE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(HERE, "js", "data", "bestiary-data.js")
CACHE = os.path.join(HERE, 'data', 'translation_cache.json')

# ---- настройки перевода ----
ENDPOINT = os.environ.get('TR_ENDPOINT', 'http://localhost:5000/translate')
TARGET = 'ru'
API_KEY = os.environ.get('TR_API_KEY') or None
BATCH = 40          # строк на один запрос (если сервис поддерживает массив)
RETRIES = 3


def is_eng(s):
    return bool(re.search(r'[A-Za-z]', s or ''))


def load_cache():
    if os.path.exists(CACHE):
        try:
            return json.load(open(CACHE, encoding='utf-8'))
        except Exception:
            return {}
    return {}


def save_cache(cache):
    d = os.path.dirname(CACHE)
    os.makedirs(d, exist_ok=True)
    json.dump(cache, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def call_tr(texts):
    body = {
        'q': texts, 'source': 'en', 'target': TARGET, 'format': 'text',
        'api_key': API_KEY,
    }
    post = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(ENDPOINT, data=post, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode('utf-8')


def translate_batch(items):
    """items: список строк. Возвращает список переведённых строк той же длины."""
    out = []
    for i in range(0, len(items), BATCH):
        chunk = items[i:i + BATCH]
        got = None
        for _ in range(RETRIES):
            try:
                raw = call_tr(chunk)
                res = json.loads(raw)
                if isinstance(res, list):
                    got = [str(x) for x in res]
                elif isinstance(res, dict) and 'translatedText' in res:
                    got = [str(res['translatedText'])]
                break
            except Exception as e:
                print('   ! ошибка перевода, повтор:', e)
                time.sleep(2)
        if got is None or len(got) != len(chunk):
            print('   ! сервис не вернул массив из', len(chunk), '— пробуем по одной')
            got = []
            for s in chunk:
                try:
                    raw = call_tr([s])
                    res = json.loads(raw)
                    got.append(str(res.get('translatedText', s) if isinstance(res, dict) else (res[0] if isinstance(res, list) and res else s)))
                except Exception:
                    got.append(s)
        out += got
    return out


def main():
    data = json.loads(open(OUT, encoding='utf-8').read().split('window.BESTIARY = ', 1)[1].rstrip().rstrip(';'))
    cache = load_cache()

    # собираем уникальные непереведённые строки
    todo = set()
    records = []  # (координата, исходная строка)

    def reg(key, s):
        if not is_eng(s):
            return
        if key not in cache:
            todo.add(key)
        records.append((key, s))

    for m in data:
        if m.get('n') == m.get('en') and is_eng(m['n']):
            reg('name:' + m['en'], m['n'])
        for f in ('type', 'sk', 'sen', 'lang'):
            if is_eng(m.get(f, '')):
                reg(f'{f}:{m["en"]}:{m.get(f,"")}', m[f])
        for a in m.get('acts') or []:
            if is_eng(a.get('text', '')):
                reg('act:' + a['text'], a['text'])

    if not todo:
        print('Всё уже переведено (кэш заполнен); записываю как есть.')
    else:
        print('строк к переводу:', len(todo))
        ordered = sorted(todo)
        translated = translate_batch(ordered)
        for k, v in zip(ordered, translated):
            cache[k] = v
        save_cache(cache)
        print('переведено/обновлено:', len(translated))

    # применяем кэш к данным
    changed = 0
    for m in data:
        if m.get('n') == m.get('en'):
            nk = 'name:' + m['en']
            if nk in cache:
                m['n'] = cache[nk]; changed += 1
        for f in ('type', 'sk', 'sen', 'lang'):
            if is_eng(m.get(f, '')):
                k = f'{f}:{m["en"]}:{m.get(f,"")}'
                if k in cache:
                    m[f] = cache[k]; changed += 1
        for a in m.get('acts') or []:
            if is_eng(a.get('text', '')):
                k = 'act:' + a['text']
                if k in cache:
                    a['text'] = cache[k]; changed += 1

    header = (f'// Бестиарий D&D — {len(data)} монстров. '
              f'Собран _merge_bestiary.py из data/. Источники: 5e.tools / SRD.\n')
    open(OUT, 'w', encoding='utf-8').write(header + 'window.BESTIARY = ' + json.dumps(data, ensure_ascii=False) + ';\n')
    print(f'Готово: {OUT} — обновлено полей: {changed}')


if __name__ == '__main__':
    main()