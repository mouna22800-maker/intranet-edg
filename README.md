# Intranet — Électricité de Guinée (EDG) S.A.

Portail intranet de l'Électricité de Guinée : actualités des directions, bibliothèque
documentaire, agenda institutionnel, annuaire, organigramme des postes, guichet de
tickets et console d'administration.

**Pile technique**

| Partie | Technologies |
|---|---|
| Backend | Python 3.12 · FastAPI · MySQL (SQLite pour les tests) · PyJWT · bcrypt |
| Frontend | React 19 · TypeScript · Vite 6 · Tailwind CSS 4 |

---

## Prérequis

| Outil | Version | Remarque |
|---|---|---|
| **Node.js** | 18 ou plus | pour l'interface |
| **Python** | 3.10 ou plus (testé en 3.12) | pour l'API |
| **MySQL / MariaDB** | 5.7 ou plus | XAMPP convient parfaitement en local |

> ℹ️ **La base de données n'est pas à importer.** Toutes les tables sont créées et
> migrées automatiquement au premier démarrage du backend. Il suffit que le serveur
> MySQL soit démarré et accessible.

---

## Démarrage rapide

### 1. Récupérer le projet

```bash
git clone https://github.com/mouna22800-maker/intranet-edg.git
cd intranet-edg
```

### 2. Installer les dépendances

```bash
npm install                              # interface
python -m pip install -r requirements.txt   # API
```

### 3. Configurer l'environnement

Copiez le modèle fourni, puis renseignez-le :

```bash
cp .env.example .env      # Windows : copy .env.example .env
```

Générez **votre propre** clé de signature de session :

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

…et reportez-la dans `JWT_SECRET_KEY`. Ajustez ensuite les accès MySQL
(`MYSQL_USER`, `MYSQL_PASSWORD`…). Avec XAMPP par défaut : utilisateur `root`,
mot de passe vide.

> ⚠️ Le fichier `.env` **ne doit jamais être commité** (il est déjà dans `.gitignore`).
> Chaque environnement — développement, production — possède ses propres secrets.

### 4. Démarrer MySQL

Via le panneau de contrôle XAMPP, ou en tant que service système.

### 5. Lancer les deux serveurs

Dans **deux terminaux séparés** :

```bash
# Terminal 1 — API (port 8000)
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000

# Terminal 2 — interface (port 3000)
npm run dev
```

Puis ouvrez **<http://localhost:3000>**.

> Le premier démarrage du backend prend jusqu'à une minute : il crée les tables et
> insère les données initiales. Attendez la ligne `Application startup complete.`

---

## Se connecter

L'accès à la plateforme exige une authentification — il n'y a aucune page publique.

Des comptes de démonstration (un par rôle) sont créés automatiquement au premier
démarrage. Leurs adresses et mots de passe figurent dans la fonction de peuplement
de [`api/database.py`](api/database.py).

> 🔒 **Avant toute mise en service réelle, supprimez ou changez ces comptes.**

---

## Rôles et permissions

| Rôle | Portée |
|---|---|
| `agent` | Consultation ; peut créer des tickets |
| `chef_service` | Publie actualités et documents, traite les tickets **de sa direction** |
| `rh_direction` | Vue élargie ; sans direction rattachée = RH central (vue globale) |
| `administrateur` | Accès complet : directions, postes, comptes, paramètres, audit |

---

## Sécurité intégrée

- Session par **cookie httpOnly** (aucun jeton exposé au JavaScript)
- Mots de passe hachés en **bcrypt** (irréversible)
- Session glissante de **30 minutes** d'inactivité
- **Blocage du compte** après 5 échecs de connexion consécutifs
- **Journal d'audit** des connexions et déconnexions
- Politique de mot de passe : **12 caractères minimum**, majuscule, minuscule,
  chiffre, caractère spécial, sans accent
- **Réinitialisation par e-mail** (jeton haché, valable 1 heure)
- Assainissement HTML anti-XSS (`nh3`) sur les contenus rédigés

---

## Scripts disponibles

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement Vite (port 3000, rechargement à chaud) |
| `npm run build` | Build de production dans `dist/` |
| `npm run lint` | Vérification TypeScript (`tsc --noEmit`) |
| `python -m pytest` | Tests du backend |

Pour les tests :

```bash
python -m pip install -r requirements-dev.txt
python -m pytest
```

Les tests s'exécutent sur **SQLite en mémoire** : ils ne touchent jamais votre base MySQL.

---

## Structure du projet

```text
intranet-edg/
├── api/                    # Backend FastAPI
│   ├── main.py             # Point d'entrée, middlewares, en-têtes de sécurité
│   ├── database.py         # Création et migration automatiques du schéma
│   ├── auth.py             # Sessions, politique de mot de passe, rôles
│   ├── models.py           # Schémas Pydantic
│   └── routes/             # admin, articles, auth, departments, documents,
│                           # events, postes, team, tickets, uploads, users,
│                           # user_notifications
├── src/                    # Frontend React / TypeScript
│   └── components/         # Vues et composants
├── public/images/          # Visuels WebP servis tels quels
├── tests/                  # Tests pytest
├── .env.example            # Modèle de configuration
└── DEPLOY.md               # Guide de mise en production
```

---

## Configuration (`.env`)

| Variable | Rôle |
|---|---|
| `APP_ENV` | `development` ou `production` (désactive `/docs`, active HSTS) |
| `DB_TYPE` | `mysql` en usage normal |
| `MYSQL_*` | Hôte, port, utilisateur, mot de passe, nom de la base |
| `JWT_SECRET_KEY` | **Obligatoire en production** — propre à chaque environnement |
| `COOKIE_SECURE` | `true` en production (HTTPS) |
| `CORS_ORIGINS` | Domaines autorisés, séparés par des virgules |
| `APP_URL` | URL publique, utilisée dans les e-mails |
| `SMTP_*` | Envoi d'e-mails ; si vide, le lien de réinitialisation est seulement journalisé |

---

## Mise en production

Consultez **[DEPLOY.md](DEPLOY.md)** : utilisateur MySQL dédié, build, service
systemd, HTTPS via reverse proxy, sauvegardes.

En bref : après `npm run build`, le dossier `dist/` est **servi directement par
FastAPI**. Un seul processus suffit alors — le serveur Vite n'est plus nécessaire.

---

## Dépannage

| Symptôme | Cause probable |
|---|---|
| L'interface s'affiche mais reste vide | Le backend n'est pas démarré → vérifiez le port 8000 |
| `Can't connect to MySQL` | MySQL n'est pas lancé, ou `MYSQL_*` est incorrect dans `.env` |
| Le démarrage semble bloqué | Normal au premier lancement (migrations) — patientez une minute |
| Déconnexion permanente | `JWT_SECRET_KEY` a changé, ou 30 minutes d'inactivité |
| `git` non reconnu après installation | Ouvrez un **nouveau** terminal pour recharger le `PATH` |
