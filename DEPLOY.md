# Déploiement en production — Intranet Électricité de Guinée (EDG)

Ce guide met l'application en ligne de façon **sûre**. Architecture retenue : **uvicorn sert
à la fois l'API et le frontend compilé** (`dist/`), derrière un **reverse proxy TLS** (HTTPS).

---

## 1. Prérequis (serveur Linux type Ubuntu)

- Python 3.10+, Node.js 20+, un serveur **MySQL** (PAS XAMPP en prod).
- Un nom de domaine pointant vers le serveur (ex. `intranet.edg.com.gn`).

## 2. Base de données : utilisateur dédié (pas root)

```sql
CREATE DATABASE IF NOT EXISTS edg_intranet CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'edg_app'@'localhost' IDENTIFIED BY 'UN_MOT_DE_PASSE_TRES_FORT';
GRANT SELECT, INSERT, UPDATE, DELETE ON edg_intranet.* TO 'edg_app'@'localhost';
FLUSH PRIVILEGES;
```

## 3. Configuration `.env` (à la racine, **jamais commité**)

Copiez `.env.example` en `.env` et renseignez **au minimum** :

```
APP_ENV="production"
DB_TYPE="mysql"
MYSQL_HOST="localhost"
MYSQL_USER="edg_app"
MYSQL_PASSWORD="UN_MOT_DE_PASSE_TRES_FORT"
MYSQL_DATABASE="edg_intranet"
JWT_SECRET_KEY="<generez: python -c \"import secrets; print(secrets.token_hex(32))\">"
COOKIE_SECURE="true"          # obligatoire dès que vous êtes en HTTPS
CORS_ORIGINS="https://intranet.edg.com.gn"
```

> En `APP_ENV=production`, `/docs` et `/redoc` sont désactivés, l'en-tête HSTS est ajouté,
> et l'application **refuse de démarrer** si `JWT_SECRET_KEY` n'est pas défini.

## 4. Installer les dépendances + compiler le frontend

```bash
python -m pip install -r requirements.txt
npm ci
npm run build          # génère dist/ (servi automatiquement par l'API)
```

## 5. Lancer l'application

```bash
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```

L'app est alors servie sur `http://127.0.0.1:8000` (frontend + API). On **ne l'expose pas
directement** : on met un reverse proxy TLS devant (étape 6).

### Service qui redémarre tout seul (systemd)

`/etc/systemd/system/edg-intranet.service` :

```ini
[Unit]
Description=EDG Intranet (FastAPI)
After=network.target mysql.service

[Service]
WorkingDirectory=/opt/edg-intranet
ExecStart=/usr/bin/python3 -m uvicorn api.main:app --host 127.0.0.1 --port 8000
Restart=always
User=www-data
EnvironmentFile=/opt/edg-intranet/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable --now edg-intranet
```

### Première connexion administrateur

En `APP_ENV=production`, **aucun compte de démonstration n'est créé**. Au tout premier
démarrage, un administrateur unique est provisionné avec l'adresse `ADMIN_EMAIL` du `.env`
et un **mot de passe aléatoire affiché une seule fois dans le journal du serveur** :

```bash
sudo journalctl -u edg-intranet | grep -A6 "COMPTE ADMINISTRATEUR INITIAL"
```

Connectez-vous avec ce mot de passe : le changement est **exigé dès la première connexion**.
Le mot de passe n'est pas récupérable ensuite — s'il est perdu avant d'être changé,
supprimez la ligne de la table `users` puis redémarrez le service pour en régénérer un
(ou utilisez « Mot de passe oublié » si le SMTP est configuré).

## 6. HTTPS — reverse proxy

### Option A — Caddy (le plus simple, certificat automatique)

`/etc/caddy/Caddyfile` :

```
intranet.edg.com.gn {
    encode gzip zstd
    reverse_proxy 127.0.0.1:8000
}
```

Caddy obtient et renouvelle le certificat Let's Encrypt tout seul. C'est tout.

### Option B — nginx (+ certbot pour le certificat)

```nginx
server {
    listen 443 ssl http2;
    server_name intranet.edg.com.gn;

    ssl_certificate     /etc/letsencrypt/live/intranet.edg.com.gn/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/intranet.edg.com.gn/privkey.pem;

    client_max_body_size 12m;         # autorise les uploads (docs 10 Mo)
    gzip on;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;   # important pour le limiteur anti force-brute
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
server {
    listen 80;
    server_name intranet.edg.com.gn;
    return 301 https://$host$request_uri;    # force HTTPS
}
```

## 7. Sauvegardes (à planifier via cron)

```bash
# Base de données (quotidien)
mysqldump -u edg_app -p edg_intranet | gzip > /backups/edg_$(date +\%F).sql.gz
# Fichiers téléversés
tar czf /backups/uploads_$(date +\%F).tar.gz /opt/edg-intranet/public/uploads
```

---

## Checklist de mise en ligne

- [ ] `APP_ENV=production`, `JWT_SECRET_KEY` fort, `COOKIE_SECURE=true`, `CORS_ORIGINS` = domaine réel
- [ ] `ADMIN_EMAIL` défini (adresse de l'administrateur initial)
- [ ] MySQL : utilisateur dédié (pas root), mot de passe fort
- [ ] `npm run build` effectué (dossier `dist/` présent)
- [ ] Reverse proxy HTTPS actif (Caddy ou nginx) — le port 8000 n'est PAS exposé publiquement
- [ ] `/docs` renvoie bien 404 en production
- [ ] **Mot de passe admin initial** récupéré dans les logs et changé dès la 1re connexion
- [ ] Aucun compte de démo présent (`SELECT email FROM users;` ne doit lister que l'admin)
- [ ] Sauvegardes planifiées (base + uploads)
- [ ] (Optionnel) SMTP configuré pour « mot de passe oublié » (sinon le lien est seulement journalisé)
```
