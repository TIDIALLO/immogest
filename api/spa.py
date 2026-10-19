"""Sert l'application React compilée (frontend/dist) sous /app/ et expose le healthcheck."""
from django.conf import settings  # type: ignore
from django.db import connection  # type: ignore
from django.http import FileResponse, Http404, HttpResponse, JsonResponse  # type: ignore
from django.views.decorators.cache import never_cache  # type: ignore
from django.views.static import serve  # type: ignore


@never_cache
def index(request, path=''):
    fichier = settings.FRONTEND_DIST / 'index.html'
    if not fichier.exists():
        return HttpResponse(
            "<h1>Application non compilée</h1><p>Exécutez <code>cd frontend &amp;&amp; npm install &amp;&amp; "
            "npm run build</code> (ou <code>npm run dev</code> pour le mode développement).</p>",
            status=503)
    return FileResponse(open(fichier, 'rb'), content_type='text/html; charset=utf-8')


def assets(request, path):
    racine = settings.FRONTEND_DIST / 'assets'
    if not racine.exists():
        raise Http404
    reponse = serve(request, path, document_root=racine)
    reponse['Cache-Control'] = 'public, max-age=31536000, immutable'  # noms de fichiers hachés par Vite
    return reponse


def health(request):
    try:
        with connection.cursor() as cur:
            cur.execute('SELECT 1')
        base = 'ok'
    except Exception:  # noqa: BLE001
        base = 'erreur'
    return JsonResponse({'status': 'ok' if base == 'ok' else 'degraded', 'database': base},
                        status=200 if base == 'ok' else 503)
