import type { Socket } from "socket.io-client"
import type { TestCase, Profile, TestResult, TestDetails, WebSocketState } from "@/types"

export function setupConnectionHandlers(
	socket: Socket,
	setState: React.Dispatch<React.SetStateAction<WebSocketState>>,
) {
	socket.on("connect", () => {
		console.log("🔌 WebSocket connected")
		setState((prev) => ({ ...prev, connected: true }))
	})

	socket.on("disconnect", () => {
		console.log("🔌 WebSocket disconnected")
		setState((prev) => ({ ...prev, connected: false }))
	})
}

export function setupDataHandlers(socket: Socket, setState: React.Dispatch<React.SetStateAction<WebSocketState>>) {
	// Receive test cases from server
	socket.on("test-cases", (testCases: TestCase[]) => {
		console.log("📋 Received test cases:", testCases.length)
		setState((prev) => ({ ...prev, testCases }))
	})

	// Receive profiles from server
	socket.on("profiles", (profiles: Profile[]) => {
		console.log("🤖 Received profiles:", profiles.length)
		setState((prev) => ({ ...prev, profiles }))
	})

	// Handle test details
	socket.on("test-details", (details: TestDetails) => {
		console.log("📄 Received test details for:", details.testName)
		setState((prev) => ({ ...prev, selectedTestDetails: details }))
	})
}

export function setupExecutionHandlers(socket: Socket, setState: React.Dispatch<React.SetStateAction<WebSocketState>>) {
	// Handle test progress updates
	socket.on("test-progress", (data: { testName: string; profile: string; progress: number }) => {
		const key = `${data.testName}-${data.profile}`
		setState((prev) => ({
			...prev,
			runningTests: new Set([...prev.runningTests, key]),
			globalProgress: data.progress || 0,
		}))
	})

	// Handle test results
	socket.on("test-result", (result: TestResult) => {
		const key = `${result.testName}-${result.profile}`
		setState((prev) => {
			const newRunningTests = new Set(prev.runningTests)
			newRunningTests.delete(key)

			const newResults = new Map(prev.testResults)
			newResults.set(key, result)

			return {
				...prev,
				testResults: newResults,
				runningTests: newRunningTests,
			}
		})
	})

	// Handle matrix completion
	socket.on("matrix-complete", (data: { results: TestResult[]; totalCombinations: number }) => {
		console.log("🎉 Matrix execution complete:", data.results.length, "results")
		setState((prev) => ({
			...prev,
			runningTests: new Set(),
			globalProgress: 100,
		}))
	})
}

export function setupAllEventHandlers(socket: Socket, setState: React.Dispatch<React.SetStateAction<WebSocketState>>) {
	setupConnectionHandlers(socket, setState)
	setupDataHandlers(socket, setState)
	setupExecutionHandlers(socket, setState)
}
