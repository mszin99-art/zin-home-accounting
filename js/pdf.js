/* ZiN Home Accounting — PDF export of a closed (or current) period snapshot. */
(function () {
  'use strict';

  const CODES = { '€': 'EUR', '$': 'USD', '৳': 'BDT', '£': 'GBP', '₹': 'INR' };
  // Built-in PDF fonts only cover Latin-1; replace anything else so text never prints as garbage.
  const safe = (s) => String(s == null ? '' : s).replace(/[^\u0000-ÿ]/g, '?');
  const GREEN = [10, 110, 98];
  const GOLD = [242, 166, 46];
  const INK = [28, 40, 38];

  function runTable(doc, opts) {
    if (typeof doc.autoTable === 'function') return doc.autoTable(opts);
    const fn = (window.jspdfAutoTable && (window.jspdfAutoTable.default || window.jspdfAutoTable)) || window.autoTable;
    if (typeof fn !== 'function') throw new Error('PDF table plugin not loaded');
    return fn(doc, opts);
  }

  function build(snap) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const code = CODES[snap.currency] || safe(snap.currency || '');
    const money = (n) => `${code} ${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const name = (id) => safe((snap.members.find((m) => m.id === id) || {}).name || 'Unknown');
    const sm = snap.summary;
    const M = 40;
    const R = (t) => ({ content: t, styles: { halign: 'right' } });

    // Header band
    doc.setFillColor(...GREEN);
    doc.rect(0, 0, W, 86, 'F');
    doc.setFillColor(...GOLD);
    doc.circle(M + 9, 30, 5, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(24);
    doc.text('ZiN', M, 58);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Home Accounting', M + 56, 58);
    doc.setFontSize(10);
    doc.text(safe(snap.houseName), W - M, 36, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(`${snap.start}  to  ${snap.end}`, W - M, 54, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.text(snap.closedAt ? `Closed ${window.ZinCalc.fmtISO(new Date(snap.closedAt))}` : 'Open period (preview)', W - M, 70, { align: 'right' });

    let y = 112;
    doc.setTextColor(...INK);

    // Totals
    const boxW = (W - M * 2 - 20) / 3;
    [['Bills', sm.billsTotal], ['Market', sm.marketTotal], ['Grand total', sm.grandTotal]].forEach(([label, val], i) => {
      const x = M + i * (boxW + 10);
      doc.setFillColor(238, 246, 244);
      doc.roundedRect(x, y, boxW, 48, 6, 6, 'F');
      doc.setFontSize(8.5); doc.setTextColor(90, 110, 106); doc.text(label.toUpperCase(), x + 12, y + 17);
      doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.setTextColor(...INK); doc.text(money(val), x + 12, y + 37);
      doc.setFont('helvetica', 'normal');
    });
    y += 70;

    const heading = (t) => {
      if (y > 740) { doc.addPage(); y = 50; }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(...GREEN);
      doc.text(t, M, y); doc.setFont('helvetica', 'normal'); doc.setTextColor(...INK);
      y += 8;
    };
    const baseStyles = {
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 4, textColor: INK },
      headStyles: { fillColor: GREEN, textColor: 255 },
      alternateRowStyles: { fillColor: [247, 250, 249] },
      margin: { left: M, right: M },
    };
    const after = () => { y = doc.lastAutoTable.finalY + 22; };

    // Settlement
    heading('Who pays whom');
    if (sm.transfers.length) {
      runTable(doc, {
        ...baseStyles, startY: y,
        head: [['From', 'To', R('Amount')]],
        body: sm.transfers.map((t) => [name(t.from), name(t.to), money(t.amount)]),
        columnStyles: { 2: { halign: 'right' } },
      });
    } else {
      runTable(doc, { ...baseStyles, startY: y, head: [['Everything is settled']], body: [['No payments needed.']] });
    }
    after();

    // Per person
    heading('Per person');
    runTable(doc, {
      ...baseStyles, startY: y,
      head: [['Person', R('Paid (bills)'), R('Paid (market)'), R('Total paid'), R('Own share'), R('Balance')]],
      body: sm.people.map((p) => [
        name(p.id), money(p.paidBills), money(p.paidMarket), money(p.paid), money(p.share),
        (p.balance > 0 ? 'Gets ' : p.balance < 0 ? 'Owes ' : '') + money(Math.abs(p.balance)),
      ]),
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right', fontStyle: 'bold' } },
    });
    after();

    // Bills by category
    heading('Bills');
    const cats = {};
    snap.bills.forEach((b) => { (cats[b.category || 'Other'] = cats[b.category || 'Other'] || []).push(b); });
    const billBody = [];
    Object.entries(cats).forEach(([c, list]) => {
      list.forEach((b) => billBody.push([
        b.date, safe(c), name(b.paidBy),
        Object.keys(b.shares || {}).map(name).join(', '), money(b.amount),
      ]));
      billBody.push([{ content: `${safe(c)} total`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [224, 240, 236] } },
        { content: money(sm.byCategory[c] || 0), styles: { fontStyle: 'bold', halign: 'right', fillColor: [224, 240, 236] } }]);
    });
    if (!billBody.length) billBody.push([{ content: 'No bills in this period.', colSpan: 5 }]);
    runTable(doc, {
      ...baseStyles, startY: y,
      head: [['Date', 'Bill', 'Paid by', 'Split among', R('Amount')]],
      body: billBody,
      columnStyles: { 3: { cellWidth: 150 }, 4: { halign: 'right' } },
    });
    after();

    // Market by buyer
    heading('Market / groceries');
    const marketBody = [];
    const buyers = {};
    snap.market.forEach((e) => { (buyers[e.paidBy] = buyers[e.paidBy] || []).push(e); });
    Object.entries(buyers).forEach(([id, list]) => {
      let sum = 0;
      list.forEach((e, i) => {
        sum += Math.round(e.amount * 100);
        marketBody.push([i + 1, e.date, name(id), safe(e.note || ''), money(e.amount)]);
      });
      marketBody.push([{ content: `${name(id)} total`, colSpan: 4, styles: { fontStyle: 'bold', fillColor: [224, 240, 236] } },
        { content: money(sum / 100), styles: { fontStyle: 'bold', halign: 'right', fillColor: [224, 240, 236] } }]);
    });
    if (!marketBody.length) marketBody.push([{ content: 'No market entries in this period.', colSpan: 5 }]);
    runTable(doc, {
      ...baseStyles, startY: y,
      head: [['#', 'Date', 'Bought by', 'Items', R('Amount')]],
      body: marketBody,
      columnStyles: { 0: { cellWidth: 26 }, 4: { halign: 'right' } },
    });

    // Footer
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(120, 130, 128);
      doc.text('ZiN Home Accounting', M, 818);
      doc.text(`Page ${i} / ${pages}`, W - M, 818, { align: 'right' });
    }
    return doc;
  }

  function fileName(snap) {
    const h = safe(snap.houseName).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'House';
    return `ZiN-Home-Accounting_${h}_${snap.start}_to_${snap.end}.pdf`;
  }

  window.ZinPDF = {
    build,
    fileName,
    download(snap) { build(snap).save(fileName(snap)); },
  };
})();
