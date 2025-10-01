import { registerHandler } from "../handlerRegistry"
import type { TestResult } from "@/types"

// Execution handler - self-registers on import
registerHandler({
	name: "execution",
	register: (socket, setState) => {
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
	},
})
