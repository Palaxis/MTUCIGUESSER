# ЛР2 - Аутентификация и авторизация на Access/Refresh Token

## Цель

Перевести текущую auth-схему на токенную модель (access + refresh), сохранив RBAC из ЛР1 и не ломая игровой flow.

## Границы лабораторной

- Делать: токены, refresh rotation/revoke, middleware проверки, auth-state клиента.
- Делать: начало слоистой архитектуры `routes -> services -> repositories`.
- Не делать: SEO/интеграции/полный тестовый контур (это ЛР4/ЛР5).

## Зависимости

- Требует завершенной ЛР1.
- Ролевая модель ЛР1 сохраняется без изменений.

## Целевые решения

- Access token: короткий TTL (рекомендуется 15 минут).
- Refresh token: долгий TTL (рекомендуется 7-30 дней).
- Refresh хранится в `HttpOnly` cookie; в БД хранится `token_hash` или `jti`, срок жизни и revoke-статус.

## Бэклог задач (выполнять по порядку)

1. **Auth data model**
  - создать таблицу refresh-сессий (`user_id`, `jti/token_hash`, `expires_at`, `revoked_at`, `created_at`, `user_agent`, `ip`);
  - добавить индексы на `user_id` и `jti/token_hash`.
2. **Backend token flow**
  - `POST /api/auth/login` (выдача access + refresh);
  - `POST /api/auth/refresh` (rotation refresh + новый access);
  - `POST /api/auth/logout` (revoke текущего refresh + очистка cookie);
  - `GET /api/auth/me` (валидный access + роли/permissions).
3. **Middleware и guards**
  - access-token middleware для protected endpoint-ов;
  - единый формат ответа при `401/403`.
4. **Refresh rotation/revocation**
  - на refresh старый refresh помечается revoked;
  - при replay revoked-токена сессия блокируется и логируется.
5. **Backend architecture**
  - вынести auth-логику из одного файла в слои:
    - routes (HTTP + DTO validation),
    - services (token/session logic),
    - repositories (SQL access),
    - composition/DI.
6. **Frontend auth flow**
  - централизовать auth-state (user + auth status + permissions);
  - axios interceptor: `401 -> refresh -> retry`;
  - при провале refresh: очистка state и redirect на login.
7. **Проверка совместимости**
  - RBAC из ЛР1 работает поверх новой auth-схемы;
  - геймплей и leaderboard работают для авторизованных пользователей.

## Критерии готовности (DoD)

- Логин/refresh/logout работают стабильно.
- Без валидного access protected API недоступен (`401`).
- После logout refresh невозможен.
- Повторное использование отозванного refresh обрабатывается безопасно.
- RBAC-проверки из ЛР1 не регрессировали.
- Auth-часть backend разделена на route/service/repository.

## Инструкции для Cursor

1. Сначала спроектировать токенный flow и схему хранения refresh.
2. Не смешивать в одной правке одновременно auth и крупные бизнес-фичи.
3. Сначала backend, потом frontend interceptor и UI-состояния.
4. После каждого этапа выполнить auth smoke-тест:
  - login ok/fail;
  - `/me` с валидным/просроченным access;
  - refresh;
  - logout и повторный refresh.

## Промпты для Cursor

### Prompt A - Проектирование схемы токенов

```text
Спроектируй безопасную схему access/refresh для текущего Express-приложения:
хранение refresh, ротация, revoke, replay-защита, TTL и поля таблиц.
Выведи сначала краткую схему потока, затем план внедрения по шагам.
```

### Prompt B - Реализация backend

```text
Реализуй auth endpoints login/refresh/logout/me на Express с JWT access+refresh.
Добавь хранение refresh в БД, revoke и rotation.
Подключи access middleware для protected routes.
Сохрани существующие игровые endpoint-ы и RBAC-поведение.
```

### Prompt C - Реализация frontend

```text
Обнови frontend auth:
1) централизованный auth-state;
2) axios interceptor с auto refresh;
3) корректная очистка состояния при невалидной сессии;
4) route/UI protection по auth + roles/permissions.
```

### Prompt D - Верификация

```text
Проверь сценарии:
1) login success/fail;
2) доступ к protected endpoint с valid/invalid access;
3) refresh rotation;
4) logout и запрет дальнейшего refresh;
5) RBAC поверх новой auth.
Сформируй итоговый чеклист с фактическими результатами.
```

## Отчет по ЛР2 (что обязательно включить)

1. Целевая схема аутентификации (access/refresh).
2. Политика срока жизни, ротации и отзыва токенов.
3. Реализация backend endpoint-ов и middleware.
4. Реализация frontend interceptor и реакции UI.
5. Подтверждение совместимости с RBAC.
6. Протокол позитивных/негативных auth-сценариев.

