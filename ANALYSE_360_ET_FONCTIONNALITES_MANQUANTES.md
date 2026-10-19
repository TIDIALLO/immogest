# ImmoGest — Analyse 360° et feuille de route des fonctionnalités manquantes

> Audit réalisé sur le code du dépôt (Django, apps `gestion` et `site_public`, ~8 300 lignes).
> Objectif : transformer un CRUD correct en une plateforme de gestion immobilière **moderne, automatisée et productive**.

---

## 1. Synthèse

| Axe | Note | Commentaire |
|---|---|---|
| Périmètre fonctionnel | 5/10 | Les 5 entités de base sont là + site public + espace locataire. Rien qui automatise le métier. |
| Logique métier | 3/10 | Aucune règle : statuts saisis à la main, pas de génération de loyers, pas de contrôle de cohérence. |
| Qualité du code | 5/10 | Lisible, bien commenté, `scope.py`/middleware sont de bonnes idées. Mais `views.py` monolithique, logique dans les vues, zéro test. |
| Sécurité | 4/10 | Plusieurs failles concrètes (voir §3). |
| UX / UI | 4/10 | CSS inline dans `base.html`, aucune interactivité (pas de pagination, tri, recherche live, mobile/PWA, mode sombre). |
| Paiements / contexte local | 3/10 | Wave / Orange Money sont *annoncés* mais le paiement est 100 % manuel (numéro en dur + preuve par WhatsApp). |
| DevOps / qualité | 3/10 | Pas de tests, pas de CI, pas de Docker, pas de logs, pas de sauvegardes. |

**Verdict :** bon travail de « premier jet » (le déploiement, les PDF, les alertes email et l'espace locataire montrent de l'initiative), mais l'application reste un **carnet d'adresses amélioré** : elle enregistre ce que l'utilisateur saisit, elle ne *gère* rien toute seule. Les bugs de logique ci-dessous montrent aussi un manque de tests et de vérification.

---

## 2. Bugs de logique confirmés dans le code actuel

À corriger avant d'ajouter quoi que ce soit.

| # | Fichier | Problème |
|---|---|---|
| B1 | `views.py` `dashboard` | `Intervention...order_by('-priorite')` trie **alphabétiquement** (urgente > normale > haute > basse) : « haute » apparaît après « normale ». Il faut un tri par poids (`Case/When`) ou un champ entier. |
| B2 | `views.py` `contrat_create` | Aucune vérification qu'un contrat **actif existe déjà** sur le bien, ni de chevauchement de dates. Deux locataires actifs sur le même bien sont possibles. |
| B3 | `views.py` `contrat_edit` | Passer un contrat à « terminé/résilié » **ne remet pas le bien en « libre »**. Le bien reste « loué » à vie → taux d'occupation et site public faux. |
| B4 | `views.py` `contrat_create` | `c.bien.save()` hors transaction ; un contrat de type *saisonnier* ou une date de début future passe quand même le bien en « loué ». |
| B5 | `models.py` `Paiement` | `statut` et `montant_paye` sont indépendants : on peut enregistrer « payé » avec 0 FCFA, ou 50 000 payés en « en attente ». Aucun calcul automatique de `partiel`/`retard`. |
| B6 | `views.py` `dashboard` | « Revenus du mois » ne compte que `statut='paye'` et ignore les paiements **partiels**. Le retard ne compte que `mois < mois courant` : un loyer impayé après le jour d'échéance (`jour_paiement`) n'est jamais détecté en cours de mois. `jour_paiement` n'est utilisé nulle part. |
| B7 | `models.py` `Contrat` | Aucune validation `date_fin >= date_debut`, `jour_paiement` entre 1 et 28, loyers ≥ 0. Idem `Reservation.date_depart > date_arrivee`, et date d'arrivée dans le passé acceptée. |
| B8 | `site_public/views.py` | Une réservation **ne bloque pas le bien** (il reste « libre ») : deux clients peuvent réserver la même chambre aux mêmes dates. Aucun contrôle de disponibilité, aucun calendrier. |
| B9 | `models.py` `Reservation` | Aucun **montant** (prix/nuit, acompte, total) → impossible de savoir combien le client doit payer ni de rapprocher un paiement. |
| B10 | `views.py` `espace_locataire_*` | `Intervention.objects.filter(bien__contrats__locataire=locataire)` montre au locataire **toutes les interventions du bien**, y compris celles de précédents occupants (fuite d'informations). L'intervention n'a pas de champ « signalé par ». |
| B11 | `views.py` `reservation_create_manual` | `request.POST.get('statut')` pris sans validation (seule `reservation_update_statut` valide). |
| B12 | `views.py` `logout_view` | Déconnexion possible en **GET** (CSRF logout via une simple image). |
| B13 | `gestion/models.py` | `Locataire.email` obligatoire alors qu'au Sénégal beaucoup de locataires n'ont pas d'email ; `telephone` sans validation de format (+221). |
| B14 | `settings.py` | `TIME_ZONE='Europe/Paris'` alors que l'application est pour le Sénégal (`Africa/Dakar`), et les montants sont affichés en « F CFA » avec des `DecimalField(decimal_places=2)` (le FCFA n'a pas de centimes). |
| B15 | `settings.py` | Le commentaire annonce des « notifications : nouvelle demande, réservation » mais **aucun `send_mail` n'existe** dans `site_public/views.py` : le propriétaire n'est jamais prévenu hors du tableau de bord. |

---

## 3. Sécurité

| Priorité | Problème | Correctif |
|---|---|---|
| 🔴 Critique | `reservation_confirmation/<pk>` : identifiant **séquentiel**, sans aucun contrôle → n'importe qui énumère `1,2,3…` et lit nom, téléphone, dates de tous les clients. | Jeton aléatoire (UUID / `signing`) dans l'URL, ou stockage de la référence en session. |
| 🔴 Critique | `.env.example` contient la vraie `SECRET_KEY` par défaut, et `settings.py` l'utilise en repli. `ALLOWED_HOSTS` vaut `*` par défaut. | Pas de valeur par défaut en prod, `ALLOWED_HOSTS` explicite, `SECURE_*` / HSTS activés par défaut quand `DEBUG=False`. |
| 🟠 Haute | Mot de passe temporaire du locataire **affiché en clair** dans un message flash puis envoyé **en clair par email**. | Lien d'invitation à usage unique (`PasswordResetTokenGenerator`) pour définir son mot de passe ; forcer le changement à la première connexion. |
| 🟠 Haute | Aucun anti-brute-force sur `/gestion/login/`. | `django-axes` ou `django-ratelimit`. |
| 🟠 Haute | Formulaires publics (contact, réservation) sans captcha, honeypot ni limitation de débit → spam et pollution de la base. | `django-ratelimit` + honeypot / Cloudflare Turnstile. |
| 🟠 Haute | Pas de **rôles/permissions** : tout compte non-locataire voit et modifie tout (`DONNEES_PARTAGEES=True`). Pas de distinction admin / gestionnaire / comptable / lecture seule. | Groupes + permissions Django, ou modèle `Agence` + `Membre(role)`. |
| 🟡 Moyenne | Pas de journal d'audit : qui a modifié/supprimé quel paiement ? | `django-simple-history` ou `django-auditlog`. |
| 🟡 Moyenne | Uploads : `ImageField` sans limite de taille ni de type. | Validateurs de taille/extension, redimensionnement. |
| 🟡 Moyenne | `data.json` / `data_fixed.json` (dumps de base : utilisateur, session, locataire, paiement) versionnés dans Git. | Les retirer du dépôt (`git rm`), les ajouter à `.gitignore`, fournir une commande `seed_demo` à la place. |
| 🟢 Basse | Pas d'authentification à deux facteurs, pas d'expiration de session. | `django-allauth` + TOTP. |

---

## 4. Fonctionnalités manquantes — par module

Légende priorité : **P0** = indispensable / **P1** = fort impact / **P2** = « wow » / **P3** = bonus.
Effort : S (≤ 1 jour) · M (2-4 jours) · L (1-2 semaines).

### 4.1 Cœur métier : biens, contrats, loyers

| Priorité | Effort | Fonctionnalité | Détail |
|---|---|---|---|
| P0 | M | **Génération automatique des loyers** | Commande/tâche planifiée qui crée chaque mois les `Paiement` de tous les contrats actifs (montant = loyer + charges, échéance = `jour_paiement`). Aujourd'hui, le propriétaire doit créer chaque ligne à la main. |
| P0 | S | **Statuts calculés automatiquement** | `Paiement.statut` déduit de `montant_paye`/`montant_du`/échéance (payé, partiel, en retard) ; propriété ou `save()` ; plus de saisie manuelle incohérente. |
| P0 | S | **Cycle de vie du contrat** | Interdire deux contrats actifs sur un bien ; fin de contrat → bien « libre » ; bouton « Résilier / Renouveler » ; signaux (`post_save`) ou service dédié. |
| P0 | M | **Paiements multiples par échéance** | Un loyer payé en 2 versements (acompte + solde) : modèle `Versement` lié à `Paiement`, reste dû calculé. |
| P0 | S | **Validations métier** | Dates cohérentes, montants positifs, téléphone normalisé `+221…`, unicité email/téléphone. |
| P1 | M | **Contrat de bail PDF généré** | Modèle de bail (vide/meublé/commercial) rempli automatiquement + signature. Aujourd'hui seuls quittances et rapport existent. |
| P1 | M | **Signature électronique** | Signature manuscrite sur écran (canvas) ou intégration Yousign/DocuSign. |
| P1 | M | **État des lieux (entrée/sortie)** | Checklist par pièce, photos horodatées, comparaison entrée/sortie, PDF. |
| P1 | M | **Dépôt de garantie** | Suivi de l'encaissement, retenues justifiées (travaux), restitution, PDF de solde. |
| P1 | M | **Révision/indexation du loyer** | Règle d'augmentation annuelle, historique des loyers, avenant automatique. |
| P1 | M | **Pénalités de retard** | Taux paramétrable, calcul automatique, ajout au solde. |
| P1 | M | **Régularisation des charges + compteurs** | Relevés eau/électricité (SEN'EAU, Senelec), consommation par locataire, refacturation. |
| P1 | S | **Gestion documentaire** | Pièce d'identité, justificatifs de revenu, assurance, bail scanné, par locataire/bien (`FileField`, types, date d'expiration). |
| P1 | S | **Galerie multi-photos** | Aujourd'hui une seule `photo` par bien ; ajouter `PhotoBien` (ordre, légende, photo principale) + vignettes. |
| P2 | M | **Colocation / multi-locataires par contrat** | Un contrat = N colocataires avec quote-part ; garant (modèle `Garant`). |
| P2 | M | **Bien à plusieurs unités** | Immeuble → lots/chambres (le site vend des « chambres » mais le modèle n'a pas de hiérarchie Immeuble → Chambre). |
| P2 | M | **Équipements, caractéristiques, géolocalisation** | Champs `latitude/longitude`, équipements (clim, eau, wifi…), meublé, DPE équivalent. |
| P2 | M | **Gestion des charges & dépenses** | Modèle `Depense` (taxe, assurance, syndic, travaux) par bien → vraie **rentabilité nette** par bien (le modèle a `prix_acquisition` mais aucun calcul de rendement). |
| P2 | M | **Propriétaires multiples & reversements** | Pour une agence : mandants, commission de gestion (%), décompte et relevé de reversement mensuel. |
| P3 | S | **Archivage / suppression douce** | `is_active`/`deleted_at` au lieu de `CASCADE` : supprimer un locataire efface actuellement tous ses contrats et paiements ! |
| P3 | S | **Import/export Excel** | `openpyxl` est dans `requirements.txt` mais **jamais utilisé** : import de biens/locataires depuis Excel, export de toutes les listes. |

### 4.2 Paiements & finance (contexte Sénégal)

| Priorité | Effort | Fonctionnalité | Détail |
|---|---|---|---|
| P0 | L | **Vrai paiement mobile money intégré** | API Wave Checkout / Orange Money / Free Money via un agrégateur (PayDunya, CinetPay, PayTech, Intouch). Aujourd'hui : numéro en dur dans `reservation_confirmation.html` (+221 77 123 45 67) et « envoyez la preuve sur WhatsApp ». Webhook de confirmation → statut `payee` automatique. |
| P0 | M | **Paiement des loyers en ligne par le locataire** | Bouton « Payer mon loyer » dans l'espace locataire → mobile money → quittance générée automatiquement. |
| P1 | M | **Tableau de bord financier avancé** | Cash-flow, prévisionnel vs encaissé, taux de recouvrement, vacance locative, top mauvais payeurs, rendement par bien, comparaison N / N-1. |
| P1 | S | **Rappels avant échéance** | Alertes J-5, J-1, J+1, J+7 (relances graduées) — le script actuel n'alerte que sur le retard. |
| P1 | M | **Comptabilité simple** | Journal recettes/dépenses, export comptable, bilan annuel, déclaration fiscale (récapitulatif des revenus fonciers). |
| P2 | M | **Factures et reçus numérotés** | Numérotation séquentielle légale, TVA pour locaux commerciaux, logo/entête/signature de l'agence. |
| P2 | M | **Rapprochement des paiements** | Import du relevé Wave/Orange (CSV) et association automatique aux loyers. |
| P3 | S | **Multi-devises + format FCFA** | Filtre de gabarit `1 250 000 FCFA` partout, sans décimales (`decimal_places=0`). |

### 4.3 Réservations & site public

| Priorité | Effort | Fonctionnalité | Détail |
|---|---|---|---|
| P0 | M | **Calendrier de disponibilité** | Dates bloquées par réservation/contrat, interdiction du double-booking, vue calendrier (FullCalendar) côté gestion et date-picker côté public. |
| P0 | S | **Prix et total de la réservation** | Tarif/nuit ou /mois, calcul automatique, acompte, affichage du montant à payer. |
| P0 | S | **Notifications automatiques** | Email + **SMS / WhatsApp** (Twilio, WhatsApp Cloud API, Orange SMS API) au propriétaire *et* au client à chaque demande/réservation/paiement. |
| P1 | M | **Expiration des réservations non payées** | Annulation automatique après X heures et libération des dates (tâche planifiée). |
| P1 | M | **Conversion réservation → contrat** | Un clic crée le locataire + contrat + premier paiement depuis la réservation confirmée. |
| P1 | M | **SEO et partage** | Slugs (`/nos-biens/studio-almadies-dakar/`), balises Open Graph, `sitemap.xml`, `robots.txt`, JSON-LD, 404/500 personnalisées. |
| P1 | M | **Carte interactive** | Leaflet/OpenStreetMap avec les biens géolocalisés. |
| P2 | S | **Filtres avancés + tri + pagination** | Nombre de pièces, surface, équipements, tri prix ; aujourd'hui aucune pagination sur le catalogue (tout est chargé). |
| P2 | M | **Favoris, alertes email sur nouveaux biens, comparateur** | Pour visiteurs (session ou compte). |
| P2 | M | **Avis et notes** | Modèle `Avis` modéré par le propriétaire. |
| P2 | S | **Multilingue FR / EN / Wolof** | `LocaleMiddleware`, `{% trans %}`. |
| P3 | S | **Visite virtuelle / vidéo** | Embed YouTube/Matterport, prise de rendez-vous de visite (créneaux). |
| P3 | S | **Bouton WhatsApp flottant, chatbot** | Contact immédiat, FAQ automatisée. |

### 4.4 Maintenance & prestataires

| Priorité | Effort | Fonctionnalité | Détail |
|---|---|---|---|
| P0 | S | **Corriger la priorité** | Voir bug B1 ; tri par urgence réelle. |
| P1 | M | **Modèle `Prestataire`** | Aujourd'hui simple `CharField` : annuaire (plombier, électricien…), téléphone, spécialité, note, historique de coûts. |
| P1 | M | **Workflow & historique d'intervention** | Commentaires, photos avant/après (côté locataire aussi), changement de statut notifié au locataire, qui a signalé. |
| P1 | M | **Devis et validation** | Devis du prestataire → approbation du propriétaire → ordre de travail PDF. |
| P2 | M | **Maintenance préventive récurrente** | Contrôles périodiques (chaudière, extincteurs, nettoyage de citerne) avec rappels. |
| P2 | S | **SLA / délai de traitement** | Indicateurs de temps moyen de résolution. |

### 4.5 Espace locataire

| Priorité | Effort | Fonctionnalité |
|---|---|---|
| P0 | M | Paiement du loyer en ligne + reçu instantané (voir §4.2). |
| P1 | S | Télécharger **son bail** et ses documents ; téléverser ses justificatifs. |
| P1 | M | **Messagerie** propriétaire ↔ locataire (fil de discussion par bien) au lieu de la seule « intervention ». |
| P1 | S | Photos jointes aux signalements ; suivi en temps réel du ticket. |
| P2 | S | Notifications in-app / push, préférences (email, SMS). |
| P2 | M | Demande de préavis / résiliation en ligne, état des lieux de sortie. |
| P3 | S | Changement de profil (téléphone, email), langue, mode sombre. |

### 4.6 Tableau de bord, recherche, rapports

| Priorité | Effort | Fonctionnalité |
|---|---|---|
| P1 | M | **Graphiques dynamiques** (Chart.js / ApexCharts) : revenus, occupation, retards, dépenses ; filtres période/bien/agence. |
| P1 | S | **Recherche globale** (Ctrl+K) sur biens, locataires, contrats, paiements. |
| P1 | S | **Pagination, tri par colonne, filtres combinés** sur toutes les listes (aujourd'hui `qs` entier rendu, pas de pagination). |
| P1 | S | **Actions groupées** : marquer payé, relancer, exporter la sélection. |
| P2 | M | **Rapports planifiés** : envoi automatique par email chaque mois (PDF + Excel). |
| P2 | M | **Centre de notifications** (cloche) : retards, échéances, nouvelles demandes, tickets. |
| P2 | S | **Journal d'activité** consultable. |
| P3 | M | **Widgets personnalisables** et vues enregistrées. |

### 4.7 Intelligence & automatisation (« ultra moderne »)

| Priorité | Effort | Fonctionnalité |
|---|---|---|
| P2 | M | **Scoring locataire** : risque d'impayé calculé à partir de l'historique de paiements et du ratio loyer / revenu (`revenu_mensuel` existe déjà mais n'est jamais exploité). |
| P2 | M | **Prévision de trésorerie et suggestion de loyer** (régression simple sur le marché local). |
| P2 | M | **Génération IA** de l'annonce (titre + description) à partir des caractéristiques, relances personnalisées, résumé mensuel. |
| P2 | M | **OCR** des pièces d'identité / justificatifs pour pré-remplir la fiche locataire. |
| P3 | L | **Assistant conversationnel** : « quels loyers sont en retard ce mois-ci ? » (questions en langage naturel sur les données). |
| P3 | M | **Détection d'anomalies** (loyer inhabituel, paiement dupliqué). |

---

## 5. Architecture, qualité et DevOps

| Priorité | Effort | Élément manquant | Détail |
|---|---|---|---|
| P0 | M | **Tests automatisés** | Aucun fichier `tests.py` dans tout le dépôt. Viser 80 % : modèles, vues (permissions inter-propriétaires), commande `envoyer_alertes`, PDF. `pytest-django` + `factory_boy`. |
| P0 | S | **Découper `views.py`** (690 lignes, tout mélangé) | Package `views/` par domaine (biens, contrats, paiements, espace_locataire), vues génériques (`ListView`, `CreateView`) et mixins de permission. Déplacer la logique dans `services.py`. |
| P0 | S | **Gestionnaire de dépendances** | `requirements.txt` sans version figée, pas de `requirements-dev.txt`, pas de `pyproject.toml`. |
| P1 | S | **Lint / format / typage** | `ruff`, `black`, `mypy`/`django-stubs`, `pre-commit`. Le code contient des `# type: ignore` partout, signe qu'aucun outil n'est configuré. |
| P1 | M | **CI/CD GitHub Actions** | Tests + lint à chaque push, déploiement automatique. |
| P1 | S | **Docker + docker-compose** | App + PostgreSQL + Redis, démarrage en une commande. |
| P1 | M | **Tâches asynchrones** | Celery/RQ + Redis (ou `django-q2`) pour emails, SMS, PDF, génération mensuelle ; remplace le cron manuel. |
| P1 | S | **Logging & monitoring** | `LOGGING` structuré, Sentry pour les erreurs ; aujourd'hui `fail_silently=True` partout masque les erreurs d'envoi. |
| P1 | S | **Sauvegardes** | Dump PostgreSQL quotidien + sauvegarde des médias. |
| P2 | M | **API REST** | Django REST Framework + JWT + documentation OpenAPI/Swagger : base pour une appli mobile. |
| P2 | M | **Cache et optimisation des requêtes** | `select_related/prefetch_related` (les propriétés `locataire_actuel`/`contrat_actif` provoquent des N+1 dans les listes), index sur `statut`/`mois`, cache Redis du dashboard. |
| P2 | S | **Données de démonstration** | Commande `seed_demo` (remplace `data.json`). |
| P2 | S | **Documentation** | README à jour (ne décrit pas les réservations / Wave), schéma ER, guide utilisateur, docstrings de l'API. |
| P3 | S | **Healthcheck, versioning sémantique, CHANGELOG.** | |

---

## 6. UX / UI et front-end

| Priorité | Effort | Fonctionnalité |
|---|---|---|
| P0 | M | **Sortir le CSS de `base.html`** vers des fichiers statiques ; adopter un système de design (Tailwind / Bootstrap 5 / DaisyUI) avec composants réutilisables. |
| P0 | S | **Responsive mobile-first** : la cible (gestionnaires sénégalais) utilise surtout le téléphone. |
| P1 | M | **Interactions modernes avec HTMX + Alpine.js** : filtres sans rechargement, modales de confirmation, formulaires inline, toasts. |
| P1 | M | **PWA** : installable, mode hors ligne, notifications push (manifest + service worker). |
| P1 | S | **Mode sombre**, états vides illustrés, squelettes de chargement. |
| P2 | S | **Accessibilité** (contrastes, labels ARIA, navigation clavier) et **raccourcis clavier**. |
| P2 | S | **Onboarding guidé** : assistant « Ajoutez votre premier bien → locataire → contrat ». |
| P2 | M | **Vue Kanban** pour interventions et réservations (glisser-déposer). |
| P3 | S | Thème personnalisable par agence (logo, couleurs) sur le site public et les PDF. |

---

## 7. Plan de réalisation proposé

**Phase 1 — Fiabiliser (1-2 semaines)**
Corriger B1 → B15, failles §3 critiques/hautes, ajouter les validations, passer à la suppression douce, écrire les premiers tests, découper `views.py`.

**Phase 2 — Automatiser le métier (2-3 semaines)**
Génération mensuelle des loyers, statuts calculés, cycle de vie du contrat, versements partiels, relances graduées, calendrier de disponibilité, prix/total des réservations, notifications email + SMS/WhatsApp, tâches asynchrones.

**Phase 3 — Paiement & documents (2-3 semaines)**
Intégration Wave/Orange Money via agrégateur + webhooks, paiement du loyer en ligne, bail PDF, état des lieux, dépôt de garantie, gestion documentaire.

**Phase 4 — Expérience moderne (2 semaines)**
Refonte front (design system + HTMX + PWA + mode sombre), dashboard Chart.js, recherche globale, pagination/tri, SEO du site public, carte.

**Phase 5 — Plateforme (en continu)**
API REST, rôles/agences, comptabilité, scoring et IA, CI/CD, Docker, monitoring.

---

## 8. Ce qui est déjà bien (à conserver)

- Séparation propre en deux apps (`gestion` / `site_public`) et espace locataire isolé par un middleware de rôle.
- `scope.py` : bonne abstraction pour le mode partagé / isolé.
- Quittances et rapports PDF (`reportlab`), export CSV compatible Excel (BOM), commande d'alertes avec `--dry-run`.
- Configuration par variables d'environnement, `whitenoise`, `dj-database-url`, `Procfile` : prêt pour un déploiement type Render.
- Unicité `(contrat, mois)` sur `Paiement`, garde-fou `SECRET_KEY` en production.
- Contexte local pris en compte (Wave, Orange Money, Free Money, WhatsApp, FCFA).

---

# PARTIE II — Spécification technique : API, Backend, Frontend

> Les sections 1 à 8 listent *quoi* ajouter. Cette partie précise *comment* : l'application n'a aujourd'hui **aucune API** (zéro endpoint JSON, aucun DRF), un backend monolithique (`views.py` unique de 690 lignes, logique métier dans les vues) et un frontend en templates Django avec CSS inline, sans JavaScript applicatif. Chaque action recharge la page entière, d'où une expérience peu fluide.

## 9. API REST (absente → à créer)

### 9.1 Stack et principes
| Élément | Choix recommandé |
|---|---|
| Framework | Django REST Framework (`djangorestframework`) |
| Documentation | `drf-spectacular` → OpenAPI 3 + Swagger UI (`/api/docs/`) + Redoc |
| Authentification | JWT (`djangorestframework-simplejwt`) : access 15 min + refresh 7 j en cookie `HttpOnly` ; sessions Django conservées pour le back-office SSR |
| Versionnage | Préfixe d'URL `/api/v1/` |
| Filtrage / tri / recherche | `django-filter` + `SearchFilter` + `OrderingFilter` (`?statut=retard&ordering=-mois&search=diop`) |
| Pagination | Curseur ou `PageNumber` (20 par défaut, max 100) avec `count/next/previous` |
| Limitation de débit | `DEFAULT_THROTTLE_CLASSES` : 5/min sur login et formulaires publics, 1000/h utilisateur |
| Format d'erreur unique | `{ "code": "validation_error", "message": "...", "details": {champ: [...]} }` (handler d'exception personnalisé) |
| CORS | `django-cors-headers` avec liste blanche d'origines |
| Idempotence | En-tête `Idempotency-Key` sur les POST de paiement (évite les doubles débits) |
| Temps réel | Webhooks sortants + SSE/WebSocket (voir §10.4) |

### 9.2 Catalogue des endpoints à implémenter

**Authentification et profil**
| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/v1/auth/login/` · `/refresh/` · `/logout/` | Connexion, renouvellement, révocation |
| POST | `/api/v1/auth/password/reset/` · `/confirm/` | Mot de passe oublié |
| GET/PATCH | `/api/v1/me/` | Profil, préférences (langue, notifications) |
| POST | `/api/v1/auth/invitations/` · `/accept/` | Invitation locataire par lien à usage unique (remplace le mot de passe en clair) |

**Ressources métier (CRUD complet + actions)**
| Ressource | Routes principales | Actions spécifiques |
|---|---|---|
| Biens | `GET/POST /biens/`, `GET/PATCH/DELETE /biens/{id}/` | `GET /biens/{id}/disponibilites/`, `POST /biens/{id}/photos/`, `GET /biens/{id}/rentabilite/` |
| Locataires | `/locataires/` | `POST /locataires/{id}/inviter/`, `GET /locataires/{id}/score/`, `/documents/` |
| Contrats | `/contrats/` | `POST /contrats/{id}/resilier/`, `/renouveler/`, `GET /contrats/{id}/bail.pdf` |
| Paiements | `/paiements/` | `POST /paiements/{id}/versements/`, `GET /paiements/{id}/quittance.pdf`, `POST /paiements/generer-mois/` |
| Interventions | `/interventions/` | `POST /interventions/{id}/commentaires/`, `/photos/`, `PATCH .../statut/` |
| Réservations | `/reservations/` | `POST /reservations/{id}/confirmer/`, `/annuler/`, `/convertir-en-contrat/` |
| Demandes | `/demandes/` | `POST /demandes/{id}/traiter/` |
| Dépenses, prestataires, documents | `/depenses/`, `/prestataires/`, `/documents/` | — |

**Tableau de bord et rapports**
`GET /dashboard/kpis/` · `GET /dashboard/revenus/?de=&a=&bien=` · `GET /dashboard/occupation/` · `GET /rapports/financier/?format=csv|pdf|xlsx` · `GET /recherche/?q=` (recherche globale) · `GET /notifications/` + `POST /notifications/{id}/lue/`.

**API publique (site + application mobile, sans authentification, throttlée)**
`GET /public/biens/` (filtres, pagination) · `GET /public/biens/{slug}/` · `GET /public/biens/{slug}/disponibilites/` · `POST /public/reservations/` · `POST /public/contact/` · `GET /public/reservations/{token}/` (jeton signé, corrige la fuite d'identifiants séquentiels).

**Paiement mobile money et intégrations**
| Route | Rôle |
|---|---|
| `POST /paiements/initier/` | Crée une session Wave / Orange Money / Free Money via l'agrégateur, renvoie l'URL ou le QR |
| `POST /webhooks/paiement/{fournisseur}/` | Reçoit la confirmation, **vérifie la signature HMAC**, passe le paiement/la réservation à « payé » |
| `POST /webhooks/whatsapp/` | Messages entrants (preuves de paiement, questions) |
| Webhooks sortants configurables | `paiement.recu`, `loyer.en_retard`, `reservation.creee`… pour brancher Zapier/n8n |

**Santé et exploitation** : `GET /api/health/` (base, cache, file de tâches), `GET /api/v1/version/`.

### 9.3 Règles d'implémentation
- Un `Serializer` par ressource (lecture ≠ écriture), validation métier centralisée dans les serializers *et* les services (jamais dans la vue).
- Permissions DRF par rôle (`IsAdminAgence`, `IsGestionnaire`, `IsLocataireOwner`) + filtrage du queryset par agence/propriétaire (réutiliser `scope.py`).
- `select_related` / `prefetch_related` systématiques pour éviter les N+1 ; `annotate` pour les totaux (solde, retard).
- Tests d'API (`APIClient`) : chaque endpoint testé en 200/400/401/403/404, plus un test « un locataire A ne voit jamais les données du locataire B ».
- Schéma OpenAPI généré automatiquement et utilisé pour **générer le client TypeScript** du frontend (`openapi-typescript`) : plus de divergence entre back et front.

## 10. Backend — architecture cible

### 10.1 Découpage en apps Django
Aujourd'hui tout vit dans `gestion`. Cible :

```
immogest/
├── config/                 # settings/ (base.py, dev.py, prod.py), urls, asgi, celery
├── apps/
│   ├── accounts/           # User, Agence, Membre(role), invitations, 2FA, audit
│   ├── patrimoine/         # Bien, PhotoBien, Equipement, Prestataire
│   ├── locations/          # Locataire, Garant, Contrat, EtatDesLieux, Document
│   ├── finance/            # Paiement, Versement, Depense, Facture, Penalite
│   ├── maintenance/        # Intervention, Commentaire, Devis
│   ├── reservations/       # Reservation, Disponibilite, tarifs
│   ├── notifications/      # Notification, modèles d'email/SMS/WhatsApp, préférences
│   ├── integrations/       # clients Wave/Orange/PayDunya, Twilio, webhooks
│   ├── api/                # routeurs v1, serializers, permissions, throttles
│   └── public/             # site vitrine (SSR, SEO)
└── tests/
```

### 10.2 Couche « services » (la logique sort des vues)
Chaque règle métier devient une fonction testable, appelée par l'API *et* par l'admin :
- `contrats.services.creer_contrat()` : vérifie l'absence de chevauchement, passe le bien en « loué », crée les loyers futurs, le tout dans `transaction.atomic()`.
- `contrats.services.resilier_contrat()` : libère le bien, calcule la restitution du dépôt de garantie.
- `finance.services.generer_loyers_du_mois()` · `enregistrer_versement()` · `calculer_penalites()` · `recalculer_statut(paiement)`.
- `reservations.services.creer_reservation()` : contrôle de disponibilité avec verrou (`select_for_update`) contre le double-booking, calcul du total.
- `notifications.services.notifier(evenement, destinataire, contexte)` : choisit canal (email/SMS/WhatsApp/in-app) selon les préférences.

### 10.3 Tâches asynchrones et planifiées (Celery + Redis, ou `django-q2`)
| Tâche | Fréquence |
|---|---|
| Générer les loyers du mois | 1er du mois, 00:05 |
| Marquer les loyers en retard + pénalités | quotidienne |
| Relances J-5 / J-1 / J+1 / J+7 | quotidienne 08:00 |
| Expirer les réservations non payées | toutes les 15 min |
| Rappel d'échéance de contrat (90/60/30 j) | quotidienne |
| Envoi des emails/SMS/PDF (hors requête HTTP) | à la demande |
| Rapport mensuel PDF/Excel par email | le 1er |
| Sauvegarde base + médias | quotidienne |

Le service d'alertes actuel (`envoyer_alertes`, commande manuelle à brancher sur un cron) est remplacé par ces tâches ; **`fail_silently=True` est supprimé** au profit de tentatives avec journalisation.

### 10.4 Temps réel
- **Django Channels** (WebSocket) ou **SSE** : le badge de notifications et la liste des demandes/réservations se mettent à jour sans recharger la page quand un client réserve ou paie.
- Le webhook de paiement pousse l'événement au tableau de bord du gestionnaire et à l'espace du locataire concerné.

### 10.5 Données et infrastructure
| Sujet | Décision |
|---|---|
| Base | PostgreSQL obligatoire en prod (contraintes `CheckConstraint`, `ExclusionConstraint` sur les plages de dates anti-chevauchement) |
| Montants | `DecimalField(decimal_places=0)` en FCFA, type `Money` unique, gabarit d'affichage `1 250 000 FCFA` |
| Suppression | Soft delete (`deleted_at`) + `PROTECT` au lieu de `CASCADE` sur Bien/Locataire/Contrat |
| Historique | `django-simple-history` sur Contrat, Paiement, Bien |
| Cache | Redis : KPIs du dashboard (TTL 60 s), sessions, verrous |
| Fichiers | S3/Cloudinary + vignettes (`django-imagekit`), antivirus/validation de type |
| Observabilité | Sentry, logs JSON, métriques Prometheus, `/api/health/` |
| Sécurité | `django-axes`, CSP, HSTS, rotation des secrets, chiffrement des pièces d'identité |
| Conteneurs | `Dockerfile` + `docker-compose.yml` (web, worker, beat, postgres, redis) |
| ASGI | `uvicorn`/`daphne` + `gunicorn` workers, `whitenoise` conservé pour le statique |

## 11. Frontend — spécification

### 11.1 Choix d'architecture (deux niveaux, un seul backend)
| Surface | Technologie | Pourquoi |
|---|---|---|
| **Site public** (vitrine, catalogue, réservation) | Django templates SSR + HTMX + Alpine.js + Tailwind CSS | SEO indispensable, chargement très rapide, peu de JS |
| **Back-office gestionnaire + espace locataire** | **Application React** (Vite + TypeScript) consommant l'API `/api/v1/` | Interface fluide type application : navigation sans rechargement, état partagé, temps réel |
| **Mobile** | PWA installable (même application React), puis éventuellement React Native réutilisant l'API | Les gestionnaires travaillent surtout sur téléphone |

> Variante « budget étudiant » si le temps manque : conserver Django + templates partout, mais ajouter **HTMX + Alpine.js + Tailwind** (gain de fluidité immédiat, sans réécrire en SPA). Voir §11.5 pour les étapes.

### 11.2 Stack du back-office React
| Besoin | Outil |
|---|---|
| Build / langage | Vite, TypeScript strict |
| Routage | React Router (routes protégées par rôle) |
| Données serveur | **TanStack Query** (cache, revalidation, mises à jour optimistes, pagination infinie) |
| Client API | généré depuis l'OpenAPI (`openapi-typescript` + `openapi-fetch`) |
| UI | Tailwind CSS + shadcn/ui (Radix) ; icônes Lucide |
| Formulaires | React Hook Form + Zod (mêmes règles de validation que le serveur) |
| Tableaux | TanStack Table (tri, filtre, colonnes, sélection groupée, export) |
| Graphiques | Recharts ou ApexCharts |
| Calendrier | FullCalendar (disponibilités, échéances, interventions) |
| Carte | Leaflet + OpenStreetMap |
| Temps réel | WebSocket/SSE → invalidation du cache TanStack Query |
| PDF | Aperçu intégré (`react-pdf`) des quittances et baux |
| i18n | `react-i18next` (FR/EN/Wolof) |
| Tests | Vitest + Testing Library + Playwright (parcours critiques) |

### 11.3 Écrans à concevoir
**Gestionnaire**
1. Connexion / 2FA / mot de passe oublié.
2. Tableau de bord : KPIs, graphique revenus vs prévu, occupation, retards, échéances, flux d'activité en direct.
3. Biens : liste (grille/tableau, filtres, recherche live), fiche (onglets *Infos · Photos · Contrat · Paiements · Interventions · Documents · Rentabilité*), formulaire en étapes.
4. Locataires : liste, fiche 360° (contrats, paiements, documents, score, messages).
5. Contrats : assistant de création en 4 étapes (bien → locataire → conditions → récapitulatif/signature), renouvellement, résiliation.
6. Paiements : tableau avec actions groupées, enregistrement rapide d'un versement (modale), relances en un clic, rapprochement mobile money.
7. Interventions : vue **Kanban** (Ouverte → En cours → Terminée), fil de discussion, devis.
8. Réservations : calendrier + liste, confirmation et conversion en contrat.
9. Finance : dépenses, rentabilité par bien, exports, déclaration annuelle.
10. Paramètres : agence (logo, couleurs), utilisateurs et rôles, modèles de messages, tarifs, intégrations de paiement, notifications.
11. Recherche globale **Ctrl+K** et centre de notifications (cloche).

**Locataire** : accueil (prochain loyer + bouton *Payer*), historique et quittances, mon bail et documents, signaler un problème avec photos, messagerie, profil.

**Public** : accueil, catalogue avec carte et filtres, fiche bien (galerie, calendrier de disponibilité, tarifs), tunnel de réservation en 3 étapes avec paiement mobile money, suivi de réservation par lien sécurisé, contact/WhatsApp.

### 11.4 Ce qui rend l'application « fluide »
| Technique | Effet pour l'utilisateur |
|---|---|
| Navigation SPA, pas de rechargement complet | Passage d'une page à l'autre instantané |
| Cache TanStack Query + *stale-while-revalidate* | Les listes déjà vues s'affichent immédiatement |
| **Mises à jour optimistes** | Cocher « payé » ou changer un statut s'applique avant même la réponse serveur |
| Recherche avec *debounce* 300 ms + filtres dans l'URL | Résultats pendant la frappe, liens partageables |
| Pagination infinie / virtualisation (`react-virtual`) | Listes de milliers de lignes sans lag |
| Squelettes de chargement + états vides illustrés | Plus d'écran blanc |
| Toasts, modales, formulaires inline | Plus de page de confirmation dédiée |
| Préchargement des routes au survol (`prefetch`) + découpage du code (`lazy`) | Premier chargement léger |
| Temps réel (WebSocket/SSE) | Nouvelle réservation ou paiement visible sans actualiser |
| Images responsives WebP + `loading="lazy"` | Catalogue rapide en 3G/4G |
| PWA + cache hors-ligne | Consultation sans réseau, installable sur l'écran d'accueil |
| Animations courtes (≤ 200 ms), `prefers-reduced-motion` respecté | Ressenti moderne sans gêne |

**Objectifs mesurables** : Lighthouse ≥ 90 (performance, accessibilité, SEO, bonnes pratiques), LCP < 2,5 s sur mobile 4G, interaction (INP) < 200 ms, bundle initial < 200 ko gzip.

### 11.5 Chemin « progressif » (sans tout réécrire d'un coup)
1. Extraire le CSS de `base.html` → `static/css/`, installer **Tailwind** et créer des composants de gabarit (`{% include %}`) : carte, badge de statut, tableau, modale, formulaire.
2. Ajouter **HTMX** : recherche/filtres/pagination sans rechargement, suppression et changement de statut en place, formulaires en modale, `hx-boost` pour accélérer la navigation.
3. Ajouter **Alpine.js** pour les menus, onglets, copier/coller, calculs de totaux côté client.
4. Brancher **Chart.js** sur l'endpoint `/api/v1/dashboard/*`.
5. Construire l'API DRF en parallèle (§9) et migrer écran par écran vers React en commençant par le tableau de bord et les paiements.
6. Activer le manifest + service worker (PWA) et les notifications push.

### 11.6 Design system
- **Tokens** : couleurs (primaire bleu actuel `#185FA5` conservé comme base, états succès/alerte/danger), typographie (Inter ou Plus Jakarta Sans), espacements 4/8 px, rayons, ombres ; thèmes clair/sombre par variables CSS.
- Bibliothèque de composants documentée (Storybook) : Button, Input, Select, DatePicker, Badge, Table, Modal, Drawer, Toast, Tabs, Stepper, Kanban, EmptyState, Skeleton.
- Accessibilité : WCAG AA, navigation clavier complète, `aria-live` pour les toasts, formulaires étiquetés.

## 12. Feuille de route révisée (intégrant API + Front)

| Phase | Contenu | Durée indicative |
|---|---|---|
| 1. Fiabiliser | Bugs B1–B15, failles §3, tests, settings en `base/dev/prod`, PostgreSQL, Docker | 1–2 sem. |
| 2. Services & async | Couche `services`, Celery/Redis, génération des loyers, relances, notifications email/SMS/WhatsApp | 2–3 sem. |
| 3. **API v1** | DRF, JWT, serializers, permissions, filtres, OpenAPI/Swagger, endpoints publics, throttling, tests d'API | 2–3 sem. |
| 4. Paiement | Agrégateur mobile money, webhooks signés, paiement du loyer en ligne, quittance automatique | 2 sem. |
| 5. **Frontend moderne** | Design system, HTMX/Alpine (site public) puis React + TanStack Query (back-office), dashboard Chart.js, Kanban, calendrier, recherche Ctrl+K | 3–4 sem. |
| 6. Temps réel & PWA | Channels/SSE, notifications push, mode hors-ligne | 1–2 sem. |
| 7. Documents & métier avancé | Bail/état des lieux PDF, dépôt de garantie, signature, scoring, IA | 3 sem. |
| 8. Industrialisation | CI/CD GitHub Actions, Sentry, sauvegardes, charge, documentation | 1–2 sem. |
