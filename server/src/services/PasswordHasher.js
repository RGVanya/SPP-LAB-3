const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

// Параметры OWASP для scrypt: N=2^14, r=8, p=1.
const PARAMS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

class PasswordHasher {
  async hash(password) {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const key = await scrypt(password, salt, KEY_LENGTH, PARAMS);
    const { N, r, p } = PARAMS;
    return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
  }

  async verify(password, stored) {
    const [scheme, N, r, p, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const expected = Buffer.from(hash, 'base64');
    const key = await scrypt(password, Buffer.from(salt, 'base64'), expected.length, {
      N: Number(N),
      r: Number(r),
      p: Number(p),
    });
    return crypto.timingSafeEqual(key, expected);
  }
}

module.exports = { PasswordHasher };
