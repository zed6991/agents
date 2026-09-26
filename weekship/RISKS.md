# Risks

The three most likely reasons Weekship fails, in order, and what to measure in the first 30 days to know early.

## 1. Not enough people find it

**Why it could fail.** $1,000 a month needs about 110 Pro customers, which likely means 2,500 or more sign-ups in a year. You are starting without an audience, and the changelog market already has many tools, several of them new and cheap. Launch-day traffic fades within a week.

**Measure (first 30 days):**
- Sign-ups per week: `SELECT date(created_at/1000,'unixepoch','weekday 0') AS week, COUNT(*) FROM users GROUP BY week;`
- Where visitors come from. The app keeps no request logs, so add a cookie-less analytics tool (Plausible or Umami, about $9 a month or self-hosted) to the landing page. Badge and widget links carry `?ref=badge` and `?ref=widget`.
- Visits from the "Powered by" badge. This is the loop that has to work without you.
- Followers gained per build-in-public post on X and LinkedIn.

**Early warning:** fewer than 100 sign-ups in the first 30 days, or badge referrals near zero by day 30. **Response:** write two comparison pages ("Headway alternative", "Beamer alternative") aimed at search, and post the weekly recap every Friday without fail.

## 2. People sign up but never use it

**Why it could fail.** A changelog only pays off if people keep writing updates. Many will create a project, write one update, and stop. The widget is only valuable once it is installed in their app, which takes a developer and a deploy.

**Measure:**
- Activation: share of sign-ups that publish at least one update within 24 hours. Target: 50% or more.
- Widget installs: the app records the last website each widget ran on (`projects.widget_origin`), and shows it to the user on their project page. Target: 20% of active projects.
- Week-2 retention: share of accounts that publish again 7–14 days after the first update. Target: 30% or more.

Queries against the SQLite file (`fly ssh console`, then `sqlite3 /data/weekship.db`) give most of these:
```sql
-- sign-ups that published within a day
SELECT COUNT(DISTINCT u.id) FROM users u JOIN projects p ON p.user_id = u.id JOIN entries e ON e.project_id = p.id
WHERE e.status = 'published' AND e.published_at - u.created_at < 86400000;
-- projects with 2+ published updates
SELECT COUNT(*) FROM (SELECT project_id FROM entries WHERE status='published' GROUP BY project_id HAVING COUNT(*) >= 2);
-- projects with the widget installed somewhere
SELECT COUNT(*) FROM projects WHERE widget_origin IS NOT NULL;
-- paying customers
SELECT COUNT(*) FROM users WHERE plan = 'pro';
```

**Early warning:** activation below 30%. **Response:** email every new user personally in the first month and ask what stopped them; add a sample update and a "remind me every Friday" email.

## 3. People use it but will not pay $9

**Why it could fail.** The free plan might be enough. The badge may not bother small makers, the weekly recap may not feel worth $9, and the post drafts are templates, not AI, so some will find them plain.

**Measure:**
- Free-to-Pro conversion among accounts with 3+ published updates. Target: 5% or more by day 30.
- Clicks on "Upgrade" versus completed checkouts (Stripe dashboard shows started versus completed Checkout sessions). A big gap means a price or trust problem.
- What people say when they cancel: Stripe's portal can ask for a cancellation reason (Settings → Billing → Customer portal → "Collect cancellation reasons").

**Early warning:** fewer than 3 paying customers by day 30 despite 50+ active free users. **Response:** talk to five active free users and ask what they would pay for. Likely candidates: custom domain for the changelog (`changelog.theirapp.com`), email digests to their users, or an AI "rewrite in my voice" button (charge for it, since it costs money per use).

## Smaller risks to watch

- **Single server.** One Fly machine and one SQLite file. If the machine dies, the widget on customers' sites stops showing updates (it fails silently and never breaks their page). Fly restarts machines automatically; set up the off-site backup in LAUNCH.md step 13 before you have 10 paying customers.
- **Name or trademark conflict.** Check before you buy a domain (LAUNCH.md step 1).
- **X changes its counting rules or intent URL.** The drafts would still copy fine; only the "Open in X" button would break. The counting rules live in `src/posts.js`.
- **Abuse.** Someone could publish spam on a free changelog. Watch new projects weekly; delete with `DELETE FROM users WHERE email = ...` in SQLite (cascades to their projects).
