# Spend

Cap you set: `$[X]` (left blank). I treated it as **$0 for paid third-party APIs** and stayed there.

| Item | Cost | Notes |
| --- | --- | --- |
| Paid third-party APIs (AI, Stripe live, email, hosting, domains) | $0.00 | None called. No accounts created. |
| Stripe | $0.00 | No keys used. Tests use Stripe's own library to sign fake webhooks locally; no request reached Stripe. |
| npm packages | $0.00 | express, better-sqlite3, stripe (all free, open source). |
| Web research | Included in this Claude Code session | 11 web searches and 1 page fetch, used for DECISIONS.md. I cannot see a separate charge for these. |
| Claude Code session itself | Billed to your Claude plan | Not visible to me, so not counted here. |
| **Total outside your Claude plan** | **$0.00** | |

## What running it will cost you (estimates, after launch)

| Item | Monthly | When |
| --- | --- | --- |
| Fly.io: 1 shared-cpu machine (256 MB), always on + 1 GB volume | ~$2–5 | From deploy |
| Domain | ~$1 (about $10–15 a year) | From day 1 |
| Resend email | $0 (free tier: 3,000 emails a month) | From deploy |
| Stripe | 2.9% + 30¢ per card payment (about 56¢ on $9), plus Stripe Billing's fee on subscriptions | Only when you are paid |
| Cookie-less analytics (optional) | $0–9 | When you want referrer data |
| **Total fixed cost** | **about $3–6 a month** | |

Break-even: one Pro customer.
