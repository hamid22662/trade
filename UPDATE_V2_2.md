# TradeLog – Update V2.2

## 1) Automatic symbol-based pip value
- Removed every runtime dependency on the old manual `pip_value_per_lot` setting.
- `calculateForexPipValuePerLot()` now derives the value for 1.00 lot from `pip_size × contract_size`.
- When quote currency is not USD/USDT (for example, USDJPY), the value is converted using the entered entry price as an offline approximation.
- The calculated forex value is saved in `trades.pip_value_at_entry` when the trade is created, so historical P&L remains stable.

## 2) Trade size field
- New Trade now places Lot Size / Quantity directly after Entry, Stop Loss and Take Profit.
- Forex stores the entered value in `lot_size` and displays the calculated pip value underneath the field.
- Crypto stores the entered value in `quantity`.
- Closing P&L uses the saved trade size for both markets.

## 3) Symbol management
- Settings now displays all symbols, including disabled ones.
- Every symbol can be enabled/disabled. Only active symbols appear in the New Trade dropdown.
- Added a modal for custom symbols: Symbol, Market, Pip Size, Contract Size and Quote Currency.
- Default symbols cannot be deleted. Custom symbols can be deleted.
- Database migration adds `is_custom` if needed and preserves existing trade history.

## Changed files
- `src/services/calculations.ts`
- `src/db/database.ts`
- `src/db/repositories.ts`
- `src/features/trades/NewTradeScreen.tsx`
- `src/features/settings/SettingsScreen.tsx`
- `src/features/calculator/CalculatorScreen.tsx`
- `src/constants/defaults.ts`
- `src/types/index.ts`
- `src/components/ui.tsx`
- `src/i18n/resources.ts`
