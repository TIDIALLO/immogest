"""
Périmètre de données visible par un utilisateur de l'interface de gestion.

Deux modes, pilotés par le réglage DONNEES_PARTAGEES (fichier .env) :

- DONNEES_PARTAGEES=True  (défaut) : tous les comptes de gestion partagent les
  mêmes données (biens, locataires, contrats, paiements, réservations, demandes).
  Les comptes locataires n'en font jamais partie : ils ne voient que leur espace.

- DONNEES_PARTAGEES=False : chaque compte ne voit que ses propres biens et
  locataires (isolation par propriétaire, comportement d'origine).
"""
from django.conf import settings
from django.contrib.auth.models import User


def proprietaires_visibles(user):
    """Renvoie un queryset d'utilisateurs dont les données sont visibles par `user`.
    S'utilise ainsi : Bien.objects.filter(proprietaire__in=proprietaires_visibles(user))"""
    if getattr(settings, 'DONNEES_PARTAGEES', False):
        return User.objects.filter(locataire_profile__isnull=True)
    return User.objects.filter(pk=user.pk)
