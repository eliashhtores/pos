#!/bin/sh
set -e

echo "Running database migrations…"
python manage.py migrate --noinput

echo "Collecting static files…"
python manage.py collectstatic --noinput

echo "Seeding initial data…"
python manage.py seed_data

echo "Creating default admin user (if not exists)…"
python manage.py create_default_user

echo "Starting Gunicorn…"
exec gunicorn pos_backend.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers 2 \
    --timeout 60 \
    --access-logfile -
