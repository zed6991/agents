# Launch checklist

Only you can do these steps: they need accounts, passwords, payment details or your name. Do them in order. Each takes under 30 minutes. Total: about 5 hours, which fits in the first week and leaves the second for launch posts.

Keep a password manager open. Never paste a secret key into chat, an issue, or a commit.

---

## Day 1: name, code, domain

### 1. Choose the final name (20 min)
- Search the name on Google, X, Product Hunt and GitHub. "Weekship" is a working name; I found no product using it, but I did not check trademarks or domains.
- Check the USPTO trademark search (tmsearch.uspto.gov) or your country's equivalent for software trademarks with the same name.
- If you rename it, set `APP_NAME` in step 6. No code change is needed.

### 2. Buy the domain (10 min)
- Buy `.com` or `.app` at Cloudflare Registrar, Namecheap or Porkbun (about $10–15 a year).
- Set up an address such as `hello@yourdomain` (Cloudflare Email Routing is free and forwards to your inbox).

### 3. Move the code to its own repository (15 min)
The product lives in the `weekship/` folder of this course repository. Give it its own private repo:
```bash
git clone https://github.com/zed6991/agents.git tmp && cd tmp
git checkout claude/product-launch-2week-dz8p36
cp -r weekship ~/weekship && cd ~/weekship
git init && git add -A && git commit -m "Initial commit"
# create an empty private repo named weekship on github.com, then:
git remote add origin git@github.com:YOUR_USER/weekship.git && git push -u origin main
```
The GitHub Actions workflow in `.github/workflows/ci.yml` runs the tests on every push.

### 4. Run it on your machine (10 min)
Needs Node.js 22.
```bash
npm install && npm test && npm run dev
```
Open http://localhost:3000, sign up, create a project, publish an update, open the Share page.

---

## Day 2: Stripe in test mode

### 5. Create the Stripe account and Pro prices (25 min)
1. Sign up at stripe.com. Stay in **Test mode** (toggle top right) for everything in this step.
2. Product catalogue → Add product: name "Weekship Pro", recurring, **$9.00 USD monthly**. Save.
3. On the same product, Add another price: **$90.00 USD yearly**.
4. Copy both price IDs (`price_...`).
5. Developers → API keys: copy the **test** secret key (`sk_test_...`).
6. Settings → Billing → Customer portal: turn on "Cancel subscriptions", "Update payment methods" and "Invoice history". Add your terms and privacy URLs (`https://yourdomain/terms`, `/privacy`). Save.
7. Try it locally: install the Stripe CLI, run `stripe login`, then `stripe listen --forward-to localhost:3000/stripe/webhook`. Put the key, prices and the printed `whsec_...` into `.env` (see `.env.example`), restart `npm run dev`, and upgrade with card `4242 4242 4242 4242`. The billing page should say "Current plan: Pro" and the badge should disappear from your changelog.

---

## Day 3: deploy

### 6. Create the Fly.io app (25 min)
1. Sign up at fly.io and add a card (expect about $3–5 a month: one small always-on machine and a 1 GB volume).
2. Install `flyctl` and run `fly auth login`.
3. In the project folder:
```bash
fly launch --no-deploy --copy-config --name YOUR-APP-NAME   # accept the fly.toml, say no to databases
fly volumes create weekship_data --size 1 --region iad
fly secrets set \
  BASE_URL=https://yourdomain.com \
  SUPPORT_EMAIL=hello@yourdomain.com \
  STRIPE_SECRET_KEY=sk_test_... \
  STRIPE_PRICE_MONTHLY=price_... \
  STRIPE_PRICE_YEARLY=price_...
fly deploy
```
4. Open `https://YOUR-APP-NAME.fly.dev/healthz`; it should show `{"ok":true}`.

Note: I could not test the Docker image build in my sandbox (it had no network inside Docker). I did test the same production install and start-up outside Docker. If `fly deploy` fails, the log will show which line of the `Dockerfile` broke.

### 7. Point your domain at Fly (20 min)
```bash
fly certs add yourdomain.com
fly ips list
```
Add the A and AAAA records it shows at your DNS provider (if using Cloudflare, set them to "DNS only", grey cloud). Wait for `fly certs show yourdomain.com` to say the certificate is issued.

### 8. Add the test-mode webhook (10 min)
1. Stripe (test mode) → Developers → Webhooks → Add endpoint: `https://yourdomain.com/stripe/webhook`.
2. Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
3. Copy the signing secret and run `fly secrets set STRIPE_WEBHOOK_SECRET=whsec_...`.

### 9. Password-reset email with Resend (20 min)
1. Sign up at resend.com, add your domain, and add the DNS records it lists (SPF, DKIM). Wait until it shows "Verified".
2. Create an API key with sending access only.
3. `fly secrets set RESEND_API_KEY=re_... EMAIL_FROM="Weekship <noreply@yourdomain.com>"`
4. Use "Forgot password?" on the live site and check the email arrives.

---

## Day 4: test as a customer, then go live

### 10. Full test on the live site in test mode (25 min)
Use a private browser window and a second email address.
- [ ] Sign up, create a project, publish two updates, save one draft.
- [ ] Changelog page, RSS link and single-update page all load; the draft is not shown.
- [ ] Paste the widget snippet into any HTML page (for example a CodePen). The button and red dot appear; opening it clears the dot.
- [ ] Share page: "Open in X" fills the X composer (do not post).
- [ ] Upgrade with `4242 4242 4242 4242`. Plan becomes Pro, badge disappears, weekly recap works.
- [ ] "Manage subscription" opens Stripe's portal. Cancel. After the period ends in Stripe's test clock (or cancel immediately in the Stripe dashboard) the plan returns to Free.
- [ ] Forgot password email arrives and works.
- [ ] Delete the test account.

### 11. Read the legal pages (20 min)
`/terms` and `/privacy` are plain-English starting points I wrote, not legal advice. Read them, add your legal name or company and country, and have a lawyer or a service such as Termly check them if you can. If you sell to people in the EU, UK or Australia, Stripe Tax can handle VAT/GST (Stripe → Tax), or you can use a merchant of record such as Paddle or Lemon Squeezy instead of Stripe, which would need changes to `src/billing.js`.

### 12. Switch on live payments (30 min)
1. Stripe → Activate account: business details, identity, bank account for payouts. Only you can do this.
2. In **live** mode, create the same product and two prices (or use "Copy to live mode" on the product), and the same Customer portal settings.
3. Create a live webhook endpoint with the same URL and events.
4. Set the live values and the safety switch:
```bash
fly secrets set STRIPE_SECRET_KEY=sk_live_... STRIPE_WEBHOOK_SECRET=whsec_... \
  STRIPE_PRICE_MONTHLY=price_... STRIPE_PRICE_YEARLY=price_... ALLOW_LIVE_STRIPE=true
```
5. Buy Pro once with your own card, check the plan changes, then refund yourself in Stripe.

### 13. Backups (10 min)
Fly takes a daily snapshot of the volume and keeps it for 5 days by default. Check with `fly volumes snapshots list <volume-id>`. Once you have paying customers, add off-site backups: [Litestream](https://litestream.io) to an S3-compatible bucket (Cloudflare R2 free tier is enough).

### 14. Dogfood it (15 min)
1. On your live site, create the project with slug `weekship` (or your new name) straight away, so nobody else takes it.
2. `fly secrets set SELF_CHANGELOG_SLUG=weekship`. The landing page now shows your own widget and a "Changelog" link.
3. Publish "Weekship is live" as the first update. From now on, every change you ship goes there first, then to X and LinkedIn through the Share page.

---

## Week 2: launch

### 15. Post the launch (30 min each day, three days)
- Day 1: X and LinkedIn posts below, from your own accounts. Record a 2-minute screen video: write an update, open the widget, open the X draft.
- Day 2: Show HN ("Show HN: Weekship – one update becomes your changelog, in-app widget and X post"), r/SideProject, r/indiehackers, Indie Hackers "Show IH".
- Day 3: submit to directories: Product Hunt (schedule for a Tuesday, 12:01 am Pacific), BetaList, Uneed, Microlaunch, SaaSHub, AlternativeTo (list it as an alternative to Headway and Beamer).
- Reply to every comment the same day. Early users who reply are your best source of what to build next.

### Draft: X launch post

> I kept shipping features nobody heard about.
>
> So I built Weekship: write an update once, and you get
> → a changelog page
> → a "What's new" widget in your app
> → an X post and a LinkedIn post, ready to go
>
> Free to start. Built in public.
>
> https://yourdomain.com

(261 of 280 characters, counted the way X counts. Attach the 2-minute video; video posts get far more reach than links alone.)

**Follow-up reply in the thread:**
> How it works:
> 1. Write what you shipped (markdown is fine)
> 2. Paste one script tag into your app
> 3. Hit Share → copy or open in X
>
> Pro ($9/mo) adds a weekly recap thread and removes the badge.
>
> What should it do next?

### Draft: LinkedIn launch post

> For two years I had the same problem: I shipped something every week, and almost nobody knew.
>
> Users missed new features. My followers never saw the progress. The changelog page was months out of date.
>
> The fix wasn't shipping more. It was making "telling people" take thirty seconds instead of thirty minutes.
>
> So I built Weekship. You write one update, and it becomes:
> → a public changelog page with RSS
> → a "What's new" widget inside your app, with an unread dot so users notice
> → a ready-to-post draft for X and one for LinkedIn
>
> It's free for one product. Pro is $9 a month and adds a weekly recap you can post every Friday.
>
> I'm building it in public, so everything I ship will show up in its own changelog: https://yourdomain.com/c/weekship
>
> If you run a SaaS or a side project, I'd love to hear how you announce updates today, and what's annoying about it.
>
> #buildinpublic #indiehackers #saas

### YouTube: first video outline (8–10 min)
1. The problem (30 s): "I shipped 40 things last year. My users noticed 3."
2. Live demo (3 min): sign up, first update, widget in a real app, Share page, post to X live.
3. How it's built (4 min): the X character-counting rule (links count as 23), Shadow DOM widget, Stripe webhooks that survive out-of-order events. Developers like the "how".
4. The numbers (1 min): costs ($5/month), price, goal ($1k MRR), promise to report monthly.
5. Call to action: "Try it free; link below. Tell me what to build next."

---

## Pricing recommendation

- **Free**: 1 project, unlimited updates, changelog + widget + post drafts, "Powered by" badge. Generous on purpose: the badge on free accounts is the main growth channel.
- **Pro: $9 a month or $90 a year.** Up to 5 projects, no badge, weekly recap.
- Why $9: well below Headway ($29), Beamer ($49) and Shiplog ($19), and below CommitLore ($12), which only does posts. A solo maker can say yes without thinking. At $9, $1,000 a month is about 110 customers.
- **Offer the first 100 customers "founding" pricing locked at $9 for life**, then raise new sign-ups to $12 once you have 50 paying customers and at least one testimonial. Create a Stripe coupon or a new price; existing subscribers keep theirs.
- Do not add a free trial of Pro at first; the free plan is the trial. Revisit if people sign up but never upgrade.
- If teams start asking for seats, custom domains or email digests, those are the features for a later $29 "Team" plan.
