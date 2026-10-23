# ZiN Home Accounting

Shared-house accounting PWA — rent, bills ও market খরচ housemates-দের মধ্যে split করে, কে কাকে কত দেবে তা হিসাব করে, আর প্রতি মাসের হিসাব PDF করে save রাখে।

## ১. এক মিনিটে try করো (Demo mode)

Firebase ছাড়াই চলে। Data শুধু ওই browser-এ থাকে (housemates-দের সাথে share হয় না)।

```bash
cd zin-home-accounting
python3 -m http.server 8080
# browser: http://localhost:8080
```

## ২. Real use — Firebase setup (housemates-দের সাথে shared data)

1. [Firebase Console](https://console.firebase.google.com) → **Add project**
2. **Build → Authentication → Get started → Email/Password → Enable**
3. **Build → Firestore Database → Create database** (production mode; region: `eur3` বা `europe-west`)
4. Firestore → **Rules** tab → `firestore.rules` file-এর পুরো content paste → **Publish**
5. **Project settings → Your apps → Web (`</>`)** → app register → যে `firebaseConfig` দেখাবে সেটা copy
6. `firebase-config.js` খুলে `window.ZIN_FIREBASE = null;` এর জায়গায় config paste করো
7. **Authentication → Settings → Authorized domains** → তোমার hosting domain যোগ করো (যেমন `yourname.github.io`)

## ৩. Deploy (GitHub Pages)

1. নতুন GitHub repo বানাও, এই folder-এর সব file repo-র root-এ upload করো
2. Repo → **Settings → Pages → Branch: `main` / root → Save**
3. Link খুলে phone-এ browser menu → **Add to Home screen** (এটাই PWA install)

> Code update করলে `sw.js`-এর `VERSION` (`zin-home-v1` → `v2`) বাড়াও, নাহলে পুরনো cache দেখাতে পারে।

## ৪. কীভাবে চলে

| ধাপ | কী করবে |
|---|---|
| Register | Email + নিজের **User ID** + password |
| Login | **User ID** (বা email) + password |
| প্রথমবার | **Create house** (নাম, currency, মাসের শুরু/শেষ তারিখ) |
| Housemates | Settings → **Invite code** share করো। তারা register করে *Join your housemates* এ code দেবে |
| Bills tab | Rent, Electricity, Gas, Wifi… প্রতিটা আলাদা dropdown, total আর কে কত share দেবে সেটা ভেতরে। **Equal** (যাদের select করবে তাদের মধ্যে) বা **Custom** amount |
| Market tab | যে কিনেছে তার নামের dropdown-এ date + serial সহ entry। **By person / By date** দুই রকম view |
| Settle tab | প্রত্যেকের paid, share, balance আর **কে কাকে কত দেবে** (সবচেয়ে কম সংখ্যক payment) |
| Month dates | Settings → Month dates (যেমন 10 Oct → 10 Nov) |
| Month close | Settings → **Close month & save PDF**: PDF download হয়, History-তে জমা থাকে, পরের মাস নিজে শুরু হয় |
| History | আগের যেকোনো মাস দেখো বা আবার PDF নামাও |

## ৫. জানা দরকার (সীমাবদ্ধতা)

- **User ID ভুলে গেলে:** email + password দিয়ে login করো, তারপর Settings → Your account-এ User ID দেখা যাবে। (Server ছাড়া Firebase থেকে "ID email করে পাঠানো" যায় না, তাই এই পথ।)
- **Password ভুলে গেলে:** Login page → *Forgot password?* → email-এ reset link আসবে।
- **PDF-এ নাম:** PDF-এর built-in font শুধু Latin অক্ষর support করে। Member-দের নাম English-এ রাখলে PDF ঠিক আসবে; বাংলা অক্ষর `?` হয়ে যাবে। (App screen-এ বাংলা নাম ঠিকই দেখায়।)
- **Privacy:** User ID দিয়ে login করার জন্য `userIds/{id}` document public-read। মানে কেউ একটা User ID জানলে ওই account-এর email দেখতে পারবে। চাইলে এটা পরে Cloud Function দিয়ে বন্ধ করা যায়।
- **Permissions:** Owner সব বদলাতে পারে। অন্য member যোগ করা entry নিজেরটা edit/delete করতে পারে। এই নিয়ম app-এর UI-তে enforce হয়, Firestore rules-এ নয়: house-এর সব member technically সব document লিখতে পারে। Trusted housemates-এর জন্য ঠিক আছে।
- Month dates বদলালে date-এর বাইরের entry **hidden** হয়, delete হয় না।

## ৬. Files

```
index.html  styles.css  manifest.webmanifest  sw.js
firebase-config.js   ← তোমার Firebase config এখানে
firestore.rules      ← Firestore-এ paste করবে
js/calc.js           ← split + settlement হিসাব (tests/ এ test আছে)
js/store.js          ← Firebase + demo data layer
js/pdf.js            ← PDF export
js/app.js            ← UI
icons/  vendor/      ← logo, PWA icons, jsPDF
```

Calculation test চালাতে: `node tests/calc.test.js`
