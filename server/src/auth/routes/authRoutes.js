import { Router } from 'express';
import { getCurrentUserById, loginUser, logout, refreshAuth, registerUser } from '../services/authService.js';
import { getRefreshCookieOptions } from '../services/tokenService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const REFRESH_COOKIE_NAME = 'refreshToken';

function reqMeta(req) {
  return {
    userAgent: req.get('user-agent') || null,
    ip: req.ip || null
  };
}

export function createAuthRouter() {
  const router = Router();

  router.post('/register', async (req, res) => {
    try {
      const result = await registerUser(req.body, reqMeta(req));
      if (result.refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, result.refreshCookieOptions);
      }
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to register' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const result = await loginUser(req.body, reqMeta(req));
      if (result.refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, result.refreshCookieOptions);
      }
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to login' });
    }
  });

  router.post('/refresh', (req, res) => {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      const result = refreshAuth(refreshToken, reqMeta(req));
      if (result.refreshToken) {
        res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, result.refreshCookieOptions);
      }
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to refresh auth session' });
    }
  });

  router.get('/me', requireAuth, (req, res) => {
    const user = getCurrentUserById(req.auth.userId);
    if (!user) {
      return res.status(401).json({ error: 'Not authenticated', code: 'AUTH_UNAUTHORIZED' });
    }
    return res.json(user);
  });

  router.post('/logout', (req, res) => {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE_NAME];
      const result = logout(refreshToken);
      res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
      return res.status(result.status).json(result.body);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
  });

  return router;
}
