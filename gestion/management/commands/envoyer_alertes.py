"""
Commande d'envoi des alertes et relances automatiques.

Usage manuel :
    python manage.py envoyer_alertes

En production, à planifier régulièrement (une fois par jour par exemple) via
une tâche cron du système ou le planificateur de tâches de l'hébergeur :
    0 8 * * *  cd /chemin/vers/le/projet && /chemin/vers/venv/bin/python manage.py envoyer_alertes

Envoie deux types d'alertes :
1. Aux propriétaires : un récapitulatif des loyers en retard et des contrats
   arrivant à échéance dans les 30 prochains jours.
2. Aux locataires ayant un accès en ligne (compte lié) : une relance
   individuelle s'ils ont un loyer en retard.
"""
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.core.management.base import BaseCommand
from django.db.models import Sum

from gestion.models import Paiement, Contrat


class Command(BaseCommand):
    help = "Envoie les alertes email : loyers en retard et contrats arrivant à échéance."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run', action='store_true',
            help="Affiche ce qui serait envoyé sans envoyer réellement les emails.",
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        aujourd_hui = date.today()
        dans_30j = aujourd_hui + timedelta(days=30)
        debut_mois = aujourd_hui.replace(day=1)

        nb_emails_proprietaires = 0
        nb_emails_locataires = 0

        for proprietaire in User.objects.filter(biens__isnull=False).distinct():
            paiements_retard = Paiement.objects.filter(
                contrat__bien__proprietaire=proprietaire,
                statut__in=['retard', 'en_attente'],
                mois__lt=debut_mois,
            ).select_related('contrat__bien', 'contrat__locataire')

            contrats_echeance = Contrat.objects.filter(
                bien__proprietaire=proprietaire,
                statut='actif',
                date_fin__gte=aujourd_hui,
                date_fin__lte=dans_30j,
            ).select_related('bien', 'locataire')

            if not paiements_retard.exists() and not contrats_echeance.exists():
                continue

            lignes = ["Bonjour,", "", "Voici votre récapitulatif ImmoGest du jour :", ""]

            if paiements_retard.exists():
                total_retard = paiements_retard.aggregate(t=Sum('montant_du'))['t'] or 0
                lignes.append(f"⚠ {paiements_retard.count()} loyer(s) en retard, pour un total de {total_retard:.0f} F CFA :")
                for p in paiements_retard:
                    lignes.append(
                        f"   - {p.contrat.locataire.prenom} {p.contrat.locataire.nom} "
                        f"({p.contrat.bien.nom}) — {p.mois:%m/%Y} — {p.montant_du:.0f} F CFA"
                    )
                lignes.append("")

            if contrats_echeance.exists():
                lignes.append(f"📅 {contrats_echeance.count()} contrat(s) arrivant à échéance sous 30 jours :")
                for c in contrats_echeance:
                    lignes.append(
                        f"   - {c.locataire.prenom} {c.locataire.nom} ({c.bien.nom}) "
                        f"— fin le {c.date_fin:%d/%m/%Y}"
                    )
                lignes.append("")

            lignes.append("Connectez-vous à ImmoGest pour plus de détails.")
            message = "\n".join(lignes)

            if proprietaire.email:
                nb_emails_proprietaires += 1
                if dry_run:
                    self.stdout.write(f"[dry-run] Email à {proprietaire.email} :\n{message}\n")
                else:
                    send_mail(
                        subject="ImmoGest — Récapitulatif : retards et échéances",
                        message=message,
                        from_email=None,
                        recipient_list=[proprietaire.email],
                        fail_silently=True,
                    )

        # Relances individuelles aux locataires en retard ayant un compte
        # .distinct('champ') (DISTINCT ON) n'est supporté que par PostgreSQL : on
        # récupère donc d'abord les identifiants uniques de locataires concernés,
        # une approche compatible avec toutes les bases (SQLite comme PostgreSQL).
        locataire_ids_en_retard = Paiement.objects.filter(
            statut__in=['retard', 'en_attente'],
            mois__lt=debut_mois,
            contrat__locataire__compte__isnull=False,
        ).values_list('contrat__locataire', flat=True).distinct()

        for locataire_id in locataire_ids_en_retard:
            paiement_retard = Paiement.objects.filter(
                statut__in=['retard', 'en_attente'],
                mois__lt=debut_mois,
                contrat__locataire_id=locataire_id,
            ).select_related('contrat__locataire', 'contrat__bien').first()
            if not paiement_retard:
                continue
            locataire = paiement_retard.contrat.locataire
            if not locataire.email:
                continue
            message = (
                f"Bonjour {locataire.prenom},\n\n"
                f"Nous vous informons qu'un ou plusieurs loyers concernant le bien "
                f"« {paiement_retard.contrat.bien.nom} » sont en retard de paiement.\n"
                f"Merci de régulariser votre situation ou de contacter votre bailleur "
                f"si vous rencontrez une difficulté.\n\n"
                f"Vous pouvez consulter le détail depuis votre espace locataire ImmoGest."
            )
            nb_emails_locataires += 1
            if dry_run:
                self.stdout.write(f"[dry-run] Relance à {locataire.email} :\n{message}\n")
            else:
                send_mail(
                    subject="ImmoGest — Rappel : loyer en retard",
                    message=message,
                    from_email=None,
                    recipient_list=[locataire.email],
                    fail_silently=True,
                )

        self.stdout.write(self.style.SUCCESS(
            f"Terminé. {nb_emails_proprietaires} email(s) propriétaire(s), "
            f"{nb_emails_locataires} relance(s) locataire(s)"
            f"{' (dry-run, rien envoyé)' if dry_run else ''}."
        ))
