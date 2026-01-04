# Kaspi Shop Panel - Backend

Backend API для системы парсинга и аналитики цен товаров Kaspi.

## Установка

```bash
# Создать виртуальное окружение
python -m venv venv
source venv/bin/activate  # Linux/Mac
# или
venv\Scripts\activate  # Windows

# Установить зависимости
pip install -r requirements.txt

# Установить Playwright браузеры
playwright install chromium
```

## Настройка

1. Скопировать `.env.example` в `.env`
2. Заполнить необходимые переменные окружения

## Запуск

```bash
# Разработка
uvicorn app.main:app --reload

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## Миграции БД

```bash
# Инициализация Alembic (если еще не сделано)
alembic init alembic

# Создание миграции
alembic revision --autogenerate -m "Initial migration"

# Применение миграций
alembic upgrade head
```

## API Endpoints

- `GET /` - Информация об API
- `GET /health` - Health check
- `POST /api/v1/products/` - Добавить товар для парсинга
- `POST /api/v1/products/bulk` - Массовое добавление товаров
- `GET /api/v1/products/` - Список товаров
- `GET /api/v1/products/{id}` - Получить товар
- `POST /api/v1/analytics/products/{id}/position` - Оценить позицию по цене
- `GET /api/v1/analytics/products/{id}/statistics` - Статистика цен
- `GET /api/v1/reports/products/{id}/excel` - Скачать Excel отчет
- `GET /api/v1/jobs/` - Список задач парсинга

## Структура проекта

```
backend/
├── app/
│   ├── api/          # API endpoints
│   ├── core/         # Конфигурация, БД, Redis, MinIO
│   ├── models/       # SQLAlchemy модели
│   ├── schemas/      # Pydantic схемы
│   └── services/     # Бизнес-логика
├── alembic/          # Миграции БД
└── requirements.txt
```

