// Core data types for Ghost Benchmarks Web Interface

export interface TestCase {
	id: string // File path-based ID
	name: string
	category: string
	description: string
	hasLiveModeSupport: boolean
	expectedGroupCount?: number
	shouldCompile?: boolean
	supportedProfiles?: string[]
	filePath: string // Original directory path
	// Autocomplete-specific fields
	cursorPosition?: { line: number; character: number }
	expectedPatterns?: string[]
	isAutocompleteTest?: boolean
}

export interface Profile {
	name: string
	model: string
	description: string
	provider: string
}

export interface TestResult {
	success: boolean
	testName: string
	profile: string
	mode: string
	passed: boolean
	executionTime?: number
	groups?: number
	selectedGroup?: number
	error?: string
	suggestions?: any // Ghost suggestions data from CLI
	// Additional fields from CLI BenchmarkResult
	rawResponse?: string
	finalFileContent?: string
	metrics?: {
		responseTime: number
		success: boolean
		tokensUsed?: number
	}
}

export interface TestDetails {
	testName: string
	inputFiles: { [filename: string]: string }
	expectedFiles: { [filename: string]: string }
	activeFile: string
	cursorPosition: { line: number; character: number }
	metadata: any
	error?: string
}

export interface WebSocketState {
	connected: boolean
	testCases: TestCase[]
	profiles: Profile[]
	testResults: Map<string, TestResult>
	runningTests: Set<string>
	globalProgress: number
	selectedTestDetails: TestDetails | null
	selectedTestId: string | null
}

// WebSocket message types
export interface ClientMessages {
	"run-test": { testName: string; profile: string }
	"run-matrix": { tests: string[]; profiles: string[] }
	"get-test-details": { testName: string }
	"refresh-data": {}
}

export interface ServerMessages {
	"test-cases": TestCase[]
	profiles: Profile[]
	"test-progress": { testName: string; profile: string; progress: number }
	"test-result": TestResult
	"test-details": TestDetails
	"matrix-complete": { results: TestResult[]; totalCombinations: number }
}

// UI State types
export interface UIState {
	selectedTests: Set<string>
	selectedProfiles: Set<string>
	selectedTestForDetails: string | null
}
