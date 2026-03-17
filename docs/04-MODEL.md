# KOURAKS — Modèle de Données

*Spécification des entités du jeu et de leurs propriétés.*

Règles générales :

- Les instances sont créées au runtime du jeu et sauvegardées en local storage, elles ne sont pas définies dans le Yaml
  de configuration.
- Tous les champs obligatoires ont un type marqué d'un astérisque dans les tableaux ci-dessous.
- Tous les champs avec une valeur null n'ont pas besoin d'être renseignés dans le Yaml de configuration.

## Propriétés communes

Les propriétés suivantes sont communes à tous les types d'entités (Project, Project Version, Service, Service Version,
Hardware, Mail...) sauf les instances et permettent de gérer leur disponibilité dans le temps :

| Propriété           | Type    | Description                                   |
|---------------------|---------|-----------------------------------------------|
| `id`                | string* | Identifiant unique, tout types confondus      |
| `eventId`           | string  | ID d'événement à déclencher lors du déblocage |
| `name`              | string* | Nom affiché                                   |
| `description`       | string* | Description satirique                         |
| `unlockAtTrimester` | float   | Le composant est débloqué à ce trimestre      |
| `unlockAtEvent`     | string  | ID d'un événement qui débloque ce composant   |

Quand deux champs de déblocage sont définis (`unlockAtTrimester` et `unlockAtEvent`), le composant est débloqué dès que
l'une des conditions est remplie. Si aucun des deux champs de déblocage n'est défini, le composant est disponible dès le
début de la partie.

## Propriétés communes aux hardwares et services versions (stack components)

Les hardwares et versions de service ont tous les deux un ensemble de propriétés communes supplémentaires qui s'ajoutent
aux propriétés globales (voir ci-dessus) :

| Propriété         | Type   | Description                                     |
|-------------------|--------|-------------------------------------------------|
| *Champs communs*  |        | Voir "Propriétés communes" ci-dessus            |
| `deployCost`      | float  | Prix d'achat en Kouraks (0 = gratuit)           |
| `deployTime`      | float  | Temps de déploiement en secondes                |
| `recurringCost`   | float  | Drain en K/s (SaaS, abonnements...)             |
| `crashRate`       | float  | Probabilité de plantage par seconde             |
| `restartDuration` | float  | Temps pour repasser en `running` après plantage |
| `yieldMultiplier` | float  | Multiplicateur (voir ci-dessous)                |
| `deployEventId`   | string | ID d'événement déclenché lors du déploiement    |
| `crashEventId`    | string | ID d'événement déclenché en cas de plantage     |
| `restartEventId`  | string | ID d'événement déclenché lors du redémarrage    |

*`yieldMultiplier`: Si le composant est un service, ce multiplicateur est appliqué aux autres services du projet (ou à
tous les services déployés si global). Si le composant est un hardware, appliqué aux services éxécuté dessus.*

## 1. Project (Projet)

Représente une source de revenus de Kouraks.

| Propriété        | Type   | Description                                                            |
|------------------|--------|------------------------------------------------------------------------|
| *Champs communs* |        | Voir "Propriétés communes" ci-dessus                                   |
| `versions`       | array  | Liste des différentes versions du projet                               |
| `strikeEventId`  | string | ID d'événement déclenché en cas d'échec du KPI                         |
| `failureEventId` | string | ID d'événement déclenché en cas de disparition du projet (strikes ≥ 3) |

### Project Version

| Propriété                 | Type          | Description                                                        |
|---------------------------|---------------|--------------------------------------------------------------------|
| *Champs communs*          |               | Voir "Propriétés communes" ci-dessus                               |
| `version`                 | string*       | Numéro ou nom (ex: `v1`, `v2.4`)                                   |
| `targetProduction`        | int*          | Quantité de K à produire par trimestre pour survivre au KPI        |
| `serviceTypeRequirements` | array[string] | Liste des types de services requis (ex: `['database', 'backend']`) |
| `serviceRequirements`     | array[string] | Liste d'IDs stricts requis (rare, ex: `['OurSQL_v4']`)             |

Un requirement peut être remplis par un service assigné au projet ou un service global. Un service global peut remplir
les requirements de plusieurs projets à la fois.

### Project Instance

Représente une instance de projet en cours de jeu, avec son historique de production.

| Propriété           | Type         | Description                                                                           |
|---------------------|--------------|---------------------------------------------------------------------------------------|
| `projectId`         | string*      | ID du projet ciblée                                                                   |
| `currentVersionId`  | string       | ID de la version actuellement active (null si aucune version n'est active)            |
| `strikes`           | int*         | Défaut 0, nombre de trimestres passés en dessous du `targetProduction`                |
| `currentProduction` | float*       | Défaut 0, sert à stocker la production temporaire en K entre deux **secondes** de jeu |
| `productionHistory` | array[float] | Historique de production (K produits pour chaque seconde en jeu)                      |

*`currentVersionId` est mis à jour lors du passage à une nouvelle version du projet, c'est juste un accès rapide à la
version en cours pour éviter de recalculer à chaque fois quelle version est active*

*Si `strikes` atteint 3 le projet ne doit plus être affiché*

*Lors de chaque tick de jeu la production de chaque projet est ajoutée à `currentProduction` et c'est seulement après
une seconde complète de jeu qu'on ajoute `currentProduction` à `productionHistory` et qu'on reset `currentProduction` à
0.*

## 2. Service

Représente une brique logicielle ou SaaS, on parle ici de la marque et pas de la version spécifique (ex: `OurSQL` et pas
`OurSQL v4`).

| Propriété        | Type    | Description                                                                            |
|------------------|---------|----------------------------------------------------------------------------------------|
| *Champs communs* |         | Voir "Propriétés communes" ci-dessus                                                   |
| `type`           | string* | Catégorie (`backend`, `database`, `cdn`, `financial`...)                               |
| `global`         | bool    | Défautl false, si `true`, s'applique à tous les projets. N'a pas de `project` assigné. |
| `versions`       | array   | Versions du service                                                                    |

### Service Version

Pour les versions de service, le nom représente la version spécifique (`v4` pour `OurSQL v4`), tandis que les autres
propriétés définissent les caractéristiques de cette version.
Un service peut avoir plusieurs versions, chacune apparaissant à des trimestres différents et avec des caractéristiques
différentes (ex: `OurSQL v4` est plus rapide que `OurSQL v3` mais a un coût de déploiement plus élevé).
La migration vers une version plus récente d'un service déjà déployé n'est pas automatique, le joueur doit choisir de
redéployer le service pour bénéficier de la nouvelle version.

| Propriété               | Type  | Description                                                         |
|-------------------------|-------|---------------------------------------------------------------------|
| *Champs communs*        |       | Voir "Propriétés communes" ci-dessus                                |
| `baseYield`             | float | Capacité brute en K/s                                               |
| `requireHardware`       | bool  | Défaut à `true` (on-prem), `false` pour SaaS                        |
| `deprecatedAtTrimester` | float | Trimestre à partir duquel la version est dépréciée (null si jamais) |

Si un service n'a pas de `baseYield` défini, il ne doit pas être pris en compte dans le calcul de la production totale
du projet ou de la charge serveur. (null ≠ 0)

Une version dépréciée est toujours fonctionnelle par contre son crashRate va augmenter avec le temps (mécanique à
définir).

### Service Instance

Représente l'instance déployée d'une version de service, avec son état au runtime.

| Propriété              | Type         | Description                                                                           |
|------------------------|--------------|---------------------------------------------------------------------------------------|
| `serviceId`            | string*      | ID du service ciblé                                                                   |
| `serviceVersionId`     | string*      | ID de la version de service déployée                                                  |
| `status`               | string*      | État actuel de l'instance (voir ci-dessous)                                           |
| `assignedProjectId`    | string       | ID du projet cible (null si global)                                                   |
| `assignedHardwareId`   | string       | ID de l'instance hardware cible (null si pas de hardware requis)                      |
| `remainingRestartTime` | float        | Temps restant avant de repasser en `running` après `restarting` ou `stopped`          |
| `remainingDeployTime`  | float        | Temps restant avant de repasser en `running` après `deploying`                        |
| `currentProduction`    | float*       | Défaut 0, sert à stocker la production temporaire en K entre deux **secondes** de jeu |
| `productionHistory`    | array[float] | Historique de production (K produits pour chaque seconde en jeu)                      |

On garde à la fois le serviceId (qui ne peut jamais changer) et le serviceVersionId qui peut changer lors de mises à
jour. (Une mise à jour consiste simplement à aller configurer le service, choisir la nouvelle version et cliquer sur "
déployer" pour appliquer les changements)

**Status possibles :** `deploying`, `running`, `crashed`, `restarting`, `stopped`

*Lors de chaque tick de jeu la production de chaque instance est ajoutée à `currentProduction` et c'est seulement après
une seconde complète de jeu qu'on ajoute `currentProduction` à `productionHistory` et qu'on reset `currentProduction` à
0.*

## 3. Hardware

L'infrastructure physique achetée ou louée (Dédié/VPS).

| Propriété        | Type  | Description                                         |
|------------------|-------|-----------------------------------------------------|
| *Champs communs* |       | Voir "Propriétés communes" ci-dessus                |
| `maximumYield`   | float | Plafond de production max supporté avant throttling |
| `sellValue`      | float | Valeur de revente (défaut 15% de `deployCost`)      |

Les crashs hardware doivent rester plus rares que les crashs de services.

### Hardware Instance

Représente une instance de hardware en cours de jeu, avec son état au runtime.

| Propriété           | Type   | Description                                                 |
|---------------------|--------|-------------------------------------------------------------|
| `hardwareId`        | string | ID du hardware déployé                                      |
| `status`            | string | État actuel de l'instance (voir ci-dessous)                 |
| `currentProduction` | float  | Stockage temporaire entre deux **secondes** de jeu          |
| `productionHistory` | array  | Historique de yield (K produits pour chaque seconde en jeu) |

**Status possibles :** `deploying`, `running`, `crashed`, `restarting`, `stopped`

*Attention, ici la production de Kouraks du hardware correspond à la somme de tous les services hébergés sur ce
hardware, et pas à une production propre comme pour les projets ou les services. Il faut voir ça comme un indicateur de
charge qui permet de vérifier que la production totale reste en dessous du `maximumYield` du hardware*

Quand un hardware est vendu, il est retiré du jeu et tous les services hébergés dessus sont stoppés (passent en
`stopped`), le joueur doit les redéployer sur un autre hardware pour les relancer. On ne conserve pas d'historique des
hardwares possédés puis vendus.

## 4. Mail (Message)

Événements narratifs bloquants.

| Propriété        | Type   | Description                          |
|------------------|--------|--------------------------------------|
| *Champs communs* |        | Voir "Propriétés communes" ci-dessus |
| `from`           | string | Expéditeur                           |
| `options`        | array  | Choix de réponse                     |

Le champ `name` disponible dans les propriétés communes sert de titre et le champ `description` sert de corps du
message.

### Mail Option

| Propriété        | Type | Description                          |
|------------------|------|--------------------------------------|
| *Champs communs* |      | Voir "Propriétés communes" ci-dessus |

Le champ `name` disponible dans les propriétés communes sert de texte pour l'option.

### Mail Instance

On crée une instance à chaque fois qu'un mail est débloqué, elle permet de stocker le choix de réponse du joueur et de
déclencher les effets associés à ce choix.

| Propriété  | Type   | Description                                                      |
|------------|--------|------------------------------------------------------------------|
| `mailId`   | string | ID du mail qui a été débloqué                                    |
| `optionId` | string | ID de l'option choisie (null tant que le joueur n'a pas répondu) |

Si on charge la partie à un point où un mail a déjà été débloqué, mais pas encore répondu, on affiche le mail.
Donc le workflow c'est : On regarde tous les mails qui doivent être débloqués, on enregistre une instance pour chacun
d'eux, on sauve la partie systématiquement dans ce cas, car un mail est un jalon bloquant et seulement ensuite, on
affiche les mails qui n'ont pas encore de `optionId` (pas encore répondu). De cette façon, on est sûr que le joueur ne
peut pas "rater" un mail important même s'il charge une partie ancienne.

### 5. Events (Événement)

À chaque fois qu'un composant est débloqué ou déployé, il déclenche un événement métier si son champ `eventId` est
défini. Ces événements peuvent être utilisés comme conditions de déblocage pour d'autres composants ou mails, ou pour
faire évoluer la narration du jeu.

On garde une trace de tous les événements déclenchés dans la partie, avec leur timestamp :

| Propriété   | Type   | Description                                           |
|-------------|--------|-------------------------------------------------------|
| `eventId`   | string | Identifiant de l'événement déclenché                  |
| `timestamp` | float  | Temps écoulé en secondes depuis le début de la partie |
