import os
import json
import sqlite3
import datetime
import secrets
from dotenv import load_dotenv
from api.auth import hash_password

# Charge les variables du fichier .env (DB_TYPE, MYSQL_*) situe a la racine du projet
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

# Chemins absolus
API_DIR = os.path.dirname(os.path.abspath(__file__))
# Chemin de la base SQLite (repli). Surchargéable via SQLITE_DB_PATH (utilisé par les tests
# automatisés pour travailler sur une base temporaire isolée, jamais la base de dev/prod).
DB_PATH = os.getenv("SQLITE_DB_PATH", os.path.join(API_DIR, "edg_intranet.db"))
UPLOAD_DIR = os.path.join(os.path.dirname(API_DIR), "public", "uploads")

# S'assurer que le dossier des téléversements existe au niveau de public/uploads
os.makedirs(UPLOAD_DIR, exist_ok=True)

# APP_ENV pilote le durcissement (voir aussi api/main.py). En "production", on ne crée
# jamais les comptes de démonstration à mots de passe connus (voir le seed plus bas).
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
IS_PROD = APP_ENV == "production"


class DatabaseCursorWrapper:
    def __init__(self, raw_cursor, is_mysql=False):
        self.raw_cursor = raw_cursor
        self.is_mysql = is_mysql

    def execute(self, query, params=None):
        if self.is_mysql:
            # Remplacer les placeholders '?' par '%s' pour MySQL
            query = query.replace('?', '%s')
            
            # Gérer les différences de syntaxe SQLite / MySQL
            if "ON CONFLICT" in query:
                # SQLite: ON CONFLICT(key) DO UPDATE SET value = excluded.value
                # MySQL: ON DUPLICATE KEY UPDATE value = VALUES(value)
                query = query.replace(
                    "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    "ON DUPLICATE KEY UPDATE value = VALUES(value)"
                )
                query = query.replace(
                    "ON CONFLICT (key) DO UPDATE SET value = excluded.value",
                    "ON DUPLICATE KEY UPDATE value = VALUES(value)"
                )
                
            # 'key' est un mot réservé MySQL, l'encadrer de backticks si nécessaire
            if "settings (key" in query:
                query = query.replace("settings (key", "settings (`key`")
            if "SELECT key, value" in query:
                query = query.replace("SELECT key, value", "SELECT `key`, value")
        
        if params is None:
            return self.raw_cursor.execute(query)
        else:
            return self.raw_cursor.execute(query, params)

    def executemany(self, query, params_list):
        if self.is_mysql:
            query = query.replace('?', '%s')
        return self.raw_cursor.executemany(query, params_list)

    def fetchone(self):
        row = self.raw_cursor.fetchone()
        if row is None:
            return None
        if not self.is_mysql:
            # Convertir la ligne sqlite3.Row en dictionnaire
            return dict(row)
        return row

    def fetchall(self):
        rows = self.raw_cursor.fetchall()
        if not self.is_mysql:
            return [dict(r) for r in rows]
        return rows

    @property
    def lastrowid(self):
        return self.raw_cursor.lastrowid


class DatabaseConnectionWrapper:
    def __init__(self, raw_conn, is_mysql=False):
        self.raw_conn = raw_conn
        self.is_mysql = is_mysql

    def cursor(self):
        return DatabaseCursorWrapper(self.raw_conn.cursor(), self.is_mysql)

    def commit(self):
        self.raw_conn.commit()

    def rollback(self):
        self.raw_conn.rollback()

    def close(self):
        self.raw_conn.close()


# Pool de connexions MySQL (créé une seule fois, réutilisé pour toutes les requêtes) : évite
# d'ouvrir/fermer une connexion à chaque appel API — gros gain de latence.
_mysql_pool = None


def _build_mysql_pool():
    import pymysql
    import pymysql.cursors
    from dbutils.pooled_db import PooledDB

    host = os.getenv("MYSQL_HOST", "localhost")
    port = int(os.getenv("MYSQL_PORT", "3306"))
    user = os.getenv("MYSQL_USER", "root")
    password = os.getenv("MYSQL_PASSWORD", "")
    database = os.getenv("MYSQL_DATABASE", "edg_intranet")

    # Crée la base si elle n'existe pas encore (UNE SEULE FOIS, à la construction du pool).
    conn_init = pymysql.connect(
        host=host, port=port, user=user, password=password,
        cursorclass=pymysql.cursors.DictCursor
    )
    try:
        cur = conn_init.cursor()
        cur.execute(
            f"CREATE DATABASE IF NOT EXISTS `{database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        conn_init.commit()
    finally:
        conn_init.close()

    return PooledDB(
        creator=pymysql,
        maxconnections=20,   # plafond de connexions simultanées
        mincached=2,         # connexions gardées prêtes au repos
        maxcached=8,
        blocking=True,       # si le plafond est atteint : attendre plutôt qu'échouer
        ping=1,              # ping (+ reconnexion) avant chaque usage -> évite "MySQL server has gone away"
        host=host, port=port, user=user, password=password, database=database,
        cursorclass=pymysql.cursors.DictCursor, autocommit=False,
    )


def get_db_connection():
    """
    Génère une connexion à la base de données.

    - DB_TYPE=mysql (défaut, application réelle) : MySQL UNIQUEMENT. En cas d'échec de connexion,
      on lève une erreur claire — PAS de repli silencieux sur SQLite (qui provoquait des données
      « fantômes » réparties entre deux bases selon que XAMPP tournait ou non).
    - DB_TYPE=sqlite (réservé aux tests automatisés) : base SQLite isolée via SQLITE_DB_PATH.
    """
    db_type = os.getenv("DB_TYPE", "mysql").lower()

    if db_type == "sqlite":
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        return DatabaseConnectionWrapper(conn, is_mysql=False)

    # --- MySQL (XAMPP) via POOL de connexions ---
    global _mysql_pool
    try:
        if _mysql_pool is None:
            _mysql_pool = _build_mysql_pool()
        conn = _mysql_pool.connection()   # emprunte une connexion au pool (rendue automatiquement au close())
        return DatabaseConnectionWrapper(conn, is_mysql=True)
    except Exception as e:
        raise RuntimeError(
            f"Connexion MySQL impossible ({e}). Démarrez MySQL dans XAMPP avant de lancer l'application "
            f"(aucun repli sur SQLite en mode application)."
        )


def create_user_notification(cursor, user_id: int, notif_type: str, title: str, message: str) -> None:
    """
    Insère une notification personnelle temps réel pour un utilisateur donné.
    `notif_type` est un identifiant libre (ex: 'ticket_new', 'ticket_status', 'article_new',
    'account_new') interprété côté API/frontend pour choisir l'icône et la catégorie d'affichage ;
    de nouveaux types (ex: 'conge_pending') pourront être ajoutés sans migration de schéma.
    """
    cursor.execute("""
        INSERT INTO user_notifications (user_id, type, title, message)
        VALUES (?, ?, ?, ?)
    """, (user_id, notif_type, title, message))


def notify_users_for_department(cursor, department_id, notif_type: str, title: str, message: str, roles=('chef_service', 'rh_direction', 'administrateur'), exclude_user_id=None) -> None:
    """
    Notifie tous les utilisateurs habilités sur `department_id` (même règle de cloisonnement que
    can_write_department côté auth.py) : administrateur (toujours), rh_direction central
    (unity_id NULL), et chef_service/rh_direction rattachés à cette direction précise.
    """
    placeholders = ",".join(["?"] * len(roles))
    cursor.execute(f"SELECT id, role, unity_id FROM users WHERE role IN ({placeholders})", roles)
    for row in cursor.fetchall():
        uid = row["id"] if isinstance(row, dict) else row[0]
        role = row["role"] if isinstance(row, dict) else row[1]
        unity_id = row["unity_id"] if isinstance(row, dict) else row[2]
        if exclude_user_id is not None and uid == exclude_user_id:
            continue
        eligible = (
            role == 'administrateur'
            or (role == 'rh_direction' and unity_id is None)
            or (role in ('chef_service', 'rh_direction') and unity_id is not None and department_id is not None and int(unity_id) == int(department_id))
        )
        if eligible:
            create_user_notification(cursor, uid, notif_type, title, message)


def init_db():
    """Initialise l'ensemble du schéma de base de données à 10 tables si elle n'existe pas encore."""
    conn = get_db_connection()
    is_mysql = conn.is_mysql
    cursor = conn.cursor()

    if is_mysql:
        # 1. content_type
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS content_type (
            id INT PRIMARY KEY,
            label VARCHAR(255) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 2. type_news
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS type_news (
            id INT PRIMARY KEY,
            label VARCHAR(255) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 3. type_projet
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS type_projet (
            id INT PRIMARY KEY,
            label VARCHAR(255) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 4. unity (avec attributs additionnels pour l'administration et le design d'EDG)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS unity (
            id INT AUTO_INCREMENT PRIMARY KEY,
            label VARCHAR(255) NOT NULL,
            code VARCHAR(100) NOT NULL UNIQUE,       -- ex: 'dsi', 'rh'
            type VARCHAR(64) NOT NULL DEFAULT 'Direction',  -- Direction / Département / Service…
            description TEXT,                       -- Chapeau descriptif
            icon VARCHAR(100) DEFAULT 'Layers',
            director_name VARCHAR(255) NOT NULL,    -- Nom du directeur
            founded_year INT DEFAULT 1987,
            staff_count INT DEFAULT 10,
            theme_color VARCHAR(50) DEFAULT 'emerald',
            parent_id INT,                          -- entité parente (NULL = racine) : hiérarchie directions/services/départements
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES unity(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 4b. poste (organigramme : arbre des POSTES/fonctions, pas des personnes)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS poste (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,           -- intitulé du poste (ex: Directeur des Systèmes d'Information)
            unity_id INT,                          -- direction/service de rattachement (NULL possible)
            parent_id INT,                         -- poste supérieur (NULL = racine, ex: Directeur Général)
            occupant_name VARCHAR(255),            -- personne occupant le poste (OPTIONNEL, indicatif)
            occupant_email VARCHAR(255),
            ordre INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE SET NULL,
            FOREIGN KEY (parent_id) REFERENCES poste(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 4c. workflow : contextes d'organigramme (ex: "Organigramme Général", "Validation Application").
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS workflow (
            id INT AUTO_INCREMENT PRIMARY KEY,
            label VARCHAR(255) NOT NULL,           -- nom du contexte / de l'organigramme
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 4d. organigramme_node : place une entité (unity) dans un workflow, avec SON parent DANS ce workflow.
        #     La même entité peut avoir un parent DIFFÉRENT selon le workflow (hiérarchie contextuelle).
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS organigramme_node (
            id INT AUTO_INCREMENT PRIMARY KEY,
            workflow_id INT NOT NULL,
            unit_id INT NOT NULL,                  -- l'entité placée dans ce workflow
            parent_unit_id INT,                    -- son parent DANS ce workflow (NULL = racine)
            ordre INT DEFAULT 0,
            UNIQUE KEY uq_workflow_unit (workflow_id, unit_id),
            FOREIGN KEY (workflow_id) REFERENCES workflow(id) ON DELETE CASCADE,
            FOREIGN KEY (unit_id) REFERENCES unity(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_unit_id) REFERENCES unity(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 5. content
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS content (
            id INT AUTO_INCREMENT PRIMARY KEY,
            unity_id INT NOT NULL,
            description TEXT,
            summary TEXT,
            image VARCHAR(255) DEFAULT '',
            label VARCHAR(255) DEFAULT '',
            type INT NOT NULL,                      -- FK vers content_type
            ordre INT DEFAULT 0,
            icone VARCHAR(100) DEFAULT '',
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
            FOREIGN KEY (type) REFERENCES content_type(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 6. news (Actualités)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS news (
            id INT AUTO_INCREMENT PRIMARY KEY,
            unity_id INT,
            label VARCHAR(255) NOT NULL,
            excerpt TEXT,                           -- Chapeau synthétique (distinct du corps)
            description TEXT NOT NULL,              -- Corps complet (HTML riche CKEditor)
            images TEXT,                            -- Liste d'images ou une seule image
            files TEXT,                             -- Documents joints (JSON [{name, url}])
            type INT NOT NULL,                      -- FK vers type_news
            category VARCHAR(50) NOT NULL DEFAULT 'communique',  -- Catégorie d'annonce (communique, deces, mariage, naissance...)
            created_at VARCHAR(100) NOT NULL,       -- ISO String format
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
            FOREIGN KEY (type) REFERENCES type_news(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 7. projet (Projets)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS projet (
            id INT AUTO_INCREMENT PRIMARY KEY,
            unity_id INT NOT NULL,
            label VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            image TEXT,                             -- Image(s) du projet
            date_debut VARCHAR(100) NOT NULL,
            date_fin VARCHAR(100) NOT NULL,
            niveau VARCHAR(100) DEFAULT 'En cours',
            type_id INT NOT NULL,                   -- FK vers type_projet
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
            FOREIGN KEY (type_id) REFERENCES type_projet(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 8. recipient
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS recipient (
            id INT AUTO_INCREMENT PRIMARY KEY,
            id_unity INT NOT NULL,
            email VARCHAR(255) NOT NULL,
            numero VARCHAR(100),
            raison TEXT,
            FOREIGN KEY (id_unity) REFERENCES unity(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 9. contact
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS contact (
            id INT AUTO_INCREMENT PRIMARY KEY,
            id_recipient INT NOT NULL,
            email VARCHAR(255),
            numero VARCHAR(100),
            FOREIGN KEY (id_recipient) REFERENCES recipient(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 11. settings table (Paramètres généraux de l'Intranet)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            `key` VARCHAR(255) PRIMARY KEY,
            value TEXT NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 12. applications table (Applications métiers)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT NOT NULL,
            url VARCHAR(512) NOT NULL,
            icon VARCHAR(100) DEFAULT 'ExternalLink',
            logo_url VARCHAR(512) NULL,
            is_global TINYINT(1) DEFAULT 0,
            category VARCHAR(100) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 13. unity_applications relation table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS unity_applications (
            unity_id INT NOT NULL,
            application_id INT NOT NULL,
            PRIMARY KEY (unity_id, application_id),
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
            FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 14. team_members table (fiches individuelles de l'organigramme)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS team_members (
            id INT AUTO_INCREMENT PRIMARY KEY,
            unity_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            role VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            bio TEXT,
            responsibilities JSON,
            hierarchy_order INT DEFAULT 10,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 15. tickets table (signalements d'incident / demandes de contact)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tickets (
            id VARCHAR(50) PRIMARY KEY,
            type VARCHAR(20) NOT NULL,
            sender_name VARCHAR(255) NOT NULL,
            sender_email VARCHAR(255) NOT NULL,
            subject VARCHAR(255) NOT NULL,
            message TEXT NOT NULL,
            unity_id INT,
            created_at VARCHAR(100) NOT NULL,
            status VARCHAR(50) DEFAULT 'Nouveau',
            priority VARCHAR(20),
            submitter_user_id INT,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)


        # 17. dashboard table (indicateurs KPI et graphique de performance par direction)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS dashboard (
            id INT AUTO_INCREMENT PRIMARY KEY,
            unity_id INT NOT NULL UNIQUE,
            title VARCHAR(255) NOT NULL,
            subtitle TEXT,
            chart_type VARCHAR(20) DEFAULT 'area',
            kpis TEXT,                              -- JSON [{label, value, sub, icon}]
            series TEXT,                            -- JSON [{key, label, color}]
            chart_data TEXT,                        -- JSON [{name, <seriesKey>: number, ...}]
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 18. users table (comptes d'authentification de l'intranet)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password_hash VARCHAR(255) NOT NULL,
            role VARCHAR(20) NOT NULL DEFAULT 'agent',
            unity_id INT,
            department_name VARCHAR(255),
            department_code VARCHAR(100),
            title VARCHAR(255),
            failed_login_attempts INT NOT NULL DEFAULT 0,
            locked_until VARCHAR(40),
            last_login_at VARCHAR(40),
            password_changed_at VARCHAR(40),
            must_change_password TINYINT NOT NULL DEFAULT 0,
            reset_token_hash VARCHAR(64),
            reset_expires VARCHAR(40),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 18b. auth_audit_log (journal d'audit sécurité : connexions, déconnexions, blocages, changements de mot de passe)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS auth_audit_log (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            email VARCHAR(255),
            event_type VARCHAR(40) NOT NULL,
            ip VARCHAR(64),
            user_agent VARCHAR(400),
            created_at VARCHAR(40) NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 19. documents table (bibliothèque GED : notes de service, directives, modèles, formulaires)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(500) NOT NULL,
            category VARCHAR(100) NOT NULL,
            unity_id INT,
            author VARCHAR(255),
            file_url VARCHAR(500) NOT NULL,
            file_size INT DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 20. user_notifications table (notifications personnelles temps réel par utilisateur)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_notifications (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            type VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            message VARCHAR(500) NOT NULL,
            is_read TINYINT(1) DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

        # 21. events table (agenda institutionnel : réunions et événements des directions)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            type VARCHAR(50) NOT NULL,
            unity_id INT,
            event_date DATE NOT NULL,
            event_time VARCHAR(50),
            location VARCHAR(255),
            host VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE SET NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
        """)

    else:
        # SQLite standard (10 tables)

        # 1. content_type
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS content_type (
            id INTEGER PRIMARY KEY,
            label TEXT NOT NULL
        );
        """)

        # 2. type_news
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS type_news (
            id INTEGER PRIMARY KEY,
            label TEXT NOT NULL
        );
        """)

        # 3. type_projet
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS type_projet (
            id INTEGER PRIMARY KEY,
            label TEXT NOT NULL
        );
        """)

        # 4. unity
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS unity (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            code TEXT NOT NULL UNIQUE,       -- ex: 'dsi', 'rh'
            type TEXT NOT NULL DEFAULT 'Direction',  -- Direction / Département / Service…
            description TEXT,               -- Chapeau descriptif
            icon TEXT DEFAULT 'Layers',
            director_name TEXT NOT NULL,    -- Nom du directeur
            founded_year INTEGER DEFAULT 1987,
            staff_count INTEGER DEFAULT 10,
            theme_color TEXT DEFAULT 'emerald',
            parent_id INTEGER,                      -- entité parente (NULL = racine) : hiérarchie directions/services/départements
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (parent_id) REFERENCES unity(id) ON DELETE SET NULL
        );
        """)

        # 4b. poste (organigramme : arbre des POSTES/fonctions, pas des personnes)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS poste (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            unity_id INTEGER,
            parent_id INTEGER,
            occupant_name TEXT,
            occupant_email TEXT,
            ordre INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE SET NULL,
            FOREIGN KEY (parent_id) REFERENCES poste(id) ON DELETE SET NULL
        );
        """)

        # 4c. workflow : contextes d'organigramme (ex: "Organigramme Général", "Validation Application").
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS workflow (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            label TEXT NOT NULL,
            description TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 4d. organigramme_node : place une entité (unity) dans un workflow, avec SON parent DANS ce workflow.
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS organigramme_node (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            workflow_id INTEGER NOT NULL,
            unit_id INTEGER NOT NULL,
            parent_unit_id INTEGER,
            ordre INTEGER DEFAULT 0,
            UNIQUE (workflow_id, unit_id),
            FOREIGN KEY (workflow_id) REFERENCES workflow(id) ON DELETE CASCADE,
            FOREIGN KEY (unit_id) REFERENCES unity(id) ON DELETE CASCADE,
            FOREIGN KEY (parent_unit_id) REFERENCES unity(id) ON DELETE SET NULL
        );
        """)

        # 5. content
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS content (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unity_id INTEGER NOT NULL,
            description TEXT,
            summary TEXT,
            image TEXT DEFAULT '',
            label TEXT DEFAULT '',
            type INTEGER NOT NULL,
            ordre INTEGER DEFAULT 0,
            icone TEXT DEFAULT '',
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
            FOREIGN KEY (type) REFERENCES content_type(id) ON DELETE CASCADE
        );
        """)

        # 6. news
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS news (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unity_id INTEGER,
            label TEXT NOT NULL,
            excerpt TEXT,
            description TEXT NOT NULL,
            images TEXT,
            files TEXT,
            type INTEGER NOT NULL,
            category TEXT NOT NULL DEFAULT 'communique',
            created_at TEXT NOT NULL,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
            FOREIGN KEY (type) REFERENCES type_news(id) ON DELETE CASCADE
        );
        """)

        # 7. projet
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS projet (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unity_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            description TEXT NOT NULL,
            image TEXT,
            date_debut TEXT NOT NULL,
            date_fin TEXT NOT NULL,
            niveau TEXT DEFAULT 'En cours',
            type_id INTEGER NOT NULL,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
            FOREIGN KEY (type_id) REFERENCES type_projet(id) ON DELETE CASCADE
        );
        """)

        # 8. recipient
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS recipient (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_unity INTEGER NOT NULL,
            email TEXT NOT NULL,
            numero TEXT,
            raison TEXT,
            FOREIGN KEY (id_unity) REFERENCES unity(id) ON DELETE CASCADE
        );
        """)

        # 9. contact
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS contact (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_recipient INTEGER NOT NULL,
            email TEXT,
            numero TEXT,
            FOREIGN KEY (id_recipient) REFERENCES recipient(id) ON DELETE CASCADE
        );
        """)

        # 11. settings
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        """)

        # 12. applications
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT NOT NULL,
            url TEXT NOT NULL,
            icon TEXT DEFAULT 'ExternalLink',
            logo_url TEXT,
            is_global BOOLEAN DEFAULT 0,
            category TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # 13. unity_applications
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS unity_applications (
            unity_id INTEGER NOT NULL,
            application_id INTEGER NOT NULL,
            PRIMARY KEY (unity_id, application_id),
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
            FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
        );
        """)

        # 14. team_members (fiches individuelles de l'organigramme)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS team_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unity_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            bio TEXT,
            responsibilities TEXT,
            hierarchy_order INTEGER DEFAULT 10,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE
        );
        """)

        # 15. tickets (signalements d'incident / demandes de contact)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS tickets (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            sender_name TEXT NOT NULL,
            sender_email TEXT NOT NULL,
            subject TEXT NOT NULL,
            message TEXT NOT NULL,
            unity_id INTEGER,
            created_at TEXT NOT NULL,
            status TEXT DEFAULT 'Nouveau',
            priority TEXT,
            submitter_user_id INTEGER,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE SET NULL
        );
        """)

        # 17. dashboard (indicateurs KPI et graphique de performance par direction)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS dashboard (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            unity_id INTEGER NOT NULL UNIQUE,
            title TEXT NOT NULL,
            subtitle TEXT,
            chart_type TEXT DEFAULT 'area',
            kpis TEXT,
            series TEXT,
            chart_data TEXT,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE
        );
        """)

        # 18. users (comptes d'authentification de l'intranet)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'agent',
            unity_id INTEGER,
            department_name TEXT,
            department_code TEXT,
            title TEXT,
            failed_login_attempts INTEGER NOT NULL DEFAULT 0,
            locked_until TEXT,
            last_login_at TEXT,
            password_changed_at TEXT,
            must_change_password INTEGER NOT NULL DEFAULT 0,
            reset_token_hash TEXT,
            reset_expires TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE SET NULL
        );
        """)

        # 18b. auth_audit_log (journal d'audit sécurité : connexions, déconnexions, blocages, changements de mot de passe)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS auth_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            email TEXT,
            event_type TEXT NOT NULL,
            ip TEXT,
            user_agent TEXT,
            created_at TEXT NOT NULL
        );
        """)

        # 19. documents (bibliothèque GED : notes de service, directives, modèles, formulaires)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            category TEXT NOT NULL,
            unity_id INTEGER,
            author TEXT,
            file_url TEXT NOT NULL,
            file_size INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE SET NULL
        );
        """)

        # 20. user_notifications (notifications personnelles temps réel par utilisateur)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_notifications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            is_read INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        """)

        # 21. events (agenda institutionnel : réunions et événements des directions)
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            type TEXT NOT NULL,
            unity_id INTEGER,
            event_date TEXT NOT NULL,
            event_time TEXT,
            location TEXT,
            host TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE SET NULL
        );
        """)

    # Migration idempotente : ajout de news.excerpt si la table existait deja sans cette colonne
    try:
        if is_mysql:
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'news' AND column_name = 'excerpt'
            """)
            res = cursor.fetchone()
            has_excerpt = (res["cnt"] if isinstance(res, dict) else res[0]) > 0
            if not has_excerpt:
                cursor.execute("ALTER TABLE news ADD COLUMN excerpt TEXT AFTER label")
        else:
            cursor.execute("PRAGMA table_info(news)")
            cols = [row["name"] if isinstance(row, dict) else row[1] for row in cursor.fetchall()]
            if "excerpt" not in cols:
                cursor.execute("ALTER TABLE news ADD COLUMN excerpt TEXT")
    except Exception as e:
        print(f"Migration news.excerpt ignoree : {e}")

    # Migration idempotente : ajout de news.category (categorie d'annonce : deces, mariage, naissance...)
    try:
        if is_mysql:
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'news' AND column_name = 'category'
            """)
            res = cursor.fetchone()
            has_category = (res["cnt"] if isinstance(res, dict) else res[0]) > 0
            if not has_category:
                cursor.execute("ALTER TABLE news ADD COLUMN category VARCHAR(50) NOT NULL DEFAULT 'communique' AFTER type")
        else:
            cursor.execute("PRAGMA table_info(news)")
            cols = [row["name"] if isinstance(row, dict) else row[1] for row in cursor.fetchall()]
            if "category" not in cols:
                cursor.execute("ALTER TABLE news ADD COLUMN category TEXT NOT NULL DEFAULT 'communique'")
    except Exception as e:
        print(f"Migration news.category ignoree : {e}")

    # Migration idempotente : ajout de users.unity_id si la table existait deja sans cette colonne
    try:
        if is_mysql:
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'users' AND column_name = 'unity_id'
            """)
            res = cursor.fetchone()
            has_unity_id = (res["cnt"] if isinstance(res, dict) else res[0]) > 0
            if not has_unity_id:
                cursor.execute("ALTER TABLE users ADD COLUMN unity_id INT NULL AFTER role")
                cursor.execute("ALTER TABLE users ADD CONSTRAINT fk_users_unity FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE SET NULL")
        else:
            cursor.execute("PRAGMA table_info(users)")
            cols = [row["name"] if isinstance(row, dict) else row[1] for row in cursor.fetchall()]
            if "unity_id" not in cols:
                cursor.execute("ALTER TABLE users ADD COLUMN unity_id INTEGER")
    except Exception as e:
        print(f"Migration users.unity_id ignoree : {e}")

    # Migration idempotente : ajout de applications.logo_url si la table existait deja sans cette colonne
    try:
        if is_mysql:
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'applications' AND column_name = 'logo_url'
            """)
            res = cursor.fetchone()
            has_logo_url = (res["cnt"] if isinstance(res, dict) else res[0]) > 0
            if not has_logo_url:
                cursor.execute("ALTER TABLE applications ADD COLUMN logo_url VARCHAR(512) NULL AFTER icon")
        else:
            cursor.execute("PRAGMA table_info(applications)")
            cols = [row["name"] if isinstance(row, dict) else row[1] for row in cursor.fetchall()]
            if "logo_url" not in cols:
                cursor.execute("ALTER TABLE applications ADD COLUMN logo_url TEXT")
    except Exception as e:
        print(f"Migration applications.logo_url ignoree : {e}")

    # Migration idempotente : colonnes de sécurité sur users (blocage, dernière connexion, âge du mot de passe)
    try:
        _now_iso = datetime.datetime.utcnow().isoformat()
        _security_cols = {
            "failed_login_attempts": ("INT NOT NULL DEFAULT 0", "INTEGER NOT NULL DEFAULT 0"),
            "locked_until": ("VARCHAR(40)", "TEXT"),
            "last_login_at": ("VARCHAR(40)", "TEXT"),
            "password_changed_at": ("VARCHAR(40)", "TEXT"),
            "must_change_password": ("TINYINT NOT NULL DEFAULT 0", "INTEGER NOT NULL DEFAULT 0"),
            "reset_token_hash": ("VARCHAR(64)", "TEXT"),
            "reset_expires": ("VARCHAR(40)", "TEXT"),
        }
        if is_mysql:
            cursor.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'users'
            """)
            existing = {(r["column_name"] if isinstance(r, dict) else r[0]) for r in cursor.fetchall()}
            for col, (mysql_type, _) in _security_cols.items():
                if col not in existing:
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {mysql_type}")
        else:
            cursor.execute("PRAGMA table_info(users)")
            existing = {(r["name"] if isinstance(r, dict) else r[1]) for r in cursor.fetchall()}
            for col, (_, sqlite_type) in _security_cols.items():
                if col not in existing:
                    cursor.execute(f"ALTER TABLE users ADD COLUMN {col} {sqlite_type}")
        # Backfill : démarre le compteur des 90 jours maintenant pour les comptes déjà présents
        cursor.execute("UPDATE users SET password_changed_at = ? WHERE password_changed_at IS NULL", (_now_iso,))
    except Exception as e:
        print(f"Migration users (colonnes securite) ignoree : {e}")

    # Migration idempotente : colonne unity.type (Direction/Département/Service…) et retrait de
    # l'ancienne table org_structure (remplacée par le modèle workflow / organigramme_node).
    try:
        if is_mysql:
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'unity' AND column_name = 'type'
            """)
            res = cursor.fetchone()
            has_type = (res["cnt"] if isinstance(res, dict) else res[0]) > 0
            if not has_type:
                cursor.execute("ALTER TABLE unity ADD COLUMN type VARCHAR(64) NOT NULL DEFAULT 'Direction' AFTER code")
        else:
            cursor.execute("PRAGMA table_info(unity)")
            cols = [row["name"] if isinstance(row, dict) else row[1] for row in cursor.fetchall()]
            if "type" not in cols:
                cursor.execute("ALTER TABLE unity ADD COLUMN type TEXT NOT NULL DEFAULT 'Direction'")
        cursor.execute("UPDATE unity SET type = 'Direction' WHERE type IS NULL OR type = ''")
        cursor.execute("DROP TABLE IF EXISTS org_structure")
    except Exception as e:
        print(f"Migration unity.type ignoree : {e}")

    # Migration idempotente : rattachement du ticket au compte connecté (notification fiable même si
    # l'email saisi diffère de l'email du compte).
    try:
        if is_mysql:
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'tickets' AND column_name = 'submitter_user_id'
            """)
            res = cursor.fetchone()
            has_col = (res["cnt"] if isinstance(res, dict) else res[0]) > 0
            if not has_col:
                cursor.execute("ALTER TABLE tickets ADD COLUMN submitter_user_id INT NULL")
        else:
            cursor.execute("PRAGMA table_info(tickets)")
            cols = [row["name"] if isinstance(row, dict) else row[1] for row in cursor.fetchall()]
            if "submitter_user_id" not in cols:
                cursor.execute("ALTER TABLE tickets ADD COLUMN submitter_user_id INTEGER")
    except Exception as e:
        print(f"Migration tickets.submitter_user_id ignoree : {e}")

    # Migration idempotente : hiérarchie des unités (organigramme) via parent_id auto-référent.
    try:
        if is_mysql:
            cursor.execute("""
                SELECT COUNT(*) as cnt FROM information_schema.columns
                WHERE table_schema = DATABASE() AND table_name = 'unity' AND column_name = 'parent_id'
            """)
            res = cursor.fetchone()
            has_col = (res["cnt"] if isinstance(res, dict) else res[0]) > 0
            if not has_col:
                cursor.execute("ALTER TABLE unity ADD COLUMN parent_id INT NULL")
                cursor.execute("ALTER TABLE unity ADD CONSTRAINT fk_unity_parent FOREIGN KEY (parent_id) REFERENCES unity(id) ON DELETE SET NULL")
        else:
            cursor.execute("PRAGMA table_info(unity)")
            cols = [row["name"] if isinstance(row, dict) else row[1] for row in cursor.fetchall()]
            if "parent_id" not in cols:
                cursor.execute("ALTER TABLE unity ADD COLUMN parent_id INTEGER")
    except Exception as e:
        print(f"Migration unity.parent_id ignoree : {e}")

    # Seed Content Types
    cursor.execute("SELECT COUNT(*) as cnt FROM content_type")
    res = cursor.fetchone()
    count = res["cnt"] if (res and isinstance(res, dict)) else (res[0] if res else 0)
    if count == 0:
        cursor.executemany("INSERT INTO content_type (id, label) VALUES (?, ?)", [
            (1, 'Présentation'),
            (2, 'Nos engagements'),
            (3, 'Nos valeurs'),
            (4, 'Nos missions'),
            (5, 'Organisation'),
            (6, 'Domaines d\'intervention'),
            (7, 'Historique')
        ])
    else:
        # Migration idempotente pour les bases deja seedees avant l'ajout de ces 2 rubriques
        for ct_id, ct_label in [(6, 'Domaines d\'intervention'), (7, 'Historique')]:
            cursor.execute("SELECT id FROM content_type WHERE id = ?", (ct_id,))
            if not cursor.fetchone():
                cursor.execute("INSERT INTO content_type (id, label) VALUES (?, ?)", (ct_id, ct_label))

    # Seed News Types
    cursor.execute("SELECT COUNT(*) as cnt FROM type_news")
    res = cursor.fetchone()
    count = res["cnt"] if (res and isinstance(res, dict)) else (res[0] if res else 0)
    if count == 0:
        cursor.executemany("INSERT INTO type_news (id, label) VALUES (?, ?)", [
            (1, 'Global'),
            (2, 'Local')
        ])

    # Seed Project Types
    cursor.execute("SELECT COUNT(*) as cnt FROM type_projet")
    res = cursor.fetchone()
    count = res["cnt"] if (res and isinstance(res, dict)) else (res[0] if res else 0)
    if count == 0:
        cursor.executemany("INSERT INTO type_projet (id, label) VALUES (?, ?)", [
            (1, 'Énergie'),
            (2, 'Digital'),
            (3, 'Infrastructure')
        ])

    # Seed Unities (Directions)
    cursor.execute("SELECT COUNT(*) as cnt FROM unity")
    res = cursor.fetchone()
    count = res["cnt"] if (res and isinstance(res, dict)) else (res[0] if res else 0)
    if count == 0:
        directions_data = [
            (1, 'Direction des Achats, Approvisionnement et Logistique', 'logistique', "Gère les acquisitions stratégiques, optimise les stocks de matériel critique (câbles, transformateurs) et pilote la flotte logistique de l'EDG.", 'Truck', 'M. Ibrahima Diallo', 2005, 84, 'amber', None),
            (2, 'Direction des Affaires Financières', 'finance', "Garantit la rigueur budgétaire, gère la comptabilité générale, la trésorerie et structure le financement des grands projets d'infrastructure d'énergie.", 'Briefcase', 'M. Sékou Condé', 1987, 45, 'emerald', None),
            (3, 'Direction des Affaires Juridiques et Contentieux', 'juridique', "Assure la conformité légale de l'EDG, rédige les conventions de partenariat commercial, de concession et gère les litiges judiciaires et assurances.", 'FileText', 'Mme Fatoumata Binta Diallo', 1994, 18, 'indigo', None),
            (4, "Direction de l'Audit Interne", 'audit', "Évalue de manière indépendante les risques opérationnels, la conformité des processus financiers et l'efficacité des procédures de l'EDG.", 'Search', 'M. Mamadou Saliou Sow', 2011, 14, 'slate', None),
            (5, 'Direction Commerciale', 'commercial', "Gère les contrats, la facturation des clients basse et moyenne tension, le déploiement des compteurs prépayés et la relation clientèle nationale.", 'Users', 'M. Lamine Camara', 1987, 382, 'red', None),
            (6, 'Direction de la Distribution', 'distribution', "Supervise l'acheminement final de l'électricité, la commande des réseaux locaux basse tension et la maintenance de proximité du réseau urbain.", 'Zap', 'M. Ansoumane Touré', 1987, 410, 'orange', None),
            (7, 'Direction des Études, Planification et Équipements', 'etudes', "Planifie le développement à long terme du réseau national, réalise les études d'impact et de faisabilité technique et coordonne l'installation d'équipements lourds.", 'TrendingUp', 'Mme Sylla Hadja Camara', 2002, 38, 'teal', None),
            (8, "Direction de la Maîtrise de la Demande et de l'Innovation", 'innovation', "Promeut l'efficacité énergétique, encadre les initiatives d'économies de consommation et pilote les projets de transition innovants d'EDG.", 'Sparkles', 'M. Mohamed Lamine Sylla', 2018, 22, 'violet', None),
            (9, 'Direction de la Production', 'production', "Gère l'exploitation et la maintenance des grands barrages hydroélectriques de Kaléta et Souapiti, ainsi que des centrales thermiques régionales.", 'Cpu', 'M. Ousmane Camara', 1987, 250, 'blue', None),
            (10, 'Direction des Ressources Humaines', 'rh', "Gère les compétences des collaborateurs électriciens de l'EDG, accompagne les carrières, administre la paie et veille à la santé et la formation professionnelle.", 'Users', 'Mme Mariama Barry', 1998, 47, 'emerald', None),
            (11, "Direction des Systèmes d'Information", 'dsi', "Pilote la transformation numérique de l'EDG, assure la haute disponibilité des infrastructures de communication, serveurs clouds et conçoit l'intranet.", 'Laptop', 'M. Amadou Diallo', 2012, 52, 'indigo', None),
            (12, 'Direction du Transport', 'transport', "Gère l'exploitation et la haute maintenance préventive des lignes aériennes haute tension (HTB) d'interconnexion régionale et nationale guinéenne.", 'Target', 'M. Alpha Kabiné Condé', 1991, 110, 'sky', None),
            (20, 'Service Infrastructures & Cybersécurité', 'dsi_infra', "Assure la disponibilité, la sécurité et la résilience des infrastructures réseaux, serveurs et systèmes critiques de l'EDG.", 'Server', 'M. Ibrahima Kourouma', 2013, 38, 'sky', 11),
            (21, 'Service Applications & Développement', 'dsi_apps', "Conçoit, intègre et maintient les applications métiers et portails collaboratifs pour l'ensemble des directions de l'EDG.", 'Cpu', 'Mme Aïssatou Keita', 2014, 34, 'violet', 11),
            (22, 'Service Support Informatique', 'dsi_support', "Pilote l’assistance technique, le helpdesk et la gestion des postes de travail pour tous les services de l’EDG.", 'Wrench', 'M. Fodé Camara', 2015, 42, 'emerald', 11),
            (23, 'Service Gouvernance & Architecture SI', 'dsi_arch', "Définit les standards, l’architecture et la gouvernance des systèmes d’information de l’EDG.", 'Layers', 'M. Mamadou Bah', 2016, 28, 'blue', 11)
        ]
        
        cursor.executemany("""
            INSERT INTO unity (id, label, code, description, icon, director_name, founded_year, staff_count, theme_color, parent_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, directions_data)

        # Seeding content associated with each Unity
        # Content format: (unity_id, description, summary, image, label, type_id, ordre, icone)
        contents_data = [
            # DSI (11)
            (11, "Assurer de façon dynamique l'excellence technologique de l'Électricité de Guinée en accompagnant chacun de nos métiers avec des services digitaux sécurisés et innovants.", "M. Amadou Diallo", "", "Mot du Directeur", 1, 1, ""),
            (11, "La responsabilité est une valeur clé qui reflète l'engagement de la DSI envers l'intégrité, la confidentialité et la fiabilité de toutes ses actions numériques.", "Responsabilité professionnelle", "", "Nos Valeurs", 3, 1, "ShieldCheck"),
            (11, "Fournir une infrastructure haute disponibilité", "Délivrer une connectivité stable de 99.9% sur les sites administratifs et techniques de l'EDG.", "", "Pilier 1", 4, 1, "Laptop"),
            (11, "Modernisation Applicative", "Déploiement progressif des ERP métiers (SAGE, Jira, portails collaboratifs) auprès de 100% des directions.", "", "Pilier 2", 4, 2, "Cpu"),

            # RH (10)
            (10, "L'humain est au cœur de notre énergie. La DRH s'engage à vous offrir un cadre de travail propice à l'épanouissement professionnel et au développement des talents.", "Mme Mariama Barry", "", "Mot de la Directrice", 1, 1, ""),
            (10, "Garantir l'égalité des opportunités de perfectionnement et une écoute active pour chaque agent de notre cher patrimoine guinéen pour sa carrière.", "Équité de valorisation", "", "Nos Valeurs", 3, 1, "Heart"),

            # Commercial (5)
            (5, "Améliorer l'expérience client et moderniser le recouvrement par les technologies de prépaiement intelligent sont au cœur de notre stratégie commerciale.", "M. Lamine Camara", "", "Mot du Directeur", 1, 1, ""),
            (5, "Mettre le consommateur guinéen au centre de nos attentions en lui offrant des outils de contrôle et des solutions simples d'approvisionnement.", "Proximité Clientèle", "", "Nos Valeurs", 3, 1, "Users"),

            # Distribution (6)
            (6, "Notre mission quotidienne est de maintenir le réseau moyenne et basse tension opérationnel pour livrer une énergie stable et sûre à chaque ménage guinéen.", "M. Ansoumane Touré", "", "Mot du Directeur", 1, 1, ""),
            (6, "Garantir un flux de distribution d'électricité stable et sécurisé à chaque recoin urbain ou périurbain de notre territoire.", "Équité de desserte", "", "Nos Valeurs", 3, 1, "Zap")
        ]

        # Add details for other departments as well
        other_depts_list = [1, 2, 3, 4, 7, 8, 9, 12]
        other_depts_details = {
            1: ("Assurer la disponibilité permanente du matériel technique pour nos équipes sur le terrain en République de Guinée est notre priorité absolue.", "M. Ibrahima Diallo", "Efficience opérationnelle", "L'efficience est notre boussole : optimiser chaque flux d'approvisionnement.", "Truck"),
            2: ("Une gestion saine et rigoureuse est le garant de la pérennité de notre institution.", "M. Sékou Condé", "Rigueur et Transparence", "La rigeur n'est pas une contrainte, c'est l'épine dorsale qui soutient l'autonomie.", "Briefcase"),
            3: ("La sécurité juridique de l'EDG SA et le respect scrupuleux des lois de la République sont les piliers de notre gouvernance.", "Mme Fatoumata Binta Diallo", "Conformité éthique", "Garantir la clarté contractuelle de tous nos partenariats.", "FileText"),
            4: ("L'audit interne est un outil précieux d'accompagnement de la performance.", "M. Mamadou Saliou Sow", "Indépendance et Rigueur", "Le contrôle objectif de nos procédures garantit l'alignement sur les meilleurs standards.", "Search"),
            7: ("Concevoir le réseau guinéen de demain en y planifiant des interconnexions résilientes constitue notre mandat.", "Mme Sylla Hadja Camara", "Innovation prospection", "Préparer l'infrastructure électrique du futur.", "TrendingUp"),
            8: ("Consommer intelligemment, c'est libérer de l'énergie pour les autres.", "M. Mohamed Lamine Sylla", "Efficacité Énergétique", "Inculquer l'importance des éco-gestes.", "Sparkles"),
            9: ("Maximiser la puissance de nos turbines nationales et veiller à une gestion hydrologique rigoureuse.", "M. Ousmane Camara", "Stabilité hydro-thermique", "Piloter en temps réel l'équilibre de charge.", "Cpu"),
            12: ("Sécuriser le transit de l'énergie à haute tension sur l'ensemble de nos grandes autoroutes.", "M. Alpha Kabiné Condé", "Sûreté des grandes lignes", "Un engagement absolu sur l'entretien.", "Target")
        }

        for d_id, data in other_depts_details.items():
            contents_data.append((d_id, data[0], data[1], "", "Mot du Directeur", 1, 1, ""))
            contents_data.append((d_id, data[3], data[2], "", "Nos Valeurs", 3, 1, data[4]))

        cursor.executemany("""
            INSERT INTO content (unity_id, description, summary, image, label, type, ordre, icone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, contents_data)

        # Seed News (Actualités)
        # format: (unity_id, label, description, images, files, type, created_at)
        news_data = [
            (None, "Modernisation des réseaux : Lancement de la phase 2 d'extension à Conakry et villes de l'intérieur", 
             "L'EDG entame une série d'investissements pour moderniser le réseau moyenne tension et réduire les coupures par surcharge.\n\nDans le cadre du programme de redressement de l'électricité guinéenne, le Conseil d'Administration de l'EDG a validé le déblocage des financements pour la phase 2 de la modernisation du réseau national. Ce projet prévoit le renouvellement de plus de 450 km de lignes de transport électrique moyenne tension, ainsi que le renforcement des postes sources à Conakry, Kindia, Mamou, Labé et Kankan. Les travaux débuteront ce trimestre et visent une stabilité accrue de l'approvisionnement en prévision de la prochaine saison hydrologique.",
             "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)", "", 1, "2026-06-28T09:30:00Z"),
            
            (None, "Lancement officiel de votre nouvel Intranet multi-département", 
             "Découvrez une plateforme de travail unifiée, rapide et en consultation libre, simplifiant l'accès à vos applications métiers.\n\nNous avons le plaisir de vous présenter la version définitive du nouvel Intranet collaboratif de l'Électricité de Guinée. Conçu pour lever tous les obstacles d'accès à l'information, cet intranet est en libre accès pour tous les employés connectés au réseau interne : zéro login fastidieux, zéro écran de blocage. Vous pouvez naviguer en un clic entre la DSI, les RH, la Finance, la Distribution, le Transport, etc. pour consulter les organigrammes, les fiches de missions, et surtout, lancer directement vos applications métiers.",
             "linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)", "", 1, "2026-06-30T08:00:00Z"),
            
            (None, "Sensibilisation Sécurité Informatique : Alerte Vigilance Phishing sur nos boîtes EDG", 
             "La DSI appelle à la vigilance face à des vagues de faux emails imitant notre messagerie interne. Adoptez les bons réflexes.\n\nPlusieurs attaques par hameçonnage (phishing) ciblant les serveurs de messagerie de l'EDG ont été interceptées ces dernières 48 heures. Ces messages frauduleux vous demandent de confirmer votre mot de passe sous peine de suspension de compte. Rappel important : l'équipe d'administration système et support de la DSI ne vous demandera JAMAIS votre mot de passe par courriel. En cas de doute, n'hésitez pas à signaler immédiatement le message suspect via le formulaire de signalement de la DSI.",
             "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)", "", 1, "2026-06-29T11:00:00Z"),
            
            (11, "Migration Cloud : Les serveurs métiers basculés avec succès vers le nouveau Data Center", 
             "Nos équipes d'ingénieurs système ont finalisé le transfert des bases de données de facturation dans le Cloud souverain.\n\nUne étape majeure de notre plan de résilience numérique a été franchie avec succès le week-end dernier. L'ensemble des serveurs hébergeant nos ERP et base de serveurs clients ont été migrés vers nos nouvelles infrastructures matérielles hautement sécurisées. Cette transition s'est déroulée en pleine nuit de sorte à minimiser l'impact sur nos clients et agences. Le taux de disponibilité des bases a gagné 15% grâce à l'implémentation de boucles de redondance active.",
             "linear-gradient(135deg, #1e293b 0%, #475569 100%)", "", 2, "2026-06-25T14:20:00Z"),
            
            (11, "Équipements informatiques : Distribution de 120 nouveaux ordinateurs de bureau pour les agences provinciales", 
             "Le déploiement se poursuit pour moderniser les postes de travail de nos collègues en dehors de Conakry.\n\nAfin de réduire le fossé de performance entre la capitale et les régions administratives, la DSI a initié un programme d'envergure d'octroi de matériel informatique neuf. 120 ordinateurs de bureau équipés des derniers outils collaboratifs ont été expédiés aux antennes locales. Les équipes de techniciens d'assistance se rendront sur place tout au long du mois pour finaliser l'installation physique et configurer la connectivité réseau VPN par satellite.",
             "linear-gradient(135deg, #312e81 0%, #4f46e5 100%)", "", 2, "2026-06-27T10:15:00Z"),
            
            (10, "Campagne annuelle d'évaluation 2026 : Calendrier et supports d'accompagnement", 
             "Retrouvez les guides méthodologiques de l'entretien annuel d'évaluation pour les managers et collaborateurs.\n\nLa campagne des entretiens annuels d'évaluations collectives et individuelles débutera le 15 juin prochain. C'est un moment d'échange privilégié pour dresser le bilan professionnel de l'année écoulée, définir vos futurs objectifs et exprimer vos désirs de monter en compétences et d'évolution professionnelle. Les formulaires officiels d'évaluation sont téléchargeables dès à présent dans la section 'Modèles de Documents' sur votre Portail RH dédié.",
             "linear-gradient(135deg, #022c22 0%, #0d9488 100%)", "", 2, "2026-06-28T09:00:00Z")
        ]

        # Separe le chapeau (excerpt) du corps (description) : les tuples ci-dessus
        # concatenaient historiquement "excerpt\n\ncorps" dans un seul champ.
        news_data_split = []
        for (unity_id, label, desc, images, files, type_, created_at) in news_data:
            if "\n\n" in desc:
                excerpt, body = desc.split("\n\n", 1)
            else:
                excerpt, body = "", desc
            news_data_split.append((unity_id, label, excerpt, body, images, files, type_, created_at))

        cursor.executemany("""
            INSERT INTO news (unity_id, label, excerpt, description, images, files, type, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, news_data_split)

        # Seed Projects
        # format: (unity_id, label, description, image, date_debut, date_fin, niveau, type_id)
        projet_data = [
            (11, "Modernisation de l'Intranet Collaboratif EDG S.A.", "Développement et intégration d'une plateforme de nouvelle génération en React et FastAPI pour interconnecter toutes les directions régionales et optimiser les workflows internes.", "https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=600&q=80", "2025-05-01", "2026-06-30", "Terminé", 2),
            (5, "Déploiement National des Compteurs Intelligents Prépayés", "Campagne à grande échelle pour équiper les ménages et commerces de Conakry en compteurs prépayés communicants de dernière génération afin de réduire les pertes commerciales.", "https://images.unsplash.com/photo-1590069261209-f8e9b8642343?auto=format&fit=crop&w=600&q=80", "2025-01-15", "2026-12-31", "En cours", 2),
            (6, "Extension et Renforcement du Réseau Basse/Moyenne Tension à Conakry", "Restructuration complète des postes de distribution de la ville de Conakry et remplacement des câbles de transit obsolètes pour stabiliser la tension de desserte.", "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?auto=format&fit=crop&w=600&q=80", "2024-06-01", "2027-02-15", "En cours", 1),
            (9, "Rénovation de la Centrale Hydroélectrique de Souapiti", "Maintenance lourde préventive des turbines et optimisation hydrologique des bassins pour maximiser la capacité disponible durant la période de pointe nationale.", "https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?auto=format&fit=crop&w=600&q=80", "2025-03-10", "2026-09-30", "Planifié", 3)
        ]

        cursor.executemany("""
            INSERT INTO projet (unity_id, label, description, image, date_debut, date_fin, niveau, type_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, projet_data)

        # Seed Recipients and Contacts
        # format: (id_unity, email, numero, raison)
        recipient_data = [
            (11, "dsi.support@edg.com.gn", "+224 624 39 62 14", "Assistance informatique, pannes de serveurs, création de comptes et assistance VPN."),
            (10, "rh.talent@edg.com.gn", "+224 622 14 42 01", "Recrutement, formation, fiches de paie et congés annuels.")
        ]
        cursor.executemany("""
            INSERT INTO recipient (id_unity, email, numero, raison)
            VALUES (?, ?, ?, ?)
        """, recipient_data)

        contact_data = [
            (1, "dsi.incidents@edg.com.gn", "+224 622 14 41 02"),
            (2, "rh.conges@edg.com.gn", "+224 622 14 42 02")
        ]
        cursor.executemany("""
            INSERT INTO contact (id_recipient, email, numero)
            VALUES (?, ?, ?)
        """, contact_data)

        # Seed Applications
        cursor.execute("""
        INSERT INTO applications (id, name, description, url, icon, is_global, category)
        VALUES 
        (1, 'Messagerie Outlook', 'Consultez vos courriels d''entreprise.', 'https://outlook.office.com', 'Mail', 1, 'Productivité'),
        (2, 'Microsoft Teams', 'Travail collaboratif et visioconférences.', 'https://teams.microsoft.com', 'Video', 1, 'Communication');
        """)

        # Bind DSI applications
        cursor.executemany("""
            INSERT INTO unity_applications (unity_id, application_id)
            VALUES (?, ?)
        """, [
            (11, 1),
            (11, 2)
        ])

        # Seed Team Members (fiches individuelles de l'organigramme)
        # format: (unity_id, name, role, email, phone, bio, responsibilities_json, hierarchy_order)
        team_members_data = [
            # DSI - unity_id 11
            (11, "M. Amadou Diallo", "Directeur des Systèmes d'Information", "amadou.diallo@edg.com.gn", "+224 624 39 62 141",
             "Fort de plus de 18 ans d'expérience nationale et internationale dans la direction de télécommunications, il coordonne toute la transformation digitale de l'EDG.",
             json.dumps(["Définition de la stratégie numérique nationale d'EDG", "Supervision des investissements applicatifs et cloud", "Conseil exécutif auprès du Conseil d'Administration de l'EDG"]), 1),
            (11, "Mme Fatoumata Sylla", "Responsable Infrastructures & Sécurité", "fatoumata.sylla@edg.com.gn", "+224 622 14 41 02",
             "Experte chevronnée en cybersécurité industrielle, elle supervise la disponibilité des réseaux, raccordements fibres et serveurs de Conakry.",
             json.dumps(["Garantie du taux de disponibilité des serveurs (Data Center)", "Gestion des boucles de redondance et liaison satellite VSAT", "Sensibilisation et protection active contre le phishing"]), 2),
            (11, "M. Ibrahima Sory Sow", "Responsable Applications & Développement", "isory.sow@edg.com.gn", "+224 622 14 41 03",
             "Ancien concepteur d'architectures logicielles, il gère l'installation de nos progiciels comptables SAGE, Jira, et du portail collaboratif.",
             json.dumps(["Intégration d'outils ERP métiers", "Développement continu des outils d'intranet collaboratifs", "Suivi des projets d'automatisation interne"]), 3),
            (11, "Mme Kadiatou Bah", "Chef de Support Informatique & Matériel", "kadia.bah@edg.com.gn", "+224 622 14 41 04",
             "À la tête du helpdesk DSI, elle orchestre la réparation, la distribution des 120 nouveaux ordinateurs régionaux, et la configuration bureautique.",
             json.dumps(["Gestion quotidienne du guichet d'assistance et helpdesk", "Planification des tournées informatiques provinciales", "Gestion de l'inventaire matériel bureautique"]), 4),

            # RH - unity_id 10
            (10, "Mme Mariama Barry", "Directrice des Ressources Humaines", "mariama.barry@edg.com.gn", "+224 622 14 42 01",
             "Engagée pour la formation des talents africains, elle manage la dotation en personnel de l'EDG SA avec une vision humaine.",
             json.dumps(["Politique générale d'embauche et de valorisation des salaires", "Veille de l'équilibre social interne et de l'écoute du personnel", "Déploiement des plans stratégiques de retraite et prévoyance"]), 1),
            (10, "M. Lamine Doumbouya", "Responsable Carrières & Recrutement", "lamine.doumbouya@edg.com.gn", "+224 622 14 42 02",
             "Spécialisé en ingénierie de dotation en personnel, il encadre l'accueil des nouveaux stagiaires, électriciens et techniciens de réseau.",
             json.dumps(["Instruction des fiches d'entretien annuel d'évaluation", "Orchestration des concours internes d'avancement de grades", "Gestion des dossiers d'intégration des diplômés techniques"]), 2),
            (10, "Mme Aïssatou Sow", "Gestionnaire Formation Continue & Mobilité", "aissatou.sow@edg.com.gn", "+224 622 14 42 03",
             "Formatrice de formation, elle négocie les accords éducatifs de notre école de métiers interne et supervise l'auto-formation en ligne.",
             json.dumps(["Définition du plan annuel d'apprentissage collectif", "Suivi du raccordement des boursiers universitaires d'ingénierie", "Mise à disposition des supports didactiques sur l'intralearning"]), 3),
            (10, "M. Thierno Diallo", "Médiateur Social & Hygiène Sécurité", "thierno.diallo@edg.com.gn", "+224 622 14 42 04",
             "Acteur de concertation engagé, il gère les relations de protection de la santé physique et coordonne les campagnes médicales bilans gratuits.",
             json.dumps(["Coordination avec les secrétariats médicaux et mutuelles sociales", "Sensibilisation aux équipements de sécurité de quartier", "Arbitrage amical des réclamations internes"]), 4),

            # Finance - unity_id 2
            (2, "M. Sékou Condé", "Directeur Financier et Comptable", "sekou.conde@edg.com.gn", "+224 622 14 43 01",
             "Régulateur financier d'expérience, il veille scrupuleusement au maintien de la solvabilité opérationnelle d'EDG et aux équilibres.",
             json.dumps(["Contrôle général des bilans financiers annuels consolidés", "Relations avec les institutions bancaires internationales", "Contrôle de conformité législatif fiscal de l'EDG"]), 1),
            (2, "Mme Aminata Keita", "Chef de la Comptabilité Générale", "aminata.keita@edg.com.gn", "+224 622 14 43 02",
             "Gardienne de la réglementation fiscale nationale, elle administre les flux d'écritures comptables et consolide la balance mensuelle.",
             json.dumps(["Ordonnancement des écritures comptables obligatoires", "Calcul et reversement des prélèvements légaux", "Saisie de la dématérialisation comptable sur SAGE ERP"]), 2),
            (2, "M. Alpha Oumar Barry", "Contrôleur Financier de Gestion", "alphaoumar.barry@edg.com.gn", "+224 622 14 43 03",
             "Maître d'analyse et d'élaboration des budgets par direction, il dote les décideurs de visibilité financière.",
             json.dumps(["Analyse mensuelle de l'exécution budgétaire des directions", "Modélisation financière prédictive sur l'outil Anaplan", "Production d'alertes de sur-dépenses"]), 3),
            (2, "Mme Hawa Camara", "Responsable Trésorerie & Factures Fournisseurs", "hawa.camara@edg.com.gn", "+224 622 14 43 04",
             "Chargée exclusive du dialogue factures avec les fournisseurs hydrauliques et carburants de l'EDG, elle fluidifie les décaissements.",
             json.dumps(["Arbitrage des priorités de décaissements d'urgence", "Contrôle de concordance avec les bons de réception techniques", "Optimisation du délai de règlement fournisseurs (Cible: 15 jours)"]), 4),
        ]
        cursor.executemany("""
            INSERT INTO team_members (unity_id, name, role, email, phone, bio, responsibilities, hierarchy_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, team_members_data)

    # S'assurer que les directions 13 (dg) et 14 (dgaae) existent bien en base de données
    for u_id, u_label, u_code, u_desc, u_icon, u_dir, u_year, u_staff, u_color in [
        (13, "Direction Générale", "dg", "Organe exécutif suprême de l'EDG S.A., pilotant les décisions stratégiques, la gouvernance globale de l'entreprise et la coordination des directions métiers.", "Shield", "Elhadj Gando Barry", 1987, 35, "emerald"),
        (14, "Direction Générale Adjointe de l'Amélioration et de l'Efficacité", "dgaae", "Structure vouée à la modernisation des processus de relèvement, d'amélioration continue des rendements réseaux et à la performance organisationnelle d'EDG.", "TrendingUp", "Mme Fanta Camara", 2024, 25, "slate")
    ]:
        cursor.execute("SELECT id FROM unity WHERE id = ?", (u_id,))
        if not cursor.fetchone():
            cursor.execute("""
                INSERT INTO unity (id, label, code, description, icon, director_name, founded_year, staff_count, theme_color)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (u_id, u_label, u_code, u_desc, u_icon, u_dir, u_year, u_staff, u_color))
            
            # Seeder les contenus associés à ces directions
            if u_id == 13:
                cursor.execute("""
                    INSERT INTO content (unity_id, description, summary, image, label, type, ordre, icone)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (13, "Notre mission éminente est de conduire la transformation structurelle de l'EDG, d'améliorer la desserte nationale en électricité et de consolider un modèle de performance durable.", "Elhadj Gando Barry", "", "Mot du Directeur", 1, 1, ""))
                cursor.execute("""
                    INSERT INTO content (unity_id, description, summary, image, label, type, ordre, icone)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (13, "La rigueur n'est pas une contrainte, c'est l'épine dorsale qui soutient l'autonomie et l'investissement de l'Électricité de Guinée.", "Rigueur et Transparence", "", "Nos Valeurs", 3, 1, "ShieldCheck"))
            elif u_id == 14:
                cursor.execute("""
                    INSERT INTO content (unity_id, description, summary, image, label, type, ordre, icone)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (14, "L'amélioration continue de nos processus et l'efficacité à tous les échelons de l'EDG sont les clés de voûte de notre épanouissement.", "Mme Fanta Camara", "", "Mot du Directeur", 1, 1, ""))
                cursor.execute("""
                    INSERT INTO content (unity_id, description, summary, image, label, type, ordre, icone)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, (14, "Transformer la gestion, optimiser les rendements et fluidifier l'expérience de nos agents et abonnés.", "Efficacité & Modernisation", "", "Nos Valeurs", 3, 1, "TrendingUp"))

    # Seed Dashboard (indicateurs KPI + graphique de performance par direction)
    # Idempotent : cree une ligne pour chaque unite existante qui n'en a pas encore.
    dashboard_by_code = {
        "dsi": (
            "Indicateurs de Performance SI & Cybersécurité",
            "Uptime des systèmes critiques d'EDG SA et volume mensuel des flux de support résolus",
            "area",
            [
                {"label": "Uptime Global", "value": "99.98%", "sub": "+0.02% ce trimestre", "icon": "Cpu"},
                {"label": "SLA Support", "value": "94.2%", "sub": "Résolution sous 3 heures", "icon": "ShieldAlert"},
                {"label": "Migration Cloud", "value": "85.0%", "sub": "6/7 progiciels migrés", "icon": "Server"}
            ],
            [
                {"key": "Incidents Résolus", "label": "Incidents Résolus", "color": "#f59e0b"},
                {"key": "Cyber-Attaques Bloquées", "label": "Attaques Bloquées (Dizaines)", "color": "#10b981"}
            ],
            [
                {"name": "Jan", "Incidents Résolus": 120, "Cyber-Attaques Bloquées": 45},
                {"name": "Fév", "Incidents Résolus": 135, "Cyber-Attaques Bloquées": 52},
                {"name": "Mar", "Incidents Résolus": 110, "Cyber-Attaques Bloquées": 49},
                {"name": "Avr", "Incidents Résolus": 145, "Cyber-Attaques Bloquées": 61},
                {"name": "Mai", "Incidents Résolus": 160, "Cyber-Attaques Bloquées": 58},
                {"name": "Juin", "Incidents Résolus": 172, "Cyber-Attaques Bloquées": 64}
            ]
        ),
        "production": (
            "Volume de Production d'Énergie Nationale",
            "Suivi des capacités de fourniture active (MW) des centrales d'EDG SA",
            "bar",
            [
                {"label": "Puissance Active", "value": "420 MW", "sub": "Capacité crête mesurée", "icon": "Zap"},
                {"label": "Remplissage Barrages", "value": "91.5%", "sub": "Kaléta & Souapiti nominaux", "icon": "Waves"},
                {"label": "Rendement Turbines", "value": "96.4%", "sub": "+1.2% après révision", "icon": "Gauge"}
            ],
            [
                {"key": "Hydraulique (MW)", "label": "Hydraulique (MW)", "color": "#0ea5e9"},
                {"key": "Thermique (MW)", "label": "Thermique (MW)", "color": "#ef4444"},
                {"key": "Solaire (MW)", "label": "Solaire (MW)", "color": "#eab308"}
            ],
            [
                {"name": "Jan", "Hydraulique (MW)": 280, "Thermique (MW)": 80, "Solaire (MW)": 10},
                {"name": "Fév", "Hydraulique (MW)": 290, "Thermique (MW)": 85, "Solaire (MW)": 12},
                {"name": "Mar", "Hydraulique (MW)": 310, "Thermique (MW)": 90, "Solaire (MW)": 15},
                {"name": "Avr", "Hydraulique (MW)": 350, "Thermique (MW)": 75, "Solaire (MW)": 18},
                {"name": "Mai", "Hydraulique (MW)": 390, "Thermique (MW)": 65, "Solaire (MW)": 22},
                {"name": "Juin", "Hydraulique (MW)": 420, "Thermique (MW)": 50, "Solaire (MW)": 25}
            ]
        ),
        "commercial": (
            "Rendement de Recouvrement & Prépaiement Intelligent",
            "Suivi du taux de recouvrement financier (%) et de l'installation des compteurs d'EDG",
            "line",
            [
                {"label": "Compteurs Posés", "value": "185,400", "sub": "+12.4% ce trimestre", "icon": "Layers"},
                {"label": "Taux Recouvrement", "value": "91.2%", "sub": "Objectif national 95%", "icon": "TrendingUp"},
                {"label": "Satisfaction Client", "value": "4.2/5", "sub": "Index baromètre national", "icon": "Smile"}
            ],
            [
                {"key": "Recouvrement (%)", "label": "Taux Recouvrement (%)", "color": "#10b981"},
                {"key": "Compteurs Posés (Centaines)", "label": "Compteurs Posés (Centaines)", "color": "#8b5cf6"}
            ],
            [
                {"name": "Jan", "Recouvrement (%)": 82, "Compteurs Posés (Centaines)": 120},
                {"name": "Fév", "Recouvrement (%)": 84, "Compteurs Posés (Centaines)": 135},
                {"name": "Mar", "Recouvrement (%)": 87, "Compteurs Posés (Centaines)": 150},
                {"name": "Avr", "Recouvrement (%)": 89, "Compteurs Posés (Centaines)": 165},
                {"name": "Mai", "Recouvrement (%)": 90, "Compteurs Posés (Centaines)": 178},
                {"name": "Juin", "Recouvrement (%)": 91.2, "Compteurs Posés (Centaines)": 185}
            ]
        ),
        "rh": (
            "Indicateurs de Formation & Développement RH",
            "Taux de complétion des plans de formation d'EDG et recrutement par pôle",
            "bar",
            [
                {"label": "Taux de Formation", "value": "88.0%", "sub": "Objectif annuel dépassé", "icon": "GraduationCap"},
                {"label": "Index Climat Social", "value": "4.1/5", "sub": "Baromètre interne 2026", "icon": "Smile"},
                {"label": "Ingénieurs Recrutés", "value": "42 agents", "sub": "Période d'intégration active", "icon": "UserPlus"}
            ],
            [
                {"key": "Formations Techniques", "label": "Technique", "color": "#3b82f6"},
                {"key": "Formations Sécurité", "label": "Sécurité", "color": "#f59e0b"},
                {"key": "Formations Management", "label": "Management & Admin", "color": "#ec4899"}
            ],
            [
                {"name": "T1 25", "Formations Techniques": 150, "Formations Sécurité": 210, "Formations Management": 45},
                {"name": "T2 25", "Formations Techniques": 180, "Formations Sécurité": 240, "Formations Management": 60},
                {"name": "T3 25", "Formations Techniques": 160, "Formations Sécurité": 190, "Formations Management": 55},
                {"name": "T4 25", "Formations Techniques": 220, "Formations Sécurité": 280, "Formations Management": 80},
                {"name": "T1 26", "Formations Techniques": 250, "Formations Sécurité": 310, "Formations Management": 95},
                {"name": "T2 26", "Formations Techniques": 290, "Formations Sécurité": 340, "Formations Management": 110}
            ]
        ),
        "distribution": (
            "Réseau de Distribution & Résilience Moyenne Tension",
            "Interventions moyennes et pannes de transformateurs résolues d'EDG",
            "area",
            [
                {"label": "Réseau Opérationnel", "value": "97.4%", "sub": "Basse et moyenne tension", "icon": "Activity"},
                {"label": "Temps d'Intervention", "value": "145 min", "sub": "SLA moyen d'urgence", "icon": "Clock"},
                {"label": "Transfos Modernisés", "value": "118 unités", "sub": "+12 installés ce mois", "icon": "Wrench"}
            ],
            [
                {"key": "Incidents Signalés", "label": "Incidents Signalés", "color": "#ef4444"},
                {"key": "Incidents Résolus", "label": "Incidents Résolus", "color": "#10b981"}
            ],
            [
                {"name": "Jan", "Incidents Signalés": 190, "Incidents Résolus": 180},
                {"name": "Fév", "Incidents Signalés": 210, "Incidents Résolus": 202},
                {"name": "Mar", "Incidents Signalés": 170, "Incidents Résolus": 165},
                {"name": "Avr", "Incidents Signalés": 150, "Incidents Résolus": 148},
                {"name": "Mai", "Incidents Signalés": 130, "Incidents Résolus": 130},
                {"name": "Juin", "Incidents Signalés": 115, "Incidents Résolus": 115}
            ]
        ),
        "finance": (
            "Planification Budgétaire & Dépenses d'Investissement",
            "Suivi des recettes de vente d'énergie vs dépenses de modernisation d'EDG",
            "bar",
            [
                {"label": "Exécution Budget", "value": "78.4%", "sub": "Rigueur financière validée", "icon": "TrendingUp"},
                {"label": "Optimisation Coûts", "value": "-6.2%", "sub": "Économies structurelles", "icon": "TrendingDown"},
                {"label": "Investissement Réseau", "value": "12.4 M$", "sub": "Fonds propres investis", "icon": "DollarSign"}
            ],
            [
                {"key": "Recettes (M$)", "label": "Recettes", "color": "#10b981"},
                {"key": "Dépenses (M$)", "label": "Dépenses", "color": "#6b7280"},
                {"key": "Investissements (M$)", "label": "Investissements", "color": "#f59e0b"}
            ],
            [
                {"name": "Jan", "Recettes (M$)": 8.4, "Dépenses (M$)": 6.2, "Investissements (M$)": 1.5},
                {"name": "Fév", "Recettes (M$)": 9.1, "Dépenses (M$)": 6.4, "Investissements (M$)": 1.8},
                {"name": "Mar", "Recettes (M$)": 9.5, "Dépenses (M$)": 6.1, "Investissements (M$)": 2.2},
                {"name": "Avr", "Recettes (M$)": 10.2, "Dépenses (M$)": 6.8, "Investissements (M$)": 2.5},
                {"name": "Mai", "Recettes (M$)": 11.0, "Dépenses (M$)": 7.0, "Investissements (M$)": 2.9},
                {"name": "Juin", "Recettes (M$)": 12.4, "Dépenses (M$)": 7.2, "Investissements (M$)": 3.4}
            ]
        )
    }

    def _generic_dashboard(code: str):
        return (
            f"Indicateurs Globaux & Progression des Chantiers ({code.upper()})",
            "Rendement de gouvernance, avancement des livrables et conformité réglementaire",
            "line",
            [
                {"label": "Objectifs Atteints", "value": "84.5%", "sub": "Indicateur consolidé", "icon": "TrendingUp"},
                {"label": "Traitement Dossiers", "value": "48h", "sub": "Fluidité administrative", "icon": "Clock"},
                {"label": "Taux de Conformité", "value": "100.0%", "sub": "Zéro non-conformité", "icon": "ShieldCheck"}
            ],
            [
                {"key": "Progression (%)", "label": "Progression Générale (%)", "color": "#f59e0b"},
                {"key": "Taux de Qualité (%)", "label": "Taux de Qualité (%)", "color": "#10b981"}
            ],
            [
                {"name": "Trimestre 1", "Progression (%)": 45, "Taux de Qualité (%)": 92},
                {"name": "Trimestre 2", "Progression (%)": 58, "Taux de Qualité (%)": 94},
                {"name": "Trimestre 3", "Progression (%)": 70, "Taux de Qualité (%)": 96},
                {"name": "Trimestre 4", "Progression (%)": 84.5, "Taux de Qualité (%)": 98}
            ]
        )

    cursor.execute("SELECT id, code FROM unity")
    for u in cursor.fetchall():
        u_id = u["id"] if isinstance(u, dict) else u[0]
        u_code = (u["code"] if isinstance(u, dict) else u[1]) or ""
        cursor.execute("SELECT id FROM dashboard WHERE unity_id = ?", (u_id,))
        if cursor.fetchone():
            continue
        title, subtitle, chart_type, kpis, series, chart_data = dashboard_by_code.get(
            u_code.lower().strip(), _generic_dashboard(u_code)
        )
        cursor.execute("""
            INSERT INTO dashboard (unity_id, title, subtitle, chart_type, kpis, series, chart_data)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (u_id, title, subtitle, chart_type, json.dumps(kpis), json.dumps(series), json.dumps(chart_data)))

    # Nettoyage des anciens comptes de démonstration (schémas de rôles remplacés au fil des itérations)
    legacy_emails = (
        "admin@edg.com.gn", "rh@edg.com.gn", "chef@edg.com.gn", "agent@edg.com.gn",
        "collaborateur@edg.com.gn", "admin.contenu@edg.com.gn", "admin.technique@edg.com.gn",
    )
    for legacy_email in legacy_emails:
        cursor.execute("DELETE FROM users WHERE email = ?", (legacy_email,))

    def _unity_id_for_code(code):
        cursor.execute("SELECT id FROM unity WHERE code = ?", (code,))
        row = cursor.fetchone()
        return (row["id"] if isinstance(row, dict) else row[0]) if row else None

    dsi_id = _unity_id_for_code("dsi")
    finance_id = _unity_id_for_code("finance")
    rh_id = _unity_id_for_code("rh")
    dg_id = _unity_id_for_code("dg")

    # Seed Users - idempotent, mots de passe hachés via bcrypt.
    if IS_PROD:
        # PRODUCTION : jamais de comptes de démonstration à mot de passe connu.
        # On provisionne UNIQUEMENT un administrateur initial, avec un mot de passe
        # ALÉATOIRE affiché une seule fois dans le journal serveur et changement
        # OBLIGATOIRE à la première connexion (must_change_password = 1).
        # L'e-mail est surchargeable via la variable d'environnement ADMIN_EMAIL.
        admin_email = (os.getenv("ADMIN_EMAIL") or "admin@edg.com.gn").strip()
        cursor.execute("SELECT id FROM users WHERE role = 'administrateur' LIMIT 1")
        if not cursor.fetchone():
            temp_password = secrets.token_urlsafe(12)
            cursor.execute("""
                INSERT INTO users (name, email, password_hash, role, unity_id, department_name, department_code, title, password_changed_at, must_change_password)
                VALUES (?, ?, ?, 'administrateur', NULL, ?, ?, ?, ?, 1)
            """, ("Administrateur", admin_email, hash_password(temp_password),
                  "Direction Générale", "dg", "Administrateur Système Intranet",
                  datetime.datetime.utcnow().isoformat()))
            print(
                "\n" + "=" * 74 +
                "\n  COMPTE ADMINISTRATEUR INITIAL CREE (APP_ENV=production)" +
                "\n  E-mail        : " + admin_email +
                "\n  Mot de passe  : " + temp_password +
                "\n  --> Connectez-vous et changez-le IMMEDIATEMENT (exige a la 1re connexion)." +
                "\n      Affiche une seule fois, non recuperable ensuite." +
                "\n" + "=" * 74 + "\n",
                flush=True,
            )
    else:
        # DÉVELOPPEMENT : comptes de démonstration (un par rôle) pour faciliter les tests.
        # Modèle de rôles EDG : agent, chef_service, rh_direction (direction=NULL -> RH central, sinon Directeur), administrateur
        demo_users = [
            ("Kadiatou Bah", "agent@edg.com.gn", "agent", "agent",
             dsi_id, "Direction des Systèmes d'Information (DSI)", "dsi", "Agent de Support Informatique"),
            ("Alpha Oumar Barry", "chef@edg.com.gn", "chef_service", "chef_service",
             finance_id, "Direction des Affaires Financières", "finance", "Chef du Service Comptabilité"),
            ("Mariama Barry", "rh@edg.com.gn", "rh_direction", "rh_direction",
             None, "Ressources Humaines (Direction Générale)", "", "Directrice des Ressources Humaines"),
            ("Amadou Diallo", "admin@edg.com.gn", "administrateur", "administrateur",
             None, "Direction des Systèmes d'Information (DSI)", "dsi", "Administrateur Système Intranet"),
        ]
        for name, email, password, role, unity_id, dept_name, dept_code, title in demo_users:
            cursor.execute("SELECT id FROM users WHERE email = ?", (email,))
            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO users (name, email, password_hash, role, unity_id, department_name, department_code, title, password_changed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (name, email, hash_password(password), role, unity_id, dept_name, dept_code, title, datetime.datetime.utcnow().isoformat()))

    # Seed Postes (organigramme des FONCTIONS) - une fois, à partir des directions existantes.
    # Racine = Directeur Général ; un poste de directeur par direction, rattaché au DG.
    cursor.execute("SELECT COUNT(*) as cnt FROM poste")
    res = cursor.fetchone()
    count = res["cnt"] if (res and isinstance(res, dict)) else (res[0] if res else 0)
    if count == 0:
        cursor.execute(
            "INSERT INTO poste (title, unity_id, parent_id, occupant_name, ordre) VALUES (?, ?, NULL, ?, 0)",
            ("Directeur Général", dg_id, "")
        )
        dg_poste_id = cursor.lastrowid
        cursor.execute("SELECT id, label, code, director_name FROM unity ORDER BY id")
        unities_for_postes = cursor.fetchall()
        ordre = 1
        for u in unities_for_postes:
            if u["code"] == "dg":
                if u["director_name"]:
                    cursor.execute("UPDATE poste SET occupant_name = ? WHERE id = ?", (u["director_name"], dg_poste_id))
                continue
            cursor.execute(
                "INSERT INTO poste (title, unity_id, parent_id, occupant_name, ordre) VALUES (?, ?, ?, ?, ?)",
                (f"Directeur — {u['label']}", u["id"], dg_poste_id, u["director_name"] or "", ordre)
            )
            ordre += 1

    # Seed : un workflow "Organigramme Général" pré-rempli avec la hiérarchie actuelle des entités
    # (on reprend unity.parent_id comme parent DANS ce workflow). Créé une seule fois.
    cursor.execute("SELECT COUNT(*) as cnt FROM workflow")
    res = cursor.fetchone()
    count = res["cnt"] if (res and isinstance(res, dict)) else (res[0] if res else 0)
    if count == 0:
        cursor.execute(
            "INSERT INTO workflow (label, description) VALUES (?, ?)",
            ("Organigramme Général", "Hiérarchie institutionnelle par défaut de l'Électricité de Guinée.")
        )
        wf_id = cursor.lastrowid
        cursor.execute("SELECT id, parent_id FROM unity ORDER BY id")
        ordre_n = 0
        for u in cursor.fetchall():
            uid = u["id"] if isinstance(u, dict) else u[0]
            pid = u["parent_id"] if isinstance(u, dict) else u[1]
            cursor.execute(
                "INSERT INTO organigramme_node (workflow_id, unit_id, parent_unit_id, ordre) VALUES (?, ?, ?, ?)",
                (wf_id, uid, pid, ordre_n)
            )
            ordre_n += 1

    # Seed Events (agenda institutionnel) - independant du seed des directions
    cursor.execute("SELECT COUNT(*) as cnt FROM events")
    res = cursor.fetchone()
    count = res["cnt"] if (res and isinstance(res, dict)) else (res[0] if res else 0)
    if count == 0:
        events_data = [
            ("Réunion d'évaluation de la politique des absences", "RH / Direction", rh_id,
             "2026-06-10", "10:00 - 11:30", "Salle de réunion A (Siège)", "Mariama Barry"),
            ("Revue technique : Sauvegarde de sécurité Data Center Matoto", "Technique", dsi_id,
             "2026-06-12", "14:30 - 16:00", "Data Center Matoto", "Fatoumata Sylla"),
            ("Conseil d'Administration extraordinaire : Plan d'interconnexion", "Direction Générale", dg_id,
             "2026-06-15", "09:00 - 13:00", "Grand Salon d'honneur", "Direction Générale"),
            ("Lancement de l'audit comptable consolidé SAGE ERP", "Finance", finance_id,
             "2026-06-11", "11:00 - 12:30", "Salle de conférence B", "Sékou Condé"),
        ]
        cursor.executemany("""
            INSERT INTO events (title, type, unity_id, event_date, event_time, location, host)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, events_data)

    # Seed Tickets (registre de signalements/contacts) - independant du seed des directions
    cursor.execute("SELECT COUNT(*) as cnt FROM tickets")
    res = cursor.fetchone()
    count = res["cnt"] if (res and isinstance(res, dict)) else (res[0] if res else 0)
    if count == 0:
        tickets_data = [
            ("EDG-TICK-9021", "incident", "Diallo Souleymane", "s.diallo@edg.com.gn",
             "Avarie transformateur auxiliaire Kaloum Nord",
             "Le disjoncteur principal du transformateur de quartier a déclenché à la suite de la surcharge thermique de 14h. Les équipes ont besoin d'outils isolants complémentaires.",
             1, "2026-06-02T08:15:00Z", "En cours", "Haute"),
            ("EDG-TICK-9022", "contact", "Aminata Baldé", "aminata.balde@edg.com.gn",
             "Demande de brochure de formation IntraLearning",
             "Bonjour, je souhaiterais obtenir la farde imprimée récapitulative des heures de cours en ligne de gestion agile DSI pour l'antenne locale de Kindia.",
             2, "2026-06-01T10:30:00Z", "Résolu", "Faible"),
            ("EDG-TICK-9023", "incident", "Ibrahim Cissé", "ibrahim.cisse@edg.com.gn",
             "Hameçonnage suspect reçu sur adresse DSI",
             "J'ai reçu un email alarmant me demandant de ressaisir mes codes d'accès Outlook sous 24h. Je suspecte une tentative d'hameçonnage imitant l'EDG.",
             1, "2026-06-02T11:45:00Z", "Nouveau", "Moyenne")
        ]
        cursor.executemany("""
            INSERT INTO tickets (id, type, sender_name, sender_email, subject, message, unity_id, created_at, status, priority)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, tickets_data)

    conn.commit()
    conn.close()
