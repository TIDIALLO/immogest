"""
Rattache tous les biens et locataires de l'application à UN SEUL compte propriétaire.

Pourquoi : chaque bien appartient à un compte (champ « proprietaire »). Les
réservations et demandes reçues via le site public ne s'affichent que chez le
propriétaire du bien concerné. Si vos biens sont répartis sur plusieurs comptes
(ex : « Baron », « Isepat », « ISEPAT »), chaque compte ne voit qu'une partie
des réservations.

Usage (toujours commencer par --dry-run, qui ne modifie rien) :
    python manage.py regrouper_biens --vers ISEPAT --dry-run
    python manage.py regrouper_biens --vers ISEPAT

Pensez à sauvegarder db.sqlite3 avant de lancer la commande sans --dry-run.
"""
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from gestion.models import Bien, Locataire


class Command(BaseCommand):
    help = "Rattache tous les biens et locataires à un seul compte propriétaire."

    def add_arguments(self, parser):
        parser.add_argument('--vers', required=True,
                            help="Nom d'utilisateur du compte qui doit devenir propriétaire de tout.")
        parser.add_argument('--dry-run', action='store_true',
                            help="Affiche ce qui changerait, sans rien modifier.")

    def handle(self, *args, **options):
        try:
            cible = User.objects.get(username=options['vers'])
        except User.DoesNotExist:
            comptes = ', '.join(User.objects.values_list('username', flat=True))
            raise CommandError(
                f"Aucun compte « {options['vers']} ». Comptes existants : {comptes}"
            )

        biens = Bien.objects.exclude(proprietaire=cible).select_related('proprietaire')
        locataires = Locataire.objects.exclude(proprietaire=cible).select_related('proprietaire')

        self.stdout.write(f"Compte cible : {cible.username}")
        self.stdout.write(f"Biens à rattacher : {biens.count()}")
        for b in biens:
            self.stdout.write(f"   - {b.nom} (actuellement : {b.proprietaire.username})")
        self.stdout.write(f"Locataires à rattacher : {locataires.count()}")
        for loc in locataires:
            self.stdout.write(f"   - {loc} (actuellement : {loc.proprietaire.username})")

        if options['dry_run']:
            self.stdout.write(self.style.WARNING("Dry-run : rien n'a été modifié."))
            return

        with transaction.atomic():
            nb_biens = biens.update(proprietaire=cible)
            nb_loc = locataires.update(proprietaire=cible)

        self.stdout.write(self.style.SUCCESS(
            f"Terminé : {nb_biens} bien(s) et {nb_loc} locataire(s) rattachés à « {cible.username} »."
        ))
