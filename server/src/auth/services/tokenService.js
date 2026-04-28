import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7);
const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET || 'mtuci-access-secret';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_REFRESH_SECRET || 'mtuci-refresh-secret';

export function signAccessToken(userId) {
  return jwt.sign({ sub: String(userId), type: 'access' }, ACCESS_TOKEN_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export function signRefreshToken({ userId, jti }) {
  return jwt.sign({ sub: String(userId), jti, type: 'refresh' }, REFRESH_TOKEN_SECRET, { expiresIn: REFRESH_TOKEN_TTL_SECONDS });
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function verifyRefreshToken(token) {
  const payload = jwt.verify(token, REFRESH_TOKEN_SECRET);
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function makeJti() {
  return crypto.randomUUID();
}

export function makeTokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function getRefreshTokenExpiryDate() {
  return new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000);
}

export function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_TTL_SECONDS * 1000
  };
}
