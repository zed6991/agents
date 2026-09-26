'use strict';

const crypto = require('crypto');

const SESSION_COOKIE = 'ws_session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return crypto.timingSafeEqual(expected, actual);
}

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseCookies(header) {
  const cookies = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    try {
      cookies[key] = decodeURIComponent(part.slice(index + 1).trim());
    } catch {
      // Ignore malformed cookie values.
    }
  }
  return cookies;
}

function createSessionStore(db) {
  const insert = db.prepare('INSERT INTO sessions (token_hash, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)');
  const find = db.prepare(`
    SELECT s.token_hash, s.csrf_token, s.expires_at, u.*
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?`);
  const remove = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const removeForUser = db.prepare('DELETE FROM sessions WHERE user_id = ?');
  const purge = db.prepare('DELETE FROM sessions WHERE expires_at < ?');

  return {
    create(userId) {
      const token = randomToken();
      insert.run(sha256(token), userId, randomToken(24), Date.now() + SESSION_TTL_MS);
      return token;
    },
    lookup(token) {
      if (!token) return null;
      const row = find.get(sha256(token));
      if (!row) return null;
      if (row.expires_at < Date.now()) {
        remove.run(row.token_hash);
        return null;
      }
      const { token_hash, csrf_token, expires_at, password_hash, ...user } = row;
      return { tokenHash: token_hash, csrfToken: csrf_token, user };
    },
    destroy(tokenHash) {
      remove.run(tokenHash);
    },
    destroyAllForUser(userId) {
      removeForUser.run(userId);
    },
    purgeExpired() {
      purge.run(Date.now());
    },
  };
}

function sessionCookie(token, { secure }) {
  const attrs = [`${SESSION_COOKIE}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_TTL_MS / 1000}`];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

function clearSessionCookie({ secure }) {
  const attrs = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}

// Fixed-window rate limiter kept in memory. Good enough for a single instance.
function createRateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return {
    hit(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.resetAt <= now) {
        hits.set(key, { count: 1, resetAt: now + windowMs });
        if (hits.size > 10000) {
          for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
        }
        return true;
      }
      entry.count += 1;
      return entry.count <= limit;
    },
  };
}

module.exports = {
  SESSION_COOKIE,
  hashPassword,
  verifyPassword,
  randomToken,
  sha256,
  parseCookies,
  createSessionStore,
  sessionCookie,
  clearSessionCookie,
  createRateLimiter,
};
