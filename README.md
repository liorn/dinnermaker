# 🍽️ בונים ארוחת ערב — Dinner Maker

A Hebrew, frontend-only web app for a kid to build her own dinners for the week.
She picks foods, nutrition "bars" fill up, and a dinner is done when every bar is full.

## Run

No build step. Either double-click `index.html`, or:

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

State (weekly plan + settings) is cached in the browser's `localStorage` and, once
Firebase is configured, shared through a Firebase Realtime Database behind Google sign-in.
Without `FIREBASE_CONFIG` the app runs local-only.

## Sharing between devices (Firebase)

One-time setup in the [Firebase console](https://console.firebase.google.com):

1. Create a project. Add a **Web app** and copy its config object into `firebase-config.js`.
2. **Authentication → Sign-in method**: enable **Google**.
   **Authentication → Settings → Authorized domains**: add the site's domain.
3. **Realtime Database → Create database** (locked mode). Put the `databaseURL` in `firebase-config.js`.
4. Deploy the rules: `npx firebase-tools deploy --only database` (uses `firebase.json`).
5. **Realtime Database → Data**: create `groups/family/members` with one child per allowed
   Google account, key = email with `.` replaced by `,` (e.g. `someone@gmail,com`), value `true`.

Access is per group. The member list lives only in the database, never in this repo, and can
only be edited in the console (the rules deny client writes there). To add someone, add their
email as a new key under `members`. To start a second, separate plan, add another group in the
database and point `GROUP_ID` in `firebase-config.js` at it.

## Edit the food list

Everything editable is in **`foods.js`**:

- `SETTINGS_DEFAULT` — treat nights per week, max items per plate
  (also changeable in the app via ⚙️).
- `NUTRIENTS` — the bars (name, emoji, `target` points to fill, color).
- `CATEGORIES` — the tabs.
- `FOODS` — one entry per food:

```js
{ id: 'schnitzel', name: 'שניצל', emoji: '🍗', cat: 'protein', rating: 5, n: [3, 0, 1, 0, 0] }
```

| field    | meaning |
|----------|---------|
| `rating` | 1–5 hearts, or `null` if she hasn't rated it |
| `n`      | points per bar, in `NUTRIENTS` order (`[protein, veg, energy, calcium, vitamins]`), scale 0–3 for a kid portion |
| `solo`   | `true` = a whole dinner on its own (pizza, schnitzel, pancakes). Nothing can be added to it, and it can't be picked once something else is already on the plate — clear the plate first. The bars aren't required on such a night |
| `treat`  | `true` = treat dinner (pancakes, kaiserschmarrn, cereal); counts against the weekly treat-night quota. Pizza is `solo` but **not** a treat, so it doesn't use the quota |

## Using it

- **⬅️ / ➡️ next to the date** move between weeks (2 back, 4 ahead), so next week can be planned in advance. Each week is stored separately; empty weeks aren't saved.
- **📋 → 📄 העתקה** copies the whole week you're currently viewing to the clipboard as plain text (one line per day).
- **Filtering by nutrient**: tap a nutrition bar, one of the colored nutrient chips above the food grid, or a "חסר עוד" chip in the status line. The grid then shows only foods that provide that nutrient, strongest first, with the amount shown on each card. Tap again to clear. Whole dinners are excluded while filtering, since they don't fill bars.

## Rules

- Week runs Sunday–Saturday; a new week gets a fresh plan automatically (last 8 weeks are kept).
- Tap a food to add it, tap again to remove it (one portion per food).
- Foods are sorted by rating (highest first); unrated ones come last.
- A day is ✅ when all bars reach their target, 🍽️ when a whole dinner is chosen, 🎉 on a treat night.
- Only `treatNights` treat days are allowed per week; extra treat foods are greyed out. Pizza nights are unlimited.
- 📋 shows the whole week (printable) for the parents.
