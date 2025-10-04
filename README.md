## MTU Campus GeoGuesser (Indoor)

Full-stack indoor geoguesser focused on guessing places inside a university building. Admins upload floor maps and location photos; players guess spots by clicking on the floor map.

### Stack
- Server: Node.js (Express), SQLite (better-sqlite3), Multer, CORS
- Client: Vite + React + React Router, Axios

### Local Setup

Prerequisites: Node 18+

1. Install dependencies
```bash
cd server && npm i
cd ../client && npm i
```

2. Run server
```bash
cd server
npm run dev
# Server on http://localhost:3001
```

3. Run client
```bash
cd client
npm run dev
# App on http://localhost:5173
```

### Usage

- Admin
  - Open `/admin`
  - Upload a floor plan image with building and level info
  - Select the floor, click on the map to set coordinates
  - Upload a location photo with optional hint

- Play
  - On `/`, pick a floor or use Random
  - View the location photo and hint
  - Click on the floor map to place your guess
  - Submit to see distance, score, and the correct spot

Uploads are saved under `server/uploads/` and served via `/uploads/...` URLs.

### API

- `GET /api/health`
- `GET /api/floors`
- `GET /api/floors/:id`
- `POST /api/floors` (multipart: image, name, building, level)
- `GET /api/locations?admin=1`
- `GET /api/locations/random[?floor_id=ID]`
- `POST /api/locations` (multipart: floor_id, x, y, image, name?, hint?)
- `POST /api/guess` (json: location_id, guess_x, guess_y)

### Notes
- Coordinates are stored in source image pixel space; pointer coords are scaled accordingly.
- Score is 0–1000 scaled by diagonal distance; ≤40px counts as correct.
- This is a local single-user app; add auth for multi-user admin.


