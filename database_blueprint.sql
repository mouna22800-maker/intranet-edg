-- =====================================================================
-- DATABASE BLUEPRINT FOR INTRANET EDG (ELECTRICITE DE GUINEE)
-- Ce fichier documente le schema reellement implemente dans api/database.py
-- (moteur MySQL en production via DB_TYPE=mysql, repli automatique sur
-- SQLite local si aucune base MySQL n'est joignable). Les CREATE TABLE
-- ci-dessous utilisent la syntaxe MySQL ; voir api/database.py pour
-- l'equivalent SQLite ainsi que pour les donnees de seed completes.
-- =====================================================================

-- 1. Types de contenu ("rubriques" affichees sur chaque direction)
--    1=Presentation, 2=Nos engagements, 3=Nos valeurs, 4=Nos missions, 5=Organisation
CREATE TABLE IF NOT EXISTS content_type (
    id INT PRIMARY KEY,
    label VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 2. Types d'actualites (1=Global, 2=Local)
CREATE TABLE IF NOT EXISTS type_news (
    id INT PRIMARY KEY,
    label VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 3. Types de projets (ex: Energie, Digital, Infrastructure)
CREATE TABLE IF NOT EXISTS type_projet (
    id INT PRIMARY KEY,
    label VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 4. Directions / unites organisationnelles de l'EDG
CREATE TABLE IF NOT EXISTS unity (
    id INT AUTO_INCREMENT PRIMARY KEY,
    label VARCHAR(255) NOT NULL,             -- Nom complet de la direction
    code VARCHAR(100) NOT NULL UNIQUE,       -- ex: 'dsi', 'rh'
    description TEXT,                        -- Chapeau descriptif
    icon VARCHAR(100) DEFAULT 'Layers',      -- Icone Lucide
    director_name VARCHAR(255) NOT NULL,     -- Nom du directeur/directrice
    founded_year INT DEFAULT 1987,
    staff_count INT DEFAULT 10,
    theme_color VARCHAR(50) DEFAULT 'emerald',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 5. Contenus dynamiques rattaches a une direction (Presentation, Valeurs, Missions...)
CREATE TABLE IF NOT EXISTS content (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unity_id INT NOT NULL,
    description TEXT,
    summary TEXT,
    image VARCHAR(255) DEFAULT '',
    label VARCHAR(255) DEFAULT '',
    type INT NOT NULL,                       -- FK vers content_type
    ordre INT DEFAULT 0,
    icone VARCHAR(100) DEFAULT '',
    FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
    FOREIGN KEY (type) REFERENCES content_type(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 6. Actualites (globales ou locales a une direction)
CREATE TABLE IF NOT EXISTS news (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unity_id INT,                            -- NULL si actualite globale
    label VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    images TEXT,
    files TEXT,
    type INT NOT NULL,                       -- FK vers type_news
    created_at VARCHAR(100) NOT NULL,        -- format ISO 8601
    FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
    FOREIGN KEY (type) REFERENCES type_news(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 7. Projets portes par une direction
CREATE TABLE IF NOT EXISTS projet (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unity_id INT NOT NULL,
    label VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    image TEXT,
    date_debut VARCHAR(100) NOT NULL,
    date_fin VARCHAR(100) NOT NULL,
    niveau VARCHAR(100) DEFAULT 'En cours',  -- statut : Planifie / En cours / Termine
    type_id INT NOT NULL,                    -- FK vers type_projet
    FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
    FOREIGN KEY (type_id) REFERENCES type_projet(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 8. Destinataires de contact / urgence rattaches a une direction
CREATE TABLE IF NOT EXISTS recipient (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_unity INT NOT NULL,
    email VARCHAR(255) NOT NULL,
    numero VARCHAR(100),
    raison TEXT,
    FOREIGN KEY (id_unity) REFERENCES unity(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 9. Contacts associes a un destinataire
CREATE TABLE IF NOT EXISTS contact (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_recipient INT NOT NULL,
    email VARCHAR(255),
    numero VARCHAR(100),
    FOREIGN KEY (id_recipient) REFERENCES recipient(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 10. Organigramme : hierarchie entre directions (unity_id -> parent_id)
CREATE TABLE IF NOT EXISTS organigramme (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unity_id INT NOT NULL,
    parent_id INT,
    FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 11. Fiches individuelles des membres d'equipe (organigramme nominatif)
CREATE TABLE IF NOT EXISTS team_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    unity_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    bio TEXT,
    responsibilities JSON,                   -- Array JSON de strings
    hierarchy_order INT DEFAULT 10,          -- 1=Directeur, 2=Chef de service, etc.
    FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 12. Parametres generaux de l'intranet (textes/configs cles-valeurs)
CREATE TABLE IF NOT EXISTS settings (
    `key` VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 13. Applications metiers (globales ou specifiques a une direction)
CREATE TABLE IF NOT EXISTS applications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    url VARCHAR(512) NOT NULL,
    icon VARCHAR(100) DEFAULT 'ExternalLink',
    is_global TINYINT(1) DEFAULT 0,
    category VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- 14. Table de jointure entre directions et applications specifiques
CREATE TABLE IF NOT EXISTS unity_applications (
    unity_id INT NOT NULL,
    application_id INT NOT NULL,
    PRIMARY KEY (unity_id, application_id),
    FOREIGN KEY (unity_id) REFERENCES unity(id) ON DELETE CASCADE,
    FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- =====================================================================
-- RELATIONS PRINCIPALES
-- =====================================================================
-- unity          1--N  content
-- content_type   1--N  content
-- unity          1--N  news
-- type_news      1--N  news
-- unity          1--N  projet
-- type_projet    1--N  projet
-- unity          1--N  recipient
-- recipient      1--N  contact
-- unity          1--N  organigramme (hierarchie inter-directions)
-- unity          1--N  team_members (fiches nominatives)
-- unity          N--N  applications (via unity_applications)
--
-- Rubriques du site couvertes par content_type :
--   Presentation, Nos engagements, Nos valeurs, Nos missions, Organisation
-- Rubriques couvertes par des tables dediees :
--   Actualites (news), Nos projets (projet), Contact (recipient/contact)
-- =====================================================================
