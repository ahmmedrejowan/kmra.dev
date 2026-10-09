/** Loans and savings. Full precision throughout; round only when showing. */

/** Monthly payment for a loan (annuity). `annualRate` in percent. */
export function monthlyPayment(
  principal: number,
  annualRate: number,
  months: number,
): number {
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / months;
  const k = Math.pow(1 + r, months);
  return (principal * r * k) / (k - 1);
}

export interface LoanRow {
  /** 1-based month number */
  n: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export function amortize(
  principal: number,
  annualRate: number,
  months: number,
): { payment: number; rows: LoanRow[]; totalInterest: number } {
  const r = annualRate / 100 / 12;
  const payment = monthlyPayment(principal, annualRate, months);
  const rows: LoanRow[] = [];
  let bal = principal;
  let totalInterest = 0;
  for (let n = 1; n <= months; n++) {
    const interest = bal * r;
    // The last payment clears whatever is left, so the balance ends at exactly 0
    const pay = n === months ? bal + interest : payment;
    const toPrincipal = pay - interest;
    bal = n === months ? 0 : bal - toPrincipal;
    totalInterest += interest;
    rows.push({
      n,
      payment: pay,
      interest,
      principal: toPrincipal,
      balance: Math.max(0, bal),
    });
  }
  return { payment, rows, totalInterest };
}

/** Group monthly rows into years (year 1 = months 1–12). */
export function byYear(rows: LoanRow[]): LoanRow[] {
  const out: LoanRow[] = [];
  for (const r of rows) {
    const y = Math.ceil(r.n / 12);
    let row = out[y - 1];
    if (!row) {
      row = { n: y, payment: 0, interest: 0, principal: 0, balance: 0 };
      out.push(row);
    }
    row.payment += r.payment;
    row.interest += r.interest;
    row.principal += r.principal;
    row.balance = r.balance;
  }
  return out;
}

export interface GrowthRow {
  year: number;
  /** Money put in during the year (the starting amount counts in year 1) */
  deposits: number;
  interest: number;
  /** Money put in so far */
  totalDeposits: number;
  totalInterest: number;
  balance: number;
}

/**
 * Savings with compound interest and a deposit at the end of every month. Interest compounds
 * `perYear` times a year (1, 4, 12 or 365); for the monthly steps the rate is converted to the
 * equivalent monthly rate, so a lump sum grows by exactly (1 + r/n)^(n·t).
 */
export function grow(
  start: number,
  monthly: number,
  annualRate: number,
  years: number,
  perYear: number,
): { rows: GrowthRow[]; balance: number; deposits: number; interest: number } {
  const i = Math.pow(1 + annualRate / 100 / perYear, perYear / 12) - 1;
  const rows: GrowthRow[] = [];
  let bal = start;
  let totalDeposits = start;
  const months = Math.round(years * 12);
  let yDep = start;
  let yInt = 0;
  for (let m = 1; m <= months; m++) {
    const int = bal * i;
    bal += int + monthly;
    yInt += int;
    yDep += monthly;
    totalDeposits += monthly;
    if (m % 12 === 0 || m === months) {
      rows.push({
        year: Math.ceil(m / 12),
        deposits: yDep,
        interest: yInt,
        totalDeposits,
        totalInterest: bal - totalDeposits,
        balance: bal,
      });
      yDep = 0;
      yInt = 0;
    }
  }
  return {
    rows,
    balance: bal,
    deposits: totalDeposits,
    interest: bal - totalDeposits,
  };
}
