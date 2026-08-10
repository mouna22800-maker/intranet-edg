from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


class LoginRequest(BaseModel):
    email: str = Field(..., description="Adresse e-mail professionnelle EDG")
    password: str = Field(..., description="Mot de passe")


class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(..., description="Mot de passe actuel")
    newPassword: str = Field(..., description="Nouveau mot de passe (8 caractères minimum)")


class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., description="Adresse e-mail du compte")


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., description="Jeton reçu par e-mail")
    newPassword: str = Field(..., description="Nouveau mot de passe")


class PosteBase(BaseModel):
    title: str = Field(..., description="Intitulé du poste (ex: Directeur des Systèmes d'Information)")
    unityId: Optional[int] = Field(None, description="Direction/service de rattachement (NULL possible)")
    parentId: Optional[int] = Field(None, description="Poste supérieur (NULL = racine de l'organigramme)")
    occupantName: Optional[str] = Field("", description="Personne occupant le poste (optionnel, indicatif)")
    occupantEmail: Optional[str] = Field("", description="E-mail de l'occupant (optionnel)")
    ordre: Optional[int] = Field(0, description="Ordre d'affichage entre postes frères")


class PosteCreate(PosteBase):
    pass


class PosteResponse(PosteBase):
    id: int
    unityLabel: Optional[str] = ""
    unityCode: Optional[str] = ""

    class Config:
        from_attributes = True


# --- Organigrammes dynamiques : entités (unity), workflows (contextes), nœuds contextuels ---

class UnitEntity(BaseModel):
    """Entité de l'organisation (ligne unity), réutilisable dans tous les workflows."""
    id: int
    code: str
    name: str
    type: Optional[str] = "Direction"

    class Config:
        from_attributes = True


class UnitEntityCreate(BaseModel):
    name: str = Field(..., description="Libellé de l'entité (ex: Direction des Ressources Humaines)")
    code: Optional[str] = Field(None, description="Code court unique (généré depuis le nom si vide)")
    type: Optional[str] = Field("Département", description="Direction / Département / Service…")


class WorkflowBase(BaseModel):
    label: str = Field(..., description="Nom du contexte / de l'organigramme (ex: Validation Application)")
    description: Optional[str] = Field("", description="Description libre du contexte")


class WorkflowCreate(WorkflowBase):
    pass


class WorkflowResponse(WorkflowBase):
    id: int

    class Config:
        from_attributes = True


class NodeCreate(BaseModel):
    """Associe une entité (unitId) à un workflow, avec SON parent DANS ce workflow."""
    unitId: int = Field(..., description="Entité placée dans le workflow")
    parentUnitId: Optional[int] = Field(None, description="Parent DANS ce workflow (NULL = racine)")
    ordre: Optional[int] = Field(0, description="Ordre d'affichage entre entités sœurs")


class NodeUpdate(BaseModel):
    parentUnitId: Optional[int] = Field(None, description="Nouveau parent DANS ce workflow (NULL = racine)")
    ordre: Optional[int] = Field(0, description="Ordre d'affichage")


class NodeResponse(BaseModel):
    id: int
    workflowId: int
    unitId: int
    parentUnitId: Optional[int] = None
    ordre: int = 0
    name: str = ""
    code: str = ""
    type: str = "Direction"

    class Config:
        from_attributes = True


class DocumentBase(BaseModel):
    title: str = Field(..., description="Titre du document")
    category: str = Field(..., description="Note de service / Directive / Modèle officiel / Formulaire")
    departmentId: Optional[int] = Field(None, description="Direction associée")
    author: Optional[str] = Field("", description="Nom du référent / auteur")
    fileUrl: str = Field(..., description="Chemin d'accès du fichier téléversé")
    fileSize: Optional[int] = Field(0, description="Taille du fichier en octets")

class DocumentResponse(DocumentBase):
    id: int
    departmentLabel: Optional[str] = ""
    createdAt: str

    class Config:
        from_attributes = True

class DepartmentBase(BaseModel):
    code: str = Field(..., description="Code court unique de la direction (ex: dsi)")
    name: str = Field(..., description="Nom officiel complet")
    description: Optional[str] = Field(None, description="Note introductive de la direction")
    icon: Optional[str] = Field("Layers", description="Icône Lucide associée de manière dynamique")
    director_name: str = Field(..., description="Nom complet du Directeur/Directrice")
    founded_year: Optional[int] = Field(1987, description="Année d'établissement")
    staff_count: Optional[int] = Field(10, description="Effectif collaborateurs de la division")
    theme_color: Optional[str] = Field("emerald", description="Couleur thématique institutionnelle")

class DepartmentCreate(DepartmentBase):
    pass

class MissionPillar(BaseModel):
    title: str
    desc: str

class Commitment(BaseModel):
    title: str
    metric: str
    description: str
    objective: str

class Domain(BaseModel):
    title: str
    desc: str
    icon: str

class DashboardKPI(BaseModel):
    label: str
    value: str
    sub: Optional[str] = ""
    icon: Optional[str] = "TrendingUp"

class DashboardSeriesItem(BaseModel):
    key: str
    label: str
    color: Optional[str] = "#10b981"

class DashboardData(BaseModel):
    title: str
    subtitle: Optional[str] = ""
    chartType: Optional[str] = "area"
    kpis: List[DashboardKPI] = []
    series: List[DashboardSeriesItem] = []
    chartData: List[Dict[str, Any]] = []

class DepartmentResponse(DepartmentBase):
    id: int
    parentId: Optional[int] = None
    director_message: Optional[str] = ""
    value_key: Optional[str] = ""
    value_desc: Optional[str] = ""
    application_ids: Optional[List[int]] = []
    missionPillars: Optional[List[MissionPillar]] = []
    commitments: Optional[List[Commitment]] = []
    domains: Optional[List[Domain]] = []
    values: Optional[List[MissionPillar]] = []
    historyText: Optional[str] = ""
    dashboard: Optional[DashboardData] = None

    class Config:
        from_attributes = True


class FileAttachment(BaseModel):
    name: str
    url: str

class ArticleBase(BaseModel):
    title: str = Field(..., description="Titre d'actualité")
    excerpt: str = Field(..., description="Chapeau synthétique")
    content: str = Field(..., description="Corps textuel complet")
    category: str = Field(default="communique", description="Catégorie d'annonce (communique, deces, mariage, naissance, retraite, recrue, projet, evenement)")
    tags: List[str] = Field(default=[], description="Mots-clés associés")
    isGlobal: bool = Field(default=False, description="Visibilité globale")
    departmentId: Optional[int] = Field(None, description="ID de la direction si local")
    image: Optional[str] = Field(None, description="Dégradé de couleur CSS ou URL visuelle")
    files: List[FileAttachment] = Field(default=[], description="Documents joints (PDF, Word, Excel...)")

class ArticleResponse(ArticleBase):
    id: int
    createdAt: str

    class Config:
        from_attributes = True


class AdminDirectionSaveResponse(BaseModel):
    id: int
    code: str
    logo_path: Optional[str] = None


class TeamMemberBase(BaseModel):
    departmentId: int = Field(..., description="ID de la direction (unity_id)")
    name: str = Field(..., description="Nom complet de l'agent")
    role: str = Field(..., description="Fonction / poste occupé")
    email: str = Field(..., description="Adresse email professionnelle")
    phone: Optional[str] = Field("", description="Numéro de téléphone")
    bio: Optional[str] = Field("", description="Courte biographie")
    responsibilities: List[str] = Field(default=[], description="Liste des responsabilités")
    hierarchy_order: Optional[int] = Field(10, description="1=Directeur, 2=Chef de service, 3=Collaborateur, etc.")

class TeamMemberResponse(TeamMemberBase):
    id: str

    class Config:
        from_attributes = True


class TicketBase(BaseModel):
    type: str = Field(..., description="'contact' ou 'incident'")
    senderName: str = Field(..., description="Nom complet de l'émetteur")
    senderEmail: str = Field(..., description="Adresse email de l'émetteur")
    subject: str = Field(..., description="Objet de la demande")
    message: str = Field(..., description="Corps détaillé du message")
    departmentId: int = Field(..., description="Direction concernée")
    priority: Optional[str] = Field(None, description="Faible / Moyenne / Haute (incidents uniquement)")

class TicketResponse(TicketBase):
    id: str
    createdAt: str
    status: str = "Nouveau"

    class Config:
        from_attributes = True

class TicketStatusUpdate(BaseModel):
    status: str = Field(..., description="Nouveau / Reçu / En cours / Résolu")


class UserAccountBase(BaseModel):
    name: str = Field(..., description="Nom complet de l'agent")
    email: str = Field(..., description="Adresse email professionnelle EDG")
    role: str = Field(..., description="agent / chef_service / rh_direction / administrateur")
    departmentId: Optional[int] = Field(None, description="Direction de rattachement (unity_id)")
    title: Optional[str] = Field("", description="Intitulé du poste")

class UserAccountCreate(UserAccountBase):
    password: str = Field(..., description="Mot de passe initial")

class UserAccountUpdate(UserAccountBase):
    password: Optional[str] = Field(None, description="Nouveau mot de passe (laisser vide pour ne pas changer)")

class UserAccountResponse(UserAccountBase):
    id: int
    departmentLabel: Optional[str] = ""

    class Config:
        from_attributes = True


class PaginatedUsers(BaseModel):
    items: List[UserAccountResponse]
    total: int
    page: int
    pageSize: int


class PaginatedTickets(BaseModel):
    items: List[TicketResponse]
    total: int
    page: int
    pageSize: int


class UserNotificationResponse(BaseModel):
    id: int
    type: str
    title: str
    message: str
    icon: str
    isRead: bool
    createdAt: str

    class Config:
        from_attributes = True


class EventBase(BaseModel):
    title: str = Field(..., description="Intitulé de la rencontre")
    type: str = Field(..., description="RH / Direction, Technique, Finance, Direction Générale...")
    departmentId: Optional[int] = Field(None, description="Direction organisatrice (unity_id), optionnel si institutionnel")
    date: str = Field(..., description="Date de l'événement (YYYY-MM-DD)")
    time: Optional[str] = Field("", description="Plage horaire (ex: 09:00 - 10:30)")
    location: Optional[str] = Field("", description="Salle / lieu")
    host: Optional[str] = Field("", description="Organisateur")

class EventResponse(EventBase):
    id: str
    departmentLabel: Optional[str] = ""

    class Config:
        from_attributes = True
