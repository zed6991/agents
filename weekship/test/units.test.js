'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { renderMarkdown, toPlainText } = require('../src/markdown');
const { xPost, linkedinPost, weeklyRecap, xLength, truncateToWeight, X_LIMIT } = require('../src/posts');
const { hashPassword, verifyPassword, parseCookies, createRateLimiter } = require('../src/auth');
const { html, raw } = require('../src/html');
const { loadConfig } = require('../src/config');

test('html escapes interpolations but not nested html', () => {
  const inner = html`<b>${'<i>'}</b>`;
  assert.equal(String(html`<p>${'<script>"x"</script>'}${inner}${raw('<br>')}</p>`),
    '<p>&lt;script&gt;&quot;x&quot;&lt;/script&gt;<b>&lt;i&gt;</b><br></p>');
  assert.equal(String(html`${null}${undefined}${false}${0}`), '0');
});

test('markdown renders the supported subset', () => {
  const out = renderMarkdown('Hello **world** and *you*.\nSecond `line`\n\n- one\n- [two](https://example.com/a?b=1&c=2)');
  assert.match(out, /<p>Hello <strong>world<\/strong> and <em>you<\/em>\.<br>Second <code>line<\/code><\/p>/);
  assert.match(out, /<ul><li>one<\/li><li><a href="https:\/\/example.com\/a\?b=1&amp;c=2" rel="noopener nofollow ugc" target="_blank">two<\/a><\/li><\/ul>/);
});

test('markdown cannot produce script, event handlers or unsafe links', () => {
  const nasty = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '[click](javascript:alert(1))',
    '[click](data:text/html,<script>alert(1)</script>)',
    '[x](https://ok.com" onmouseover="alert(1))',
    '`<b>`',
  ].join('\n\n');
  const out = renderMarkdown(nasty);
  assert.doesNotMatch(out, /<script|<img|href="javascript|href="data/i);
  assert.doesNotMatch(out, /" onmouseover="/);
  assert.match(out, /<code>&lt;b&gt;<\/code>/);
});

test('plain text strips markdown for social posts', () => {
  assert.equal(toPlainText('**Bold** and `code`\n- item\n- [link](https://a.io)'), 'Bold and code\n→ item\n→ link (https://a.io)');
});

test('xLength counts URLs as 23 and emoji as 2', () => {
  assert.equal(xLength('hello'), 5);
  assert.equal(xLength('https://example.com/a/very/long/path/that/goes/on'), 23);
  assert.equal(xLength('✨'), 2);
  assert.equal(xLength('café — “quotes”'), 15);
});

test('truncateToWeight respects the budget and adds an ellipsis', () => {
  const text = 'word '.repeat(100).trim();
  const cut = truncateToWeight(text, 50);
  assert.ok(xLength(cut) <= 50, `length ${xLength(cut)}`);
  assert.ok(cut.endsWith('…'));
  assert.equal(truncateToWeight('short', 50), 'short');
});

test('X post always fits in 280 and includes the link', () => {
  const url = 'https://weekship.app/c/acme/42';
  const cases = [
    { title: 'CSV export', body: 'Download reports as CSV.', tag: 'new' },
    { title: 'A'.repeat(400), body: '', tag: 'fixed' },
    { title: 'Faster search', body: 'Search is quicker now. '.repeat(40), tag: 'improved' },
    { title: '絵文字 🚀🚀🚀', body: '日本語のテキスト。'.repeat(60), tag: 'new' },
  ];
  for (const entry of cases) {
    const post = xPost({ entry, url });
    assert.ok(xLength(post) <= X_LIMIT, `too long (${xLength(post)}): ${post}`);
    assert.ok(post.includes(url));
  }
  const short = xPost({ entry: cases[0], url });
  assert.equal(short, `✨ CSV export\n\nDownload reports as CSV.\n\n${url}\n\n#buildinpublic`);
  assert.ok(!xPost({ entry: cases[2], url }).includes('#buildinpublic'), 'hashtag dropped when the body is cut');
});

test('LinkedIn post has intro, plain body and link', () => {
  const post = linkedinPost({
    entry: { title: 'CSV export', body: '**Fast** export\n- filters work', tag: 'new' },
    projectName: 'Acme',
    url: 'https://x.test/c/acme/1',
  });
  assert.equal(post, 'New in Acme: CSV export\n\nFast export\n→ filters work\n\nFull changelog: https://x.test/c/acme/1\n\n#buildinpublic #indiehackers');
  const long = linkedinPost({ entry: { title: 'T', body: 'x'.repeat(5000), tag: 'fixed' }, projectName: 'A', url: 'https://x.test' });
  assert.ok(long.length <= 3000);
});

test('weekly recap builds a thread where every post fits', () => {
  const entries = Array.from({ length: 4 }, (_, i) => ({ id: i + 1, title: `Update ${i + 1}`, body: 'Detail. '.repeat(80), tag: 'improved' }));
  const recap = weeklyRecap({ entries, projectName: 'Acme', changelogUrl: 'https://x.test/c/acme', entryUrl: (e) => `https://x.test/c/acme/${e.id}` });
  assert.equal(recap.thread.length, 6);
  assert.match(recap.thread[0], /shipped 4 updates to Acme/);
  for (const post of recap.thread) assert.ok(xLength(post) <= X_LIMIT);
  assert.match(recap.linkedin, /https:\/\/x.test\/c\/acme\/3/);
});

test('password hashing verifies the right password only', () => {
  const stored = hashPassword('correct horse battery');
  assert.ok(stored.startsWith('scrypt$'));
  assert.ok(verifyPassword('correct horse battery', stored));
  assert.ok(!verifyPassword('wrong horse battery', stored));
  assert.ok(!verifyPassword('x', 'garbage'));
});

test('cookie parsing tolerates junk', () => {
  assert.deepEqual(parseCookies('a=1; b=%E0%A4%A; c=x=y'), { a: '1', c: 'x=y' });
});

test('rate limiter blocks after the limit', () => {
  const limiter = createRateLimiter({ limit: 2, windowMs: 1000 });
  assert.ok(limiter.hit('k'));
  assert.ok(limiter.hit('k'));
  assert.ok(!limiter.hit('k'));
  assert.ok(limiter.hit('other'));
});

test('config refuses live Stripe keys unless explicitly allowed', () => {
  assert.throws(() => loadConfig({ STRIPE_SECRET_KEY: 'sk_live_abc' }), /live Stripe key/);
  assert.doesNotThrow(() => loadConfig({ STRIPE_SECRET_KEY: 'sk_live_abc', ALLOW_LIVE_STRIPE: 'true' }));
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /BASE_URL/);
});
