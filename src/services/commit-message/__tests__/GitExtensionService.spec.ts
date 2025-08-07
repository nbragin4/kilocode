// kilocode_change - new file
// npx vitest services/commit-message/__tests__/GitExtensionService.spec.ts
import { spawnSync } from "child_process"
import * as path from "path"
import type { Mock } from "vitest"
import { GitExtensionService } from "../GitExtensionService"
import { CommitContext } from "../types"

vi.mock("child_process", () => ({
	spawnSync: vi.fn(),
}))

vi.mock("vscode", () => ({
	workspace: {
		workspaceFolders: [{ uri: { fsPath: "/test/workspace" } }],
		createFileSystemWatcher: vi.fn(() => ({
			onDidCreate: vi.fn(() => ({ dispose: vi.fn() })),
			onDidChange: vi.fn(() => ({ dispose: vi.fn() })),
			onDidDelete: vi.fn(() => ({ dispose: vi.fn() })),
			dispose: vi.fn(),
		})),
	},
	extensions: {
		getExtension: vi.fn(() => ({
			isActive: true,
			exports: {
				getAPI: vi.fn(() => ({
					repositories: [
						{
							rootUri: { fsPath: "/test/workspace" },
							inputBox: { value: "" },
						},
					],
				})),
			},
		})),
	},
	env: {
		clipboard: { writeText: vi.fn() },
	},
	window: { showInformationMessage: vi.fn() },
	RelativePattern: vi.fn().mockImplementation((base, pattern) => ({ base, pattern })),
}))

const mockSpawnSync = spawnSync as Mock

describe("GitExtensionService", () => {
	let service: GitExtensionService

	beforeEach(() => {
		service = new GitExtensionService()
		service.configureRepositoryContext()
		mockSpawnSync.mockClear()
	})

	describe("getDiffForChanges", () => {
		it("should generate diffs per file and exclude files properly", async () => {
			const files = ["src/test.ts", "package-lock.json", "src/utils.ts"]
			const mockFileListOutput = files.join("\n")

			const testTsDiff = "diff --git a/src/test.ts b/src/test.ts\n+added line"
			const utilsTsDiff = "diff --git a/src/utils.ts b/src/utils.ts\n+added util"

			mockSpawnSync
				.mockReturnValueOnce({ status: 0, stdout: mockFileListOutput, stderr: "", error: null })
				.mockReturnValueOnce({ status: 0, stdout: testTsDiff, stderr: "", error: null })
				.mockReturnValueOnce({ status: 0, stdout: utilsTsDiff, stderr: "", error: null })

			const getDiffForChanges = (service as any).getDiffForChanges
			const result = await getDiffForChanges.call(service)

			expect(mockSpawnSync).toHaveBeenNthCalledWith(1, "git", ["diff", "--name-only"], expect.any(Object))

			// Should call git diff for non-excluded files only
			expect(mockSpawnSync).toHaveBeenNthCalledWith(2, "git", ["diff", "--", "src/test.ts"], expect.any(Object))
			expect(mockSpawnSync).toHaveBeenNthCalledWith(3, "git", ["diff", "--", "src/utils.ts"], expect.any(Object))

			// Should NOT call git diff for package-lock.json (excluded file)
			expect(mockSpawnSync).not.toHaveBeenCalledWith(
				"git",
				["diff", "--", "package-lock.json"],
				expect.any(Object),
			)

			// Should return aggregated diffs
			expect(result).toBe(`${testTsDiff}\n${utilsTsDiff}`)
		})

		it("should return empty string when no files", async () => {
			mockSpawnSync.mockReturnValue({ status: 0, stdout: "", stderr: "", error: null })

			const getDiffForChanges = (service as any).getDiffForChanges
			const result = await getDiffForChanges.call(service)

			expect(result).toBe("")
			expect(mockSpawnSync).toHaveBeenCalledTimes(1)
		})

		it("should handle file paths with special characters", async () => {
			const files = ["src/file with spaces.ts", "src/file'with'quotes.ts"]
			const mockFileListOutput = files.join("\n")
			const spaceDiff = "diff --git a/src/file with spaces.ts b/src/file with spaces.ts\n+content"
			const quoteDiff = "diff --git a/src/file'with'quotes.ts b/src/file'with'quotes.ts\n+content"

			mockSpawnSync
				.mockReturnValueOnce({ status: 0, stdout: mockFileListOutput, stderr: "", error: null })
				.mockReturnValueOnce({ status: 0, stdout: spaceDiff, stderr: "", error: null })
				.mockReturnValueOnce({ status: 0, stdout: quoteDiff, stderr: "", error: null })

			const getDiffForChanges = (service as any).getDiffForChanges
			const result = await getDiffForChanges.call(service)

			// Should handle file paths with special characters without manual escaping
			expect(mockSpawnSync).toHaveBeenNthCalledWith(
				2,
				"git",
				["diff", "--", "src/file with spaces.ts"],
				expect.any(Object),
			)
			expect(mockSpawnSync).toHaveBeenNthCalledWith(
				3,
				"git",
				["diff", "--", "src/file'with'quotes.ts"],
				expect.any(Object),
			)

			expect(result).toBe(`${spaceDiff}\n${quoteDiff}`)
		})
	})

	describe("gatherChanges", () => {
		it("should gather changes correctly", async () => {
			const mockStatusOutput = "M\tfile1.ts\nA\tfile2.ts\nD\tfile3.ts"
			mockSpawnSync.mockReturnValue({ status: 0, stdout: mockStatusOutput, stderr: "", error: null })

			const result = await service.gatherChanges({})

			expect(mockSpawnSync).toHaveBeenCalledWith("git", ["diff", "--name-status"], expect.any(Object))

			expect(result).toEqual([
				{ filePath: path.join("/test/workspace/file1.ts"), status: "Modified" },
				{ filePath: path.join("/test/workspace/file2.ts"), status: "Added" },
				{ filePath: path.join("/test/workspace/file3.ts"), status: "Deleted" },
			])
		})

		it("should return empty array when no changes", async () => {
			mockSpawnSync.mockReturnValue({ status: 0, stdout: "", stderr: "", error: null })

			const result = await service.gatherChanges({})

			expect(result).toEqual([])
		})

		it("should return empty array when git command fails", async () => {
			mockSpawnSync.mockReturnValue({ status: 1, stdout: "", stderr: "error", error: new Error("Git error") })

			const result = await service.gatherChanges({})

			expect(result).toEqual([])
		})
	})

	describe("getCommitContext", () => {
		it("should generate context for changes", async () => {
			mockSpawnSync
				.mockReturnValueOnce({ status: 0, stdout: "file1.ts", stderr: "", error: null })
				.mockReturnValueOnce({ status: 0, stdout: "diff content", stderr: "", error: null })
				.mockReturnValueOnce({ status: 0, stdout: "1 file changed", stderr: "", error: null })
				.mockReturnValueOnce({ status: 0, stdout: "main", stderr: "", error: null })
				.mockReturnValueOnce({ status: 0, stdout: "abc123 commit", stderr: "", error: null })

			const result = await service.getCommitContext()

			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(1)
			expect(result[0]).toHaveProperty("diff")
			expect(result[0]).toHaveProperty("summary")
			expect(result[0]).toHaveProperty("branch")
			expect(result[0]).toHaveProperty("recentCommits")
		})
	})
})
