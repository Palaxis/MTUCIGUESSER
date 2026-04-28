# Отчёт по лабораторной работе №4  
**Тема:** SEO-оптимизация и интеграция стороннего API

## 1) SEO-аудит и стратегия индексации

### Карта страниц
- **Публичные индексируемые:** `/`, `/leaderboard`, `/duel` (для авторизованных пользователей; в SEO-мета управляется через robots).
- **Публичные неиндексируемые:** `/login`, `/register`.
- **Приватные:** `/account`, `/admin`, `/play`, `/play360` (закрыты от индексации).

### Принятая стратегия
- Индексируем только страницы с публичной ценностью (главная, рейтинг, дуэльный режим).
- Закрываем служебные/персональные страницы через `meta robots` и `robots.txt`.
- Для индексируемых страниц выставляем `canonical` и `OpenGraph` метаданные.

## 2) Реализованные SEO-изменения frontend/backend

### Frontend
- Добавлен централизованный SEO-слой `client/src/shared/seo/SeoHead.tsx`.
- Для страниц добавлены динамические:
  - `title`;
  - `meta[name="description"]`;
  - `meta[name="robots"]`;
  - `meta[property="og:title|og:description|og:type|og:url"]`;
  - `link rel="canonical"`.
- В `client/src/app/App.tsx` подключён `SeoHead` с конфигурацией по текущему разделу.
- На главной (`client/src/pages/HomePage.tsx`) улучшена семантика:
  - `main`, `header`, `section`, `nav`, `aside`;
  - сохранены/используются корректные `alt` у изображений.

### Backend (техническое SEO)
- Добавлен `GET /robots.txt`:
  - разрешение индексации публичной части;
  - запрет индексации приватных/служебных URL.
- Добавлен `GET /sitemap.xml`:
  - включает ключевые публичные URL (`/`, `/leaderboard`, `/duel`);
  - отдаётся как `application/xml`.
- Реализовано в `server/src/index.js`.

## 3) Structured Data (JSON-LD) и обоснование

- Добавлен JSON-LD для страницы рейтинга (`ItemList`) через `SeoHead`.
- Тип выбран потому, что leaderboard по смыслу является ранжированным списком результатов.
- Данные публикуются в `<script type="application/ld+json">`, что повышает машиночитаемость контента для поисковых систем.

## 4) Интеграция внешнего API и нормализация

### Use-case
- Внешний API погоды используется для блока «Подсказка дня» на главной странице.
- Это не вмешивается в игровую механику и добавляет внешний контекст (информационный блок).

### Backend adapter/service
- Создан сервис `server/src/services/weatherHintService.js`.
- Источник: OpenWeather (`WEATHER_API_BASE_URL`, `WEATHER_API_KEY`).
- Реализованы:
  - **timeout** через `AbortController`;
  - **retry** (настраиваемое количество попыток);
  - **rate-limit** по IP на роуте `/api/external/weather-hint`;
  - **normalization** ответа во внутренний формат:
    - `city`;
    - `temperatureCelsius`;
    - `weather`;
    - `recommendation`;
    - `sourceUpdatedAt`.

### Конфигурация и безопасность
- Секреты не хардкодятся: ключ API хранится только в env:
  - `WEATHER_API_KEY`;
  - `WEATHER_API_BASE_URL`;
  - `WEATHER_API_TIMEOUT_MS`;
  - `WEATHER_API_RETRY_COUNT`;
  - `EXTERNAL_API_RATE_LIMIT`;
  - `PUBLIC_APP_URL`.

## 5) Протокол проверки отказоустойчивости внешнего API

Проведена проверка сценариев graceful degradation:
- **Нет ключа API (`WEATHER_API_KEY` пустой):**
  - backend возвращает `data: null`;
  - фронт показывает безопасный fallback-текст;
  - игра продолжает работать.
- **Ошибка внешнего сервиса/таймаут:**
  - backend возвращает `503` с `fallback: true`;
  - фронт показывает состояние ошибки, без блокировки основных кнопок и навигации.
- **Лимит запросов:**
  - при превышении частоты запросов возвращается `429`;
  - UI не падает и продолжает работу с fallback-сообщением.

## 6) Подтверждение сохранения игровой функциональности

- Игровая бизнес-логика (`guess`, `play`, `duel`, `leaderboard`) не изменялась.
- Проведена проверка сборки:
  - `client`: `npm run build` — успешно;
  - `server`: `node --check src/index.js` и `node --check src/services/weatherHintService.js` — успешно.
- Дополнительно выполнен lazy loading тяжёлых страниц (`Play`, `DuelPage`, `Admin`) для улучшения производительности без изменения игровой механики.

## Изменённые файлы

- `client/src/app/App.tsx`
- `client/src/shared/seo/SeoHead.tsx` (новый)
- `client/src/shared/api/external.ts` (новый)
- `client/src/shared/api/index.ts`
- `client/src/pages/HomePage.tsx`
- `client/src/pages/HomePage.css`
- `server/src/services/weatherHintService.js` (новый)
- `server/src/index.js`
- `server/.env`
- `LABS_REPORTS/LAB4_SEO_EXTERNAL_API_REPORT.md` (этот отчёт)
