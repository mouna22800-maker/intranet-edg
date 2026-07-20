/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// NB : ce fichier ne contient plus de composant « TeamView » (l'organigramme humain a été
// remplacé par OrganigrammeView, basé sur les postes). Seule la fonction utilitaire
// getDeptTeamMembers subsiste : elle fournit des membres d'équipe par défaut à AttributionsView.

interface TeamMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  bio: string;
  responsibilities: string[];
}

const DEPT_TEAMS_DATA: Record<string, TeamMember[]> = {
  dsi: [
    {
      id: "dsi_1",
      name: "Mamadou Barry",
      role: "Directeur des Systèmes d'Information (DSI)",
      email: "mbarry@edg.com.gn",
      phone: "+224 622 35 12 89",
      bio: "Fort de 15 ans d'expérience internationale en ingénierie informatique, Mamadou orchestre la révolution numérique et les raccordements réseau d'EDG SA.",
      responsibilities: [
        "Définition des schémas directeurs technologiques et budgets informatiques.",
        "Gouvernance opérationnelle de la cybersécurité et de la protection industrielle.",
        "Supervision des liaisons serveurs et fibres des directions techniques régionales."
      ]
    },
    {
      id: "dsi_2",
      name: "Mariama Camara",
      role: "Responsable Réseaux & Sécurité",
      email: "mcamara@edg.com.gn",
      phone: "+224 628 44 90 12",
      bio: "Spécialiste certifiée Cisco & Fortinet, Mariama pilote l'infrastructure défensive de l'Intranet national d'accès libre pour prémunir EDG de toute panne.",
      responsibilities: [
        "Administration des coupe-feu (firewall) et VPN d'agences.",
        "Surveillance d'intégrité de la base de facturation clientèle.",
        "Mise en sécurité physique de notre salle serveur centrale de Conakry."
      ]
    },
    {
      id: "dsi_3",
      name: "Koly Sovogui",
      role: "Chef de Cabinet Support & Applications",
      email: "ksovogui@edg.com.gn",
      phone: "+224 620 55 11 00",
      bio: "Coordinateur rigoureux, Koly conduit l'ensemble des formations d'accompagnement de nos cadres et administre le catalogue applicatif centralisé.",
      responsibilities: [
        "Support informatique de niveau 1-2 pour tous les collaborateurs guinéens.",
        "Assistance technique à la mise en œuvre et le raccordement de logiciels métiers.",
        "Audit périodique d'ergonomie et de fluidité opérationnelle sur l'Intranet."
      ]
    }
  ],
  rh: [
    {
      id: "rh_1",
      name: "Ousmane Diallo",
      role: "Directeur des Ressources Humaines (DRH)",
      email: "odiallo@edg.com.gn",
      phone: "+224 621 11 50 60",
      bio: "Expert des relations industrielles, Ousmane dirige toute la politique de recrutement, rémunération et valorisation des compétences statutaires chez EDG.",
      responsibilities: [
        "Orientation stratégique de la formation et développement des carrières.",
        "Arbitrage et pacification active du climat social national d'EDG.",
        "Représentation de la direction auprès des instances paritaires guinéennes."
      ]
    },
    {
      id: "rh_2",
      name: "Fanta Soumah",
      role: "Responsable du Développement des Compétences",
      email: "fsoumah@edg.com.gn",
      phone: "+224 629 00 11 22",
      bio: "Diplômée d'ingénierie de formation, Fanta élabore les certifications sur-mesure pour hisser nos techniciens d'exploitation aux meilleurs standards continentaux.",
      responsibilities: [
        "Modélisation et pilotage du plan de formation annuel d'EDG SA.",
        "Supervision des partenariats universitaires de stage et de formation continue.",
        "Évaluation d'impact métier et revalorisation technique des postes."
      ]
    },
    {
      id: "rh_3",
      name: "Ibrahim Sylla",
      role: "Responsable Administration du Personnel",
      email: "isylla@edg.com.gn",
      phone: "+224 623 88 12 34",
      bio: "Garant rigoureux des équilibres contractuels, Ibrahim régule la paie informatique, les congés statutaires et l'intégration des bénéfices sociaux.",
      responsibilities: [
        "Validation opérationnelle des demandes de congés et décharges médicales.",
        "Suivi des dossiers de retraite et d'accompagnement prévoyance.",
        "Contrôle de légalité des affectations géographiques régionales."
      ]
    }
  ]
};

export function getDeptTeamMembers(code: string, name: string, directorName: string): TeamMember[] {
  const normCode = code.toLowerCase().trim();
  if (DEPT_TEAMS_DATA[normCode]) {
    return DEPT_TEAMS_DATA[normCode];
  }

  return [
    {
      id: `${normCode}_1`,
      name: directorName,
      role: `Directeur de Direction - ${name}`,
      email: `${directorName.toLowerCase().replace(/\s+/g, '.')}@edg.com.gn`,
      phone: "+224 622 14 00 00",
      bio: `${directorName} pilote avec engagement le périmètre opérationnel stratégique, l'encadrement des équipes et le budget de cette direction nationale d'EDG SA.`,
      responsibilities: [
        "Gouvernance stratégique et exécution budgétaire de la direction.",
        "Représentation de la spécialité technique auprès du Comité de Direction EDG.",
        "Suivi des indicateurs clés d'avancement de la direction."
      ]
    },
    {
      id: `${normCode}_2`,
      name: "Sekou Mara",
      role: "Responsable des Opérations Techniques",
      email: "smara@edg.com.gn",
      phone: "+224 620 99 88 77",
      bio: "Sekou structure les flux de tâches quotidiens des ingénieurs d'exploitation, assurant la conformité aux règlements intérieurs de sûreté.",
      responsibilities: [
        "Planification et exécution des interventions d'exploitation courante.",
        "Reporting hebdomadaire des faits marquants et goulots d'étranglement.",
        "Consolidation de la base d'assistance et d'auto-dépannage."
      ]
    },
    {
      id: `${normCode}_3`,
      name: "Hadja Bilguissa Diallo",
      role: "Responsable Administrative de Cabinet",
      email: "bdiallo@edg.com.gn",
      phone: "+224 625 11 22 33",
      bio: "Pivot administratif, Hadja coordonne les relations internes, les ordres de mission, les réunions de crise et la documentation partagée.",
      responsibilities: [
        "Accueil et instruction préliminaire des dossiers d'usagers.",
        "Gestion logistique et secrétariat de l'équipe d'encadrement.",
        "Archivage numérique sécurisé des correspondances de la direction."
      ]
    }
  ];
}
