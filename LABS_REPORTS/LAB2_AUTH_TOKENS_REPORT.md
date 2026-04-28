# Лабораторная работа №2: Аутентификация и авторизация на Access/Refresh Token

## 1. Титульный блок

- Дисциплина: веб-разработка (проект MTUCI Guesser).
- Номер и тема: ЛР2, переход на токенную auth-схему (access + refresh) с сохранением RBAC.
- Студент: *заполнить*.
- Группа: *заполнить*.
- Преподаватель: *заполнить*.
- Дата: 28.04.2026.

## 2. Цель работы

Перевести проект с session-based аутентификации на схему `JWT access + refresh token` с безопасной ротацией и отзывом refresh-токенов, сохранив существующую модель ролей/прав (RBAC) и рабочий игровой flow.

## 3. Исходное состояние проекта

- На старте использовалась `express-session` с хранением `userId` в сессии.
- RBAC из ЛР1 уже был реализован на таблицах `roles`, `permissions`, `user_roles`, `role_permissions`.
- Auth-логика была смешана в `server/src/index.js` без разделения на слои.
- Клиент не хранил access token и не имел auto-refresh при `401`.

## 4. Постановка задачи

Требования из `LABS_BACKLOG/LAB2_AUTH_TOKENS.md`:

- внедрить access/refresh;
- добавить хранение refresh-сессий, revoke и rotation;
- реализовать `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`;
- перевести auth на слои `routes -> services -> repositories`;
- добавить frontend interceptor `401 -> refresh -> retry`;
- обеспечить совместимость RBAC-проверок и игрового функционала.

Критерий готовности: protected endpoint-ы требуют валидный access, refresh после logout не работает, RBAC из ЛР1 не регрессирует.

## 5. Проектные решения

- Access token:
  - формат: JWT;
  - payload: `sub`, `type=access`;
  - TTL: 15 минут (настраивается через `ACCESS_TOKEN_TTL`).
- Refresh token:
  - формат: JWT;
  - payload: `sub`, `jti`, `type=refresh`;
  - хранится в `HttpOnly` cookie `refreshToken` (path `/api/auth`);
  - TTL: 7 дней (настраивается через `REFRESH_TOKEN_TTL_SECONDS`).
- Серверное хранение refresh:
  - таблица `refresh_sessions` с полями `user_id`, `jti`, `token_hash`, `expires_at`, `revoked_at`, `created_at`, `user_agent`, `ip`;
  - индексы на `user_id` и `jti`.
- Защита от replay:
  - при refresh старый токен ревокается;
  - повторная попытка использовать revoked refresh приводит к revoke всех refresh-сессий пользователя и логированию инцидента.
- Архитектурный подход:
  - `routes`: HTTP-обработчики auth endpoint-ов;
  - `services`: токены, ротация, валидация, auth flow;
  - `repositories`: SQL-операции по пользователям/ролям/refresh-сессиям.

## 6. Реализация

### 6.1 Серверная часть

Выполнены изменения:

- Добавлена таблица `refresh_sessions` и индексы в `server/src/db.js`.
- Вынесен auth в слои:
  - `server/src/auth/routes/authRoutes.js`;
  - `server/src/auth/services/authService.js`;
  - `server/src/auth/services/tokenService.js`;
  - `server/src/auth/repositories/authRepository.js`;
  - `server/src/auth/middleware/authMiddleware.js`.
- Добавлены endpoint-ы:
  - `POST /api/auth/login`;
  - `POST /api/auth/register` (с автологином);
  - `POST /api/auth/refresh` (rotation refresh);
  - `POST /api/auth/logout` (revoke + clear cookie);
  - `GET /api/auth/me` (требует access token).
- `express-session` заменен на JWT + cookie-parser.
- Для `401/403` в auth middleware введен единый формат ответа с кодами `AUTH_UNAUTHORIZED` и `AUTH_FORBIDDEN`.
- Сохранены RBAC проверки через `requirePermission(...)` для существующих защищенных endpoint-ов.

### 6.2 Клиентская часть

Выполнены изменения:

- `client/src/shared/api/client.ts`:
  - централизовано хранение access token в памяти;
  - добавлен axios interceptor: при `401` выполняется `/api/auth/refresh`, затем оригинальный запрос повторяется;
  - при провале refresh выполняется очистка токена и dispatch события `auth:session-expired`.
- `client/src/shared/api/auth.ts`:
  - `login/register/refresh` возвращают `{ user, accessToken }`.
- `client/src/shared/hooks/useAuth.ts`:
  - access token устанавливается на login/register;
  - на logout и `auth:session-expired` очищается auth-state.

### 6.3 Данные и инфраструктура

- Добавлена зависимость `jsonwebtoken` в backend.
- Обновлен `better-sqlite3` до актуальной версии для совместимости с текущей Node.js средой.

## 7. Проверка и тестирование

Проведены smoke-проверки auth-сценариев на локальном сервере:

- Register: ожидалось создание пользователя и выдача пары токенов; фактически получено `201`, access token в body и refresh cookie.
- `/api/auth/me` с валидным access: ожидался доступ к профилю; фактически `200` и корректные данные пользователя.
- `/api/auth/me` с невалидным access: ожидался отказ; фактически `401` с кодом `AUTH_UNAUTHORIZED`.
- `POST /api/auth/refresh`: ожидалась ротация; фактически `200` и новый access token.
- `POST /api/auth/logout`: ожидался отзыв refresh; фактически `200`, `ok=true`, cookie очищена.
- Refresh после logout: ожидался запрет; фактически `401`, refresh более недоступен.

Дополнительно:

- `client`: `npm run build` — успешно.
- `server`: `node --check src/index.js` — синтаксически корректно.

## 8. Сохранение и расширение игрового функционала

- Защищенные игровые endpoint-ы продолжают использовать `requireAuth` + `requirePermission`.
- RBAC логика не удалялась и применяется поверх новой JWT-схемы.
- Лидерборд остается доступен для гостя (как раньше), но для авторизованного пользователя проверка прав выполняется через токен.

## 9. Выводы

- Цель ЛР2 достигнута: внедрена токенная модель `access + refresh` с ротацией и отзывом refresh-сессий.
- Auth-часть backend отделена в слоистую архитектуру (`routes/services/repositories`), что упростило сопровождение.
- Клиент получил устойчивый auth flow с автообновлением access и корректной очисткой сессии.
- Техдолг: добавить полноценные автоматизированные интеграционные тесты auth-потока (планируется в ЛР5).

## 10. Приложения

- Основные измененные файлы backend:
  - `server/src/db.js`
  - `server/src/index.js`
  - `server/src/auth/routes/authRoutes.js`
  - `server/src/auth/services/authService.js`
  - `server/src/auth/services/tokenService.js`
  - `server/src/auth/repositories/authRepository.js`
  - `server/src/auth/middleware/authMiddleware.js`
- Основные измененные файлы frontend:
  - `client/src/shared/api/client.ts`
  - `client/src/shared/api/auth.ts`
  - `client/src/shared/hooks/useAuth.ts`

---

## Чеклист качества отчета

- Все пункты методички ЛР2 покрыты.
- Прослеживается связь "требование -> реализация -> проверка".
- Подтверждена совместимость RBAC и игрового функционала.
- Зафиксированы позитивные и негативные auth-сценарии.
- Указаны ограничения и дальнейшие улучшения.