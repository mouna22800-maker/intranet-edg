# API — Intranet Électricité de Guinée (FastAPI)

Service d'API en **Python / FastAPI** qui alimente le portail intranet de
l'**Électricité de Guinée (EDG) S.A.**

> Pour installer et lancer le projet complet, voir le [README principal](../README.md).
> Ce document décrit l'API elle-même.

## Base de données

L'application utilise **MySQL** (`DB_TYPE=mysql`). SQLite reste employé pour les
tests automatisés, via une couche d'abstraction qui traduit les paramètres `?` en `%s`.

Le schéma est **créé et migré automatiquement au démarrage** (`CREATE TABLE IF NOT
EXISTS` et ajouts de colonnes idempotents) : aucun script SQL n'est à exécuter à la
main, aucun export n'est à maintenir. Les connexions MySQL passent par un **pool**
(DBUtils) pour éviter d'ouvrir une connexion par requête.

## Structure

```text
api/
├── main.py                 # Point d'entrée : middlewares, en-têtes de sécurité,
│                           # CORS, gestionnaires d'erreurs, service du build dist/
├── database.py             # Schéma, migrations, pool de connexions, données initiales
├── auth.py                 # Sessions, politique de mot de passe, dépendances de rôle
├── models.py               # Schémas Pydantic (entrée / sortie)
├── email_util.py           # Envoi SMTP (dégradé proprement si non configuré)
├── sanitize.py             # Assainissement HTML anti-XSS (nh3)
├── requirements.txt
└── routes/
    ├── auth.py             # Connexion, déconnexion, session, mot de passe, audit
    ├── users.py            # Gestion des comptes (administrateur)
    ├── departments.py      # Directions
    ├── postes.py           # Organigramme des postes (hiérarchie par parent_id)
    ├── team.py             # Membres d'équipe
    ├── articles.py         # Actualités
    ├── documents.py        # Bibliothèque documentaire
    ├── events.py           # Agenda institutionnel
    ├── tickets.py          # Guichet d'assistance
    ├── uploads.py          # Téléversement de fichiers
    ├── user_notifications.py  # Notifications dans l'application
    └── admin.py            # Directions, applications, paramètres, logo
```

## Sécurité

- **Session par cookie httpOnly** (`edg_session`), signée en JWT, glissante sur
  30 minutes d'inactivité. Aucun jeton n'est accessible au JavaScript.
- **bcrypt** pour les mots de passe (hachage irréversible).
- **Blocage du compte** après 5 échecs consécutifs, avec journal d'audit.
- Politique de mot de passe : 12 caractères minimum, majuscule, minuscule, chiffre,
  caractère spécial `@$!%*?&#`, sans caractère accentué.
- **Réinitialisation par e-mail** : jeton aléatoire stocké haché en SHA-256,
  valable 1 heure et invalidé après usage.
- Les erreurs 500 sont journalisées côté serveur et renvoient un message générique,
  sans jamais exposer de détail interne au client.
- Téléversements restreints aux extensions d'images sûres (le SVG est refusé,
  car il peut porter du script).

## Rôles

`agent` · `chef_service` · `rh_direction` · `administrateur`

Le cloisonnement par direction s'appuie sur `users.unity_id`. Un `rh_direction`
sans direction rattachée dispose d'une vue globale (RH central) ; avec une
direction, sa portée y est limitée.

## Documentation interactive

En environnement de développement, FastAPI expose :

- **<http://127.0.0.1:8000/docs>** — Swagger UI
- **<http://127.0.0.1:8000/redoc>** — ReDoc

Ces deux routes sont **désactivées automatiquement** lorsque `APP_ENV=production`.

## Tests

```bash
python -m pip install -r ../requirements-dev.txt
python -m pytest
```

Couverture : authentification, contrôle d'accès par rôle, assainissement HTML et
guichet de tickets. Les tests utilisent SQLite et ne touchent jamais la base MySQL.
