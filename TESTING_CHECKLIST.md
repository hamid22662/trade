# TradeLog v0.1 Manual Acceptance Checklist

## Setup

- [ ] Fresh install opens onboarding.
- [ ] Persian is preselected and all primary labels are Persian.
- [ ] Switching to English changes text and component alignment immediately.
- [ ] Dark/light toggle persists after app restart.

## Open trade

- [ ] EURUSD BUY with valid Entry/SL/TP calculates a positive R/R.
- [ ] Position-size result changes as balance, risk %, Entry, SL, or pip value changes.
- [ ] Crypto suggested quantity changes based on the raw price distance to SL.
- [ ] Multiple chart images can be attached and remain visible after the gallery source is removed.
- [ ] At least two OPEN trades can exist at the same time.

## Close trade

- [ ] EURUSD: Entry 1.0850, Exit 1.0920, Lot 0.10, pip value $10 produces +70 pips and +$70 gross P&L before fees.
- [ ] Adding $2 commission, $1 swap, and $0 funding yields +$67 net P&L.
- [ ] SELL calculations reverse price direction correctly.
- [ ] Crypto BUY and SELL calculations multiply price move by quantity.
- [ ] Closing a trade moves it out of the OPEN filter and updates dashboard/analytics.

## Data safety

- [ ] App restart preserves trades, settings, images, and dashboard totals.
- [ ] CSV export sends a readable file to the share sheet.
- [ ] Delete trade removes its image records through database cascade.
- [ ] Delete all requires confirmation.
