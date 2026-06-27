/* ═══════════════════════════════════
   CONSTANTS & LOCAL STORAGE KEYS
   ═══════════════════════════════════ */

/**
 * Local Storage key names, namespaced with "ebv_" to avoid
 * collisions with other apps sharing the same origin.
 */
const LS_KEYS = {
  TRANSACTIONS:   'ebv_transactions',
  SPENDING_LIMIT: 'ebv_spending_limit',
  THEME:          'ebv_theme',
};

/** All valid expense categories. */
const CATEGORIES = ['Food', 'Transport', 'Fun'];

/**
 * Fixed color per category so chart segments are always
 * rendered with the same color regardless of data order.
 */
const CATEGORY_COLORS = {
  Food:      '#4caf50',
  Transport: '#2196f3',
  Fun:       '#ff9800',
};


/* ═══════════════════════════════════
   STATE
   ═══════════════════════════════════ */

/**
 * Single in-memory source of truth for the application.
 * Every UI update is derived purely from this object.
 *
 * @property {Array}        transactions     - Array of Transaction objects
 * @property {number|null}  spendingLimit    - User-defined budget cap, or null if unset
 * @property {string}       theme            - Active theme: "light" | "dark"
 * @property {boolean}      storageAvailable - Set to false when Local Storage is inaccessible
 */
const AppState = {
  transactions:     [],
  spendingLimit:    null,
  theme:            'light',
  storageAvailable: true,
};


/* ═══════════════════════════════════
   LOCAL STORAGE HELPERS
   ═══════════════════════════════════ */

/**
 * Reads all persisted keys from Local Storage and returns a
 * parsed state snapshot.
 *
 * On any read/parse failure the function sets
 * `AppState.storageAvailable = false` and returns safe empty
 * defaults so the app can still run in-session.
 *
 * Serialization contract:
 *  - ebv_transactions  → JSON array; each amount coerced to Number
 *  - ebv_spending_limit → plain numeric string parsed with parseFloat
 *  - ebv_theme          → plain string ("light" | "dark")
 *
 * @returns {{ transactions: Array, spendingLimit: number|null, theme: string }}
 */
function loadFromStorage() {
  try {
    // --- transactions ---
    const rawTx = localStorage.getItem(LS_KEYS.TRANSACTIONS);
    const transactions = rawTx
      ? JSON.parse(rawTx).map((tx) => ({ ...tx, amount: Number(tx.amount) }))
      : [];

    // --- spending limit ---
    const rawLimit = localStorage.getItem(LS_KEYS.SPENDING_LIMIT);
    const spendingLimit = rawLimit !== null ? parseFloat(rawLimit) : null;

    // --- theme ---
    const theme = localStorage.getItem(LS_KEYS.THEME) || 'light';

    return { transactions, spendingLimit, theme };
  } catch (e) {
    AppState.storageAvailable = false;
    return { transactions: [], spendingLimit: null, theme: 'light' };
  }
}

/**
 * Serializes the current AppState and writes all keys to
 * Local Storage.
 *
 * Spending limit handling:
 *  - When null  → removes the key entirely (clean slate)
 *  - Otherwise  → writes as a plain numeric string
 *
 * On any write failure the user is notified via
 * `showErrorNotification`; in-memory state is still current.
 */
function syncToStorage() {
  try {
    localStorage.setItem(LS_KEYS.TRANSACTIONS, JSON.stringify(AppState.transactions));

    if (AppState.spendingLimit !== null) {
      localStorage.setItem(LS_KEYS.SPENDING_LIMIT, String(AppState.spendingLimit));
    } else {
      localStorage.removeItem(LS_KEYS.SPENDING_LIMIT);
    }

    localStorage.setItem(LS_KEYS.THEME, AppState.theme);
  } catch (e) {
    showErrorNotification('Unable to save data. Storage may be full or unavailable.');
  }
}

/**
 * Displays the error notification banner with the given message.
 *
 * Sets the text content of `#error-message` to `message` and makes
 * `#error-notification` visible by removing its `hidden` attribute.
 *
 * @param {string} message - Human-readable error message to display.
 *
 * Requirements: 9.5
 */
function showErrorNotification(message) {
  const notification = document.getElementById('error-notification');
  const errorMessage = document.getElementById('error-message');

  if (errorMessage) {
    errorMessage.textContent = message;
  }

  if (notification) {
    notification.removeAttribute('hidden');
  }
}

/**
 * Hides the error notification banner by adding the `hidden` attribute
 * to `#error-notification`.
 *
 * Requirements: 9.5
 */
function dismissErrorNotification() {
  const notification = document.getElementById('error-notification');

  if (notification) {
    notification.setAttribute('hidden', '');
  }
}


/* ═══════════════════════════════════
   VALIDATION
   ═══════════════════════════════════ */

/**
 * Validates the fields for a new transaction.
 *
 * Rules:
 *  - name    : non-empty string; at most 100 characters
 *  - amount  : parseFloat must be finite; in [0.01, 999999999.99];
 *              at most 2 decimal places (tested via regex on the
 *              string representation after trimming whitespace)
 *  - category: must be strictly one of the values in CATEGORIES
 *
 * @param {string} name     - Item name entered by the user.
 * @param {string|number} amount - Amount entered by the user.
 * @param {string} category - Category selected by the user.
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTransaction(name, amount, category) {
  const errors = [];

  // --- Name validation ---
  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push('Item name is required.');
  } else if (name.trim().length > 100) {
    errors.push('Item name must not exceed 100 characters.');
  }

  // --- Amount validation ---
  const amountStr = String(amount).trim();
  const parsedAmount = parseFloat(amountStr);

  if (!isFinite(parsedAmount)) {
    errors.push('Amount must be a valid number.');
  } else if (parsedAmount < 0.01 || parsedAmount > 999999999.99) {
    errors.push('Amount must be between 0.01 and 999,999,999.99.');
  } else if (!/^\d+(\.\d{1,2})?$/.test(amountStr)) {
    errors.push('Amount must have at most 2 decimal places.');
  }

  // --- Category validation ---
  if (!CATEGORIES.includes(category)) {
    errors.push('Please select a valid category (Food, Transport, or Fun).');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates a spending limit input value.
 *
 * Rules:
 *  - parseFloat(value) must be finite
 *  - Must be strictly positive (> 0) and in [0.01, 999999999.99]
 *
 * @param {string|number} value - Spending limit entered by the user.
 * @returns {{ valid: boolean, error: string }}
 */
function validateSpendingLimit(value) {
  const parsed = parseFloat(String(value).trim());

  if (!isFinite(parsed)) {
    return { valid: false, error: 'Spending limit must be a valid number.' };
  }

  if (parsed <= 0) {
    return { valid: false, error: 'Spending limit must be a positive number.' };
  }

  if (parsed < 0.01 || parsed > 999999999.99) {
    return { valid: false, error: 'Spending limit must be between 0.01 and 999,999,999.99.' };
  }

  return { valid: true, error: '' };
}


/* ═══════════════════════════════════
   FORMATTERS
   ═══════════════════════════════════ */

/**
 * Formats a numeric amount as a US-dollar currency string.
 *
 * Examples:
 *   formatCurrency(0)            → "$0.00"
 *   formatCurrency(1234.5)       → "$1,234.50"
 *   formatCurrency(999999999.99) → "$999,999,999.99"
 *
 * @param {number} amount - The numeric value to format.
 * @returns {string} The formatted currency string, e.g. "$1,234.56".
 */
function formatCurrency(amount) {
  return '$' + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Computes the total balance as the arithmetic sum of all
 * transaction amounts.
 *
 * Returns 0 for an empty array.
 *
 * @param {Array<{amount: number}>} transactions - Array of transaction objects.
 * @returns {number} The sum of all `amount` fields.
 */
function computeBalance(transactions) {
  return transactions.reduce((sum, tx) => sum + tx.amount, 0);
}

/**
 * Computes per-category spending totals from a list of transactions.
 *
 * Only categories with a non-zero total are included in the result
 * object. Categories with no transactions (or transactions summing
 * to zero) are omitted.
 *
 * @param {Array<{amount: number, category: string}>} transactions
 * @returns {{ [category: string]: number }} An object mapping each
 *   category name to its total spending amount.
 */
function computeCategoryTotals(transactions) {
  const totals = {};

  for (const tx of transactions) {
    if (totals[tx.category] === undefined) {
      totals[tx.category] = 0;
    }
    totals[tx.category] += tx.amount;
  }

  // Omit categories whose total rounds to zero
  const result = {};
  for (const [category, total] of Object.entries(totals)) {
    if (total !== 0) {
      result[category] = total;
    }
  }

  return result;
}

/**
 * Computes per-category totals and a grand total for all
 * transactions that fall within the given calendar month and year.
 *
 * Filtering is done by comparing `new Date(timestamp).getMonth() + 1`
 * against `month` and `new Date(timestamp).getFullYear()` against
 * `year`. Only categories with non-zero spending are included.
 *
 * @param {Array<{amount: number, category: string, timestamp: number}>} transactions
 *   - Full list of transactions; each `timestamp` is a `Date.now()` value (ms).
 * @param {number} month - 1-indexed month (1 = January … 12 = December).
 * @param {number} year  - 4-digit calendar year (e.g. 2025).
 * @returns {{ categories: { [category: string]: number }, grandTotal: number }}
 */
function computeMonthlySummary(transactions, month, year) {
  const filtered = transactions.filter((tx) => {
    const d = new Date(tx.timestamp);
    return d.getMonth() + 1 === month && d.getFullYear() === year;
  });

  const rawTotals = {};
  for (const tx of filtered) {
    if (rawTotals[tx.category] === undefined) {
      rawTotals[tx.category] = 0;
    }
    rawTotals[tx.category] += tx.amount;
  }

  // Omit categories with zero spending
  const categories = {};
  for (const [category, total] of Object.entries(rawTotals)) {
    if (total !== 0) {
      categories[category] = total;
    }
  }

  const grandTotal = Object.values(categories).reduce((sum, v) => sum + v, 0);

  return { categories, grandTotal };
}


/* ═══════════════════════════════════
   STATE MUTATORS
   ═══════════════════════════════════ */

/**
 * Creates a new transaction and appends it to AppState, then
 * persists and re-renders.
 *
 * ID generation uses `crypto.randomUUID()` when available
 * (all modern browsers) with a `Date.now().toString()` fallback
 * for environments where the Crypto API is absent.
 *
 * @param {string}        name     - Item name (already validated).
 * @param {string|number} amount   - Expense amount (will be parseFloat'd).
 * @param {string}        category - One of CATEGORIES.
 *
 * Requirements: 1.2, 9.1
 */
function addTransaction(name, amount, category) {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : Date.now().toString();

  const timestamp = Date.now();

  AppState.transactions.push({
    id,
    name,
    amount: parseFloat(amount),
    category,
    timestamp,
  });

  syncToStorage();
  renderAll();
}

/**
 * Removes the transaction with the given `id` from AppState,
 * then persists and re-renders.
 *
 * If no transaction matches the given id the call is a no-op
 * (splice on index -1 would be destructive, so we guard).
 *
 * @param {string} id - The `id` field of the transaction to delete.
 *
 * Requirements: 3.2, 9.2
 */
function deleteTransaction(id) {
  const index = AppState.transactions.findIndex((tx) => tx.id === id);
  if (index !== -1) {
    AppState.transactions.splice(index, 1);
  }

  syncToStorage();
  renderAll();
}

/**
 * Sets the spending limit to the parsed float of `value`,
 * then persists and re-renders.
 *
 * Callers are expected to validate `value` with
 * `validateSpendingLimit` before invoking this function.
 *
 * @param {string|number} value - The new spending limit value.
 *
 * Requirements: 7.2, 9.3
 */
function setSpendingLimit(value) {
  AppState.spendingLimit = parseFloat(value);

  syncToStorage();
  renderAll();
}

/**
 * Clears the spending limit (sets it to null), then persists
 * and re-renders. `syncToStorage` will remove the LS key when
 * the limit is null.
 *
 * Requirements: 7.6
 */
function clearSpendingLimit() {
  AppState.spendingLimit = null;

  syncToStorage();
  renderAll();
}


/* ═══════════════════════════════════
   RENDER FUNCTIONS
   ═══════════════════════════════════ */

/**
 * Updates the `#balance-display` element to reflect the current
 * total of all transactions.
 *
 * Behaviour:
 *  - Computes total with `computeBalance(AppState.transactions)`.
 *  - Formats it via `formatCurrency(total)` and sets the element's
 *    `textContent` to that string.
 *  - Adds the `.limit-exceeded` CSS class when a spending limit is
 *    set AND the total exceeds it; removes the class in all other
 *    cases (total ≤ limit, or no limit set).
 *
 * Requirements: 4.2, 4.3, 4.4, 4.5, 7.3, 7.4
 */
function renderBalance() {
  const total = computeBalance(AppState.transactions);
  const el = document.getElementById('balance-display');
const warning = document.getElementById("limit-warning");

  if (!el) return;

  el.textContent = formatCurrency(total);

  if (
    AppState.spendingLimit !== null &&
    total > AppState.spendingLimit
  ) {
    el.classList.add("limit-exceeded");

    if (warning) {
      warning.hidden = false;
    }
  } else {
    el.classList.remove("limit-exceeded");

    if (warning) {
      warning.hidden = true;
    }
  }
}
/**
 * Rebuilds the `#transaction-list` `<ul>` from scratch based on
 * the current `AppState.transactions` array.
 *
 * Behaviour:
 *  - Sorts a shallow copy of transactions by `timestamp` descending
 *    (most recent first). The original `AppState.transactions` array
 *    is NOT mutated.
 *  - Clears the `<ul>` and creates one `<li>` per transaction
 *    containing:
 *      • `.tx-name`   — item name
 *      • `.tx-amount` — amount formatted with `formatCurrency`
 *      • `.tx-category` — category name
 *      • `<button class="delete-btn">` with `data-id` set to the
 *        transaction's `id`
 *  - When the transactions array is empty, renders a single `<li>`
 *    with an empty-state message instead.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.5, 3.1
 */
function renderTransactionList() {
  const ul = document.getElementById('transaction-list');

  if (!ul) return;

  // Clear existing content
  ul.innerHTML = '';

  if (AppState.transactions.length === 0) {
    const emptyLi = document.createElement('li');
    emptyLi.className = 'tx-empty-state';
    emptyLi.textContent = 'No expenses recorded yet.';
    ul.appendChild(emptyLi);
    return;
  }

  // Sort a copy — most recent first; do NOT mutate AppState.transactions
  const sorted = AppState.transactions.slice().sort((a, b) => b.timestamp - a.timestamp);

  for (const tx of sorted) {
    const li = document.createElement('li');

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tx-name';
    nameSpan.textContent = tx.name;

    const amountSpan = document.createElement('span');
    amountSpan.className = 'tx-amount';
    amountSpan.textContent = formatCurrency(tx.amount);

    const categorySpan = document.createElement('span');
    categorySpan.className = 'tx-category';
    categorySpan.textContent = tx.category;

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.dataset.id = tx.id;
    deleteBtn.textContent = 'Delete';
    deleteBtn.setAttribute('aria-label', `Delete ${tx.name}`);

    li.appendChild(nameSpan);
    li.appendChild(amountSpan);
    li.appendChild(categorySpan);
    li.appendChild(deleteBtn);

    ul.appendChild(li);
  }
}


/* ═══════════════════════════════════
   CHART (Chart.js)
   ═══════════════════════════════════ */

/** Module-scoped Chart.js instance — created once in initChart(). */
let chartInstance = null;

/**
 * Creates the single Chart.js `Pie` instance and stores it in
 * `chartInstance`.
 *
 * Guards against Chart.js not being loaded (CDN unreachable):
 *  - If `Chart` is undefined, hides `<canvas id="spending-chart">` and
 *    shows `#chart-empty-msg` with a "Chart unavailable" message.
 *  - If `Chart` is available, creates the instance with:
 *      • `legend.position: 'bottom'`
 *      • A tooltip label callback that displays the percentage value.
 *
 * Requirements: 5.1, 10.1
 */
function initChart() {
  const canvas  = document.getElementById('spending-chart');
  const emptyMsg = document.getElementById('chart-empty-msg');

  if (typeof Chart === 'undefined') {
    // Chart.js did not load — show fallback message
    if (canvas)    canvas.style.display    = 'none';
    if (emptyMsg) {
      emptyMsg.textContent   = 'Chart unavailable';
      emptyMsg.style.display = 'block';
    }
    return;
  }

  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  chartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels:   [],
      datasets: [{ data: [], backgroundColor: [] }],
    },
    options: {
      plugins: {
        legend: { position: 'bottom' },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.label}: ${ctx.parsed.toFixed(1)}%`,
          },
        },
      },
    },
  });
}

/**
 * Updates the pie chart to reflect the current category totals
 * from `AppState.transactions`.
 *
 * Behaviour:
 *  - Computes totals with `computeCategoryTotals(AppState.transactions)`.
 *  - Filters out entries with a value of 0 or below.
 *  - If no data entries remain:
 *      • Hides `<canvas id="spending-chart">`.
 *      • Shows `#chart-empty-msg`.
 *  - Otherwise:
 *      • Shows `<canvas id="spending-chart">`.
 *      • Hides `#chart-empty-msg`.
 *      • Updates `chartInstance.data.labels`, `chartInstance.data.datasets[0].data`,
 *        and `chartInstance.data.datasets[0].backgroundColor` (using `CATEGORY_COLORS`).
 *      • Calls `chartInstance.update()` to re-render.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
function renderChart() {
  const canvas   = document.getElementById('spending-chart');
  const emptyMsg = document.getElementById('chart-empty-msg');

  // If Chart.js never loaded, chartInstance will be null — nothing to do
  if (!chartInstance) {
    return;
  }

  const totals  = computeCategoryTotals(AppState.transactions);
  const entries = Object.entries(totals).filter(([, v]) => v > 0);

  if (entries.length === 0) {
    if (canvas)    canvas.style.display    = 'none';
    if (emptyMsg)  emptyMsg.style.display  = 'block';
    return;
  }

  if (canvas)    canvas.style.display    = 'block';
  if (emptyMsg)  emptyMsg.style.display  = 'none';

  chartInstance.data.labels                      = entries.map(([k]) => k);
  chartInstance.data.datasets[0].data            = entries.map(([, v]) => v);
  chartInstance.data.datasets[0].backgroundColor = entries.map(([k]) => CATEGORY_COLORS[k] || '#999999');

  chartInstance.update();
}


/* ═══════════════════════════════════
   THEME
   ═══════════════════════════════════ */

/**
 * Applies the given theme to the document and persists it.
 *
 * Sets `document.body.dataset.theme` to `theme`, updates
 * `AppState.theme`, and calls `syncToStorage()` so the
 * preference survives page reload.
 *
 * @param {'light'|'dark'} theme - The theme to activate.
 *
 * Requirements: 6.2, 6.3
 */
function setTheme(theme) {
  document.body.dataset.theme = theme;
  AppState.theme = theme;
  syncToStorage();
}

/**
 * Toggles between "light" and "dark" themes.
 *
 * Reads `AppState.theme` and calls `setTheme` with the
 * opposite value: "light" → "dark", anything else → "light".
 *
 * Requirements: 6.2
 */
function toggleTheme() {
  setTheme(AppState.theme === 'light' ? 'dark' : 'light');
}


/* ═══════════════════════════════════
   MONTHLY SUMMARY
   ═══════════════════════════════════ */

/**
 * Populates the `#year-select` dropdown with options spanning
 * from the earliest transaction year through the current year.
 *
 * Behaviour:
 *  - Scans `AppState.transactions` for the minimum `timestamp` year.
 *  - If no transactions exist, the select contains only the current year.
 *  - Clears existing options before rebuilding.
 *  - Defaults the selection to the current year.
 *
 * Requirements: 8.2
 */
function initYearSelector() {
  const yearSelect = document.getElementById('year-select');

  if (!yearSelect) return;

  const currentYear = new Date().getFullYear();

  // Find earliest year from transactions, fall back to current year
  let earliestYear = currentYear;
  for (const tx of AppState.transactions) {
    const txYear = new Date(tx.timestamp).getFullYear();
    if (txYear < earliestYear) {
      earliestYear = txYear;
    }
  }

  // Rebuild options
  yearSelect.innerHTML = '';

  for (let y = earliestYear; y <= currentYear; y++) {
    const option = document.createElement('option');
    option.value = String(y);
    option.textContent = String(y);
    if (y === currentYear) {
      option.selected = true;
    }
    yearSelect.appendChild(option);
  }
}

/**
 * Reads the selected month and year from `#month-select` and
 * `#year-select`, calls `computeMonthlySummary`, and rebuilds
 * the summary table and empty-state message.
 *
 * Behaviour:
 *  - Reads `parseInt(#month-select.value)` (1–12) and
 *    `parseInt(#year-select.value)` (4-digit year).
 *  - Calls `computeMonthlySummary(AppState.transactions, month, year)`.
 *  - Clears `#summary-body` and rebuilds one `<tr>` per category
 *    with two `<td>` cells: the category name and the formatted amount
 *    (using `formatCurrency`).
 *  - Updates `#summary-grand-total` with two `<td>` cells: a label
 *    ("Total") and the formatted grand total.
 *  - If the result has no categories (empty period):
 *      • Clears `#summary-body`.
 *      • Shows `#summary-empty-msg`.
 *  - Otherwise hides `#summary-empty-msg`.
 *
 * Requirements: 8.1, 8.3, 8.4, 8.5
 */
function renderMonthlySummary() {
  const monthSelect = document.getElementById('month-select');
  const yearSelect  = document.getElementById('year-select');
  const summaryBody = document.getElementById('summary-body');
  const grandTotalRow = document.getElementById('summary-grand-total');
  const emptyMsg    = document.getElementById('summary-empty-msg');

  if (!monthSelect || !yearSelect || !summaryBody || !grandTotalRow || !emptyMsg) return;

  const month = parseInt(monthSelect.value, 10);
  const year  = parseInt(yearSelect.value, 10);

  const { categories, grandTotal } = computeMonthlySummary(AppState.transactions, month, year);

  const categoryEntries = Object.entries(categories);

  // Clear existing body rows
  summaryBody.innerHTML = '';

  if (categoryEntries.length === 0) {
    // No data for this period — show empty message, clear grand total
    grandTotalRow.innerHTML = '';
    emptyMsg.style.display = 'block';
    return;
  }

  // Hide empty message
  emptyMsg.style.display = 'none';

  // Rebuild per-category rows
  for (const [category, amount] of categoryEntries) {
    const tr = document.createElement('tr');

    const tdCategory = document.createElement('td');
    tdCategory.textContent = category;

    const tdAmount = document.createElement('td');
    tdAmount.textContent = formatCurrency(amount);

    tr.appendChild(tdCategory);
    tr.appendChild(tdAmount);
    summaryBody.appendChild(tr);
  }

  // Update grand total row
  grandTotalRow.innerHTML = '';

  const tdLabel = document.createElement('td');
  tdLabel.textContent = 'Total';

  const tdTotal = document.createElement('td');
  tdTotal.textContent = formatCurrency(grandTotal);

  grandTotalRow.appendChild(tdLabel);
  grandTotalRow.appendChild(tdTotal);
}


/* ═══════════════════════════════════
   RENDER — ORCHESTRATOR
   ═══════════════════════════════════ */

/**
 * Re-renders every UI section to reflect the current `AppState`.
 *
 * Call order:
 *  1. `renderBalance()`         — balance display + spending-limit style (.limit-exceeded)
 *  2. `renderTransactionList()` — rebuilds the transaction list
 *  3. `renderChart()`           — updates the pie chart
 *  4. `renderMonthlySummary()`  — updates the monthly summary table
 *
 * This is the single entry point used by all state mutators
 * (`addTransaction`, `deleteTransaction`, `setSpendingLimit`,
 * `clearSpendingLimit`) to keep every panel in sync after a
 * state change.
 *
 * Re-applying the spending-limit style is handled inside
 * `renderBalance()` (adds/removes `.limit-exceeded`), so no
 * separate call is required.
 *
 * Requirements: 3.3, 3.4, 4.3, 4.4
 */
function renderAll() {
  renderBalance();
  renderTransactionList();
  renderChart();
  renderMonthlySummary();
}

/* ═══════════════════════════════════
   EVENT LISTENERS
   ═══════════════════════════════════ */

/**
 * Handles `#add-form` submission.
 *
 * - Prevents the default page reload.
 * - Reads values from `#item-name`, `#amount`, and `#category`.
 * - Calls `validateTransaction`; on failure renders each error
 *   message inside `#form-errors` and returns early.
 * - On success clears `#form-errors`, calls `addTransaction`,
 *   resets the form fields, and returns focus to `#item-name`.
 *
 * Requirements: 1.3, 1.4, 1.5
 */
document.getElementById('add-form').addEventListener('submit', function (e) {
  e.preventDefault();

  const nameInput     = document.getElementById('item-name');
  const amountInput   = document.getElementById('amount');
  const categoryInput = document.getElementById('category');
  const formErrors    = document.getElementById('form-errors');

  const name     = nameInput.value;
  const amount   = amountInput.value;
  const category = categoryInput.value;

  const { valid, errors } = validateTransaction(name, amount, category);

  if (!valid) {
    formErrors.innerHTML = errors.map((err) => `<p>${err}</p>`).join('');
    return;
  }

  // Clear any previous errors
  formErrors.innerHTML = '';

  addTransaction(name, amount, category);

  // Reset fields and return focus to the first field
  nameInput.value     = '';
  amountInput.value   = '';
  categoryInput.value = '';
  nameInput.focus();
});

/**
 * Handles `#spending-limit-form` submission.
 *
 * - Prevents the default page reload.
 * - Reads value from `#spending-limit-input`.
 * - Calls `validateSpendingLimit`; on failure displays the error
 *   message in `#spending-limit-error` and returns early.
 * - On success clears `#spending-limit-error` and calls
 *   `setSpendingLimit` with the input value.
 *
 * Requirements: 7.1, 7.2
 */
document.getElementById('spending-limit-form').addEventListener('submit', function (e) {
  e.preventDefault();

  const limitInput = document.getElementById('spending-limit-input');
  const limitError = document.getElementById('spending-limit-error');

  const { valid, error } = validateSpendingLimit(limitInput.value);

  if (!valid) {
    limitError.textContent = error;
    return;
  }

  limitError.textContent = '';
  setSpendingLimit(limitInput.value);
});

/**
 * Handles the "Clear Limit" button click.
 *
 * Clears the `#spending-limit-input` field, clears any displayed
 * error, and calls `clearSpendingLimit()` to remove the limit from
 * both AppState and Local Storage.
 *
 * Requirements: 7.6
 */
document.getElementById('clear-limit-btn').addEventListener('click', function () {
  const limitInput = document.getElementById('spending-limit-input');
  const limitError = document.getElementById('spending-limit-error');

  limitInput.value       = '';
  limitError.textContent = '';

  clearSpendingLimit();
});

/**
 * Handles `#theme-toggle` click.
 *
 * Delegates to `toggleTheme()` which flips the active theme between
 * "light" and "dark" and persists the new preference to Local Storage.
 *
 * Requirements: 6.2
 */
document.getElementById('theme-toggle').addEventListener('click', function () {
  toggleTheme();
});

/**
 * Handles `#dismiss-error` click.
 *
 * Delegates to `dismissErrorNotification()` which hides the error
 * banner by adding the `hidden` attribute to `#error-notification`.
 *
 * Requirements: 9.5
 */
document.getElementById('dismiss-error').addEventListener('click', function () {
  dismissErrorNotification();
});

/**
 * Handles `#month-select` change.
 *
 * Re-renders the monthly summary whenever the user selects a
 * different month, filtering transactions to the newly selected period.
 *
 * Requirements: 8.3
 */
document.getElementById('month-select').addEventListener('change', function () {
  renderMonthlySummary();
});

/**
 * Handles `#year-select` change.
 *
 * Re-renders the monthly summary whenever the user selects a
 * different year, filtering transactions to the newly selected period.
 *
 * Requirements: 8.3
 */
document.getElementById('year-select').addEventListener('change', function () {
  renderMonthlySummary();
});

/**
 * Handles delegated clicks on `#transaction-list` for delete buttons.
 *
 * Uses event delegation so that dynamically rendered `.delete-btn`
 * elements are covered without needing to re-attach listeners after
 * every `renderTransactionList()` call.
 *
 * When a click target has the class `delete-btn`, reads its
 * `data-id` attribute and calls `deleteTransaction(id)`.
 *
 * Requirements: 3.2
 */
document.getElementById('transaction-list').addEventListener('click', function (e) {
  if (e.target.classList.contains('delete-btn')) {
    const id = e.target.dataset.id;
    deleteTransaction(id);
  }
});

/* ═══════════════════════════════════
   INIT
   ═══════════════════════════════════ */

function init() {
  const savedState = loadFromStorage();

  AppState.transactions = savedState.transactions;
  AppState.spendingLimit = savedState.spendingLimit;
  AppState.theme = savedState.theme;

  if (!AppState.storageAvailable) {
    showErrorNotification('Local Storage is unavailable.');
  }

  // Gunakan tema yang tersimpan, atau ikuti tema sistem jika belum ada
  if (localStorage.getItem(LS_KEYS.THEME)) {
    document.body.dataset.theme = AppState.theme;
  } else {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setTheme(prefersDark ? 'dark' : 'light');
  }

  initChart();
  initYearSelector();
  renderAll();
}

init();