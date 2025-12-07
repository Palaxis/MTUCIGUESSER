import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import imageSize from 'image-size';
import session from 'express-session';
import bcrypt from 'bcrypt';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ 
  origin: 'http://localhost:5173', 
  credentials: true 
}));
app.use(express.json());
app.use(morgan('dev'));
app.use(session({
  secret: 'mtuci-guesser-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 } // 24 hours
}));

const uploadsRoot = path.join(__dirname, '..', 'uploads');
const floorUploadsDir = path.join(uploadsRoot, 'floors');
const locationUploadsDir = path.join(uploadsRoot, 'locations');

for (const dir of [uploadsRoot, floorUploadsDir, locationUploadsDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Static serving of uploaded images
app.use('/uploads', express.static(uploadsRoot));

// Multer storage for floors and locations
const storageFloors = multer.diskStorage({
  destination: (req, file, cb) => cb(null, floorUploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `floor_${timestamp}${ext}`);
  }
});

const storageLocations = multer.diskStorage({
  destination: (req, file, cb) => cb(null, locationUploadsDir),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const ext = path.extname(file.originalname) || '.png';
    cb(null, `loc_${timestamp}${ext}`);
  }
});

const uploadFloor = multer({ storage: storageFloors });
const uploadLocation = multer({ storage: storageLocations });

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// Floors
app.get('/api/floors', (req, res) => {
  try {
    const floors = db.prepare('SELECT id, name, building, level, image_path, width_px, height_px FROM floors ORDER BY building, level').all();
    res.json(floors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list floors' });
  }
});

app.get('/api/floors/:id', (req, res) => {
  try {
    const floor = db.prepare('SELECT id, name, building, level, image_path, width_px, height_px FROM floors WHERE id = ?').get(req.params.id);
    if (!floor) return res.status(404).json({ error: 'Not found' });
    res.json(floor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get floor' });
  }
});

app.post('/api/floors', uploadFloor.single('image'), (req, res) => {
  try {
    const { name, building, level } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Image required' });
    const fileRelPath = `/uploads/floors/${req.file.filename}`;
    const fileAbsPath = path.join(floorUploadsDir, req.file.filename);
    const size = imageSize(fileAbsPath);
    const width = size.width || 0;
    const height = size.height || 0;
    const stmt = db.prepare('INSERT INTO floors (name, building, level, image_path, width_px, height_px) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(name || null, building || null, level || null, fileRelPath, width, height);
    const created = db.prepare('SELECT id, name, building, level, image_path, width_px, height_px FROM floors WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create floor' });
  }
});

// Locations
app.get('/api/locations', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT l.*, f.building, f.level 
      FROM locations l 
      LEFT JOIN floors f ON l.floor_id = f.id
      ORDER BY l.id DESC
    `).all();
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list locations' });
  }
});

app.get('/api/locations/random', (req, res) => {
  try {
    const { floor_id } = req.query;
    let row;
    if (floor_id) {
      row = db.prepare('SELECT * FROM locations WHERE floor_id = ? ORDER BY RANDOM() LIMIT 1').get(floor_id);
    } else {
      row = db.prepare('SELECT * FROM locations ORDER BY RANDOM() LIMIT 1').get();
    }
    if (!row) return res.status(404).json({ error: 'No locations available' });
    // Minimal data for game (hide exact coordinates)
    const floor = db.prepare('SELECT id, name, building, level, image_path, width_px, height_px FROM floors WHERE id = ?').get(row.floor_id);
    res.json({
      location: { id: row.id, floor_id: row.floor_id, image_path: row.image_path, hint: row.hint || null },
      floor
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get random location' });
  }
});

app.post('/api/locations', uploadLocation.single('image'), (req, res) => {
  try {
    const { floor_id, name, x, y, hint } = req.body;
    if (!req.file) return res.status(400).json({ error: 'Image required' });
    const f = db.prepare('SELECT id FROM floors WHERE id = ?').get(floor_id);
    if (!f) return res.status(400).json({ error: 'Invalid floor_id' });
    const xNum = Math.round(Number(x));
    const yNum = Math.round(Number(y));
    if (!Number.isFinite(xNum) || !Number.isFinite(yNum)) return res.status(400).json({ error: 'Bad coordinates' });
    const fileRelPath = `/uploads/locations/${req.file.filename}`;
    const stmt = db.prepare('INSERT INTO locations (floor_id, name, x, y, image_path, hint) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(floor_id, name || null, xNum, yNum, fileRelPath, hint || null);
    const created = db.prepare('SELECT id, floor_id, name, x, y, image_path, hint FROM locations WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(created);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

// Delete floor
app.delete('/api/floors/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete all locations associated with this floor
    db.prepare('DELETE FROM locations WHERE floor_id = ?').run(id);
    
    // Delete the floor
    db.prepare('DELETE FROM floors WHERE id = ?').run(id);
    
    res.json({ success: true, message: 'Floor and associated locations deleted' });
  } catch (err) {
    console.error('Error deleting floor:', err);
    res.status(500).json({ error: 'Failed to delete floor' });
  }
});

// Delete location
app.delete('/api/locations/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM locations WHERE id = ?').run(id);
    res.json({ success: true, message: 'Location deleted' });
  } catch (err) {
    console.error('Error deleting location:', err);
    res.status(500).json({ error: 'Failed to delete location' });
  }
});

// Guess
app.post('/api/guess', (req, res) => {
  try {
    const { location_id, guess_x, guess_y, selected_floor } = req.body || {};
    if (!location_id || guess_x === undefined || guess_y === undefined) {
      return res.status(400).json({ error: 'location_id, guess_x, guess_y required' });
    }
    const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(location_id);
    if (!loc) return res.status(404).json({ error: 'Location not found' });
    const floor = db.prepare('SELECT * FROM floors WHERE id = ?').get(loc.floor_id);
    const gx = Number(guess_x);
    const gy = Number(guess_y);
    const dx = gx - loc.x;
    const dy = gy - loc.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const diag = Math.sqrt(floor.width_px * floor.width_px + floor.height_px * floor.height_px) || 1;
    const normalized = Math.min(1, distance / diag);
    
    // Нелинейное начисление баллов - квадратичная функция
    // Чем больше ошибка, тем значительно меньше баллов
    let score = Math.max(0, Math.round(100 * Math.pow(1 - normalized, 2)));
    
    // Штраф за неправильный этаж
    const isCorrectFloor = selected_floor && Number(selected_floor) === Number(loc.floor_id);
    if (selected_floor && !isCorrectFloor) {
      score = Math.min(10, Math.round(score / 10)); // Максимум 10 баллов за неправильный этаж
    }
    
    const correct = distance <= 40; // within 40px
    res.json({
      distance,
      score,
      correct,
      correct_x: loc.x,
      correct_y: loc.y,
      floor_width: floor.width_px,
      floor_height: floor.height_px,
      is_correct_floor: isCorrectFloor
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to score guess' });
  }
});

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;
    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Create user
    const stmt = db.prepare('INSERT INTO users (first_name, last_name, email, password_hash) VALUES (?, ?, ?, ?)');
    const info = stmt.run(first_name, last_name, email, password_hash);
    
    const user = db.prepare('SELECT id, first_name, last_name, email FROM users WHERE id = ?').get(info.lastInsertRowid);
    
    req.session.userId = user.id;
    res.status(201).json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    res.json({ 
      user: { 
        id: user.id, 
        first_name: user.first_name, 
        last_name: user.last_name, 
        email: user.email 
      } 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

app.get('/api/auth/me', (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = db.prepare('SELECT id, first_name, last_name, email FROM users WHERE id = ?').get(req.session.userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json(user);
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

// User management
app.put('/api/users/:id', async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (!req.session.userId || req.session.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { first_name, last_name, email, password } = req.body;
    
    if (password) {
      const password_hash = await bcrypt.hash(password, 10);
      db.prepare('UPDATE users SET first_name = ?, last_name = ?, email = ?, password_hash = ? WHERE id = ?')
        .run(first_name, last_name, email, password_hash, userId);
    } else {
      db.prepare('UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?')
        .run(first_name, last_name, email, userId);
    }

    const user = db.prepare('SELECT id, first_name, last_name, email FROM users WHERE id = ?').get(userId);
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Game results
app.post('/api/game-results', (req, res) => {
  try {
    const { user_id, total_score, rounds_played } = req.body;
    
    if (!user_id || total_score === undefined || !rounds_played) {
      return res.status(400).json({ error: 'user_id, total_score, rounds_played required' });
    }

    // Проверить предыдущий лучший результат пользователя
    const previousBest = db.prepare(
      'SELECT MAX(total_score) as best_score FROM game_results WHERE user_id = ?'
    ).get(user_id);

    const previousBestScore = previousBest?.best_score || 0;
    const isNewRecord = total_score > previousBestScore;

    // Всегда сохраняем результат (для истории)
    const stmt = db.prepare('INSERT INTO game_results (user_id, total_score, rounds_played) VALUES (?, ?, ?)');
    const info = stmt.run(user_id, total_score, rounds_played);

    // Рассчитать ранг на основе лучших результатов каждого игрока
    const rank = db.prepare(`
      SELECT COUNT(DISTINCT user_id) + 1 as rank 
      FROM game_results 
      WHERE user_id IN (
        SELECT user_id 
        FROM game_results 
        GROUP BY user_id 
        HAVING MAX(total_score) > ?
      )
    `).get(total_score);

    res.status(201).json({ 
      id: info.lastInsertRowid, 
      rank: rank.rank,
      isNewRecord: isNewRecord,
      previousBest: previousBestScore,
      currentScore: total_score
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save game result' });
  }
});

// Leaderboard
app.get('/api/leaderboard', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const results = db.prepare(`
      SELECT 
        MAX(gr.total_score) as score,
        u.first_name || ' ' || u.last_name as name,
        MAX(gr.played_at) as played_at,
        RANK() OVER (ORDER BY MAX(gr.total_score) DESC) as rank
      FROM game_results gr
      JOIN users u ON gr.user_id = u.id
      GROUP BY gr.user_id
      ORDER BY MAX(gr.total_score) DESC
      LIMIT ?
    `).all(limit);

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


