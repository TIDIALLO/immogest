from django.contrib import admin # type: ignore
from .models import Bien, Locataire, Contrat, Paiement, Intervention, DemandeContact, Reservation


@admin.register(Bien)
class BienAdmin(admin.ModelAdmin):
    list_display = ['nom', 'type_bien', 'statut', 'ville', 'loyer_charges', 'proprietaire']
    list_filter = ['statut', 'type_bien', 'ville']
    search_fields = ['nom', 'adresse', 'ville']


@admin.register(Locataire)
class LocataireAdmin(admin.ModelAdmin):
    list_display = ['nom', 'prenom', 'email', 'telephone', 'proprietaire']
    search_fields = ['nom', 'prenom', 'email']


@admin.register(Contrat)
class ContratAdmin(admin.ModelAdmin):
    list_display = ['bien', 'locataire', 'type_bail', 'statut', 'date_debut', 'loyer_mensuel']
    list_filter = ['statut', 'type_bail']


@admin.register(Paiement)
class PaiementAdmin(admin.ModelAdmin):
    list_display = ['contrat', 'mois', 'montant_du', 'montant_paye', 'statut']
    list_filter = ['statut', 'mois']


@admin.register(Intervention)
class InterventionAdmin(admin.ModelAdmin):
    list_display = ['titre', 'bien', 'priorite', 'statut', 'date_signalement', 'cout']
    list_filter = ['statut', 'priorite']


@admin.register(DemandeContact)
class DemandeContactAdmin(admin.ModelAdmin):
    list_display = ['nom', 'email', 'telephone', 'bien', 'traite', 'created_at']
    list_filter = ['traite', 'created_at']
    search_fields = ['nom', 'email', 'message']


@admin.register(Reservation)
class ReservationAdmin(admin.ModelAdmin):
    list_display = ['reference', 'nom', 'telephone', 'bien', 'date_arrivee', 'mode_paiement', 'statut', 'created_at']
    list_filter = ['statut', 'mode_paiement', 'created_at']
    search_fields = ['nom', 'telephone', 'email']
