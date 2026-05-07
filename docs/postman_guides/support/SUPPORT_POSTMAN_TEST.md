# LAVO - Guide de test Postman : module Support

Ce guide explique comment importer et utiliser la collection
`lavo-support.postman_collection.json` pour tester les endpoints du module
support dans Postman.

---

## Prérequis

### Environnement Postman

Importez l'environnement partagé `lavo.local.postman_environment.json` situé
dans `docs/postman_guides/`. Cet environnement fournit la variable `base_url`
préconfigurée à `http://localhost:3000`.

### Deux tokens JWT distincts

Les tests couvrent deux rôles différents. Vous devez disposer de deux tokens
avant de commencer :

| Token | Rôle | Utilisation |
|---|---|---|
| **JWT client** | `client` ou `station` | Groupe "Support - Client" |
| **JWT admin** | `admin` | Groupe "Support - Admin" |

Pour obtenir ces tokens, exécutez d'abord le login correspondant via la
collection `docs/postman_guides/auth/`. Copiez la valeur du champ
`data.access_token` de la réponse et collez-la dans la variable de collection
`access_token` avant chaque groupe.

**Important** : ne mélangez pas les tokens entre les groupes. Un token client
sur un endpoint admin retournera 403.

---

## Workflow recommande

Suivez cet ordre pour tester l'ensemble du cycle de vie d'un ticket.

### Etape 1 - Créer le ticket (client)

1. Définir `access_token` avec le JWT client.
2. Exécuter **"Créer ticket - succès (201)"**.
3. Le script de test capture automatiquement `json.data.id` dans la variable
   `ticket_id`. Toutes les requêtes suivantes utilisant `{{ticket_id}}` seront
   prêtes sans manipulation manuelle.

### Etape 2 - Ajouter un message (client)

4. Exécuter **"Ajouter message (201)"** pour enrichir le fil de discussion.
   Le champ du body s'appelle `content` (et non `message`).

### Etape 3 - Vérifier le détail (client)

5. Exécuter **"Détail ticket (200)"** pour confirmer que le message est bien
   rattaché au ticket.

### Etape 4 - Passer en traitement (admin)

6. Remplacer `access_token` par le JWT admin.
7. Exécuter **"Changer statut - en_cours (200)"** pour passer le ticket en
   `en_cours`.

### Etape 5 - Assigner le ticket (admin)

8. Exécuter **"Assigner ticket (200)"** en remplacant l'UUID placeholder par
   l'UUID réel d'un admin de votre base de données.
9. Pour retirer l'assignation, exécuter **"Désassigner ticket (200)"**.

### Etape 6 - Fermer le ticket (admin)

10. Exécuter **"Changer statut - ferme (200)"** pour clôturer le ticket.

---

## Rate limiting

Deux limites de débit sont appliquées via une fenêtre glissante Redis. Elles
sont indépendantes l'une de l'autre.

### Création de tickets

- **Limite** : 5 tickets par heure par utilisateur authentifié.
- **Fenêtre** : 3600 secondes glissantes.
- **Réponse dépassée** : `429 Too Many Requests`.

Pour tester ce cas manuellement, envoyez la requête **"Créer ticket - succès
(201)"** six fois de suite avec le même token. La sixième retournera 429. La
requête **"Créer ticket - rate limit (429)"** est fournie à titre documentaire
et inclut une description de la procédure.

### Ajout de messages

- **Limite** : 30 messages par heure par utilisateur authentifié.
- **Fenêtre** : 3600 secondes glissantes, tous tickets confondus.
- **Réponse dépassée** : `429 Too Many Requests`.

La limite s'applique à l'ensemble des tickets d'un même utilisateur, pas par
ticket. Un utilisateur qui envoie 30 messages sur 10 tickets différents atteint
la limite.

---

## Variable `ticket_id` - auto-remplissage

La requête **"Créer ticket - succès (201)"** contient un script de test
Postman qui s'exécute automatiquement après réception d'une réponse 201 :

```javascript
pm.collectionVariables.set('ticket_id', json.data.id);
```

Ce script enregistre l'UUID du ticket créé dans la variable de collection
`ticket_id`. Toutes les requêtes qui référencent `{{ticket_id}}` dans leur
URL utilisent ensuite cette valeur sans action manuelle supplémentaire.

Si vous souhaitez tester avec un ticket existant sans passer par la création,
définissez manuellement `ticket_id` via l'onglet "Variables" de la collection.

---

## Description des groupes

### Support - Client

Ce groupe couvre les actions disponibles à tout utilisateur authentifié (rôle
`client`, `station` ou `admin`).

| Requête | Méthode | Endpoint | Cas testé |
|---|---|---|---|
| Créer ticket - succès (201) | POST | /api/v1/support | Création valide, capture `ticket_id` |
| Créer ticket - body invalide (400) | POST | /api/v1/support | subject court, message court, category et priority invalides |
| Créer ticket - rate limit (429) | POST | /api/v1/support | Procédure documentaire, 6e requête en moins d'une heure |
| Mes tickets (200) | GET | /api/v1/support | Liste des tickets de l'utilisateur courant |
| Mes tickets - filtre statut ouvert (200) | GET | /api/v1/support?status=ouvert | Filtre par statut |
| Détail ticket (200) | GET | /api/v1/support/{{ticket_id}} | Détail + fil de messages |
| Détail ticket - introuvable (404) | GET | /api/v1/support/00000000-... | UUID valide mais ticket absent ou appartenant à un autre |
| Ajouter message (201) | POST | /api/v1/support/{{ticket_id}}/messages | Ajout d'un message valide |
| Ajouter message - body invalide (400) | POST | /api/v1/support/{{ticket_id}}/messages | Champ `content` absent |
| Créer ticket - non authentifié (401) | POST | /api/v1/support | Absence de header Authorization |

### Support - Admin

Ce groupe couvre les actions réservées au rôle `admin`. Remplacez `access_token`
par un JWT admin avant d'exécuter ces requêtes.

Un admin qui appelle `GET /api/v1/support` voit tous les tickets du système
(pas seulement les siens). C'est le même endpoint que le client, le comportement
change selon le rôle du token fourni.

Le changement de statut s'effectue via `PATCH /api/v1/support/{{ticket_id}}`
(endpoint partagé, mais route protégée par le rôle `admin` côté serveur).

L'assignation est sur un endpoint dédié `/api/v1/admin/support/{{ticket_id}}/assign`.

| Requête | Méthode | Endpoint | Cas testé |
|---|---|---|---|
| Liste tous les tickets (200) | GET | /api/v1/support | Admin voit tous les tickets |
| Liste - filtre statut (200) | GET | /api/v1/support?status=ouvert | Filtre par statut côté admin |
| Détail ticket admin (200) | GET | /api/v1/support/{{ticket_id}} | Admin accède à n'importe quel ticket |
| Changer statut - en_cours (200) | PATCH | /api/v1/support/{{ticket_id}} | Passage en traitement |
| Changer statut - ferme (200) | PATCH | /api/v1/support/{{ticket_id}} | Fermeture du ticket |
| Changer statut - statut invalide (400) | PATCH | /api/v1/support/{{ticket_id}} | Valeur avec accent rejetée |
| Assigner ticket (200) | PATCH | /api/v1/admin/support/{{ticket_id}}/assign | Assignation à un admin |
| Désassigner ticket (200) | PATCH | /api/v1/admin/support/{{ticket_id}}/assign | `assigned_to: null` |
| Admin - non authentifié (401) | PATCH | /api/v1/admin/support/{{ticket_id}}/assign | Absence de token |
| Admin - mauvais rôle (403) | PATCH | /api/v1/admin/support/{{ticket_id}}/assign | Token client sur endpoint admin |

---

## Valeurs de référence

### Statuts (`status`)

| Valeur API | Signification |
|---|---|
| `ouvert` | Ticket créé, en attente de prise en charge |
| `en_cours` | Ticket pris en charge par un admin |
| `resolu` | Problème résolu |
| `ferme` | Ticket clôturé (sans accent dans l'API) |

### Catégories (`category`)

| Valeur | Description |
|---|---|
| `technique` | Problème technique sur la plateforme |
| `facturation` | Question ou litige de facturation |
| `bug` | Anomalie logicielle identifiée |
| `autre` | Tout autre sujet (valeur par défaut) |

### Priorités (`priority`)

| Valeur | Description |
|---|---|
| `bas` | Priorité basse, pas urgent |
| `normal` | Priorité standard (valeur par défaut) |
| `urgent` | Traitement prioritaire requis |
