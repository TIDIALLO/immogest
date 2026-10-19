from django.db import models # type: ignore
from django.contrib.auth.models import User # type: ignore
from django.utils import timezone # type: ignore
from datetime import date
from .utils import mois_annee_fr


class Bien(models.Model):
    TYPE_CHOICES = [
        ('appartement', 'Appartement'),
        ('maison', 'Maison'),
        ('studio', 'Studio'),
        ('commerce', 'Local commercial'),
        ('garage', 'Garage'),
    ]
    STATUT_CHOICES = [
        ('libre', 'Libre'),
        ('loue', 'Loué'),
        ('travaux', 'En travaux'),
        ('vente', 'En vente'),
    ]

    proprietaire = models.ForeignKey(User, on_delete=models.CASCADE, related_name='biens')
    nom = models.CharField(max_length=100)
    type_bien = models.CharField(max_length=20, choices=TYPE_CHOICES, default='appartement')
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='libre')
    adresse = models.CharField(max_length=200)
    ville = models.CharField(max_length=100)
    code_postal = models.CharField(max_length=10)
    surface = models.DecimalField(max_digits=7, decimal_places=2, help_text='Surface en m²')
    nb_pieces = models.PositiveIntegerField(default=1)
    etage = models.IntegerField(null=True, blank=True)
    loyer_charges = models.DecimalField(max_digits=10, decimal_places=2, help_text='Loyer charges comprises')
    depot_garantie = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    description = models.TextField(blank=True)
    date_acquisition = models.DateField(null=True, blank=True)
    prix_acquisition = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    photo = models.ImageField(upload_to='biens/', null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Bien immobilier'
        verbose_name_plural = 'Biens immobiliers'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.nom} — {self.ville}'

    @property
    def locataire_actuel(self):
        contrat = self.contrats.filter(statut='actif').first()
        return contrat.locataire if contrat else None

    @property
    def contrat_actif(self):
        return self.contrats.filter(statut='actif').first()


class Locataire(models.Model):
    proprietaire = models.ForeignKey(User, on_delete=models.CASCADE, related_name='locataires')
    compte = models.OneToOneField(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='locataire_profile',
        help_text="Compte de connexion donnant accès à l'espace locataire (optionnel)."
    )
    prenom = models.CharField(max_length=100)
    nom = models.CharField(max_length=100)
    email = models.EmailField()
    telephone = models.CharField(max_length=20)
    date_naissance = models.DateField(null=True, blank=True)
    profession = models.CharField(max_length=100, blank=True)
    revenu_mensuel = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    adresse_precedente = models.CharField(max_length=200, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Locataire'
        ordering = ['nom', 'prenom']

    def __str__(self):
        return f'{self.prenom} {self.nom}'

    @property
    def initiales(self):
        return f'{self.prenom[0]}{self.nom[0]}'.upper()

    @property
    def contrat_actif(self):
        return self.contrats.filter(statut='actif').first()


class Contrat(models.Model):
    STATUT_CHOICES = [
        ('actif', 'Actif'),
        ('termine', 'Terminé'),
        ('resilie', 'Résilié'),
    ]
    TYPE_CHOICES = [
        ('vide', 'Location vide'),
        ('meuble', 'Location meublée'),
        ('commercial', 'Bail commercial'),
        ('saisonnier', 'Saisonnier'),
    ]

    bien = models.ForeignKey(Bien, on_delete=models.CASCADE, related_name='contrats')
    locataire = models.ForeignKey(Locataire, on_delete=models.CASCADE, related_name='contrats')
    type_bail = models.CharField(max_length=20, choices=TYPE_CHOICES, default='vide')
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='actif')
    date_debut = models.DateField()
    date_fin = models.DateField(null=True, blank=True)
    loyer_mensuel = models.DecimalField(max_digits=10, decimal_places=2)
    charges_mensuelles = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    depot_garantie = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    jour_paiement = models.PositiveIntegerField(default=1, help_text='Jour du mois')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Contrat de location'
        ordering = ['-date_debut']

    def __str__(self):
        return f'{self.bien} → {self.locataire}'

    @property
    def loyer_total(self):
        return self.loyer_mensuel + self.charges_mensuelles

    @property
    def duree_mois(self):
        fin = self.date_fin or date.today()
        delta = (fin.year - self.date_debut.year) * 12 + (fin.month - self.date_debut.month)
        return max(delta, 0)


class Paiement(models.Model):
    STATUT_CHOICES = [
        ('paye', 'Payé'),
        ('en_attente', 'En attente'),
        ('retard', 'En retard'),
        ('partiel', 'Partiel'),
    ]
    MODE_CHOICES = [
        ('virement', 'Virement'),
        ('cheque', 'Chèque'),
        ('especes', 'Espèces'),
        ('prelevement', 'Prélèvement'),
    ]

    contrat = models.ForeignKey(Contrat, on_delete=models.CASCADE, related_name='paiements')
    mois = models.DateField(help_text='Premier jour du mois concerné')
    montant_du = models.DecimalField(max_digits=10, decimal_places=2)
    montant_paye = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    mode_paiement = models.CharField(max_length=20, choices=MODE_CHOICES, blank=True)
    date_paiement = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Paiement'
        ordering = ['-mois']
        unique_together = ['contrat', 'mois']

    def __str__(self):
        return f'{self.contrat.locataire} — {mois_annee_fr(self.mois)}'

    @property
    def solde(self):
        return self.montant_du - self.montant_paye


class Intervention(models.Model):
    PRIORITE_CHOICES = [
        ('basse', 'Basse'),
        ('normale', 'Normale'),
        ('haute', 'Haute'),
        ('urgente', 'Urgente'),
    ]
    STATUT_CHOICES = [
        ('ouverte', 'Ouverte'),
        ('en_cours', 'En cours'),
        ('terminee', 'Terminée'),
        ('annulee', 'Annulée'),
    ]

    bien = models.ForeignKey(Bien, on_delete=models.CASCADE, related_name='interventions')
    titre = models.CharField(max_length=200)
    description = models.TextField()
    priorite = models.CharField(max_length=10, choices=PRIORITE_CHOICES, default='normale')
    statut = models.CharField(max_length=10, choices=STATUT_CHOICES, default='ouverte')
    date_signalement = models.DateField(default=date.today)
    date_intervention = models.DateField(null=True, blank=True)
    date_resolution = models.DateField(null=True, blank=True)
    prestataire = models.CharField(max_length=100, blank=True)
    cout = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Intervention'
        ordering = ['-date_signalement']

    def __str__(self):
        return f'{self.titre} — {self.bien}'


class DemandeContact(models.Model):
    """Demande envoyée par un visiteur du site public (formulaire de contact)."""
    bien = models.ForeignKey(Bien, on_delete=models.SET_NULL, null=True, blank=True, related_name='demandes')
    nom = models.CharField(max_length=150)
    email = models.EmailField()
    telephone = models.CharField(max_length=20, blank=True)
    message = models.TextField()
    traite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Demande de contact'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.nom} — {self.bien if self.bien else "Contact général"}'


class Reservation(models.Model):
    """Commande / réservation d'une chambre par un client, payée via Wave, Orange Money ou Free Money."""
    MODE_PAIEMENT_CHOICES = [
        ('wave', 'Wave'),
        ('orange_money', 'Orange Money'),
        ('free_money', 'Free Money'),
    ]
    STATUT_CHOICES = [
        ('en_attente', 'En attente de paiement'),
        ('payee', 'Payée'),
        ('confirmee', 'Confirmée'),
        ('annulee', 'Annulée'),
    ]

    bien = models.ForeignKey(Bien, on_delete=models.CASCADE, related_name='reservations')
    nom = models.CharField(max_length=150)
    telephone = models.CharField(max_length=20)
    email = models.EmailField(blank=True)
    date_arrivee = models.DateField()
    date_depart = models.DateField(null=True, blank=True)
    nb_personnes = models.PositiveIntegerField(default=1)
    mode_paiement = models.CharField(max_length=20, choices=MODE_PAIEMENT_CHOICES)
    statut = models.CharField(max_length=20, choices=STATUT_CHOICES, default='en_attente')
    message = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Réservation'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.nom} — {self.bien} ({self.get_statut_display()})'

    @property
    def reference(self):
        return f'RES-{self.pk:05d}'
