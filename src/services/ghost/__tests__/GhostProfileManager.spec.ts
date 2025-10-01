import { describe, it, expect, vi, beforeEach } from "vitest"
import { GhostProfileManager } from "../GhostProfileManager"
import { ProviderSettingsManager } from "../../../core/config/ProviderSettingsManager"
import { StrategyManager } from "../StrategyManager"

vi.mock("../StrategyManager", () => ({
	StrategyManager: {
		getDefaultStrategyId: vi.fn(() => "xml-default"),
		isValidStrategyId: vi.fn((id: string) => id === "xml-default"),
	},
}))

describe("GhostProfileManager", () => {
	let mockProviderSettingsManager: ProviderSettingsManager

	beforeEach(() => {
		vi.clearAllMocks()
		mockProviderSettingsManager = {
			listConfig: vi.fn(),
		} as any
	})

	describe("createGhostProfileFromSettings", () => {
		it("should create custom profile with selected API config and Ghost Strategy ID", async () => {
			const settings = {
				enableCustomProvider: true,
				apiConfigId: "test-api-config",
				ghostStrategyId: "xml-default",
			}

			const result = await GhostProfileManager.createGhostProfileFromSettings(
				settings,
				mockProviderSettingsManager,
			)

			expect(result).toEqual({
				id: "custom",
				name: "Custom Provider",
				apiConfigId: "test-api-config",
				strategyId: "xml-default",
			})
		})

		it("should use default strategy when no Ghost Strategy ID provided", async () => {
			const settings = { enableCustomProvider: true, apiConfigId: "test-api-config" }
			const result = await GhostProfileManager.createGhostProfileFromSettings(
				settings,
				mockProviderSettingsManager,
			)

			expect(result).toEqual({
				id: "custom",
				name: "Custom Provider",
				apiConfigId: "test-api-config",
				strategyId: "xml-default",
			})
			expect(StrategyManager.getDefaultStrategyId).toHaveBeenCalled()
		})

		it("should create default profile when custom provider disabled", async () => {
			mockProviderSettingsManager.listConfig = vi.fn().mockResolvedValue([
				{
					id: "mistral-config",
					name: "Mistral Config",
					apiProvider: "mistral",
				},
			])

			const settings = { enableCustomProvider: false }
			const result = await GhostProfileManager.createGhostProfileFromSettings(
				settings,
				mockProviderSettingsManager,
			)

			expect(result).toEqual({
				id: "default",
				name: "Auto-Selected (mistral)",
				apiConfigId: "mistral-config",
				strategyId: "xml-default",
			})
		})

		it("should throw error when no valid API profiles found", async () => {
			mockProviderSettingsManager.listConfig = vi.fn().mockResolvedValue([])

			const settings = { enableCustomProvider: false }

			await expect(
				GhostProfileManager.createGhostProfileFromSettings(settings, mockProviderSettingsManager),
			).rejects.toThrow("No valid API profiles found for ghost. Please configure an API provider.")
		})
	})
})
