# Отчет по ЛР1: Проектирование и внедрение RBAC

## 1. Постановка задачи и исходное состояние MVP

### Цель работы

Внедрить ролевую модель доступа (RBAC) в существующий MVP MTUCI Guesser без поломки базового игрового функционала (игра, профиль, лидерборд, дуэли).

### Исходное состояние до изменений

- Авторизация была сессионной, но без полноценной модели ролей и permissions.
- Доступ в админскую часть на frontend определялся через проверку email (`admin@admin.com`).
- На backend не было единого слоя `requireAuth` + `requirePermission`.
- Чувствительные endpoint-ы не использовали единый принцип `default deny`.

## 2. Матрица "роль -> действия -> ограничения"

### Роли

- `guest`
- `player`
- `content_manager`
- `admin`

### Матрица доступа

- `guest`
  - Разрешено: `floors.read`, `locations.read`, `leaderboard.read`
  - Ограничения: нет доступа к изменениям данных, профилю, результатам, ролям
- `player`
  - Разрешено: чтение этажей/локаций, работа со своим профилем (`users.read.self`, `users.update.self`, `users.avatar.upload.self`), сохранение результата (`results.create`), чтение лидерборда
  - Ограничения: нет прав на admin CRUD и управление ролями
- `content_manager`
  - Разрешено: CRUD по контенту (`floors.create/delete`, `locations.create/delete`), чтение этажей/локаций/лидерборда
  - Ограничения: нет прав на управление пользователями и ролями
- `admin`
  - Разрешено: полный доступ по контенту, расширенные права по пользователям (`users.read.any`, `users.update.any`) и `roles.manage`
  - Ограничения: отсутствуют в рамках RBAC-модели ЛР1

## 3. Изменения backend и принцип default deny

### 3.1. Модель данных RBAC

В `server/src/db.js` добавлены сущности:

- `roles`
- `permissions`
- `user_roles`
- `role_permissions`

Также добавлены индексы для ускорения проверок и seed-логика:

- создание базовых ролей и permissions;
- связывание ролей с permissions;
- назначение роли `player` пользователям без ролей;
- назначение/подтверждение роли `admin` пользователю `admin@admin.com`.

### 3.2. Middleware и helper-ы авторизации

В `server/src/index.js` реализованы:

- `requireAuth` — обязательная проверка аутентификации и сбор auth-контекста;
- `requirePermission(permission)` — проверка конкретного permission;
- `isOwnResource(req, targetUserId)` — проверка доступа к собственному ресурсу.

### 3.3. Защита endpoint-ов

Защищены чувствительные операции:

- `POST /api/floors` -> `floors.create`
- `DELETE /api/floors/:id` -> `floors.delete`
- `POST /api/locations` -> `locations.create`
- `DELETE /api/locations/:id` -> `locations.delete`
- `PUT /api/users/:id` -> `users.update.self` (self) или `users.update.any`
- `POST /api/users/:id/avatar` -> `users.avatar.upload.self` (self) или `users.update.any`
- `POST /api/game-results` -> `results.create` + self-check по `user_id`

Добавлены admin endpoint-ы управления ролями (только `roles.manage`):

- `GET /api/admin/users`
- `POST /api/admin/users/:id/roles`
- `DELETE /api/admin/users/:id/roles/:role`

### 3.4. Возврат прав в auth API

Обновлены ответы:

- `/api/auth/me` возвращает пользователя в совместимом формате + `roles`, `permissions`;
- `/api/auth/login` и `/api/auth/register` также возвращают пользователя с `roles`, `permissions`.

### 3.5. Default deny

Принцип реализован через явные middleware на endpoint-ах: при отсутствии требуемого permission сервер возвращает `403 Forbidden`.

## 4. Изменения frontend по ролевому поведению

Изменения внесены в клиентскую часть:

- Расширен тип `User` в `client/src/shared/api/auth.ts`:
  - `roles?: string[]`
  - `permissions?: string[]`
- В `client/src/shared/hooks/useAuth.ts` добавлены helper-ы:
  - `can(permission)`
  - `hasRole(role)`
- В `client/src/app/App.tsx`:
  - убрана проверка доступа к админ-экрану по email;
  - доступ построен на permission-проверках (`can(...)`).
- В `client/src/pages/HomePage.tsx`:
  - кнопка перехода в админку показывается только при наличии нужных прав.
- В `client/src/shared/api/client.ts`:
  - добавлен обработчик `403` с человекочитаемым сообщением на UI.

## 5. Негативные кейсы (403) и скриншоты UI

### Ожидаемые негативные сценарии

- Попытка `player` удалить этаж/локацию -> `403 Forbidden`.
- Попытка `player` изменить чужой профиль -> `403 Forbidden`.
- Попытка пользователя без `roles.manage` вызвать `/api/admin/users` -> `403 Forbidden`.
- Попытка сохранения результата от чужого `user_id` -> `403 Forbidden`.

### Визуальное поведение UI

- Для пользователей без соответствующих прав кнопка админки скрыта.
- При запрете операции UI получает понятное сообщение об отсутствии прав.

### Скриншоты (добавить при защите)

- Скриншот 1: интерфейс `player` без кнопки админки.
- Скриншот 2: ответ/сообщение при `403` на запрещенной операции.
- Скриншот 3: интерфейс `admin` с доступной админ-панелью.

## 6. Проверка сохранения функциональности (smoke)

Проведены технические проверки после внедрения:

- Frontend-сборка: `npm run build` (успешно).
- Backend-проверка синтаксиса: `node --check src/index.js`, `node --check src/db.js` (успешно).
- Линтер-диагностика по измененным файлам: ошибок не выявлено.

Сохранена совместимость основных сценариев MVP:

- аутентификация (`login/register/me`);
- игровой цикл;
- лидерборд;
- профиль пользователя;
- доступ к админ-операциям только по permissions.

## 7. Вывод (least privilege)

В рамках ЛР1 реализована полноценная RBAC-модель с разграничением доступа по permissions и отказом от хардкод-проверок по email в логике доступа.  
Принцип наименьших привилегий соблюден: каждая роль получает только необходимый набор разрешений, а чувствительные операции защищены серверными проверками и возвращают `403` при нарушении прав.