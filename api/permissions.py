from rest_framework.permissions import BasePermission  # type: ignore


class IsGestionnaire(BasePermission):
    """Compte de gestion (tout compte connecté qui n'est pas un locataire)."""
    message = "Réservé aux comptes de gestion."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and not hasattr(u, 'locataire_profile'))


class IsLocataire(BasePermission):
    message = "Réservé aux locataires."

    def has_permission(self, request, view):
        u = request.user
        return bool(u and u.is_authenticated and hasattr(u, 'locataire_profile'))
