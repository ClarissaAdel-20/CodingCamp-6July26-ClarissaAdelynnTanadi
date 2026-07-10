// Expense & Budget Visualizer — application logic

// === 1. CONSTANTS & CONFIG ===

/** LocalStorage keys */
const STORAGE_KEYS = {
  TRANSACTIONS: 'ebv_transactions',
  CATEGORIES:   'ebv_categories',
  LIMITS:       'ebv_limits',
};

/** Default categories shown on first load */
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun'];

/** 12-color palette for category slices */
const COLOR_PALETTE = [
  '#4E79A7',
  '#F28E2B',
  '#E15759',
  '#76B7B2',
  '#59A14F',
  '#EDC948',
  '#B07AA1',
  '#FF9DA7',
  '#9C755F',
  '#BAB0AC',
  '#86BCB6',
  '#D4A6C8',
];

/** Warning color applied to over-limit categories — must not appear in palette */
const WARNING_COLOR = '#FF4444';


// === 2. STATE ===

/**
 * Central application state — the single source of truth.
 * All mutations are performed on this object and then committed
 * via commit() which persists and re-renders.
 */
const AppState = {
  /** @type {Array<{id:string, name:string, amount:number, category:string, createdAt:string}>} */
  transactions: [],

  /** @type {string[]} */
  categories: ['Food', 'Transport', 'Fun'],

  /** @type {{ [category: string]: number }} */
  limits: {},
};

/**
 * Session-only color map — not persisted to LocalStorage.
 * Built during init() from existing categories, then extended
 * whenever new categories are encountered via commit().
 * @type {Map<string, string>}
 */
const categoryColors = new Map();

/**
 * Ensure every category in AppState.categories has an entry in
 * categoryColors, assigning the next available palette color.
 */
function syncCategoryColors() {
  AppState.categories.forEach((cat) => {
    if (!categoryColors.has(cat)) {
      const index = categoryColors.size % COLOR_PALETTE.length;
      categoryColors.set(cat, COLOR_PALETTE[index]);
    }
  });
}

/**
 * commit() — the only way to persist state changes and refresh the UI.
 *
 * Call pattern:
 *   1. Mutate AppState directly.
 *   2. Call commit().
 *
 * commit() will:
 *   - Extend categoryColors for any new categories.
 *   - Persist the current AppState to LocalStorage via saveToStorage().
 *   - Re-render all UI regions via render().
 *
 * saveToStorage and render are defined in later sections; they are
 * forward-referenced here and will be defined before init() is called.
 */
function commit() {
  // Keep categoryColors in sync with any newly added categories
  syncCategoryColors();

  // Persist state — defined in section 3 (PERSISTENCE)
  saveToStorage(AppState);

  // Re-render all UI regions — defined in section 6 (RENDERERS)
  render(AppState);
}


// === 3. PERSISTENCE ===

/**
 * Show a non-blocking warning banner above the page header.
 * The banner is auto-dismissed after 5 seconds.
 *
 * @param {string} message - Human-readable warning text.
 */
function showWarningBanner(message) {
  const banner = document.createElement('div');
  banner.className = 'warning-banner';
  banner.setAttribute('role', 'alert');
  banner.setAttribute('aria-live', 'polite');
  banner.textContent = message;

  // Insert before the first element in <body> (above the header)
  const body = document.body;
  if (body) {
    body.insertBefore(banner, body.firstChild);
  }

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    if (banner.parentNode) {
      banner.parentNode.removeChild(banner);
    }
  }, 5000);
}

/**
 * Validate that a transaction object has all required fields.
 *
 * @param {unknown} tx - Candidate transaction object.
 * @returns {boolean} True when the object is a valid transaction.
 */
function isValidTransaction(tx) {
  return (
    tx !== null &&
    typeof tx === 'object' &&
    typeof tx.id       === 'string' && tx.id.trim()       !== '' &&
    typeof tx.name     === 'string' && tx.name.trim()     !== '' &&
    typeof tx.amount   === 'number' &&
    typeof tx.category === 'string' && tx.category.trim() !== ''
  );
}

/**
 * loadFromStorage() — reads all three LocalStorage keys and returns an
 * AppState-shaped object with safe fallbacks.
 *
 * Behaviour:
 * - Any key that is absent, unparseable, or the wrong type falls back to
 *   its default value.
 * - Transaction objects missing required fields (`id`, `name`, `amount`,
 *   `category`) are silently filtered out.
 * - If any read fails an error banner is injected above the header and
 *   auto-dismissed after 5 seconds.
 *
 * @returns {{ transactions: Array, categories: string[], limits: Object }}
 */
function loadFromStorage() {
  let transactions = [];
  let categories   = [...DEFAULT_CATEGORIES];
  let limits       = {};
  let hadError     = false;

  // --- transactions ---
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        // Filter out corrupt / incomplete transaction objects
        transactions = parsed.filter(isValidTransaction);
      } else {
        hadError = true;
      }
    }
  } catch (_err) {
    hadError = true;
    transactions = [];
  }

  // --- categories ---
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.every((c) => typeof c === 'string')) {
        categories = parsed;
      } else {
        hadError = true;
      }
    }
  } catch (_err) {
    hadError = true;
    categories = [...DEFAULT_CATEGORIES];
  }

  // --- limits ---
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.LIMITS);
    if (raw !== null) {
      const parsed = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        limits = parsed;
      } else {
        hadError = true;
      }
    }
  } catch (_err) {
    hadError = true;
    limits = {};
  }

  if (hadError) {
    showWarningBanner(
      'Some saved data could not be loaded and has been reset to defaults.'
    );
  }

  return { transactions, categories, limits };
}

/**
 * saveToStorage(state) — serializes and writes all three state slices to
 * LocalStorage.
 *
 * Behaviour:
 * - Each key is written independently; a failure on one key does not
 *   prevent attempts to write the others.
 * - On any write failure the in-memory state is left unchanged and a
 *   non-blocking warning banner is shown to the user.
 *
 * @param {{ transactions: Array, categories: string[], limits: Object }} state
 */
function saveToStorage(state) {
  let hadError = false;

  // --- transactions ---
  try {
    localStorage.setItem(
      STORAGE_KEYS.TRANSACTIONS,
      JSON.stringify(state.transactions)
    );
  } catch (_err) {
    hadError = true;
  }

  // --- categories ---
  try {
    localStorage.setItem(
      STORAGE_KEYS.CATEGORIES,
      JSON.stringify(state.categories)
    );
  } catch (_err) {
    hadError = true;
  }

  // --- limits ---
  try {
    localStorage.setItem(
      STORAGE_KEYS.LIMITS,
      JSON.stringify(state.limits)
    );
  } catch (_err) {
    hadError = true;
  }

  if (hadError) {
    showWarningBanner(
      'Your changes could not be saved to storage. They are available for this session only.'
    );
  }
}


// === 4. DOMAIN LOGIC ===

/**
 * validateTransaction(name, amount, category)
 * Validates the three required fields for a new transaction.
 *
 * Checks are performed in order: name → amount → category.
 *
 * @param {string} name           - Item name from the form input.
 * @param {string|number} amount  - Amount from the form input.
 * @param {string} category       - Selected category from the dropdown.
 * @returns {{ field: string, message: string } | null}
 *   Returns an error object for the first invalid field, or null when all
 *   fields are valid.
 *
 * Validates Requirements 1.3, 1.4, 1.5:
 *   - 1.3: Empty or whitespace-only name → field 'name', "Item name is required"
 *   - 1.4: Zero, negative, or non-numeric amount → field 'amount', "Amount must be greater than zero"
 *   - 1.5: Missing/falsy category → field 'category', "Please select a category"
 */
function validateTransaction(name, amount, category) {
  // 1. Name must be a non-empty, non-whitespace string
  if (!name || String(name).trim() === '') {
    return { field: 'name', message: 'Item name is required' };
  }

  // 2. Amount must be numeric and greater than zero
  const numericAmount = Number(amount);
  if (amount === '' || amount === null || amount === undefined || isNaN(numericAmount) || numericAmount <= 0) {
    return { field: 'amount', message: 'Amount must be greater than zero' };
  }

  // 3. Category must be selected (non-empty, truthy)
  if (!category || String(category).trim() === '') {
    return { field: 'category', message: 'Please select a category' };
  }

  return null;
}

/**
 * validateCategory(label, existingCategories)
 * Validates a new category label against the existing category list.
 *
 * @param {string} label                  - The candidate category name entered by the user.
 * @param {string[]} existingCategories   - The current list of category names.
 * @returns {string|null} An error message string, or null if the label is valid.
 *
 * Validates Requirements 6.2, 6.3, 6.4:
 *   - 6.3: Empty or whitespace-only labels are rejected.
 *   - 6.4: Duplicate labels (case-insensitive, after trim) are rejected.
 *   - 6.2: All other labels are accepted.
 */
function validateCategory(label, existingCategories) {
  if (label.trim() === '') {
    return 'Category name cannot be empty';
  }

  const normalised = label.trim().toLowerCase();
  const isDuplicate = existingCategories.some(
    (existing) => existing.trim().toLowerCase() === normalised
  );

  if (isDuplicate) {
    return 'Category already exists';
  }

  return null;
}

/**
 * validateLimit(value)
 * Validates a spending limit input value.
 *
 * @param {*} value - The raw input value to validate.
 * @returns {string|null} An error message string if invalid, or null if valid.
 *
 * Validates Requirements 7.1, 7.2:
 * - Returns 'Limit must be a number greater than zero' for zero, negative,
 *   NaN, or non-numeric string inputs.
 * - Returns null for any positive numeric value.
 */
function validateLimit(value) {
  const n = parseFloat(value);
  if (isNaN(n) || n <= 0) return 'Limit must be a number greater than zero';
  return null;
}

/**
 * generateId()
 * Generates a unique identifier for a new Transaction.
 *
 * @returns {string} A UUID v4 string.
 *
 * Satisfies Requirement 1.2:
 * - Each Transaction receives a unique id upon creation.
 */
function generateId() {
  return crypto.randomUUID();
}

// --- Task 3.5 ---

/**
 * aggregateByCategory(transactions)
 * Sums all transaction amounts grouped by category.
 *
 * This is the SINGLE shared function used by the list highlighter,
 * chart builder, and summary renderer to guarantee consistent totals
 * across all UI regions (Property 7).
 *
 * @param {Array<{category: string, amount: number}>} transactions
 * @returns {{ [category: string]: number }}
 *
 * Validates: Requirements 7.3, 7.4, 7.5
 */
function aggregateByCategory(transactions) {
  const totals = {};
  for (const tx of transactions) {
    if (Object.prototype.hasOwnProperty.call(totals, tx.category)) {
      totals[tx.category] += tx.amount;
    } else {
      totals[tx.category] = tx.amount;
    }
  }
  return totals;
}

// --- Task 3.6 ---

/**
 * calculateBalance(transactions)
 * Returns the arithmetic sum of all transaction `amount` fields.
 * Returns 0 for an empty array.
 *
 * @param {Array<{amount: number}>} transactions
 * @returns {number}
 *
 * Validates: Requirements 3.2, 3.3
 */
function calculateBalance(transactions) {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * formatAmount(value)
 * Formats a numeric value as a USD currency string.
 *
 * @param {number} value
 * @returns {string} e.g. "$12.50"
 *
 * Validates: Requirements 3.4
 */
function formatAmount(value) {
  return '$' + value.toFixed(2);
}

// --- Task 3.7 ---

/**
 * groupByMonth(transactions)
 * Groups transactions by the YYYY-MM prefix of their `createdAt` field.
 *
 * Behaviour:
 * - Months are sorted descending (most recent first).
 * - Within each month, categories are sorted descending by total amount;
 *   ties are broken alphabetically ascending.
 * - Transactions whose `category` is NOT present in `AppState.categories`
 *   are grouped under the label "Uncategorized".
 *
 * @param {Array<{amount: number, category: string, createdAt: string}>} transactions
 * @returns {Array<{ month: string, categories: Array<{name: string, total: number}>, total: number }>}
 *
 * Validates: Requirements 8.1, 8.2, 8.5
 */
function groupByMonth(transactions) {
  /** @type {{ [month: string]: { [category: string]: number } }} */
  const monthMap = {};

  for (const tx of transactions) {
    const month = tx.createdAt.slice(0, 7); // 'YYYY-MM'

    // Resolve category: use "Uncategorized" for unknown categories
    const categoryLabel = AppState.categories.includes(tx.category)
      ? tx.category
      : 'Uncategorized';

    if (!Object.prototype.hasOwnProperty.call(monthMap, month)) {
      monthMap[month] = {};
    }

    if (Object.prototype.hasOwnProperty.call(monthMap[month], categoryLabel)) {
      monthMap[month][categoryLabel] += tx.amount;
    } else {
      monthMap[month][categoryLabel] = tx.amount;
    }
  }

  // Build result array sorted months descending
  return Object.keys(monthMap)
    .sort((a, b) => (a < b ? 1 : -1))
    .map((month) => {
      const catTotals = monthMap[month];

      // Sort categories: descending by amount, then ascending alphabetically on ties
      const categories = Object.keys(catTotals)
        .map((name) => ({ name, total: catTotals[name] }))
        .sort((a, b) => {
          if (b.total !== a.total) return b.total - a.total;
          return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
        });

      const total = categories.reduce((sum, c) => sum + c.total, 0);

      return { month, categories, total };
    });
}


// === 5. CHART ===

/** Holds the Chart.js instance between renders; null before first creation. */
let chartInstance = null;

/**
 * updateChart(state)
 * Builds and updates the spending pie chart from current state.
 *
 * Behaviour:
 * - If Chart.js CDN failed to load: shows a static error message in
 *   #chart-section and returns early.
 * - If no transactions: hides <canvas id="spending-chart"> and shows
 *   #chart-empty placeholder. Returns early.
 * - If transactions exist: shows canvas, hides #chart-empty.
 *   - Colors come from state.categoryColors; any category whose total
 *     meets or exceeds its spending limit is overridden with WARNING_COLOR.
 *   - On first call (chartInstance is null): creates a new Chart instance.
 *   - On subsequent calls: mutates existing instance data and calls update().
 *
 * @param {{ transactions: Array, limits: Object, categoryColors: Map }} state
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6
 */
function updateChart(state) {
  const section = document.getElementById('chart-section');
  const canvas  = document.getElementById('spending-chart');
  const empty   = document.getElementById('chart-empty');

  // --- CDN failure guard (Requirement 4.1 / Error Handling) ---
  if (typeof Chart === 'undefined') {
    if (section) {
      section.textContent =
        'Chart unavailable — please check your internet connection.';
    }
    return;
  }

  // --- No transactions: hide canvas, show placeholder (Requirement 4.4) ---
  if (!state.transactions || state.transactions.length === 0) {
    if (canvas) canvas.style.display = 'none';
    if (empty)  empty.style.display  = '';
    // Destroy existing instance so it is re-created fresh next time
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    return;
  }

  // --- Transactions exist: show canvas, hide placeholder ---
  if (canvas) canvas.style.display = '';
  if (empty)  empty.style.display  = 'none';

  // Build labels, data, and colors from aggregated totals
  const totals = aggregateByCategory(state.transactions);
  const labels = Object.keys(totals);
  const data   = labels.map((cat) => totals[cat]);
  const totalSpending = data.reduce((sum, val) => sum + val, 0);
  const chartLabels = labels.map((cat) => {
    const pct = totalSpending > 0 ? Math.round((totals[cat] / totalSpending) * 100) : 0;
    return `${cat} (${pct}%)`;
  });
  const backgroundColors = labels.map((cat) => {
    const limit = state.limits && state.limits[cat];
    if (limit !== undefined && totals[cat] >= limit) {
      return WARNING_COLOR; // over-limit override (Requirement 7.3 / 4.5)
    }
    // Fall back to palette color via categoryColors map (Requirement 4.5)
    return state.categoryColors.get(cat) || COLOR_PALETTE[0];
  });

  // --- First render: create Chart instance (Requirement 4.1) ---
  if (chartInstance === null) {
    chartInstance = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: chartLabels,
        datasets: [
          {
            data,
            backgroundColor: backgroundColors,
          },
        ],
      },
      options: {
        plugins: {
          legend: {
            display: true, // Requirement 4.6
          },
        },
      },
    });
  } else {
    // --- Subsequent renders: mutate and update (Requirements 4.2, 4.3) ---
    chartInstance.data.labels                        = chartLabels;
    chartInstance.data.datasets[0].data              = data;
    chartInstance.data.datasets[0].backgroundColor   = backgroundColors;
    chartInstance.update();
  }
}


// === 6. RENDERERS ===

/**
 * renderBalance(state)
 * Reads state.transactions, calculates the total balance, formats it,
 * and writes the result to the #balance-display element's textContent.
 *
 * @param {{ transactions: Array<{amount: number}> }} state
 *
 * Validates: Requirements 3.1, 3.2, 3.4
 */
function renderBalance(state) {
  const el = document.getElementById('balance-display');
  if (!el) return;
  el.textContent = formatAmount(calculateBalance(state.transactions));
}

/**
 * renderList(state)
 * Clears and re-populates the #transaction-list element.
 *
 * Each <li> row shows:
 *   - item name
 *   - formatted amount (via formatAmount)
 *   - category
 *   - date formatted as "Mon D, YYYY" (e.g. "Jul 6, 2025")
 *   - a delete button with data-id set to the transaction's id
 *
 * The .over-limit CSS class is applied to a row when its category's
 * aggregated total (from aggregateByCategory) is >= the limit set in
 * state.limits[category].
 *
 * Transactions are sorted descending by createdAt before rendering.
 * When state.transactions is empty, shows a single empty-state <li>.
 *
 * @param {{ transactions: Array<{id:string, name:string, amount:number, category:string, createdAt:string}>, limits: {[category:string]: number} }} state
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.6, 7.3, 7.6
 */
function renderList(state) {
  const list = document.getElementById('transaction-list');
  if (!list) return;

  // Clear existing content
  list.innerHTML = '';

  // Empty state
  if (state.transactions.length === 0) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'empty-state';
    emptyItem.textContent = 'No transactions yet.';
    list.appendChild(emptyItem);
    return;
  }

  // Pre-compute category totals once for all rows (Property 7: consistent totals)
  const categoryTotals = aggregateByCategory(state.transactions);

  // Sort transactions descending by createdAt (most recent first — Req 2.2)
  const sorted = state.transactions
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // Render one <li> per transaction
  for (const tx of sorted) {
    const li = document.createElement('li');

    // Apply .over-limit when category total >= its limit and a limit is set (Req 7.3, 7.6)
    const limit = state.limits[tx.category];
    const total = categoryTotals[tx.category] ?? 0;
    if (limit !== undefined && total >= limit) {
      li.classList.add('over-limit');
    }

    // Format date as "Mon D, YYYY" (e.g. "Jul 6, 2025")
    const dateStr = new Date(tx.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

    // Item name span
    const nameSpan = document.createElement('span');
    nameSpan.className = 'tx-name';
    nameSpan.textContent = tx.name;

    // Amount span
    const amountSpan = document.createElement('span');
    amountSpan.className = 'tx-amount';
    amountSpan.textContent = formatAmount(tx.amount);

    // Category span
    const categorySpan = document.createElement('span');
    categorySpan.className = 'tx-category';
    categorySpan.textContent = tx.category;

    // Date span
    const dateSpan = document.createElement('span');
    dateSpan.className = 'tx-date';
    dateSpan.textContent = dateStr;

    // Delete button with data-id attribute (Req 2.5)
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'delete-btn';
    deleteBtn.setAttribute('data-id', tx.id);
    deleteBtn.setAttribute('aria-label', `Delete transaction: ${tx.name}`);
    deleteBtn.textContent = 'Delete';

    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(categorySpan);
    li.appendChild(dateSpan);
    li.appendChild(deleteBtn);

    list.appendChild(li);
  }
}

/**
 * renderCategoryManager(state)
 * Updates the category-related UI elements to reflect the current category list:
 * - Rebuilds the #category-select dropdown in the transaction form.
 * - Rebuilds the #category-list <ul> with one <li> per category.
 * The #category-form is static in index.html and is NOT touched here.
 *
 * @param {{ categories: string[] }} state
 *
 * Validates: Requirements 6.1
 */
function renderCategoryManager(state) {
  // --- Update #category-select dropdown ---
  const select = document.getElementById('category-select');
  if (select) {
    // Clear all existing options
    select.innerHTML = '';

    // Add the default placeholder option
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '-- Select a category --';
    select.appendChild(placeholder);

    // Add one option per category
    state.categories.forEach((cat) => {
      const opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      select.appendChild(opt);
    });
  }

  // --- Update #category-list <ul> ---
  const list = document.getElementById('category-list');
  if (list) {
    list.innerHTML = '';

    state.categories.forEach((cat) => {
      const li = document.createElement('li');
      li.textContent = cat;
      list.appendChild(li);
    });
  }
}

/**
 * renderLimitsUI(state)
 * Renders one input row per category inside the `#limits-list` container,
 * allowing the user to set or clear a per-category spending limit.
 *
 * Each row contains:
 *   - A <label> with the category name
 *   - A number <input> with data-category, min="0.01", step="0.01",
 *     pre-filled with state.limits[category] when a limit exists
 *   - A <span class="error-msg"> for inline validation feedback (empty initially)
 *
 * @param {{ categories: string[], limits: { [category: string]: number } }} state
 *
 * Validates: Requirements 7.1, 7.5, 7.7
 */
function renderLimitsUI(state) {
  const container = document.getElementById('limits-list');
  if (!container) return;

  // Clear previous content
  container.innerHTML = '';

  state.categories.forEach((category) => {
    const row = document.createElement('div');
    row.className = 'limit-row';

    // Label
    const label = document.createElement('label');
    label.textContent = category;

    // Number input
    const input = document.createElement('input');
    input.type = 'number';
    input.setAttribute('data-category', category);
    input.min = '0.01';
    input.step = '0.01';

    // Pre-fill if a limit is already set for this category
    if (Object.prototype.hasOwnProperty.call(state.limits, category)) {
      input.value = state.limits[category];
    }

    // Inline error message span (empty initially)
    const errorSpan = document.createElement('span');
    errorSpan.className = 'error-msg';

    row.appendChild(label);
    row.appendChild(input);
    row.appendChild(errorSpan);
    container.appendChild(row);
  });
}

/**
 * renderSummary(state)
 * Clears and re-populates the #summary-content container with a
 * month-by-month breakdown of all transactions.
 *
 * Layout per month (descending order, most recent first):
 *   <h3>  — month label in YYYY-MM format
 *   <ul>  — one <li> per category: "CategoryName: $X.XX"
 *   <p class="month-total">  — "Total: $X.XX"
 *
 * When no transactions exist, renders a single paragraph:
 *   "No transactions to summarize."
 *
 * @param {{ transactions: Array<{amount: number, category: string, createdAt: string}> }} state
 *
 * Validates: Requirements 8.1, 8.2, 8.4, 8.5
 */
function renderSummary(state) {
  const container = document.getElementById('summary-content');
  if (!container) return;

  // Clear previous content
  container.innerHTML = '';

  // Group transactions by month (returns months in descending order)
  const months = groupByMonth(state.transactions);

  // Empty state — no transactions to display (Requirement 8.4)
  if (months.length === 0) {
    const msg = document.createElement('p');
    msg.textContent = 'No transactions to summarize.';
    container.appendChild(msg);
    return;
  }

  // Render one block per month (already descending from groupByMonth — Req 8.1, 8.2)
  for (const monthData of months) {
    // Guard: skip months with no categories (shouldn't occur, but be safe — Req 8.4)
    if (!monthData.categories || monthData.categories.length === 0) continue;

    // Month heading: YYYY-MM label (Requirement 8.1)
    const heading = document.createElement('h3');
    heading.textContent = monthData.month;
    container.appendChild(heading);

    // Category breakdown list (Requirement 8.2)
    const ul = document.createElement('ul');
    for (const cat of monthData.categories) {
      const li = document.createElement('li');
      li.textContent = cat.name + ': ' + formatAmount(cat.total);
      ul.appendChild(li);
    }
    container.appendChild(ul);

    // Monthly total (Requirement 8.2)
    const totalPara = document.createElement('p');
    totalPara.className = 'month-total';
    totalPara.textContent = 'Total: ' + formatAmount(monthData.total);
    container.appendChild(totalPara);
  }
}

/**
 * render(state)
 * Main render orchestrator — called by commit() after every state mutation.
 *
 * Coordinates all UI regions so they are always in sync with the current
 * AppState. Attaches the session-only `categoryColors` map onto state
 * before delegating to updateChart, which reads it from state.
 *
 * @param {{ transactions: Array, categories: string[], limits: Object }} state
 *
 * Validates: Requirements 1.2, 2.4, 2.5, 3.3, 7.4
 */
function render(state) {
  // Attach session-only color map so updateChart can read state.categoryColors
  state.categoryColors = categoryColors;

  renderBalance(state);
  renderList(state);
  updateChart(state);
  renderLimitsUI(state);
  renderCategoryManager(state);
  renderSummary(state);
}


// === 7. EVENT HANDLERS ===

/**
 * handleTransactionSubmit(event)
 * Handles the transaction form's submit event.
 *
 * Behaviour:
 * 1. Prevents the default browser form submission.
 * 2. Reads values from #item-name, #amount, and #category-select inputs.
 * 3. Clears any previously displayed inline error messages.
 * 4. Validates the inputs via validateTransaction(); on failure, displays
 *    the error message in the corresponding <span class="error-msg"> and returns.
 * 5. On success: creates a new transaction object, pushes it to
 *    AppState.transactions, sorts transactions descending by createdAt,
 *    calls commit(), and resets the form.
 *
 * Error field → error element mapping:
 *   'name'     → #item-name-error
 *   'amount'   → #amount-error
 *   'category' → #category-select-error
 *
 * @param {Event} event - The form submit event.
 *
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
function handleTransactionSubmit(event) {
  // 1. Prevent default browser form submission (Requirement 1.2)
  event.preventDefault();

  // 2. Read raw values from form inputs
  const nameInput     = document.getElementById('item-name');
  const amountInput   = document.getElementById('amount');
  const categoryInput = document.getElementById('category-select');

  const name     = nameInput     ? nameInput.value     : '';
  const amount   = amountInput   ? amountInput.value   : '';
  const category = categoryInput ? categoryInput.value : '';

  // 3. Clear all existing inline error messages
  const nameError     = document.getElementById('item-name-error');
  const amountError   = document.getElementById('amount-error');
  const categoryError = document.getElementById('category-select-error');

  if (nameError)     nameError.textContent     = '';
  if (amountError)   amountError.textContent   = '';
  if (categoryError) categoryError.textContent = '';

  // 4. Validate inputs (Requirements 1.3, 1.4, 1.5)
  const validationError = validateTransaction(name, amount, category);

  if (validationError !== null) {
    // Display the error in the corresponding span and stop
    const fieldToErrorId = {
      name:     'item-name-error',
      amount:   'amount-error',
      category: 'category-select-error',
    };

    const errorEl = document.getElementById(fieldToErrorId[validationError.field]);
    if (errorEl) {
      errorEl.textContent = validationError.message;
    }
    return;
  }

  // 5. Validation passed — create and store the new transaction (Requirement 1.2)
  const newTransaction = {
    id:        generateId(),
    name:      name.trim(),
    amount:    parseFloat(amount),
    category:  category,
    createdAt: new Date().toISOString(),
  };

  AppState.transactions.push(newTransaction);

  // Sort descending by createdAt (most recent first — Requirement 2.2)
  AppState.transactions.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // Persist state and re-render all UI regions
  commit();

  // Reset the form to its default empty state (Requirement 1.6)
  event.target.reset();
}


/**
 * handleListClick(event)
 * Event delegation handler for the #transaction-list element.
 *
 * Behaviour:
 * - Ignores clicks that did not originate on (or bubble up through) a
 *   .delete-btn element.
 * - Reads the transaction id from the button's data-id attribute.
 * - Filters the transaction out of AppState.transactions.
 * - Calls commit() to persist the change and re-render all UI regions.
 *
 * @param {MouseEvent} event
 *
 * Validates: Requirements 2.5, 3.3, 4.3, 5.1, 8.3
 */
function handleListClick(event) {
  // Walk up the DOM to find a .delete-btn ancestor (or the target itself)
  const btn = event.target.closest('.delete-btn');
  if (!btn) return;

  const id = btn.getAttribute('data-id');
  if (!id) return;

  // Remove the transaction with the matching id
  AppState.transactions = AppState.transactions.filter((tx) => tx.id !== id);

  // Persist and re-render
  commit();
}


/**
 * handleCategorySubmit(event)
 * Handles submission of the #category-form to add a new custom category.
 *
 * Steps:
 *   1. Prevents default form submission.
 *   2. Reads and clears the inline error span (#new-category-error).
 *   3. Validates the label via validateCategory().
 *   4. On error: displays the error message and returns early.
 *   5. On success:
 *      - Pushes the trimmed label to AppState.categories.
 *      - Assigns the next palette color in categoryColors.
 *      - Calls commit() to persist and re-render.
 *      - Clears the #new-category input field.
 *
 * @param {Event} event - The form submit event.
 *
 * Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */
function handleCategorySubmit(event) {
  // Req 6.1: Prevent the browser from reloading the page on form submit
  event.preventDefault();

  const input = document.getElementById('new-category');
  const errorSpan = document.getElementById('new-category-error');

  // Read the raw value from the input
  const label = input ? input.value : '';

  // Clear any previous inline error (Req 6.3, 6.4)
  if (errorSpan) {
    errorSpan.textContent = '';
  }

  // Validate the candidate label against the current category list (Req 6.3, 6.4)
  const errorMessage = validateCategory(label, AppState.categories);

  if (errorMessage) {
    // Display validation error and abort (Req 6.3, 6.4)
    if (errorSpan) {
      errorSpan.textContent = errorMessage;
    }
    return;
  }

  // Success path ———————————————————————————————————————————

  // Req 6.2: Add the trimmed label to the in-memory category list
  AppState.categories.push(label.trim());

  // Assign the next available palette color for the new category (Req 4.5)
  categoryColors.set(label.trim(), COLOR_PALETTE[categoryColors.size % COLOR_PALETTE.length]);

  // Persist state and refresh all UI regions (Req 6.2, 6.5, 6.6)
  commit();

  // Clear the input field ready for the next entry (Req 6.1)
  if (input) {
    input.value = '';
  }
}

/**
 * handleSummaryToggle()
 * Toggles the visibility of the #summary-section and updates the
 * aria-expanded attribute on the #summary-toggle button.
 *
 * Behaviour:
 * - Reads the current state of the `hidden` attribute on #summary-section.
 * - If currently hidden: removes the attribute (makes section visible) and
 *   calls renderSummary(AppState) to ensure content is up to date.
 * - If currently visible: adds the `hidden` attribute (hides the section).
 * - Sets aria-expanded on #summary-toggle to "true" when visible, "false" when hidden.
 *
 * Validates: Requirements 8.1, 8.3
 */
function handleSummaryToggle() {
  const section = document.getElementById('summary-section');
  const btn     = document.getElementById('summary-toggle');

  if (!section) return;

  const isHidden = section.hasAttribute('hidden');

  if (isHidden) {
    // Show the section and refresh content
    section.removeAttribute('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    renderSummary(AppState);
  } else {
    // Hide the section
    section.setAttribute('hidden', '');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
}

/**
 * handleLimitChange(event)
 * Handles `change` and `input` events on limit inputs inside `#limits-list`.
 *
 * Behaviour:
 * 1. Reads the `data-category` attribute from the event target to identify
 *    which category's limit is being updated.
 * 2. Reads the current value from the input element.
 * 3. Finds the adjacent `.error-msg` span (next sibling of the input) and
 *    clears any previously displayed error.
 * 4. If the value is empty or whitespace-only: deletes the limit for that
 *    category from AppState.limits and calls commit() to persist and
 *    re-render (clearing warning highlights — Req 7.7).
 * 5. If the value is non-empty: validates it via validateLimit().
 *    - On validation error: displays the error message in the `.error-msg`
 *      span and returns without calling commit() (Req 7.2).
 *    - On validation success: sets AppState.limits[category] to the parsed
 *      float value and calls commit() to persist and re-render (Req 7.5).
 *
 * @param {Event} event - A `change` or `input` event from a limit input.
 *
 * Validates: Requirements 7.1, 7.2, 7.5, 7.7
 */
function handleLimitChange(event) {
  const input    = event.target;
  const category = input.getAttribute('data-category');

  // Guard: if no data-category attribute, nothing to do
  if (!category) return;

  const value = input.value;

  // Find the adjacent .error-msg span and clear it (next sibling after input)
  const errorSpan = input.nextElementSibling;
  if (errorSpan && errorSpan.classList.contains('error-msg')) {
    errorSpan.textContent = '';
  }

  // Empty / whitespace-only value → clear the limit (Requirement 7.7)
  if (value.trim() === '') {
    delete AppState.limits[category];
    commit();
    return;
  }

  // Non-empty value → validate first (Requirement 7.2)
  const errorMessage = validateLimit(value);

  if (errorMessage !== null) {
    // Show validation error and do NOT persist (Requirement 7.2)
    if (errorSpan && errorSpan.classList.contains('error-msg')) {
      errorSpan.textContent = errorMessage;
    }
    return;
  }

  // Validation passed → save limit and commit (Requirements 7.1, 7.5)
  AppState.limits[category] = parseFloat(value);
  commit();
}


/**
 * Helper to clear inline validation errors when the user interacts with an input.
 *
 * @param {string} inputId - ID of the input element.
 * @param {string} errorId - ID of the inline error span element.
 */
function clearErrorOnInput(inputId, errorId) {
  const input = document.getElementById(inputId);
  if (input) {
    const clearHandler = () => {
      const errorEl = document.getElementById(errorId);
      if (errorEl) {
        errorEl.textContent = '';
      }
    };
    input.addEventListener('input', clearHandler);
    input.addEventListener('change', clearHandler);
  }
}

// === 8. INITIALIZATION ===

/**
 * init() — bootstraps the application on page load.
 *
 * Behaviour:
 * 1. Loads persisted state from storage via loadFromStorage().
 * 2. Synchronises the categoryColors map with active categories.
 * 3. Binds all interactive event handlers.
 * 4. Triggers the initial paint of the entire UI.
 */
function init() {
  // 1. Load persisted data
  const loaded = loadFromStorage();
  AppState.transactions = loaded.transactions;
  AppState.categories   = loaded.categories;
  AppState.limits       = loaded.limits;

  // 2. Synchronise category colors map
  syncCategoryColors();

  // 3. Bind event listeners
  
  // Clear validation errors on typing / interaction
  clearErrorOnInput('item-name', 'item-name-error');
  clearErrorOnInput('amount', 'amount-error');
  clearErrorOnInput('category-select', 'category-select-error');
  clearErrorOnInput('new-category', 'new-category-error');
  
  // Transaction submission form
  const txForm = document.getElementById('transaction-form');
  if (txForm) {
    txForm.addEventListener('submit', handleTransactionSubmit);
  }

  // Transaction deletion (delegated click on list)
  const txList = document.getElementById('transaction-list');
  if (txList) {
    txList.addEventListener('click', handleListClick);
  }

  // Category addition form
  const catForm = document.getElementById('category-form');
  if (catForm) {
    catForm.addEventListener('submit', handleCategorySubmit);
  }

  // Spending limit inputs (delegated change and input on the limits container)
  const limitsList = document.getElementById('limits-list');
  if (limitsList) {
    limitsList.addEventListener('input', handleLimitChange);
    limitsList.addEventListener('change', handleLimitChange);
  }

  // Monthly summary section toggle
  const summaryToggle = document.getElementById('summary-toggle');
  if (summaryToggle) {
    summaryToggle.addEventListener('click', handleSummaryToggle);
  }

  // 4. Initial paint
  render(AppState);
}

// Register initialization on page load
document.addEventListener('DOMContentLoaded', init);

