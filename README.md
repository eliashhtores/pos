# POS — Full-Stack Point of Sale

A runnable full-stack Point of Sale application built with:

| Layer | Technology |
|-------|-----------|
| Backend | Django 4 + Django REST Framework (API only) |
| Database | PostgreSQL 15 (via Docker Compose) |
| Frontend | Static HTML5 + Tailwind CSS (CDN) + Vanilla JS |
| Proxy | Nginx (serves frontend, proxies `/api/` to Django) |
| Orchestration | Docker Compose |

---

## Quick Start

```bash
# 1. Clone and enter the project
git clone <repo-url>
cd pos

# 2. Copy the example env file (defaults work for local dev)
cp .env.example .env

# 3. Start all services
docker compose up --build

# 4. Open the app
open http://localhost:3000           # Frontend (POS UI)
open http://localhost:8000/api/      # DRF browsable API
open http://localhost:8000/api/docs/ # Swagger UI
open http://localhost:8000/admin/    # Django Admin
```

The first `docker compose up` will:
1. Start PostgreSQL
2. Run `manage.py migrate`
3. Seed sample categories and products (`seed_data` management command)
4. Start the Django dev server on port 8000
5. Start Nginx on port 3000 serving the frontend

---

## Project Structure

```
pos/
├── backend/                # Django project
│   ├── api/                # DRF app (models, serializers, views, urls)
│   │   ├── models.py       # Category, Product, Order, OrderItem
│   │   ├── serializers.py
│   │   ├── views.py        # ModelViewSets
│   │   ├── urls.py         # Router-based URLs
│   │   └── management/commands/seed_data.py
│   ├── pos_backend/        # Django settings & root urls
│   ├── manage.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/               # Static SPA
│   ├── index.html
│   └── js/
│       ├── api.js          # fetch wrapper for every API endpoint
│       └── app.js          # UI logic (cashier, orders, products)
├── docker-compose.yml
├── nginx.conf
├── .env.example
└── README.md
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/categories/` | List / create categories |
| GET/PUT/PATCH/DELETE | `/api/categories/{id}/` | Retrieve / update / delete |
| GET/POST | `/api/products/` | List / create products |
| GET/PUT/PATCH/DELETE | `/api/products/{id}/` | Retrieve / update / delete |
| GET/POST | `/api/orders/` | List / create orders |
| GET/PUT/PATCH/DELETE | `/api/orders/{id}/` | Retrieve / update / delete |
| POST | `/api/orders/{id}/complete/` | Mark order as completed |
| POST | `/api/orders/{id}/cancel/` | Cancel an order |
| GET | `/api/schema/` | OpenAPI schema (YAML) |
| GET | `/api/docs/` | Swagger UI |

Product listing supports `?search=<text>` and `?category=<id>` query params.

---

## Environment Variables

See `.env.example` for all available variables.

| Variable | Default | Description |
|----------|---------|-------------|
| `SECRET_KEY` | dev key | Django secret key |
| `DEBUG` | `True` | Django debug mode |
| `POSTGRES_DB` | `posdb` | Database name |
| `POSTGRES_USER` | `posuser` | Database user |
| `POSTGRES_PASSWORD` | `pospassword` | Database password |
| `POSTGRES_HOST` | `db` | Database host |
| `POSTGRES_PORT` | `5432` | Database port |
| `CORS_ALLOW_ALL_ORIGINS` | `True` | Allow all CORS origins |

---

## Development (without Docker)

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Export env vars (or use a .env file with python-decouple)
export POSTGRES_HOST=localhost POSTGRES_USER=posuser POSTGRES_PASSWORD=pospassword

python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

Open `frontend/index.html` directly in a browser — the JS will reach the API at `http://localhost:8000/api`.
