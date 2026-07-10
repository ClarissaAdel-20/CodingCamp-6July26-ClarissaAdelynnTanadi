# Design Document: Expense & Budget Visualizer

## Overview

The Expense & Budget Visualizer is a zero-dependency (except Chart.js via CDN), single-page web application. It runs entirely in the browser with no backend, no build step, and no local server — just open `index.html` from the file system. All state lives in the browser's `localStorage`, and the UI is driven by a central in-memory state object that is re-rendered on every mutation.

**Technology choices:**
- **HTML5 + CSS3** for structure and styling
- **Vanilla JavaScript (ES2020)** for all application logic
- **[Chart.js v4](https://www.chartjs.org/)** (CDN) for the pie chart — `https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js`
- **LocalStorage** for persistence — no IndexedDB, cookies, or service workers needed

**Key design principles:**
- One source of truth: the in-memory `AppState` object. Every UI component reads from it and never holds its own state.
- Reactive rendering: all mutations go through a `commit()` helper that persists to LocalStorage and then calls `render()` to refresh all UI regions.
- No inline styles or `<script>` blocks in `index.html`; all logic in `js/app.js`, all styles in `css/style.css`.

---

## Architecture

The application follows a simple unidirectional data-flow pattern:

```
User Interaction
      │
      ▼
 Event Handler  ──►  mutate AppState  ──►  commit()
                                               │
                          ┌────────────────────┤
                          │                    │
                          ▼                    ▼
                   persist()             render()
                  (localStorage)     (all UI regions)
```

### Module layout (single `js/app.js` file, structured with clear comment sections)

```
js/app.js
 ├── 1. CONSTANTS & CONFIG         – keys, default categories, palette
 ├── 2. STATE                      – AppState object + commit()
 ├── 3. PERSISTENCE                – load(), save(), safe wrappers
 ├── 4. DOMAIN LOGIC               – validation, ID generation, aggregation
 ├── 5. CHART                      – chartInstance management, updateChart()
 ├── 6. RENDERERS                  – renderBalance(), renderList(), renderSummary(), renderLimitsUI()
 ├── 7. EVENT HANDLERS             – form submit, delete, category add, limit set, nav
 └── 8. INIT                       – DOMContentLoaded bootstrap
```

### File structure

```
index.html
css/
  style.css
js/
  app.js
```

---

## Components and Interfaces

### HTML structure (index.html)

```
<body>
  <header>                        ← Balance display (#balance-display)
  <main>
    <section #input-section>      ← Transaction Input Form (#transaction-form)
    <section #list-section>       ← Transaction List (#transaction-list)
    <section #chart-section>      ← Pie Chart canvas + no-data message
    <section #limits-section>     ← Spending Limit configuration
    <section #categories-section> ← Category Manager
    <nav #summary-nav>            ← Monthly Summary navigation control
    <section #summary-section>    ← Monthly Summary view
  </main>
</body>
```

### Component contracts

#### `renderBalance(state)`
- Reads `state.transactions`
- Writes `#balance-display` text content
- Format: `$X.XX` using `toFixed(2)`

#### `renderList(state)`
- Reads `state.transactions`, `state.limits`
- Clears and re-populates `#transaction-list`
- Each row: name | `$X.XX` | category | date
- Applies `.over-limit` CSS class when category total ≥ limit
- Adds delete button with `data-id` attribute
- Shows "No transactions yet." when empty

#### `updateChart(state)`
- Reads `state.transactions`, `state.limits`, `state.categoryColors`
- Builds `labels[]` and `data[]` from category aggregation
- Creates `Chart` instance on first call; calls `chart.data = …; chart.update()` on subsequent calls
- Hides `<canvas>` and shows `#chart-empty` when no transactions
- Uses `state.categoryColors` map for consistent colors; warning segments use override color

#### `renderLimitsUI(state)`
- Reads `state.categories`, `state.limits`
- Renders one input row per category for setting/clearing limits

#### `renderCategoryManager(state)`
- Renders the `#category-form` with current categories listed

#### `renderSummary(state)`
- Groups `state.transactions` by `YYYY-MM`
- For each month: header label, per-category totals (sorted desc by amount, alpha on tie), month total
- Transactions whose category is not in `state.categories` grouped under "Uncategorized"

---

## Data Models

### `Transaction`
```js
{
  id:        string,   // UUID v4 (crypto.randomUUID())
  name:      string,   // item name, 1–100 chars
  amount:    number,   // positive float, stored as-is
  category:  string,   // category label exactly as stored
  createdAt: string    // ISO 8601 timestamp, e.g. "2025-07-06T14:32:00.000Z"
}
```

### `AppState`
```js
{
  transactions: Transaction[],   // ordered by createdAt desc for rendering
  categories:   string[],        // includes defaults + custom; order = insertion order
  limits:       { [category: string]: number }  // only categories with limits set
}
```

### LocalStorage schema

| Key | Format | Default |
|---|---|---|
| `ebv_transactions` | JSON array of `Transaction` | `[]` |
| `ebv_categories` | JSON array of strings | `["Food","Transport","Fun"]` |
| `ebv_limits` | JSON object `{ [cat]: number }` | `{}` |

### `categoryColors` (session-only, not persisted)

A `Map<string, string>` built during `init()` and extended whenever a new category is encountered. Maps each category label to a hex color drawn from a fixed 12-color palette. This ensures colors stay consistent within a session (Requirement 4.5). The warning override color (`#FF4444`) is applied dynamically at render time, not stored in this map.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Transaction persistence round-trip

*For any* list of valid transactions committed to LocalStorage, reading back and deserializing the `"ebv_transactions"` key SHALL produce an array of transaction objects that are structurally equivalent (same `id`, `name`, `amount`, `category`, `createdAt`) to those that were written.

**Validates: Requirements 5.1, 5.2**

---

### Property 2: Balance equals sum of all transaction amounts

*For any* list of transactions (including the empty list), the `calculateBalance()` function SHALL return a value equal to the arithmetic sum of every transaction's `amount`, and the rendered `#balance-display` text SHALL show that value formatted to exactly two decimal places with a leading `$`.

**Validates: Requirements 3.2, 3.3, 3.4**

---

### Property 3: Valid submission creates transaction and resets form

*For any* valid input triple (non-empty name, positive amount, known category), submitting the Input_Form SHALL add exactly one new transaction to `AppState.transactions` (increasing its length by 1, with the new entry carrying the submitted values) AND leave all form fields in their default/empty state after the submission completes.

**Validates: Requirements 1.2, 1.6**

---

### Property 4: Empty and whitespace inputs are universally rejected

*For any* string that is empty or composed entirely of whitespace characters, submitting it as the item name in the Input_Form SHALL be rejected (list length unchanged, error message shown), and submitting it as a category name in the Category_Manager SHALL also be rejected (category list unchanged, error message shown).

**Validates: Requirements 1.3, 6.3**

---

### Property 5: Non-positive numeric inputs are rejected

*For any* value that is zero, negative, or non-numeric, submitting it as the amount in the Input_Form SHALL be rejected without adding a transaction, and submitting it as a Spending_Limit value SHALL be rejected without saving a limit.

**Validates: Requirements 1.4, 7.1, 7.2**

---

### Property 6: Duplicate category detection is case-insensitive

*For any* existing category label C already in `AppState.categories`, attempting to add a new category whose trimmed value equals C under any combination of upper/lower case SHALL be rejected, leaving the category list length and contents unchanged.

**Validates: Requirements 6.2, 6.4**

---

### Property 7: Category totals are consistent across all UI regions

*For any* combination of transactions and spending limits, the per-category spending totals computed by `aggregateByCategory()` SHALL be used identically by the Transaction_List highlighter, the Chart data builder, and the Monthly_Summary renderer — so that the same category never shows contradictory totals in different parts of the UI.

**Validates: Requirements 7.3, 7.4, 7.5**

---

### Property 8: Deleting a transaction removes it from all derived state

*For any* transaction T in a non-empty `AppState.transactions`, after deleting T: T SHALL NOT appear in the rendered Transaction_List, T's amount SHALL NOT contribute to the Balance, T's category/amount SHALL NOT appear in Chart data, T SHALL NOT appear in the Monthly_Summary, and T SHALL NOT be present in the deserialized `"ebv_transactions"` LocalStorage value.

**Validates: Requirements 2.5, 3.3, 4.3, 5.1, 8.3**

---

### Property 9: Monthly summary grouping is exhaustive and accurate

*For any* set of transactions, every transaction SHALL appear in exactly one month group (keyed by the `YYYY-MM` prefix of its `createdAt`), months SHALL be ordered descending, per-month category totals SHALL be sorted descending by amount (alphabetically on ties), and the monthly grand total SHALL equal the exact sum of all transaction amounts in that group.

**Validates: Requirements 8.1, 8.2**

---

### Property 10: Non-transaction data persists round-trip

*For any* list of category strings written to `"ebv_categories"` and any limits object written to `"ebv_limits"`, deserializing each key from LocalStorage SHALL produce a value that is structurally equivalent to what was written — preserving category casing and limit values exactly.

**Validates: Requirements 5.4, 5.5, 6.5**

---

## Error Handling

### LocalStorage unavailability
- All LocalStorage reads/writes are wrapped in a `try/catch`.
- On read failure (unavailable or corrupt data): `AppState` is initialized with defaults; a non-blocking `<div class="warning-banner">` is injected above the header and auto-dismissed after 5 seconds. The app remains fully functional in-memory for the session.
- On write failure: the in-memory state update proceeds (the user sees the change immediately); a non-blocking banner warns that the change was not persisted.

### Corrupt stored data
- `JSON.parse` failures are caught; corrupt keys are treated as if absent.
- Individual transaction objects that are missing required fields (`id`, `name`, `amount`, `category`) are silently filtered out on load — the app never crashes due to partial data.

### Validation errors
- All validation errors are displayed as inline `<span class="error-msg">` elements adjacent to the relevant input.
- Errors are cleared on the next valid submission or when the user begins typing again.
- No alert() / confirm() dialogs are used.

### Chart.js CDN failure
- If the Chart.js `<script>` fails to load (offline), the chart section shows a static message: "Chart unavailable — please check your internet connection."
- All other functionality (form, list, balance, summary) continues to work.

---

## Testing Strategy

### Unit tests (example-based)

Focus areas:
- **Validation functions**: `validateTransaction()`, `validateCategory()`, `validateLimit()` — test each error message with concrete inputs.
- **Formatting functions**: `formatAmount()` — verify `$1234.56` output for representative inputs.
- **Aggregation functions**: `aggregateByCategory()`, `groupByMonth()` — test with small fixed datasets.
- **LocalStorage wrappers**: `loadFromStorage()`, `saveToStorage()` — mock `localStorage` to test error paths.

Framework recommendation: [Vitest](https://vitest.dev/) (zero-config, runs in Node, supports `jsdom` for DOM manipulation) or plain `<script type="module">` test pages if no toolchain is desired.

### Property-based tests

Framework: **[fast-check](https://fast-check.io/)** — runs in Node or the browser, no build step required.

Each property test runs a minimum of **100 iterations**.

Tag format per property: `// Feature: expense-budget-visualizer, Property N: <property text>`

| Property | Test description | Generators |
|---|---|---|
| **Property 1** – Transaction persistence round-trip | Serialize then deserialize any array of valid transactions; verify structural equivalence of all fields | `fc.array(fc.record({id: fc.uuid(), name: fc.string({minLength:1}), amount: fc.float({min:0.01}), category: fc.string(), createdAt: fc.date().map(d => d.toISOString())}))` |
| **Property 2** – Balance = sum | Generate any transaction list, compute via `calculateBalance()`, compare against `reduce(sum)`, verify formatted output | `fc.array(fc.float({min:0.01, max:9999}))` |
| **Property 3** – Valid submission creates transaction + resets form | Generate random valid triples; submit; verify list length +1 and form fields empty | `fc.tuple(fc.string({minLength:1, maxLength:100}), fc.float({min:0.01}), fc.constantFrom(...categories))` |
| **Property 4** – Whitespace rejection (name + category) | Generate whitespace-only strings; submit as name and as category label; verify both rejected | `fc.stringMatching(/^\s+$/)` |
| **Property 5** – Non-positive amounts/limits rejected | Generate zero, negative numbers, non-numeric strings; verify rejection for both amount and limit fields | `fc.oneof(fc.constant(0), fc.float({max: -0.01}), fc.string())` |
| **Property 6** – Case-insensitive duplicate category | Add a category; generate case-permuted variants; attempt to add each; verify list length unchanged | `fc.string({minLength:1})` + map to random case permutation |
| **Property 7** – Category totals consistent across UI | Generate transactions + partial limits; verify `aggregateByCategory()` output is identical when called by list-highlighter and chart-builder | `fc.array(transaction)` + `fc.dictionary(fc.float({min:0.01}))` |
| **Property 8** – Delete removes transaction from all derived state | Generate non-empty list; pick random index to delete; verify absent from state, DOM, localStorage | `fc.array(transaction, {minLength:1})` + `fc.integer({min:0})` |
| **Property 9** – Monthly summary exhaustive and accurate | Generate transactions with random dates; verify correct month grouping, descending order, sort within month, and correct sums | `fc.array(transaction)` with `fc.date()` for createdAt |
| **Property 10** – Non-transaction data persists round-trip | Generate category arrays and limits objects; serialize/deserialize; verify casing and values preserved | `fc.array(fc.string({minLength:1}))` + `fc.dictionary(fc.float({min:0.01}))` |

### Integration / smoke tests

- Open `index.html` in each supported browser via `file://`; verify no console errors on load.
- Add a transaction, reload the page, verify the transaction is still present (persistence smoke test).
- Verify Chart.js renders without errors when there is at least one transaction.

### Accessibility
- All form controls have associated `<label>` elements.
- Error messages use `aria-live="polite"` regions so screen readers announce them.
- Color warnings are not the sole indicator (an icon or text label is also shown alongside the red/amber highlight).
