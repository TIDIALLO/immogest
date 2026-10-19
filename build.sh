#!/usr/bin/env bash
# Build de production : dépendances Python, application React, fichiers statiques, migrations.
set -o errexit
pip install -r requirements.txt
(cd frontend && npm ci && npm run build)
python manage.py collectstatic --noinput
python manage.py migrate --noinput
