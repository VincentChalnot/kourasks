// KOURASKS - Game Logic

// Global game object for easy console access
window.gameRoot = {
	config: {},
	runtime: {},
};

// Alpine.js game component
document.addEventListener("alpine:init", () => {
	Alpine.data("game", () => ({
		// === CONFIG DATA (loaded from YAML) ===
		hardwareConfig: [],
		servicesConfig: [],
		projectsConfig: [],
		mailsConfig: [],

		// === RUNTIME STATE ===
		kouraks: 0,
		currentNetYield: 0,
		currentTrimester: 0,
		projectFailures: 0,
		gameTime: 0, // in seconds

		// Instances
		hardwareInstances: [],
		serviceInstances: [],
		projectInstances: [],
		mailInstances: [],
		events: [],

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
		lastSecond: 0,

		// Constants
		TICK_INTERVAL: 100, // ms
		TRIMESTER_DURATION: 360, // 6 minutes in seconds
		KPI_FAILURE_THRESHOLD: 0.8,
		STRIKE_LIMIT: 3,
		GAME_OVER_FAILURE_LIMIT: 3,
		HARDWARE_SELL_RATIO: 0.15,
		MAX_LOG_SIZE: 200,
		SAVE_LOG_SIZE: 50,
		AUTO_SAVE_INTERVAL: 10, // seconds

		// === INITIALIZATION ===
		async init() {
			this.log("info", "KOURASKS System initializing...");
			await this.loadGameData();
			this.loadGame();
			this.initializeProjects();
			this.startGameLoop();
			window.gameRoot.config = {
				hardware: this.hardwareConfig,
				services: this.servicesConfig,
				projects: this.projectsConfig,
				mails: this.mailsConfig,
			};
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
				// Load hardware
				const hwResponse = await fetch("data/hardware.yaml");
				const hwText = await hwResponse.text();
				const hwData = jsyaml.load(hwText);
				this.hardwareConfig = hwData.hardware || [];

				// Load services
				const svcResponse = await fetch("data/services.yaml");
				const svcText = await svcResponse.text();
				const svcData = jsyaml.load(svcText);
				this.servicesConfig = svcData.services || [];

				// Load projects
				const projResponse = await fetch("data/projects.yaml");
				const projText = await projResponse.text();
				const projData = jsyaml.load(projText);
				this.projectsConfig = projData.projects || [];

				// Load mails
				const mailResponse = await fetch("data/mail.yaml");
				const mailText = await mailResponse.text();
				const mailData = jsyaml.load(mailText);
				this.mailsConfig = mailData.mails || [];

				this.log(
					"info",
					`Loaded ${this.hardwareConfig.length} hardware, ${this.servicesConfig.length} services, ${this.projectsConfig.length} projects`,
				);
			} catch (error) {
				this.log("error", `Failed to load game data: ${error.message}`);
			}
		},

		initializeProjects() {
			// Initialize project instances for unlocked projects
			this.projectsConfig.forEach((project) => {
				if (this.isUnlocked(project)) {
					const existingInstance = this.projectInstances.find(
						(p) => p.projectId === project.id,
					);
					if (!existingInstance) {
						const activeVersion = this.getActiveProjectVersion(project);
						this.projectInstances.push({
							projectId: project.id,
							currentVersionId: activeVersion?.id || null,
							strikes: 0,
							currentProduction: 0,
							productionHistory: [],
						});
						this.log("info", `Project initialized: ${project.name}`);
					}
				}
			});
		},

		// === GAME LOOP ===
		startGameLoop() {
			this.tickInterval = setInterval(() => {
				this.tick();
			}, this.TICK_INTERVAL);
		},

		tick() {
			const deltaTime = this.TICK_INTERVAL / 1000; // Convert to seconds

			// Update game time
			this.gameTime += deltaTime;
			this.currentTrimester = this.gameTime / this.TRIMESTER_DURATION;

			// Check for unlocks
			this.checkUnlocks();

			// Update deploying/restarting timers
			this.updateTimers(deltaTime);

			// Calculate yield
			this.calculateYield();

			// Add production
			this.kouraks += this.currentNetYield * deltaTime;
			// Emergency shutdown if Kouraks went negative
			this.emergencyShutdownForNegativeKouraks();

			// Update production tracking
			this.updateProductionTracking(deltaTime);

			// Check crashes
			this.checkCrashes(deltaTime);

			// Check KPIs (every trimester)
			if (Math.floor(this.gameTime) > this.lastSecond) {
				this.lastSecond = Math.floor(this.gameTime);

				// Every second, finalize production history
				this.finalizeProductionHistory();

				// Auto-save every 10 seconds
				if (this.lastSecond % this.AUTO_SAVE_INTERVAL === 0) {
					this.saveGame();
				}

				// Check trimester end
				const trimesterProgress =
					(this.gameTime % this.TRIMESTER_DURATION) / this.TRIMESTER_DURATION;
				if (trimesterProgress < 0.01) {
					// Near start of new trimester
					this.checkTrimesterKPIs();
				}
			}
		},

		updateTimers(deltaTime) {
			// Hardware timers
			this.hardwareInstances.forEach((hw) => {
				if (hw.status === "deploying" && hw.remainingDeployTime > 0) {
					hw.remainingDeployTime -= deltaTime;
					if (hw.remainingDeployTime <= 0) {
						hw.status = "running";
						this.log(
							"info",
							`Hardware ${this.getHardware(hw.hardwareId).name} is now running`,
						);
					}
				}
				if (hw.status === "restarting" && hw.remainingRestartTime > 0) {
					hw.remainingRestartTime -= deltaTime;
					if (hw.remainingRestartTime <= 0) {
						hw.status = "running";
						this.log(
							"info",
							`Hardware ${this.getHardware(hw.hardwareId).name} restarted successfully`,
						);
					}
				}
			});

			// Service timers
			this.serviceInstances.forEach((svc) => {
				if (svc.status === "deploying" && svc.remainingDeployTime > 0) {
					svc.remainingDeployTime -= deltaTime;
					if (svc.remainingDeployTime <= 0) {
						svc.status = "running";
						this.log(
							"info",
							`Service ${this.getService(svc.serviceId).name} is now running`,
						);
					}
				}
				if (svc.status === "restarting" && svc.remainingRestartTime > 0) {
					svc.remainingRestartTime -= deltaTime;
					if (svc.remainingRestartTime <= 0) {
						svc.status = "running";
						this.log(
							"info",
							`Service ${this.getService(svc.serviceId).name} restarted successfully`,
						);
					}
				}
			});
		},

		calculateYield() {
			let totalGrossYield = 0;
			let totalRecurringCost = 0;

			// Calculate service yields
			const serviceYields = new Map();
			this.serviceInstances.forEach((svc) => {
				if (svc.status === "running") {
					const version = this.getServiceVersion(svc.serviceVersionId);

					if (version.baseYield !== null && version.baseYield !== undefined) {
						// Calculate multipliers
						const multipliers = [version.yieldMultiplier - 1];

						// Add hardware multiplier if assigned
						if (svc.assignedHardwareId) {
							const hwInstance = this.hardwareInstances.find(
								(h) => h.id === svc.assignedHardwareId,
							);
							if (hwInstance && hwInstance.status === "running") {
								const hw = this.getHardware(hwInstance.hardwareId);
								multipliers.push(hw.yieldMultiplier - 1);
							}
						}

						// Add service multipliers from same project
						if (svc.assignedProjectId) {
							this.serviceInstances.forEach((otherSvc) => {
								if (
									otherSvc.status === "running" &&
									otherSvc.assignedProjectId === svc.assignedProjectId
								) {
									const otherVersion = this.getServiceVersion(
										otherSvc.serviceVersionId,
									);
									multipliers.push(otherVersion.yieldMultiplier - 1);
								}
							});
						}

						const multiplierTotal =
							1 + multipliers.reduce((sum, m) => sum + m, 0);
						const serviceYield = version.baseYield * multiplierTotal;
						serviceYields.set(svc.id, serviceYield);
					}

					// Add recurring cost
					totalRecurringCost += version.recurringCost || 0;
				}
			});

			// Apply hardware limitations (throttling)
			this.hardwareInstances.forEach((hwInstance) => {
				if (hwInstance.status === "running") {
					const hw = this.getHardware(hwInstance.hardwareId);
					const servicesOnHw = this.getServicesOnHardware(hwInstance.id);

					let totalLoad = 0;
					servicesOnHw.forEach((svc) => {
						const svcYield = serviceYields.get(svc.id) || 0;
						totalLoad += svcYield;
					});

					// If overloaded, throttle proportionally
					if (totalLoad > hw.maximumYield) {
						const throttleFactor = hw.maximumYield / totalLoad;
						servicesOnHw.forEach((svc) => {
							const currentYield = serviceYields.get(svc.id) || 0;
							serviceYields.set(svc.id, currentYield * throttleFactor);
						});
					}

					totalRecurringCost += hw.recurringCost || 0;
				}
			});

			// Calculate project yields (minimum of all services)
			this.projectInstances.forEach((projInstance) => {
				const version = this.getCurrentProjectVersion(projInstance);

				if (version) {
					// Check requirements
					const requirementsMet = this.checkProjectRequirements(
						projInstance,
						version,
					);

					if (requirementsMet) {
						const projectServices = this.serviceInstances.filter(
							(svc) =>
								svc.status === "running" &&
								(svc.assignedProjectId === projInstance.projectId ||
									this.getService(svc.serviceId).global),
						);

						if (projectServices.length > 0) {
							const yields = projectServices
								.filter((svc) => serviceYields.has(svc.id))
								.map((svc) => serviceYields.get(svc.id));
							if (yields.length > 0) {
								const projectYield = Math.min(...yields);
								totalGrossYield += projectYield;
								projInstance.currentProduction +=
									projectYield * (this.TICK_INTERVAL / 1000);
							}
						}
					}
				}
			});

			// Apply global service multipliers
			let globalMultiplier = 1;
			this.serviceInstances.forEach((svc) => {
				if (svc.status === "running") {
					const service = this.getService(svc.serviceId);
					if (service.global) {
						const version = this.getServiceVersion(svc.serviceVersionId);
						globalMultiplier += version.yieldMultiplier - 1;
					}
				}
			});

			const globalYield = totalGrossYield * globalMultiplier;
			this.currentNetYield = globalYield - totalRecurringCost;
		},

		updateProductionTracking(deltaTime) {
			// Track service production
			this.serviceInstances.forEach((svc) => {
				if (svc.status === "running") {
					const version = this.getServiceVersion(svc.serviceVersionId);
					if (version.baseYield !== null && version.baseYield !== undefined) {
						svc.currentProduction += version.baseYield * deltaTime;
					}
				}
			});

			// Track hardware production (sum of services)
			this.hardwareInstances.forEach((hwInstance) => {
				if (hwInstance.status === "running") {
					const services = this.getServicesOnHardware(hwInstance.id);
					let hwProduction = 0;
					services.forEach((svc) => {
						if (svc.status === "running") {
							const version = this.getServiceVersion(svc.serviceVersionId);
							if (
								version.baseYield !== null &&
								version.baseYield !== undefined
							) {
								hwProduction += version.baseYield * deltaTime;
							}
						}
					});
					hwInstance.currentProduction += hwProduction;
				}
			});
		},

		finalizeProductionHistory() {
			// Move currentProduction to productionHistory for projects
			this.projectInstances.forEach((proj) => {
				proj.productionHistory.push(proj.currentProduction);
				proj.currentProduction = 0;
			});

			// Move currentProduction to productionHistory for services
			this.serviceInstances.forEach((svc) => {
				svc.productionHistory.push(svc.currentProduction);
				svc.currentProduction = 0;
			});

			// Move currentProduction to productionHistory for hardware
			this.hardwareInstances.forEach((hw) => {
				hw.productionHistory.push(hw.currentProduction);
				hw.currentProduction = 0;
			});
		},

		checkCrashes(deltaTime) {
			// Check hardware crashes
			this.hardwareInstances.forEach((hwInstance) => {
				if (hwInstance.status === "running") {
					const hw = this.getHardware(hwInstance.hardwareId);
					const crashProbability = hw.crashRate * deltaTime;
					if (Math.random() < crashProbability) {
						hwInstance.status = "crashed";
						this.log("error", `CRASH: Hardware ${hw.name} has crashed!`);
					}
				}
			});

			// Check service crashes
			this.serviceInstances.forEach((svcInstance) => {
				if (svcInstance.status === "running") {
					const version = this.getServiceVersion(svcInstance.serviceVersionId);
					const crashProbability = version.crashRate * deltaTime;
					if (Math.random() < crashProbability) {
						svcInstance.status = "crashed";
						const service = this.getService(svcInstance.serviceId);
						this.log("error", `CRASH: Service ${service.name} has crashed!`);
					}
				}
			});
		},

		checkProjectRequirements(projInstance, version) {
			const requirements = version.serviceTypeRequirements || [];
			const strictRequirements = version.serviceRequirements || [];

			// Check type requirements
			for (const reqType of requirements) {
				const hasService = this.serviceInstances.some((svc) => {
					const service = this.getService(svc.serviceId);
					return (
						svc.status === "running" &&
						service.type === reqType &&
						(svc.assignedProjectId === projInstance.projectId || service.global)
					);
				});
				if (!hasService) return false;
			}

			// Check strict requirements
			for (const reqId of strictRequirements) {
				const hasService = this.serviceInstances.some((svc) => {
					return (
						svc.status === "running" &&
						svc.serviceVersionId === reqId &&
						(svc.assignedProjectId === projInstance.projectId ||
							this.getService(svc.serviceId).global)
					);
				});
				if (!hasService) return false;
			}

			return true;
		},

		checkTrimesterKPIs() {
			if (this.currentTrimester < 1) return;
			this.projectInstances.forEach((projInstance) => {
				const version = this.getCurrentProjectVersion(projInstance);
				if (version) {
					const trimesterProduction = this.getTrimesterProduction(projInstance);
					const target = version.targetProduction;
					const ratio = trimesterProduction / target;

					if (ratio < this.KPI_FAILURE_THRESHOLD) {
						projInstance.strikes++;
						this.log(
							"warning",
							`Project ${this.getProject(projInstance.projectId).name} missed KPI! Strike ${projInstance.strikes}/${this.STRIKE_LIMIT}`,
						);

						if (projInstance.strikes >= this.STRIKE_LIMIT) {
							this.log(
								"error",
								`Project ${this.getProject(projInstance.projectId).name} CANCELLED!`,
							);
							this.projectFailures++;

							if (this.projectFailures >= this.GAME_OVER_FAILURE_LIMIT) {
								this.gameOver();
							}
						}
					}
				}
			});
		},

		getTrimesterProduction(projInstance) {
			const trimesterLength = this.TRIMESTER_DURATION;
			const relevantHistory = projInstance.productionHistory.slice(
				-trimesterLength,
			);
			return relevantHistory.reduce((sum, p) => sum + p, 0);
		},

		checkUnlocks() {
			// Check for new projects
			this.projectsConfig.forEach((project) => {
				if (this.isUnlocked(project)) {
					const exists = this.projectInstances.find(
						(p) => p.projectId === project.id,
					);
					if (!exists) {
						const activeVersion = this.getActiveProjectVersion(project);
						this.projectInstances.push({
							projectId: project.id,
							currentVersionId: activeVersion?.id || null,
							strikes: 0,
							currentProduction: 0,
							productionHistory: [],
						});
						this.log("info", `New project unlocked: ${project.name}`);
					}
				}
			});

			// Check for mails to display
			this.checkMails();
		},

		checkMails() {
			this.mailsConfig.forEach((mail) => {
				if (this.isUnlocked(mail)) {
					const exists = this.mailInstances.find((m) => m.mailId === mail.id);
					if (!exists) {
						this.mailInstances.push({
							mailId: mail.id,
							optionId: null,
						});
						this.saveGame(); // Save immediately when mail is triggered
					}
				}
			});

			// Show unresponded mails
			const unrespondedMail = this.mailInstances.find((m) => !m.optionId);
			if (unrespondedMail && !this.showMail) {
				this.currentMail = this.mailsConfig.find(
					(m) => m.id === unrespondedMail.mailId,
				);
				this.showMail = true;
			}
		},

		isUnlocked(item) {
			if (!item) return false;

			// Check trimester unlock
			if (
				item.unlockAtTrimester !== undefined &&
				item.unlockAtTrimester !== null
			) {
				if (this.currentTrimester >= item.unlockAtTrimester) {
					return true;
				}
			}

			// Check event unlock
			if (item.unlockAtEvent) {
				if (this.events.some((e) => e.eventId === item.unlockAtEvent)) {
					return true;
				}
			}

			// If no unlock conditions, it's unlocked by default
			if (
				(item.unlockAtTrimester === undefined ||
					item.unlockAtTrimester === null) &&
				!item.unlockAtEvent
			) {
				return true;
			}

			return false;
		},

		// === ACTIONS ===
		deployHardware(hardware) {
			if (this.kouraks < hardware.deployCost) {
				this.log("error", "Pas assez de Kouraks!");
				return;
			}

			this.kouraks -= hardware.deployCost;
			this.emergencyShutdownForNegativeKouraks();

			const instance = {
				id: this.generateId(),
				hardwareId: hardware.id,
				status: "stopped",
				remainingDeployTime: hardware.deployTime,
				remainingRestartTime: 0,
				currentProduction: 0,
				productionHistory: [],
				expanded: false,
			};

			this.hardwareInstances.push(instance);
			this.log("info", `Deploying hardware: ${hardware.name}`);
			this.showHardwareMarketplace = false;
			this.saveGame();
		},

		sellHardware(hwInstance) {
			const hw = this.getHardware(hwInstance.hardwareId);
			const sellValue =
				hw.sellValue || hw.deployCost * this.HARDWARE_SELL_RATIO;

			// Stop all services on this hardware
			this.serviceInstances.forEach((svc) => {
				if (svc.assignedHardwareId === hwInstance.id) {
					svc.status = "stopped";
					this.log(
						"warning",
						`Service ${this.getService(svc.serviceId).name} stopped (hardware sold)`,
					);
				}
			});

			this.kouraks += sellValue;
			this.hardwareInstances = this.hardwareInstances.filter(
				(h) => h.id !== hwInstance.id,
			);
			this.log(
				"info",
				`Sold hardware: ${hw.name} for ${this.formatNumber(sellValue)} K`,
			);
			this.saveGame();
		},

		restartHardware(hwInstance) {
			const hw = this.getHardware(hwInstance.hardwareId);
			hwInstance.status = "restarting";
			hwInstance.remainingRestartTime = hw.restartDuration;
			this.log("info", `Restarting hardware: ${hw.name}`);
		},

		startHardware(hwInstance) {
			hwInstance.status = "running";
			this.log(
				"info",
				`Started hardware: ${this.getHardware(hwInstance.hardwareId).name}`,
			);
		},

		shutdownHardware(hwInstance) {
			const hw = this.getHardware(hwInstance.hardwareId);
			hwInstance.status = "stopped";
			// Stop all services on this hardware
			this.serviceInstances.forEach((svc) => {
				if (
					svc.assignedHardwareId === hwInstance.id &&
					svc.status === "running"
				) {
					svc.status = "stopped";
					this.log(
						"warning",
						`Service ${this.getService(svc.serviceId).name} stopped (hardware shutdown)`,
					);
				}
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
			const config = this.selectedServiceConfig;
			if (!config) return;

			// Validation
			if (config.version.requireHardware && !config.hardwareId) {
				this.log("error", "Sélectionner un hardware!");
				return;
			}

			if (!config.service.global && !config.projectId) {
				this.log("error", "Sélectionner un projet!");
				return;
			}

			if (this.kouraks < config.version.deployCost) {
				this.log("error", "Pas assez de Kouraks!");
				return;
			}

			this.kouraks -= config.version.deployCost;
			this.emergencyShutdownForNegativeKouraks();

			const instance = {
				id: this.generateId(),
				serviceId: config.service.id,
				serviceVersionId: config.version.id,
				status: config.version.deployTime > 0 ? "deploying" : "running",
				assignedProjectId: config.service.global ? null : config.projectId,
				assignedHardwareId: config.version.requireHardware
					? config.hardwareId
					: null,
				remainingRestartTime: 0,
				remainingDeployTime: config.version.deployTime,
				currentProduction: 0,
				productionHistory: [],
			};

			this.serviceInstances.push(instance);
			this.log(
				"info",
				`Deploying service: ${config.service.name} ${config.version.name}`,
			);
			this.showServiceConfig = false;
			this.selectedServiceConfig = null;
			this.saveGame();
		},

		restartService(svcInstance) {
			const version = this.getServiceVersion(svcInstance.serviceVersionId);
			svcInstance.status = "restarting";
			svcInstance.remainingRestartTime = version.restartDuration;
			this.log(
				"info",
				`Restarting service: ${this.getService(svcInstance.serviceId).name}`,
			);
		},

		stopService(svcInstance) {
			svcInstance.status = "stopped";
			this.log(
				"info",
				`Stopped service: ${this.getService(svcInstance.serviceId).name}`,
			);
		},

		startService(svcInstance) {
			svcInstance.status = "running";
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
				hardwareId: svcInstance.assignedHardwareId,
				projectId: svcInstance.assignedProjectId,
				existingInstance: svcInstance,
			};
			this.showServiceConfig = true;
		},

		respondToMail(option) {
			const mailInstance = this.mailInstances.find(
				(m) => m.mailId === this.currentMail.id,
			);
			if (mailInstance) {
				mailInstance.optionId = option.id;

				// Trigger event if option has one
				if (option.eventId) {
					this.triggerEvent(option.eventId);
				}
			}

			this.showMail = false;
			this.currentMail = null;
			this.saveGame();
		},

		triggerEvent(eventId) {
			this.events.push({
				eventId: eventId,
				timestamp: this.gameTime,
			});
			this.log("info", `Event triggered: ${eventId}`);
		},

		gameOver() {
			this.log("error", "=== GAME OVER ===");
			clearInterval(this.tickInterval);
			alert(
				"GAME OVER: Trop de projets annulés. Le PDG vous remercie pour vos services.",
			);
		},

		// === HELPERS ===
		getHardware(id) {
			return this.hardwareConfig.find((h) => h.id === id) || {};
		},

		getService(id) {
			return this.servicesConfig.find((s) => s.id === id) || {};
		},

		getServiceVersion(id) {
			for (const service of this.servicesConfig) {
				const version = service.versions?.find((v) => v.id === id);
				if (version) return version;
			}
			return {};
		},

		getProject(id) {
			return this.projectsConfig.find((p) => p.id === id) || {};
		},

		getProjectVersion(projectId, versionId) {
			const project = this.getProject(projectId);
			return project.versions?.find((v) => v.id === versionId) || null;
		},

		getActiveProjectVersion(project) {
			if (!project.versions) return null;
			// Find the latest unlocked version
			const unlockedVersions = project.versions.filter((v) =>
				this.isUnlocked(v),
			);
			return unlockedVersions[unlockedVersions.length - 1] || null;
		},

		getCurrentProjectVersion(projInstance) {
			if (!projInstance.currentVersionId) {
				// Find latest unlocked version
				const project = this.getProject(projInstance.projectId);
				const activeVersion = this.getActiveProjectVersion(project);
				if (activeVersion) {
					projInstance.currentVersionId = activeVersion.id;
				}
				return activeVersion;
			}
			return this.getProjectVersion(
				projInstance.projectId,
				projInstance.currentVersionId,
			);
		},

		getServicesOnHardware(hardwareInstanceId) {
			return this.serviceInstances.filter(
				(svc) => svc.assignedHardwareId === hardwareInstanceId,
			);
		},

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
					svc.assignedProjectId === projInstance.projectId,
			);
			if (services.length === 0) return 0;

			const yields = services
				.filter((svc) => {
					const version = this.getServiceVersion(svc.serviceVersionId);
					return version.baseYield !== null && version.baseYield !== undefined;
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
					(svc.assignedProjectId === projInstance.projectId || service.global)
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
			if (
				version.deprecatedAtTrimester !== undefined &&
				version.deprecatedAtTrimester !== null
			) {
				return this.currentTrimester >= version.deprecatedAtTrimester;
			}
			return false;
		},

		generateId() {
			return `inst_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
		},

		log(type, message) {
			this.logs.push({
				time: this.gameTime,
				type: type,
				message: message,
			});

			// Keep only last logs
			if (this.logs.length > this.MAX_LOG_SIZE) {
				this.logs = this.logs.slice(-this.MAX_LOG_SIZE);
			}
		},

		// Emergency shutdown if Kouraks is negative
		emergencyShutdownForNegativeKouraks() {
			if (this.kouraks < 0) {
				// Stop hardware with nonzero recurringCost
				this.hardwareInstances.forEach((hwInstance) => {
					if (hwInstance.status === "running") {
						const hwConfig = this.getHardware(hwInstance.hardwareId);
						if (hwConfig.recurringCost && hwConfig.recurringCost > 0) {
							hwInstance.status = "stopped";
							this.log(
								"warning",
								`Hardware ${hwConfig.name} stopped: plus assez de Kouraks pour payer le coût récurrent.`,
							);
						}
					}
				});
				// Stop services with nonzero recurringCost
				this.serviceInstances.forEach((svcInstance) => {
					if (svcInstance.status === "running") {
						const ver = this.getServiceVersion(svcInstance.serviceVersionId);
						if (ver.recurringCost && ver.recurringCost > 0) {
							svcInstance.status = "stopped";
							const service = this.getService(svcInstance.serviceId);
							this.log(
								"warning",
								`Service ${service.name} arrêté: plus assez de Kouraks pour payer le coût récurrent.`,
							);
						}
					}
				});
				// Set Kouraks to zero
				this.kouraks = 0;
				this.log(
					"error",
					"Fonds épuisés : arrêt de toutes les machines/services ayant un coût récurrent. Kouraks remis à zéro.",
				);
			}
		},

		formatNumber(num) {
			if (num >= 1000000) {
				return `${(num / 1000000).toFixed(2)}M`;
			} else if (num >= 1000) {
				return `${(num / 1000).toFixed(2)}K`;
			} else {
				return num.toFixed(2);
			}
		},

		formatTime(seconds) {
			const mins = Math.floor(seconds / 60);
			const secs = Math.floor(seconds % 60);
			return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
		},

		formatTrimester(trimester) {
			return trimester.toFixed(1);
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

		// === COMPUTED PROPERTIES ===
		get activeProjectInstances() {
			return this.projectInstances.filter(
				(p) => p.strikes < this.STRIKE_LIMIT && p.currentVersionId !== null,
			);
		},

		get availableHardware() {
			return this.hardwareConfig.filter((hw) => this.isUnlocked(hw));
		},

		get runningHardwareInstances() {
			return this.hardwareInstances.filter((hw) => hw.status === "running");
		},

		get ownedHardwareInstances() {
			// Returns all hardware instances owned by the player, regardless of status
			return this.hardwareInstances;
		},

		get filteredServices() {
			const services = this.servicesConfig.filter((svc) => {
				// Only show services that have at least one unlocked version
				const hasUnlockedVersion = (svc.versions || []).some((v) =>
					this.isUnlocked(v),
				);
				if (!hasUnlockedVersion) return false;

				// Type filter
				if (this.serviceMarketplaceFilters.typeFilter) {
					if (svc.type !== this.serviceMarketplaceFilters.typeFilter)
						return false;
				}

				// Name filter
				if (this.serviceMarketplaceFilters.nameFilter) {
					const search =
						this.serviceMarketplaceFilters.nameFilter.toLowerCase();
					if (
						!svc.name.toLowerCase().includes(search) &&
						!svc.description.toLowerCase().includes(search)
					)
						return false;
				}

				// Free only filter
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
				// Hide deprecated versions; if all unlocked versions are deprecated, show them anyway
				const nonDeprecated = unlocked.filter(
					(v) => !this.isVersionDeprecated(v),
				);
				if (nonDeprecated.length > 0) {
					unlocked = nonDeprecated;
				}
			}

			if (this.serviceMarketplaceFilters.latestOnly) {
				// Return only the latest version
				return unlocked.length > 0 ? [unlocked[unlocked.length - 1]] : [];
			}

			return unlocked;
		},

		get availableServiceTypes() {
			const types = new Set();
			this.servicesConfig.forEach((svc) => {
				if ((svc.versions || []).some((v) => this.isUnlocked(v))) {
					types.add(svc.type);
				}
			});
			return [...types].sort();
		},

		// === SAVE/LOAD ===
		saveGame() {
			const saveData = {
				kouraks: this.kouraks,
				gameTime: this.gameTime,
				projectFailures: this.projectFailures,
				hardwareInstances: this.hardwareInstances,
				serviceInstances: this.serviceInstances,
				projectInstances: this.projectInstances,
				mailInstances: this.mailInstances,
				events: this.events,
				logs: this.logs.slice(-this.SAVE_LOG_SIZE),
			};

			localStorage.setItem("kourasks_save", JSON.stringify(saveData));
		},

		loadGame() {
			const saved = localStorage.getItem("kourasks_save");
			if (saved) {
				try {
					const data = JSON.parse(saved);
					this.kouraks = data.kouraks || 0;
					this.gameTime = data.gameTime || 0;
					this.projectFailures = data.projectFailures || 0;
					this.hardwareInstances = data.hardwareInstances || [];
					this.serviceInstances = data.serviceInstances || [];
					this.projectInstances = data.projectInstances || [];
					this.mailInstances = data.mailInstances || [];
					this.events = data.events || [];
					this.logs = data.logs || [];
					this.lastSecond = Math.floor(this.gameTime);

					this.log("info", "Game loaded from save");
				} catch (error) {
					this.log("error", `Failed to load save: ${error.message}`);
				}
			}
		},
	}));
});
