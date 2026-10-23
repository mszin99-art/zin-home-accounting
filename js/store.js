/* ZiN Home Accounting — data layer.
   Two backends with the same API:
     • Firebase (Auth + Firestore) when window.ZIN_FIREBASE is set
     • Local demo (localStorage) otherwise
*/
(function () {
  'use strict';

  const FB_VERSION = '10.12.2';
  const ID_RE = /^[a-z0-9_.-]{3,20}$/;

  const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
  const genCode = (n = 10) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const a = new Uint32Array(n);
    crypto.getRandomValues(a);
    return Array.from(a, (x) => chars[x % chars.length]).join('');
  };
  const clean = (o) => JSON.parse(JSON.stringify(o));
  const sortEntries = (a) => a.sort((x, y) => (x.date || '').localeCompare(y.date || '') || (x.createdAt || 0) - (y.createdAt || 0));
  const err = (m) => new Error(m);

  function validateRegistration({ email, userId, password }) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '')) throw err('Please enter a valid email address.');
    if (!ID_RE.test((userId || '').toLowerCase())) throw err('User ID must be 3–20 characters: letters, numbers, dot, dash or underscore.');
    if (!password || password.length < 6) throw err('Password must be at least 6 characters.');
  }

  /* ───────────────────────── LOCAL DEMO BACKEND ───────────────────────── */
  function createLocalStore() {
    const KEY = 'zin_home_demo_v1';
    const load = () => {
      try { return JSON.parse(localStorage.getItem(KEY)) || { users: {}, houses: {}, session: null }; }
      catch (e) { return { users: {}, houses: {}, session: null }; }
    };
    let db = load();
    const save = () => localStorage.setItem(KEY, JSON.stringify(db));
    const watchers = new Set();
    const authCbs = new Set();
    const emit = () => watchers.forEach((w) => w());
    const emitAuth = () => {
      const u = db.session && db.users[db.session];
      authCbs.forEach((cb) => cb(u ? { uid: u.uid, email: u.email } : null));
    };
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) { db = load(); emit(); emitAuth(); }
    });
    const watch = (fn) => { watchers.add(fn); queueMicrotask(fn); return () => watchers.delete(fn); };

    async function hash(userId, password) {
      const data = new TextEncoder().encode(userId + '|' + password);
      if (crypto.subtle) {
        const buf = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
      }
      return btoa(userId + '|' + password);
    }
    const me = () => { if (!db.session) throw err('Not signed in.'); return db.users[db.session]; };
    const house = (id) => { const h = db.houses[id]; if (!h) throw err('House not found.'); return h; };

    return {
      mode: 'local',
      async init() { emitAuth(); },
      onAuth(cb) { authCbs.add(cb); queueMicrotask(() => { const u = db.session && db.users[db.session]; cb(u ? { uid: u.uid, email: u.email } : null); }); },
      async register({ email, userId, password }) {
        validateRegistration({ email, userId, password });
        const id = userId.toLowerCase();
        email = email.trim().toLowerCase();
        if (Object.values(db.users).some((u) => u.userId === id)) throw err('This User ID is already taken.');
        if (Object.values(db.users).some((u) => u.email === email)) throw err('An account with this email already exists.');
        const uid = 'u_' + newId();
        db.users[uid] = { uid, email, userId: id, houseId: null, hash: await hash(id, password) };
        db.session = uid; save(); emitAuth(); emit();
      },
      async login({ id, password }) {
        id = (id || '').trim().toLowerCase();
        const u = Object.values(db.users).find((x) => x.userId === id || x.email === id);
        if (!u || u.hash !== (await hash(u.userId, password))) throw err('Wrong User ID / email or password.');
        db.session = u.uid; save(); emitAuth(); emit();
      },
      async logout() { db.session = null; save(); emitAuth(); emit(); },
      async resetPassword() {
        throw err('Password reset emails need Firebase. In demo mode, create a new account instead.');
      },
      watchProfile(uid, cb) {
        return watch(() => { const u = db.users[uid]; cb(u ? { userId: u.userId, email: u.email, houseId: u.houseId || null } : null); });
      },
      async peekHouse(code) {
        const h = db.houses[(code || '').trim().toUpperCase()];
        if (!h) throw err('No house found with this code.');
        return clean({ name: h.name, members: h.members });
      },
      async createHouse({ name, currency, period, myName }) {
        const u = me();
        const id = genCode(10);
        const mid = newId();
        db.houses[id] = {
          id, name, currency, period, ownerUid: u.uid, memberUids: [u.uid],
          members: [{ id: mid, name: myName, uid: u.uid }], createdAt: Date.now(),
          bills: {}, market: {}, periods: {},
        };
        u.houseId = id; save(); emit();
        return id;
      },
      async joinHouse(code, { memberId, newName }) {
        const u = me();
        code = (code || '').trim().toUpperCase();
        const h = house(code);
        if (!h.memberUids.includes(u.uid)) h.memberUids.push(u.uid);
        if (memberId) {
          const m = h.members.find((x) => x.id === memberId);
          if (!m) throw err('Member not found.');
          if (m.uid && m.uid !== u.uid) throw err('That name is already linked to another account.');
          m.uid = u.uid;
        } else if (!h.members.some((x) => x.uid === u.uid)) {
          if (!newName) throw err('Please enter your name.');
          h.members.push({ id: newId(), name: newName, uid: u.uid });
        }
        u.houseId = code; save(); emit();
      },
      async leaveHouse(houseId) {
        const u = me(); const h = house(houseId);
        h.memberUids = h.memberUids.filter((x) => x !== u.uid);
        h.members.forEach((m) => { if (m.uid === u.uid) delete m.uid; });
        u.houseId = null; save(); emit();
      },
      watchHouse(houseId, cb) {
        return watch(() => { const h = db.houses[houseId]; cb(h ? clean({ ...h, bills: undefined, market: undefined, periods: undefined }) : null); });
      },
      watchEntries(houseId, kind, start, end, cb) {
        return watch(() => {
          const h = db.houses[houseId]; if (!h) return cb([]);
          cb(clean(sortEntries(Object.values(h[kind]).filter((e) => e.date >= start && e.date <= end))));
        });
      },
      watchPeriods(houseId, cb) {
        return watch(() => {
          const h = db.houses[houseId]; if (!h) return cb([]);
          cb(clean(Object.values(h.periods).sort((a, b) => b.start.localeCompare(a.start))));
        });
      },
      async updateHouse(houseId, patch) { Object.assign(house(houseId), clean(patch)); save(); emit(); },
      async saveEntry(houseId, kind, entry) {
        const h = house(houseId);
        const id = entry.id || newId();
        const prev = h[kind][id];
        h[kind][id] = { ...clean(entry), id, createdAt: prev ? prev.createdAt : Date.now() };
        save(); emit();
        return id;
      },
      async deleteEntry(houseId, kind, id) { delete house(houseId)[kind][id]; save(); emit(); },
      async closePeriod(houseId, snapshot, next) {
        const h = house(houseId);
        h.periods[snapshot.id] = clean(snapshot);
        h.period = next; save(); emit();
      },
    };
  }

  /* ───────────────────────── FIREBASE BACKEND ───────────────────────── */
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(err('Could not load ' + src));
      document.head.appendChild(s);
    });
  }

  async function createFirebaseStore(cfg) {
    const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
    await loadScript(base + 'firebase-app-compat.js');
    await Promise.all([loadScript(base + 'firebase-auth-compat.js'), loadScript(base + 'firebase-firestore-compat.js')]);
    const fb = window.firebase;
    fb.initializeApp(cfg);
    const auth = fb.auth();
    const db = fb.firestore();
    try { db.enablePersistence({ synchronizeTabs: true }).catch(() => {}); } catch (e) { /* ignore */ }
    const H = (id) => db.collection('houses').doc(id);
    const uidNow = () => { if (!auth.currentUser) throw err('Not signed in.'); return auth.currentUser.uid; };
    let registering = false;
    const authCbs = new Set();
    let authKnown = false;
    let lastAuth = null;
    const emitAuth = () => {
      const u = auth.currentUser;
      lastAuth = u ? { uid: u.uid, email: u.email, emailVerified: u.emailVerified } : null;
      authKnown = true;
      authCbs.forEach((cb) => cb(lastAuth));
    };

    const friendly = (e) => {
      const c = e && e.code;
      const map = {
        'auth/email-already-in-use': 'An account with this email already exists.',
        'auth/invalid-email': 'This email address is not valid.',
        'auth/weak-password': 'Password is too weak (min 6 characters).',
        'auth/wrong-password': 'Wrong User ID / email or password.',
        'auth/invalid-credential': 'Wrong User ID / email or password.',
        'auth/user-not-found': 'Wrong User ID / email or password.',
        'auth/too-many-requests': 'Too many attempts. Please wait a bit and try again.',
        'auth/network-request-failed': 'No internet connection.',
        'permission-denied': 'Permission denied. Check that the Firestore rules from the README are published.',
      };
      return map[c] ? err(map[c]) : e;
    };
    const wrap = (fn) => async (...a) => { try { return await fn(...a); } catch (e) { throw friendly(e); } };

    auth.onAuthStateChanged(() => { if (!registering) emitAuth(); });

    return {
      mode: 'firebase',
      async init() {},
      onAuth(cb) { authCbs.add(cb); if (authKnown) cb(lastAuth); },
      register: wrap(async ({ email, userId, password }) => {
        validateRegistration({ email, userId, password });
        const id = userId.toLowerCase();
        email = email.trim().toLowerCase();
        const taken = await db.collection('userIds').doc(id).get();
        if (taken.exists) throw err('This User ID is already taken.');
        registering = true;
        try {
          const cred = await auth.createUserWithEmailAndPassword(email, password);
          try {
            await db.collection('userIds').doc(id).set({ uid: cred.user.uid, email });
            await db.collection('users').doc(cred.user.uid).set({ userId: id, email, houseId: null });
          } catch (e) {
            await cred.user.delete().catch(() => {});
            throw e;
          }
          cred.user.sendEmailVerification().catch(() => {});
        } finally { registering = false; }
        emitAuth();
      }),
      login: wrap(async ({ id, password }) => {
        id = (id || '').trim().toLowerCase();
        let email = id;
        if (!id.includes('@')) {
          const d = await db.collection('userIds').doc(id).get();
          if (!d.exists) throw err('Wrong User ID / email or password.');
          email = d.data().email;
        }
        await auth.signInWithEmailAndPassword(email, password);
      }),
      logout: wrap(() => auth.signOut()),
      resetPassword: wrap(async (email) => {
        if (!email) throw err('Enter your email first.');
        await auth.sendPasswordResetEmail(email.trim());
      }),
      watchProfile(uid, cb) {
        return db.collection('users').doc(uid).onSnapshot((s) => cb(s.exists ? s.data() : null), () => cb(null));
      },
      peekHouse: wrap(async (code) => {
        const s = await H((code || '').trim().toUpperCase()).get();
        if (!s.exists) throw err('No house found with this code.');
        const h = s.data();
        return { name: h.name, members: h.members };
      }),
      createHouse: wrap(async ({ name, currency, period, myName }) => {
        const uid = uidNow();
        const id = genCode(10);
        await H(id).set(clean({
          name, currency, period, ownerUid: uid, memberUids: [uid],
          members: [{ id: newId(), name: myName, uid }], createdAt: Date.now(),
        }));
        await db.collection('users').doc(uid).update({ houseId: id });
        return id;
      }),
      joinHouse: wrap(async (code, { memberId, newName }) => {
        const uid = uidNow();
        code = (code || '').trim().toUpperCase();
        await db.runTransaction(async (tx) => {
          const ref = H(code);
          const s = await tx.get(ref);
          if (!s.exists) throw err('No house found with this code.');
          const h = s.data();
          const members = h.members.map((m) => ({ ...m }));
          const uids = h.memberUids.includes(uid) ? h.memberUids : [...h.memberUids, uid];
          if (memberId) {
            const m = members.find((x) => x.id === memberId);
            if (!m) throw err('Member not found.');
            if (m.uid && m.uid !== uid) throw err('That name is already linked to another account.');
            m.uid = uid;
          } else if (!members.some((x) => x.uid === uid)) {
            if (!newName) throw err('Please enter your name.');
            members.push({ id: newId(), name: newName, uid });
          }
          tx.update(ref, { memberUids: uids, members });
        });
        await db.collection('users').doc(uid).update({ houseId: code });
      }),
      leaveHouse: wrap(async (houseId) => {
        const uid = uidNow();
        await db.runTransaction(async (tx) => {
          const ref = H(houseId);
          const s = await tx.get(ref);
          const h = s.data();
          tx.update(ref, {
            memberUids: h.memberUids.filter((x) => x !== uid),
            members: h.members.map((m) => { const c = { ...m }; if (c.uid === uid) delete c.uid; return c; }),
          });
        });
        await db.collection('users').doc(uid).update({ houseId: null });
      }),
      watchHouse(houseId, cb) {
        return H(houseId).onSnapshot((s) => cb(s.exists ? { id: s.id, ...s.data() } : null), () => cb(null));
      },
      watchEntries(houseId, kind, start, end, cb) {
        return H(houseId).collection(kind).where('date', '>=', start).where('date', '<=', end)
          .onSnapshot((q) => cb(sortEntries(q.docs.map((d) => ({ id: d.id, ...d.data() })))), () => cb([]));
      },
      watchPeriods(houseId, cb) {
        return H(houseId).collection('periods').orderBy('start', 'desc')
          .onSnapshot((q) => cb(q.docs.map((d) => ({ id: d.id, ...d.data() }))), () => cb([]));
      },
      updateHouse: wrap((houseId, patch) => H(houseId).update(clean(patch))),
      saveEntry: wrap(async (houseId, kind, entry) => {
        const col = H(houseId).collection(kind);
        const data = clean(entry);
        if (entry.id) {
          delete data.id;
          // update() replaces top-level fields wholesale (incl. the `shares` map); merge:true would keep stale people.
          await col.doc(entry.id).update(data);
          return entry.id;
        }
        delete data.id;
        data.createdAt = Date.now();
        return (await col.add(data)).id;
      }),
      deleteEntry: wrap((houseId, kind, id) => H(houseId).collection(kind).doc(id).delete()),
      closePeriod: wrap(async (houseId, snapshot, next) => {
        const batch = db.batch();
        const snap = clean(snapshot);
        const id = snap.id; delete snap.id;
        batch.set(H(houseId).collection('periods').doc(id), snap);
        batch.update(H(houseId), { period: next });
        await batch.commit();
      }),
    };
  }

  window.ZinStoreFactory = async function () {
    const cfg = window.ZIN_FIREBASE;
    if (cfg && cfg.apiKey) {
      try { return await createFirebaseStore(cfg); }
      catch (e) { console.error('Firebase failed, falling back to demo mode', e); }
    }
    return createLocalStore();
  };
})();
