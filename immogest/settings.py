import os
from pathlib import Path
from dotenv import load_dotenv
import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')


def env_bool(name, default=False):
    val = os.environ.get(name)
    if val is None:
        return default
    return val.strip().lower() in ('1', 'true', 'yes', 'on')


SECRET_KEY = os.environ.get('SECRET_KEY', 'django-immogest-secret-key-changez-en-production')
DEBUG = env_bool('DEBUG', True)

# Sécurité : on refuse de démarrer en production avec la clé par défaut.
# Générez une vraie clé avec :
#   python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
if not DEBUG and SECRET_KEY == 'django-immogest-secret-key-changez-en-production':
    raise RuntimeError(
        "SECURITE : définissez une vraie variable d'environnement SECRET_KEY avant de "
        "lancer le site en production (DEBUG=False)."
    )

ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', '*').split(',') if h.strip()]

# Données partagées entre tous les comptes de gestion (voir gestion/scope.py).
# True  : tous les comptes voient les mêmes biens, locataires, réservations...
# False : chaque compte ne voit que ses propres biens (isolation par propriétaire).
DONNEES_PARTAGEES = env_bool('DONNEES_PARTAGEES', True)

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'gestion',
    'site_public',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'gestion.middleware.RoleRedirectMiddleware',
]

ROOT_URLCONF = 'immogest.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
                'gestion.context_processors.badges_menu',
            ],
        },
    },
]

WSGI_APPLICATION = 'immogest.wsgi.application'

# ── Base de données ───────────────────────────────────────────────────────
# En local (par défaut) : SQLite, aucune config nécessaire.
# En production : définissez DATABASE_URL dans .env, ex :
#   postgres://utilisateur:motdepasse@hote:5432/nom_de_la_base
# La plupart des hébergeurs (Render, Railway...) fournissent cette variable
# automatiquement quand vous créez une base PostgreSQL.
DATABASES = {
    'default': dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'fr-fr'
TIME_ZONE = 'Europe/Paris'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'   # requis par `collectstatic` en production
STATICFILES_DIRS = [BASE_DIR / 'static'] if (BASE_DIR / 'static').exists() else []

# whitenoise : sert les fichiers statiques directement depuis Django, avec compression
# et cache-busting, sans avoir besoin d'un serveur web séparé (nginx, etc.)
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

# ── Stockage des médias en production (photos de biens/locataires) ────────
# Sur la plupart des hébergeurs, le disque n'est PAS persistant : les photos
# uploadées seraient perdues à chaque redéploiement. Solution : un stockage
# externe (S3, Cloudinary, Backblaze...). Pour l'activer plus tard :
#   1. pip install django-storages boto3
#   2. Ajoutez 'storages' à INSTALLED_APPS
#   3. Définissez USE_S3=true et les variables AWS_* ci-dessous dans .env
if env_bool('USE_S3', False):
    STORAGES['default'] = {'BACKEND': 'storages.backends.s3.S3Storage'}
    AWS_ACCESS_KEY_ID = os.environ.get('AWS_ACCESS_KEY_ID')
    AWS_SECRET_ACCESS_KEY = os.environ.get('AWS_SECRET_ACCESS_KEY')
    AWS_STORAGE_BUCKET_NAME = os.environ.get('AWS_STORAGE_BUCKET_NAME')
    AWS_S3_REGION_NAME = os.environ.get('AWS_S3_REGION_NAME', 'eu-west-3')
    AWS_S3_CUSTOM_DOMAIN = os.environ.get('AWS_S3_CUSTOM_DOMAIN', '')
    AWS_DEFAULT_ACL = None
    AWS_S3_FILE_OVERWRITE = False

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LOGIN_URL = '/gestion/login/'
LOGIN_REDIRECT_URL = '/gestion/'
LOGOUT_REDIRECT_URL = '/gestion/login/'

# ── Sécurité HTTPS (activer une fois le HTTPS en place en production) ─────
if not DEBUG:
    SECURE_SSL_REDIRECT = env_bool('SECURE_SSL_REDIRECT', False)
    SESSION_COOKIE_SECURE = env_bool('SESSION_COOKIE_SECURE', False)
    CSRF_COOKIE_SECURE = env_bool('CSRF_COOKIE_SECURE', False)

# ── Emails (notifications : nouvelle demande, réservation, accès locataire) ─
# En local : les emails s'affichent dans la console au lieu d'être envoyés.
# En production : renseignez EMAIL_HOST / EMAIL_HOST_USER / EMAIL_HOST_PASSWORD
# dans .env (ex : SMTP de Gmail, Mailgun, Brevo/Sendinblue...).
if env_bool('EMAIL_USE_SMTP', False):
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
    EMAIL_USE_TLS = env_bool('EMAIL_USE_TLS', True)
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
    DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', EMAIL_HOST_USER)
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    DEFAULT_FROM_EMAIL = 'noreply@immogest.local'
