from django.shortcuts import redirect  # type: ignore

# Chemins de l'interface propriétaire accessibles à un compte locataire malgré tout
# (connexion/déconnexion, et bien sûr son propre espace).
_CHEMINS_AUTORISES_LOCATAIRE = ('/gestion/login/', '/gestion/logout/', '/gestion/mon-espace/')


class RoleRedirectMiddleware:
    """
    Empêche un compte locataire d'accéder aux pages de gestion réservées aux
    propriétaires (biens, autres locataires, paiements, etc.) : on le renvoie
    automatiquement vers son espace personnel.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if (
            user is not None
            and user.is_authenticated
            and not user.is_staff
            and hasattr(user, 'locataire_profile')
            and request.path.startswith('/gestion/')
            and not request.path.startswith(_CHEMINS_AUTORISES_LOCATAIRE)
        ):
            return redirect('espace_locataire')
        return self.get_response(request)
