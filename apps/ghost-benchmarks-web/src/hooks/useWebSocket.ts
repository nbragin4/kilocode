"use client"

import { useEffect, useState } from "react"
import { io, Socket } from "socket.io-client"
import { setupAllHandlers } from "@/lib/websocket/handlerRegistry"
import type { WebSocketState } from "@/types"

export function useWebSocket() {
	const [socket, setSocket] = useState<Socket | null>(null)
	const [state, setState] = useState<WebSocketState>({
		connected: false,
		testCases: [],
		profiles: [],
		testResults: new Map(),
		runningTests: new Set(),
		globalProgress: 0,
		selectedTestDetails: null,
		selectedTestId: null,
	})

	useEffect(() => {
		const socketInstance = io()

		// Setup all self-registered handlers
		setupAllHandlers(socketInstance, setState)

		setSocket(socketInstance)

		return () => {
			socketInstance.close()
		}
	}, [])

	// Actions
	const runTest = (testName: string, profile: string) => {
		if (socket) {
			console.log(`🧪 Running test: ${testName} with ${profile} (live mode)`)
			socket.emit("run-test", { testName, profile })
		}
	}

	const runMatrix = (tests: string[], profiles: string[]) => {
		if (socket) {
			console.log(`🔄 Running matrix: ${tests.length} tests × ${profiles.length} profiles (live mode)`)
			setState((prev) => ({ ...prev, testResults: new Map(), globalProgress: 0 }))
			socket.emit("run-matrix", { tests, profiles })
		}
	}

	const getTestDetails = (testName: string) => {
		if (socket && socket.connected) {
			console.log(`📄 Requesting details for: ${testName}`)
			console.log(`🔌 Socket connected: ${socket.connected}`)
			socket.emit("get-test-details", { testName })
		} else {
			console.error(`❌ Cannot request test details - socket not ready:`, {
				socket: !!socket,
				connected: socket?.connected,
			})
		}
	}

	const refreshData = () => {
		if (socket) {
			console.log("🔄 Refreshing test cases and profiles from file system")
			socket.emit("refresh-data")
		}
	}

	return {
		...state,
		runTest,
		runMatrix,
		getTestDetails,
		refreshData,
	}
}
