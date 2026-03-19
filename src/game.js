// KOURAKS — UI/UX Glue Layer (Alpine.js ↔ Engine)
// Owns the game loop, DOM interactions, save/load, and logging.
// All domain logic is delegated to Engine (engine.js).

// Global game object for easy console access
window.gameRoot = {
	config: {},
	runtime: {},
};

// Alpine.js game component
document.addEventListener("alpine:init", () => {
	Alpine.data("game", () => ({
		// === CONFIG DATA (loaded from YAML) ===
		config: {
			hardware: [],
			services: [],
			projects: [],
			mails: [],
			constants: {
				TRIMESTER_DURATION: 360,
				KPI_FAILURE_THRESHOLD: 0.8,
				STRIKE_LIMIT: 3,
				GAME_OVER_FAILURE_LIMIT: 3,
				HARDWARE_SELL_RATIO: 0.15,
			},
		},

		// === ENGINE STATE ===
		state: Engine.createInitialState(10),

		// Derived display values (updated each tick)
		currentNetYield: 0,

		// Cached arrays to prevent re-rendering selectors on every tick
		_hardwareInstancesCache: null,
		_hardwareInstancesCacheJson: null,
		_projectInstancesCache: null,
		_projectInstancesCacheJson: null,
		_serviceInstancesCache: null,
		_serviceInstancesCacheJson: null,

		// UI State
		logs: [],
		showHardwareMarketplace: false,
		showServiceMarketplace: false,
		showServiceConfig: false,
		showHardwareConfig: false,
		selectedHardwareInstance: null,
		showMail: false,
		currentMail: null,
		selectedServiceConfig: null,
		serviceMarketplaceFilters: {
			latestOnly: true,
			typeFilter: "",
			nameFilter: "",
			freeOnly: false,
			showDeprecated: false,
		},

		// Game loop
		tickInterval: null,

		// Constants (UI-only)
		TICK_INTERVAL: 100, // ms
		MAX_LOG_SIZE: 200,
		SAVE_LOG_SIZE: 50,
		AUTO_SAVE_INTERVAL: 10, // seconds

		// === INITIALIZATION ===
		async init() {
			this.log("info", "KOURAKS System initializing...");
			await this.loadGameData();
			this.loadGame();
			this.initializeProjects();
			this.startGameLoop();
			window.gameRoot.config = this.config;
			window.gameRoot.runtime = this;
			this.log("info", "System ready. Bon courage.");
		},

		resetGame() {
			if (confirm("Reset game?")) {
				localStorage.removeItem("kourasks_save");
				location.reload();
			}
		},

		async loadGameData() {
			try {
				const hwResponse = await fetch("data/hardware.yaml");
				const hwText = await hwResponse.text();
				const hwData = jsyaml.load(hwText);
				this.config.hardware = hwData.hardware || [];

				const svcResponse = await fetch("data/services.yaml");
				const svcText = await svcResponse.text();
				const svcData = jsyaml.load(svcText);
				this.config.services = svcData.services || [];

				const projResponse = await fetch("data/projects.yaml");
				const projText = await projResponse.text();
				const projData = jsyaml.load(projText);
				this.config.projects = projData.projects || [];

				const mailResponse = await fetch("data/mail.yaml");
				const mailText = await mailResponse.text();
				const mailData = jsyaml.load(mailText);
				this.config.mails = mailData.mails || [];

				this.log(
					"info",
					`Loaded ${this.config.hardware.length} hardware, ${this.config.services.length} services, ${this.config.projects.length} projects`,
				);
			} catch (error) {
				this.log("error", `Failed to load game data: ${error.message}`);
			}
		},

		initializeProjects() {
			let projectInstances = [...this.state.projectInstances];
			this.config.projects.forEach((project) => {
				if (Engine.isUnlocked(project, this.state, this.config)) {
					const existingInstance = projectInstances.find(
						(p) => p.projectId === project.id,
					);
					if (!existingInstance) {
						const activeVersion = Engine.getActiveProjectVersion(
							this.config,
							this.state,
							project,
						);
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
						this.log("info", `Project initialized: ${project.name}`);
					}
				}
			});
			this.state = { ...this.state, projectInstances };
		},

		// === CONVENIENCE ACCESSORS (proxied from state for templates) ===
		get kouraks() {
			return this.state?.kouraks ?? 0;
		},
		get elapsedSeconds() {
			return this.state?.elapsedSeconds ?? 0;
		},
		get currentTrimester() {
			const td = Engine.getConst(this.config, "TRIMESTER_DURATION");
			return this.elapsedSeconds / td;
		},
		get projectFailures() {
			return this.state?.projectFailures ?? 0;
		},
		get hardwareInstances() {
			// Return cached array to prevent Alpine.js from re-rendering selectors on every tick
			// Only update cache when content actually changes
			const arr = this.state?.hardwareInstances ?? [];
			const cache = this._hardwareInstancesCache;
			const cacheJson = this._hardwareInstancesCacheJson;
			const arrJson = JSON.stringify(arr.map((h) => h.id));
			if (!cache || arrJson !== cacheJson) {
				this._hardwareInstancesCache = arr;
				this._hardwareInstancesCacheJson = arrJson;
				return arr;
			}
			return cache;
		},
		get serviceInstances() {
			const arr = this.state?.serviceInstances ?? [];
			const cache = this._serviceInstancesCache;
			const cacheJson = this._serviceInstancesCacheJson;
			const arrJson = JSON.stringify(arr.map((s) => s.id));
			if (!cache || arrJson !== cacheJson) {
				this._serviceInstancesCache = arr;
				this._serviceInstancesCacheJson = arrJson;
				return arr;
			}
			return cache;
		},
		get projectInstances() {
			const arr = this.state?.projectInstances ?? [];
			const cache = this._projectInstancesCache;
			const cacheJson = this._projectInstancesCacheJson;
			const arrJson = JSON.stringify(arr.map((p) => p.projectId));
			if (!cache || arrJson !== cacheJson) {
				this._projectInstancesCache = arr;
				this._projectInstancesCacheJson = arrJson;
				return arr;
			}
			return cache;
		},
		get mailInstances() {
			return this.state?.mailInstances ?? [];
		},
		get gameOver() {
			return this.state?.gameOver ?? false;
		},

		// === GAME LOOP ===
		startGameLoop() {
			this.tickInterval = setInterval(() => {
				this.tick();
			}, this.TICK_INTERVAL);
		},

		tick() {
			if (this.showMail) return;
			if (this.gameOver) return;

			const deltaTime = this.TICK_INTERVAL / 1000;
			const prevEventCount = this.state.firedEventIds.length;
			const prevPaused = this.state.paused;

			this.state = Engine.processTick(
				this.state,
				this.config,
				deltaTime,
				Math.random,
			);

			// Update derived display values
			this.currentNetYield = Engine.computeNetYield(this.state, this.config);

			// Log newly fired events
			const newEvents = this.state.firedEventIds.slice(prevEventCount);
			for (const eventId of newEvents) {
				this.log("info", `Event triggered: ${eventId}`);
			}

			// Show mail if game paused by engine
			if (this.state.paused && !prevPaused) {
				this.checkMailsForDisplay();
				this.saveGame();
			}

			// Auto-save every N seconds
			const currentSecond = Math.floor(this.state.elapsedSeconds);
			if (
				currentSecond > 0 &&
				currentSecond % this.AUTO_SAVE_INTERVAL === 0 &&
				currentSecond !== Math.floor(this.state.elapsedSeconds - deltaTime)
			) {
				this.saveGame();
			}

			// Handle game over
			if (this.state.gameOver) {
				clearInterval(this.tickInterval);
				this.log("error", "=== GAME OVER ===");
				this.checkMailsForDisplay();
			}
		},

		checkMailsForDisplay() {
			const unrespondedMail = this.state.mailInstances.find((m) => !m.optionId);
			if (unrespondedMail && !this.showMail) {
				this.currentMail = this.config.mails.find(
					(m) => m.id === unrespondedMail.mailId,
				);
				this.showMail = true;
			}
		},

		// === ACTIONS (delegated to engine) ===
		deployHardware(hardware) {
			if (this.kouraks < hardware.deployCost) {
				this.log("error", "Pas assez de Kouraks!");
				return;
			}
			this.state = Engine.applyAction(this.state, this.config, {
				type: "hardware.deploy",
				hardwareId: hardware.id,
			});
			this.log("info", `Deploying hardware: ${hardware.name}`);
			this.showHardwareMarketplace = false;
			this.saveGame();
		},

		sellHardware(hwInstance) {
			const hw = this.getHardware(hwInstance.hardwareId);
			const sellRatio = Engine.getConst(this.config, "HARDWARE_SELL_RATIO");
			const sellValue = hw.sellValue || hw.deployCost * sellRatio;

			this.state = Engine.applyAction(this.state, this.config, {
				type: "hardware.sell",
				instanceId: hwInstance.id,
			});
			this.log(
				"info",
				`Sold hardware: ${hw.name} for ${this.formatNumber(sellValue)} K`,
			);
			this.saveGame();
		},

		restartHardware(hwInstance) {
			const hw = this.getHardware(hwInstance.hardwareId);
			this.state = Engine.applyAction(this.state, this.config, {
				type: "hardware.restart",
				instanceId: hwInstance.id,
			});
			this.log("info", `Restarting hardware: ${hw.name}`);
		},

		startHardware(hwInstance) {
			const hw = this.getHardware(hwInstance.hardwareId);
			this.state = Engine.applyAction(this.state, this.config, {
				type: "hardware.start",
				instanceId: hwInstance.id,
			});
			this.log("info", `Starting hardware: ${hw.name}`);
		},

		shutdownHardware(hwInstance) {
			const hw = this.getHardware(hwInstance.hardwareId);
			this.state = Engine.applyAction(this.state, this.config, {
				type: "hardware.stop",
				instanceId: hwInstance.id,
			});
			this.log("info", `Hardware ${hw.name} shut down`);
			this.saveGame();
		},

		openHardwareConfig(hwInstance) {
			this.selectedHardwareInstance = hwInstance;
			this.showHardwareConfig = true;
		},

		selectServiceForDeploy(service, version) {
			this.selectedServiceConfig = {
				service: service,
				version: version,
				hardwareId: null,
				projectId: null,
			};
			this.showServiceMarketplace = false;
			this.showServiceConfig = true;
		},

		confirmServiceDeploy() {
			const cfg = this.selectedServiceConfig;
			if (!cfg) return;

			// Reconfiguring existing instance
			if (cfg.existingInstance) {
				this.state = Engine.applyAction(this.state, this.config, {
					type: "service.configure",
					instanceId: cfg.existingInstance.id,
					hardwareInstanceId: cfg.version.requireHardware
						? cfg.hardwareId || null
						: null,
					projectId: cfg.service.global ? null : cfg.projectId || null,
				});
				this.log("info", `Reconfigured service: ${cfg.service.name}`);
				this.showServiceConfig = false;
				this.selectedServiceConfig = null;
				this.saveGame();
				return;
			}

			// New deployment
			if (this.kouraks < cfg.version.deployCost) {
				this.log("error", "Pas assez de Kouraks!");
				return;
			}

			this.state = Engine.applyAction(this.state, this.config, {
				type: "service.deploy",
				serviceVersionId: cfg.version.id,
				projectId: cfg.service.global ? null : cfg.projectId || null,
				hardwareId: cfg.version.requireHardware ? cfg.hardwareId || null : null,
			});

			this.log(
				"info",
				`Deploying service: ${cfg.service.name} ${cfg.version.name}`,
			);
			this.showServiceConfig = false;
			this.selectedServiceConfig = null;
			this.saveGame();
		},

		restartService(svcInstance) {
			this.state = Engine.applyAction(this.state, this.config, {
				type: "service.restart",
				instanceId: svcInstance.id,
			});
			this.log(
				"info",
				`Restarting service: ${this.getService(svcInstance.serviceId).name}`,
			);
		},

		stopService(svcInstance) {
			this.state = Engine.applyAction(this.state, this.config, {
				type: "service.stop",
				instanceId: svcInstance.id,
			});
			this.log(
				"info",
				`Stopped service: ${this.getService(svcInstance.serviceId).name}`,
			);
		},

		startService(svcInstance) {
			this.state = Engine.applyAction(this.state, this.config, {
				type: "service.start",
				instanceId: svcInstance.id,
			});
			this.log(
				"info",
				`Started service: ${this.getService(svcInstance.serviceId).name}`,
			);
		},

		configureService(svcInstance) {
			const service = this.getService(svcInstance.serviceId);
			const version = this.getServiceVersion(svcInstance.serviceVersionId);

			this.selectedServiceConfig = {
				service: service,
				version: version,
				hardwareId: svcInstance.hardwareInstanceId,
				projectId: svcInstance.projectInstanceId,
				existingInstance: svcInstance,
			};
			this.showServiceConfig = true;
		},

		respondToMail(option) {
			this.state = Engine.applyAction(this.state, this.config, {
				type: "mail.answer",
				mailId: this.currentMail.id,
				optionId: option.id,
			});

			// Handle special events (UI-layer concerns)
			if (option.eventId === "game_reset") {
				localStorage.removeItem("kourasks_save");
				location.reload();
				return;
			}

			this.showMail = false;
			this.currentMail = null;
			this.saveGame();

			// Check if there are more unresponded mails
			this.checkMailsForDisplay();
		},

		// === CONFIG LOOKUP HELPERS (delegate to engine) ===
		getHardware(id) {
			return Engine.findHardware(this.config, id) || {};
		},

		getHardwareByInstance(id) {
			// Look for hardware instance in this.state.hardwareInstances and call getHardware with the actual hardware id
			const hwInstance = this.hardwareInstances.find((hw) => hw.id === id);
			if (!hwInstance) return;
			return this.getHardware(hwInstance.hardwareId);
		},

		getService(id) {
			return Engine.findService(this.config, id) || {};
		},

		getServiceVersion(id) {
			return Engine.findServiceVersion(this.config, id) || {};
		},

		getProject(id) {
			return Engine.findProject(this.config, id) || {};
		},

		getProjectVersion(projectId, versionId) {
			return (
				Engine.findProjectVersion(this.config, projectId, versionId) || null
			);
		},

		getActiveProjectVersion(project) {
			return Engine.getActiveProjectVersion(this.config, this.state, project);
		},

		getCurrentProjectVersion(projInstance) {
			return Engine.getCurrentProjectVersion(
				this.config,
				this.state,
				projInstance,
			);
		},

		getServicesOnHardware(hardwareInstanceId) {
			return Engine.getServicesOnHardware(this.state, hardwareInstanceId);
		},

		isUnlocked(item) {
			return Engine.isUnlocked(item, this.state, this.config);
		},

		isServiceBlockedByHardware(svcInstance) {
			return Engine.isServiceBlockedByHardware(this.state, svcInstance);
		},

		isServiceAwaitingHardware(svcInstance) {
			return Engine.isServiceAwaitingHardware(this.config, svcInstance);
		},

		// === UI HELPERS ===
		getHardwareLoad(hwInstance) {
			const services = this.getServicesOnHardware(hwInstance.id);
			let totalLoad = 0;
			services.forEach((svc) => {
				if (svc.status === "running") {
					const version = this.getServiceVersion(svc.serviceVersionId);
					totalLoad += version.baseYield ?? 0;
				}
			});
			return totalLoad;
		},

		getProjectYield(projInstance) {
			const services = this.serviceInstances.filter(
				(svc) =>
					svc.status === "running" &&
					svc.projectInstanceId === projInstance.projectId,
			);
			if (services.length === 0) return 0;

			const yields = services
				.filter((svc) => {
					const version = this.getServiceVersion(svc.serviceVersionId);
					return version.baseYield != null;
				})
				.map((svc) => {
					const version = this.getServiceVersion(svc.serviceVersionId);
					return version.baseYield;
				});

			return yields.length > 0 ? Math.min(...yields) : 0;
		},

		getTotalProjectProduction(projInstance) {
			return projInstance.productionHistory.reduce((sum, p) => sum + p, 0);
		},

		getTrimesterProduction(projInstance) {
			const trimesterLength = Engine.getConst(
				this.config,
				"TRIMESTER_DURATION",
			);
			const relevantHistory = projInstance.productionHistory.slice(
				-trimesterLength,
			);
			return relevantHistory.reduce((sum, p) => sum + p, 0);
		},

		getProjectKpiProgress(projInstance) {
			return this.getTrimesterProduction(projInstance);
		},

		getProjectRequirements(projInstance) {
			const version = this.getCurrentProjectVersion(projInstance);
			return version?.serviceTypeRequirements || [];
		},

		getRequirementStatus(projInstance, reqType) {
			const hasService = this.serviceInstances.find((svc) => {
				const service = this.getService(svc.serviceId);
				return (
					service.type === reqType &&
					(svc.projectInstanceId === projInstance.projectId || service.global)
				);
			});

			if (!hasService) return "missing";
			if (hasService.status === "running") return "satisfied";
			if (
				hasService.status === "deploying" ||
				hasService.status === "restarting"
			)
				return "warning";
			if (hasService.status === "crashed" || hasService.status === "stopped")
				return "error";

			return "missing";
		},

		hasProjectIssues(projInstance) {
			const requirements = this.getProjectRequirements(projInstance);
			return requirements.some((reqType) => {
				const status = this.getRequirementStatus(projInstance, reqType);
				return status === "error" || status === "missing";
			});
		},

		isVersionDeprecated(version) {
			if (version.deprecatedAtTrimester != null) {
				return this.currentTrimester >= version.deprecatedAtTrimester;
			}
			return false;
		},

		checkProjectRequirements(projInstance, version) {
			return Engine.checkProjectRequirements(
				this.state,
				this.config,
				projInstance,
				version,
			);
		},

		// === COMPUTED PROPERTIES ===
		get TRIMESTER_DURATION() {
			return Engine.getConst(this.config, "TRIMESTER_DURATION");
		},
		get STRIKE_LIMIT() {
			return Engine.getConst(this.config, "STRIKE_LIMIT");
		},
		get GAME_OVER_FAILURE_LIMIT() {
			return Engine.getConst(this.config, "GAME_OVER_FAILURE_LIMIT");
		},

		get activeProjectInstances() {
			const sl = this.STRIKE_LIMIT;
			return this.projectInstances.filter(
				(p) => p.strikes < sl && p.currentVersionId !== null,
			);
		},

		get availableHardware() {
			return this.config.hardware.filter((hw) => this.isUnlocked(hw));
		},

		get runningHardwareInstances() {
			return this.hardwareInstances.filter((hw) => hw.status === "running");
		},

		get ownedHardwareInstances() {
			return this.hardwareInstances;
		},

		get filteredServices() {
			const services = this.config.services.filter((svc) => {
				const hasUnlockedVersion = (svc.versions || []).some((v) =>
					this.isUnlocked(v),
				);
				if (!hasUnlockedVersion) return false;

				if (this.serviceMarketplaceFilters.typeFilter) {
					if (svc.type !== this.serviceMarketplaceFilters.typeFilter)
						return false;
				}

				if (this.serviceMarketplaceFilters.nameFilter) {
					const search =
						this.serviceMarketplaceFilters.nameFilter.toLowerCase();
					if (
						!svc.name.toLowerCase().includes(search) &&
						!svc.description.toLowerCase().includes(search)
					)
						return false;
				}

				if (this.serviceMarketplaceFilters.freeOnly) {
					const hasFreeDeploy = (svc.versions || []).some(
						(v) => this.isUnlocked(v) && (v.deployCost === 0 || !v.deployCost),
					);
					if (!hasFreeDeploy) return false;
				}

				return true;
			});

			return services;
		},

		getFilteredVersions(service) {
			if (!service.versions) return [];

			let unlocked = service.versions.filter((v) => this.isUnlocked(v));

			if (!this.serviceMarketplaceFilters.showDeprecated) {
				const nonDeprecated = unlocked.filter(
					(v) => !this.isVersionDeprecated(v),
				);
				if (nonDeprecated.length > 0) {
					unlocked = nonDeprecated;
				}
			}

			if (this.serviceMarketplaceFilters.latestOnly) {
				return unlocked.length > 0 ? [unlocked[unlocked.length - 1]] : [];
			}

			return unlocked;
		},

		get availableServiceTypes() {
			const types = new Set();
			this.config.services.forEach((svc) => {
				if ((svc.versions || []).some((v) => this.isUnlocked(v))) {
					types.add(svc.type);
				}
			});
			return [...types].sort();
		},

		// === UI ACTIONS ===
		openHardwareMarketplace() {
			this.showHardwareMarketplace = true;
		},

		openServiceMarketplace(filterType = "") {
			this.serviceMarketplaceFilters.typeFilter = filterType;
			this.showServiceMarketplace = true;
		},

		closeServiceMarketplace() {
			this.showServiceMarketplace = false;
			this.serviceMarketplaceFilters.typeFilter = "";
			this.serviceMarketplaceFilters.nameFilter = "";
		},

		// === FORMATTING ===
		formatNumber(num) {
			if (num >= 1000000) {
				return `${(num / 1000000).toFixed(2)}M`;
			}
			if (num >= 1000) {
				return `${(num / 1000).toFixed(2)}K`;
			}
			return num.toFixed(2);
		},

		formatTime(seconds) {
			const mins = Math.floor(seconds / 60);
			const secs = Math.floor(seconds % 60);
			return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
		},

		formatTrimester(trimester) {
			return trimester.toFixed(1);
		},

		// === LOGGING ===
		log(type, message) {
			this.logs.push({
				time: this.elapsedSeconds,
				type: type,
				message: message,
			});
			if (this.logs.length > this.MAX_LOG_SIZE) {
				this.logs = this.logs.slice(-this.MAX_LOG_SIZE);
			}
		},

		// === SAVE/LOAD ===
		saveGame() {
			const saveData = {
				kouraks: this.state.kouraks,
				elapsedSeconds: this.state.elapsedSeconds,
				projectFailures: this.state.projectFailures,
				hardwareInstances: this.state.hardwareInstances,
				serviceInstances: this.state.serviceInstances,
				projectInstances: this.state.projectInstances,
				mailInstances: this.state.mailInstances,
				firedEventIds: this.state.firedEventIds,
				unlockedIds: this.state.unlockedIds,
				nextInstanceId: this.state.nextInstanceId,
				gameOver: this.state.gameOver,
				paused: this.state.paused,
				logs: this.logs.slice(-this.SAVE_LOG_SIZE),
			};
			localStorage.setItem("kourasks_save", JSON.stringify(saveData));
		},

		loadGame() {
			// Create initial state first
			this.state = Engine.createInitialState(10);

			const saved = localStorage.getItem("kourasks_save");
			if (saved) {
				try {
					const data = JSON.parse(saved);
					this.state = {
						...this.state,
						kouraks: data.kouraks ?? 10,
						elapsedSeconds: data.elapsedSeconds ?? data.gameTime ?? 0,
						projectFailures: data.projectFailures ?? 0,
						hardwareInstances: data.hardwareInstances ?? [],
						serviceInstances: data.serviceInstances ?? [],
						projectInstances: data.projectInstances ?? [],
						mailInstances: data.mailInstances ?? [],
						firedEventIds:
							data.firedEventIds ?? data.events?.map((e) => e.eventId) ?? [],
						unlockedIds: data.unlockedIds ?? [],
						nextInstanceId: data.nextInstanceId ?? 1,
						gameOver: data.gameOver ?? false,
						paused: data.paused ?? false,
						lastSecond: Math.floor(data.elapsedSeconds ?? data.gameTime ?? 0),
					};
					this.logs = data.logs ?? [];
					this.log("info", "Game loaded from save");

					// Restore mail display if there's an unresolved mail
					this.checkMailsForDisplay();
				} catch (error) {
					this.log("error", `Failed to load save: ${error.message}`);
				}
			}
		},
	}));
});
