// KOURAKS — Pure Domain Engine
// No DOM access, no Alpine.js, no setInterval, no Math.random()
// Every function takes state+config and returns new state (reducer pattern)

// ========== CONSTANTS (defaults, overridable via config.constants) ==========

const DEFAULTS = {
	TRIMESTER_DURATION: 360,
	KPI_FAILURE_THRESHOLD: 0.8,
	STRIKE_LIMIT: 3,
	GAME_OVER_FAILURE_LIMIT: 3,
	HARDWARE_SELL_RATIO: 0.15,
};

function getConst(config, name) {
	return config.constants?.[name] ?? DEFAULTS[name];
}

// ========== CONFIG LOOKUP HELPERS ==========

function findHardware(config, id) {
	return config.hardware.find((h) => h.id === id) || null;
}

function findService(config, id) {
	return config.services.find((s) => s.id === id) || null;
}

function findServiceVersion(config, versionId) {
	for (const service of config.services) {
		const version = service.versions?.find((v) => v.id === versionId);
		if (version) return version;
	}
	return null;
}

function findServiceForVersion(config, versionId) {
	for (const service of config.services) {
		if (service.versions?.some((v) => v.id === versionId)) return service;
	}
	return null;
}

function findProject(config, id) {
	return config.projects.find((p) => p.id === id) || null;
}

function findProjectVersion(config, projectId, versionId) {
	const project = findProject(config, projectId);
	return project?.versions?.find((v) => v.id === versionId) || null;
}

function findMail(config, id) {
	return config.mails.find((m) => m.id === id) || null;
}

// ========== STATE CREATION ==========

function createInitialState(initialKouraks = 0) {
	return {
		kouraks: initialKouraks,
		elapsedSeconds: 0,
		paused: false,
		gameOver: false,
		firedEventIds: [],
		hardwareInstances: [],
		serviceInstances: [],
		projectInstances: [],
		mailInstances: [],
		projectFailures: 0,
		lastSecond: 0,
		nextInstanceId: 1,
		unlockedIds: [],
	};
}

// ========== PURE HELPERS ==========

function isUnlocked(entity, state, config) {
	if (!entity) return false;

	const trimesterDuration = getConst(config, "TRIMESTER_DURATION");
	const currentTrimester = state.elapsedSeconds / trimesterDuration;

	// Check trimester unlock
	if (entity.unlockAtTrimester != null) {
		if (currentTrimester >= entity.unlockAtTrimester) return true;
	}

	// Check event unlock
	if (entity.unlockAtEvent) {
		if (state.firedEventIds.includes(entity.unlockAtEvent)) return true;
	}

	// If no unlock conditions defined, unlocked by default
	if (entity.unlockAtTrimester == null && !entity.unlockAtEvent) return true;

	return false;
}

function getActiveProjectVersion(config, state, project) {
	if (!project?.versions) return null;
	const unlockedVersions = project.versions.filter((v) =>
		isUnlocked(v, state, config),
	);
	return unlockedVersions[unlockedVersions.length - 1] || null;
}

function getCurrentProjectVersion(config, state, projInstance) {
	if (projInstance.currentVersionId) {
		return findProjectVersion(
			config,
			projInstance.projectId,
			projInstance.currentVersionId,
		);
	}
	const project = findProject(config, projInstance.projectId);
	return getActiveProjectVersion(config, state, project);
}

function isServiceBlockedByHardware(state, svcInstance) {
	if (!svcInstance.assignedHardwareId) return false;
	const hwInstance = state.hardwareInstances.find(
		(h) => h.id === svcInstance.assignedHardwareId,
	);
	if (!hwInstance) return false;
	return hwInstance.status !== "running";
}

function isServiceAwaitingHardware(config, svcInstance) {
	const version = findServiceVersion(config, svcInstance.serviceVersionId);
	if (!version) return false;
	return !!version.requireHardware && !svcInstance.assignedHardwareId;
}

function getServicesOnHardware(state, hardwareInstanceId) {
	return state.serviceInstances.filter(
		(svc) => svc.assignedHardwareId === hardwareInstanceId,
	);
}

function checkProjectRequirements(state, config, projInstance, version) {
	const typeReqs = version.serviceTypeRequirements || [];
	const strictReqs = version.serviceRequirements || [];

	for (const reqType of typeReqs) {
		const hasService = state.serviceInstances.some((svc) => {
			const service = findService(config, svc.serviceId);
			return (
				svc.status === "running" &&
				service?.type === reqType &&
				(svc.assignedProjectId === projInstance.projectId || service?.global)
			);
		});
		if (!hasService) return false;
	}

	for (const reqId of strictReqs) {
		const hasService = state.serviceInstances.some((svc) => {
			const service = findService(config, svc.serviceId);
			return (
				svc.status === "running" &&
				svc.serviceVersionId === reqId &&
				(svc.assignedProjectId === projInstance.projectId || service?.global)
			);
		});
		if (!hasService) return false;
	}

	return true;
}

// ========== YIELD CALCULATION ==========

function computeYieldDetails(state, config) {
	const serviceYields = new Map();
	let totalRecurringCost = 0;

	// Step 1: Raw service yields with multipliers
	for (const svc of state.serviceInstances) {
		if (svc.status !== "running") continue;
		const version = findServiceVersion(config, svc.serviceVersionId);
		if (!version) continue;

		if (version.baseYield != null) {
			const multipliers = [];

			// Hardware multiplier
			if (svc.assignedHardwareId) {
				const hwInstance = state.hardwareInstances.find(
					(h) => h.id === svc.assignedHardwareId,
				);
				if (hwInstance?.status === "running") {
					const hw = findHardware(config, hwInstance.hardwareId);
					if (hw) multipliers.push(hw.yieldMultiplier - 1);
				}
			}

			// Service multipliers from same project (including self)
			if (svc.assignedProjectId) {
				for (const otherSvc of state.serviceInstances) {
					if (
						otherSvc.status === "running" &&
						otherSvc.assignedProjectId === svc.assignedProjectId
					) {
						const otherVersion = findServiceVersion(
							config,
							otherSvc.serviceVersionId,
						);
						if (otherVersion)
							multipliers.push(otherVersion.yieldMultiplier - 1);
					}
				}
			}

			const multiplierTotal = 1 + multipliers.reduce((sum, m) => sum + m, 0);
			serviceYields.set(svc.id, version.baseYield * multiplierTotal);
		}

		totalRecurringCost += version.recurringCost || 0;
	}

	// Step 2: Hardware throttling
	for (const hwInstance of state.hardwareInstances) {
		if (hwInstance.status !== "running") continue;
		const hw = findHardware(config, hwInstance.hardwareId);
		if (!hw) continue;

		const servicesOnHw = getServicesOnHardware(state, hwInstance.id);
		let totalLoad = 0;
		for (const svc of servicesOnHw) {
			totalLoad += serviceYields.get(svc.id) || 0;
		}

		if (totalLoad > hw.maximumYield) {
			const throttleFactor = hw.maximumYield / totalLoad;
			for (const svc of servicesOnHw) {
				const currentYield = serviceYields.get(svc.id) || 0;
				serviceYields.set(svc.id, currentYield * throttleFactor);
			}
		}

		totalRecurringCost += hw.recurringCost || 0;
	}

	// Step 3: Project yields (weakest link rule)
	let totalGrossYield = 0;
	const projectYields = new Map();

	for (const projInstance of state.projectInstances) {
		const strikeLimit = getConst(config, "STRIKE_LIMIT");
		if (projInstance.strikes >= strikeLimit) continue;

		const version = getCurrentProjectVersion(config, state, projInstance);
		if (!version) continue;

		const requirementsMet = checkProjectRequirements(
			state,
			config,
			projInstance,
			version,
		);

		if (requirementsMet) {
			const projectServices = state.serviceInstances.filter(
				(svc) =>
					svc.status === "running" &&
					(svc.assignedProjectId === projInstance.projectId ||
						findService(config, svc.serviceId)?.global),
			);

			const yields = projectServices
				.filter((svc) => serviceYields.has(svc.id))
				.map((svc) => serviceYields.get(svc.id));

			if (yields.length > 0) {
				const projectYield = Math.min(...yields);
				totalGrossYield += projectYield;
				projectYields.set(projInstance.projectId, projectYield);
			}
		}
	}

	// Step 4: Global multiplier and net yield
	let globalMultiplier = 1;
	for (const svc of state.serviceInstances) {
		if (svc.status !== "running") continue;
		const service = findService(config, svc.serviceId);
		if (!service?.global) continue;
		const version = findServiceVersion(config, svc.serviceVersionId);
		if (version) globalMultiplier += version.yieldMultiplier - 1;
	}

	const globalYield = totalGrossYield * globalMultiplier;
	const netYield = globalYield - totalRecurringCost;

	return { serviceYields, projectYields, globalMultiplier, netYield };
}

function computeNetYield(state, config) {
	return computeYieldDetails(state, config).netYield;
}

// ========== EVENT FIRING HELPER ==========

function fireEvent(firedEventIds, eventId) {
	if (!eventId) return firedEventIds;
	return [...firedEventIds, eventId];
}

// ========== ACTIONS ==========

function generateId(state) {
	return `inst_${state.nextInstanceId}`;
}

function applyAction(state, config, action) {
	switch (action.type) {
		case "hardware.deploy":
			return applyHardwareDeploy(state, config, action);
		case "hardware.start":
			return applyHardwareStart(state, config, action);
		case "hardware.stop":
			return applyHardwareStop(state, config, action);
		case "hardware.restart":
			return applyHardwareRestart(state, config, action);
		case "hardware.sell":
			return applyHardwareSell(state, config, action);
		case "service.deploy":
			return applyServiceDeploy(state, config, action);
		case "service.configure":
			return applyServiceConfigure(state, config, action);
		case "service.update":
			return applyServiceUpdate(state, config, action);
		case "service.start":
			return applyServiceStart(state, config, action);
		case "service.stop":
			return applyServiceStop(state, config, action);
		case "service.restart":
			return applyServiceRestart(state, config, action);
		case "service.remove":
			return applyServiceRemove(state, config, action);
		case "mail.answer":
			return applyMailAnswer(state, config, action);
		default:
			return state;
	}
}

function applyHardwareDeploy(state, config, action) {
	const hw = findHardware(config, action.hardwareId);
	if (!hw || !isUnlocked(hw, state, config)) return state;
	if (state.kouraks < hw.deployCost) return state;

	const instanceId = generateId(state);
	return {
		...state,
		kouraks: state.kouraks - hw.deployCost,
		nextInstanceId: state.nextInstanceId + 1,
		hardwareInstances: [
			...state.hardwareInstances,
			{
				id: instanceId,
				hardwareId: hw.id,
				status: "deploying",
				remainingDeployTime: hw.deployTime,
				remainingRestartTime: 0,
				currentProduction: 0,
				productionHistory: [],
			},
		],
		firedEventIds: fireEvent(state.firedEventIds, hw.deployEventId),
	};
}

function applyHardwareStart(state, config, action) {
	const idx = state.hardwareInstances.findIndex(
		(h) => h.id === action.instanceId,
	);
	if (idx === -1) return state;
	const instance = state.hardwareInstances[idx];
	if (instance.status !== "stopped") return state;

	const hw = findHardware(config, instance.hardwareId);
	if (!hw) return state;

	const updated = {
		...instance,
		status: "restarting",
		remainingRestartTime: hw.restartDuration,
	};
	const hardwareInstances = [...state.hardwareInstances];
	hardwareInstances[idx] = updated;
	return { ...state, hardwareInstances };
}

function applyHardwareStop(state, _config, action) {
	const idx = state.hardwareInstances.findIndex(
		(h) => h.id === action.instanceId,
	);
	if (idx === -1) return state;
	const instance = state.hardwareInstances[idx];
	if (instance.status !== "running" && instance.status !== "restarting")
		return state;

	const updated = { ...instance, status: "stopped" };
	const hardwareInstances = [...state.hardwareInstances];
	hardwareInstances[idx] = updated;
	return { ...state, hardwareInstances };
}

function applyHardwareRestart(state, config, action) {
	const idx = state.hardwareInstances.findIndex(
		(h) => h.id === action.instanceId,
	);
	if (idx === -1) return state;
	const instance = state.hardwareInstances[idx];
	if (instance.status !== "crashed") return state;

	const hw = findHardware(config, instance.hardwareId);
	if (!hw) return state;

	const updated = {
		...instance,
		status: "restarting",
		remainingRestartTime: hw.restartDuration,
	};
	const hardwareInstances = [...state.hardwareInstances];
	hardwareInstances[idx] = updated;
	return { ...state, hardwareInstances };
}

function applyHardwareSell(state, config, action) {
	const idx = state.hardwareInstances.findIndex(
		(h) => h.id === action.instanceId,
	);
	if (idx === -1) return state;
	const instance = state.hardwareInstances[idx];

	const hw = findHardware(config, instance.hardwareId);
	if (!hw) return state;

	const sellRatio = getConst(config, "HARDWARE_SELL_RATIO");
	const sellValue = hw.sellValue || hw.deployCost * sellRatio;

	// Stop and unassign all services on this hardware
	const serviceInstances = state.serviceInstances.map((svc) => {
		if (svc.assignedHardwareId === instance.id) {
			return { ...svc, status: "stopped", assignedHardwareId: null };
		}
		return svc;
	});

	return {
		...state,
		kouraks: state.kouraks + sellValue,
		hardwareInstances: state.hardwareInstances.filter(
			(h) => h.id !== instance.id,
		),
		serviceInstances,
	};
}

function applyServiceDeploy(state, config, action) {
	const version = findServiceVersion(config, action.serviceVersionId);
	if (!version) return state;
	if (!isUnlocked(version, state, config)) return state;
	if (state.kouraks < version.deployCost) return state;

	const service = findServiceForVersion(config, action.serviceVersionId);
	if (!service) return state;

	const instanceId = generateId(state);
	return {
		...state,
		kouraks: state.kouraks - version.deployCost,
		nextInstanceId: state.nextInstanceId + 1,
		serviceInstances: [
			...state.serviceInstances,
			{
				id: instanceId,
				serviceId: service.id,
				serviceVersionId: version.id,
				status: "deploying",
				assignedProjectId: action.projectId || null,
				assignedHardwareId: action.hardwareId || null,
				remainingRestartTime: 0,
				remainingDeployTime: version.deployTime,
				currentProduction: 0,
				productionHistory: [],
			},
		],
		firedEventIds: fireEvent(state.firedEventIds, version.deployEventId),
	};
}

function applyServiceConfigure(state, config, action) {
	const idx = state.serviceInstances.findIndex(
		(s) => s.id === action.instanceId,
	);
	if (idx === -1) return state;

	if (action.hardwareInstanceId == null && action.projectId == null)
		return state;

	const instance = state.serviceInstances[idx];
	const version = findServiceVersion(config, instance.serviceVersionId);
	const updated = { ...instance };

	const hardwareChanged =
		action.hardwareInstanceId !== undefined &&
		action.hardwareInstanceId !== instance.assignedHardwareId;

	if (hardwareChanged) {
		updated.assignedHardwareId = action.hardwareInstanceId || null;
		updated.status = "deploying";
		updated.remainingDeployTime = version?.deployTime || 0;
	}

	if (action.projectId !== undefined) {
		updated.assignedProjectId = action.projectId || null;
	}

	const serviceInstances = [...state.serviceInstances];
	serviceInstances[idx] = updated;
	return { ...state, serviceInstances };
}

function applyServiceUpdate(state, config, action) {
	const idx = state.serviceInstances.findIndex(
		(s) => s.id === action.instanceId,
	);
	if (idx === -1) return state;

	const instance = state.serviceInstances[idx];
	const newVersion = findServiceVersion(config, action.serviceVersionId);
	if (!newVersion) return state;
	if (!isUnlocked(newVersion, state, config)) return state;

	// Must be same service
	const newService = findServiceForVersion(config, action.serviceVersionId);
	if (!newService || newService.id !== instance.serviceId) return state;

	// Must be a different version
	if (instance.serviceVersionId === action.serviceVersionId) return state;

	const updated = {
		...instance,
		serviceVersionId: action.serviceVersionId,
		status: "restarting",
		remainingRestartTime: newVersion.restartDuration,
	};

	const serviceInstances = [...state.serviceInstances];
	serviceInstances[idx] = updated;
	return { ...state, serviceInstances };
}

function applyServiceStart(state, config, action) {
	const idx = state.serviceInstances.findIndex(
		(s) => s.id === action.instanceId,
	);
	if (idx === -1) return state;
	const instance = state.serviceInstances[idx];
	if (instance.status !== "stopped") return state;

	const version = findServiceVersion(config, instance.serviceVersionId);
	if (!version) return state;

	const updated = {
		...instance,
		status: "restarting",
		remainingRestartTime: version.restartDuration,
	};
	const serviceInstances = [...state.serviceInstances];
	serviceInstances[idx] = updated;
	return { ...state, serviceInstances };
}

function applyServiceStop(state, _config, action) {
	const idx = state.serviceInstances.findIndex(
		(s) => s.id === action.instanceId,
	);
	if (idx === -1) return state;
	const instance = state.serviceInstances[idx];
	if (instance.status !== "running" && instance.status !== "restarting")
		return state;

	const updated = { ...instance, status: "stopped" };
	const serviceInstances = [...state.serviceInstances];
	serviceInstances[idx] = updated;
	return { ...state, serviceInstances };
}

function applyServiceRestart(state, config, action) {
	const idx = state.serviceInstances.findIndex(
		(s) => s.id === action.instanceId,
	);
	if (idx === -1) return state;
	const instance = state.serviceInstances[idx];
	if (instance.status !== "crashed") return state;

	const version = findServiceVersion(config, instance.serviceVersionId);
	if (!version) return state;

	const updated = {
		...instance,
		status: "restarting",
		remainingRestartTime: version.restartDuration,
	};
	const serviceInstances = [...state.serviceInstances];
	serviceInstances[idx] = updated;
	return { ...state, serviceInstances };
}

function applyServiceRemove(state, _config, action) {
	return {
		...state,
		serviceInstances: state.serviceInstances.filter(
			(s) => s.id !== action.instanceId,
		),
	};
}

function applyMailAnswer(state, config, action) {
	const mailInstIdx = state.mailInstances.findIndex(
		(m) => m.mailId === action.instanceId || m.mailId === action.mailId,
	);
	if (mailInstIdx === -1) return state;

	const mailInstance = state.mailInstances[mailInstIdx];
	if (mailInstance.optionId != null) return state;

	const mailConfig = findMail(config, mailInstance.mailId);
	if (!mailConfig) return state;

	const option = mailConfig.options?.find((o) => o.id === action.optionId);
	if (!option) return state;

	const updated = { ...mailInstance, optionId: action.optionId };
	const mailInstances = [...state.mailInstances];
	mailInstances[mailInstIdx] = updated;

	return {
		...state,
		paused: false,
		mailInstances,
		firedEventIds: fireEvent(state.firedEventIds, option.eventId),
	};
}

// ========== TICK PROCESSING ==========

function processTick(state, config, deltaSeconds, rng) {
	if (state.gameOver) return state;

	let s = { ...state };

	// 1. Advance timers
	s = advanceTimers(s, config, deltaSeconds);

	// 2. Check unlocks (can set paused=true for mails)
	s = checkUnlocks(s, config);

	// 3. Evaluate crashes (only if !paused)
	if (!s.paused) {
		s = evaluateCrashes(s, config, deltaSeconds, rng);
	}

	// 4. Compute yield and add production (only if !paused)
	if (!s.paused) {
		s = applyYield(s, config, deltaSeconds);
		s = emergencyShutdown(s, config);
	}

	// 5. Flush production history (every elapsed second)
	// 6. Check KPIs
	// 7. Advance elapsed time
	s = {
		...s,
		elapsedSeconds: s.elapsedSeconds + deltaSeconds,
	};

	// Check if we crossed a second boundary
	const newSecond = Math.floor(s.elapsedSeconds);
	if (newSecond > s.lastSecond) {
		s = flushProductionHistory(s);
		s = { ...s, lastSecond: newSecond };

		// Check trimester end
		const trimesterDuration = getConst(config, "TRIMESTER_DURATION");
		const trimesterProgress =
			(s.elapsedSeconds % trimesterDuration) / trimesterDuration;
		if (trimesterProgress < deltaSeconds / trimesterDuration + 0.001) {
			s = checkTrimesterKPIs(s, config);
		}
	}

	return s;
}

// --- Tick sub-steps ---

function advanceTimers(state, config, deltaSeconds) {
	let firedEventIds = [...state.firedEventIds];

	// Hardware timers
	const hardwareInstances = state.hardwareInstances.map((hw) => {
		if (hw.status === "deploying" && hw.remainingDeployTime > 0) {
			const remaining = hw.remainingDeployTime - deltaSeconds;
			if (remaining <= 0) {
				const hwConfig = findHardware(config, hw.hardwareId);
				firedEventIds = fireEvent(firedEventIds, hwConfig?.deployEventId);
				return {
					...hw,
					status: "running",
					remainingDeployTime: 0,
				};
			}
			return { ...hw, remainingDeployTime: remaining };
		}
		if (hw.status === "restarting" && hw.remainingRestartTime > 0) {
			const remaining = hw.remainingRestartTime - deltaSeconds;
			if (remaining <= 0) {
				const hwConfig = findHardware(config, hw.hardwareId);
				firedEventIds = fireEvent(firedEventIds, hwConfig?.restartEventId);
				return {
					...hw,
					status: "running",
					remainingRestartTime: 0,
				};
			}
			return { ...hw, remainingRestartTime: remaining };
		}
		return hw;
	});

	// Service timers — blocked services freeze
	const serviceInstances = state.serviceInstances.map((svc) => {
		// Use updated hardware state for blocking check
		const blockedByHardware = isServiceBlockedByHardwareWith(
			svc,
			hardwareInstances,
		);
		const awaitingHardware = isServiceAwaitingHardware(config, svc);

		if (blockedByHardware || awaitingHardware) {
			// If blocked by hardware and not deploying/stopped/restarting: put into restarting
			if (
				blockedByHardware &&
				svc.status !== "deploying" &&
				svc.status !== "stopped" &&
				svc.status !== "restarting"
			) {
				const version = findServiceVersion(config, svc.serviceVersionId);
				return {
					...svc,
					status: "restarting",
					remainingRestartTime: version?.restartDuration || 0,
				};
			}
			// Freeze timers
			return svc;
		}

		if (svc.status === "deploying" && svc.remainingDeployTime > 0) {
			const remaining = svc.remainingDeployTime - deltaSeconds;
			if (remaining <= 0) {
				const service = findService(config, svc.serviceId);
				const version = findServiceVersion(config, svc.serviceVersionId);
				// If non-global service has no project assigned, stop it
				if (!service?.global && !svc.assignedProjectId) {
					return { ...svc, status: "stopped", remainingDeployTime: 0 };
				}
				firedEventIds = fireEvent(firedEventIds, version?.deployEventId);
				return { ...svc, status: "running", remainingDeployTime: 0 };
			}
			return { ...svc, remainingDeployTime: remaining };
		}

		if (svc.status === "restarting" && svc.remainingRestartTime > 0) {
			const remaining = svc.remainingRestartTime - deltaSeconds;
			if (remaining <= 0) {
				const service = findService(config, svc.serviceId);
				const version = findServiceVersion(config, svc.serviceVersionId);
				if (!service?.global && !svc.assignedProjectId) {
					return { ...svc, status: "stopped", remainingRestartTime: 0 };
				}
				firedEventIds = fireEvent(firedEventIds, version?.restartEventId);
				return { ...svc, status: "running", remainingRestartTime: 0 };
			}
			return { ...svc, remainingRestartTime: remaining };
		}

		return svc;
	});

	return { ...state, hardwareInstances, serviceInstances, firedEventIds };
}

function isServiceBlockedByHardwareWith(svcInstance, hardwareInstances) {
	if (!svcInstance.assignedHardwareId) return false;
	const hwInstance = hardwareInstances.find(
		(h) => h.id === svcInstance.assignedHardwareId,
	);
	if (!hwInstance) return false;
	return hwInstance.status !== "running";
}

function checkUnlocks(state, config) {
	let s = { ...state };
	let firedEventIds = [...s.firedEventIds];
	let unlockedIds = [...s.unlockedIds];

	// Check all entity types for unlocks
	const allEntities = [
		...config.hardware,
		...config.services,
		...config.services.flatMap((svc) => svc.versions || []),
		...config.projects,
		...config.projects.flatMap((proj) => proj.versions || []),
		...config.mails,
	];

	for (const entity of allEntities) {
		if (unlockedIds.includes(entity.id)) continue;
		if (!isUnlocked(entity, s, config)) continue;

		unlockedIds = [...unlockedIds, entity.id];
		if (entity.eventId) {
			firedEventIds = fireEvent(firedEventIds, entity.eventId);
		}
	}

	s = { ...s, firedEventIds, unlockedIds };

	// Auto-create project instances
	let projectInstances = [...s.projectInstances];
	for (const project of config.projects) {
		if (!isUnlocked(project, s, config)) continue;
		const exists = projectInstances.find((p) => p.projectId === project.id);
		if (exists) {
			// Update currentVersionId if newer version is available
			const activeVersion = getActiveProjectVersion(config, s, project);
			if (activeVersion && exists.currentVersionId !== activeVersion.id) {
				projectInstances = projectInstances.map((p) =>
					p.projectId === project.id
						? { ...p, currentVersionId: activeVersion.id }
						: p,
				);
			}
			continue;
		}
		const activeVersion = getActiveProjectVersion(config, s, project);
		projectInstances = [
			...projectInstances,
			{
				projectId: project.id,
				currentVersionId: activeVersion?.id || null,
				strikes: 0,
				currentProduction: 0,
				productionHistory: [],
			},
		];
	}

	// Auto-create mail instances
	let mailInstances = [...s.mailInstances];
	let paused = s.paused;
	for (const mail of config.mails) {
		if (!isUnlocked(mail, s, config)) continue;
		const exists = mailInstances.find((m) => m.mailId === mail.id);
		if (exists) continue;
		mailInstances = [...mailInstances, { mailId: mail.id, optionId: null }];
		paused = true;
	}

	return { ...s, projectInstances, mailInstances, paused };
}

function evaluateCrashes(state, config, deltaSeconds, rng) {
	let firedEventIds = [...state.firedEventIds];

	// Hardware crashes
	const hardwareInstances = state.hardwareInstances.map((hwInstance) => {
		if (hwInstance.status !== "running") return hwInstance;
		const hw = findHardware(config, hwInstance.hardwareId);
		if (!hw || !hw.crashRate) return hwInstance;

		const crashProbability = 1 - Math.exp(-hw.crashRate * deltaSeconds);
		if (rng() < crashProbability) {
			firedEventIds = fireEvent(firedEventIds, hw.crashEventId);
			return { ...hwInstance, status: "crashed" };
		}
		return hwInstance;
	});

	// Service crashes
	const serviceInstances = state.serviceInstances.map((svcInstance) => {
		if (svcInstance.status !== "running") return svcInstance;
		const version = findServiceVersion(config, svcInstance.serviceVersionId);
		if (!version || !version.crashRate) return svcInstance;

		const crashProbability = 1 - Math.exp(-version.crashRate * deltaSeconds);
		if (rng() < crashProbability) {
			firedEventIds = fireEvent(firedEventIds, version.crashEventId);
			return { ...svcInstance, status: "crashed" };
		}
		return svcInstance;
	});

	return { ...state, hardwareInstances, serviceInstances, firedEventIds };
}

function applyYield(state, config, deltaSeconds) {
	const { netYield, projectYields } = computeYieldDetails(state, config);

	const kouraks = state.kouraks + netYield * deltaSeconds;

	// Update project production tracking
	const projectInstances = state.projectInstances.map((proj) => {
		const projYield = projectYields.get(proj.projectId) || 0;
		return {
			...proj,
			currentProduction: proj.currentProduction + projYield * deltaSeconds,
		};
	});

	// Track service production (baseYield for display)
	const serviceInstances = state.serviceInstances.map((svc) => {
		if (svc.status !== "running") return svc;
		const version = findServiceVersion(config, svc.serviceVersionId);
		if (!version || version.baseYield == null) return svc;
		return {
			...svc,
			currentProduction:
				svc.currentProduction + version.baseYield * deltaSeconds,
		};
	});

	// Track hardware production (sum of hosted services' baseYield)
	const hardwareInstances = state.hardwareInstances.map((hwInstance) => {
		if (hwInstance.status !== "running") return hwInstance;
		const servicesOnHw = serviceInstances.filter(
			(svc) => svc.assignedHardwareId === hwInstance.id,
		);
		let hwProduction = 0;
		for (const svc of servicesOnHw) {
			if (svc.status !== "running") continue;
			const version = findServiceVersion(config, svc.serviceVersionId);
			if (version?.baseYield != null)
				hwProduction += version.baseYield * deltaSeconds;
		}
		return {
			...hwInstance,
			currentProduction: hwInstance.currentProduction + hwProduction,
		};
	});

	return {
		...state,
		kouraks,
		currentNetYield: netYield,
		projectInstances,
		serviceInstances,
		hardwareInstances,
	};
}

function emergencyShutdown(state, config) {
	if (state.kouraks >= 0) return state;

	const hardwareInstances = state.hardwareInstances.map((hwInstance) => {
		if (hwInstance.status !== "running") return hwInstance;
		const hwConfig = findHardware(config, hwInstance.hardwareId);
		if (hwConfig?.recurringCost > 0) {
			return { ...hwInstance, status: "stopped" };
		}
		return hwInstance;
	});

	const serviceInstances = state.serviceInstances.map((svcInstance) => {
		if (svcInstance.status !== "running") return svcInstance;
		const ver = findServiceVersion(config, svcInstance.serviceVersionId);
		if (ver?.recurringCost > 0) {
			return { ...svcInstance, status: "stopped" };
		}
		return svcInstance;
	});

	return {
		...state,
		kouraks: 0,
		hardwareInstances,
		serviceInstances,
	};
}

function flushProductionHistory(state) {
	const projectInstances = state.projectInstances.map((proj) => ({
		...proj,
		productionHistory: [...proj.productionHistory, proj.currentProduction],
		currentProduction: 0,
	}));

	const serviceInstances = state.serviceInstances.map((svc) => ({
		...svc,
		productionHistory: [...svc.productionHistory, svc.currentProduction],
		currentProduction: 0,
	}));

	const hardwareInstances = state.hardwareInstances.map((hw) => ({
		...hw,
		productionHistory: [...hw.productionHistory, hw.currentProduction],
		currentProduction: 0,
	}));

	return { ...state, projectInstances, serviceInstances, hardwareInstances };
}

function checkTrimesterKPIs(state, config) {
	const trimesterDuration = getConst(config, "TRIMESTER_DURATION");
	const currentTrimester = state.elapsedSeconds / trimesterDuration;
	if (currentTrimester < 1) return state;

	const kpiThreshold = getConst(config, "KPI_FAILURE_THRESHOLD");
	const strikeLimit = getConst(config, "STRIKE_LIMIT");
	const gameOverLimit = getConst(config, "GAME_OVER_FAILURE_LIMIT");

	let projectFailures = state.projectFailures;
	let firedEventIds = [...state.firedEventIds];
	let serviceInstances = [...state.serviceInstances];

	const projectInstances = state.projectInstances.map((projInstance) => {
		if (projInstance.strikes >= strikeLimit) return projInstance;

		const version = getCurrentProjectVersion(config, state, projInstance);
		if (!version) return projInstance;

		const relevantHistory = projInstance.productionHistory.slice(
			-trimesterDuration,
		);
		const trimesterProduction = relevantHistory.reduce((sum, p) => sum + p, 0);
		const ratio = trimesterProduction / version.targetProduction;

		if (ratio < kpiThreshold) {
			const newStrikes = projInstance.strikes + 1;
			const project = findProject(config, projInstance.projectId);

			firedEventIds = fireEvent(firedEventIds, project?.strikeEventId);

			if (newStrikes >= strikeLimit) {
				// Project cancelled — free its services
				firedEventIds = fireEvent(firedEventIds, project?.failureEventId);
				projectFailures++;

				serviceInstances = serviceInstances.map((svc) => {
					if (svc.assignedProjectId === projInstance.projectId) {
						return { ...svc, assignedProjectId: null };
					}
					return svc;
				});
			}

			return { ...projInstance, strikes: newStrikes };
		}

		return projInstance;
	});

	let gameOver = state.gameOver;
	if (projectFailures >= gameOverLimit) {
		gameOver = true;
	}

	return {
		...state,
		projectInstances,
		serviceInstances,
		projectFailures,
		firedEventIds,
		gameOver,
	};
}

// ========== EXPORTS ==========

const Engine = {
	createInitialState,
	applyAction,
	processTick,
	computeNetYield,
	isUnlocked,
	// Additional helpers for the UI layer
	findHardware,
	findService,
	findServiceVersion,
	findServiceForVersion,
	findProject,
	findProjectVersion,
	findMail,
	getActiveProjectVersion,
	getCurrentProjectVersion,
	isServiceBlockedByHardware,
	isServiceAwaitingHardware,
	getServicesOnHardware,
	checkProjectRequirements,
	computeYieldDetails,
	getConst,
};

// Browser global
if (typeof window !== "undefined") {
	window.Engine = Engine;
}

// Node.js / CommonJS
if (typeof module !== "undefined" && module.exports) {
	module.exports = Engine;
}
