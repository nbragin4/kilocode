import { registerHandler } from "../handlerRegistry"

// Test details handler - self-registers on import
registerHandler({
	name: "testDetails",
	register: (socket, setState) => {
		// This handler is already covered in dataHandler
		// Keeping as separate file for future enhancements
		console.log("📄 Test details handler registered (covered by data handler)")
	},
})
