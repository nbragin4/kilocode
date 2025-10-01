import type { Socket } from "socket.io-client"
import type { WebSocketState } from "@/types"

// Handler registration interface
export interface WebSocketHandler {
	name: string
	register: (socket: Socket, setState: React.Dispatch<React.SetStateAction<WebSocketState>>) => void
}

// Global handler registry - handlers self-register here on import
const handlerRegistry: WebSocketHandler[] = []

// Self-registration function - called by handlers on import
export function registerHandler(handler: WebSocketHandler) {
	handlerRegistry.push(handler)
	console.log(`📡 Handler self-registered: ${handler.name}`)
}

// Auto-discover and setup all registered handlers
export function setupAllHandlers(socket: Socket, setState: React.Dispatch<React.SetStateAction<WebSocketState>>) {
	console.log(`🔌 Setting up ${handlerRegistry.length} self-registered WebSocket handlers`)

	for (const handler of handlerRegistry) {
		try {
			handler.register(socket, setState)
			console.log(`✅ ${handler.name} handler active`)
		} catch (error) {
			console.error(`❌ Failed to setup ${handler.name}:`, error)
		}
	}
}

// Auto-import all handlers - they self-register on load
// This is the only place we need to know about handler files
async function loadAllHandlers() {
	try {
		// Star import automatically loads all handlers from index
		await import("./handlers")
		console.log(`🎯 All handlers loaded and self-registered via star import`)
	} catch (error) {
		console.error("❌ Failed to load handlers:", error)
	}
}

// Initialize handler loading
loadAllHandlers()

export { handlerRegistry }
