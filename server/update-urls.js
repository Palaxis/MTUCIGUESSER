import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = path.join(__dirname, 'data', 'geoguesser.sqlite');
const db = new Database(dbPath);

// Переключение на локальный запуск
const OLD_HOST = '95.31.167.199';
const NEW_HOST = 'localhost';

console.log(`Обновление URL: ${OLD_HOST} -> ${NEW_HOST}\n`);

// Обновляем floors
const floorsResult = db.prepare(`
  UPDATE floors 
  SET image_path = REPLACE(image_path, 'http://${OLD_HOST}:', 'http://${NEW_HOST}:')
  WHERE image_path LIKE '%${OLD_HOST}%'
`).run();
console.log(`✓ floors: обновлено ${floorsResult.changes} записей`);

// Обновляем locations
const locationsResult = db.prepare(`
  UPDATE locations 
  SET image_path = REPLACE(image_path, 'http://${OLD_HOST}:', 'http://${NEW_HOST}:')
  WHERE image_path LIKE '%${OLD_HOST}%'
`).run();
console.log(`✓ locations: обновлено ${locationsResult.changes} записей`);

// Обновляем users (avatar_url)
const usersResult = db.prepare(`
  UPDATE users 
  SET avatar_url = REPLACE(avatar_url, 'http://${OLD_HOST}:', 'http://${NEW_HOST}:')
  WHERE avatar_url LIKE '%${OLD_HOST}%'
`).run();
console.log(`✓ users (avatars): обновлено ${usersResult.changes} записей`);

console.log('\n✅ Готово! Перезапустите сервер.');
db.close();
