import db from '../../db.js';

const getUserByIdStmt = db.prepare('SELECT id, first_name, last_name, email, avatar_url FROM users WHERE id = ?');
const getUserByEmailStmt = db.prepare('SELECT id, first_name, last_name, email, avatar_url, password_hash FROM users WHERE email = ?');
const createUserStmt = db.prepare('INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)');

const getRolesByUserIdStmt = db.prepare(`
  SELECT r.name
  FROM roles r
  JOIN user_roles ur ON ur.role_id = r.id
  WHERE ur.user_id = ?
`);

const getPermissionsByUserIdStmt = db.prepare(`
  SELECT DISTINCT p.name
  FROM permissions p
  JOIN role_permissions rp ON rp.permission_id = p.id
  JOIN user_roles ur ON ur.role_id = rp.role_id
  WHERE ur.user_id = ?
`);

const assignRoleByNameStmt = db.prepare(`
  INSERT OR IGNORE INTO user_roles (user_id, role_id)
  SELECT ?, id FROM roles WHERE name = ?
`);

const insertRefreshSessionStmt = db.prepare(`
  INSERT INTO refresh_sessions (user_id, jti, token_hash, expires_at, user_agent, ip)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const getRefreshSessionByJtiStmt = db.prepare(`
  SELECT id, user_id, jti, token_hash, expires_at, revoked_at
  FROM refresh_sessions
  WHERE jti = ?
`);

const revokeRefreshSessionStmt = db.prepare(`
  UPDATE refresh_sessions
  SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
  WHERE id = ?
`);

const revokeAllUserRefreshSessionsStmt = db.prepare(`
  UPDATE refresh_sessions
  SET revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
  WHERE user_id = ?
`);

export function getUserById(userId) {
  return getUserByIdStmt.get(userId);
}

export function getUserByEmail(email) {
  return getUserByEmailStmt.get(email);
}

export function createUser({ firstName, lastName, email, passwordHash }) {
  const info = createUserStmt.run(firstName, lastName, email, passwordHash);
  return getUserById(info.lastInsertRowid);
}

export function assignRoleByName(userId, roleName) {
  assignRoleByNameStmt.run(userId, roleName);
}

export function getUserRoles(userId) {
  return getRolesByUserIdStmt.all(userId).map((row) => row.name);
}

export function getUserPermissions(userId) {
  return getPermissionsByUserIdStmt.all(userId).map((row) => row.name);
}

export function createRefreshSession({ userId, jti, tokenHash, expiresAt, userAgent, ip }) {
  insertRefreshSessionStmt.run(userId, jti, tokenHash, expiresAt, userAgent || null, ip || null);
}

export function getRefreshSessionByJti(jti) {
  return getRefreshSessionByJtiStmt.get(jti);
}

export function revokeRefreshSessionById(sessionId) {
  revokeRefreshSessionStmt.run(sessionId);
}

export function revokeAllRefreshSessionsByUserId(userId) {
  revokeAllUserRefreshSessionsStmt.run(userId);
}
