import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import imageSize from 'image-size';
import db from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

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
    const isAdmin = req.query.admin === '1';
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });
    const rows = db.prepare('SELECT id, floor_id, name, x, y, image_path, hint FROM locations ORDER BY id DESC').all();
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

// Guess
app.post('/api/guess', (req, res) => {
  try {
    const { location_id, guess_x, guess_y } = req.body || {};
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
    const score = Math.max(0, Math.round(1000 * (1 - normalized)));
    const correct = distance <= 40; // within 40px
    res.json({
      distance,
      score,
      correct,
      correct_x: loc.x,
      correct_y: loc.y,
      floor_width: floor.width_px,
      floor_height: floor.height_px
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to score guess' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});


