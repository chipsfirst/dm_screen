# tools — сборщики данных

Скрипты в `tools/data/` превращают исходники из `data/` в готовые `js/data/*.js`,
которые подключает приложение. На работу самого приложения они не влияют:
в `dist/` не попадают (`packaging/pack_web.sh` их не копирует).

## Что где

| Скрипт | Что делает | Результат |
| --- | --- | --- |
| `_build_wow.py` | контент World of Warcraft | `js/data/wow-data.js` |
| `_build_library.py` | заклинания и предметы (PHB 2024) | `js/data/library-data.js` |
| `_merge_bestiary.py`, `_translate_bestiary_ru.py` | бестиарий: слияние и перевод | `js/data/bestiary-data.js` |
| `_build_bestiary_cos.py`, `_assemble_cos.py` | монстры Curse of Strahd | `js/data/bestiary-cos.js` |
| `_build_srd_items_521.py`, `_build_srd.py` | магические предметы SRD | `js/data/srd-data.js` |
| `_build_srd_chars.py` | классы, виды, предыстории SRD 5.2.1 | `js/data/srd-chars-data.js` |
| `_build_books.py` | индекс из книги AU | `js/data/books-data.js` |
| `_build_shop_catalog.py` | каталог снаряжения из PDF | `js/data/shop-catalog-data.js` |

Остальные `_fix_*`, `_audit_*`, `_filter_*`, `_rebuild_*`, `_polish_*`,
`_restore_*`, `_translate_bestiary.py` — разовые правки бестиария, оставлены
для истории. `_shop_ru.py`, `_spell_descs_ru.py`, `_dmg_notes.py`,
`_langs_fix.py`, `_parse_cos_ru.py` — словари-модули, их импортируют сборщики.

## Как запускать

Из корня репозитория (скрипты сами находят его через `__file__`):

```bash
python3 tools/data/_build_wow.py
```

Зависимости: `python3 -m pip install -r tools/data/requirements.txt`.

Промежуточные файлы — в `tools/data/_tmp/` (в git не попадают).
