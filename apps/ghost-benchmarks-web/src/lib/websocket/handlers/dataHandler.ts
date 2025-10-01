import { registerHandler } from "../handlerRegistry"
import type { TestCase, Profile, TestDetails } from "@/types"

// Data handler - self-registers on import
registerHandler({
	name: "data",
	register: (socket, setState) => {
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
	},
})
