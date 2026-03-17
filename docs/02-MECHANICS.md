# KOURAKS — Mécaniques de Jeu

*Document de référence sur la boucle de gameplay, le calcul du yield et la progression.*

## 1. Boucle de Jeu (Game Loop)

Le jeu fonctionne sur un système de ticks.
`TICKS_SECONDS = 1` (peut être ajusté pour le rythme visuel).
À chaque tick (exécuté toutes les `1000 / TICKS_SECONDS` ms) :

1. Vérification des conditions de déblocage de nouveaux Tiers/Services/Mails. (Peut être bloquant si une modale de mails
   est ouverte).
2. Ajout de la production nette (`currentNetYield`) au total de Kouraks.
3. Évaluation des probabilités de crash pour chaque service déployé.
4. Vérification des KPI de chaque projet (s'ils ont atteint un checkpoint).
5. Gestion des états de redémarrage/déploiement.

*Note : Les unités de temps du modèle sont en secondes (`s`) ou inverse de secondes (`s⁻¹`). Les "trimestres" sont une
unité arbitraire de temps long pour les KPI.*

## 2. Système de Yield (Production)

La production de Kouraks est calculée en plusieurs étapes à chaque tick ou changement d'état.

### Étape 1 : Yield brut des services

Pour chaque service (`status: running|deploying|migrating`), calculer :

```
multipliers = [hardware.yieldMultiplier - 1]
for each service s in the same project (including self):
    if s.status == running:
        multipliers.push(s.yieldMultiplier - 1)
multiplier_total = 1 + SUM(multipliers)
service_yield = service.baseYield * multiplier_total
```

### Étape 2 : Limitation par le Hardware (Surcharge)

Pour chaque instance hardware :

1. Calculer `SUM(service_yield)` de tous les services assignés à ce hardware.
2. Si `SUM(service_yield) > hardware.maximumYield` :
    - Différence = `SUM(service_yield) - hardware.maximumYield`
    - Répartir cette différence négativement sur les services proportionnellement à leur yield.
    - On obtient le `effective_service_yield`.

### Étape 3 : Yield des Projets (La règle du maillon faible)

Pour chaque projet :

1. **Vérification des requirements** : Pour chaque type dans `serviceTypeRequirements` (et potentiellement
   `serviceRequirements` stricts), vérifier qu'il y a au moins un service en `running` assigné à ce projet.
2. Si un requirement manque (ou si un service vital est crashé), le projet est en défaut : `project_yield = 0`.
3. Si tout est valide : `project_yield = MIN(effective_service_yield de tous les services assignés au projet)`.

### Étape 4 : Yield Global Net

`total_gross_yield = SUM(project_yield)`
`global_yield = total_gross_yield * SUM(yieldMultiplier des services globaux)`
`currentNetYield = global_yield - SUM(recurringCost de tous les services et hardwares actifs)`

*(Le `yieldMultiplier` des services globaux n'est donc pas capé par `hardware.maximumYield`)*
*(Le net peut être négatif si les coûts dépassent la production).*

## 3. Système de Crash et Stabilité

Chaque service possède un `crashRate` (probabilité de crash par seconde).

- Lors d'un crash, le service passe en `crashed`, son yield devient 0 (ce qui met souvent tout le projet à 0 par la
  règle du `MIN()`).
- Le joueur doit manuellement relancer le service (ou utiliser une automatisation plus tard).
- Le redémarrage prend `restartDuration` secondes (`status: restarting`).
- Le hardware possède aussi un `crashRate` (généralement très faible).

## 4. Projets, KPI et Game Over

### Les KPI (Checkpoints)

- Un projet demande de produire une quantité cible (`targetProduction`) sur une période donnée (un "trimestre").
- À la fin du trimestre, le ratio `Kouraks produits / Kouraks attendus` est calculé.
- Si le ratio < 0.8 (80%) : le checkpoint échoue. Un strike est ajouté au projet.
- Au bout de **3 strikes** sur un projet : le projet est annulé (Mail du PDG incendiaire).
- Un projet annulé est retiré du jeu, ses services sont libérés, et le joueur perd la confiance du PDG.
- **Game Over :** Le joueur perd s'il accumule 3 annulations de projets au global.

### Migrations Forcées

Les projets ont des versions (v1, v2). À des moments précis (ticks ou events), une migration forcée est déclenchée. Les
`serviceTypeRequirements` changent subitement (ex: obligation d'ajouter un `message-queue`). Le projet tombe à 0 K/s
tant que le joueur n'achète et n'assigne pas le nouveau service requis.

## 5. Messages et Événements (Lore)

Les emails apparaissent en modale et **mettent le jeu en pause**.

- Déclencheurs : temps écoulé, paliers de Kouraks, échec de KPI.
- Peuvent proposer des choix : purement cosmétiques ou avec un impact mécanique mineur (+10% KPI, pause de prod).
- Ne se déclenchent qu'une seule fois (`id` unique stocké).
