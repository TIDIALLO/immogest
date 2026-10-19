"""Logique métier d'ImmoGest, indépendante des vues (utilisée par l'API, le site public et les commandes)."""
from datetime import date, timedelta
from decimal import Decimal

from django.conf import settings  # type: ignore
from django.contrib.auth.models import User  # type: ignore
from django.contrib.auth.tokens import default_token_generator  # type: ignore
from django.core.exceptions import ValidationError  # type: ignore
from django.core.mail import send_mail  # type: ignore
from django.db import transaction  # type: ignore
from django.utils.encoding import force_bytes  # type: ignore
from django.utils.http import urlsafe_base64_encode  # type: ignore

from .models import Bien, Contrat, Locataire, Notification, Paiement, Reservation
from .scope import proprietaires_visibles


# ── Notifications ────────────────────────────────────────────────────────────

def gestionnaires_a_notifier(bien=None):
    """Comptes de gestion à prévenir : propriétaire du bien, sinon tous les comptes de gestion."""
    if bien is not None and not getattr(settings, 'DONNEES_PARTAGEES', False):
        return User.objects.filter(pk=bien.proprietaire_id)
    return User.objects.filter(locataire_profile__isnull=True, is_active=True)


def notifier(destinataires, titre, message='', lien='', email=False):
    """Crée une notification interne pour chaque destinataire (et un email si demandé)."""
    destinataires = list(destinataires)
    Notification.objects.bulk_create([
        Notification(destinataire=u, titre=titre, message=message, lien=lien) for u in destinataires
    ])
    if email:
        adresses = [u.email for u in destinataires if u.email]
        if adresses:
            send_mail(titre, message or titre, None, adresses, fail_silently=True)


# ── Contrats ─────────────────────────────────────────────────────────────────

@transaction.atomic
def resilier_contrat(contrat, date_fin=None, statut='resilie'):
    """Termine un contrat : le bien redevient libre et les loyers futurs non payés sont supprimés."""
    if contrat.statut != 'actif':
        raise ValidationError('Ce contrat n\'est pas actif.')
    fin = date_fin or date.today()
    contrat.statut = statut
    contrat.date_fin = fin
    contrat.save()
    contrat.paiements.filter(mois__gt=fin, montant_paye=0).delete()
    return contrat


# ── Loyers ───────────────────────────────────────────────────────────────────

def premier_jour_du_mois(d):
    return d.replace(day=1)


def generer_loyers_du_mois(mois=None, proprietaires=None):
    """Crée les loyers manquants du mois pour tous les contrats actifs. Renvoie le nombre créé."""
    mois = premier_jour_du_mois(mois or date.today())
    contrats = Contrat.objects.filter(statut='actif', date_debut__lte=mois.replace(day=28))
    if proprietaires is not None:
        contrats = contrats.filter(bien__proprietaire__in=proprietaires)
    crees = 0
    for contrat in contrats:
        if contrat.date_fin and contrat.date_fin < mois:
            continue
        _, created = Paiement.objects.get_or_create(
            contrat=contrat, mois=mois, defaults={'montant_du': contrat.loyer_total})
        crees += int(created)
    return crees


def enregistrer_versement(paiement, montant, mode='', date_versement=None):
    """Ajoute un versement (total ou partiel) à un loyer ; le statut est recalculé automatiquement."""
    montant = Decimal(montant)
    if montant <= 0:
        raise ValidationError({'montant': 'Le montant doit être positif.'})
    if montant > paiement.solde:
        raise ValidationError({'montant': f'Le versement dépasse le solde restant ({paiement.solde}).'})
    paiement.montant_paye += montant
    if mode:
        paiement.mode_paiement = mode
    paiement.date_paiement = date_versement or date.today()
    paiement.save()
    return paiement


def actualiser_statuts_retard():
    """Passe en « retard » les loyers non soldés dont l'échéance est dépassée. Renvoie le nombre mis à jour."""
    nb = 0
    for p in Paiement.objects.filter(statut='en_attente').select_related('contrat'):
        if p.calculer_statut() == 'retard':
            p.save()
            nb += 1
    return nb


# ── Réservations ─────────────────────────────────────────────────────────────

def reservations_en_conflit(bien, arrivee, depart, exclure_pk=None):
    depart = depart or (arrivee + timedelta(days=1))
    qs = Reservation.objects.filter(bien=bien, statut__in=Reservation.STATUTS_BLOQUANTS)
    if exclure_pk:
        qs = qs.exclude(pk=exclure_pk)
    # Une réservation sans date de départ occupe une nuit.
    return [r for r in qs if arrivee < (r.date_depart or r.date_arrivee + timedelta(days=1))
            and depart > r.date_arrivee]


def dates_occupees(bien):
    """Périodes déjà réservées d'un bien (pour le calendrier public)."""
    return [
        {'debut': r.date_arrivee, 'fin': r.date_depart or r.date_arrivee + timedelta(days=1)}
        for r in Reservation.objects.filter(bien=bien, statut__in=Reservation.STATUTS_BLOQUANTS,
                                            date_arrivee__gte=date.today() - timedelta(days=1))
    ]


def calculer_montant_reservation(bien, arrivee, depart):
    nuits = max(((depart - arrivee).days if depart else 1), 1)
    tarif = bien.prix_nuit if bien.prix_nuit else (bien.loyer_charges / 30)
    return (Decimal(tarif) * nuits).quantize(Decimal('1'))


@transaction.atomic
def creer_reservation(bien, **donnees):
    """Crée une réservation après contrôle de disponibilité (verrou sur le bien contre le double-booking)."""
    bien = Bien.objects.select_for_update().get(pk=bien.pk)
    if bien.statut != 'libre':
        raise ValidationError("Ce bien n'est plus disponible.")
    arrivee, depart = donnees['date_arrivee'], donnees.get('date_depart')
    if reservations_en_conflit(bien, arrivee, depart):
        raise ValidationError({'date_arrivee': 'Ces dates sont déjà réservées pour ce bien.'})
    reservation = Reservation(bien=bien, **donnees)
    reservation.montant_total = calculer_montant_reservation(bien, arrivee, depart)
    reservation.full_clean(exclude=['bien'])
    reservation.save()
    notifier(
        gestionnaires_a_notifier(bien),
        f'Nouvelle réservation {reservation.reference}',
        f'{reservation.nom} — {bien.nom} du {arrivee:%d/%m/%Y}'
        f'{f" au {depart:%d/%m/%Y}" if depart else ""} ({reservation.montant_total:.0f} FCFA).',
        lien='/app/reservations', email=True)
    return reservation


def expirer_reservations_impayees(heures=48):
    """Annule les réservations en attente de paiement depuis plus de `heures` heures."""
    from django.utils import timezone  # type: ignore
    limite = timezone.now() - timedelta(hours=heures)
    return Reservation.objects.filter(statut='en_attente', created_at__lt=limite).update(statut='annulee')


@transaction.atomic
def convertir_reservation_en_contrat(reservation, proprietaire):
    """Crée le locataire et un contrat saisonnier à partir d'une réservation confirmée."""
    parties = reservation.nom.strip().split(' ', 1)
    locataire = Locataire.objects.create(
        proprietaire=proprietaire, prenom=parties[0], nom=parties[1] if len(parties) > 1 else parties[0],
        email=reservation.email, telephone=reservation.telephone)
    contrat = Contrat(
        bien=reservation.bien, locataire=locataire, type_bail='saisonnier',
        date_debut=reservation.date_arrivee, date_fin=reservation.date_depart,
        loyer_mensuel=reservation.montant_total or reservation.bien.loyer_charges, charges_mensuelles=0)
    contrat.full_clean()
    contrat.save()
    reservation.statut = 'confirmee'
    reservation.save(update_fields=['statut'])
    return contrat


# ── Accès locataire ──────────────────────────────────────────────────────────

def lien_activation(user, base_url):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    return f'{base_url}/app/activer/{uid}/{default_token_generator.make_token(user)}'


@transaction.atomic
def inviter_locataire(locataire, base_url):
    """Crée (ou réactive) le compte du locataire et renvoie un lien d'activation à usage unique."""
    user = locataire.compte
    if user is None:
        base = f'{locataire.prenom}.{locataire.nom}'.lower().replace(' ', '')
        username, i = base, 1
        while User.objects.filter(username=username).exists():
            i += 1
            username = f'{base}{i}'
        user = User(username=username, email=locataire.email, first_name=locataire.prenom,
                    last_name=locataire.nom)
        user.set_unusable_password()
        user.save()
        locataire.compte = user
        locataire.save(update_fields=['compte'])
    else:
        user.is_active = True
        user.set_unusable_password()
        user.save()
    lien = lien_activation(user, base_url)
    if locataire.email:
        send_mail(
            "Activez votre espace locataire ImmoGest",
            f"Bonjour {locataire.prenom},\n\nVotre espace locataire est prêt (identifiant : {user.username}).\n"
            f"Choisissez votre mot de passe via ce lien personnel :\n{lien}\n",
            None, [locataire.email], fail_silently=True)
    return user, lien


def perimetre(user):
    return proprietaires_visibles(user)


def interventions_du_locataire(locataire):
    """Interventions visibles par un locataire : celles qu'il a signalées et celles du bien pendant ses contrats
    (un locataire ne voit jamais l'historique des précédents occupants)."""
    from django.db.models import Q  # type: ignore
    from .models import Intervention
    filtre = Q(pk__in=[])
    if locataire.compte_id:
        filtre |= Q(signale_par_id=locataire.compte_id)
    for contrat in locataire.contrats.all():
        fin = contrat.date_fin or date.today()
        filtre |= Q(bien_id=contrat.bien_id, date_signalement__gte=contrat.date_debut,
                    date_signalement__lte=fin)
    return Intervention.objects.filter(filtre).distinct().order_by('-date_signalement')
