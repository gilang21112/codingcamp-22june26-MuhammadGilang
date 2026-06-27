# Implementation Plan: Expense & Budget Visualizer

## Overview

Build a fully client-side SPA using plain HTML, CSS, and Vanilla JavaScript. The implementation follows a state-first architecture where `AppState` is the single source of truth, mutations are always synced to Local Storage, and all UI is re-derived from state on every change. Chart.js 4.x is loaded via CDN. The project has no build step.

---

## Tasks

- [x] 1. Scaffold project structure and base HTML
  - Create `index.html` with the complete HTML skeleton: `<header>`, `<main>` with all five sections (`#balance-section`, `#input-section`, `#chart-section`, `#transaction-section`, `#monthly-summary-section`), and the `#error-notification` banner
  - Add `<link>` to `css/style.css` and `<script>` tags for Chart.js 4.x CDN and `js/app.js` (Chart.js before app.js)
  - Create `css/style.css` and `js/app.js` as empty files to satisfy the single-file constraint
  - Ensure `<body data-theme="light">` is present as the default
  - Add `role="alert"` and `aria-live="assertive"` to `#error-notification`; add `aria-label` to `#theme-toggle`
  - _Requirements: 10.1, 10.2, 10.4_

- [x] 2. Implement CSS design tokens, layout, and theming
  - [x] 2.1 Write all CSS custom properties on `:root` (colors, spacing, radius, shadows) and override set on `[data-theme="dark"]` as specified in the design
    - Include `--color-bg`, `--color-surface`, `--color-text`, `--color-text-muted`, `--color-primary`, `--color-danger`, warning colors, `--color-border`, `--shadow-sm`, `--shadow-md`, `--radius`, `--spacing`
    - _Requirements: 6.2, 10.1_
  - [x] 2.2 Implement the centered single-column layout (`max-width: 860px; margin: 0 auto`), sticky header, and the two-column CSS Grid for chart + transaction list that collapses below 640px
    - _Requirements: 4.1, 10.3_
  - [x] 2.3 Style the `#balance-display.limit-exceeded` warning state and the `#transaction-list` scrollable container (`max-height: 360px; overflow-y: auto`)
    - Add `body, body *` theme transition (`background-color`, `color`, `border-color`, `0.2s ease`)
    - _Requirements: 2.3, 7.3, 7.4_

- [x] 3. Implement CONSTANTS, STATE, and LOCAL STORAGE sections in `js/app.js`
  - [x] 3.1 Define `LS_KEYS` constant object with keys `TRANSACTIONS = 'ebv_transactions'`, `SPENDING_LIMIT = 'ebv_spending_limit'`, `THEME = 'ebv_theme'`; define `CATEGORIES` array and `CATEGORY_COLORS` map
    - _Requirements: 10.1_
  - [x] 3.2 Define the `AppState` object with `transactions: []`, `spendingLimit: null`, `theme: 'light'`, `storageAvailable: true`
    - _Requirements: 9.4_
  - [x] 3.3 Implement `loadFromStorage()`: read all three LS keys inside a try/catch; coerce each transaction's `amount` to `Number`; if catch fires set `AppState.storageAvailable = false` and return safe defaults; return parsed state object
    - _Requirements: 2.4, 2.6, 6.4, 9.4_
  - [x] 3.4 Implement `syncToStorage()`: serialize and write all three LS keys inside a try/catch; conditionally remove `ebv_spending_limit` when `spendingLimit` is `null`; on catch call `showErrorNotification()`
    - _Requirements: 9.1, 9.2, 9.3, 9.5_
  

- [x] 4. Implement VALIDATION section in `js/app.js`
  - [x] 4.1 Implement `validateTransaction(name, amount, category)`: check name non-empty and ≤ 100 chars; check amount parses to number in [0.01, 999999999.99] with ≤ 2 decimal places; check category is one of `CATEGORIES`; return `{ valid: boolean, errors: string[] }`
    - _Requirements: 1.3, 1.4_
  - [x] 4.2 Implement `validateSpendingLimit(value)`: check value parses to a positive number in [0.01, 999999999.99]; return `{ valid: boolean, error: string }`
    - _Requirements: 7.1_

- [x] 5. Implement FORMATTERS and pure computation functions
  - [x] 5.1 Implement `formatCurrency(amount)`: return a string formatted as `$X,XXX.XX` using `toLocaleString` or equivalent; handle `0 → "$0.00"` and large values up to `$999,999,999.99`
    - _Requirements: 2.2, 4.2, 4.5_
  - [x] 5.2 Implement `computeBalance(transactions)`: return the arithmetic sum of all `amount` fields; return `0` for an empty array
    - _Requirements: 4.2, 4.5_
  - [x] 5.3 Implement `computeCategoryTotals(transactions)`: return an object `{ Food, Transport, Fun }` where each value is the sum of amounts for that category; omit keys with zero total
    - _Requirements: 5.1, 5.4, 5.5_
  - [x] 5.4 Implement `computeMonthlySummary(transactions, month, year)`: filter transactions by month/year from `timestamp`; compute per-category totals and grand total; omit categories with zero spending
    - _Requirements: 8.1, 8.5_
 

- [ ] 6. Checkpoint — Ensure pure functions and validation tests pass
  - Run all tests covering sections 3–5; verify `formatCurrency`, `computeBalance`, `computeCategoryTotals`, `computeMonthlySummary`, `validateTransaction`, and `validateSpendingLimit` produce correct output.
  - Ask the user if questions arise before proceeding.

- [x] 7. Implement STATE MUTATORS in `js/app.js`
  - [x] 7.1 Implement `addTransaction(name, amount, category)`: generate `id` with `crypto.randomUUID()` (fallback `Date.now().toString()`), set `timestamp: Date.now()`; push to `AppState.transactions`; call `syncToStorage()` then `renderAll()`
    - _Requirements: 1.2, 9.1_
  - [x] 7.2 Implement `deleteTransaction(id)`: splice the transaction matching `id` from `AppState.transactions`; call `syncToStorage()` then `renderAll()`
    - _Requirements: 3.2, 9.2_
  - [x] 7.3 Implement `setSpendingLimit(value)`: assign parsed float to `AppState.spendingLimit`; call `syncToStorage()` then `renderAll()`
    - _Requirements: 7.2, 9.3_
  - [x] 7.4 Implement `clearSpendingLimit()`: set `AppState.spendingLimit = null`; call `syncToStorage()` then `renderAll()`
    - _Requirements: 7.6_

- [x] 8. Implement RENDER FUNCTIONS: balance display and transaction list
  - [x] 8.1 Implement `renderBalance()`: read `computeBalance(AppState.transactions)`, format with `formatCurrency`, update `#balance-display` text; add/remove `.limit-exceeded` class based on whether total exceeds `AppState.spendingLimit`
    - _Requirements: 4.2, 4.3, 4.4, 4.5, 7.3, 7.4_
  - [x] 8.2 Implement `renderTransactionList()`: sort `AppState.transactions` by `timestamp` descending; rebuild `#transaction-list` `<ul>` with one `<li>` per transaction showing `.tx-name`, `.tx-amount` (formatted currency), `.tx-category`, and a `.delete-btn`; show empty-state message when array is empty
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 3.1_
  
- [x] 9. Implement CHART section using Chart.js
  - [x] 9.1 Implement `initChart()`: guard with `typeof Chart !== 'undefined'`; create a single `Pie` Chart.js instance stored in `chartInstance`; configure `legend.position: 'bottom'` and tooltip callback showing percentage; show "Chart unavailable" message if Chart.js is not loaded
    - _Requirements: 5.1, 10.1_
  - [x] 9.2 Implement `renderChart()`: call `computeCategoryTotals(AppState.transactions)`; filter entries with value > 0; if none, hide `<canvas>` and show `#chart-empty-msg`; otherwise show canvas, hide empty message, update `chartInstance.data.labels` and `chartInstance.data.datasets[0].data` using `CATEGORY_COLORS`, and call `chartInstance.update()`
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_

- [x] 10. Implement MONTHLY SUMMARY section
  - [x] 10.1 Implement `initYearSelector()`: scan `AppState.transactions` to find the earliest year; populate `#year-select` with options from that year to `new Date().getFullYear()`; default to current year
    - _Requirements: 8.2_
  - [x] 10.2 Implement `renderMonthlySummary()`: read selected values from `#month-select` and `#year-select`; call `computeMonthlySummary(AppState.transactions, month, year)`; rebuild `#summary-body` rows (category + formatted amount) and `#summary-grand-total`; show `#summary-empty-msg` when result is empty
    - _Requirements: 8.1, 8.3, 8.4, 8.5_

- [x] 11. Implement THEME section
  - [x] 11.1 Implement `setTheme(theme)`: set `document.body.dataset.theme = theme`; assign to `AppState.theme`; call `syncToStorage()`
    - _Requirements: 6.2, 6.3_
  - [x] 11.2 Implement `toggleTheme()`: call `setTheme` with the opposite of `AppState.theme`
    - _Requirements: 6.2_
 
- [ ] 12. Implement error notification helpers and `renderAll()`
  - [x] 12.1 Implement `showErrorNotification(message)`: set `#error-message` text, make `#error-notification` visible
    - _Requirements: 9.5_
  - [x] 12.2 Implement `dismissErrorNotification()`: hide `#error-notification`
    - _Requirements: 9.5_
  - [x] 12.3 Implement `renderAll()`: call `renderBalance()`, `renderTransactionList()`, `renderChart()`, `renderMonthlySummary()`, and re-apply spending limit style; ensure all UI reflects current `AppState` after a single call
    - _Requirements: 3.3, 3.4, 4.3, 4.4_

- [ ] 13. Implement EVENT LISTENERS and INIT sections
  - [x] 13.1 Wire the `#add-form` `submit` event: call `validateTransaction`; if invalid display errors in `#form-errors` and return; if valid call `addTransaction`, clear fields, and return focus to `#item-name`
    - _Requirements: 1.3, 1.4, 1.5_
  - [x] 13.2 Wire the `#spending-limit-form` submit event: call `validateSpendingLimit`; if invalid show error; if valid call `setSpendingLimit`; wire the "clear" button to `clearSpendingLimit()`
    - _Requirements: 7.1, 7.2, 7.6_
  - [ ] 13.3 Wire `#theme-toggle` click to `toggleTheme()`; wire `#dismiss-error` click to `dismissErrorNotification()`; wire `#month-select` and `#year-select` `change` events to `renderMonthlySummary()`; wire `#transaction-list` delegated click for `.delete-btn` to `deleteTransaction(id)`
    - _Requirements: 3.2, 6.2, 8.3, 9.5_
  - [ ] 13.4 Implement `init()`: call `loadFromStorage()` and apply returned state to `AppState`; if `!AppState.storageAvailable` call `showErrorNotification()`; apply saved theme before rendering (read `prefers-color-scheme` if no saved theme); call `initChart()`, `initYearSelector()`, `renderAll()`; call `init()` at the bottom of the file
    - _Requirements: 2.4, 5.6, 6.4, 6.5, 9.4_

- [ ] 14. Checkpoint — Full integration smoke test
  - Verify the complete app loads in a browser, transactions can be added/deleted, the chart updates, the monthly summary filters, the theme toggles and persists on reload, and the spending limit warning activates.
  - Ensure all automated tests pass.
  - Ask the user if questions arise before considering the feature complete.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- All property-based tests use [fast-check](https://github.com/dubzzz/fast-check) with a minimum of 100 iterations per property
- Each PBT must include a comment: `Feature: expense-budget-visualizer, Property N: <property_text>`
- Checkpoints (tasks 6 and 14) validate incremental progress before moving on
- Pure computation functions (tasks 5.2–5.4) have no DOM dependency and are the easiest to test first
- `crypto.randomUUID()` is available in all target browsers (Chrome 92+, Firefox 95+, Edge 92+, Safari 15.4+)

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["3.1", "3.2"] },
    { "id": 1, "tasks": ["3.3", "3.4", "4.1", "4.2", "5.1", "5.2", "5.3", "5.4", "2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.5", "3.6", "4.3", "5.5", "5.6", "5.7"] },
    { "id": 3, "tasks": ["7.1", "7.2", "7.3", "7.4"] },
    { "id": 4, "tasks": ["7.5", "8.1", "8.2", "9.1", "9.2", "10.1", "10.2", "11.1", "11.2", "12.1", "12.2"] },
    { "id": 5, "tasks": ["8.3", "8.4", "11.3", "12.3"] },
    { "id": 6, "tasks": ["13.1", "13.2", "13.3"] },
    { "id": 7, "tasks": ["13.4"] }
  ]
}
```
