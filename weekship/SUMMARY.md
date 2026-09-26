# Summary

## What I built

**Weekship**, a small web app for indie makers who build in public. You write a product update once, and Weekship turns it into:

1. a public **changelog page** (with RSS, a JSON API and a page per update),
2. a **"What's new" widget** your customers' users see inside their app (one script tag, red unread dot),
3. **ready-to-post drafts for X and LinkedIn**, sized to fit X's real counting rules, with an "Open in X" button. Pro adds a **weekly recap** thread.

Free plan: one project with a "Powered by Weekship" badge, which is the main way it spreads. Pro: **$9 a month or $90 a year**.

Everything is in the `weekship/` folder on branch `claude/product-launch-2week-dz8p36`.

## Why this idea

I rejected the gym tracker (Hevy is free and earns about $600k a month) and the party game (depends on hits and an audience). Changelog tools are a proven paid market ($29–$249 a month), weak at the cheap end, and this one fits your plan to build in public: every post you make is a demo. Full reasoning and the assumptions I made for your blanks (5 hours a week, $1,000 a month goal, $0 API cap) are in [DECISIONS.md](DECISIONS.md).

## How finished it is

- Sign-up, login, password reset, account deletion.
- Projects, draft/publish/unpublish/delete updates, settings (name, website, accent colour).
- Public changelog, RSS, JSON API, embeddable widget (also works with your own button). The dashboard shows which website each widget runs on.
- Stripe Checkout, Customer Portal and webhooks, **test mode only**. The server refuses live keys unless you set `ALLOW_LIVE_STRIPE=true`.
- Landing page with pricing and FAQ; plain-English terms and privacy pages (they need your details and a check, see LAUNCH.md step 11).
- Security: hashed passwords, CSRF and origin checks, strict content policy, rate limits, safe Markdown.
- **37 automated tests pass.** CI workflow, Dockerfile and Fly.io config included.

**I used it as a customer would**, in a real browser on desktop and phone sizes: signed up, created a project, published updates, saved a draft, opened the share drafts, read the public page, installed the widget on a separate test website, checked the unread dot clears, tried a custom trigger button, and viewed the Pro screens. That found four bugs, all fixed: an invisible "Start free" button, misaligned cards, a broken font rule in the widget, and X drafts that ran list items together and wasted characters on inline links.

**Not tested:** the Docker image build (my sandbox blocked network access inside Docker; I tested the same production install and start-up without Docker), and a real Stripe checkout (no keys, by your rules). LAUNCH.md steps 6 and 10 cover both.

## What it cost

**$0** outside your Claude plan: no paid APIs, no accounts, no live keys. Running it will cost about **$3–6 a month**. See [SPEND.md](SPEND.md).

## What you do first

1. **Fill in the blanks** I guessed (hours, revenue goal, spend cap). If they differ a lot, re-read DECISIONS.md.
2. **Check the name "Weekship"** and buy a domain (LAUNCH.md steps 1–2, 30 minutes).
3. Follow **[LAUNCH.md](LAUNCH.md)** in order: 15 steps, each under 30 minutes, about 5 hours of setup plus three launch days. Draft X and LinkedIn launch posts, a YouTube outline and the pricing plan are in it.
4. In the first 30 days, watch the numbers in **[RISKS.md](RISKS.md)**: sign-ups per week, share who publish within a day, and free-to-paid conversion.
