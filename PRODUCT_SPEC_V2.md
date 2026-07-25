# TradeLog — Product Specification v2.1

This implementation spec supersedes the relevant parts of the initial PRD where calculations and data modelling needed correction.

## Locked product defaults

| Item | Decision |
|---|---|
| Product name | TradeLog |
| Accent color | Deep blue `#2F80ED` |
| Default language | Persian (`fa`) |
| Default forex pip value | $10 for 1 standard lot on XXX/USD pairs |
| Release priority | Android first, iOS compatible |
| Data model | Offline and single-user; SQLite is the source of truth |

## Corrections applied

### 1. Instrument-aware P&L

A universal `× 10,000` multiplier is no longer used. Each instrument stores:

- `pip_size` — EURUSD `0.0001`, USDJPY `0.01`, XAUUSD `0.01`, NAS100 `1`.
- `contract_size` — forex standard lot normally `100000`, gold normally `100`.
- `pip_value_at_entry` — captured at entry so later settings changes cannot alter historic P&L.

Forex gross P&L:

```text
pips = direction-aware price move / pip_size
gross_pnl = pips × lot_size × pip_value_at_entry
```

Crypto gross P&L:

```text
gross_pnl = direction-aware price move × quantity
```

Net P&L:

```text
net_pnl = gross_pnl - commission - swap_fee - funding_fee
```

### 2. Multiple image support

The single `chart_image_uri` field has been replaced with `trade_images`. Every trade may hold many entry, exit, or analysis images. The original gallery item is copied to the app document directory so the journal remains usable after a gallery cleanup.

### 3. Concurrent open positions

The data model and dashboard allow any number of OPEN trades. The dashboard shows the count and list; no singular-open-trade assumption remains.

### 4. Daily notes

`daily_notes` remains in the schema. The dedicated daily-journal screen is staged for the next increment, rather than leaving an unused table invisible to product planning.

### 5. RTL/LTR behaviour

Language changes update translation and component direction immediately. The app deliberately does not depend on `I18nManager.forceRTL()` because forcing the native layout direction typically requires a reload and damages the requested instant switching experience.

## Actual v0.1 scope

### Delivered core

- Onboarding and local settings
- FA/EN UI and dark/light themes
- SQLite schema and seed data
- Open-trade creation
- Close-trade workflow with fees and net P&L
- Multiple trade screenshots
- Trade list, search, details, and delete
- Dashboard summary
- Analytics by strategy and entry emotion
- Lot-size, R/R, and pip-value calculators
- CSV export

### Next increment

- Strategy, symbol, and checklist CRUD panels
- Trade edit flows and editable dates
- CSV import with user-visible column mapping and validation
- Portable backup/restore for SQLite plus all chart images
- Daily notes page and optional local notifications
- Visual charts and automated calculation tests
