import { describe, it, expect } from "vitest"
import { StrategyManager } from "../StrategyManager"
import { UseCaseType } from "../types/PromptGenerator"

describe("StrategyManager", () => {
	describe("getAvailableStrategies", () => {
		it("should return at least one strategy", () => {
			const strategies = StrategyManager.getAvailableStrategies()
			expect(strategies).toHaveLength(1)
			expect(strategies[0]).toMatchObject({
				id: "xml-default",
				name: "XML-based Strategy",
				description: "Default XML-based code generation strategy",
				type: UseCaseType.USER_REQUEST,
			})
			expect(strategies[0].createInstance).toBeInstanceOf(Function)
		})
	})

	describe("isValidStrategyId", () => {
		it("should return true for valid strategy ID", () => {
			expect(StrategyManager.isValidStrategyId("xml-default")).toBe(true)
		})

		it("should return false for invalid strategy ID", () => {
			expect(StrategyManager.isValidStrategyId("invalid")).toBe(false)
		})
	})
})
