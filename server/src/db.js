import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'geoguesser.sqlite');

const db = new Database(dbPath);

// Pragmas for reliability/performance on single-user local app
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS floors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    building TEXT,
    level TEXT,
    image_path TEXT NOT NULL,
    width_px INTEGER NOT NULL,
    height_px INTEGER NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    floor_id INTEGER NOT NULL,
    name TEXT,
    x INTEGER NOT NULL,
    y INTEGER NOT NULL,
    image_path TEXT NOT NULL,
    is_360 INTEGER NOT NULL DEFAULT 0,
    hint TEXT,
    FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE
  );
  
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE TABLE IF NOT EXISTS game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    total_score INTEGER NOT NULL,
    rounds_played INTEGER NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS user_roles (
    user_id INTEGER NOT NULL,
    role_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS role_permissions (
    role_id INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS refresh_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    jti TEXT NOT NULL UNIQUE,
    token_hash TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    revoked_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_agent TEXT,
    ip TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  
  CREATE INDEX IF NOT EXISTS idx_game_results_score ON game_results(total_score DESC);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
  CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON user_roles(role_id);
  CREATE INDEX IF NOT EXISTS idx_role_permissions_role_id ON role_permissions(role_id);
  CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_id ON role_permissions(permission_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_sessions_user_id ON refresh_sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_refresh_sessions_jti ON refresh_sessions(jti);
`);

// Try to add avatar_url column to existing users table
try {
  db.exec('ALTER TABLE users ADD COLUMN avatar_url TEXT');
} catch (err) {
  // Column already exists or error occurred, ignore
}

// Try to add is_360 column to existing locations table
try {
  db.exec('ALTER TABLE locations ADD COLUMN is_360 INTEGER NOT NULL DEFAULT 0');
} catch (err) {
  // Column already exists or error occurred, ignore
}

// Create default admin user
import bcrypt from 'bcrypt';

const ROLE_PERMISSIONS = {
  guest: ['floors.read', 'locations.read', 'leaderboard.read'],
  player: [
    'floors.read',
    'locations.read',
    'users.read.self',
    'users.update.self',
    'users.avatar.upload.self',
    'results.create',
    'leaderboard.read'
  ],
  content_manager: [
    'floors.read',
    'floors.create',
    'floors.delete',
    'locations.read',
    'locations.create',
    'locations.delete',
    'leaderboard.read'
  ],
  admin: [
    'floors.read',
    'floors.create',
    'floors.delete',
    'locations.read',
    'locations.create',
    'locations.delete',
    'users.read.self',
    'users.update.self',
    'users.avatar.upload.self',
    'users.read.any',
    'users.update.any',
    'roles.manage',
    'results.create',
    'leaderboard.read'
  ]
};

const ALL_PERMISSIONS = [
  'floors.read', 'floors.create', 'floors.delete',
  'locations.read', 'locations.create', 'locations.delete',
  'users.read.self', 'users.update.self', 'users.avatar.upload.self',
  'users.read.any', 'users.update.any',
  'roles.manage',
  'results.create', 'leaderboard.read'
];

function seedRbac() {
  const insertRole = db.prepare('INSERT OR IGNORE INTO roles (name) VALUES (?)');
  const insertPermission = db.prepare('INSERT OR IGNORE INTO permissions (name) VALUES (?)');
  const getRoleId = db.prepare('SELECT id FROM roles WHERE name = ?');
  const getPermissionId = db.prepare('SELECT id FROM permissions WHERE name = ?');
  const linkRolePermission = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');

  for (const roleName of Object.keys(ROLE_PERMISSIONS)) {
    insertRole.run(roleName);
  }
  for (const permissionName of ALL_PERMISSIONS) {
    insertPermission.run(permissionName);
  }

  for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
    const roleRow = getRoleId.get(roleName);
    if (!roleRow) continue;
    for (const permissionName of permissions) {
      const permissionRow = getPermissionId.get(permissionName);
      if (!permissionRow) continue;
      linkRolePermission.run(roleRow.id, permissionRow.id);
    }
  }
}

function ensureUserRole(userId, roleName) {
  const roleRow = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
  if (!roleRow) return;
  db.prepare('INSERT OR IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)').run(userId, roleRow.id);
}

seedRbac();
const playerRole = db.prepare('SELECT id FROM roles WHERE name = ?').get('player');
if (playerRole) {
  db.prepare(`
    INSERT OR IGNORE INTO user_roles (user_id, role_id)
    SELECT u.id, ?
    FROM users u
    WHERE NOT EXISTS (
      SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id
    )
  `).run(playerRole.id);
}

const adminEmail = 'admin@admin.com';
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

if (!existingAdmin) {
  (async () => {
    try {
      const hashedPassword = await bcrypt.hash('admin', 10);
      const result = db.prepare('INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)')
        .run('Admin', 'User', adminEmail, hashedPassword);
      ensureUserRole(result.lastInsertRowid, 'admin');
      console.log('✅ Default admin user created (email: admin@admin.com, password: admin)');
    } catch (err) {
      console.error('Failed to create admin user:', err);
    }
  })();
} else {
  ensureUserRole(existingAdmin.id, 'admin');
}

export default db;


