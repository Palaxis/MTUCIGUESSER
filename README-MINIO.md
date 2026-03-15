# MinIO Storage Setup

## Быстрый старт

### 1. Запуск MinIO

```bash
cd MTUCIGUESSER
docker-compose up -d
```

MinIO будет доступен:
- **S3 API:** http://localhost:9000
- **Web Console:** http://localhost:9001

Логин/пароль для консоли: `minioadmin` / `minioadmin123`

### 2. Настройка сервера

Создайте файл `.env` в папке `server/`:

```env
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin123
MINIO_BUCKET=mtuci-guesser
SESSION_SECRET=mtuci-guesser-secret-key
PORT=3001
```

### 3. Запуск сервера

```bash
cd server
npm install
npm run dev
```

При первом запуске сервер автоматически:
- Создаст bucket `mtuci-guesser`
- Настроит публичный доступ для чтения файлов

### 4. Запуск клиента

```bash
cd client
npm install
npm run dev
```

## Как это работает

1. При загрузке изображения (этаж/локация):
   - Файл сохраняется в MinIO bucket
   - В БД сохраняется полный URL: `http://localhost:9000/mtuci-guesser/floors/floor_xxx.png`

2. При отображении изображения:
   - Браузер загружает напрямую из MinIO по URL

3. При удалении:
   - Файл удаляется из MinIO
   - Запись удаляется из БД

## Структура хранения

```
mtuci-guesser/
├── floors/
│   ├── floor_1702900000000.png
│   └── floor_1702900001000.webp
└── locations/
    ├── loc_1702900002000.jpg
    └── loc_1702900003000.webp
```

## Проверка

1. Откройте MinIO Console: http://localhost:9001
2. Войдите: `minioadmin` / `minioadmin123`
3. Перейдите в "Object Browser" → "mtuci-guesser"
4. Должны быть видны папки `floors/` и `locations/`

## Production

Для production измените в `.env`:
- `MINIO_ACCESS_KEY` и `MINIO_SECRET_KEY` на безопасные значения
- `SESSION_SECRET` на случайную строку
- Настройте `MINIO_USE_SSL=true` если используете HTTPS



