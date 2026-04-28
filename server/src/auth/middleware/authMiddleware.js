import { getCurrentUserById } from '../services/authService.js';
import { verifyAccessToken } from '../services/tokenService.js';

function extractBearerToken(req) {
  const rawHeader = req.headers.authorization || '';
  if (!rawHeader.startsWith('Bearer ')) return null;
  return rawHeader.slice('Bearer '.length).trim();
}

function unauthorized(res, error = 'Not authenticated') {
  return res.status(401).json({ error, code: 'AUTH_UNAUTHORIZED' });
}

function forbidden(res, permission) {
  return res.status(403).json({ error: 'Forbidden', code: 'AUTH_FORBIDDEN', requiredPermission: permission });
}

function attachAuth(req) {
  const token = extractBearerToken(req);
  if (!token) {
    return null;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = getCurrentUserById(Number(payload.sub));
    if (!user) {
      return null;
    }
    req.auth = {
      userId: user.id,
      user,
      roles: user.roles || [],
      permissions: user.permissions || []
    };
    return req.auth;
  } catch (_error) {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const auth = attachAuth(req);
  if (!auth) {
    return unauthorized(res);
  }
  return next();
}

export function attachAuthIfPresent(req, _res, next) {
  attachAuth(req);
  return next();
}

export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.auth) {
      const auth = attachAuth(req);
      if (!auth) {
        return unauthorized(res);
      }
    }
    if (!req.auth.permissions.includes(permission)) {
      return forbidden(res, permission);
    }
    return next();
  };
}

export function isOwnResource(req, targetUserId) {
  return req.auth && Number(req.auth.userId) === Number(targetUserId);
}
