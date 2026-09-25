'use strict';

const { toPlainText } = require('./markdown');

// Social post drafts built from changelog entries. Pure functions, no network.

const X_LIMIT = 280;
const X_URL_LENGTH = 23; // X wraps every link in t.co, which counts as 23.
const LINKEDIN_LIMIT = 3000;

const TAG_EMOJI = { new: '✨', improved: '⚡', fixed: '🐛' };
const TAG_LABEL = { new: 'New', improved: 'Improved', fixed: 'Fixed' };

// Weighted length per X's counting rules (twitter-text v3): most Latin and
// punctuation code points weigh 1, everything else (CJK, emoji) weighs 2.
function codePointWeight(cp) {
  if (cp <= 0x10ff) return 1;
  if (cp >= 0x2000 && cp <= 0x200d) return 1;
  if (cp >= 0x2010 && cp <= 0x201f) return 1;
  if (cp >= 0x2032 && cp <= 0x2037) return 1;
  return 2;
}

const URL_PATTERN = /https?:\/\/\S+/g;

function xLength(text) {
  let length = 0;
  const withoutUrls = text.replace(URL_PATTERN, () => {
    length += X_URL_LENGTH;
    return '';
  });
  for (const ch of withoutUrls) length += codePointWeight(ch.codePointAt(0));
  return length;
}

// Cut `text` so that it fits in `budget` weighted characters, preferring a
// word boundary, and add an ellipsis when anything was removed.
function truncateToWeight(text, budget) {
  if (xLength(text) <= budget) return text;
  const ellipsis = xLength('…');
  if (budget <= ellipsis) return '';
  const chars = Array.from(text);
  let used = 0;
  let cut = 0;
  for (; cut < chars.length; cut++) {
    const w = codePointWeight(chars[cut].codePointAt(0));
    if (used + w > budget - ellipsis) break;
    used += w;
  }
  let result = chars.slice(0, cut).join('');
  const lastSpace = result.lastIndexOf(' ');
  if (lastSpace > result.length * 0.6) result = result.slice(0, lastSpace);
  return result.replace(/[\s.,;:!?→-]+$/u, '') + '…';
}

function summaryOf(body) {
  return toPlainText(body).replace(/\s*\n+\s*/g, ' ').trim();
}

function xPost({ entry, url, hashtag = '#buildinpublic' }) {
  const emoji = TAG_EMOJI[entry.tag] || TAG_EMOJI.new;
  const head = `${emoji} ${entry.title.trim()}`;
  const tail = `\n\n${url}`;
  const summary = summaryOf(entry.body);

  const assemble = (withTag, text) =>
    [head, text ? `\n\n${text}` : '', tail, withTag ? `\n\n${hashtag}` : ''].join('');

  // Keep the hashtag only when the whole summary still fits alongside it.
  if (hashtag && xLength(assemble(true, summary)) <= X_LIMIT) return assemble(true, summary);

  const fixed = xLength(assemble(false, ''));
  if (fixed <= X_LIMIT) {
    const room = X_LIMIT - fixed - 2; // the "\n\n" before the summary
    const text = summary && room > 10 ? truncateToWeight(summary, room) : '';
    return assemble(false, text);
  }
  // Title alone is too long: shorten it.
  const room = X_LIMIT - xLength(tail) - xLength(`${emoji} `);
  return `${emoji} ${truncateToWeight(entry.title.trim(), room)}${tail}`;
}

function linkedinPost({ entry, projectName, url }) {
  const label = TAG_LABEL[entry.tag] || TAG_LABEL.new;
  const body = toPlainText(entry.body);
  const intro = `${label} in ${projectName}: ${entry.title.trim()}`;
  const outro = `Full changelog: ${url}\n\n#buildinpublic #indiehackers`;
  const room = LINKEDIN_LIMIT - intro.length - outro.length - 4;
  const text = body.length > room ? body.slice(0, Math.max(0, room - 1)).trimEnd() + '…' : body;
  return [intro, text, outro].filter(Boolean).join('\n\n');
}

// Weekly recap: an X thread (array of posts) and one LinkedIn post.
function weeklyRecap({ entries, projectName, changelogUrl, entryUrl }) {
  const count = entries.length;
  const noun = count === 1 ? 'update' : 'updates';
  const opener = truncateToWeight(
    `This week I shipped ${count} ${noun} to ${projectName} 🧵\n\nHere's what changed 👇`,
    X_LIMIT
  );
  const thread = [opener];
  entries.forEach((entry, i) => {
    const emoji = TAG_EMOJI[entry.tag] || TAG_EMOJI.new;
    const head = `${i + 1}/ ${emoji} ${entry.title.trim()}`;
    const summary = summaryOf(entry.body);
    const room = X_LIMIT - xLength(head) - 2;
    thread.push(summary && room > 20 ? `${head}\n\n${truncateToWeight(summary, room)}` : truncateToWeight(head, X_LIMIT));
  });
  thread.push(`Everything I ship goes on the changelog:\n${changelogUrl}\n\n#buildinpublic`);

  const bullets = entries
    .map((entry) => `${TAG_EMOJI[entry.tag] || TAG_EMOJI.new} ${entry.title.trim()} → ${entryUrl(entry)}`)
    .join('\n');
  const linkedin = [
    `Weekly shipping log for ${projectName}: ${count} ${noun} this week.`,
    bullets,
    `Building in public means showing the work, one week at a time. Full changelog: ${changelogUrl}`,
    '#buildinpublic #indiehackers #saas',
  ].join('\n\n');

  return { thread, linkedin: linkedin.length > LINKEDIN_LIMIT ? linkedin.slice(0, LINKEDIN_LIMIT - 1) + '…' : linkedin };
}

function xIntentUrl(text) {
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}`;
}

module.exports = {
  xPost,
  linkedinPost,
  weeklyRecap,
  xLength,
  truncateToWeight,
  xIntentUrl,
  TAG_LABEL,
  TAG_EMOJI,
  X_LIMIT,
  LINKEDIN_LIMIT,
};
