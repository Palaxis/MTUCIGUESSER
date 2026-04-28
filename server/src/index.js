import 'dotenv/config';
import express from 'express';
import http from 'http';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import imageSize from 'image-size';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcrypt';
import { Server as SocketIOServer } from 'socket.io';
import db from './db.js';
import { createAuthRouter } from './auth/routes/authRoutes.js';
import { attachAuthIfPresent, isOwnResource, requireAuth, requirePermission } from './auth/middleware/authMiddleware.js';
import { buildUserWithAccess } from './auth/services/authService.js';
import { getWeatherHint } from './services/weatherHintService.js';
import { 
  initializeStorage, 
  uploadFile, 
  deleteFile, 
  getObjectNameFromUrl,
  getSignedFileUrl
} from './storage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const corsOrigins = CORS_ORIGIN === '*' ? true : CORS_ORIGIN.split(',').map(o => o.trim());

const io = new SocketIOServer(server, {
  cors: {
    origin: corsOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});
const PORT = process.env.PORT || 3001;

app.use(cors({ 
  origin: corsOrigins, 
  credentials: true 
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

// Use memory storage for multer - files will be uploaded to MinIO
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE_BYTES }
});

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
const externalApiRateWindowMs = 60 * 1000;
const externalApiRateMax = Number.parseInt(process.env.EXTERNAL_API_RATE_LIMIT || '30', 10);
const externalApiRateStore = new Map();

function getUserRoles(userId) {
  return getRolesByUserIdStmt.all(userId).map((row) => row.name);
}

function getUserPermissions(userId) {
  return getPermissionsByUserIdStmt.all(userId).map((row) => row.name);
}

function parsePositiveInt(value, fallback, min = 1, max = 100) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseSortDir(value, fallback = 'asc') {
  if (value === 'desc') return 'DESC';
  if (value === 'asc') return 'ASC';
  return fallback === 'desc' ? 'DESC' : 'ASC';
}

function toPaginatedResponse(items, total, page, pageSize) {
  return { items, total, page, pageSize };
}

function validateRequiredTextField(value, fieldName, maxLen = 100) {
  if (typeof value !== 'string' || !value.trim()) {
    return `${fieldName} is required`;
  }
  if (value.trim().length > maxLen) {
    return `${fieldName} is too long`;
  }
  return null;
}

function buildAbsoluteAppUrl(pathname) {
  const appUrl = process.env.PUBLIC_APP_URL || '';
  if (appUrl) {
    return `${appUrl.replace(/\/+$/, '')}${pathname}`;
  }
  return pathname;
}

function externalApiRateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const entry = externalApiRateStore.get(key);
  if (!entry || now > entry.resetAt) {
    externalApiRateStore.set(key, { count: 1, resetAt: now + externalApiRateWindowMs });
    return next();
  }
  if (entry.count >= externalApiRateMax) {
    return res.status(429).json({ error: 'Too many external API requests. Please retry later.' });
  }
  entry.count += 1;
  externalApiRateStore.set(key, entry);
  return next();
}

function ensureImageFileOrThrow(file) {
  if (!file) return { ok: false, status: 400, error: 'Image file is required' };
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
    return { ok: false, status: 400, error: `Unsupported MIME type: ${file.mimetype}` };
  }
  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    return { ok: false, status: 400, error: `File is too large. Max ${Math.round(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024)}MB` };
  }
  return { ok: true };
}

async function signRowImage(row, field = 'image_path') {
  if (!row || !row[field]) return row;
  const objectName = getObjectNameFromUrl(row[field]);
  if (!objectName) return row;
  try {
    const signedUrl = await getSignedFileUrl(objectName, 300);
    return { ...row, [field]: signedUrl };
  } catch (error) {
    console.warn(`Failed to sign URL for ${objectName}`, error);
    return row;
  }
}

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send(
    [
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /account',
      'Disallow: /login',
      'Disallow: /register',
      'Disallow: /play',
      'Disallow: /play360',
      '',
      `Sitemap: ${buildAbsoluteAppUrl('/sitemap.xml')}`
    ].join('\n')
  );
});

app.get('/sitemap.xml', (_req, res) => {
  const urls = ['/', '/leaderboard', '/duel'];
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map((url) => `  <url><loc>${buildAbsoluteAppUrl(url)}</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>${url === '/' ? '1.0' : '0.8'}</priority></url>`)
  .join('\n')}
</urlset>`;

  res.type('application/xml').send(xml);
});

app.get('/api/external/weather-hint', externalApiRateLimit, async (req, res) => {
  try {
    const city = (req.query.city || 'Moscow').toString().trim().slice(0, 64);
    const data = await getWeatherHint(city || 'Moscow');
    if (!data) {
      return res.status(200).json({ data: null, fallback: true });
    }
    return res.status(200).json({ data, fallback: false });
  } catch (error) {
    console.error('External weather API failed:', error?.message || error);
    return res.status(503).json({ error: 'External API unavailable', data: null, fallback: true });
  }
});

// Floors
app.get('/api/floors', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1, 10000);
    const pageSize = parsePositiveInt(req.query.pageSize, 20, 1, 100);
    const search = (req.query.search || '').toString().trim();
    const building = (req.query.building || '').toString().trim();
    const level = (req.query.level || '').toString().trim();
    const sortBy = ['name', 'building', 'level', 'id'].includes(req.query.sortBy) ? req.query.sortBy : 'id';
    const sortDir = parseSortDir(req.query.sortDir, 'desc');

    const where = [];
    const params = [];
    if (search) {
      where.push('(name LIKE ? OR building LIKE ? OR level LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (building) {
      where.push('building = ?');
      params.push(building);
    }
    if (level) {
      where.push('level = ?');
      params.push(level);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) as count FROM floors ${whereSql}`).get(...params).count;
    const offset = (page - 1) * pageSize;
    const floors = db.prepare(`
      SELECT id, name, building, level, image_path, width_px, height_px
      FROM floors
      ${whereSql}
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    const signedItems = await Promise.all(floors.map((row) => signRowImage(row)));
    res.json(toPaginatedResponse(signedItems, total, page, pageSize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list floors' });
  }
});

app.get('/api/floors/:id', async (req, res) => {
  try {
    const floor = db.prepare('SELECT id, name, building, level, image_path, width_px, height_px FROM floors WHERE id = ?').get(req.params.id);
    if (!floor) return res.status(404).json({ error: 'Not found' });
    res.json(await signRowImage(floor));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get floor' });
  }
});

app.post('/api/floors', requireAuth, requirePermission('floors.create'), upload.single('image'), async (req, res) => {
  try {
    const { name, building, level } = req.body;
    const validBuilding = validateRequiredTextField(building, 'building', 50);
    if (validBuilding) return res.status(400).json({ error: validBuilding });
    const validLevel = validateRequiredTextField(level, 'level', 50);
    if (validLevel) return res.status(400).json({ error: validLevel });
    const imageValidation = ensureImageFileOrThrow(req.file);
    if (!imageValidation.ok) return res.status(imageValidation.status).json({ error: imageValidation.error });
    const duplicate = db.prepare('SELECT id FROM floors WHERE building = ? AND level = ?').get(building.trim(), level.trim());
    if (duplicate) return res.status(409).json({ error: 'Floor already exists for this building and level' });
    
    // Get image dimensions from buffer
    const size = imageSize(req.file.buffer);
    const width = size.width || 0;
    const height = size.height || 0;
    
    // Generate filename and upload to MinIO
    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname) || '.png';
    const objectName = `floors/floor_${timestamp}${ext}`;
    const imageUrl = await uploadFile(req.file.buffer, objectName, req.file.mimetype);
    
    const stmt = db.prepare('INSERT INTO floors (name, building, level, image_path, width_px, height_px) VALUES (?, ?, ?, ?, ?, ?)');
    const info = stmt.run(name?.trim() || null, building.trim(), level.trim(), imageUrl, width, height);
    const created = db.prepare('SELECT id, name, building, level, image_path, width_px, height_px FROM floors WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(await signRowImage(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create floor' });
  }
});

app.put('/api/floors/:id', requireAuth, requirePermission('floors.create'), upload.single('image'), async (req, res) => {
  try {
    const floorId = Number(req.params.id);
    if (!Number.isFinite(floorId)) return res.status(400).json({ error: 'Invalid floor id' });
    const current = db.prepare('SELECT * FROM floors WHERE id = ?').get(floorId);
    if (!current) return res.status(404).json({ error: 'Floor not found' });

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : current.name;
    const building = typeof req.body.building === 'string' ? req.body.building.trim() : current.building;
    const level = typeof req.body.level === 'string' ? req.body.level.trim() : current.level;
    const validBuilding = validateRequiredTextField(building, 'building', 50);
    if (validBuilding) return res.status(400).json({ error: validBuilding });
    const validLevel = validateRequiredTextField(level, 'level', 50);
    if (validLevel) return res.status(400).json({ error: validLevel });

    const duplicate = db.prepare('SELECT id FROM floors WHERE building = ? AND level = ? AND id <> ?').get(building, level, floorId);
    if (duplicate) return res.status(409).json({ error: 'Floor already exists for this building and level' });

    let imagePath = current.image_path;
    let width = current.width_px;
    let height = current.height_px;
    if (req.file) {
      const imageValidation = ensureImageFileOrThrow(req.file);
      if (!imageValidation.ok) return res.status(imageValidation.status).json({ error: imageValidation.error });
      const oldObjectName = getObjectNameFromUrl(current.image_path);
      const size = imageSize(req.file.buffer);
      width = size.width || 0;
      height = size.height || 0;
      const ext = path.extname(req.file.originalname) || '.png';
      const objectName = `floors/floor_${Date.now()}${ext}`;
      imagePath = await uploadFile(req.file.buffer, objectName, req.file.mimetype);
      if (oldObjectName) {
        try { await deleteFile(oldObjectName); } catch (error) { console.warn('Failed to remove old floor image', error); }
      }
    }

    db.prepare(`
      UPDATE floors
      SET name = ?, building = ?, level = ?, image_path = ?, width_px = ?, height_px = ?
      WHERE id = ?
    `).run(name || null, building, level, imagePath, width, height, floorId);
    const updated = db.prepare('SELECT id, name, building, level, image_path, width_px, height_px FROM floors WHERE id = ?').get(floorId);
    res.json(await signRowImage(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update floor' });
  }
});

// Locations
app.get('/api/locations', async (req, res) => {
  try {
    const { mode } = req.query;
    const is360Mode = mode === '360';
    const page = parsePositiveInt(req.query.page, 1, 1, 10000);
    const pageSize = parsePositiveInt(req.query.pageSize, 20, 1, 100);
    const search = (req.query.search || '').toString().trim();
    const floorId = parsePositiveInt(req.query.floorId, 0, 0, 1000000);
    const sortBy = ['id', 'name', 'building', 'level'].includes(req.query.sortBy) ? req.query.sortBy : 'id';
    const sortDir = parseSortDir(req.query.sortDir, 'desc');

    const where = ['l.is_360 = ?'];
    const params = [is360Mode ? 1 : 0];
    if (search) {
      where.push('(l.name LIKE ? OR l.hint LIKE ? OR f.building LIKE ? OR f.level LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }
    if (floorId > 0) {
      where.push('l.floor_id = ?');
      params.push(floorId);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;
    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM locations l
      LEFT JOIN floors f ON l.floor_id = f.id
      ${whereSql}
    `).get(...params).count;
    const offset = (page - 1) * pageSize;
    const rows = db.prepare(`
      SELECT l.*, f.building, f.level 
      FROM locations l 
      LEFT JOIN floors f ON l.floor_id = f.id
      ${whereSql}
      ORDER BY ${sortBy === 'building' || sortBy === 'level' ? `f.${sortBy}` : `l.${sortBy}`} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    const signedItems = await Promise.all(rows.map((row) => signRowImage(row)));
    res.json(toPaginatedResponse(signedItems, total, page, pageSize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list locations' });
  }
});

app.get('/api/locations/random', async (req, res) => {
  try {
    const { floor_id, exclude, mode } = req.query;
    const is360Mode = mode === '360' ? 1 : 0;
    
    // Парсим список исключённых ID
    let excludeIds = [];
    if (exclude) {
      excludeIds = exclude.split(',').map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    }
    
    let row;
    if (excludeIds.length > 0) {
      // Исключаем уже показанные локации
      const placeholders = excludeIds.map(() => '?').join(',');
      if (floor_id) {
        row = db.prepare(`SELECT * FROM locations WHERE floor_id = ? AND is_360 = ? AND id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`).get(floor_id, is360Mode, ...excludeIds);
      } else {
        row = db.prepare(`SELECT * FROM locations WHERE is_360 = ? AND id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`).get(is360Mode, ...excludeIds);
      }
    } else {
      if (floor_id) {
        row = db.prepare('SELECT * FROM locations WHERE floor_id = ? AND is_360 = ? ORDER BY RANDOM() LIMIT 1').get(floor_id, is360Mode);
      } else {
        row = db.prepare('SELECT * FROM locations WHERE is_360 = ? ORDER BY RANDOM() LIMIT 1').get(is360Mode);
      }
    }
    
    if (!row) return res.status(404).json({ error: 'No locations available' });
    // Minimal data for game (hide exact coordinates)
    const floor = db.prepare('SELECT id, name, building, level, image_path, width_px, height_px FROM floors WHERE id = ?').get(row.floor_id);
    const signedLocation = await signRowImage(row);
    const signedFloor = await signRowImage(floor);
    res.json({
      location: { id: row.id, floor_id: row.floor_id, image_path: signedLocation.image_path, hint: row.hint || null, is_360: row.is_360 === 1 },
      floor: signedFloor
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get random location' });
  }
});

app.post('/api/locations', requireAuth, requirePermission('locations.create'), upload.single('image'), async (req, res) => {
  try {
    const { floor_id, name, x, y, hint, is_360 } = req.body;
    const imageValidation = ensureImageFileOrThrow(req.file);
    if (!imageValidation.ok) return res.status(imageValidation.status).json({ error: imageValidation.error });
    const f = db.prepare('SELECT id FROM floors WHERE id = ?').get(floor_id);
    if (!f) return res.status(400).json({ error: 'Invalid floor_id' });
    const xNum = Math.round(Number(x));
    const yNum = Math.round(Number(y));
    if (!Number.isFinite(xNum) || !Number.isFinite(yNum)) return res.status(400).json({ error: 'Bad coordinates' });
    
    const is360Flag = Number(is_360) === 1 ? 1 : 0;
    const duplicate = db.prepare('SELECT id FROM locations WHERE floor_id = ? AND x = ? AND y = ? AND is_360 = ?').get(floor_id, xNum, yNum, is360Flag);
    if (duplicate) return res.status(409).json({ error: 'Location with same coordinates already exists' });

    // Generate filename and upload to MinIO
    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname) || '.png';
    const folder = is360Flag === 1 ? 'locations360' : 'locations';
    const objectName = `${folder}/loc_${timestamp}${ext}`;
    const imageUrl = await uploadFile(req.file.buffer, objectName, req.file.mimetype);
    
    const stmt = db.prepare('INSERT INTO locations (floor_id, name, x, y, image_path, is_360, hint) VALUES (?, ?, ?, ?, ?, ?, ?)');
    const info = stmt.run(floor_id, name || null, xNum, yNum, imageUrl, is360Flag, hint || null);
    const created = db.prepare('SELECT id, floor_id, name, x, y, image_path, is_360, hint FROM locations WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(await signRowImage(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

app.put('/api/locations/:id', requireAuth, requirePermission('locations.create'), upload.single('image'), async (req, res) => {
  try {
    const locationId = Number(req.params.id);
    if (!Number.isFinite(locationId)) return res.status(400).json({ error: 'Invalid location id' });
    const current = db.prepare('SELECT * FROM locations WHERE id = ?').get(locationId);
    if (!current) return res.status(404).json({ error: 'Location not found' });

    const floorId = req.body.floor_id ? Number(req.body.floor_id) : current.floor_id;
    const xNum = req.body.x !== undefined ? Math.round(Number(req.body.x)) : current.x;
    const yNum = req.body.y !== undefined ? Math.round(Number(req.body.y)) : current.y;
    if (!Number.isFinite(xNum) || !Number.isFinite(yNum)) return res.status(400).json({ error: 'Bad coordinates' });
    const is360Flag = req.body.is_360 !== undefined ? (Number(req.body.is_360) === 1 ? 1 : 0) : current.is_360;
    const floorExists = db.prepare('SELECT id FROM floors WHERE id = ?').get(floorId);
    if (!floorExists) return res.status(400).json({ error: 'Invalid floor_id' });
    const duplicate = db.prepare('SELECT id FROM locations WHERE floor_id = ? AND x = ? AND y = ? AND is_360 = ? AND id <> ?')
      .get(floorId, xNum, yNum, is360Flag, locationId);
    if (duplicate) return res.status(409).json({ error: 'Location with same coordinates already exists' });

    let imagePath = current.image_path;
    if (req.file) {
      const imageValidation = ensureImageFileOrThrow(req.file);
      if (!imageValidation.ok) return res.status(imageValidation.status).json({ error: imageValidation.error });
      const ext = path.extname(req.file.originalname) || '.png';
      const folder = is360Flag === 1 ? 'locations360' : 'locations';
      const objectName = `${folder}/loc_${Date.now()}${ext}`;
      imagePath = await uploadFile(req.file.buffer, objectName, req.file.mimetype);
      const oldObjectName = getObjectNameFromUrl(current.image_path);
      if (oldObjectName) {
        try { await deleteFile(oldObjectName); } catch (error) { console.warn('Failed to remove old location image', error); }
      }
    }

    db.prepare(`
      UPDATE locations
      SET floor_id = ?, name = ?, x = ?, y = ?, image_path = ?, is_360 = ?, hint = ?
      WHERE id = ?
    `).run(
      floorId,
      typeof req.body.name === 'string' ? req.body.name.trim() || null : current.name,
      xNum,
      yNum,
      imagePath,
      is360Flag,
      typeof req.body.hint === 'string' ? req.body.hint.trim() || null : current.hint,
      locationId
    );
    const updated = db.prepare('SELECT id, floor_id, name, x, y, image_path, is_360, hint FROM locations WHERE id = ?').get(locationId);
    res.json(await signRowImage(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Delete floor
app.delete('/api/floors/:id', requireAuth, requirePermission('floors.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const warnings = [];
    
    // Get floor to delete its image from MinIO
    const floor = db.prepare('SELECT image_path FROM floors WHERE id = ?').get(id);
    if (floor && floor.image_path) {
      const objectName = getObjectNameFromUrl(floor.image_path);
      if (objectName) {
        try { await deleteFile(objectName); } catch (error) { warnings.push(`Failed to delete floor image ${objectName}`); }
      }
    }
    
    // Get all locations for this floor to delete their images
    const locations = db.prepare('SELECT image_path FROM locations WHERE floor_id = ?').all(id);
    for (const loc of locations) {
      if (loc.image_path) {
        const objectName = getObjectNameFromUrl(loc.image_path);
        if (objectName) {
          try { await deleteFile(objectName); } catch (error) { warnings.push(`Failed to delete location image ${objectName}`); }
        }
      }
    }
    
    // Delete all locations associated with this floor
    db.prepare('DELETE FROM locations WHERE floor_id = ?').run(id);
    
    // Delete the floor
    db.prepare('DELETE FROM floors WHERE id = ?').run(id);
    
    res.json({ success: true, message: 'Floor and associated locations deleted', warnings });
  } catch (err) {
    console.error('Error deleting floor:', err);
    res.status(500).json({ error: 'Failed to delete floor' });
  }
});

// Delete location
app.delete('/api/locations/:id', requireAuth, requirePermission('locations.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const warnings = [];
    
    // Get location to delete its image from MinIO
    const location = db.prepare('SELECT image_path FROM locations WHERE id = ?').get(id);
    if (location && location.image_path) {
      const objectName = getObjectNameFromUrl(location.image_path);
      if (objectName) {
        try { await deleteFile(objectName); } catch (error) { warnings.push(`Failed to delete image ${objectName}`); }
      }
    }
    
    db.prepare('DELETE FROM locations WHERE id = ?').run(id);
    res.json({ success: true, message: 'Location deleted', warnings });
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

app.use('/api/auth', createAuthRouter());

// User management
app.put('/api/users/:id', requireAuth, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const canUpdateAny = req.auth.permissions.includes('users.update.any');
    const canUpdateSelf = req.auth.permissions.includes('users.update.self') && isOwnResource(req, userId);
    if (!canUpdateAny && !canUpdateSelf) {
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

    const user = db.prepare('SELECT id, first_name, last_name, email, avatar_url FROM users WHERE id = ?').get(userId);
    res.json(buildUserWithAccess(user));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Game results
app.post('/api/game-results', requireAuth, requirePermission('results.create'), (req, res) => {
  try {
    const { user_id, total_score, rounds_played } = req.body;
    if (!isOwnResource(req, user_id)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    
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
app.get('/api/leaderboard', attachAuthIfPresent, (req, res, next) => {
  if (!req.auth) return next();
  return requirePermission('leaderboard.read')(req, res, next);
}, (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1, 10000);
    const pageSize = parsePositiveInt(req.query.pageSize, parsePositiveInt(req.query.limit, 10, 1, 100), 1, 100);
    const search = (req.query.search || '').toString().trim();
    const minScore = Number.isFinite(Number(req.query.minScore)) ? Number(req.query.minScore) : null;
    const sortBy = ['score', 'name', 'played_at'].includes(req.query.sortBy) ? req.query.sortBy : 'score';
    const sortDir = parseSortDir(req.query.sortDir, 'desc');
    const where = [];
    const params = [];
    if (search) {
      where.push('name LIKE ?');
      params.push(`%${search}%`);
    }
    if (minScore !== null) {
      where.push('score >= ?');
      params.push(minScore);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`
      SELECT COUNT(*) as count
      FROM (
        SELECT
          gr.user_id,
          u.first_name || ' ' || u.last_name as name,
          MAX(gr.total_score) as score,
          MAX(gr.played_at) as played_at
        FROM game_results gr
        JOIN users u ON gr.user_id = u.id
        GROUP BY gr.user_id
      ) t
      ${whereSql}
    `).get(...params).count;
    const offset = (page - 1) * pageSize;
    const results = db.prepare(`
      SELECT 
        user_id,
        name,
        score,
        played_at,
        RANK() OVER (ORDER BY score DESC) as rank
      FROM (
        SELECT 
          gr.user_id,
          u.first_name || ' ' || u.last_name as name,
          MAX(gr.total_score) as score,
          MAX(gr.played_at) as played_at
        FROM game_results gr
        JOIN users u ON gr.user_id = u.id
        GROUP BY gr.user_id
      ) t
      ${whereSql}
      ORDER BY ${sortBy} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    res.json(toPaginatedResponse(results, total, page, pageSize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Avatar upload
app.post('/api/users/:id/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const canUploadAny = req.auth.permissions.includes('users.update.any');
    const canUploadSelf = req.auth.permissions.includes('users.avatar.upload.self') && isOwnResource(req, userId);
    if (!canUploadAny && !canUploadSelf) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    if (!req.file) return res.status(400).json({ error: 'Avatar image required' });

    // Delete old avatar if exists
    const existingUser = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(userId);
    if (existingUser && existingUser.avatar_url) {
      const oldObjectName = getObjectNameFromUrl(existingUser.avatar_url);
      if (oldObjectName) await deleteFile(oldObjectName);
    }

    const timestamp = Date.now();
    const ext = path.extname(req.file.originalname) || '.png';
    const objectName = `avatars/avatar_${userId}_${timestamp}${ext}`;
    const avatarUrl = await uploadFile(req.file.buffer, objectName, req.file.mimetype);

    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, userId);
    const user = db.prepare('SELECT id, first_name, last_name, email, avatar_url FROM users WHERE id = ?').get(userId);
    res.json(buildUserWithAccess(user));
  } catch (err) {
    console.error('Error uploading avatar:', err);
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
});

app.get('/api/admin/users', requireAuth, requirePermission('roles.manage'), (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1, 1, 10000);
    const pageSize = parsePositiveInt(req.query.pageSize, 20, 1, 100);
    const search = (req.query.search || '').toString().trim();
    const role = (req.query.role || '').toString().trim();
    const sortBy = ['id', 'first_name', 'last_name', 'email'].includes(req.query.sortBy) ? req.query.sortBy : 'id';
    const sortDir = parseSortDir(req.query.sortDir, 'desc');
    const where = [];
    const params = [];
    if (search) {
      where.push('(u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q);
    }
    if (role) {
      where.push('EXISTS (SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.name = ?)');
      params.push(role);
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const total = db.prepare(`SELECT COUNT(*) as count FROM users u ${whereSql}`).get(...params).count;
    const offset = (page - 1) * pageSize;
    const users = db.prepare(`
      SELECT u.id, u.first_name, u.last_name, u.email, u.avatar_url
      FROM users u
      ${whereSql}
      ORDER BY u.${sortBy} ${sortDir}
      LIMIT ? OFFSET ?
    `).all(...params, pageSize, offset);
    const withRoles = users.map((user) => ({
      ...user,
      roles: getUserRoles(user.id)
    }));
    res.json(toPaginatedResponse(withRoles, total, page, pageSize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

app.post('/api/admin/users/:id/roles', requireAuth, requirePermission('roles.manage'), (req, res) => {
  try {
    const userId = Number(req.params.id);
    const { role } = req.body || {};
    if (!role) return res.status(400).json({ error: 'Role is required' });
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const roleExists = db.prepare('SELECT id FROM roles WHERE name = ?').get(role);
    if (!roleExists) return res.status(400).json({ error: 'Unknown role' });
    assignRoleByNameStmt.run(userId, role);
    res.json({ user_id: userId, roles: getUserRoles(userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to assign role' });
  }
});

app.delete('/api/admin/users/:id/roles/:role', requireAuth, requirePermission('roles.manage'), (req, res) => {
  try {
    const userId = Number(req.params.id);
    const roleName = req.params.role;
    const role = db.prepare('SELECT id FROM roles WHERE name = ?').get(roleName);
    if (!role) return res.status(400).json({ error: 'Unknown role' });
    db.prepare('DELETE FROM user_roles WHERE user_id = ? AND role_id = ?').run(userId, role.id);
    res.json({ user_id: userId, roles: getUserRoles(userId) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove role' });
  }
});

// ===================== DUEL SYSTEM (Socket.IO) =====================

const DUEL_CONFIG = {
  MAX_HP: 5000,
  TOTAL_ROUNDS: 5,
  PHOTO_TIME: 10,   // seconds to view photo
  GUESS_TIME: 15,   // seconds to guess
  RESULT_TIME: 8,   // seconds to show result
};

// In-memory room storage
const duelRooms = new Map();

function generateRoomCode() {
  let code;
  do {
    code = Math.floor(100000 + Math.random() * 900000).toString();
  } while (duelRooms.has(code));
  return code;
}

function getRandomDuelLocation(excludeIds = []) {
  let row;
  if (excludeIds.length > 0) {
    const placeholders = excludeIds.map(() => '?').join(',');
    row = db.prepare(`SELECT * FROM locations WHERE is_360 = 0 AND id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`).get(...excludeIds);
  } else {
    row = db.prepare('SELECT * FROM locations WHERE is_360 = 0 ORDER BY RANDOM() LIMIT 1').get();
  }
  if (!row) return null;
  const floor = db.prepare('SELECT id, name, building, level, image_path, width_px, height_px FROM floors WHERE id = ?').get(row.floor_id);
  return { location: row, floor };
}

function calculateDuelScore(locationId, guessX, guessY, selectedFloor) {
  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(locationId);
  if (!loc) return { score: 0 };
  const floor = db.prepare('SELECT * FROM floors WHERE id = ?').get(loc.floor_id);
  const gx = Number(guessX);
  const gy = Number(guessY);
  const dx = gx - loc.x;
  const dy = gy - loc.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const diag = Math.sqrt(floor.width_px * floor.width_px + floor.height_px * floor.height_px) || 1;
  const normalized = Math.min(1, distance / diag);
  let score = Math.max(0, Math.round(100 * Math.pow(1 - normalized, 2)));
  const isCorrectFloor = selectedFloor && Number(selectedFloor) === Number(loc.floor_id);
  if (selectedFloor && !isCorrectFloor) {
    score = Math.min(10, Math.round(score / 10));
  }
  return {
    score,
    correct_x: loc.x,
    correct_y: loc.y,
    floor_id: loc.floor_id,
    is_correct_floor: isCorrectFloor
  };
}

function cleanupRoom(roomCode) {
  const room = duelRooms.get(roomCode);
  if (room) {
    if (room.photoTimer) clearTimeout(room.photoTimer);
    if (room.guessTimer) clearTimeout(room.guessTimer);
    if (room.resultTimer) clearTimeout(room.resultTimer);
    duelRooms.delete(roomCode);
  }
}

function startDuelRound(roomCode) {
  const room = duelRooms.get(roomCode);
  if (!room) return;

  room.round++;
  room.guesses = {};
  room.roundResults = {};

  // Get a random location
  const data = getRandomDuelLocation(room.usedLocationIds);
  if (!data) {
    io.to(roomCode).emit('duel-error', { message: 'Нет доступных локаций' });
    cleanupRoom(roomCode);
    return;
  }

  room.usedLocationIds.push(data.location.id);
  room.currentLocation = data.location;
  room.currentFloor = data.floor;

  // Send round start to both players (hide correct coordinates)
  io.to(roomCode).emit('duel-round-start', {
    round: room.round,
    totalRounds: DUEL_CONFIG.TOTAL_ROUNDS,
    location: {
      id: data.location.id,
      floor_id: data.location.floor_id,
      image_path: data.location.image_path,
      hint: data.location.hint || null
    },
    floor: data.floor,
    photoTime: DUEL_CONFIG.PHOTO_TIME,
    guessTime: DUEL_CONFIG.GUESS_TIME,
    players: {
      [room.players[0].odId]: { hp: room.hp[room.players[0].odId], name: room.players[0].name, avatar_url: room.players[0].avatar_url },
      [room.players[1].odId]: { hp: room.hp[room.players[1].odId], name: room.players[1].name, avatar_url: room.players[1].avatar_url }
    }
  });

  // Photo viewing timer
  room.photoTimer = setTimeout(() => {
    io.to(roomCode).emit('duel-photo-time-up');
    
    // Guess timer
    room.guessTimer = setTimeout(() => {
      // Auto-submit for anyone who hasn't guessed
      for (const p of room.players) {
        if (!room.guesses[p.odId]) {
          room.guesses[p.odId] = { score: 0, auto: true };
        }
      }
      processRoundResults(roomCode);
    }, DUEL_CONFIG.GUESS_TIME * 1000);
  }, DUEL_CONFIG.PHOTO_TIME * 1000);
}

function processRoundResults(roomCode) {
  const room = duelRooms.get(roomCode);
  if (!room || room.roundProcessed) return;
  room.roundProcessed = true;

  const p1 = room.players[0];
  const p2 = room.players[1];
  const g1 = room.guesses[p1.odId] || { score: 0, auto: true };
  const g2 = room.guesses[p2.odId] || { score: 0, auto: true };

  // Calculate HP damage based on who was more accurate
  let damage1 = 0;
  let damage2 = 0;

  if (g1.score > g2.score) {
    // P1 was more accurate. P2 takes damage based on their error
    damage1 = 0;
    damage2 = (100 - g2.score) * 10;
  } else if (g2.score > g1.score) {
    // P2 was more accurate. P1 takes damage based on their error
    damage1 = (100 - g1.score) * 10;
    damage2 = 0;
  } else {
    // Both same score (e.g. both timed out / completely wrong)
    damage1 = (100 - g1.score) * 10;
    damage2 = (100 - g2.score) * 10;
  }

  damage1 = Math.max(0, damage1);
  damage2 = Math.max(0, damage2);

  const oldHp1 = room.hp[p1.odId];
  const oldHp2 = room.hp[p2.odId];
  room.hp[p1.odId] = Math.max(0, room.hp[p1.odId] - damage1);
  room.hp[p2.odId] = Math.max(0, room.hp[p2.odId] - damage2);

  const roundResult = {
    round: room.round,
    location: {
      correct_x: room.currentLocation.x,
      correct_y: room.currentLocation.y,
      floor_id: room.currentLocation.floor_id
    },
    floor: room.currentFloor,
    players: {
      [p1.odId]: {
        name: p1.name,
        avatar_url: p1.avatar_url,
        score: g1.score,
        guess_x: g1.guess_x,
        guess_y: g1.guess_y,
        selected_floor: g1.selected_floor,
        damage: damage1,
        oldHp: oldHp1,
        hp: room.hp[p1.odId],
        auto: g1.auto || false
      },
      [p2.odId]: {
        name: p2.name,
        avatar_url: p2.avatar_url,
        score: g2.score,
        guess_x: g2.guess_x,
        guess_y: g2.guess_y,
        selected_floor: g2.selected_floor,
        damage: damage2,
        oldHp: oldHp2,
        hp: room.hp[p2.odId],
        auto: g2.auto || false
      }
    }
  };

  // Check if anyone died
  const p1Dead = room.hp[p1.odId] <= 0;
  const p2Dead = room.hp[p2.odId] <= 0;
  const gameOver = p1Dead || p2Dead || room.round >= DUEL_CONFIG.TOTAL_ROUNDS;

  io.to(roomCode).emit('duel-round-result', roundResult);

  if (gameOver) {
    let winnerId = null;
    if (p1Dead && p2Dead) {
      // Both dead — higher HP wins (or tie)
      winnerId = room.hp[p1.odId] >= room.hp[p2.odId] ? p1.odId : p2.odId;
    } else if (p1Dead) {
      winnerId = p2.odId;
    } else if (p2Dead) {
      winnerId = p1.odId;
    } else {
      // All rounds done — higher HP wins
      winnerId = room.hp[p1.odId] >= room.hp[p2.odId] ? p1.odId : p2.odId;
    }

    const winner = room.players.find(p => p.odId === winnerId);
    const loser = room.players.find(p => p.odId !== winnerId);

    setTimeout(() => {
      io.to(roomCode).emit('duel-game-over', {
        winnerId,
        winner: { name: winner.name, odId: winner.odId, avatar_url: winner.avatar_url, hp: room.hp[winner.odId] },
        loser: { name: loser.name, odId: loser.odId, avatar_url: loser.avatar_url, hp: room.hp[loser.odId] }
      });
      cleanupRoom(roomCode);
    }, DUEL_CONFIG.RESULT_TIME * 1000);
  } else {
    // Schedule next round after result display
    room.resultTimer = setTimeout(() => {
      room.roundProcessed = false;
      startDuelRound(roomCode);
    }, DUEL_CONFIG.RESULT_TIME * 1000);
  }
}

io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);
  let currentRoomCode = null;

  socket.on('create-room', (data) => {
    const { userId, name, avatar_url } = data;
    const roomCode = generateRoomCode();
    const player = { odId: socket.id, odUserId: userId, name, avatar_url, socketId: socket.id };

    duelRooms.set(roomCode, {
      code: roomCode,
      players: [player],
      hp: { [socket.id]: DUEL_CONFIG.MAX_HP },
      round: 0,
      usedLocationIds: [],
      guesses: {},
      roundResults: {},
      currentLocation: null,
      currentFloor: null,
      roundProcessed: false,
      photoTimer: null,
      guessTimer: null,
      resultTimer: null
    });

    currentRoomCode = roomCode;
    socket.join(roomCode);
    socket.emit('room-created', { roomCode, player });
    console.log(`Room ${roomCode} created by ${name}`);
  });

  socket.on('join-room', (data) => {
    const { roomCode, userId, name, avatar_url } = data;
    const room = duelRooms.get(roomCode);

    if (!room) {
      socket.emit('duel-error', { message: 'Комната не найдена' });
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('duel-error', { message: 'Комната заполнена' });
      return;
    }

    const player = { odId: socket.id, odUserId: userId, name, avatar_url, socketId: socket.id };
    room.players.push(player);
    room.hp[socket.id] = DUEL_CONFIG.MAX_HP;

    currentRoomCode = roomCode;
    socket.join(roomCode);

    io.to(roomCode).emit('player-joined', {
      roomCode,
      players: room.players.map(p => ({ odId: p.odId, name: p.name, avatar_url: p.avatar_url }))
    });
    console.log(`${name} joined room ${roomCode}`);

    // Auto-start game when 2 players are in
    if (room.players.length === 2) {
      setTimeout(() => {
        io.to(roomCode).emit('duel-starting', { countdown: 3 });
        setTimeout(() => {
          startDuelRound(roomCode);
        }, 3000);
      }, 1500);
    }
  });

  socket.on('submit-duel-guess', (data) => {
    const { roomCode, guess_x, guess_y, selected_floor } = data;
    const room = duelRooms.get(roomCode);
    if (!room || !room.currentLocation) return;
    if (room.guesses[socket.id]) return; // Already guessed

    const result = calculateDuelScore(
      room.currentLocation.id,
      guess_x,
      guess_y,
      selected_floor
    );

    room.guesses[socket.id] = {
      score: result.score,
      guess_x,
      guess_y,
      selected_floor,
      ...result
    };

    socket.emit('duel-guess-received', { score: result.score });

    // If both players have guessed, process results immediately
    if (Object.keys(room.guesses).length >= 2) {
      if (room.guessTimer) clearTimeout(room.guessTimer);
      processRoundResults(roomCode);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
    if (currentRoomCode) {
      const room = duelRooms.get(currentRoomCode);
      if (room) {
        // Notify the other player
        socket.to(currentRoomCode).emit('opponent-disconnected', {
          message: 'Противник отключился'
        });
        cleanupRoom(currentRoomCode);
      }
    }
  });

  socket.on('leave-room', () => {
    if (currentRoomCode) {
      const room = duelRooms.get(currentRoomCode);
      if (room) {
        socket.to(currentRoomCode).emit('opponent-disconnected', {
          message: 'Противник покинул комнату'
        });
        cleanupRoom(currentRoomCode);
      }
      socket.leave(currentRoomCode);
      currentRoomCode = null;
    }
  });
});

app.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: `File is too large. Max ${Math.round(MAX_UPLOAD_SIZE_BYTES / 1024 / 1024)}MB` });
    }
    return res.status(400).json({ error: err.message });
  }
  return next(err);
});

// Serve static files from client build in production
const clientDistPath = path.join(__dirname, '../../client/dist');
import fs from 'fs';

if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  
  // SPA fallback - serve index.html for all non-API routes
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
  console.log('✓ Serving static files from client/dist');
}

// Initialize storage and start server
async function startServer() {
  try {
    await initializeStorage();
    console.log('✓ MinIO storage initialized');
    
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT}`);
      console.log(`Access from internet: http://YOUR_PUBLIC_IP:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to initialize storage:', err);
    console.log('Starting server without MinIO (uploads will fail)...');
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Server listening on http://0.0.0.0:${PORT} (MinIO not available)`);
    });
  }
}

startServer();
