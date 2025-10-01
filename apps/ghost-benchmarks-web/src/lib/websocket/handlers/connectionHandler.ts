import { registerHandler } from "../handlerRegistry"
import type { WebSocketState } from "@/types"

// Connection handler - self-registers on import
registerHandler({
	name: "connection",
	register: (socket, setState) => {
		socket.on("connect", () => {
			console.log("🔌 WebSocket connected")
			setState((prev) => ({ ...prev, connected: true }))
		})

		socket.on("disconnect", () => {
			console.log("🔌 WebSocket disconnected")
			setState((prev) => ({ ...prev, connected: false }))
		})
	},
})
