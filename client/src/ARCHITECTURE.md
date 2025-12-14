# Архитектура проекта

## Структура папок

```
src/
├── app/                    # Инициализация приложения
│   └── App.tsx             # Главный компонент с роутингом
│
├── pages/                  # Страницы (только UI, композиция)
│   ├── HomePage.tsx
│   ├── LoginPage.tsx
│   ├── Play.tsx
│   └── ...
│
├── features/               # Бизнес-логика фич
│   ├── auth/
│   │   └── types.ts       # Типы для авторизации
│   └── game/
│       ├── types.ts       # Типы для игры
│       └── hooks/
│           └── useGame.ts # Хук игровой логики
│
├── shared/                 # Переиспользуемый код
│   ├── api/               # API-клиент
│   │   ├── client.ts      # Настройка axios
│   │   ├── auth.ts        # API авторизации
│   │   ├── game.ts        # API игры
│   │   ├── user.ts        # API пользователя
│   │   ├── leaderboard.ts # API таблицы лидеров
│   │   └── index.ts       # Экспорты
│   │
│   └── hooks/             # Кастомные хуки
│       ├── useAuth.ts     # Хук авторизации
│       ├── useNavigation.ts # Хук навигации
│       └── index.ts
│
└── components/             # Переиспользуемые UI-компоненты
    └── ProfileMenu.tsx
```

## Принципы

### 1. Разделение ответственности
- **pages/** - только UI и композиция компонентов
- **features/** - бизнес-логика фич
- **shared/** - переиспользуемый код без бизнес-логики

### 2. Централизованный API
Все API-вызовы через `shared/api/`:
```typescript
import { authApi, gameApi } from '../shared/api'
```

### 3. Кастомные хуки
Бизнес-логика вынесена в хуки:
- `useAuth()` - управление авторизацией
- `useGame()` - игровая логика
- `useNavigation()` - навигация

### 4. Типизация
Все типы определены в соответствующих модулях:
- `shared/api/` - типы API
- `features/*/types.ts` - типы фич

## Примеры использования

### API
```typescript
import { authApi } from '../shared/api'

await authApi.login(email, password)
```

### Хуки
```typescript
import { useAuth } from '../shared/hooks'

const { user, login, logout } = useAuth()
```

### Игровая логика
```typescript
import { useGame } from '../features/game/hooks'

const game = useGame()
const { floors, submitGuess, nextLocation } = game
```

