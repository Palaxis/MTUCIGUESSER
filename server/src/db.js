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
    hint TEXT,
    FOREIGN KEY (floor_id) REFERENCES floors(id) ON DELETE CASCADE
  );
  
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
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
  
  CREATE INDEX IF NOT EXISTS idx_game_results_score ON game_results(total_score DESC);
  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);

// Create default admin user
import bcrypt from 'bcrypt';

const adminEmail = 'admin@admin.com';
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

if (!existingAdmin) {
  (async () => {
    try {
      const hashedPassword = await bcrypt.hash('admin', 10);
      db.prepare('INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)')
        .run('Admin', 'User', adminEmail, hashedPassword);
      console.log('✅ Default admin user created (email: admin@admin.com, password: admin)');
    } catch (err) {
      console.error('Failed to create admin user:', err);
    }
  })();
}

export default db;


