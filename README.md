# Class Management Portal — Supabase + GitHub Pages Setup

A free, static (no build step) class-management site:
- **Frontend:** plain HTML/CSS/JS, hosted free on **GitHub Pages**.
- **Backend:** **Supabase** (Postgres + Auth + Storage) — free tier, no server code.

---

## 0. What's in this folder

```
class-mgmt-supabase/
├── index.html            # Login + student registration
├── dashboard.html         # Student dashboard
├── admin.html              # Admin dashboard
├── css/style.css
├── js/
│   ├── supabase-init.js    # <-- YOU EDIT THIS with your Supabase URL + anon key
│   ├── login.js
│   ├── dashboard.js
│   └── admin.js
├── supabase.sql             # Run this once in the Supabase SQL Editor
└── README.md                 # This file
```

---

## 1. Create the Supabase project (free)

1. Go to https://supabase.com/dashboard and click **New project**.
2. Pick an org, name it, set a database password (save it somewhere), choose a region, click **Create new project**. Wait ~2 minutes for provisioning.

## 2. Run the schema

1. In the left sidebar: **SQL Editor → New query**.
2. Open `supabase.sql` from this project, copy the **entire file**, paste it in, click **Run**.

This one script creates:
- `profiles`, `payments`, `settings` tables
- A trigger that auto-creates a `profiles` row (forced `role='student'`) whenever someone signs up — the client can never set its own role
- All Row Level Security (RLS) policies
- The private `slips` storage bucket + its access policies

## 3. Configure Auth

1. **Authentication → Providers**: Email is on by default — nothing to do.
2. **Authentication → Settings**: for a quick class setup, turn **off** "Confirm email" so students can log in immediately after signing up. (Leave it on if you'd rather they verify their email first — `login.js` already handles both cases.)
3. **Authentication → URL Configuration**: once you know your GitHub Pages URL (Step 7), add it under **Site URL** and **Redirect URLs**.

## 4. Get your API keys

**Project Settings → API**:
- Copy **Project URL**
- Copy the **anon / public** key (not the `service_role` key — never put that in frontend code)

## 5. Plug them into the code

Open `js/supabase-init.js` and replace:

```js
const SUPABASE_URL = "https://YOUR_PROJECT_REF.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY";
```

The anon key is safe to make public — it's designed to be — your **RLS policies** (Step 2) are what actually protect the data.

## 6. Push the code to GitHub

```bash
cd class-mgmt-supabase
git init
git add .
git commit -m "Initial class management portal (Supabase)"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## 7. Turn on GitHub Pages

1. Repo → **Settings → Pages**.
2. **Source**: Deploy from a branch → Branch `main`, folder `/ (root)` → Save.
3. Your live URL appears after ~1 minute: `https://YOUR_USERNAME.github.io/YOUR_REPO/`.
4. Go back to Supabase (Step 3.3) and add this URL to **Site URL** / **Redirect URLs**.

## 8. Create your Admin account

Every signup is forced to `role = 'student'` by the trigger — there's no way to self-promote from the app.

1. Visit your live site and register a normal student account with your own email.
2. In Supabase: **Table Editor → profiles**, find your row.
3. Edit the `role` cell from `student` to `admin`. Save.
4. Log out and back in on the site — you'll land on `admin.html`.

## 9. Set the Zoom link and add recordings

Log in as admin → **Zoom & Recordings** tab:
- Paste your recurring Zoom link and save.
- Add recordings with a week label, a title, and the **YouTube video ID** (the part after `v=`, e.g. for `https://youtube.com/watch?v=dQw4w9WgXcQ` it's `dQw4w9WgXcQ`). Upload the recordings to YouTube as **Unlisted**.

Both only render for students whose `paid_months` jsonb column has `"<current-month>": true` — set automatically when an admin approves a payment, or toggled manually from the **Students** tab.

## 10. How the payment flow works

1. Student uploads a slip → stored in the private `slips` bucket at `{studentUID}/{timestamp}_{filename}`; a `payments` row is created with `status = 'pending'` (the file *path*, not a public URL, is stored).
2. Admin sees it under **Payments**, and the dashboard generates a 1-hour **signed URL** on the fly to preview the image (private bucket — there is no permanent public link).
3. Approving sets `payments.status = 'approved'` and merges `paid_months["<month>"] = true` onto the student's profile — that field is what unlocks Zoom + recordings.
4. Next calendar month, `paid_months` has no entry yet, so access re-locks until they pay again.

## 11. Known limitations (read this)

- **"Unlisted" YouTube videos aren't truly private** — anyone with the direct link can view them without ever logging into your site. This app gates *access to the link* through the database; it can't add real DRM. Fine for most small classes, but don't rely on it for sensitive content.
- **No password reset UI** — Supabase supports `supabase.auth.resetPasswordForEmail()`; add a "Forgot password?" link if you need it.
- **Signed URLs expire** (set to 1 hour in `admin.js`) — if an admin leaves a payments tab open longer than that, refreshing the page regenerates them.
- **Free tier limits:** Supabase free tier includes 500MB database, 1GB file storage, 50K monthly active users — comfortably enough for a small class.
- **Admin dashboard doesn't yet let admins edit a student's name/email** — only `role` and `paid_months` are locked down to admin-only writes; adding a student-editable-fields policy is a small future enhancement (see `supabase.sql` comments).

## 12. Optional next steps

- Swap plain JS for React later — supabase-js works identically in components; build with `npm run build` and deploy the output folder to GitHub Pages (e.g. via `gh-pages`) instead of the raw root.
- Add Supabase Edge Functions (also free-tier) if you want server-side logic, e.g. auto-emailing a student when their payment is approved.
- Add a "payment history" view so students can see past months, not just the current one.
