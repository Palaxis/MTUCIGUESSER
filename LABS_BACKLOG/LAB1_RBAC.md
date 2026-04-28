# ЛР1 - Проектирование и внедрение RBAC

## Цель

Внедрить ролевую модель доступа в существующий MVP без потери текущего игрового функционала.

## Границы лабораторной

- Делать: роли, permissions, backend-проверки, frontend-поведение по правам.
- Не делать: access/refresh токены (это ЛР2), SEO, тестовую инфраструктуру CI/CD.

## Зависимости

- ЛР1 выполняется первой.
- Результат ЛР1 обязателен для ЛР2-ЛР6.

## Целевая ролевая модель

- `guest` - неавторизованный пользователь.
- `player` - авторизованный пользователь, базовые действия.
- `content_manager` - управление этажами/локациями.
- `admin` - полный доступ + назначение ролей.

## Минимальный набор permissions

- `floors.read`, `floors.create`, `floors.delete`
- `locations.read`, `locations.create`, `locations.delete`
- `users.read.self`, `users.update.self`, `users.avatar.upload.self`
- `users.read.any`, `users.update.any`
- `roles.manage`
- `results.create`, `leaderboard.read`

## Бэклог задач (выполнять по порядку)

1. **Модель данных RBAC**
  - создать таблицы `roles`, `permissions`, `user_roles`, `role_permissions`;
  - добавить инициализацию (seed) с базовыми ролями и permission;
  - добавить привязку существующего `admin@admin.com` к роли `admin`.
2. **Backend-guards**
  - реализовать `requireAuth`;
  - реализовать `requirePermission(permission)`;
  - реализовать self-check helper (`isOwnResource`) для `users.*.self`.
3. **Защита endpoint-ов**
  - убрать hardcode-проверки по email;
  - защитить CRUD этажей/локаций;
  - защитить изменение профиля/аватара;
  - добавить админ-эндпоинты управления ролями.
4. **Возврат прав в auth API**
  - расширить `/api/auth/me`: roles + permissions;
  - проверить обратную совместимость полей пользователя.
5. **Frontend-права**
  - добавить helper `can(permission)` и `hasRole(role)`;
  - скрывать/дизейблить действия без прав;
  - защитить вход на admin-экран по permission, а не по email.
6. **Проверки отказов**
  - для всех чувствительных операций убедиться в `403 Forbidden`;
  - добавить человекочитаемую обработку `403` на UI.

## Критерии готовности (DoD)

- Нет проверок вида `email === 'admin@admin.com'` в логике доступа.
- Все чувствительные endpoint-ы проверяют permission.
- Работает минимум один endpoint управления ролями, доступный только admin.
- UI корректно ограничивает действия по ролям.
- Базовый геймплей, лидерборд, дуэли и профиль не сломаны.

## Инструкции для Cursor

1. Перед изменениями сделать аудит endpoint-ов и текущих проверок.
2. Сначала внести RBAC-слой на backend, затем обновить frontend.
3. Не смешивать внедрение токенов в этой лабораторной.
4. После каждого блока изменений запускать smoke-check:
  - login/register/me;
  - play/play360;
  - admin CRUD;
  - leaderboard.

## Промпты для Cursor

### Prompt A - Аудит доступа

```text
Проанализируй сервер и клиент, составь таблицу операций с доступом:
сущность, действие, текущая защита, целевая permission, риск.
Сначала выведи только план внедрения без правок, затем выполни правки по шагам.
```

### Prompt B - Внедрение RBAC в backend

```text
Реализуй RBAC в Express backend:
1) таблицы roles/permissions/user_roles/role_permissions + seed;
2) middleware requireAuth и requirePermission;
3) перевод защищенных endpoint-ов на permissions;
4) endpoint-ы назначения/снятия ролей только для admin.
Сохрани текущий игровой API и совместимость ответов.
```

### Prompt C - Внедрение RBAC в frontend

```text
Обнови frontend под RBAC:
1) получай roles/permissions из /api/auth/me;
2) добавь helper can(permission);
3) убери доступ к админке по email;
4) скрывай/блокируй недоступные действия и маршруты.
```

### Prompt D - Проверка и фиксация результата

```text
Составь и выполни smoke-checklist для ролей guest/player/content_manager/admin.
Для каждого сценария зафиксируй ожидаемый и фактический результат:
HTTP-код, изменение UI, отсутствие регрессий в игре.
```

## Отчет по ЛР1 (что обязательно включить)

1. Постановка задачи и исходное состояние MVP.
2. Матрица `роль -> действия -> ограничения`.
3. Описание backend-проверок и принципа default deny.
4. Изменения frontend по ролевому поведению.
5. Негативные кейсы (`403`) и скриншоты UI.
6. Вывод: как соблюден принцип least privilege.

