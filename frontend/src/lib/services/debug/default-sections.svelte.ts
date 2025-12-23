import type { DebugServiceImpl } from "../debug.service.svelte";
import ButtonControl from "$lib/components/debug/controls/ButtonControl.svelte";
import RadioGroupControl from "$lib/components/debug/controls/RadioGroupControl.svelte";
import TextInputControl from "$lib/components/debug/controls/TextInputControl.svelte";
import AccordionControl from "$lib/components/debug/controls/AccordionControl.svelte";
import DisplayControl from "$lib/components/debug/controls/DisplayControl.svelte";
import SwitchControl from "$lib/components/debug/controls/SwitchControl.svelte";
import NumberControl from "$lib/components/debug/controls/NumberControl.svelte";
import { ThemeService } from "$lib/services/theme.service.svelte";
import { ConfigService } from "$lib/services/config.service.svelte";
import { NetworkService } from "$lib/services/network.service.svelte";
import { PwaService } from "$lib/features/pwa/services/pwa.service.svelte";
import { IslandNotificationService } from "$lib/features/status-indicator";
import { ApiLoadingService } from "$lib/services/api-loading.service.svelte";
import { FloatingIndicatorService } from "$lib/services/floating-indicator.service.svelte";
import { isTauri } from "$lib/utils/platform";
import ColorPaletteControl from "$lib/components/debug/controls/ColorPaletteControl.svelte";
import MailDebugSettings from "$lib/components/debug/sections/MailDebugSettings.svelte";

// --- Registration Logic ---
export function registerDefaultDebugSections(debugService: DebugServiceImpl) {
	// --- Appearance Section ---
	debugService.registerSection({
		id: "appearance",
		title: "Appearance",
		controls: [
			{
				id: "theme",
				component: RadioGroupControl,
				props: {
					label: "Theme",
					options: [
						{ value: "light", label: "Light" },
						{ value: "dark", label: "Dark" },
						{ value: "nature", label: "Nature" },
						{ value: "system", label: "System" },
					],
					value: ThemeService.theme,
					change: (value: "light" | "dark" | "system" | "nature") => {
						debugService.setTheme(value);
					},
				},
			},
			{
				id: 'theme_colors',
				component: ColorPaletteControl,
				props: {}
			}
		],
	});

	// --- Floating Indicator Section (Tauri only) ---
	if (isTauri()) {
		debugService.registerSection({
			id: "floating_indicator",
			title: "Floating Status Indicator",
			controls: [
				{
					id: "indicator_enabled",
					component: SwitchControl,
					props: {
						label: "Enable Floating Indicator",
						checked: FloatingIndicatorService.settings.value.enabled,
						change: (checked: boolean) => {
							FloatingIndicatorService.settings.value = {
								...FloatingIndicatorService.settings.value,
								enabled: checked
							};
						}
					}
				},
				{
					id: "indicator_size",
					component: NumberControl,
					props: {
						label: "Size (0.5-2.0)",
						value: FloatingIndicatorService.settings.value.size,
						min: 0.5,
						max: 2.0,
						step: 0.1,
						change: (value: number) => {
							FloatingIndicatorService.settings.value = {
								...FloatingIndicatorService.settings.value,
								size: value
							};
						}
					}
				},
				{
					id: "indicator_opacity",
					component: NumberControl,
					props: {
						label: "Opacity (0.5-1.0)",
						value: FloatingIndicatorService.settings.value.opacity,
						min: 0.5,
						max: 1.0,
						step: 0.05,
						change: (value: number) => {
							FloatingIndicatorService.settings.value = {
								...FloatingIndicatorService.settings.value,
								opacity: value
							};
						}
					}
				}
			]
		});
	}

	// --- Connection Section ---
	debugService.registerSection({
		id: "connection",
		title: "Connection",
		controls: [
			{
				id: "pocketbaseUrl",
				component: TextInputControl,
				props: {
					label: "PocketBase URL",
					value: ConfigService.pocketbaseUrl.value,
					update: (value: string) => {
						ConfigService.pocketbaseUrl.value = value;
					},
				},
			},
			{
				id: "saveAndReload",
				component: ButtonControl,
				props: {
					label: "Save & Reload",
					click: () => {
						window.location.reload();
					},
				},
			},
		],
	});

	// --- PWA Actions Section ---
	debugService.registerSection({
		id: "pwa_actions",
		title: "PWA Actions",
		controls: [
			{
				id: "pwa_platform_status",
				component: DisplayControl,
				props: {
					label: "Current Platform",
					value: PwaService.platformName,
				},
			},
			{
				id: "show_prompt",
				component: ButtonControl,
				props: {
					label: "Show Install Prompt",
					click: () => PwaService.showInstallPrompt(),
					disabled: isTauri(), // Disable in Tauri
				},
			},
			{
				id: "toggle_simulate_installed",
				component: ButtonControl,
				props: {
					label: "Toggle Simulate Installed",
					click: () => PwaService.toggleSimulateInstalled(),
				},
			},
			{
				id: "toggle_simulate_offline",
				component: ButtonControl,
				props: {
					label: "Toggle Simulate Offline",
					click: () => NetworkService.toggleSimulateOffline(),
				},
			},
			{
				id: "advanced_pwa",
				component: AccordionControl,
				props: {
					label: "Advanced PWA Controls",
					controls: [
						{
							id: "cache_management",
							component: AccordionControl,
							props: {
								label: "Cache Management",
								controls: [
									{
										id: "cache_info",
										component: DisplayControl,
										props: {
											label: "Info",
											value: "VitePWA/Workbox manages caching automatically",
										},
									},
									{
										id: "refresh_cache_stats",
										component: ButtonControl,
										props: {
											label: "Refresh Cache Stats",
											click: () => PwaService.updateCacheStats(),
										},
									},
									{
										id: "clear_cache",
										component: ButtonControl,
										props: {
											label: "Clear All Caches",
											click: () => PwaService.clearAllCaches(),
										},
									},
								],
							},
						},
						{
							id: "sw_management",
							component: AccordionControl,
							props: {
								label: "Service Worker",
								controls: [
									{
										id: "sw_info",
										component: DisplayControl,
										props: {
											label: "Provider",
											value: "VitePWA with Workbox",
										},
									},
									{
										id: "update_sw",
										component: ButtonControl,
										props: {
											label: "Check for Updates",
											click: () => PwaService.updateServiceWorker(),
										},
									},
								],
							},
						},
						{
							id: "feature_detection",
							component: AccordionControl,
							props: {
								label: "Feature Detection",
								controls: [
									{
										id: "feature_sw",
										component: DisplayControl,
										props: {
											label: "Service Worker",
											value: "serviceWorker" in navigator,
										},
									},
									{
										id: "feature_push",
										component: DisplayControl,
										props: {
											label: "Push Manager",
											value: "PushManager" in window,
										},
									},
									{
										id: "feature_sync",
										component: DisplayControl,
										props: {
											label: "Background Sync",
											value: "serviceWorker" in navigator && "SyncManager" in window,
										},
									},
									{
										id: "feature_badge",
										component: DisplayControl,
										props: {
											label: "App Badge",
											value: "setAppBadge" in navigator,
										},
									},
									{
										id: "recheck_features",
										component: ButtonControl,
										props: {
											label: "Re-check Features",
											click: () => PwaService.detectPwaFeatures(),
										},
									},
								],
							},
						},
					],
				},
			},
		],
	});

	// --- Notifications Section ---
	debugService.registerSection({
		id: "notifications",
		title: "Island Notifications",
		controls: [
			{
				id: "test_success",
				component: ButtonControl,
				props: {
					label: "Test Success",
					click: () => IslandNotificationService.success("Success notification!"),
				},
			},
			{
				id: "test_error",
				component: ButtonControl,
				props: {
					label: "Test Error",
					click: () => IslandNotificationService.error("Error notification!"),
				},
			},
			{
				id: "test_info",
				component: ButtonControl,
				props: {
					label: "Test Info",
					click: () => IslandNotificationService.info("Info notification"),
				},
			},
			{
				id: "test_warning",
				component: ButtonControl,
				props: {
					label: "Test Warning",
					click: () => IslandNotificationService.warning("Warning message"),
				},
			},
			{
				id: "test_loading",
				component: ButtonControl,
				props: {
					label: "Test Loading (5s)",
					click: () => {
						IslandNotificationService.loading("Processing...", { duration: 5000 });
					},
				},
			},
			{
				id: "api_loading_status",
				component: DisplayControl,
				props: {
					label: "API Requests Active",
					value: () => ApiLoadingService.activeCount,
				},
			},
			{
				id: "clear_api_loading",
				component: ButtonControl,
				props: {
					label: "Clear Stuck API Requests",
					click: () => {
						ApiLoadingService.clearAll();
						console.log("[Debug] Cleared all API loading states");
					},
				},
			},
		],
	});

	// --- Mail Section ---
	debugService.registerSection({
		id: "mail",
		title: "Mail",
		controls: [
			{
				id: "mail_debug",
				component: MailDebugSettings,
				props: {},
			},
		],
	});
}
