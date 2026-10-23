/* ZiN Home Accounting — UI */
(async function () {
  'use strict';
  const C = window.ZinCalc;

  /* ───────────── helpers ───────────── */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const fmtShort = (iso) => `${+iso.slice(8, 10)} ${MONTHS[+iso.slice(5, 7) - 1]}`;
  const todayISO = () => C.fmtISO(new Date());
  const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const parseAmt = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };
  const PRESETS = ['Rent', 'Electricity', 'Gas', 'Wifi / Internet', 'Water', 'Waste tax'];
  const CURRENCIES = [['€', 'Euro (€)'], ['$', 'US Dollar ($)'], ['£', 'Pound (£)'], ['৳', 'Taka (৳)'], ['₹', 'Rupee (₹)']];

  const ICON = {
    edit: '<path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    sliders: '<line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>',
    home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    bills: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>',
    cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
    arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    chev: '<polyline points="6 9 12 15 18 9"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  };
  const ic = (n) => `<svg class="ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

  function toast(msg, ms = 3200) {
    const t = $('#toast');
    t.textContent = msg; t.className = 'show';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.className = ''), ms);
  }

  /* ───────────── state ───────────── */
  const S = {
    store: null, ready: false, user: null, profile: undefined,
    houseId: null, house: null, bills: [], market: [], periods: [],
    tab: 'home', mview: 'person', open: {}, authTab: 'login', join: null,
    houseUnsubs: [], entryUnsubs: [], entriesKey: null, profileUnsub: null,
    lastScreen: null, force: false,
  };
  let SM = null; // current summary

  const mname = (id) => { const m = S.house && S.house.members.find((x) => x.id === id); return m ? m.name : 'Former member'; };
  const myMember = () => S.house && S.user && S.house.members.find((m) => m.uid === S.user.uid);
  const isOwner = () => S.house && S.user && S.house.ownerUid === S.user.uid;
  const canEdit = (e) => isOwner() || e.createdBy === (S.user && S.user.uid);
  const money = (n) => `${n < 0 ? '-' : ''}${S.house ? S.house.currency : '€'}${nf.format(Math.abs(n))}`;
  const clampDate = (d) => { const p = S.house.period; return d < p.start ? p.start : d > p.end ? p.end : d; };

  /* ───────────── data wiring ───────────── */
  function detachHouse() {
    S.houseUnsubs.forEach((u) => u()); S.houseUnsubs = [];
    S.entryUnsubs.forEach((u) => u()); S.entryUnsubs = [];
    S.houseId = null; S.house = null; S.bills = []; S.market = []; S.periods = []; S.entriesKey = null;
  }
  function subEntries(hid, p) {
    S.entryUnsubs.forEach((u) => u()); S.entryUnsubs = []; S.bills = []; S.market = [];
    S.entryUnsubs.push(S.store.watchEntries(hid, 'bills', p.start, p.end, (l) => { S.bills = l; render(); }));
    S.entryUnsubs.push(S.store.watchEntries(hid, 'market', p.start, p.end, (l) => { S.market = l; render(); }));
  }
  function attachHouse(hid) {
    detachHouse();
    S.houseId = hid;
    if (!hid) return;
    S.houseUnsubs.push(S.store.watchHouse(hid, (h) => {
      S.house = h;
      if (h) {
        const key = h.period.start + '|' + h.period.end;
        if (key !== S.entriesKey) { S.entriesKey = key; subEntries(hid, h.period); }
      }
      render();
    }));
    S.houseUnsubs.push(S.store.watchPeriods(hid, (l) => { S.periods = l; render(); }));
  }
  function onUser(user) {
    if (S.profileUnsub) { S.profileUnsub(); S.profileUnsub = null; }
    detachHouse();
    S.user = user; S.profile = undefined; S.ready = true; S.tab = 'home'; S.join = null;
    if (!user) S.authTab = 'login';
    if (user) {
      S.profileUnsub = S.store.watchProfile(user.uid, (p) => {
        S.profile = p || null;
        const hid = (p && p.houseId) || null;
        if (hid !== S.houseId) attachHouse(hid);
        render();
      });
    }
    render(true);
  }

  /* ───────────── rendering ───────────── */
  let raf = 0;
  function render(force) {
    if (force) S.force = true;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(doRender);
  }

  function screenName() {
    if (!S.ready) return 'splash';
    if (!S.user) return 'auth';
    if (S.profile === undefined) return 'loading';
    if (!S.profile || !S.profile.houseId) return 'setup';
    if (!S.house) return 'loading';
    return 'main';
  }

  function doRender() {
    const root = $('#app');
    const screen = screenName();
    const sameFormScreen = (screen === 'auth' || screen === 'setup') && screen === S.lastScreen && !S.force;
    if (sameFormScreen) return; // never wipe what the user is typing
    const y = screen === 'main' && S.lastScreen === 'main' ? window.scrollY : 0;
    S.force = false;
    S.lastScreen = screen;
    if (screen === 'main') {
      SM = C.summarize(S.house.members, S.bills, S.market);
      root.innerHTML = viewMain();
    } else if (screen === 'auth') root.innerHTML = viewAuth();
    else if (screen === 'setup') root.innerHTML = viewSetup();
    else root.innerHTML = viewLoading(screen);
    window.scrollTo(0, y);
  }

  const demoBanner = () => (S.store && S.store.mode === 'local'
    ? '<div class="banner">Demo mode — data stays only on this device. Add your Firebase config to share with housemates (see README).</div>' : '');

  function viewLoading(screen) {
    return `<div class="auth"><div class="auth-card center">
      <img class="auth-logo" src="icons/icon.svg" alt="ZiN">
      <p class="muted">${screen === 'splash' ? 'Starting…' : 'Loading your house…'}</p>
      ${screen === 'loading' ? '<button class="link" data-act="logout">Log out</button>' : ''}
    </div></div>`;
  }

  /* ── auth ── */
  function viewAuth() {
    const login = S.authTab === 'login';
    return `<div class="auth"><div class="auth-card">
      <img class="auth-logo" src="icons/icon.svg" alt="ZiN logo">
      <h1 class="auth-title">ZiN <span>Home Accounting</span></h1>
      <p class="tag">Rent, bills &amp; groceries — split fairly, settled clearly.</p>
      ${demoBanner()}
      <div class="seg">
        <button data-act="authtab" data-v="login" class="${login ? 'on' : ''}">Log in</button>
        <button data-act="authtab" data-v="register" class="${login ? '' : 'on'}">Register</button>
      </div>
      ${login ? `
      <form data-form="login" autocomplete="on">
        <label class="field"><span>User ID or email</span><input name="id" autocomplete="username" autocapitalize="none" required></label>
        <label class="field"><span>Password</span><input name="password" type="password" autocomplete="current-password" required></label>
        <div class="err" data-err></div>
        <button class="btn btn-primary btn-block" type="submit">Log in</button>
        <div class="links"><button type="button" class="link" data-act="forgot">Forgot password?</button><button type="button" class="link" data-act="forgotid">Forgot User ID?</button></div>
      </form>` : `
      <form data-form="register" autocomplete="on">
        <label class="field"><span>Email</span><input name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>Choose a User ID</span><input name="userId" autocomplete="username" autocapitalize="none" placeholder="e.g. zin.home" required><small>3–20 characters: letters, numbers, . - _</small></label>
        <label class="field"><span>Password</span><input name="password" type="password" autocomplete="new-password" minlength="6" required></label>
        <label class="field"><span>Confirm password</span><input name="password2" type="password" autocomplete="new-password" minlength="6" required></label>
        <div class="err" data-err></div>
        <button class="btn btn-primary btn-block" type="submit">Create account</button>
        <p class="hint">You'll use your User ID to log in. If you forget it, log in with your email instead.</p>
      </form>`}
    </div></div>`;
  }

  /* ── house setup ── */
  function viewSetup() {
    const start = todayISO();
    const end = C.addDaysISO(C.addMonthsISO(start, 1), -1);
    const uid = S.profile && S.profile.userId;
    return `<div class="setup">
      <div class="setup-head"><img src="icons/icon.svg" alt="ZiN" width="44" height="44"><div><b>Welcome${uid ? ', ' + esc(uid) : ''}</b><div class="muted">Set up or join your house to get started.</div></div>
        <button class="link" data-act="logout">Log out</button></div>
      ${demoBanner()}
      <div class="card">
        <h2>Create a new house</h2>
        <form data-form="createHouse">
          <label class="field"><span>House name</span><input name="name" placeholder="e.g. Via Roma 12" required></label>
          <label class="field"><span>Your name (as housemates see it)</span><input name="myName" required></label>
          <label class="field"><span>Currency</span><select name="currency">${CURRENCIES.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select></label>
          <div class="grid2">
            <label class="field"><span>Month starts</span><input name="start" type="date" value="${start}" required></label>
            <label class="field"><span>Month ends</span><input name="end" type="date" value="${end}" required></label>
          </div>
          <p class="hint">Example: 10 Oct → 10 Nov counts as one month. You can change these dates later.</p>
          <div class="err" data-err></div>
          <button class="btn btn-primary btn-block" type="submit">Create house</button>
        </form>
      </div>
      <div class="card">
        <h2>Join your housemates</h2>
        <p class="muted">Ask the house owner for the invite code (Settings → Invite housemates).</p>
        <div id="joinBox">${joinStep1()}</div>
      </div>
    </div>`;
  }
  const joinStep1 = () => `<form data-form="peek" class="inline-form">
      <input name="code" placeholder="Invite code" autocapitalize="characters" required>
      <button class="btn btn-primary" type="submit">Find</button>
    </form><div class="err" data-err></div>`;
  function joinStep2() {
    const j = S.join;
    const free = j.members.filter((m) => !m.uid);
    return `<form data-form="join">
      <p><b>${esc(j.name)}</b> — who are you?</p>
      <div class="radios">
        ${free.map((m, i) => `<label class="radio"><input type="radio" name="who" value="${esc(m.id)}" ${i === 0 ? 'checked' : ''}><span>${esc(m.name)}</span></label>`).join('')}
        <label class="radio"><input type="radio" name="who" value="__new" ${free.length ? '' : 'checked'}><span>I'm not listed — add me</span></label>
      </div>
      <label class="field" id="newNameField"><span>Your name</span><input name="newName"></label>
      <div class="err" data-err></div>
      <div class="row-btns"><button type="button" class="btn btn-ghost" data-act="joinback">Back</button><button class="btn btn-primary" type="submit">Join house</button></div>
    </form>`;
  }

  /* ── main shell ── */
  function viewMain() {
    const H = S.house, p = H.period;
    const tabs = [['home', 'Home', 'home'], ['bills', 'Bills', 'bills'], ['market', 'Market', 'cart'], ['settle', 'Settle', 'users'], ['history', 'History', 'clock']];
    const views = { home: viewHome, bills: viewBills, market: viewMarket, settle: viewSettle, history: viewHistory, settings: viewSettings };
    const left = C.daysBetween(todayISO(), p.end);
    const chip = left < 0 ? 'Period ended' : left === 0 ? 'Last day' : `${left} day${left === 1 ? '' : 's'} left`;
    const fab = S.tab === 'bills' || S.tab === 'market'
      ? `<button class="fab" data-act="${S.tab === 'bills' ? 'addbill' : 'addmarket'}" aria-label="Add">${ic('plus')}<span>${S.tab === 'bills' ? 'Add bill' : 'Add market'}</span></button>` : '';
    return `<header class="top">
        <div class="brand"><img src="icons/icon.svg" alt="" width="36" height="36"><div><b>ZiN</b> <span>Home Accounting</span><div class="house-name">${esc(H.name)}</div></div></div>
        <div class="top-r"><span class="chip ${left < 0 ? 'warn' : ''}">${fmtShort(p.start)} → ${fmtShort(p.end)} · ${chip}</span>
        <button class="icon-btn ${S.tab === 'settings' ? 'on' : ''}" data-act="tab" data-v="settings" aria-label="Settings">${ic('sliders')}</button></div>
      </header>
      ${S.store.mode === 'local' ? demoBanner() : ''}
      <main class="view">${views[S.tab]()}</main>
      ${fab}
      <nav class="nav">${tabs.map(([k, l, i]) => `<button data-act="tab" data-v="${k}" class="${S.tab === k ? 'on' : ''}">${ic(i)}<span>${l}</span></button>`).join('')}</nav>`;
  }

  const badge = (bal) => bal > 0.004 ? `<span class="badge pos">Gets ${money(bal)}</span>`
    : bal < -0.004 ? `<span class="badge neg">Owes ${money(-bal)}</span>` : '<span class="badge even">Settled</span>';
  const pname = (p) => (p.known ? esc(mname(p.id)) : 'Former member');
  const xfer = (t) => {
    const me = myMember();
    const mine = me && (t.from === me.id || t.to === me.id);
    return `<div class="xfer ${mine ? 'mine' : ''}"><b>${esc(mname(t.from))}</b><span class="arr">${ic('arrow')}</span><b>${esc(mname(t.to))}</b><span class="amt">${money(t.amount)}</span></div>`;
  };
  const acc = (key, head, body) => `<details class="acc" data-key="${esc(key)}" ${S.open[key] ? 'open' : ''}><summary>${head}<span class="chev">${ic('chev')}</span></summary><div class="acc-body">${body}</div></details>`;
  const empty = (t, s) => `<div class="empty"><b>${t}</b><p>${s}</p></div>`;

  /* ── Home ── */
  function viewHome() {
    const H = S.house, p = H.period;
    const total = C.daysBetween(p.start, p.end) + 1;
    const done = Math.max(0, Math.min(total, C.daysBetween(p.start, todayISO()) + 1));
    const left = C.daysBetween(todayISO(), p.end);
    const me = myMember();
    const mine = me && SM.people.find((x) => x.id === me.id);
    const avg = H.members.length ? SM.grandTotal / H.members.length : 0;
    return `
      <div class="card hero">
        <div class="hero-top"><div><div class="k">Current month</div><div class="hero-dates">${fmtDate(p.start)} → ${fmtDate(p.end)}</div></div>
        <span class="chip ${left < 0 ? 'warn' : ''}">${left < 0 ? `Ended ${-left} day${left === -1 ? '' : 's'} ago` : left === 0 ? 'Last day' : `${left} days left`}</span></div>
        <div class="bar"><i style="width:${Math.round((done / total) * 100)}%"></i></div>
        ${left < 0 && isOwner() ? `<div class="notice">This month is over. <button class="link" data-act="closeperiod">Close it &amp; save PDF</button></div>` : ''}
      </div>
      <div class="stats">
        <div class="stat"><div class="k">Bills</div><div class="v">${money(SM.billsTotal)}</div></div>
        <div class="stat"><div class="k">Market</div><div class="v">${money(SM.marketTotal)}</div></div>
        <div class="stat strong"><div class="k">Total</div><div class="v">${money(SM.grandTotal)}</div></div>
        <div class="stat"><div class="k">Average / person</div><div class="v">${money(avg)}</div></div>
      </div>
      ${mine ? `<div class="card">
        <div class="title-row"><h2>${esc(me.name)}, your position</h2>${badge(mine.balance)}</div>
        <div class="kv"><span>You paid</span><b>${money(mine.paid)}</b></div>
        <div class="kv"><span>Your share</span><b>${money(mine.share)}</b></div>
        ${mine.pays.map((x) => `<div class="kv neg"><span>You pay ${esc(mname(x.to))}</span><b>${money(x.amount)}</b></div>`).join('')}
        ${mine.receives.map((x) => `<div class="kv pos"><span>${esc(mname(x.from))} pays you</span><b>${money(x.amount)}</b></div>`).join('')}
      </div>` : ''}
      <div class="card">
        <div class="title-row"><h2>Who pays whom</h2></div>
        ${SM.transfers.length ? SM.transfers.map(xfer).join('') : '<p class="muted">Nothing to settle yet. Add bills and market entries.</p>'}
      </div>
      <div class="row-btns wrap">
        <button class="btn btn-primary" data-act="addbill">${ic('plus')} Add bill</button>
        <button class="btn btn-primary" data-act="addmarket">${ic('plus')} Add market</button>
        <button class="btn btn-ghost" data-act="pdfnow">${ic('download')} PDF preview</button>
      </div>`;
  }

  /* ── Bills ── */
  function entryRow(kind, e, serial) {
    const who = Object.keys(e.shares || {}).map(mname);
    const splitTxt = who.length === S.house.members.length ? 'Everyone' : who.map(esc).join(', ');
    const acts = canEdit(e) ? `<div class="row-act"><button class="icon-btn sm" data-act="edit${kind}" data-id="${esc(e.id)}" aria-label="Edit">${ic('edit')}</button><button class="icon-btn sm danger" data-act="del" data-kind="${kind}" data-id="${esc(e.id)}" aria-label="Delete">${ic('trash')}</button></div>` : '';
    return `<div class="row">
      ${serial != null ? `<div class="serial">${serial}</div>` : ''}
      <div class="row-main"><div class="row-top"><b>${money(e.amount)}</b><span class="sub">${fmtShort(e.date)}</span></div>
        <div class="sub">${kind === 'market' && e.note ? esc(e.note) + ' · ' : kind === 'bills' && e.note ? esc(e.note) + ' · ' : ''}paid by ${esc(mname(e.paidBy))}</div>
        <div class="sub">Split: ${splitTxt}</div></div>${acts}</div>`;
  }

  function viewBills() {
    const list = S.bills;
    if (!list.length) return `<div class="title-row"><h1>Bills</h1></div>${empty('No bills yet', 'Add rent, electricity, gas, wifi… Each one is split among the people you choose.')}`;
    const groups = {};
    list.forEach((b) => { const k = b.category || 'Other'; (groups[k] = groups[k] || []).push(b); });
    const order = [...PRESETS.filter((c) => groups[c]), ...Object.keys(groups).filter((c) => !PRESETS.includes(c)).sort()];
    return `<div class="title-row"><h1>Bills</h1><span class="total-pill">${money(SM.billsTotal)}</span></div>` + order.map((cat) => {
      const items = groups[cat];
      const sum = items.reduce((a, b) => a + C.toCents(b.amount), 0) / 100;
      const sh = {};
      items.forEach((b) => Object.entries(b.shares || {}).forEach(([id, v]) => (sh[id] = (sh[id] || 0) + C.toCents(v))));
      const shares = Object.entries(sh).map(([id, c]) => `<div class="share"><span>${esc(mname(id))}</span><b>${money(c / 100)}</b></div>`).join('');
      return acc('bill:' + cat,
        `<div class="acc-t"><b>${esc(cat)}</b><span class="sub">${items.length} entr${items.length === 1 ? 'y' : 'ies'}</span></div><div class="acc-total">${money(sum)}</div>`,
        `<div class="share-grid">${shares}</div>${items.map((b) => entryRow('bills', b)).join('')}`);
    }).join('');
  }

  /* ── Market ── */
  function viewMarket() {
    const seg = `<div class="seg sm"><button data-act="mview" data-v="person" class="${S.mview === 'person' ? 'on' : ''}">By person</button><button data-act="mview" data-v="date" class="${S.mview === 'date' ? 'on' : ''}">By date</button></div>`;
    const head = `<div class="title-row"><h1>Market</h1><span class="total-pill">${money(SM.marketTotal)}</span></div>${seg}`;
    if (!S.market.length) return head + empty('No market entries yet', 'Anyone can add what they bought — it goes under their name with date and serial.');
    if (S.mview === 'date') {
      const byDate = {};
      S.market.forEach((e) => (byDate[e.date] = byDate[e.date] || []).push(e));
      let n = 0;
      return head + Object.keys(byDate).sort().map((d) => {
        const items = byDate[d];
        const sum = items.reduce((a, e) => a + C.toCents(e.amount), 0) / 100;
        return acc('mdate:' + d, `<div class="acc-t"><b>${fmtDate(d)}</b><span class="sub">${items.length} entr${items.length === 1 ? 'y' : 'ies'}</span></div><div class="acc-total">${money(sum)}</div>`,
          items.map((e) => { n++; return entryRow('market', e, n); }).join(''));
      }).join('');
    }
    const ids = [...S.house.members.map((m) => m.id)];
    S.market.forEach((e) => { if (!ids.includes(e.paidBy)) ids.push(e.paidBy); });
    return head + ids.map((id) => {
      const items = S.market.filter((e) => e.paidBy === id);
      const sum = items.reduce((a, e) => a + C.toCents(e.amount), 0) / 100;
      return acc('mp:' + id, `<div class="acc-t"><b>${esc(mname(id))}</b><span class="sub">${items.length} entr${items.length === 1 ? 'y' : 'ies'}</span></div><div class="acc-total">${money(sum)}</div>`,
        items.length ? items.map((e, i) => entryRow('market', e, i + 1)).join('') : '<p class="muted pad">Nothing bought yet.</p>');
    }).join('');
  }

  /* ── Settle ── */
  function viewSettle() {
    const maxPaid = Math.max(1, ...SM.people.map((p) => p.paid));
    return `<div class="title-row"><h1>Settle up</h1><span class="total-pill">${money(SM.grandTotal)}</span></div>
      <div class="card"><h2>Who pays whom</h2>${SM.transfers.length ? SM.transfers.map(xfer).join('') : '<p class="muted">All settled — or nothing added yet.</p>'}
      <p class="hint">Fewest possible payments between housemates.</p></div>
      <h2 class="sec">Each person</h2>
      ${SM.people.map((p) => acc('set:' + p.id,
        `<div class="acc-t"><b>${pname(p)}</b><span class="sub">paid ${money(p.paid)} · share ${money(p.share)}</span></div><div>${badge(p.balance)}</div>`,
        `<div class="mini-bar"><i style="width:${Math.round((p.paid / maxPaid) * 100)}%"></i></div>
         <div class="kv"><span>Paid — bills</span><b>${money(p.paidBills)}</b></div>
         <div class="kv"><span>Paid — market</span><b>${money(p.paidMarket)}</b></div>
         <div class="kv total"><span>Total paid</span><b>${money(p.paid)}</b></div>
         <div class="kv"><span>Share — bills</span><b>${money(p.shareBills)}</b></div>
         <div class="kv"><span>Share — market</span><b>${money(p.shareMarket)}</b></div>
         <div class="kv total"><span>Total share</span><b>${money(p.share)}</b></div>
         ${p.pays.map((x) => `<div class="kv neg"><span>Will give ${esc(mname(x.to))}</span><b>${money(x.amount)}</b></div>`).join('')}
         ${p.receives.map((x) => `<div class="kv pos"><span>Will get from ${esc(mname(x.from))}</span><b>${money(x.amount)}</b></div>`).join('')}
         ${!p.pays.length && !p.receives.length ? '<div class="kv"><span>Nothing to pay or receive</span><b>✓</b></div>' : ''}`)).join('')}`;
  }

  /* ── History ── */
  function viewHistory() {
    if (!S.periods.length) return `<div class="title-row"><h1>History</h1></div>${empty('No closed months yet', 'When you close a month (Settings → Close month), its full account is saved here as a PDF you can open any time.')}`;
    return `<div class="title-row"><h1>History</h1></div>` + S.periods.map((p) => `<div class="card hist">
      <div><b>${fmtDate(p.start)} → ${fmtDate(p.end)}</b><div class="sub">Total ${money(p.summary.grandTotal)} · Bills ${money(p.summary.billsTotal)} · Market ${money(p.summary.marketTotal)}</div>
      <div class="sub">Closed ${p.closedAt ? fmtDate(C.fmtISO(new Date(p.closedAt))) : ''}</div></div>
      <div class="row-btns"><button class="btn btn-ghost btn-sm" data-act="histview" data-id="${esc(p.id)}">View</button><button class="btn btn-primary btn-sm" data-act="histpdf" data-id="${esc(p.id)}">${ic('download')} PDF</button></div></div>`).join('');
  }

  /* ── Settings ── */
  function viewSettings() {
    const H = S.house, owner = isOwner();
    const dis = owner ? '' : 'disabled';
    const memberRows = H.members.map((m) => {
      const used = S.bills.some((b) => b.paidBy === m.id || (b.shares || {})[m.id] != null) || S.market.some((e) => e.paidBy === m.id || (e.shares || {})[m.id] != null);
      return `<div class="row"><div class="row-main"><b>${esc(m.name)}</b> ${m.uid ? '<span class="badge even">has account</span>' : '<span class="badge">no account</span>'}${m.uid === (S.user && S.user.uid) ? ' <span class="badge pos">you</span>' : ''}</div>
        ${owner ? `<div class="row-act"><button class="icon-btn sm" data-act="rename" data-id="${esc(m.id)}" aria-label="Rename">${ic('edit')}</button>${!m.uid && !used ? `<button class="icon-btn sm danger" data-act="rmmember" data-id="${esc(m.id)}" aria-label="Remove">${ic('trash')}</button>` : ''}</div>` : ''}</div>`;
    }).join('');
    return `<div class="title-row"><h1>Settings</h1></div>
      <div class="card"><h2>Invite housemates</h2>
        <p class="muted">Share this code. They register, then choose <i>Join your housemates</i>.</p>
        <div class="code-box"><code>${esc(H.id || S.houseId)}</code><button class="btn btn-ghost btn-sm" data-act="copycode">${ic('copy')} Copy</button><button class="btn btn-primary btn-sm" data-act="sharecode">Share</button></div></div>

      <div class="card"><h2>Month dates</h2>
        <form data-form="period"><div class="grid2">
          <label class="field"><span>Starts</span><input name="start" type="date" value="${H.period.start}" ${dis} required></label>
          <label class="field"><span>Ends</span><input name="end" type="date" value="${H.period.end}" ${dis} required></label></div>
          <div class="err" data-err></div>
          ${owner ? '<button class="btn btn-ghost" type="submit">Save dates</button>' : '<p class="hint">Only the house owner can change dates.</p>'}
        </form>
        ${owner ? `<hr><p class="muted">Done with this month? Closing saves everything as a PDF in History and starts the next month.</p><button class="btn btn-danger" data-act="closeperiod">${ic('lock')} Close month &amp; save PDF</button>` : ''}
      </div>

      <div class="card"><h2>Members</h2>${memberRows}
        ${owner ? `<form data-form="addmember" class="inline-form"><input name="name" placeholder="Add a person (name)" required><button class="btn btn-primary" type="submit">Add</button></form>` : ''}
        <p class="hint">Anyone can be added by name — they don't need an account to be part of the split.</p></div>

      <div class="card"><h2>House</h2>
        <form data-form="house"><label class="field"><span>House name</span><input name="name" value="${esc(H.name)}" ${dis} required></label>
          <label class="field"><span>Currency</span><select name="currency" ${dis}>${CURRENCIES.map(([v, l]) => `<option value="${v}" ${H.currency === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
          ${owner ? '<button class="btn btn-ghost" type="submit">Save</button>' : ''}</form></div>

      <div class="card"><h2>Your account</h2>
        <div class="kv"><span>User ID</span><b>${esc(S.profile && S.profile.userId)}</b></div>
        <div class="kv"><span>Email</span><b>${esc((S.profile && S.profile.email) || (S.user && S.user.email))}</b></div>
        <div class="row-btns wrap"><button class="btn btn-ghost" data-act="logout">Log out</button>${owner ? '' : '<button class="btn btn-danger" data-act="leave">Leave house</button>'}</div>
        <p class="hint">Tip: install this app from your browser menu → “Add to Home screen”.</p></div>`;
  }

  /* ───────────── modals ───────────── */
  function openModal(title, body) {
    $('#modal').innerHTML = `<div class="modal-ov" data-act="overlay"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-h"><h2>${esc(title)}</h2><button class="icon-btn sm" data-act="close" aria-label="Close">✕</button></div><div class="modal-b">${body}</div></div></div>`;
    document.body.classList.add('noscroll');
    const f = $('#modal input:not([type=hidden]):not([type=checkbox]):not([type=radio])'); if (f && window.innerWidth > 700) f.focus();
  }
  function closeModal() { $('#modal').innerHTML = ''; document.body.classList.remove('noscroll'); }
  function confirmModal(title, text, label, act, data = {}, danger = true) {
    openModal(title, `<p>${text}</p><div class="row-btns"><button class="btn btn-ghost" data-act="close">Cancel</button>
      <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-act="${act}" ${Object.entries(data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ')}>${label}</button></div>`);
  }

  function entryModal(kind, e) {
    const H = S.house, bill = kind === 'bills';
    const me = myMember();
    const date = e ? e.date : clampDate(todayISO());
    const paidBy = e ? e.paidBy : (me ? me.id : H.members[0].id);
    let mode = 'equal', checked = new Set(H.members.map((m) => m.id)), custom = {};
    if (e) {
      const ids = Object.keys(e.shares || {});
      const eq = C.splitEqual(e.amount, ids);
      if (ids.every((id) => C.toCents(eq[id]) === C.toCents(e.shares[id]))) checked = new Set(ids);
      else { mode = 'custom'; custom = e.shares; }
    }
    const isCustomCat = bill && e && !PRESETS.includes(e.category);
    const body = `<form id="entryForm" data-form="entry" data-kind="${kind}">
      <input type="hidden" name="editId" value="${e ? esc(e.id) : ''}">
      <input type="hidden" name="mode" value="${mode}">
      ${bill ? `<label class="field"><span>Bill type</span><select name="cat">${PRESETS.map((c) => `<option ${e && e.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="__custom" ${isCustomCat ? 'selected' : ''}>Other…</option></select></label>
        <label class="field ${isCustomCat ? '' : 'hidden'}" id="catCustomField"><span>Bill name</span><input name="catCustom" value="${isCustomCat ? esc(e.category) : ''}" placeholder="e.g. Cleaning, Netflix"></label>`
        : `<label class="field"><span>What was bought? <small>(optional)</small></span><input name="note" value="${e ? esc(e.note || '') : ''}" placeholder="e.g. Rice, oil, eggs"></label>`}
      <div class="grid2">
        <label class="field"><span>${bill ? 'Total amount' : 'Amount'} (${esc(H.currency)})</span><input name="amount" type="number" step="0.01" min="0.01" inputmode="decimal" value="${e ? e.amount : ''}" required></label>
        <label class="field"><span>Date</span><input name="date" type="date" min="${H.period.start}" max="${H.period.end}" value="${date}" required></label>
      </div>
      <label class="field"><span>${bill ? 'Paid by' : 'Bought by'}</span><select name="paidBy">${H.members.map((m) => `<option value="${esc(m.id)}" ${m.id === paidBy ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
      ${bill ? `<label class="field"><span>Note <small>(optional)</small></span><input name="note" value="${e ? esc(e.note || '') : ''}"></label>` : ''}
      <div class="split">
        <div class="split-head"><b>Split among</b><div class="seg sm"><button type="button" data-act="splitmode" data-v="equal" class="${mode === 'equal' ? 'on' : ''}">Equal</button><button type="button" data-act="splitmode" data-v="custom" class="${mode === 'custom' ? 'on' : ''}">Custom</button></div></div>
        <div id="splitEqual" class="${mode === 'equal' ? '' : 'hidden'}">
          <div class="chips">${H.members.map((m) => `<label class="chip-check"><input type="checkbox" name="who" value="${esc(m.id)}" ${checked.has(m.id) ? 'checked' : ''}><span>${esc(m.name)}</span></label>`).join('')}</div>
          <div class="mini-links"><button type="button" class="link" data-act="splitall">Select all</button><button type="button" class="link" data-act="splitnone">Clear</button></div>
        </div>
        <div id="splitCustom" class="${mode === 'custom' ? '' : 'hidden'}">
          ${H.members.map((m) => `<div class="cust"><span>${esc(m.name)}</span><input data-cust="${esc(m.id)}" type="number" step="0.01" min="0" inputmode="decimal" value="${custom[m.id] != null ? custom[m.id] : ''}" placeholder="0.00"></div>`).join('')}
        </div>
        <div id="splitNote" class="split-note"></div>
      </div>
      <div class="err" data-err></div>
      <div class="row-btns"><button type="button" class="btn btn-ghost" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">${e ? 'Save changes' : bill ? 'Add bill' : 'Add to market'}</button></div>
    </form>`;
    openModal(e ? (bill ? 'Edit bill' : 'Edit market entry') : (bill ? 'Add bill' : 'Add market entry'), body);
    updateSplitNote();
  }

  function updateSplitNote() {
    const f = $('#entryForm'); if (!f) return;
    const amt = parseAmt(f.elements.amount.value), mode = f.elements.mode.value, note = $('#splitNote');
    if (mode === 'equal') {
      const n = $$('input[name=who]:checked', f).length;
      note.className = 'split-note';
      note.textContent = !n ? 'Select at least one person.' : amt > 0 ? `Each pays ${money(amt / n)} (${n} ${n === 1 ? 'person' : 'people'})` : '';
    } else {
      let sum = 0; $$('input[data-cust]', f).forEach((i) => (sum += C.toCents(parseAmt(i.value))));
      const diff = C.toCents(amt) - sum;
      note.className = 'split-note ' + (diff === 0 && amt > 0 ? 'ok' : 'bad');
      note.textContent = amt <= 0 ? 'Enter the total amount first.' : diff === 0 ? '✓ Amounts add up to the total' : `${diff > 0 ? 'Still to assign' : 'Over by'}: ${money(Math.abs(diff) / 100)}`;
    }
  }

  async function submitEntry(f) {
    const el = f.elements, kind = f.dataset.kind, bill = kind === 'bills', H = S.house;
    const fail = (m) => { $('[data-err]', f).textContent = m; };
    const amount = parseAmt(el.amount.value);
    if (!(amount > 0)) return fail('Enter an amount greater than 0.');
    const date = el.date.value;
    if (!date || date < H.period.start || date > H.period.end) return fail(`Date must be inside this month (${fmtShort(H.period.start)} → ${fmtShort(H.period.end)}).`);
    let shares;
    if (el.mode.value === 'equal') {
      const ids = $$('input[name=who]:checked', f).map((i) => i.value);
      if (!ids.length) return fail('Select at least one person to split with.');
      shares = C.splitEqual(amount, ids);
    } else {
      shares = {}; let sum = 0;
      $$('input[data-cust]', f).forEach((i) => { const v = parseAmt(i.value); if (v > 0) { shares[i.dataset.cust] = C.fromCents(C.toCents(v)); sum += C.toCents(v); } });
      if (!Object.keys(shares).length) return fail('Enter at least one amount.');
      if (sum !== C.toCents(amount)) return fail(`Custom amounts add up to ${money(sum / 100)}, but the total is ${money(amount)}.`);
    }
    const editId = el.editId.value;
    const old = editId && (bill ? S.bills : S.market).find((x) => x.id === editId);
    const entry = { date, amount: C.fromCents(C.toCents(amount)), paidBy: el.paidBy.value, shares, note: (el.note.value || '').trim(), createdBy: old ? old.createdBy : S.user.uid };
    if (bill) {
      const cat = el.cat.value === '__custom' ? (el.catCustom.value || '').trim() : el.cat.value;
      if (!cat) return fail('Give this bill a name.');
      entry.category = cat;
    }
    if (editId) entry.id = editId;
    await S.store.saveEntry(S.houseId, kind, entry);
    closeModal(); toast(editId ? 'Saved ✓' : 'Added ✓');
  }

  /* ───────────── actions ───────────── */
  async function closePeriod() {
    const H = S.house, p = H.period;
    const snap = {
      id: `p_${p.start}_${p.end}_${Date.now().toString(36)}`, start: p.start, end: p.end,
      closedAt: new Date().toISOString(), closedBy: S.user.uid, houseName: H.name, currency: H.currency,
      members: H.members.map((m) => ({ id: m.id, name: m.name })),
      bills: JSON.parse(JSON.stringify(S.bills)), market: JSON.parse(JSON.stringify(S.market)),
      summary: JSON.parse(JSON.stringify(SM)),
    };
    const next = C.nextPeriod(p.end);
    await S.store.closePeriod(S.houseId, snap, next);
    closeModal();
    S.tab = 'history';
    try { window.ZinPDF.download(snap); toast(`Month closed. PDF saved. New month: ${fmtShort(next.start)} → ${fmtShort(next.end)}`, 5000); }
    catch (e) { toast('Month closed and saved in History, but the PDF failed: ' + e.message, 6000); }
  }

  function histModal(p) {
    const sm = p.summary, nm = (id) => { const m = p.members.find((x) => x.id === id); return m ? esc(m.name) : 'Former member'; };
    const m = (n) => `${p.currency}${nf.format(Math.abs(n))}`;
    openModal(`${fmtShort(p.start)} → ${fmtShort(p.end)}`, `
      <div class="stats"><div class="stat"><div class="k">Bills</div><div class="v">${m(sm.billsTotal)}</div></div><div class="stat"><div class="k">Market</div><div class="v">${m(sm.marketTotal)}</div></div><div class="stat strong"><div class="k">Total</div><div class="v">${m(sm.grandTotal)}</div></div></div>
      <h3>Who paid whom</h3>${sm.transfers.length ? sm.transfers.map((t) => `<div class="xfer"><b>${nm(t.from)}</b><span class="arr">${ic('arrow')}</span><b>${nm(t.to)}</b><span class="amt">${m(t.amount)}</span></div>`).join('') : '<p class="muted">Everything was settled.</p>'}
      <h3>Per person</h3>${sm.people.map((x) => `<div class="kv"><span>${nm(x.id)} <small class="muted">paid ${m(x.paid)} · share ${m(x.share)}</small></span><b class="${x.balance > 0.004 ? 'pos' : x.balance < -0.004 ? 'neg' : ''}">${x.balance > 0.004 ? 'Gets ' : x.balance < -0.004 ? 'Owed ' : ''}${m(x.balance)}</b></div>`).join('')}
      <div class="row-btns"><button class="btn btn-ghost" data-act="close">Close</button><button class="btn btn-primary" data-act="histpdf" data-id="${esc(p.id)}">${ic('download')} Download PDF</button></div>`);
  }

  function currentSnapshot() {
    const H = S.house, p = H.period;
    return { id: 'preview', start: p.start, end: p.end, closedAt: null, houseName: H.name, currency: H.currency,
      members: H.members.map((m) => ({ id: m.id, name: m.name })), bills: S.bills, market: S.market, summary: SM };
  }

  async function guard(fn, btn) {
    if (btn) btn.disabled = true;
    try { await fn(); } catch (e) { console.error(e); toast(e.message || 'Something went wrong.', 5000); }
    finally { if (btn) btn.disabled = false; }
  }

  document.addEventListener('click', (ev) => {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    const a = t.dataset.act, id = t.dataset.id;
    if (a === 'overlay') { if (ev.target === t) closeModal(); return; }
    switch (a) {
      case 'close': closeModal(); break;
      case 'tab': S.tab = t.dataset.v; render(true); window.scrollTo(0, 0); break;
      case 'authtab': S.authTab = t.dataset.v; render(true); break;
      case 'mview': S.mview = t.dataset.v; render(); break;
      case 'logout': guard(() => S.store.logout()); break;
      case 'forgot':
        openModal('Reset password', `<form data-form="forgot"><p class="muted">We'll email you a link to set a new password.</p>
          <label class="field"><span>Your email</span><input name="email" type="email" required></label><div class="err" data-err></div>
          <div class="row-btns"><button type="button" class="btn btn-ghost" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Send link</button></div></form>`);
        break;
      case 'forgotid':
        openModal('Forgot your User ID?', `<p>No problem — log in with your <b>email</b> and password instead of the User ID.</p>
          <p>Once you're in, your User ID is shown under <b>Settings → Your account</b>.</p>
          <div class="row-btns"><button class="btn btn-primary" data-act="close">Got it</button></div>`);
        break;
      case 'joinback': S.join = null; $('#joinBox').innerHTML = joinStep1(); break;
      case 'addbill': entryModal('bills'); break;
      case 'addmarket': entryModal('market'); break;
      case 'editbills': entryModal('bills', S.bills.find((x) => x.id === id)); break;
      case 'editmarket': entryModal('market', S.market.find((x) => x.id === id)); break;
      case 'del': confirmModal('Delete this entry?', 'This cannot be undone.', 'Delete', 'delok', { kind: t.dataset.kind, id }); break;
      case 'delok': guard(async () => { await S.store.deleteEntry(S.houseId, t.dataset.kind, id); closeModal(); toast('Deleted'); }, t); break;
      case 'splitmode': {
        const f = $('#entryForm'); f.elements.mode.value = t.dataset.v;
        $$('.split-head .seg button', f).forEach((b) => b.classList.toggle('on', b === t));
        $('#splitEqual').classList.toggle('hidden', t.dataset.v !== 'equal');
        $('#splitCustom').classList.toggle('hidden', t.dataset.v !== 'custom');
        updateSplitNote(); break;
      }
      case 'splitall': $$('#entryForm input[name=who]').forEach((i) => (i.checked = true)); updateSplitNote(); break;
      case 'splitnone': $$('#entryForm input[name=who]').forEach((i) => (i.checked = false)); updateSplitNote(); break;
      case 'copycode': {
        const code = S.houseId;
        (navigator.clipboard ? navigator.clipboard.writeText(code) : Promise.reject()).then(() => toast('Code copied'), () => window.prompt('Copy this code:', code));
        break;
      }
      case 'sharecode': {
        const text = `Join our house "${S.house.name}" on ZiN Home Accounting.\n1) Open ${location.origin}${location.pathname}\n2) Register\n3) Choose "Join your housemates" and enter this code: ${S.houseId}`;
        if (navigator.share) navigator.share({ title: 'ZiN Home Accounting', text }).catch(() => {});
        else (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Invite message copied'), () => window.prompt('Copy this message:', text));
        break;
      }
      case 'rename': {
        const m = S.house.members.find((x) => x.id === id);
        openModal('Rename', `<form data-form="rename"><input type="hidden" name="id" value="${esc(id)}"><label class="field"><span>Name</span><input name="name" value="${esc(m.name)}" required></label><div class="err" data-err></div>
          <div class="row-btns"><button type="button" class="btn btn-ghost" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div></form>`);
        break;
      }
      case 'rmmember': confirmModal('Remove this person?', `${esc(mname(id))} will be removed from the member list.`, 'Remove', 'rmok', { id }); break;
      case 'rmok': guard(async () => { await S.store.updateHouse(S.houseId, { members: S.house.members.filter((m) => m.id !== id) }); closeModal(); toast('Removed'); }, t); break;
      case 'closeperiod': {
        const p = S.house.period, early = C.daysBetween(todayISO(), p.end) >= 0;
        const next = C.nextPeriod(p.end);
        confirmModal('Close this month?',
          `<b>${fmtDate(p.start)} → ${fmtDate(p.end)}</b><br>Total <b>${money(SM.grandTotal)}</b> will be saved as a PDF and kept in History.<br>The next month will run <b>${fmtDate(next.start)} → ${fmtDate(next.end)}</b>.${early ? '<br><br>⚠ This month has not ended yet.' : ''}`,
          'Close &amp; save PDF', 'closeok', {}, false);
        break;
      }
      case 'closeok': guard(closePeriod, t); break;
      case 'pdfnow': guard(async () => window.ZinPDF.download(currentSnapshot()), t); break;
      case 'histview': histModal(S.periods.find((x) => x.id === id)); break;
      case 'histpdf': guard(async () => window.ZinPDF.download(S.periods.find((x) => x.id === id)), t); break;
      case 'leave': confirmModal('Leave this house?', 'You can join again later with the invite code.', 'Leave', 'leaveok'); break;
      case 'leaveok': guard(async () => { await S.store.leaveHouse(S.houseId); closeModal(); }, t); break;
      default: break;
    }
  });

  document.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name === 'cat') $('#catCustomField').classList.toggle('hidden', t.value !== '__custom');
    if (t.name === 'who') updateSplitNote();
    if (t.name === 'who' && t.type === 'radio') $('#newNameField').classList.toggle('hidden', t.value !== '__new');
  });
  document.addEventListener('input', (ev) => { if (ev.target.closest && ev.target.closest('#entryForm')) updateSplitNote(); });
  document.addEventListener('toggle', (ev) => { const d = ev.target; if (d.dataset && d.dataset.key) S.open[d.dataset.key] = d.open; }, true);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && $('#modal .modal')) closeModal(); });

  document.addEventListener('submit', (ev) => {
    const f = ev.target.closest('form[data-form]'); if (!f) return;
    ev.preventDefault();
    const name = f.dataset.form, fd = Object.fromEntries(new FormData(f));
    const errBox = $('[data-err]', f), btn = $('button[type=submit]', f);
    const fail = (m) => { if (errBox) errBox.textContent = m; };
    if (errBox) errBox.textContent = '';
    const run = async () => {
      switch (name) {
        case 'login': await S.store.login({ id: fd.id, password: fd.password }); break;
        case 'register':
          if (fd.password !== fd.password2) return fail('Passwords do not match.');
          await S.store.register({ email: fd.email, userId: fd.userId, password: fd.password }); break;
        case 'forgot': await S.store.resetPassword(fd.email); closeModal(); toast('If that email has an account, a reset link is on its way.', 5000); break;
        case 'createHouse': {
          if (fd.start > fd.end) return fail('The month must end after it starts.');
          await S.store.createHouse({ name: fd.name.trim(), myName: fd.myName.trim(), currency: fd.currency, period: { start: fd.start, end: fd.end } });
          S.tab = 'home'; break;
        }
        case 'peek': {
          const code = fd.code.trim().toUpperCase();
          const h = await S.store.peekHouse(code);
          S.join = { code, name: h.name, members: h.members };
          $('#joinBox').innerHTML = joinStep2();
          $('#newNameField').classList.toggle('hidden', $('input[name=who]:checked').value !== '__new');
          break;
        }
        case 'join': {
          const isNew = fd.who === '__new';
          if (isNew && !(fd.newName || '').trim()) return fail('Please enter your name.');
          await S.store.joinHouse(S.join.code, isNew ? { newName: fd.newName.trim() } : { memberId: fd.who });
          S.join = null; S.tab = 'home'; break;
        }
        case 'entry': await submitEntry(f); break;
        case 'period':
          if (fd.start > fd.end) return fail('The month must end after it starts.');
          await S.store.updateHouse(S.houseId, { period: { start: fd.start, end: fd.end } });
          toast('Dates saved. Entries outside these dates are hidden, not deleted.', 4500); break;
        case 'house': await S.store.updateHouse(S.houseId, { name: fd.name.trim(), currency: fd.currency }); toast('Saved ✓'); break;
        case 'addmember':
          await S.store.updateHouse(S.houseId, { members: [...S.house.members, { id: newId(), name: fd.name.trim() }] });
          f.reset(); toast('Person added'); break;
        case 'rename':
          await S.store.updateHouse(S.houseId, { members: S.house.members.map((m) => (m.id === fd.id ? { ...m, name: fd.name.trim() } : m)) });
          closeModal(); toast('Renamed'); break;
        default: break;
      }
    };
    if (btn) btn.disabled = true;
    run().catch((e) => { console.debug(e); fail(e.message || 'Something went wrong.'); })
      .finally(() => { if (btn) btn.disabled = false; });
  });

  /* ───────────── boot ───────────── */
  render();
  S.store = await window.ZinStoreFactory();
  S.store.onAuth(onUser);
  await S.store.init();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('error', (e) => console.error(e.error || e.message));
})();
