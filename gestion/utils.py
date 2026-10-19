"""Petits utilitaires partagés par l'application."""

MOIS_FR = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]
MOIS_FR_ABREGE = [
    'jan.', 'fév.', 'mars', 'avr.', 'mai', 'juin',
    'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.',
]


def mois_annee_fr(d):
    """Formate une date en 'mois année' français (ex : 'septembre 2026'), sans
    dépendre de la locale système — souvent indisponible sur les hébergeurs,
    ce qui ferait planter tout code utilisant locale.setlocale('fr_FR.UTF-8')."""
    return f"{MOIS_FR[d.month - 1]} {d.year}"


def mois_annee_fr_abrege(d):
    """Version courte, ex : 'sept. 2026' (utile pour les libellés de graphique)."""
    return f"{MOIS_FR_ABREGE[d.month - 1]} {d.year}"
