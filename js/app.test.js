/**
 * Tests for pure functions in js/app.js
 * Covers: formatCurrency, computeBalance, computeCategoryTotals,
 *         computeMonthlySummary, validateTransaction, validateSpendingLimit
 *
 * Property-based tests use fast-check (100+ iterations each).
 * Feature: expense-budget-visualizer
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import * as fc from 'fast-check';
import { describe, it, expect, beforeAll } from 'vitest';

// ─── Load pure functions from app.js ────────────────────────────────────────
// app.js is a browser global script (no ESM exports). We eval it in a sandbox
// that stubs out the browser APIs it references at the top level so the module
// loads without throwing, then we pull the pure functions out of that sandbox.

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

let formatCurrency,
    computeBalance,
    computeCategoryTotals,
    computeMonthlySummary,
    validateTransaction,
    validateSpendingLimit;

beforeAll(() => {
  const src = readFileSync(resolve(__dirname, 'app.js'), 'utf8');

  // Minimal browser-global stubs so app.js loads without errors
  const sandbox = {
    localStorage: {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    },
    // showErrorNotification is defined inside the file; no stub needed
  };

  // Use a Function constructor so the script runs in module scope but we can
  // inject stubs and capture exported-by-assignment symbols from the scope.
  const wrapper = new Function(
    'localStorage',
    `${src}
    return {
      formatCurrency,
      computeBalance,
      computeCategoryTotals,
      computeMonthlySummary,
      validateTransaction,
      validateSpendingLimit,
    };`
  );

  const fns = wrapper(sandbox.localStorage);
  ({ formatCurrency, computeBalance, computeCategoryTotals,
     computeMonthlySummary, validateTransaction, validateSpendingLimit } = fns);
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Build a minimal transaction object for tests */
function mkTx(amount, category, timestamp = Date.now()) {
  return { id: '1', name: 'item', amount, category, timestamp };
}

// ─── formatCurrency — unit tests ────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats zero as $0.00', () => {
    expect(formatCurrency(0)).toBe('$0.00');
  });

  it('formats integer with two decimal places', () => {
    expect(formatCurrency(5)).toBe('$5.00');
  });

  it('formats 1234.5 as $1,234.50', () => {
    expect(formatCurrency(1234.5)).toBe('$1,234.50');
  });

  it('formats max value $999,999,999.99', () => {
    expect(formatCurrency(999999999.99)).toBe('$999,999,999.99');
  });

  it('always produces two decimal places', () => {
    expect(formatCurrency(1.1)).toBe('$1.10');
  });

  it('result starts with $', () => {
    expect(formatCurrency(42)).toMatch(/^\$/);
  });
});

// ─── computeBalance — unit tests ────────────────────────────────────────────

describe('computeBalance', () => {
  it('returns 0 for empty array', () => {
    expect(computeBalance([])).toBe(0);
  });

  it('returns the single amount for a one-item array', () => {
    expect(computeBalance([mkTx(9.99, 'Food')])).toBe(9.99);
  });

  it('sums multiple transactions', () => {
    const txs = [mkTx(10, 'Food'), mkTx(20, 'Transport'), mkTx(5.5, 'Fun')];
    expect(computeBalance(txs)).toBeCloseTo(35.5);
  });
});

// ─── computeCategoryTotals — unit tests ─────────────────────────────────────

describe('computeCategoryTotals', () => {
  it('returns empty object for empty array', () => {
    expect(computeCategoryTotals([])).toEqual({});
  });

  it('sums single category', () => {
    const txs = [mkTx(10, 'Food'), mkTx(5, 'Food')];
    expect(computeCategoryTotals(txs)).toEqual({ Food: 15 });
  });

  it('handles multiple categories', () => {
    const txs = [
      mkTx(10, 'Food'),
      mkTx(20, 'Transport'),
      mkTx(5,  'Fun'),
    ];
    const result = computeCategoryTotals(txs);
    expect(result.Food).toBeCloseTo(10);
    expect(result.Transport).toBeCloseTo(20);
    expect(result.Fun).toBeCloseTo(5);
  });

  it('omits categories with zero total', () => {
    // No transactions for Transport or Fun
    const txs = [mkTx(7, 'Food')];
    const result = computeCategoryTotals(txs);
    expect(Object.keys(result)).not.toContain('Transport');
    expect(Object.keys(result)).not.toContain('Fun');
  });
});

// ─── computeMonthlySummary — unit tests ─────────────────────────────────────

describe('computeMonthlySummary', () => {
  it('returns empty categories and 0 grand total when no transactions', () => {
    const result = computeMonthlySummary([], 1, 2025);
    expect(result).toEqual({ categories: {}, grandTotal: 0 });
  });

  it('filters by month and year correctly', () => {
    const jan = new Date(2025, 0, 15).getTime(); // January 2025
    const feb = new Date(2025, 1, 10).getTime(); // February 2025
    const txs = [
      mkTx(100, 'Food', jan),
      mkTx(50,  'Transport', feb),
    ];
    const result = computeMonthlySummary(txs, 1, 2025);
    expect(result.categories).toEqual({ Food: 100 });
    expect(result.grandTotal).toBeCloseTo(100);
  });

  it('grand total equals sum of per-category totals', () => {
    const ts = new Date(2025, 2, 5).getTime(); // March 2025
    const txs = [
      mkTx(30, 'Food', ts),
      mkTx(20, 'Transport', ts),
      mkTx(10, 'Fun', ts),
    ];
    const result = computeMonthlySummary(txs, 3, 2025);
    const categorySum = Object.values(result.categories).reduce((a, b) => a + b, 0);
    expect(result.grandTotal).toBeCloseTo(categorySum);
    expect(result.grandTotal).toBeCloseTo(60);
  });

  it('omits categories with zero spending', () => {
    const ts = new Date(2025, 3, 1).getTime();
    const txs = [mkTx(40, 'Food', ts)];
    const result = computeMonthlySummary(txs, 4, 2025);
    expect(Object.keys(result.categories)).not.toContain('Transport');
    expect(Object.keys(result.categories)).not.toContain('Fun');
  });
});

// ─── validateTransaction — unit tests ───────────────────────────────────────

describe('validateTransaction', () => {
  it('returns valid:true for a well-formed transaction', () => {
    expect(validateTransaction('Coffee', '3.50', 'Food').valid).toBe(true);
  });

  it('rejects empty name', () => {
    const r = validateTransaction('', '5.00', 'Food');
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it('rejects name longer than 100 characters', () => {
    const long = 'a'.repeat(101);
    expect(validateTransaction(long, '5.00', 'Food').valid).toBe(false);
  });

  it('accepts name exactly 100 characters', () => {
    const name = 'a'.repeat(100);
    expect(validateTransaction(name, '5.00', 'Food').valid).toBe(true);
  });

  it('rejects amount of 0', () => {
    expect(validateTransaction('item', '0', 'Food').valid).toBe(false);
  });

  it('rejects negative amount', () => {
    expect(validateTransaction('item', '-1', 'Food').valid).toBe(false);
  });

  it('rejects amount with 3 decimal places', () => {
    expect(validateTransaction('item', '1.123', 'Food').valid).toBe(false);
  });

  it('accepts amount with 2 decimal places', () => {
    expect(validateTransaction('item', '1.12', 'Food').valid).toBe(true);
  });

  it('rejects invalid category', () => {
    expect(validateTransaction('item', '5.00', 'Other').valid).toBe(false);
  });

  it('rejects all-invalid inputs and reports multiple errors', () => {
    const r = validateTransaction('', '-1', 'Unknown');
    expect(r.valid).toBe(false);
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it('returns valid:false with non-empty errors array on failure', () => {
    const r = validateTransaction('', '5', 'Food');
    expect(r.valid).toBe(false);
    expect(Array.isArray(r.errors)).toBe(true);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

// ─── validateSpendingLimit — unit tests ─────────────────────────────────────

describe('validateSpendingLimit', () => {
  it('returns valid:true for 0.01', () => {
    expect(validateSpendingLimit('0.01').valid).toBe(true);
  });

  it('returns valid:true for max value', () => {
    expect(validateSpendingLimit('999999999.99').valid).toBe(true);
  });

  it('rejects zero', () => {
    expect(validateSpendingLimit('0').valid).toBe(false);
  });

  it('rejects negative', () => {
    expect(validateSpendingLimit('-1').valid).toBe(false);
  });

  it('rejects non-numeric string', () => {
    expect(validateSpendingLimit('abc').valid).toBe(false);
  });

  it('returns an error string on failure', () => {
    const r = validateSpendingLimit('0');
    expect(r.valid).toBe(false);
    expect(typeof r.error).toBe('string');
    expect(r.error.length).toBeGreaterThan(0);
  });

  it('returns empty error on success', () => {
    const r = validateSpendingLimit('100');
    expect(r.valid).toBe(true);
    expect(r.error).toBe('');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PROPERTY-BASED TESTS
// ═══════════════════════════════════════════════════════════════════════════

// ─── Arbitraries ────────────────────────────────────────────────────────────

const CATEGORIES_LIST = ['Food', 'Transport', 'Fun'];

/** A valid transaction amount: positive, ≤ 2 decimal places, within range */
const validAmountArb = fc
  .integer({ min: 1, max: 99999999999 })   // cents, 1 cent … $999,999,999.99
  .map((cents) => cents / 100);

/** A valid transaction object */
const transactionArb = fc.record({
  id:        fc.uuid(),
  name:      fc.string({ minLength: 1, maxLength: 100 }),
  amount:    validAmountArb,
  category:  fc.constantFrom(...CATEGORIES_LIST),
  timestamp: fc.integer({ min: 0, max: 2_000_000_000_000 }),
});

// ─── P2: Validator Correctness ───────────────────────────────────────────────

describe('P2 — Validator Correctness (Property-Based)', () => {
  // Feature: expense-budget-visualizer, Property 2: validateTransaction returns valid: true iff all fields pass constraints

  it('valid inputs always produce valid:true', () => {
    // Validates: Requirements 1.3, 1.4
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        validAmountArb,
        fc.constantFrom(...CATEGORIES_LIST),
        (name, amount, category) => {
          const result = validateTransaction(name, String(amount), category);
          return result.valid === true && result.errors.length === 0;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty name always produces valid:false', () => {
    fc.assert(
      fc.property(
        validAmountArb,
        fc.constantFrom(...CATEGORIES_LIST),
        (amount, category) => {
          const result = validateTransaction('', String(amount), category);
          return result.valid === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('name over 100 chars always produces valid:false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 101, maxLength: 200 }),
        validAmountArb,
        fc.constantFrom(...CATEGORIES_LIST),
        (name, amount, category) => {
          const result = validateTransaction(name, String(amount), category);
          return result.valid === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('invalid category always produces valid:false', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 100 }),
        validAmountArb,
        fc.string().filter((s) => !CATEGORIES_LIST.includes(s)),
        (name, amount, category) => {
          const result = validateTransaction(name, String(amount), category);
          return result.valid === false;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('result always has valid boolean and errors array', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.anything().map(String),
        fc.string(),
        (name, amount, category) => {
          const result = validateTransaction(name, amount, category);
          return (
            typeof result.valid === 'boolean' &&
            Array.isArray(result.errors)
          );
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P4: Balance Computation ─────────────────────────────────────────────────

describe('P4 — Balance Computation (Property-Based)', () => {
  // Feature: expense-budget-visualizer, Property 4: computeBalance equals arithmetic sum, renderBalance displays correct format

  it('computeBalance equals arithmetic sum of amounts', () => {
    // Validates: Requirements 4.2, 4.5
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        (txs) => {
          const expected = txs.reduce((s, tx) => s + tx.amount, 0);
          const actual   = computeBalance(txs);
          return Math.abs(actual - expected) < 1e-9;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('computeBalance returns 0 for empty array', () => {
    fc.assert(
      fc.property(fc.constant([]), (txs) => computeBalance(txs) === 0),
      { numRuns: 10 }
    );
  });

  it('formatCurrency of balance matches $X,XXX.XX pattern', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        (txs) => {
          const balance   = computeBalance(txs);
          const formatted = formatCurrency(balance);
          return /^\$[\d,]+\.\d{2}$/.test(formatted);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P6: Category Aggregation ────────────────────────────────────────────────

describe('P6 — Category Aggregation (Property-Based)', () => {
  // Feature: expense-budget-visualizer, Property 6: computeCategoryTotals sums per category, only non-zero keys, sum equals computeBalance

  it('each value equals the sum of amounts for that category', () => {
    // Validates: Requirements 5.1, 5.4, 5.5
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        (txs) => {
          const totals = computeCategoryTotals(txs);
          for (const [cat, total] of Object.entries(totals)) {
            const expected = txs
              .filter((tx) => tx.category === cat)
              .reduce((s, tx) => s + tx.amount, 0);
            if (Math.abs(total - expected) >= 1e-9) return false;
          }
          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('only non-zero categories appear as keys', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        (txs) => {
          const totals = computeCategoryTotals(txs);
          return Object.values(totals).every((v) => v !== 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('sum of category totals equals computeBalance', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        (txs) => {
          const totals   = computeCategoryTotals(txs);
          const catSum   = Object.values(totals).reduce((s, v) => s + v, 0);
          const balance  = computeBalance(txs);
          return Math.abs(catSum - balance) < 1e-9;
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── P7: Monthly Summary Grand Total ─────────────────────────────────────────

describe('P7 — Monthly Summary Grand Total (Property-Based)', () => {
  // Feature: expense-budget-visualizer, Property 7: grand total equals sum of per-category totals, zero categories omitted

  const monthArb = fc.integer({ min: 1, max: 12 });
  const yearArb  = fc.integer({ min: 2000, max: 2030 });

  it('grand total equals sum of per-category totals', () => {
    // Validates: Requirements 8.1, 8.5
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        monthArb,
        yearArb,
        (txs, month, year) => {
          const { categories, grandTotal } = computeMonthlySummary(txs, month, year);
          const catSum = Object.values(categories).reduce((s, v) => s + v, 0);
          return Math.abs(grandTotal - catSum) < 1e-9;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('categories with zero spending are omitted', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArb, { minLength: 0, maxLength: 50 }),
        monthArb,
        yearArb,
        (txs, month, year) => {
          const { categories } = computeMonthlySummary(txs, month, year);
          return Object.values(categories).every((v) => v !== 0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('grand total is 0 when no transactions match the period', () => {
    // Use a timestamp guaranteed to fall in a different year than the query
    const ts = new Date(1999, 0, 1).getTime();
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id:        fc.uuid(),
            name:      fc.string({ minLength: 1, maxLength: 100 }),
            amount:    validAmountArb,
            category:  fc.constantFrom(...CATEGORIES_LIST),
            timestamp: fc.constant(ts),
          }),
          { minLength: 1, maxLength: 20 }
        ),
        monthArb,
        fc.integer({ min: 2000, max: 2030 }),   // year ≠ 1999
        (txs, month, year) => {
          const { grandTotal } = computeMonthlySummary(txs, month, year);
          return grandTotal === 0;
        }
      ),
      { numRuns: 100 }
    );
  });
});
