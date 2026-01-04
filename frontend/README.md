# Kaspi Shop Panel - Frontend

Frontend приложение на React + TypeScript для системы парсинга и аналитики цен товаров Kaspi.

## Установка

```bash
npm install
```

## Запуск

```bash
# Разработка
npm run dev

# Сборка
npm run build

# Просмотр production сборки
npm run preview
```

## Технологии

- React 18
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui
- React Router
- Axios

## Структура проекта

```
frontend/
├── src/
│   ├── components/   # React компоненты
│   ├── pages/        # Страницы приложения
│   ├── lib/          # Утилиты и API клиент
│   └── App.tsx       # Главный компонент
├── public/           # Статические файлы
└── package.json
```

## Основные страницы

- `/` - Дашборд (добавление товаров)
- `/products` - Список товаров
- `/analytics` - Аналитика и оценка позиций
- `/reports` - Генерация отчетов

