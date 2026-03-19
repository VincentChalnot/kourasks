## HardwareInstance

| Action               | Conditions                                 | État de sortie                                                                                                   |
|----------------------|--------------------------------------------|------------------------------------------------------------------------------------------------------------------|
| `deploy(hardwareId)` | Hardware débloqué + Kouraks ≥ `deployCost` | `status = deploying`, `remainingDeployTime = deployTime`, Kouraks -= `deployCost`                                |
| `start`              | `status = stopped`                         | `status = restarting`, `remainingRestartTime = restartDuration`                                                  |
| `stop`               | `status ∈ {running, restarting}`           | `status = stopped`                                                                                               |
| `restart`            | `status = crashed`                         | `status = restarting`, `remainingRestartTime = restartDuration`                                                  |
| `sell`               | *(aucune)*                                 | Instance supprimée, services assignés → `status = stopped` + `assignedHardwareId = null`, Kouraks += `sellValue` |

## ServiceInstance

| Action                                               | Conditions                                                          | État de sortie                                                                                                                                                                                                |
|------------------------------------------------------|---------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `deploy(serviceVersionId)`                           | Version débloquée + Kouraks ≥ `deployCost`                          | `status = deploying`, `remainingDeployTime = deployTime`, Kouraks -= `deployCost`                                                                                                                             |
| `configure(hardwareInstanceId?, projectInstanceId?)` | Au moins un param fourni                                            | Si `hardwareInstanceId` change → `status = deploying`, `remainingDeployTime = deployTime` (timer figé tant que hardware pas `running`) ; sinon status inchangé. Mise à jour de `assignedProjectId` si fourni. |
| `update(serviceVersionId)`                           | Même `serviceId` + version débloquée + `serviceVersionId ≠ current` | `serviceVersionId` mis à jour, `status = restarting`, `remainingRestartTime = restartDuration`                                                                                                                |
| `start`                                              | `status = stopped`                                                  | `status = restarting`, `remainingRestartTime = restartDuration`                                                                                                                                               |
| `stop`                                               | `status ∈ {running, restarting}`                                    | `status = stopped`                                                                                                                                                                                            |
| `restart`                                            | `status = crashed`                                                  | `status = restarting`, `remainingRestartTime = restartDuration`                                                                                                                                               |
| `remove`                                             | *(aucune)*                                                          | Instance supprimée                                                                                                                                                                                            |

## MailInstance

| Action             | Conditions                                                 | État de sortie                                                           |
|--------------------|------------------------------------------------------------|--------------------------------------------------------------------------|
| `answer(optionId)` | `optionId` appartient au mail + `optionId` actuel = `null` | `optionId` mis à jour, jeu dépausé, `option.eventId` déclenché si défini |

