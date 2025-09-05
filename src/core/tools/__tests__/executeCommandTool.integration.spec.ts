import { describe, it, expect, vi, beforeEach } from "vitest"
import { executeCommand, ExecuteCommandOptions } from "../executeCommandTool"
import { Task } from "../../task/Task"
import { TerminalRegistry } from "../../../integrations/terminal/TerminalRegistry"

// Mock dependencies
vi.mock("../../../integrations/terminal/TerminalRegistry")
vi.mock("../../../integrations/terminal/Terminal")

describe("executeCommand integration with commandUtils", () => {
	let mockTask: any
	let mockTerminal: any
	let mockProvider: any

	beforeEach(() => {
		// Reset all mocks
		vi.clearAllMocks()

		mockProvider = {
			postMessageToWebview: vi.fn(),
		}

		mockTask = {
			cwd: "/project",
			taskId: "test-task",
			providerRef: {
				deref: vi.fn().mockResolvedValue(mockProvider),
			},
			say: vi.fn().mockResolvedValue(undefined),
			ask: vi.fn().mockResolvedValue({ response: "messageResponse", text: "", images: [] }),
		}

		mockTerminal = {
			id: 1,
			provider: "execa",
			busy: false,
			taskId: undefined,
			getCurrentWorkingDirectory: vi.fn().mockReturnValue("/project"),
			runCommand: vi.fn().mockReturnValue(Promise.resolve()),
		}

		// Mock TerminalRegistry
		vi.mocked(TerminalRegistry.getOrCreateTerminal).mockResolvedValue(mockTerminal)
	})

	it("should detect and convert cd && command patterns", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		const options: ExecuteCommandOptions = {
			executionId: "test-exec",
			command: "cd frontend && npm install",
			terminalShellIntegrationDisabled: true,
		}

		// Mock the terminal command execution
		mockTerminal.runCommand.mockImplementation((command: string, callbacks: any) => {
			// Simulate command completion
			setTimeout(() => {
				callbacks.onCompleted("Command completed successfully")
			}, 10)
			return Promise.resolve()
		})

		const [rejected, result] = await executeCommand(mockTask, options)

		// Verify conversion happened
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("[commandUtils] Auto-converted 'cd frontend && npm install' → cwd:"),
		)

		// Verify terminal was created with converted cwd
		expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith("/project/frontend", "test-task", "execa")

		// Verify only the actual command was run (not the cd part)
		expect(mockTerminal.runCommand).toHaveBeenCalledWith("npm install", expect.any(Object))

		expect(rejected).toBe(false)
		expect(result).toContain("Command executed")

		consoleSpy.mockRestore()
	})

	it("should handle quoted paths in cd commands", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		const options: ExecuteCommandOptions = {
			executionId: "test-exec",
			command: 'cd "path with spaces" && npm test',
			terminalShellIntegrationDisabled: true,
		}

		mockTerminal.runCommand.mockImplementation((command: string, callbacks: any) => {
			setTimeout(() => {
				callbacks.onCompleted("Tests completed")
			}, 10)
			return Promise.resolve()
		})

		const [rejected, result] = await executeCommand(mockTask, options)

		// Verify conversion happened
		expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining("[commandUtils] Auto-converted"))

		// Verify terminal was created with resolved quoted path
		expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith(
			"/project/path with spaces",
			"test-task",
			"execa",
		)

		expect(mockTerminal.runCommand).toHaveBeenCalledWith("npm test", expect.any(Object))

		expect(rejected).toBe(false)
		consoleSpy.mockRestore()
	})

	it("should not convert normal commands without cd patterns", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		const options: ExecuteCommandOptions = {
			executionId: "test-exec",
			command: "npm install",
			terminalShellIntegrationDisabled: true,
		}

		mockTerminal.runCommand.mockImplementation((command: string, callbacks: any) => {
			setTimeout(() => {
				callbacks.onCompleted("Command completed")
			}, 10)
			return Promise.resolve()
		})

		const [rejected, result] = await executeCommand(mockTask, options)

		// Verify no conversion happened
		expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("[commandUtils] Auto-converted"))

		// Verify terminal was created with original cwd
		expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith("/project", "test-task", "execa")

		// Verify original command was run
		expect(mockTerminal.runCommand).toHaveBeenCalledWith("npm install", expect.any(Object))

		expect(rejected).toBe(false)
		consoleSpy.mockRestore()
	})

	it("should handle Windows-style chdir commands", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		const options: ExecuteCommandOptions = {
			executionId: "test-exec",
			command: "chdir backend && python setup.py",
			terminalShellIntegrationDisabled: true,
		}

		mockTerminal.runCommand.mockImplementation((command: string, callbacks: any) => {
			setTimeout(() => {
				callbacks.onCompleted("Setup completed")
			}, 10)
			return Promise.resolve()
		})

		const [rejected, result] = await executeCommand(mockTask, options)

		// Verify conversion happened
		expect(consoleSpy).toHaveBeenCalledWith(
			expect.stringContaining("[commandUtils] Auto-converted 'chdir backend && python setup.py' → cwd:"),
		)

		expect(TerminalRegistry.getOrCreateTerminal).toHaveBeenCalledWith("/project/backend", "test-task", "execa")

		expect(mockTerminal.runCommand).toHaveBeenCalledWith("python setup.py", expect.any(Object))

		expect(rejected).toBe(false)
		consoleSpy.mockRestore()
	})

	it("should not convert incomplete cd commands", async () => {
		const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})

		const options: ExecuteCommandOptions = {
			executionId: "test-exec",
			command: "cd frontend &&",
			terminalShellIntegrationDisabled: true,
		}

		mockTerminal.runCommand.mockImplementation((command: string, callbacks: any) => {
			setTimeout(() => {
				callbacks.onCompleted("Command completed")
			}, 10)
			return Promise.resolve()
		})

		const [rejected, result] = await executeCommand(mockTask, options)

		// Verify no conversion happened for incomplete command
		expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining("[commandUtils] Auto-converted"))

		// Original command should be used
		expect(mockTerminal.runCommand).toHaveBeenCalledWith("cd frontend &&", expect.any(Object))

		expect(rejected).toBe(false)
		consoleSpy.mockRestore()
	})
})
