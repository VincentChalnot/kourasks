// data.js — Game configuration for Kouraks
// All user-facing strings are in French. Code/comments in English.

const GAME_CONFIG = {
  hardware: [
    { level: 1, name: 'Vieux Dell Reconditionnée', cost: 0, multiplier: 1.0 },
    { level: 2, name: 'Serveur Marmolaye 2U', cost: 500, multiplier: 1.5 },
    { level: 3, name: 'Rack Glandesque 42U', cost: 2500, multiplier: 2.5 },
    { level: 4, name: 'Cluster Talgoya', cost: 12000, multiplier: 5.0 },
    { level: 5, name: 'Datacenter Akénéo Piscine', cost: 80000, multiplier: 12.0 },
    { level: 6, name: 'Infrastructure KK Souveraine', cost: 500000, multiplier: 30.0 },
  ],

  services: [
    {
      id: 'gras-js', name: 'GRAs.js', serviceType: 'backend',
      description: 'Un framework. Personne ne sait pourquoi il tourne.',
      buyCost: 120, crashRate: 0.003, restartDuration: 8, autoRestart: false, unlockAt: 0,
    },
    {
      id: 'groblochon-js', name: 'GROBLOCHON.JS', serviceType: 'backend',
      description: 'Un framework plus gros. Personne ne sait pourquoi il existe.',
      buyCost: 800, crashRate: 0.002, restartDuration: 8, autoRestart: false, unlockAt: 2000,
    },
    {
      id: 'fromage-worker', name: 'FromAge Worker', serviceType: 'backend',
      description: 'Un worker. Il travaille. Parfois.',
      buyCost: 3500, crashRate: 0.004, restartDuration: 8, autoRestart: false, unlockAt: 15000,
    },
    {
      id: 'moisql', name: 'MoïSQL 3.0', serviceType: 'database',
      description: 'Une base de données. Les données sont dedans. Normalement.',
      buyCost: 200, crashRate: 0.002, restartDuration: 8, autoRestart: false, unlockAt: 0,
    },
    {
      id: 'chocolat-db', name: 'chocolatRequestDatabase', serviceType: 'database',
      description: 'Une base de données au chocolat. Personne ne sait ce que ça veut dire.',
      buyCost: 1200, crashRate: 0.001, restartDuration: 8, autoRestart: false, unlockAt: 5000,
    },
    {
      id: 'roquefort-cluster', name: 'Roquefort Cluster', serviceType: 'message-queue',
      description: 'Un cluster de messages. Ça sent le roquefort.',
      buyCost: 600, crashRate: 0.005, restartDuration: 8, autoRestart: false, unlockAt: 1000,
    },
    {
      id: 'napping-queue', name: 'Napping Queue', serviceType: 'message-queue',
      description: 'Une queue de messages. Elle fait la sieste.',
      buyCost: 2000, crashRate: 0.003, restartDuration: 8, autoRestart: false, unlockAt: 8000,
    },
    {
      id: 'vieux-dis', name: 'VieuxDis', serviceType: 'cache',
      description: 'Un cache. Il oublie parfois.',
      buyCost: 150, crashRate: 0.004, restartDuration: 8, autoRestart: false, unlockAt: 0,
    },
    {
      id: 'rate-limiter', name: 'Rate Limiter Talgoya', serviceType: 'cache',
      description: 'Un cache qui limite. Quoi exactement. On ne sait pas.',
      buyCost: 900, crashRate: 0.002, restartDuration: 8, autoRestart: false, unlockAt: 3000,
    },
    {
      id: 'petit-wrap', name: 'Petit Wrap', serviceType: 'reverse-proxy',
      description: 'Un reverse proxy. Petit mais costaud. Enfin, petit.',
      buyCost: 300, crashRate: 0.002, restartDuration: 8, autoRestart: false, unlockAt: 500,
    },
    {
      id: 'inverse-proxi', name: 'InverseProxi', serviceType: 'reverse-proxy',
      description: 'Un proxy inversé. Ou un inverse proxié. On ne sait plus.',
      buyCost: 1800, crashRate: 0.001, restartDuration: 8, autoRestart: false, unlockAt: 10000,
    },
    {
      id: 'champ-talgoya', name: 'Champ Talgoya', serviceType: 'search',
      description: 'Un moteur de recherche. Il cherche. Il ne trouve pas toujours.',
      buyCost: 400, crashRate: 0.003, restartDuration: 8, autoRestart: false, unlockAt: 800,
    },
    {
      id: 'elastibeurre', name: 'ElastiBeurre', serviceType: 'search',
      description: 'Un moteur de recherche au beurre. Indexation lente mais onctueuse.',
      buyCost: 2500, crashRate: 0.002, restartDuration: 8, autoRestart: false, unlockAt: 20000,
    },
    {
      id: 'noisetier-api', name: 'Noisetier API v2', serviceType: 'iam',
      description: 'Une API d\'authentification. La v1 a été perdue.',
      buyCost: 700, crashRate: 0.002, restartDuration: 8, autoRestart: false, unlockAt: 2500,
    },
    {
      id: 'kitkat-merger', name: 'Cluster KitKat Merger', serviceType: 'iam',
      description: 'Un cluster d\'identité. Personne ne sait qui est qui.',
      buyCost: 4000, crashRate: 0.001, restartDuration: 8, autoRestart: false, unlockAt: 30000,
    },
    {
      id: 'raclette-bundle', name: 'Raclette Bundle v3', serviceType: 'bundler',
      description: 'Un bundler. La v1 et la v2 sont en prod aussi.',
      buyCost: 250, crashRate: 0.006, restartDuration: 8, autoRestart: false, unlockAt: 400,
    },
    {
      id: 'chantilly-deco', name: 'Chantilly Décorator v1.2-dev#alpha', serviceType: 'bundler',
      description: 'Un bundler en alpha. Depuis 3 ans.',
      buyCost: 1500, crashRate: 0.008, restartDuration: 8, autoRestart: false, unlockAt: 6000,
    },
  ],

  leaves: [
    {
      id: 'synchro-allopneus', name: 'Synchro Allopneus', isLeaf: true,
      requires: ['database', 'backend', 'message-queue'], baseYield: 15, unlockAt: 0,
      description: 'Synchronise des données. Vers où. Depuis quoi. On sait plus.',
    },
    {
      id: 'champ-akeneobl', name: 'Champ Akénéo Piscine VIII de Blé', isLeaf: true,
      requires: ['database', 'search'], baseYield: 30, unlockAt: 800,
      description: 'Un champ. Dans un PIM. Pour une piscine. C\'est en prod depuis 2019.',
    },
    {
      id: 'migration-kk', name: 'Migration KK', isLeaf: true,
      requires: ['database', 'backend', 'iam'], baseYield: 55, unlockAt: 3000,
      description: 'La migration est prévue depuis 2021. Elle est toujours en cours. Le budget est reconduit.',
    },
    {
      id: 'projet-talgoya', name: 'Projet Talgoya', isLeaf: true,
      requires: ['backend', 'message-queue', 'cache'], baseYield: 80, unlockAt: 8000,
      description: 'Personne dans l\'entreprise ne peut expliquer ce que c\'est. Personne n\'ose demander.',
    },
    {
      id: 'dashboard-codir', name: 'Dashboard Stratégique CODIR', isLeaf: true,
      requires: ['backend', 'database', 'bundler'], baseYield: 120, unlockAt: 20000,
      description: 'Un dashboard que le CODIR regarde une fois par trimestre et qu\'il ne comprend pas.',
    },
    {
      id: 'cookie-factory', name: 'Cookie Factory', isLeaf: true,
      requires: ['backend', 'database', 'iam', 'reverse-proxy'], baseYield: 200, unlockAt: 60000,
      description: 'Génère des cookies. Lesquels. Pourquoi. Le ticket JIRA est fermé.',
    },
    {
      id: 'glanduju', name: 'Glanduju.js', isLeaf: true,
      requires: ['backend', 'bundler', 'cache', 'search'], baseYield: 350, unlockAt: 150000,
      description: 'Le projet le plus important de l\'entreprise selon la roadmap Q3 2022.',
    },
  ],

  crashMessages: [
    '{name} a crashé. Personne n\'a vu venir.',
    '{name} est tombé. Le monitoring n\'a rien dit.',
    '{name} s\'est arrêté. Comme chaque lundi.',
    '{name} a rencontré une erreur inattendue. Comme prévu.',
    '{name} crash. Ticket ouvert. Priorité: basse.',
    'FATAL: {name}. Bonne chance.',
    '{name} a décidé de prendre une pause.',
  ],

  restartMessages: [
    '{name} redémarre. Ça va le faire.',
    '{name} est de retour. Pour l\'instant.',
    '{name} répond à nouveau. Ne pas trop compter dessus.',
  ],

  milestones: [
    { threshold: 14, message: '14 Kouraks ! Tout le monde s\'éclate !' },
    { threshold: 1000, message: '1 000 Kouraks. Le CODIR est content. Il ne sait pas pourquoi.' },
    { threshold: 10000, message: '10 000 Kouraks. Un consultant va bientôt arriver.' },
    { threshold: 100000, message: '100 000 Kouraks. On parle de réécrire tout ça en microservices.' },
    { threshold: 1000000, message: '1 000 000 Kouraks. C\'était mieux avant.' },
  ],

  serviceTypeLabels: {
    'backend': 'Backend',
    'database': 'Base de données',
    'message-queue': 'Message Queue',
    'cache': 'Cache',
    'reverse-proxy': 'Reverse Proxy',
    'search': 'Recherche',
    'iam': 'IAM',
    'bundler': 'Bundler',
  },
};
