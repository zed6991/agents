'use strict';

const { html, raw } = require('./html');
const { TAG_LABEL, X_LIMIT, xLength, LINKEDIN_LIMIT, xIntentUrl } = require('./posts');

function formatDate(ms) {
  return new Date(ms).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function layout({ title, app, user, csrf, body, description, accent, noindex, head }) {
  const pageTitle = title ? `${title} · ${app.appName}` : `${app.appName} — changelog, widget and launch posts from one update`;
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${pageTitle}</title>
<meta name="description" content="${description || `${app.appName} turns each product update into a hosted changelog, an in-app “What’s new” widget and ready-to-post X and LinkedIn drafts.`}">
${noindex ? html`<meta name="robots" content="noindex">` : ''}
<link rel="stylesheet" href="/style.css">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
${accent ? html`<style>:root{--accent:${accent}}</style>` : ''}
${head || ''}
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="/"><span class="logo-mark" aria-hidden="true"></span>${app.appName}</a>
    <nav class="nav" aria-label="Main">
      ${user
        ? html`<a href="/app">Projects</a><a href="/app/billing">Billing</a>
          <form method="post" action="/logout"><input type="hidden" name="_csrf" value="${csrf}"><button class="linklike" type="submit">Log out</button></form>`
        : html`<a href="/#pricing">Pricing</a>${app.selfChangelogSlug ? html`<a href="/c/${app.selfChangelogSlug}">Changelog</a>` : ''}<a href="/login">Log in</a><a class="btn btn-small" href="/signup">Start free</a>`}
    </nav>
  </div>
</header>
<main>
${body}
</main>
<footer class="site-footer">
  <div class="wrap">
    <span>© ${new Date().getUTCFullYear()} ${app.appName}</span>
    <span><a href="/terms">Terms</a> · <a href="/privacy">Privacy</a> · <a href="mailto:${app.supportEmail}">Contact</a></span>
  </div>
</footer>
<script src="/app.js" defer></script>
${app.selfChangelogSlug && !user ? html`<script src="/widget.js" data-project="${app.selfChangelogSlug}" async></script>` : ''}
</body>
</html>`;
}

function flash(message, kind = 'error') {
  if (!message) return '';
  return html`<div class="flash flash-${kind}" role="${kind === 'error' ? 'alert' : 'status'}">${message}</div>`;
}

function csrfField(csrf) {
  return html`<input type="hidden" name="_csrf" value="${csrf}">`;
}

// ---------- Landing ----------

function landingPage(ctx) {
  const { app } = ctx;
  const body = html`
<section class="hero wrap">
  <span class="eyebrow">For indie makers who ship every week</span>
  <h1>Write the update once. Your users, X and LinkedIn all hear about it.</h1>
  <p class="lead">${app.appName} turns each thing you ship into a hosted changelog, an in-app “What’s new” widget, and ready-to-post drafts for X and LinkedIn.</p>
  <div class="cta">
    <a class="btn btn-large" href="/signup">Start free — no card needed</a>
    <a class="btn btn-large btn-secondary" href="#how">See how it works</a>
  </div>
</section>

<section class="wrap" id="how" aria-label="How it works">
  <div class="flow">
    <div class="mock" aria-label="Example update">
      <span class="pill pill-new">New</span>
      <div class="mock-title">CSV export for reports</div>
      <div class="muted">Download any report as CSV from the Export menu. Works with filters, up to 50k rows.</div>
    </div>
    <div class="arrow" aria-hidden="true">→</div>
    <div class="outputs">
      <div class="out"><strong>📄 Hosted changelog page</strong><span>A fast public page with RSS, on your own link.</span></div>
      <div class="out"><strong>🔔 “What’s new” widget</strong><span>One script tag. A red dot tells users something shipped.</span></div>
      <div class="out"><strong>✍️ X and LinkedIn drafts</strong><span>Sized to fit, link included. Copy, tweak, post.</span></div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Shipping is half the job. Telling people is the other half.</h2>
    <p class="sub">Most makers ship steadily and announce rarely. Users miss features, followers never see progress, and the changelog goes stale.</p>
    <div class="features">
      <div class="card"><h3>Changelog that stays current</h3><p>Tag each update as New, Improved or Fixed. Drafts stay private until you publish.</p></div>
      <div class="card"><h3>Widget in two minutes</h3><p>Paste one script tag. It loads after your page, shows an unread dot, and never blocks your app.</p></div>
      <div class="card"><h3>Posts that fit</h3><p>X drafts are counted the way X counts them, links and emoji included. LinkedIn drafts are formatted for the feed.</p></div>
      <div class="card"><h3>Weekly recap thread</h3><p>Every week, one click turns your updates into an X thread and a LinkedIn post. <em>Pro</em></p></div>
      <div class="card"><h3>RSS and JSON</h3><p>Every changelog has an RSS feed and a public JSON endpoint for your own integrations.</p></div>
      <div class="card"><h3>No tracking</h3><p>No cookies on your users, no analytics scripts. The widget remembers “last seen” in the browser only.</p></div>
    </div>
  </div>
</section>

<section class="section" id="pricing">
  <div class="wrap">
    <h2>Simple pricing</h2>
    <p class="sub">Start free. Upgrade when the changelog earns its keep.</p>
    <div class="pricing">
      <div class="card">
        <h3>Free</h3>
        <div class="price">$0</div>
        <ul>
          <li>1 project</li>
          <li>Unlimited updates</li>
          <li>Changelog page, RSS and widget</li>
          <li>X and LinkedIn drafts for every update</li>
          <li>Small “Powered by ${app.appName}” badge</li>
        </ul>
        <a class="btn btn-secondary" href="/signup">Start free</a>
      </div>
      <div class="card featured">
        <h3>Pro</h3>
        <div class="price">$${app.priceMonthlyLabel}<small>/month</small></div>
        <div class="muted small">or $${app.priceYearlyLabel}/year — two months free</div>
        <ul>
          <li>Up to ${app.plans.pro.projects} projects</li>
          <li>No ${app.appName} badge</li>
          <li>Weekly recap: X thread + LinkedIn post</li>
          <li>Everything in Free</li>
        </ul>
        <a class="btn" href="/signup?plan=pro">Start with Pro</a>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap">
    <h2>Questions</h2>
    <div class="faq">
      <details><summary>Does ${app.appName} post to X or LinkedIn for me?</summary><p>No. It writes the draft and opens X’s composer with the text filled in; you press post. Your account never gives ${app.appName} access.</p></details>
      <details><summary>Will the widget slow my app down?</summary><p>The script is small, loads with <code>async</code>, renders inside a Shadow DOM so your CSS and ours never clash, and fetches updates only after your page has loaded.</p></details>
      <details><summary>Can I cancel any time?</summary><p>Yes, from the billing page, in two clicks. You keep Pro until the end of the period you paid for, then drop back to Free. Nothing is deleted.</p></details>
      <details><summary>Can I get my data out?</summary><p>Every changelog has a public RSS feed and a JSON endpoint with the full text of every published update.</p></details>
    </div>
  </div>
</section>

<section class="section">
  <div class="wrap" style="text-align:center">
    <h2>Ship it. Then say so.</h2>
    <p class="sub">Your first changelog is live in about five minutes.</p>
    <a class="btn btn-large" href="/signup">Create your changelog</a>
  </div>
</section>`;
  return layout({ ...ctx, title: null, body });
}

// ---------- Auth pages ----------

function authPage(ctx, { mode, error, email, plan, notice, next }) {
  const isSignup = mode === 'signup';
  const body = html`
<div class="wrap narrow" style="max-width:420px">
  <div class="page-head"><h1>${isSignup ? 'Create your account' : 'Log in'}</h1></div>
  ${flash(error)}${flash(notice, 'ok')}
  <form method="post" action="${isSignup ? '/signup' : '/login'}" class="card">
    ${ctx.csrf ? csrfField(ctx.csrf) : ''}
    ${plan ? html`<input type="hidden" name="plan" value="${plan}">` : ''}
    ${next && next !== '/app' ? html`<input type="hidden" name="next" value="${next}">` : ''}
    <label for="email">Email</label>
    <input id="email" name="email" type="email" autocomplete="email" required value="${email || ''}" autofocus>
    <label for="password">Password ${isSignup ? html`<span class="hint">— at least 10 characters</span>` : ''}</label>
    <input id="password" name="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" required minlength="${isSignup ? 10 : 1}">
    <div class="form-actions">
      <button class="btn" type="submit">${isSignup ? 'Create account' : 'Log in'}</button>
      ${isSignup ? '' : html`<a class="small" href="/forgot">Forgot password?</a>`}
    </div>
  </form>
  <p class="muted small">${isSignup
    ? html`Already have an account? <a href="/login">Log in</a>. By signing up you agree to the <a href="/terms">terms</a>.`
    : html`New here? <a href="/signup">Create an account</a>.`}</p>
</div>`;
  return layout({ ...ctx, title: isSignup ? 'Sign up' : 'Log in', body, noindex: true });
}

function forgotPage(ctx, { sent, error }) {
  const body = html`
<div class="wrap narrow" style="max-width:420px">
  <div class="page-head"><h1>Reset your password</h1></div>
  ${flash(error)}
  ${sent
    ? html`<div class="card"><p>If an account exists for that email, a reset link is on its way. It works for one hour.</p><p><a href="/login">Back to log in</a></p></div>`
    : html`<form method="post" action="/forgot" class="card">
        ${ctx.csrf ? csrfField(ctx.csrf) : ''}
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" required autofocus>
        <div class="form-actions"><button class="btn" type="submit">Send reset link</button></div>
      </form>`}
</div>`;
  return layout({ ...ctx, title: 'Reset password', body, noindex: true });
}

function resetPage(ctx, { token, error, invalid }) {
  const body = html`
<div class="wrap narrow" style="max-width:420px">
  <div class="page-head"><h1>Choose a new password</h1></div>
  ${flash(error)}
  ${invalid
    ? html`<div class="card"><p>This reset link has expired or was already used.</p><p><a href="/forgot">Request a new one</a></p></div>`
    : html`<form method="post" action="/reset" class="card">
        ${ctx.csrf ? csrfField(ctx.csrf) : ''}
        <input type="hidden" name="token" value="${token}">
        <label for="password">New password <span class="hint">— at least 10 characters</span></label>
        <input id="password" name="password" type="password" autocomplete="new-password" required minlength="10" autofocus>
        <div class="form-actions"><button class="btn" type="submit">Save password</button></div>
      </form>`}
</div>`;
  return layout({ ...ctx, title: 'New password', body, noindex: true });
}

// ---------- App: projects ----------

function dashboardPage(ctx, { projects, error, canCreate, form = {} }) {
  const { csrf, user, app } = ctx;
  const createForm = html`
  <form method="post" action="/app/projects" class="card">
    ${csrfField(csrf)}
    <h2>${projects.length ? 'New project' : 'Create your first changelog'}</h2>
    <div class="grid-2">
      <div>
        <label for="name">Product name</label>
        <input id="name" name="name" type="text" required maxlength="60" placeholder="Acme Analytics" value="${form.name || ''}">
      </div>
      <div>
        <label for="slug">Changelog address <span class="hint">— letters, numbers, dashes</span></label>
        <input id="slug" name="slug" type="text" required minlength="3" maxlength="40" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="acme" value="${form.slug || ''}">
      </div>
    </div>
    <p class="muted small">Your changelog will live at <code>${app.baseUrl}/c/<span data-slug-preview>${form.slug || 'your-slug'}</span></code></p>
    <div class="form-actions"><button class="btn" type="submit">Create project</button></div>
  </form>`;

  const body = html`
<div class="wrap">
  <div class="page-head"><h1>Projects</h1><span class="muted small">${user.plan === 'pro' ? 'Pro plan' : html`Free plan · <a href="/app/billing">Upgrade</a>`}</span></div>
  ${flash(error)}
  ${projects.length
    ? html`<ul class="list" style="margin-bottom:22px">${projects.map(
        (p) => html`<li>
          <div><a class="title" href="/app/p/${p.slug}">${p.name}</a><div class="muted small">${p.published_count} published · ${p.draft_count} ${p.draft_count === 1 ? 'draft' : 'drafts'}</div></div>
          <div class="actions"><a class="btn btn-small btn-secondary" href="/c/${p.slug}" target="_blank" rel="noopener">View changelog ↗</a><a class="btn btn-small" href="/app/p/${p.slug}/entries/new">New update</a></div>
        </li>`
      )}</ul>`
    : ''}
  ${canCreate
    ? createForm
    : html`<div class="card"><h2>Need another project?</h2><p class="muted">Your plan includes ${user.plan === 'pro' ? app.plans.pro.projects : app.plans.free.projects} project${user.plan === 'pro' ? 's' : ''}. ${user.plan === 'pro' ? html`Write to <a href="mailto:${app.supportEmail}">${app.supportEmail}</a> if you need more.` : html`<a href="/app/billing">Upgrade to Pro</a> for up to ${app.plans.pro.projects}.`}</p></div>`}
</div>`;
  return layout({ ...ctx, title: 'Projects', body, noindex: true });
}

function embedSnippet(app, project) {
  return `<script src="${app.baseUrl}/widget.js" data-project="${project.slug}" async></script>`;
}

function projectPage(ctx, { project, entries, notice, error }) {
  const { csrf, app, user } = ctx;
  const body = html`
<div class="wrap">
  <div class="crumbs"><a href="/app">Projects</a> /</div>
  <div class="page-head" style="margin-top:6px">
    <h1>${project.name}</h1>
    <div class="list-actions" style="display:flex;gap:8px;flex-wrap:wrap">
      <a class="btn btn-secondary" href="/c/${project.slug}" target="_blank" rel="noopener">View changelog ↗</a>
      <a class="btn btn-secondary" href="/app/p/${project.slug}/recap">Weekly recap</a>
      <a class="btn" href="/app/p/${project.slug}/entries/new">New update</a>
    </div>
  </div>
  ${flash(notice, 'ok')}${flash(error)}
  ${entries.length
    ? html`<ul class="list">${entries.map(
        (e) => html`<li>
          <div>
            <span class="pill pill-${e.status === 'draft' ? 'draft' : e.tag}">${e.status === 'draft' ? 'Draft' : TAG_LABEL[e.tag]}</span>
            <a class="title" href="/app/p/${project.slug}/entries/${e.id}/edit">${e.title}</a>
            <div class="muted small">${e.status === 'published' ? `Published ${formatDate(e.published_at)}` : `Last edited ${formatDate(e.updated_at)}`}</div>
          </div>
          <div class="actions">
            ${e.status === 'published' ? html`<a class="btn btn-small" href="/app/p/${project.slug}/entries/${e.id}/share">Share</a>` : ''}
            <a class="btn btn-small btn-secondary" href="/app/p/${project.slug}/entries/${e.id}/edit">Edit</a>
          </div>
        </li>`
      )}</ul>`
    : html`<div class="empty"><p><strong>No updates yet.</strong></p><p>Write about the last thing you shipped — even a small fix counts.</p><a class="btn" href="/app/p/${project.slug}/entries/new">Write your first update</a></div>`}

  <div class="grid-2" style="margin-top:30px">
    <div class="card">
      <h2>Add the widget to your app</h2>
      <p class="muted small">Paste this before <code>&lt;/body&gt;</code>. A “What’s new” button appears in the bottom-right corner. To use your own button instead, give any element the attribute <code>data-weekship</code>.</p>
      <pre data-copy-source id="snippet">${embedSnippet(app, project)}</pre>
      <p class="small ${project.widget_seen_at ? '' : 'muted'}">${project.widget_seen_at
        ? html`✓ Widget last seen on <strong>${project.widget_origin.replace(/^https?:\/\//, '')}</strong>, ${formatDate(project.widget_seen_at)}.`
        : 'Not detected yet. Once the snippet is live, this shows where it runs.'}</p>
      <div class="form-actions"><button class="btn btn-small btn-secondary" type="button" data-copy="#snippet">Copy snippet</button></div>
    </div>
    <form class="card" method="post" action="/app/p/${project.slug}/settings">
      ${csrfField(csrf)}
      <h2>Settings</h2>
      <label for="name">Product name</label>
      <input id="name" name="name" type="text" required maxlength="60" value="${project.name}">
      <label for="website_url">Website <span class="hint">— linked from your changelog</span></label>
      <input id="website_url" name="website_url" type="url" maxlength="200" placeholder="https://" value="${project.website_url || ''}">
      <label for="accent">Accent colour</label>
      <input id="accent" name="accent" type="color" value="${project.accent}">
      <div class="form-actions"><button class="btn btn-small" type="submit">Save settings</button></div>
    </form>
  </div>
  <div class="card" style="margin-top:18px">
    <h2>Feeds</h2>
    <p class="small">RSS: <a href="/c/${project.slug}/rss.xml">${app.baseUrl}/c/${project.slug}/rss.xml</a><br>
    JSON: <a href="/api/v1/p/${project.slug}/entries">${app.baseUrl}/api/v1/p/${project.slug}/entries</a></p>
  </div>
  <form class="card" method="post" action="/app/p/${project.slug}/delete" data-confirm="Delete ${project.name} and all of its updates? This cannot be undone.">
    ${csrfField(csrf)}
    <h2>Delete project</h2>
    <p class="muted small">Removes the changelog page, widget and every update. This cannot be undone.</p>
    <button class="btn btn-small btn-danger" type="submit">Delete project</button>
  </form>
  ${user.plan === 'free' ? html`<p class="muted small" style="margin-top:18px">Free plan: your changelog and widget show a small “Powered by ${app.appName}” badge. <a href="/app/billing">Remove it with Pro</a>.</p>` : ''}
</div>`;
  return layout({ ...ctx, title: project.name, body, noindex: true });
}

// ---------- App: entries ----------

function entryFormPage(ctx, { project, entry, error }) {
  const { csrf } = ctx;
  const isNew = !entry.id;
  const action = isNew ? `/app/p/${project.slug}/entries` : `/app/p/${project.slug}/entries/${entry.id}`;
  const tag = entry.tag || 'new';
  const body = html`
<div class="wrap narrow">
  <div class="crumbs"><a href="/app">Projects</a> / <a href="/app/p/${project.slug}">${project.name}</a> /</div>
  <div class="page-head" style="margin-top:6px"><h1>${isNew ? 'New update' : 'Edit update'}</h1>
    ${!isNew && entry.status === 'published' ? html`<a class="btn btn-secondary" href="/app/p/${project.slug}/entries/${entry.id}/share">Share</a>` : ''}
  </div>
  ${flash(error)}
  <form method="post" action="${action}" class="card">
    ${csrfField(csrf)}
    <label for="title">What did you ship?</label>
    <input id="title" name="title" type="text" required maxlength="120" placeholder="CSV export for reports" value="${entry.title || ''}" ${isNew ? raw('autofocus') : ''}>
    <label>Type</label>
    <div class="radio-row" role="radiogroup">
      ${['new', 'improved', 'fixed'].map(
        (t) => html`<label><input type="radio" name="tag" value="${t}" ${t === tag ? raw('checked') : ''}> ${TAG_LABEL[t]}</label>`
      )}
    </div>
    <label for="body">Details <span class="hint">— supports **bold**, *italic*, \`code\`, [links](https://…) and “- ” lists</span></label>
    <textarea id="body" name="body" maxlength="10000" placeholder="What changed, and why it matters to your users.">${entry.body || ''}</textarea>
    <div class="form-actions">
      <button class="btn" type="submit" name="intent" value="publish">${entry.status === 'published' ? 'Save' : 'Publish'}</button>
      ${entry.status === 'published'
        ? html`<button class="btn btn-secondary" type="submit" name="intent" value="unpublish">Move back to drafts</button>`
        : html`<button class="btn btn-secondary" type="submit" name="intent" value="draft">Save draft</button>`}
      <a class="small" href="/app/p/${project.slug}">Cancel</a>
    </div>
  </form>
  ${isNew
    ? ''
    : html`<form method="post" action="/app/p/${project.slug}/entries/${entry.id}/delete" data-confirm="Delete this update? This cannot be undone." style="margin-top:18px">
        ${csrfField(csrf)}<button class="btn btn-small btn-danger" type="submit">Delete update</button>
      </form>`}
</div>`;
  return layout({ ...ctx, title: isNew ? 'New update' : 'Edit update', body, noindex: true });
}

function draftBlock({ id, label, text, limit, count, intentUrl }) {
  const over = count > limit;
  return html`<div class="card post-draft">
    <h2>${label}</h2>
    <pre id="${id}">${text}</pre>
    <div class="post-meta">
      <span class="${over ? 'over' : 'muted'}">${count} / ${limit} characters</span>
      <span style="display:flex;gap:8px">
        <button class="btn btn-small btn-secondary" type="button" data-copy="#${id}">Copy</button>
        ${intentUrl ? html`<a class="btn btn-small" href="${intentUrl}" target="_blank" rel="noopener">Open in X ↗</a>` : ''}
      </span>
    </div>
  </div>`;
}

function sharePage(ctx, { project, entry, x, linkedin, entryUrl, published }) {
  const body = html`
<div class="wrap">
  <div class="crumbs"><a href="/app">Projects</a> / <a href="/app/p/${project.slug}">${project.name}</a> /</div>
  <div class="page-head" style="margin-top:6px"><h1>Share “${entry.title}”</h1><a class="btn btn-secondary" href="${entryUrl}" target="_blank" rel="noopener">View on changelog ↗</a></div>
  ${published ? flash('Published. Your changelog and widget are updated — now tell people.', 'ok') : ''}
  <p class="muted">Edit the text to sound like you, then post. Nothing is posted automatically.</p>
  <div class="grid-2">
    ${draftBlock({ id: 'x-post', label: 'X post', text: x, limit: X_LIMIT, count: xLength(x), intentUrl: xIntentUrl(x) })}
    ${draftBlock({ id: 'li-post', label: 'LinkedIn post', text: linkedin, limit: LINKEDIN_LIMIT, count: linkedin.length })}
  </div>
</div>`;
  return layout({ ...ctx, title: 'Share update', body, noindex: true });
}

function recapPage(ctx, { project, entries, recap, locked }) {
  const { app } = ctx;
  let content;
  if (locked) {
    content = html`<div class="card"><h2>Weekly recap is a Pro feature</h2>
      <p>Pro turns everything you published in the last 7 days into an X thread and a LinkedIn post, ready to copy.</p>
      <a class="btn" href="/app/billing">Upgrade to Pro — $${app.priceMonthlyLabel}/month</a></div>`;
  } else if (!entries.length) {
    content = html`<div class="empty"><p><strong>Nothing published in the last 7 days.</strong></p><p>Publish an update and it will appear here.</p><a class="btn" href="/app/p/${project.slug}/entries/new">New update</a></div>`;
  } else {
    content = html`
    <div class="grid-2">
      <div>
        <h2 style="font-size:18px">X thread · ${recap.thread.length} posts</h2>
        ${recap.thread.map((text, i) =>
          draftBlock({ id: `thread-${i}`, label: `Post ${i + 1}`, text, limit: X_LIMIT, count: xLength(text), intentUrl: i === 0 ? xIntentUrl(text) : null })
        )}
      </div>
      <div>
        <h2 style="font-size:18px">LinkedIn</h2>
        ${draftBlock({ id: 'li-recap', label: 'LinkedIn post', text: recap.linkedin, limit: LINKEDIN_LIMIT, count: recap.linkedin.length })}
      </div>
    </div>`;
  }
  const body = html`
<div class="wrap">
  <div class="crumbs"><a href="/app">Projects</a> / <a href="/app/p/${project.slug}">${project.name}</a> /</div>
  <div class="page-head" style="margin-top:6px"><h1>Weekly recap</h1><span class="muted small">Updates published in the last 7 days</span></div>
  ${content}
</div>`;
  return layout({ ...ctx, title: 'Weekly recap', body, noindex: true });
}

// ---------- Billing ----------

function billingPage(ctx, { billingEnabled, checkout, error }) {
  const { user, csrf, app } = ctx;
  const isPro = user.plan === 'pro';
  const renewal = user.current_period_end ? formatDate(user.current_period_end * 1000) : null;
  const body = html`
<div class="wrap narrow">
  <div class="page-head"><h1>Billing</h1></div>
  ${checkout === 'success' ? flash(isPro ? 'Thanks — Pro is active.' : 'Payment received. Pro will switch on within a minute; refresh this page shortly.', 'ok') : ''}
  ${checkout === 'cancelled' ? flash('Checkout cancelled. You have not been charged.', 'ok') : ''}
  ${flash(error)}
  <div class="card">
    <h2>Current plan: ${isPro ? 'Pro' : 'Free'}</h2>
    ${isPro
      ? html`<p class="muted">Status: ${user.subscription_status || 'active'}${renewal ? html` · current period ends ${renewal}` : ''}</p>
        ${billingEnabled && user.stripe_customer_id
          ? html`<form method="post" action="/app/billing/portal">${csrfField(csrf)}<button class="btn btn-secondary" type="submit">Manage subscription, invoices and cancellation</button></form>`
          : ''}`
      : html`<p>Pro removes the badge, adds the weekly recap, and allows up to ${app.plans.pro.projects} projects.</p>
        ${billingEnabled
          ? html`<div class="form-actions">
              <form method="post" action="/app/billing/checkout">${csrfField(csrf)}<input type="hidden" name="interval" value="month"><button class="btn" type="submit">Upgrade — $${app.priceMonthlyLabel}/month</button></form>
              ${app.hasYearly ? html`<form method="post" action="/app/billing/checkout">${csrfField(csrf)}<input type="hidden" name="interval" value="year"><button class="btn btn-secondary" type="submit">$${app.priceYearlyLabel}/year</button></form>` : ''}
            </div>
            <p class="muted small">Secure checkout by Stripe. Cancel any time.</p>`
          : html`<p class="muted">Payments are not configured on this server yet.</p>`}`}
  </div>
  <form class="card" method="post" action="/app/account/delete" data-confirm="Delete your account, all projects and all updates? This cannot be undone.">
    ${csrfField(csrf)}
    <h2>Account</h2>
    <p class="muted small">Signed in as ${user.email}. Deleting your account removes every project and update${isPro ? ' — cancel your subscription above first' : ''}.</p>
    <button class="btn btn-small btn-danger" type="submit" ${isPro && user.subscription_status !== 'canceled' ? raw('disabled title="Cancel your subscription first"') : ''}>Delete account</button>
  </form>
</div>`;
  return layout({ ...ctx, title: 'Billing', body, noindex: true });
}

// ---------- Public changelog ----------

function poweredBadge(app) {
  return html`<a class="badge-powered" href="${app.baseUrl}/?ref=badge" target="_blank" rel="noopener">⚡ Powered by ${app.appName}</a>`;
}

function publicEntry(project, entry) {
  return html`<article class="cl-entry" id="update-${entry.id}">
    <div><time datetime="${new Date(entry.published_at).toISOString()}">${formatDate(entry.published_at)}</time></div>
    <div>
      <span class="pill pill-${entry.tag}">${TAG_LABEL[entry.tag]}</span>
      <h2><a href="/c/${project.slug}/${entry.id}">${entry.title}</a></h2>
      <div class="cl-body">${raw(entry.html)}</div>
    </div>
  </article>`;
}

function changelogPage(ctx, { project, entries, showBadge, single }) {
  const { app } = ctx;
  const feedUrl = `${app.baseUrl}/c/${project.slug}/rss.xml`;
  const pageUrl = single ? `${app.baseUrl}/c/${project.slug}/${single.id}` : `${app.baseUrl}/c/${project.slug}`;
  const title = single ? `${single.title} — ${project.name}` : `${project.name} changelog`;
  const description = single ? single.summary : `New features, improvements and fixes in ${project.name}.`;
  const head = html`
<link rel="alternate" type="application/rss+xml" title="${project.name} changelog" href="${feedUrl}">
<link rel="canonical" href="${pageUrl}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:type" content="${single ? 'article' : 'website'}">
<meta name="twitter:card" content="summary">`;
  const body = html`
<div class="wrap narrow">
  <header class="cl-header">
    ${single ? html`<p style="margin:0 0 10px"><a href="/c/${project.slug}">← All updates</a></p>` : ''}
    <h1>${single ? project.name : `What’s new in ${project.name}`}</h1>
    <p>${project.website_url ? html`<a href="${project.website_url}" rel="noopener">${project.website_url.replace(/^https?:\/\//, '')}</a> · ` : ''}<a href="${feedUrl}">RSS</a></p>
  </header>
  ${entries.length ? entries.map((e) => publicEntry(project, e)) : html`<div class="empty">No updates published yet.</div>`}
  ${showBadge ? html`<p style="margin-top:30px">${poweredBadge(app)}</p>` : ''}
</div>`;
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<meta name="description" content="${description}">
<link rel="stylesheet" href="/style.css">
<style>:root{--accent:${project.accent}}</style>
${head}
</head>
<body><main>${body}</main></body>
</html>`;
}

function messagePage(ctx, { title, message, status }) {
  const body = html`<div class="wrap narrow"><div class="page-head"><h1>${title}</h1></div><p>${message}</p><p><a href="/">Go to the home page</a></p></div>`;
  return layout({ ...ctx, title: title || String(status), body, noindex: true });
}

function legalPage(ctx, { kind }) {
  const { app } = ctx;
  const isTerms = kind === 'terms';
  const body = isTerms
    ? html`<div class="wrap narrow"><div class="page-head"><h1>Terms of service</h1></div>
      <p>${app.appName} provides hosted changelog pages, an embeddable widget and post drafts. By using it you agree to these terms.</p>
      <h2>Your content</h2><p>You own what you write. You give us permission to host and display it on your changelog, widget, feeds and API. Do not publish anything unlawful or anything you have no right to share.</p>
      <h2>Payments</h2><p>Pro is billed in advance each month or year through Stripe. You can cancel at any time from the billing page; Pro stays active until the end of the paid period. We do not give partial refunds unless the law requires it.</p>
      <h2>Availability</h2><p>We work to keep the service fast and available but cannot guarantee it will never be interrupted. The service is provided “as is”.</p>
      <h2>Ending</h2><p>You can delete your account at any time. We may suspend accounts that abuse the service.</p>
      <h2>Contact</h2><p><a href="mailto:${app.supportEmail}">${app.supportEmail}</a></p></div>`
    : html`<div class="wrap narrow"><div class="page-head"><h1>Privacy</h1></div>
      <h2>What we store</h2><p>Your email address, a salted hash of your password, your projects and updates, and, if you subscribe, your Stripe customer and subscription IDs. Card details are handled by Stripe and never reach our servers.</p>
      <h2>Your users</h2><p>The widget sets no cookies and sends no analytics. It stores the time of the latest update a visitor has seen in that visitor’s browser (localStorage) to show the unread dot.</p>
      <h2>Cookies</h2><p>We set one cookie, to keep you signed in. No advertising or analytics cookies.</p>
      <h2>Processors</h2><p>Stripe (payments), Resend (password reset email) and our hosting provider.</p>
      <h2>Deletion</h2><p>Deleting your account removes your data from our database immediately and from backups within 30 days.</p>
      <h2>Contact</h2><p><a href="mailto:${app.supportEmail}">${app.supportEmail}</a></p></div>`;
  return layout({ ...ctx, title: isTerms ? 'Terms' : 'Privacy', body });
}

module.exports = {
  landingPage,
  authPage,
  forgotPage,
  resetPage,
  dashboardPage,
  projectPage,
  entryFormPage,
  sharePage,
  recapPage,
  billingPage,
  changelogPage,
  messagePage,
  legalPage,
  embedSnippet,
  formatDate,
};
