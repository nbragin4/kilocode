import { describe, it, expect } from "vitest"
import * as path from "path"
import { detectAndConvertCdPattern, CommandConversionResult } from "../commandUtils"

describe("detectAndConvertCdPattern", () => {
	const baseCwd = "/project/root"

	describe("Basic && patterns (should convert)", () => {
		it("should convert cd with && - simple case", () => {
			const result = detectAndConvertCdPattern("cd frontend && npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.posix.resolve(baseCwd, "frontend"),
				wasConverted: true,
			})
		})

		it("should convert chdir with &&", () => {
			const result = detectAndConvertCdPattern("chdir backend && npm test", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm test",
				finalCwd: path.posix.resolve(baseCwd, "backend"),
				wasConverted: true,
			})
		})

		it("should handle relative paths with ../", () => {
			const result = detectAndConvertCdPattern("cd ../parent && ls -la", baseCwd)

			expect(result).toEqual({
				finalCommand: "ls -la",
				finalCwd: path.posix.resolve(baseCwd, "../parent"),
				wasConverted: true,
			})
		})

		it("should handle nested paths", () => {
			const result = detectAndConvertCdPattern("cd src/components && npm run build", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm run build",
				finalCwd: path.posix.resolve(baseCwd, "src/components"),
				wasConverted: true,
			})
		})

		it("should handle case insensitive cd/chdir", () => {
			const result = detectAndConvertCdPattern("CD frontend && npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.posix.resolve(baseCwd, "frontend"),
				wasConverted: true,
			})
		})
	})

	describe("Quoted paths", () => {
		it("should handle double-quoted paths", () => {
			const result = detectAndConvertCdPattern('cd "path with spaces" && npm install', baseCwd)

			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.posix.resolve(baseCwd, "path with spaces"),
				wasConverted: true,
			})
		})

		it("should handle single-quoted paths", () => {
			const result = detectAndConvertCdPattern("cd 'another path' && npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.posix.resolve(baseCwd, "another path"),
				wasConverted: true,
			})
		})

		it("should handle escaped quotes in double quotes", () => {
			const result = detectAndConvertCdPattern('cd "path with \\"nested\\" quotes" && ls', baseCwd)

			expect(result).toEqual({
				finalCommand: "ls",
				finalCwd: path.posix.resolve(baseCwd, 'path with "nested" quotes'),
				wasConverted: true,
			})
		})
	})

	describe("Windows-specific patterns", () => {
		it("should handle cd /d with && (Windows drive change)", () => {
			// For this test, we'll use a Windows-style base path
			const winBaseCwd = "C:\\project"
			const result = detectAndConvertCdPattern("cd /d D:\\work && dir", winBaseCwd)

			expect(result).toEqual({
				finalCommand: "dir",
				finalCwd: "D:\\work",
				wasConverted: true,
			})
		})

		it("should handle chdir with quoted Windows paths", () => {
			const winBaseCwd = "C:\\project"
			const result = detectAndConvertCdPattern('chdir "C:\\Program Files" && dir', winBaseCwd)

			expect(result).toEqual({
				finalCommand: "dir",
				finalCwd: "C:\\Program Files",
				wasConverted: true,
			})
		})
	})

	describe("Complex command patterns", () => {
		it("should handle commands with multiple arguments", () => {
			const result = detectAndConvertCdPattern("cd frontend && npm run build --prod", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm run build --prod",
				finalCwd: path.posix.resolve(baseCwd, "frontend"),
				wasConverted: true,
			})
		})

		it("should preserve command arguments and flags", () => {
			const result = detectAndConvertCdPattern("cd tests && python -m pytest --verbose", baseCwd)

			expect(result).toEqual({
				finalCommand: "python -m pytest --verbose",
				finalCwd: path.posix.resolve(baseCwd, "tests"),
				wasConverted: true,
			})
		})

		it("should handle commands with pipes and redirects", () => {
			const result = detectAndConvertCdPattern('cd logs && grep "error" *.log | head -10', baseCwd)

			expect(result).toEqual({
				finalCommand: 'grep "error" *.log | head -10',
				finalCwd: path.posix.resolve(baseCwd, "logs"),
				wasConverted: true,
			})
		})
	})

	describe("Patterns that should NOT convert (semantic preservation)", () => {
		it("should NOT convert semicolon separator (unconditional execution)", () => {
			const result = detectAndConvertCdPattern("cd frontend; npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "cd frontend; npm install",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should NOT convert single & (background execution)", () => {
			const result = detectAndConvertCdPattern("cd frontend & npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "cd frontend & npm install",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should NOT convert cd without subsequent command", () => {
			const result = detectAndConvertCdPattern("cd frontend", baseCwd)

			expect(result).toEqual({
				finalCommand: "cd frontend",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should NOT convert empty command after &&", () => {
			const result = detectAndConvertCdPattern("cd frontend &&", baseCwd)

			expect(result).toEqual({
				finalCommand: "cd frontend &&",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should NOT convert cd in the middle of command chain", () => {
			const result = detectAndConvertCdPattern("npm run build && cd dist && ls", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm run build && cd dist && ls",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should NOT convert commands that just mention cd", () => {
			const result = detectAndConvertCdPattern('echo "use cd to change directory"', baseCwd)

			expect(result).toEqual({
				finalCommand: 'echo "use cd to change directory"',
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})
	})

	describe("Edge cases and error handling", () => {
		it("should handle empty input", () => {
			const result = detectAndConvertCdPattern("", baseCwd)

			expect(result).toEqual({
				finalCommand: "",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should handle whitespace-only input", () => {
			const result = detectAndConvertCdPattern("   ", baseCwd)

			expect(result).toEqual({
				finalCommand: "",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should handle cd without arguments", () => {
			const result = detectAndConvertCdPattern("cd && npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "cd && npm install",
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})

		it("should handle whitespace variations", () => {
			const result = detectAndConvertCdPattern("cd   frontend   &&   npm install", baseCwd)

			expect(result).toEqual({
				finalCommand: "npm install",
				finalCwd: path.posix.resolve(baseCwd, "frontend"),
				wasConverted: true,
			})
		})
	})

	describe("Cross-platform path resolution", () => {
		it("should handle Unix absolute paths", () => {
			const result = detectAndConvertCdPattern("cd /usr/local/bin && ls", baseCwd)

			expect(result).toEqual({
				finalCommand: "ls",
				finalCwd: "/usr/local/bin",
				wasConverted: true,
			})
		})

		it("should handle home directory expansion", () => {
			const result = detectAndConvertCdPattern("cd ~/projects && ls", baseCwd)

			// The actual home directory will be resolved, but we can check the structure
			expect(result.wasConverted).toBe(true)
			expect(result.finalCommand).toBe("ls")
			expect(result.finalCwd).toContain("projects")
		})

		it("should NOT convert when path style conflicts with base (Unix path on Windows base)", () => {
			const winBaseCwd = "C:\\Windows\\System32"
			const result = detectAndConvertCdPattern("cd /usr/bin && ls", winBaseCwd)

			expect(result).toEqual({
				finalCommand: "cd /usr/bin && ls",
				finalCwd: winBaseCwd,
				wasConverted: false,
			})
		})

		it("should NOT convert when path style conflicts with base (Windows path on Unix base)", () => {
			const result = detectAndConvertCdPattern('cd "C:\\Program Files" && dir', baseCwd)

			expect(result).toEqual({
				finalCommand: 'cd "C:\\Program Files" && dir',
				finalCwd: baseCwd,
				wasConverted: false,
			})
		})
	})
})
