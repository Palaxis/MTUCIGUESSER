import bcrypt from 'bcrypt';
import {
  assignRoleByName,
  createRefreshSession,
  createUser,
  getRefreshSessionByJti,
  getUserByEmail,
  getUserById,
  getUserPermissions,
  getUserRoles,
  revokeAllRefreshSessionsByUserId,
  revokeRefreshSessionById
} from '../repositories/authRepository.js';
import {
  getRefreshCookieOptions,
  getRefreshTokenExpiryDate,
  makeJti,
  makeTokenHash,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken
} from './tokenService.js';

export function buildUserWithAccess(user) {
  return {
    ...user,
    roles: getUserRoles(user.id),
    permissions: getUserPermissions(user.id)
  };
}

function buildAuthPayload(user, reqMeta) {
  const jti = makeJti();
  const refreshToken = signRefreshToken({ userId: user.id, jti });
  const refreshTokenHash = makeTokenHash(refreshToken);
  const refreshExpiresAt = getRefreshTokenExpiryDate();
  createRefreshSession({
    userId: user.id,
    jti,
    tokenHash: refreshTokenHash,
    expiresAt: refreshExpiresAt.toISOString(),
    userAgent: reqMeta.userAgent,
    ip: reqMeta.ip
  });

  return {
    accessToken: signAccessToken(user.id),
    refreshToken,
    refreshCookieOptions: getRefreshCookieOptions(),
    user: buildUserWithAccess(user)
  };
}

export async function registerUser(payload, reqMeta) {
  const { first_name, last_name, email, password } = payload || {};
  if (!first_name || !last_name || !email || !password) {
    return { status: 400, body: { error: 'All fields required' } };
  }

  const existing = getUserByEmail(email);
  if (existing) {
    return { status: 400, body: { error: 'Email already registered' } };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = createUser({
    firstName: first_name,
    lastName: last_name,
    email,
    passwordHash
  });
  assignRoleByName(user.id, 'player');

  const authPayload = buildAuthPayload(user, reqMeta);
  return {
    status: 201,
    body: { user: authPayload.user, accessToken: authPayload.accessToken },
    refreshToken: authPayload.refreshToken,
    refreshCookieOptions: authPayload.refreshCookieOptions
  };
}

export async function loginUser(payload, reqMeta) {
  const { email, password } = payload || {};
  if (!email || !password) {
    return { status: 400, body: { error: 'Email and password required' } };
  }

  const userRecord = getUserByEmail(email);
  if (!userRecord) {
    return { status: 401, body: { error: 'Invalid credentials' } };
  }

  const valid = await bcrypt.compare(password, userRecord.password_hash);
  if (!valid) {
    return { status: 401, body: { error: 'Invalid credentials' } };
  }

  const user = {
    id: userRecord.id,
    first_name: userRecord.first_name,
    last_name: userRecord.last_name,
    email: userRecord.email,
    avatar_url: userRecord.avatar_url
  };
  const authPayload = buildAuthPayload(user, reqMeta);
  return {
    status: 200,
    body: { user: authPayload.user, accessToken: authPayload.accessToken },
    refreshToken: authPayload.refreshToken,
    refreshCookieOptions: authPayload.refreshCookieOptions
  };
}

export function getCurrentUserById(userId) {
  const user = getUserById(userId);
  if (!user) return null;
  return buildUserWithAccess(user);
}

export function refreshAuth(rawRefreshToken, reqMeta) {
  if (!rawRefreshToken) {
    return { status: 401, body: { error: 'Refresh token missing' } };
  }

  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch (_error) {
    return { status: 401, body: { error: 'Invalid refresh token' } };
  }

  const session = getRefreshSessionByJti(payload.jti);
  if (!session) {
    return { status: 401, body: { error: 'Refresh session not found' } };
  }

  const presentedHash = makeTokenHash(rawRefreshToken);
  const isHashMismatch = session.token_hash !== presentedHash;
  const isExpired = Date.now() > new Date(session.expires_at).getTime();
  const isRevoked = Boolean(session.revoked_at);

  if (isRevoked || isHashMismatch || isExpired) {
    // Replay protection: revoke all user sessions if revoked token was presented again.
    if (isRevoked) {
      revokeAllRefreshSessionsByUserId(session.user_id);
      console.warn(`Refresh token replay detected for user ${session.user_id} (jti=${session.jti})`);
    }
    return { status: 401, body: { error: 'Refresh token is not active' } };
  }

  const user = getUserById(session.user_id);
  if (!user) {
    revokeRefreshSessionById(session.id);
    return { status: 401, body: { error: 'User not found' } };
  }

  revokeRefreshSessionById(session.id);
  const authPayload = buildAuthPayload(user, reqMeta);
  return {
    status: 200,
    body: { user: authPayload.user, accessToken: authPayload.accessToken },
    refreshToken: authPayload.refreshToken,
    refreshCookieOptions: authPayload.refreshCookieOptions
  };
}

export function logout(rawRefreshToken) {
  if (!rawRefreshToken) {
    return { status: 200, body: { ok: true } };
  }

  try {
    const payload = verifyRefreshToken(rawRefreshToken);
    const session = getRefreshSessionByJti(payload.jti);
    if (session) {
      revokeRefreshSessionById(session.id);
    }
  } catch (_error) {
    // If token is invalid, logout still succeeds and cookie is cleared.
  }

  return { status: 200, body: { ok: true } };
}
