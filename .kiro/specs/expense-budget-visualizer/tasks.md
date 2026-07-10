# Implementation Plan: Expense & Budget Visualizer

## Overview

Implement a zero-dependency (Chart.js via CDN only), single-page expense tracker running entirely in the browser with LocalStorage persistence. The implementation follows the unidirectional data-flow pattern described in the design: all mutations go through `commit()` → `persist()` + `render()`. The three deliverable files are `index.html`, `css/style.css`, and `js/app.js`.

---

## Tasks

- [x] 1. Scaffold project files and HTML structure
  - Create `index.html` with the full semantic skeleton: `<header>` for balance display, `<main>` with sections `#input-section`, `#list-section`, `#chart-section`, `#limits-section`, `#categories-section`, `#summary-nav`, `#summary-section`
  - Add `<link rel="stylesheet" href="css/style.css">` and `<script src="js/app.js" defer>` using relative paths; add Chart.js CDN `<script>` tag before `js/app.js`
  - Create `css/style.css` as an empty placeholder file
  - Create `js/app.js` as an empty placeholder file
  - Confirm `index.html` opens via `file://` with no console errors
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 2. Implement constants, AppState, and persistence layer
  - [x] 2.1 Define CONSTANTS & CONFIG section in `js/app.js`
    - Declare LocalStorage keys (`ebv_transactions`, `ebv_categories`, `ebv_limits`), default categories array `["Food","Transport","Fun"]`, 12-color palette array, and warning override color `#FF4444`
    - _Requirements: 1.1, 5.1, 5.4, 5.5_
  - [x] 2.2 Implement `AppState` object and `commit()` helper
    - Define `AppState` with `transactions`, `categories`, and `limits` fields
    - Implement `commit()`: calls `saveToStorage()` then `render()`; ensure `categoryColors` Map is initialized at module scope and extended when new categories are encountered
    - _Requirements: 5.1, 5.4, 5.5_
  - [x] 2.3 Implement `loadFromStorage()` and `saveToStorage()` with error handling
    - Wrap all `localStorage` reads and writes in `try/catch`
    - On read failure or corrupt JSON: fall back to defaults and inject a `<div class="warning-banner">` auto-dismissed after 5 seconds
    - On write failure: allow in-memory state to proceed and show a non-blocking banner
    - Filter out transaction objects missing required fields (`id`, `name`, `amount`, `category`) on load
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.6_
  - [ ] 2.4 Write property test for transaction persistence round-trip (Property 1)
    - **Property 1: Transaction persistence round-trip**
    - Serialize an `fc.array` of valid transaction records to `"ebv_transactions"`, deserialize, and assert structural equivalence of all fields (`id`, `name`, `amount`, `category`, `createdAt`)
    - **Validates: Requirements 5.1, 5.2**
  - [ ]* 2.5 Write property test for non-transaction data persistence (Property 10)
    - **Property 10: Non-transaction data persists round-trip**
    - Generate arbitrary category arrays and limits objects; serialize/deserialize via the persistence helpers; verify casing and numeric values are preserved exactly
    - **Validates: Requirements 5.4, 5.5**

- [x] 3. Implement domain logic — validation and aggregation
  - [x] 3.1 Implement `validateTransaction(name, amount, category)`
    - Return error `"Item name is required"` for empty/whitespace name
    - Return error `"Amount must be greater than zero"` for zero, negative, or non-numeric amount
    - Return error `"Please select a category"` for missing category
    - Return `null` on valid input
    - _Requirements: 1.3, 1.4, 1.5_
  - [x] 3.2 Implement `validateCategory(label, existingCategories)`
    - Return error `"Category name cannot be empty"` for empty/whitespace label
    - Return error `"Category already exists"` for case-insensitive duplicate (compare trimmed values)
    - Return `null` on valid input
    - _Requirements: 6.2, 6.3, 6.4_
  - [x] 3.3 Implement `validateLimit(value)`
    - Return error `"Limit must be a number greater than zero"` for zero, negative, or non-numeric input
    - Return `null` on valid positive number
    - _Requirements: 7.1, 7.2_
  - [x] 3.4 Implement `generateId()` using `crypto.randomUUID()`
    - _Requirements: 1.2_
  - [x] 3.5 Implement `aggregateByCategory(transactions)` returning `{ [category]: totalAmount }`
    - This single function MUST be used by the list highlighter, chart builder, and summary renderer to guarantee consistency
    - _Requirements: 7.3, 7.4, 7.5_
  - [x] 3.6 Implement `calculateBalance(transactions)` and `formatAmount(value)`
    - `calculateBalance` returns arithmetic sum of all `amount` fields (returns `0` for empty array)
    - `formatAmount` returns `"$X.XX"` using `toFixed(2)`
    - _Requirements: 3.2, 3.3, 3.4_
  - [x] 3.7 Implement `groupByMonth(transactions)`
    - Group by `YYYY-MM` prefix of `createdAt`; sort months descending; within each month sort categories descending by amount, ties broken alphabetically; transactions whose category is absent from `AppState.categories` grouped under `"Uncategorized"`
    - _Requirements: 8.1, 8.2, 8.5_
  - [ ]* 3.8 Write property test for balance equals sum (Property 2)
    - **Property 2: Balance equals sum of all transaction amounts**
    - Generate `fc.array(fc.float({min:0.01, max:9999}))` as amounts; verify `calculateBalance()` equals `reduce(sum)` and `formatAmount()` produces `$X.XX` with exactly two decimal places
    - **Validates: Requirements 3.2, 3.3, 3.4**
  - [ ]* 3.9 Write property test for whitespace rejection (Property 4)
    - **Property 4: Empty and whitespace inputs are universally rejected**
    - Generate `fc.stringMatching(/^\s+$/)` strings; pass as item name to `validateTransaction` and as label to `validateCategory`; assert both return error strings
    - **Validates: Requirements 1.3, 6.3**
  - [ ]* 3.10 Write property test for non-positive amount/limit rejection (Property 5)
    - **Property 5: Non-positive numeric inputs are rejected**
    - Generate `fc.oneof(fc.constant(0), fc.float({max:-0.01}), fc.string())`; verify `validateTransaction` and `validateLimit` both reject these values
    - **Validates: Requirements 1.4, 7.1, 7.2**
  - [ ]* 3.11 Write property test for case-insensitive duplicate category (Property 6)
    - **Property 6: Duplicate category detection is case-insensitive**
    - Add a category C; generate case-permuted variants of C; call `validateCategory` with each variant; assert all return `"Category already exists"` and category list length is unchanged
    - **Validates: Requirements 6.2, 6.4**
  - [ ]* 3.12 Write property test for category totals consistency (Property 7)
    - **Property 7: Category totals are consistent across all UI regions**
    - Generate arbitrary transactions and partial limits; call `aggregateByCategory()` once and verify the same result object is used by the list highlighter, chart builder, and summary renderer (inject/spy on `aggregateByCategory`)
    - **Validates: Requirements 7.3, 7.4, 7.5**
  - [ ]* 3.13 Write property test for monthly summary grouping (Property 9)
    - **Property 9: Monthly summary grouping is exhaustive and accurate**
    - Generate transactions with random `fc.date()` createdAt values; verify every transaction appears in exactly one month group, months are descending, per-month categories are sorted correctly, and monthly totals equal exact sums
    - **Validates: Requirements 8.1, 8.2**

- [x] 4. Checkpoint — verify domain logic
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement renderers
  - [x] 5.1 Implement `renderBalance(state)`
    - Read `state.transactions`, write `#balance-display` text as `formatAmount(calculateBalance(state.transactions))`
    - _Requirements: 3.1, 3.2, 3.4_
  - [x] 5.2 Implement `renderList(state)`
    - Clear and re-populate `#transaction-list`; each row shows item name, `formatAmount(amount)`, category, date; apply `.over-limit` CSS class when category total ≥ limit using `aggregateByCategory()`; add delete button with `data-id`; show `"No transactions yet."` when empty; sort descending by `createdAt`
    - _Requirements: 2.1, 2.2, 2.3, 2.6, 7.3, 7.6_
  - [x] 5.3 Implement `updateChart(state)`
    - Build `labels[]` and `data[]` from `aggregateByCategory()`; create `Chart` instance on first call, call `chart.data = …; chart.update()` on subsequent; hide canvas and show `#chart-empty` when no transactions; use `state.categoryColors` for consistent slice colors; apply `#FF4444` override for over-limit categories; show legend
    - Handle Chart.js CDN failure: if `typeof Chart === 'undefined'`, show static message `"Chart unavailable — please check your internet connection."`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_
  - [x] 5.4 Implement `renderLimitsUI(state)`
    - Render one input row per category with current limit value pre-filled; include a clear/remove control per row
    - _Requirements: 7.1, 7.5, 7.7_
  - [x] 5.5 Implement `renderCategoryManager(state)`
    - Render the category text input (`maxlength="50"`), submit button, and current category list
    - _Requirements: 6.1_
  - [x] 5.6 Implement `renderSummary(state)`
    - Use `groupByMonth()` to render month headers, per-category totals, and monthly grand totals; skip months with no transactions
    - _Requirements: 8.1, 8.2, 8.4, 8.5_
  - [x] 5.7 Implement `render(state)` orchestrator
    - Call all renderer functions in order: `renderBalance`, `renderList`, `updateChart`, `renderLimitsUI`, `renderCategoryManager`, `renderSummary`
    - _Requirements: 1.2, 2.4, 2.5, 3.3, 7.4_

- [x] 6. Implement event handlers
  - [x] 6.1 Implement transaction form submission handler
    - Read `#transaction-form` fields; call `validateTransaction()`; display inline `<span class="error-msg">` per field on failure; on success call `commit()` after pushing new transaction (with `crypto.randomUUID()` id and ISO timestamp) sorted by `createdAt` desc; reset form fields
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  - [x] 6.2 Implement delete transaction handler (event delegation on `#transaction-list`)
    - Read `data-id` from clicked delete button; filter transaction out of `AppState.transactions`; call `commit()`
    - _Requirements: 2.5, 3.3, 4.3, 5.1, 8.3_
  - [x] 6.3 Implement category add handler
    - Read category text input; call `validateCategory()`; display inline error on failure; on success push label to `AppState.categories`, extend `categoryColors` map with next palette color, call `commit()`
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 6.4 Implement spending limit set/clear handler
    - On limit input change: call `validateLimit()`; show inline error on failure; on success update `AppState.limits[category]`; on clear (empty input) delete the key; call `commit()`
    - _Requirements: 7.1, 7.2, 7.5, 7.7_
  - [x] 6.5 Implement monthly summary navigation toggle
    - On nav control activation toggle visibility of `#summary-section`; re-render summary if currently visible and state has changed
    - _Requirements: 8.1, 8.3_
  - [ ]* 6.6 Write property test for valid submission creates transaction and resets form (Property 3)
    - **Property 3: Valid submission creates transaction and resets form**
    - Generate random valid triples `(name, positive amount, known category)` using `fc.tuple`; simulate form submission; verify `AppState.transactions.length` increased by 1, new entry carries submitted values, and all form fields are empty/reset
    - **Validates: Requirements 1.2, 1.6**
  - [ ]* 6.7 Write property test for delete removes transaction from all derived state (Property 8)
    - **Property 8: Deleting a transaction removes it from all derived state**
    - Generate `fc.array(transaction, {minLength:1})`; pick a random index; delete the transaction; verify it is absent from `AppState.transactions`, rendered list, balance computation, chart data, monthly summary, and deserialized LocalStorage value
    - **Validates: Requirements 2.5, 3.3, 4.3, 5.1, 8.3**

- [x] 7. Implement responsive CSS and accessibility
  - [x] 7.1 Write `css/style.css` — layout and base styles
    - Apply CSS Grid or Flexbox responsive layout; ensure no horizontal overflow on viewports 320px–2560px; style header, sections, form fields, buttons, transaction list rows
    - _Requirements: 9.1, 9.2_
  - [x] 7.2 Add over-limit and warning styles
    - Define `.over-limit` class (distinct warning color, not red-only — include icon or text label per accessibility requirement); ensure warning color differs from all category palette colors
    - _Requirements: 7.3, 7.6_
  - [x] 7.3 Add accessibility attributes to HTML and renderers
    - Associate all form controls with `<label>` elements; add `aria-live="polite"` to error message containers; ensure color warnings are not the sole indicator (icon or text label alongside highlight)
    - _Requirements: 9.1_
  - [x] 7.4 Add warning-banner styles
    - Style `.warning-banner` for non-blocking display above header with auto-dismiss behavior
    - _Requirements: 5.3_

- [x] 8. Implement `init()` bootstrap and wire everything together
  - [x] 8.1 Implement `DOMContentLoaded` `init()` function
    - Call `loadFromStorage()` to populate `AppState`; build initial `categoryColors` Map from loaded categories; attach all event listeners (form submit, list delete delegation, category add, limit handlers, nav toggle); call `render(AppState)` to paint initial UI
    - _Requirements: 5.2, 5.3, 5.4, 5.5, 6.5, 9.3_
  - [x] 8.2 Verify `file://` open works end-to-end with no console errors
    - Open `index.html` via `file://`; confirm stored data loads, chart renders, no missing-resource errors
    - _Requirements: 9.3, 9.5, 10.3_

- [x] 9. Final checkpoint — ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for an MVP; all others are required.
- Property tests use **fast-check** (CDN or npm); each test run a minimum of 100 iterations. Tag each test: `// Feature: expense-budget-visualizer, Property N: <property text>`
- Unit tests can use **Vitest** (zero-config) or plain `<script type="module">` test pages — no build step required.
- `aggregateByCategory()` MUST be the single shared function used by list, chart, and summary to guarantee Property 7 (consistent totals).
- `commit()` is the only way to mutate state — no renderer or handler touches LocalStorage or calls `render()` directly.
- The `categoryColors` Map is session-only (not persisted); it is rebuilt from `AppState.categories` in `init()`.

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["2.1", "2.2"] },
    { "id": 1, "tasks": ["2.3", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6", "3.7"] },
    { "id": 2, "tasks": ["2.4", "2.5", "3.8", "3.9", "3.10", "3.11", "3.12", "3.13"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"] },
    { "id": 4, "tasks": ["5.7", "6.1", "6.2", "6.3", "6.4", "6.5", "7.1", "7.2", "7.3", "7.4"] },
    { "id": 5, "tasks": ["6.6", "6.7", "8.1"] },
    { "id": 6, "tasks": ["8.2"] }
  ]
}
```
