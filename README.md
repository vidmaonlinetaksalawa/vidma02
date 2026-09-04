# Class Management Portal — Setup & Deployment Guide

A free, static (no build step) class-management site:
- **Frontend:** plain HTML/CSS/JS, hosted free on **GitHub Pages**.
- **Backend:** **Firebase** (Auth + Firestore + Storage) — free "Spark" plan, no server code.

Everything below assumes zero cost, using only free tiers.

---

## 0. What's in this folder

```
class-mgmt/
├── index.html          # Login + student registration
├── dashboard.html       # Student dashboard
├── admin.html            # Admin dashboard
├── css/style.css
├── js/
│   ├── firebase-init.js  # <-- YOU EDIT THIS with your Firebase config
│   ├── login.js
│   ├── dashboard.js
│   └── admin.js
├── firestore.rules       # Security rules to paste into Firebase console
├── storage.rules          # Security rules to paste into Firebase console
└── README.md              # This file
```

---

## 1. Create the Firebase project (free)

1. Go to https://console.firebase.google.com and click **Add project**.
2. Name it (e.g. `my-class-portal`), disable Google Analytics if you don't need it, click **Create project**.
3. In the left sidebar, click the **</> (Web)** icon under "Get started by adding Firebase to your app".
4. Register the app (nickname anything). **Do not** check "Firebase Hosting" — we're using GitHub Pages instead.
5. Firebase shows you a `firebaseConfig` object. Copy it — you'll paste it into `js/firebase-init.js` in Step 5.

## 2. Turn on Authentication

1. In the Firebase console sidebar: **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password**.

## 3. Turn on Firestore Database

1. **Build → Firestore Database → Create database**.
2. Choose **Start in production mode** (we'll paste our own rules next), pick any region close to your users.
3. Once created, go to the **Rules** tab, delete the default content, and paste in the entire contents of `firestore.rules` from this project. Click **Publish**.

## 4. Turn on Storage (for bank slip uploads)

1. **Build → Storage → Get started**. Accept the default bucket location. Choose **production mode**.
2. Go to the **Rules** tab, paste in the contents of `storage.rules`, click **Publish**.

> Note: newly created Firebase projects on the Blaze (pay-as-you-go) plan get Storage automatically; on the free Spark plan Storage is also available but capped at 5GB stored / 1GB/day downloaded — plenty for slip screenshots.

## 5. Plug your config into the code

Open `js/firebase-init.js` and replace the placeholder object with the real values you copied in Step 1:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "my-class-portal.firebaseapp.com",
  projectId: "my-class-portal",
  storageBucket: "my-class-portal.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef",
};
```

This file is safe to make public — Firebase web API keys are not secret; your **Firestore/Storage rules** (Steps 3–4) are what actually protect the data.

## 6. Push the code to GitHub

```bash
cd class-mgmt
git init
git add .
git commit -m "Initial class management portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 7. Turn on GitHub Pages

1. On GitHub, open your repo → **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **Deploy from a branch**.
3. Branch: `main`, folder: `/ (root)`. Save.
4. After a minute, GitHub shows your live URL, e.g. `https://YOUR_USERNAME.github.io/YOUR_REPO/`.

## 8. Authorize your GitHub Pages domain in Firebase

Firebase Auth blocks sign-in from domains it doesn't recognize.

1. Firebase console → **Authentication → Settings → Authorized domains → Add domain**.
2. Add `YOUR_USERNAME.github.io`.

## 9. Create your Admin account

New sign-ups through the site are always created as `role: "student"` (see `login.js`) — this is intentional, so random visitors can't self-promote to admin.

To make yourself an admin:
1. Visit your live site and **register a normal student account** with your own email.
2. In Firebase console → **Firestore Database → users collection**, find the document with your UID.
3. Edit the `role` field from `student` to `admin`. Save.
4. Log out and back in on the site — you'll now land on `admin.html`.

## 10. Set the Zoom link and add recordings

Log in as admin → **Zoom & Recordings** tab:
- Paste your recurring Zoom link and save.
- Add recordings by giving each a week label, a title, and the **YouTube video ID** (the part after `v=` in a YouTube URL, e.g. for `https://youtube.com/watch?v=dQw4w9WgXcQ` the ID is `dQw4w9WgXcQ`). Upload your recordings to YouTube as **Unlisted**.

Both the Zoom link and recordings only render for students whose `paidMonths.<current-month>` field is `true` — set automatically when an admin approves a payment, or toggled manually from the **Students** tab.

## 11. How the payment flow works

1. Student uploads a slip screenshot → stored in Firebase Storage at `slips/{studentUID}/...`, and a `payments` document is created with `status: "pending"`.
2. Admin sees it under the **Payments** tab, can view the slip image, and clicks **Approve** or **Reject**.
3. Approving sets `payments.status = "approved"` **and** `users.paidMonths.<month> = true` — this second field is what unlocks Zoom + recordings for that student for that month.
4. At the start of a new calendar month, `paidMonths` simply won't have an entry for the new month yet, so access re-locks automatically until they pay again.

## 12. Known limitations (read this)

- **"Unlisted" YouTube videos are not truly private** — anyone with the direct link can view them, even without logging into your site. This app only gates *access to the link* through the UI/database; it can't add real DRM. For most small class use-cases this is an acceptable tradeoff, but don't rely on it for sensitive content.
- **No email verification enforced** — add `sendEmailVerification()` in `login.js` and check `user.emailVerified` if you want to require it.
- **No password reset UI** — Firebase supports `sendPasswordResetEmail()`; add a "Forgot password?" link if needed (a few lines).
- **Free tier limits:** Firestore free tier gives ~50K reads / 20K writes per day, Storage 5GB — comfortably enough for a small class, but monitor usage in the Firebase console if you scale up.
- **Slip image visibility:** by default any signed-in user can read files under `slips/` (needed so the admin dashboard can preview thumbnails) — students can theoretically guess another student's file URL only if they already know the exact path (UID + timestamp + filename), which isn't discoverable through the app. If you want stricter isolation, see the note in `storage.rules` about a Firestore cross-check.

## 13. Optional next steps

- Swap plain JS for React later — Firebase's modular SDK works identically; you'd just move this logic into components and run `npm run build`, then deploy the `build/` folder to GitHub Pages (e.g. via the `gh-pages` npm package) instead of the raw root.
- Add Cloud Functions (requires the Blaze plan, but has its own generous free quota) if you want server-side triggers, e.g. auto-emailing students when their payment is approved.
- Add a "payment history" view so students can see past months, not just the current one.
