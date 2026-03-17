# KOURAKS — Vision et Philosophie

*Document de référence sur l'intention, le ton et les anti-patterns du jeu.*

## 1. Ce que c'est

**Kouraks** est un idle/clicker satirique qui critique l'over-engineering tech moderne en le faisant **vivre** au
joueur.
On ne dit jamais ce que sont les Kouraks, on ne justifie jamais pourquoi les projets existent — le flou est le message.

## 2. Positionnement unique

- **Seul jeu grand public** qui satirise la complexité technique moderne.
- **Pas un serious game** — une comédie noire jouable.
- **La complexification est le problème lui-même**, pas la solution.
- **L'endgame n'est pas une victoire** — c'est la réalisation horrifiée de la monstruosité qu'on a construite.

## 3. Public cible

- Devs/SRE/DevOps qui vivent la complexité quotidienne.
- Product managers qui imposent cette complexité sans la comprendre.
- Quiconque a travaillé en entreprise tech et veut rire jaune de son expérience.

## 4. Ton et Lore

- **Résignation sardonique** : Le joueur et le jeu sont complices de l'absurdité.
- **Flou absolu** : Aucune justification narrative sur l'utilité des projets (ex: "Synchro AlloPneumz : Synchronise des
  données. Vers où. Depuis quoi. On sait plus.").
- **Terminal System** : Des messages de log fatidiques (ex: "GRAs.js a crashé. Personne n'a vu venir.").

## 5. Ce Qu'on Ne Veut Surtout Pas (Anti-patterns)

### 5.1 Over-Engineering Technique

❌ **Interdictions strictes :**

- Ajouter React/Vue/Angular "pour faire propre"
- Créer un système de modules ES6 avec imports
- Mettre en place un bundler (Webpack, Vite)
- Ajouter TypeScript "pour la maintenabilité"
- Implémenter un routing
- Créer un backend Node.js pour les saves

**Règle d'or :** Si on fait ça, on devient ce qu'on satirise. Le code doit rester du Vanilla JS + Alpine.js + YAML dans
des fichiers statiques.

### 5.2 Feature Creep Gameplay

❌ **Features à ne pas ajouter :**

- Multiplayer / leaderboards
- Système de quêtes
- Achievements externes
- Minigames ou craft complexe

**Règle d'or :** Si une feature ne renforce pas la satire de l'over-engineering, on ne l'ajoute pas.

### 5.3 Justification Narrative

❌ **Ne jamais faire :**

- Expliquer ce que sont les Kouraks.
- Donner un contexte narratif à l'entreprise (secteur, histoire).
- Créer des personnages avec backstory (le PDG n'est qu'une entité qui envoie des mails absurdes).

**Règle d'or :** Briser le flou tue le jeu.

## 6. Timeline et Fin du Jeu

### 6.1 Timeline

Le jeu est découpé en trimestres : des tiers précis correspondant à des paliers de complexité.
Chaque trimestre introduit de nouveaux hardwares, de nouveaux services, des migrations forcées, et des KPI plus
exigeants.
Chaque trimestre correspond à un équivalent historique de l'évolution technologique :

| Tier | Époque | Projets actifs | Nouveaux services | Cumulé dispo | SaaS%   |
|:-----|:-------|:---------------|:------------------|:-------------|:--------|
| T1   | 1995   | 1              | 4                 | 4            | 0%      |
| T2   | 2000   | 2              | 5                 | 9            | 0%      |
| T3   | 2004   | 3              | 7                 | 16           | 12%     |
| T4   | 2008   | 4              | 8                 | 24           | 4%      |
| T5   | 2011   | 5              | 11                | 35           | 18%     |
| T6   | 2014   | 6              | 11                | 46           | 18%     |
| T7   | 2017   | 7              | 14                | 60           | 29%     |
| T8   | 2020   | 8              | 16                | 76           | 31%     |
| T9   | 2022   | 9              | 17                | 93           | 35%     |
| T10  | 2024   | 10             | 21                | **114**      | **38%** |

Les années sont données à titre indicatif pour le thème, pas comme une timeline stricte.

Un trimestre dure un temps fixe en jeu de 6 minutes (à ajuster selon le rythme de jeu). À la fin de chaque trimestre,
les KPI sont évalués, les migrations forcées sont déclenchées, et les nouveaux services sont débloqués.

### 6.2 Fin du Jeu

L'objectif n'est pas de "gagner" mais d'atteindre le point où la complexité devient insoutenable, et de se rendre compte
qu'on est complice de cette folie.
La fin du jeu est encore à définir, mais elle doit être un moment de révélation amère, pas une célébration.

- Rachat par un géant tech qui impose une migration forcée vers une stack encore plus absurde et licenciements massifs.
- Licenciement pour cause de remplacement par une IA, avec un mail de fin d'emploi qui est une satire de la
  communication corporate.