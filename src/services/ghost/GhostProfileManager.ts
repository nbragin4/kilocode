import { GhostProfile } from "@roo-code/types"
import { ProviderSettingsManager } from "../../core/config/ProviderSettingsManager"

const SUPPORTED_DEFAULT_PROVIDERS = ["mistral", "kilocode", "openrouter"]

export class GhostProfileManager {
	/**
	 * Create a ghost profile from settings - purely derived, not stored for now
	 */
	static async createGhostProfileFromSettings(
		settings: { enableCustomProvider?: boolean; apiConfigId?: string },
		providerSettingsManager: ProviderSettingsManager,
	): Promise<GhostProfile> {
		if (settings?.enableCustomProvider && settings?.apiConfigId) {
			// Custom mode: use their specific API config
			return {
				id: "custom",
				name: "Custom Provider",
				apiConfigId: settings.apiConfigId,
				strategyId: "xml-default",
			}
		} else {
			// Default mode: auto-select (same logic as current GhostModel)
			const profiles = await providerSettingsManager.listConfig()
			const validProfiles = profiles
				.filter((x) => x.apiProvider && SUPPORTED_DEFAULT_PROVIDERS.includes(x.apiProvider))
				.sort((a, b) => {
					if (!a.apiProvider) {
						return 1 // Place undefined providers at the end
					}
					if (!b.apiProvider) {
						return -1 // Place undefined providers at the beginning
					}
					return (
						SUPPORTED_DEFAULT_PROVIDERS.indexOf(a.apiProvider) -
						SUPPORTED_DEFAULT_PROVIDERS.indexOf(b.apiProvider)
					)
				})

			const selectedProfile = validProfiles[0]

			if (!selectedProfile) {
				throw new Error("No valid API profiles found for ghost. Please configure an API provider.")
			}

			return {
				id: "default",
				name: `Auto-Selected (${selectedProfile.apiProvider})`,
				apiConfigId: selectedProfile.id,
				strategyId: "xml-default",
			}
		}
	}
}
