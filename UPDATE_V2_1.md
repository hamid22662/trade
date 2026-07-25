# TradeLog v2.1 — Bug Fix & Luxury UI Update

## What changed

### Accurate P&L and pip value
- Forex P&L no longer uses a fixed `$10` per pip for every symbol.
- Each trade now stores a calculated pip value at entry.
- Known symbols are calculated as follows:
  - **EURUSD / GBPUSD:** $10 per pip for 1.00 lot.
  - **USDJPY:** `(100000 × 0.01) / entry price` USD per pip for 1.00 lot.
  - **XAUUSD:** $1 per 0.01 move for 1.00 lot with the included contract specification.
  - **NAS100:** $1 per point for 1.00 lot with the included contract specification.
- Existing closed trades are recalculated automatically at app startup using the corrected rules.
- Commission, swap and funding are deducted from the gross P&L to produce net P&L.

### Calculator
- Calculator now requires selecting the actual symbol instead of applying one global pip value to every market.
- The pip/point size and calculated pip value are visible before sizing a trade.
- The pip-value tab uses selected symbol + entry price + lot size.

### Interface redesign
- Complete luxury purple + graphite dark theme, plus a matching light theme.
- New cards, elevated inputs, premium chips, refined tabs and clearer result cards.
- Native basic alerts replaced by in-app themed toast messages and a custom confirmation dialog.

## Validation cases

| Case | Expected result |
|---|---:|
| EURUSD BUY, 1.0850 → 1.0920, 0.10 lot | +70.00 USD, +70 pips |
| USDJPY BUY, 145.00 → 144.30, 0.10 lot | about -48.28 USD, -70 pips |
| XAUUSD BUY, 2330.00 → 2335.00, 0.10 lot | +50.00 USD, +500 points |
| NAS100 BUY, 18000 → 18030, 1.00 lot | +30.00 USD, +30 points |

> Broker contract sizes differ. For custom symbols or brokers with a different contract definition, configure that symbol’s contract size or use the fallback pip value in Settings.

## Build validation

This source package passed TypeScript type checking and an Android Expo bundle export after the update.
