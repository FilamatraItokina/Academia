import { Router } from 'express';

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Académia — API de Gestion Scolaire',
    version: '1.0.0',
    description:
      'API REST modulaire versionnée (/api/v1) pour la gestion administrative, pédagogique et financière d’un établissement secondaire.',
  },
  servers: [{ url: '/api/v1', description: 'Serveur API v1' }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/auth/me': {
      get: { summary: 'Récupérer le profil de l’utilisateur connecté et ses permissions', tags: ['Authentification'] },
      patch: { summary: 'Mettre à jour son propre profil (prénom, nom, téléphone)', tags: ['Authentification'] },
    },
    '/auth/session-audit': {
      post: { summary: 'Journaliser une connexion ou déconnexion utilisateur', tags: ['Authentification'] },
    },
    '/users': {
      get: { summary: 'Lister les utilisateurs avec recherche, filtre par rôle/statut et pagination', tags: ['Utilisateurs'] },
      post: { summary: 'Créer un compte utilisateur et lui attribuer des rôles', tags: ['Utilisateurs'] },
    },
    '/users/{id}': {
      get: { summary: 'Consulter le dossier d’un utilisateur', tags: ['Utilisateurs'] },
      patch: { summary: 'Modifier un utilisateur, ses rôles ou son statut actif/inactif', tags: ['Utilisateurs'] },
    },
    '/roles': {
      get: { summary: 'Lister les 8 rôles système et leurs permissions', tags: ['Rôles & Permissions'] },
    },
    '/roles/permissions': {
      get: { summary: 'Lister toutes les permissions par module', tags: ['Rôles & Permissions'] },
    },
    '/roles/{id}/permissions': {
      put: { summary: 'Mettre à jour la matrice des permissions d’un rôle', tags: ['Rôles & Permissions'] },
    },
    '/settings': {
      get: { summary: 'Consulter les paramètres généraux de l’établissement', tags: ['Établissement'] },
      patch: { summary: 'Mettre à jour la configuration de l’établissement', tags: ['Établissement'] },
    },
    '/audit-logs': {
      get: { summary: 'Consulter le journal des opérations sensibles', tags: ['Sécurité & Audit'] },
    },
    '/academic-years': {
      get: { summary: 'Lister les années scolaires et leurs périodes', tags: ['Années scolaires'] },
      post: { summary: 'Créer une année scolaire (avec génération optionnelle des trimestres/semestres)', tags: ['Années scolaires'] },
    },
    '/academic-years/{id}/activate': {
      post: { summary: 'Activer une année scolaire et archiver la précédente', tags: ['Années scolaires'] },
    },
    '/academic-years/{id}/close': {
      post: { summary: 'Clôturer définitivement une année scolaire', tags: ['Années scolaires'] },
    },
    '/academic-years/{id}/terms': {
      post: { summary: 'Ajouter une période (trimestre/semestre) à une année scolaire', tags: ['Années scolaires'] },
    },
    '/classes/levels': {
      get: { summary: 'Lister les niveaux scolaires (Collège / Lycée)', tags: ['Niveaux & Classes'] },
      post: { summary: 'Créer un niveau scolaire', tags: ['Niveaux & Classes'] },
    },
    '/classes/series': {
      get: { summary: 'Lister les séries (Générale, L, ES, S...)', tags: ['Niveaux & Classes'] },
      post: { summary: 'Créer une série', tags: ['Niveaux & Classes'] },
    },
    '/classes/classrooms': {
      get: { summary: 'Lister les salles de cours et laboratoires', tags: ['Niveaux & Classes'] },
      post: { summary: 'Créer une salle avec sa capacité d’accueil', tags: ['Niveaux & Classes'] },
    },
    '/classes': {
      get: { summary: 'Lister les classes filtrées par année, niveau ou recherche', tags: ['Niveaux & Classes'] },
      post: { summary: 'Créer une classe et lui attribuer une salle', tags: ['Niveaux & Classes'] },
    },
    '/classes/{id}/students': {
      get: { summary: 'Consulter la liste des élèves inscrits dans une classe', tags: ['Niveaux & Classes'] },
    },
    '/students': {
      get: { summary: 'Lister et filtrer les élèves (année, classe, niveau, genre, recherche)', tags: ['Élèves & Inscriptions'] },
      post: { summary: 'Inscrire un élève avec génération automatique du matricule', tags: ['Élèves & Inscriptions'] },
    },
    '/students/export': {
      get: { summary: 'Exporter les élèves filtrés au format CSV UTF-8', tags: ['Élèves & Inscriptions'] },
    },
    '/students/import': {
      post: { summary: 'Importer en masse des élèves depuis un fichier CSV', tags: ['Élèves & Inscriptions'] },
    },
    '/students/{id}': {
      get: { summary: 'Consulter le dossier scolaire complet d’un élève (inscriptions & parents)', tags: ['Élèves & Inscriptions'] },
      patch: { summary: 'Mettre à jour ou archiver un dossier élève', tags: ['Élèves & Inscriptions'] },
    },
    '/students/{id}/enrollments': {
      post: { summary: 'Inscrire ou réinscrire un élève dans une classe pour une année scolaire', tags: ['Élèves & Inscriptions'] },
    },
    '/students/enrollments/{enrollmentId}': {
      patch: { summary: 'Modifier ou transférer l’inscription d’un élève', tags: ['Élèves & Inscriptions'] },
    },
    '/teachers': {
      get: { summary: 'Lister les enseignants avec filtres par spécialité et statut', tags: ['Enseignants'] },
      post: { summary: 'Créer une fiche enseignant', tags: ['Enseignants'] },
    },
    '/teachers/{id}': {
      get: { summary: 'Consulter la fiche d’un enseignant', tags: ['Enseignants'] },
      patch: { summary: 'Mettre à jour un enseignant', tags: ['Enseignants'] },
    },
    '/guardians': {
      get: { summary: 'Lister les parents et responsables légaux', tags: ['Parents & Tuteurs'] },
      post: { summary: 'Créer un parent et l’associer optionnellement à un élève', tags: ['Parents & Tuteurs'] },
    },
    '/guardians/{id}': {
      get: { summary: 'Consulter le dossier d’un parent et la liste de ses enfants', tags: ['Parents & Tuteurs'] },
      patch: { summary: 'Mettre à jour les coordonnées d’un parent', tags: ['Parents & Tuteurs'] },
    },
    '/guardians/{id}/students': {
      post: { summary: 'Associer ou mettre à jour le lien parent-élève', tags: ['Parents & Tuteurs'] },
    },
    '/guardians/{id}/students/{studentId}': {
      delete: { summary: 'Retirer le lien entre un parent et un élève', tags: ['Parents & Tuteurs'] },
    },
    '/attendance/stream': {
      get: { summary: 'Flux SSE temps réel des mises à jour de présence', tags: ['Vie scolaire & Absences'] },
    },
    '/attendance/daily-summary': {
      get: { summary: 'Taux d’absentéisme du jour et liste détaillée des absents', tags: ['Vie scolaire & Absences'] },
    },
    '/attendance/class-roll': {
      get: { summary: 'Feuille d’appel d’une classe pour une date donnée', tags: ['Vie scolaire & Absences'] },
    },
    '/attendance/bulk': {
      post: { summary: 'Enregistrer ou mettre à jour l’appel d’une classe', tags: ['Vie scolaire & Absences'] },
    },
    '/attendance/{id}': {
      patch: { summary: 'Modifier le statut ou justifier une absence', tags: ['Vie scolaire & Absences'] },
    },
    '/events/upcoming': {
      get: { summary: 'Lister les événements scolaires à venir filtrés selon le rôle utilisateur', tags: ['Notifications & Événements'] },
    },
    '/events': {
      post: { summary: 'Créer un événement scolaire (examen, réunion, vacances)', tags: ['Notifications & Événements'] },
    },
    '/events/{id}': {
      patch: { summary: 'Modifier un événement scolaire', tags: ['Notifications & Événements'] },
      delete: { summary: 'Supprimer un événement scolaire', tags: ['Notifications & Événements'] },
    },
    '/subjects': {
      get: { summary: 'Lister les matières du référentiel scolaire', tags: ['Matières & Programmes'] },
      post: { summary: 'Créer une matière avec son pôle et coefficient par défaut', tags: ['Matières & Programmes'] },
    },
    '/subjects/{id}': {
      patch: { summary: 'Modifier ou archiver une matière', tags: ['Matières & Programmes'] },
    },
    '/subjects/classes/{classId}': {
      get: { summary: 'Consulter le programme pédagogique d’une classe et les enseignants affectés', tags: ['Matières & Programmes'] },
      post: { summary: 'Affecter une matière, un coefficient, un volume horaire et un enseignant à une classe', tags: ['Matières & Programmes'] },
    },
    '/subjects/classes/{classId}/copy-from': {
      post: { summary: 'Dupliquer le programme pédagogique depuis une autre classe', tags: ['Matières & Programmes'] },
    },
    '/subjects/class-subjects/{id}': {
      patch: { summary: 'Modifier le coefficient, le volume horaire ou l’enseignant d’une matière dans une classe', tags: ['Matières & Programmes'] },
      delete: { summary: 'Retirer une matière du programme d’une classe', tags: ['Matières & Programmes'] },
    },
    '/grades/assessments': {
      get: { summary: 'Lister les évaluations filtrées par classe, période et rôle enseignant', tags: ['Évaluations & Notes'] },
      post: { summary: 'Créer une évaluation (devoir, interrogation, examen) pour une matière et période', tags: ['Évaluations & Notes'] },
    },
    '/grades/assessments/{id}': {
      patch: { summary: 'Modifier ou publier/masquer une évaluation', tags: ['Évaluations & Notes'] },
      delete: { summary: 'Supprimer une évaluation et ses notes associées', tags: ['Évaluations & Notes'] },
    },
    '/grades/assessments/{id}/sheet': {
      get: { summary: 'Récupérer la feuille de saisie des notes d’une évaluation', tags: ['Évaluations & Notes'] },
    },
    '/grades/assessments/{id}/scores': {
      put: { summary: 'Enregistrer en masse les notes et absences d’une évaluation', tags: ['Évaluations & Notes'] },
    },
    '/grades/class-summary': {
      get: { summary: 'Synthèse des moyennes par matière, moyenne générale pondérée et classement', tags: ['Évaluations & Notes'] },
    },
    '/grades/my-summary': {
      get: { summary: 'Relevé personnel des notes publiées pour un élève ou un parent', tags: ['Évaluations & Notes'] },
    },
    '/report-cards/class': {
      get: { summary: 'Lister les bulletins d’une classe pour une période donnée', tags: ['Bulletins PDF'] },
    },
    '/report-cards/generate': {
      post: { summary: 'Générer ou actualiser les bulletins brouillons d’une classe depuis les notes et absences', tags: ['Bulletins PDF'] },
    },
    '/report-cards/class/validate-all': {
      post: { summary: 'Valider en masse les bulletins brouillons d’une classe', tags: ['Bulletins PDF'] },
    },
    '/report-cards/my-cards': {
      get: { summary: 'Lister les bulletins officiels validés d’un élève ou de ses enfants', tags: ['Bulletins PDF'] },
    },
    '/report-cards/{id}': {
      get: { summary: 'Consulter le détail complet d’un bulletin et ses appréciations', tags: ['Bulletins PDF'] },
      patch: { summary: 'Mettre à jour les appréciations des enseignants, la mention ou la remarque du conseil', tags: ['Bulletins PDF'] },
    },
    '/report-cards/{id}/validate': {
      post: { summary: 'Valider définitivement et verrouiller un bulletin', tags: ['Bulletins PDF'] },
    },
    '/report-cards/{id}/reopen': {
      post: { summary: 'Rouvrir un bulletin validé en mode brouillon', tags: ['Bulletins PDF'] },
    },
    '/report-cards/{id}/pdf': {
      get: { summary: 'Générer et télécharger le bulletin scolaire officiel au format PDF', tags: ['Bulletins PDF'] },
    },
  },
};

export const docsRouter = Router();

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});
