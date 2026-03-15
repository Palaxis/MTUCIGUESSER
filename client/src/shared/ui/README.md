# UI Components

Переиспользуемые UI-компоненты проекта, построенные на принципах атомарного дизайна.

## Компоненты

### Button
Универсальная кнопка с различными вариантами и размерами.

**Варианты:**
- `primary` - основная кнопка (фиолетовый фон)
- `secondary` - вторичная кнопка (белый фон с обводкой)
- `text` - текстовая кнопка (без фона)
- `danger` - опасное действие (красный фон)

**Размеры:** `small`, `medium`, `large`

```tsx
import { Button } from '../shared/ui'

<Button variant="primary" size="medium" onClick={handleClick}>
  Нажми меня
</Button>
```

### Input
Поле ввода с поддержкой label и ошибок.

```tsx
import { Input } from '../shared/ui'

<Input
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={emailError}
/>
```

### Logo
Логотип приложения с текстом.

**Варианты:** `light` (белый), `dark` (тёмный)
**Размеры:** `small`, `medium`, `large`

```tsx
import { Logo } from '../shared/ui'

<Logo variant="dark" size="medium" onClick={handleLogoClick} />
```

### Card
Карточка для оборачивания контента.

```tsx
import { Card } from '../shared/ui'

<Card title="Заголовок">
  <p>Содержимое карточки</p>
</Card>
```

### Header
Универсальный хедер с логотипом и профилем.

**Варианты:** `light` (тёмный фон), `dark` (светлый фон)

```tsx
import { Header } from '../shared/ui'

<Header
  variant="light"
  user={user}
  onNavigateToAccount={handleAccount}
  onLogout={handleLogout}
/>
```

### ProfileMenu
Выпадающее меню профиля.

**Варианты:** `light` (для тёмного фона), `dark` (для светлого фона)

```tsx
import { ProfileMenu } from '../shared/ui'

<ProfileMenu
  variant="light"
  onNavigateToAccount={handleAccount}
  onLogout={handleLogout}
/>
```

## Принципы

1. **Переиспользуемость** - каждый компонент независим и может использоваться где угодно
2. **Типизация** - все компоненты полностью типизированы с TypeScript
3. **Адаптивность** - все компоненты адаптивны для мобильных устройств
4. **Консистентность** - единый стиль и поведение во всём приложении

## Структура

```
shared/ui/
├── Button/
│   ├── Button.tsx
│   └── Button.css
├── Input/
│   ├── Input.tsx
│   └── Input.css
...
└── index.ts  # Экспорты
```

## Использование

```tsx
// Импорт всех компонентов
import { Button, Input, Logo, Card, Header, ProfileMenu } from '../shared/ui'

// Или отдельных
import { Button } from '../shared/ui/Button/Button'
```



