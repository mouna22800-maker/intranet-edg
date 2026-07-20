# EDG Intranet - Python FastAPI Administration & Content API (Modular Structure)

Service d'API moderne développé en **Python (FastAPI)** gérant le portail collaboratif intranet de l'**Électricité de Guinée (EDG) S.A.**
Cette architecture est structurée sous la racine `/api` et remplace les données statiques par une base relationnelle SQLite locale avec validation stricte Pydantic.

## 🏗️ Structure Modulaire du Répertoire `/api`
```text
/api
├── __init__.py
├── main.py                # Point d'entrée de l'application FastAPI, middleware CORS, montage des sous-routers
├── database.py            # Initialisation transactionnelle SQLite et seeding des 12 directions institutionnelles
├── models.py              # Schémas de validation et de sortie Pydantic (Departments, Articles, Admin)
├── requirements.txt       # Spécification des dépendances pip
└── routes/
    ├── __init__.py
    ├── admin.py           # Endpoints d'administration sécurisés (sauvegarde transactionnelle, logo, etc.)
    ├── articles.py        # Endpoints de requêtes et de filtrage dynamique des actualités
    └── departments.py     # Endpoints publics de consultation des directions d'entreprise
```

## 📡 Liste des Principales Routes d'API

### Directions d'entreprise (`/departments`)
* **`GET /departments`** : Retourne la liste des 12 collèges administratifs guinéens (conseils, directeurs, années d'érection, effectifs, codes, thématiques).

### Actualités & Communication (`/articles`)
* **`GET /articles`** : Récupère les articles en transit sur l'intranet. Supporte le filtrage dynamique :
  * `department_id` : Pour isoler l'activité locale d'un département.
  * `is_global` : Pour isoler les annonces à l'échelle de l'entreprise S.A.
  * `q` : Recherche textuelle par mots-clés de titre ou de contenu.

### Administration (`/admin`)
* **`GET /admin/directions`** : Consultation des structures existantes pour l'écran de modification.
* **`POST /admin/direction/save`** : Sauvegarde transactionnelle multifragment (`multipart/form-data`) acceptant le téléversement optionnel du logo, contrôle de types / extensions autorisées et limitations de taille.
