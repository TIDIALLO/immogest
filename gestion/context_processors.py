from django.db.models import Q


def badges_menu(request):
    """
    Fournit à TOUTES les pages les compteurs affichés dans le menu latéral
    (demandes clients non traitées, réservations à traiter).

    Avant, ces compteurs n'étaient calculés que par la vue du tableau de bord :
    sur n'importe quelle autre page, une nouvelle réservation n'apparaissait
    donc pas dans le menu.
    """
    user = getattr(request, 'user', None)
    if user is None or not user.is_authenticated or hasattr(user, 'locataire_profile'):
        return {}

    # Import tardif pour éviter tout import circulaire au chargement des réglages
    from .models import DemandeContact, Reservation
    from .scope import proprietaires_visibles

    return {
        'nb_demandes_non_traitees': DemandeContact.objects.filter(
            Q(bien__proprietaire__in=proprietaires_visibles(user)) | Q(bien__isnull=True), traite=False
        ).count(),
        'nb_reservations_en_attente': Reservation.objects.filter(
            bien__proprietaire__in=proprietaires_visibles(user), statut__in=['en_attente', 'payee']
        ).count(),
    }
