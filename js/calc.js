/* ZiN Home Accounting — pure calculation helpers (no DOM, no network). */
(function (root) {
  'use strict';

  const toCents = (n) => Math.round((Number(n) || 0) * 100 + (n < 0 ? -1e-7 : 1e-7));
  const fromCents = (c) => c / 100;

  /** Split `amount` equally among ids; leftover cents go to the first ids. */
  function splitEqual(amount, ids) {
    const out = {};
    if (!ids.length) return out;
    const total = toCents(amount);
    const base = Math.trunc(total / ids.length);
    let rem = total - base * ids.length;
    ids.forEach((id) => {
      out[id] = fromCents(base + (rem > 0 ? 1 : 0));
      if (rem > 0) rem--;
    });
    return out;
  }

  /** Sum of a shares object, in cents. */
  function sumShares(shares) {
    return Object.values(shares || {}).reduce((a, v) => a + toCents(v), 0);
  }

  /** Greedy minimal-transfer settlement from balances in cents. */
  function settle(balanceCents) {
    const cred = [], debt = [];
    Object.entries(balanceCents).forEach(([id, c]) => {
      if (c > 0) cred.push({ id, c });
      else if (c < 0) debt.push({ id, c: -c });
    });
    cred.sort((a, b) => b.c - a.c || a.id.localeCompare(b.id));
    debt.sort((a, b) => b.c - a.c || a.id.localeCompare(b.id));
    const transfers = [];
    let i = 0, j = 0;
    while (i < debt.length && j < cred.length) {
      const pay = Math.min(debt[i].c, cred[j].c);
      if (pay > 0) transfers.push({ from: debt[i].id, to: cred[j].id, amount: fromCents(pay) });
      debt[i].c -= pay;
      cred[j].c -= pay;
      if (debt[i].c === 0) i++;
      if (cred[j].c === 0) j++;
    }
    return transfers;
  }

  /**
   * Full period summary.
   * members: [{id,name}], bills/market: [{amount, paidBy, shares, category?}]
   */
  function summarize(members, bills, market) {
    const ids = new Set(members.map((m) => m.id));
    const per = {};
    const ensure = (id) => {
      if (!per[id]) {
        per[id] = { id, paidBills: 0, paidMarket: 0, shareBills: 0, shareMarket: 0 }; // cents
      }
      return per[id];
    };
    members.forEach((m) => ensure(m.id));

    const byCategory = {};
    let billsTotal = 0, marketTotal = 0;

    (bills || []).forEach((b) => {
      const amt = toCents(b.amount);
      billsTotal += amt;
      ensure(b.paidBy).paidBills += amt;
      Object.entries(b.shares || {}).forEach(([id, v]) => (ensure(id).shareBills += toCents(v)));
      const k = b.category || 'Other';
      byCategory[k] = (byCategory[k] || 0) + amt;
    });
    (market || []).forEach((m) => {
      const amt = toCents(m.amount);
      marketTotal += amt;
      ensure(m.paidBy).paidMarket += amt;
      Object.entries(m.shares || {}).forEach(([id, v]) => (ensure(id).shareMarket += toCents(v)));
    });

    const balances = {};
    Object.values(per).forEach((p) => {
      p.paid = p.paidBills + p.paidMarket;
      p.share = p.shareBills + p.shareMarket;
      p.balance = p.paid - p.share; // + => should receive, - => should pay
      balances[p.id] = p.balance;
    });
    const transfers = settle(balances);

    const people = Object.values(per).map((p) => ({
      id: p.id,
      known: ids.has(p.id),
      paidBills: fromCents(p.paidBills),
      paidMarket: fromCents(p.paidMarket),
      shareBills: fromCents(p.shareBills),
      shareMarket: fromCents(p.shareMarket),
      paid: fromCents(p.paid),
      share: fromCents(p.share),
      balance: fromCents(p.balance),
      pays: transfers.filter((t) => t.from === p.id).map((t) => ({ to: t.to, amount: t.amount })),
      receives: transfers.filter((t) => t.to === p.id).map((t) => ({ from: t.from, amount: t.amount })),
    }));

    const cats = {};
    Object.entries(byCategory).forEach(([k, v]) => (cats[k] = fromCents(v)));

    return {
      billsTotal: fromCents(billsTotal),
      marketTotal: fromCents(marketTotal),
      grandTotal: fromCents(billsTotal + marketTotal),
      byCategory: cats,
      people,
      transfers,
    };
  }

  /** Date helpers (YYYY-MM-DD strings, local-time safe). */
  const pad = (n) => String(n).padStart(2, '0');
  const fmtISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  function addMonthsISO(iso, months) {
    const d = parseISO(iso);
    const day = d.getDate();
    d.setDate(1);
    d.setMonth(d.getMonth() + months);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(day, last));
    return fmtISO(d);
  }
  function addDaysISO(iso, days) {
    const d = parseISO(iso);
    d.setDate(d.getDate() + days);
    return fmtISO(d);
  }
  /** Next period after one that ended on `end`: starts the day after, runs one month (inclusive). */
  function nextPeriod(end) {
    const start = addDaysISO(end, 1);
    return { start, end: addDaysISO(addMonthsISO(start, 1), -1) };
  }
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);

  const api = {
    toCents, fromCents, splitEqual, sumShares, settle, summarize,
    fmtISO, parseISO, addMonthsISO, addDaysISO, nextPeriod, daysBetween,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZinCalc = api;
})(typeof window !== 'undefined' ? window : globalThis);
