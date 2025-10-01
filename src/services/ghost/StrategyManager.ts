import { UseCaseType } from "./types/PromptGenerator"
import { GhostXmlStrategy } from "./GhostXmlStrategy"

export interface StrategyInfo {
	id: string // Ghost Strategy ID (e.g., "xml-default")
	name: string // Display name (e.g., "XML-based Strategy")
	description: string // User-friendly description
	type: UseCaseType // The use case type this strategy handles
	createInstance: () => GhostXmlStrategy // Factory function to create strategy instance
}

export const AVAILABLE_STRATEGIES: StrategyInfo[] = [
	{
		id: "xml-default",
		name: "XML-based Strategy",
		description: "Default XML-based code generation strategy",
		type: UseCaseType.USER_REQUEST,
		createInstance: () => new GhostXmlStrategy({ debug: true }),
	},
	// Future strategies will be added here
]

export const DEFAULT_STRATEGY_ID = "xml-default"

export const StrategyManager = {
	getAvailableStrategies(): StrategyInfo[] {
		return AVAILABLE_STRATEGIES
	},

	hasMultipleStrategies(): boolean {
		return AVAILABLE_STRATEGIES.length > 1
	},

	getStrategyById(id: string): StrategyInfo | undefined {
		return AVAILABLE_STRATEGIES.find((s) => s.id === id)
	},

	getDefaultStrategyId(): string {
		return DEFAULT_STRATEGY_ID
	},

	isValidStrategyId(id: string): boolean {
		return AVAILABLE_STRATEGIES.some((s) => s.id === id)
	},

	createStrategyInstance(strategyId: string): GhostXmlStrategy {
		const strategy = this.getStrategyById(strategyId)
		if (strategy) {
			return strategy.createInstance()
		}

		// Fallback to default strategy
		console.warn(`Unknown Ghost Strategy ID: ${strategyId}, falling back to default`)
		const defaultStrategy = this.getStrategyById(DEFAULT_STRATEGY_ID)
		return defaultStrategy!.createInstance()
	},
}
