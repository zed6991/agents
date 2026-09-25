# Decisions

Date: 25 September 2026.

## What I had to assume

Your brief left several blanks. I filled them as follows; change any of them and parts of this plan change too.

| Blank | Assumed | Why it matters |
| --- | --- | --- |
| Your profile | A developer who likes building tools, with no large existing audience | Rules out ideas that need an audience on day one |
| Hours a week after launch | 5 | Rules out anything with heavy support, content or moderation |
| Revenue goal | $1,000 a month within 12 months | Sets the price and the number of customers needed |
| API spend cap | $0 of paid third-party APIs | The product uses no AI API, so it costs nothing per user |

## Ideas considered

| Idea | Verdict | Reason |
| --- | --- | --- |
| **Gym tracker app** (yours) | Rejected | Hevy is free with no ads and earns about $600k a month; Strong charges $10 a month. A new tracker must win in the app stores against both, and app stores reward paid ads and big review counts, not a solo builder with 5 hours a week. |
| **Party-game app** (yours) | Rejected | Hit-driven. Success depends on reaching many players at once, which needs an audience or ad budget. Revenue is unpredictable and discovery is the main problem most indie game makers report. |
| Cron-job monitoring | Rejected | Proven demand, but a race to the bottom: Healthchecks.io gives 20 checks free, CronAlert sells 100 monitors for $5. And a monitoring service that goes down loses trust at once, so it would need more than 5 hours a week of care. |
| Testimonial collection | Rejected | Senja earns over $80k a month and Testimonial.to is well known. Hard to stand out, and video features cost money to host. |
| Git-commits-to-tweets generator | Rejected on its own | Several exist (Postgit, CommitLore at $12 a month, PubliclyBuild). Most need an AI API, which costs money per user. |
| **Changelog + "What's new" widget + launch-post drafts** | **Chosen** | See below. |

## Why this one won

1. **People already pay for it.** Headway charges $29 a month, Beamer $49 to $499, AnnounceKit $79 to $129, LaunchNotes $249. Indie makers call these prices hard to justify before they have real revenue.
2. **A clear gap at the low end.** Headway, the old indie favourite, has barely changed since about 2020. The cheaper newcomers (Shiplog at $19, Patchlog, SvellBell) each do one part. None ties "write the changelog" to "tell your followers", which is the whole point of building in public.
3. **It grows without an audience.** Every free changelog page and widget carries a "Powered by Weekship" link, shown to *your customers' users*. Senja grew on the same loop. It also suits search: people search for "Headway alternative" and "changelog widget".
4. **It fits how you will market.** You plan to build in public on X, LinkedIn and YouTube. Weekship is the tool for exactly that, so every post you make is also a demo. You use it daily, so you find its flaws first.
5. **It is cheap and quiet to run.** No AI API, no video, no per-user cost. One small server and one SQLite file. Most support questions are "how do I add the widget", which the dashboard answers.
6. **It fits in 2 weeks.** It is built. What is left is accounts, keys and deployment, listed in LAUNCH.md.

## Assumptions the plan depends on

- Indie makers will pay about $9 a month for a changelog that also writes their posts. Evidence: CommitLore charges $12 for posts alone; Shiplog charges $19 for a changelog. **Untested until someone pays.**
- The badge brings sign-ups. It works for Senja; it has not been tested for this product.
- Free users convert to Pro at roughly 3 to 5%. $1,000 a month needs about 110 Pro customers, so about 2,500 to 3,500 sign-ups in the year, or 200 to 300 a month. **This is the weakest assumption** (see RISKS.md).
- Template-based post drafts are good enough without AI. If users ask for "make it sound like me", adding an AI rewrite would add a cost per use and should be a paid extra.
- One server and SQLite can serve the first few thousand users. The widget reads are light and cached for 60 seconds.

## Build choices

- **Server-rendered Node + SQLite**, no front-end framework: fewer moving parts, one process to deploy, easy to back up.
- **Email and password login** rather than magic links: works without an email provider on day one. Password reset uses Resend when configured.
- **Stripe Checkout and Customer Portal**: Stripe hosts the payment and cancellation pages, so no card data touches the app.
- **The app refuses live Stripe keys** unless you set `ALLOW_LIVE_STRIPE=true`, so test mode is the default.
- **Name**: "Weekship" is a working name. "PatchPost" and "ChangeCast" were already taken. I did not check domain or trademark availability; LAUNCH.md step 1 covers it. `APP_NAME` renames the product without code changes.

## Sources

- [Hevy revenue estimate](https://app.sensortower.com/overview/1458862350?country=US), [Hevy vs Strong pricing](https://setgraph.app/ai-blog/hevy-vs-strong-app-comparison-2026)
- [Indie game discoverability](https://dev.to/ziva/the-900000-game-problem-why-most-indie-games-never-get-found-4lda)
- [Healthchecks.io pricing](https://healthchecks.io/pricing/), [CronAlert vs Cronitor](https://cronalert.com/compare/cronitor)
- [Senja $1M ARR story](https://www.thesuccessfulprojects.com/how-two-indie-hackers-built-a-successful-micro-saas-senja-io-1m-arr/), [Testimonial.to vs Senja](https://www.collectmonial.com/vs/testimonial-to-vs-senja)
- [State of changelog tools for indie SaaS, 2026](https://dev.to/kavinjeya/the-state-of-changelog-tools-for-indie-saas-in-2026-2f22) (written by Shiplog's maker, so read with care), [Headway alternatives](https://www.featurebase.app/blog/headway-alternatives), [Changelog software prices](https://productbridge.io/blog/best-changelog-software-for-saas)
- [Postgit](https://postgit.com/), [CommitLore pricing](https://www.commitlore.com/blog/twitter-post-generator-for-developers)
