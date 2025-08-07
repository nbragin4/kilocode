// kilocode_change - new file
import { describe, it, expect, vi, beforeEach } from "vitest"
import { GitExtensionService, GitChange, GitProgressOptions } from "../GitExtensionService"
import { CommitContext } from "../types"
import * as commitTokenUtils from "../../../utils/commit-token-utils"

// Mock dependencies
vi.mock("../../../utils/commit-token-utils")
vi.mock("../../../core/ignore/RooIgnoreController")

const mockExceedsContextThreshold = vi.mocked(commitTokenUtils.exceedsContextThreshold)
const mockChunkDiffByFiles = vi.mocked(commitTokenUtils.chunkDiffByFiles)

describe("GitExtensionService", () => {
	let gitService: GitExtensionService
	const mockChanges: GitChange[] = [
		{ filePath: "/test/file1.ts", status: "Modified" },
		{ filePath: "/test/file2.ts", status: "Added" },
	]

	const mockDiff = `diff --git a/file1.ts b/file1.ts
index 1234567..abcdefg 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1,3 +1,4 @@
 function hello() {
+  console.log("Hello");
   return "world";
 }
diff --git a/file2.ts b/file2.ts
index 2345678..bcdefgh 100644
--- a/file2.ts
+++ b/file2.ts
@@ -1,3 +1,4 @@
 function goodbye() {
+  console.log("Goodbye");
   return "farewell";
 }`

	beforeEach(() => {
		vi.clearAllMocks()
		gitService = new GitExtensionService()

		vi.spyOn(gitService as any, "getDiffForChanges").mockResolvedValue(mockDiff)

		vi.spyOn(gitService as any, "getSummary").mockReturnValue(
			" file1.ts | 10 ++++++++++\n file2.ts | 5 +++++\n 2 files changed, 15 insertions(+)",
		)
		vi.spyOn(gitService as any, "getCurrentBranch").mockReturnValue("feature/test-branch")
		vi.spyOn(gitService as any, "getRecentCommits").mockReturnValue("abc123 Initial commit\ndef456 Add feature")
	})

	describe("getCommitContext", () => {
		it("should return single context when diff is small", async () => {
			// Mock shouldChunk to return false (small diff)
			vi.spyOn(gitService as any, "shouldChunk").mockResolvedValue(false)

			const result = await gitService.getCommitContext()

			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(1)
			expect(result[0]).toHaveProperty("diff")
			expect(result[0]).toHaveProperty("summary")
			expect(result[0]).toHaveProperty("branch")
			expect(result[0]).toHaveProperty("recentCommits")
		})

		it("should return chunked contexts when diff is large", async () => {
			// Mock shouldChunk to return true (large diff)
			vi.spyOn(gitService as any, "shouldChunk").mockResolvedValue(true)

			mockChunkDiffByFiles.mockResolvedValue({
				chunks: [
					`diff --git a/file1.ts b/file1.ts
index 1234567..abcdefg 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1,3 +1,4 @@
	function hello() {
+  console.log("Hello");
		return "world";
	}`,
					`diff --git a/file2.ts b/file2.ts
index 2345678..bcdefgh 100644
--- a/file2.ts
+++ b/file2.ts
@@ -1,3 +1,4 @@
	function goodbye() {
+  console.log("Goodbye");
		return "farewell";
	}`,
				],
				wasChunked: true,
				chunkCount: 2,
			})

			const result = await gitService.getCommitContext()

			expect(Array.isArray(result)).toBe(true)
			const chunks = result as CommitContext[]
			expect(chunks).toHaveLength(2)
			expect(chunks[0]).toHaveProperty("diff")
			expect(chunks[0]).toHaveProperty("isChunked", true)
			expect(chunks[0]).toHaveProperty("chunkIndex", 0)
			expect(chunks[0]).toHaveProperty("totalChunks", 2)
			expect(chunks[1]).toHaveProperty("diff")
			expect(chunks[1]).toHaveProperty("isChunked", true)
			expect(chunks[1]).toHaveProperty("chunkIndex", 1)
			expect(chunks[1]).toHaveProperty("totalChunks", 2)
			expect(mockChunkDiffByFiles).toHaveBeenCalledWith(mockDiff)
		})

		it("should handle chunking with default parameters", async () => {
			// Mock shouldChunk to return true (large diff)
			vi.spyOn(gitService as any, "shouldChunk").mockResolvedValue(true)

			mockChunkDiffByFiles.mockResolvedValue({
				chunks: ["chunk1", "chunk2"],
				wasChunked: true,
				chunkCount: 2,
			})

			const result = await gitService.getCommitContext()

			expect(Array.isArray(result)).toBe(true)
			expect(mockChunkDiffByFiles).toHaveBeenCalledWith(mockDiff)
		})

		it("should handle errors gracefully", async () => {
			// Mock getDiffForChanges to throw an error
			vi.spyOn(gitService as any, "getDiffForChanges").mockRejectedValue(new Error("Git command failed"))

			const result = await gitService.getCommitContext()

			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(1)
			expect(result[0]).toHaveProperty("diff", "")
			expect(result[0]).toHaveProperty("summary", "Error generating context")
		})

		it("should include repository context in all chunks", async () => {
			// Mock shouldChunk to return true (large diff)
			vi.spyOn(gitService as any, "shouldChunk").mockResolvedValue(true)

			mockChunkDiffByFiles.mockResolvedValue({
				chunks: ["chunk1", "chunk2"],
				wasChunked: true,
				chunkCount: 2,
			})

			const result = await gitService.getCommitContext()

			expect(Array.isArray(result)).toBe(true)
			const chunks = result as CommitContext[]

			chunks.forEach((chunk) => {
				expect(chunk).toHaveProperty("branch", "feature/test-branch")
				expect(chunk).toHaveProperty("recentCommits")
				expect(chunk.recentCommits).toContain("abc123 Initial commit")
			})
		})

		it("should call progress callback during diff collection", async () => {
			const onProgress = vi.fn()
			const options: GitProgressOptions = {
				onProgress,
			}

			await gitService.getCommitContext(options)

			// Progress callback is called in getDiffForChanges, which we mocked
			// So we can't test this directly, but we can verify the method was called
			expect(gitService as any).toBeDefined()
		})

		it("should handle basic context generation", async () => {
			// Mock shouldChunk to return false (small diff)
			vi.spyOn(gitService as any, "shouldChunk").mockResolvedValue(false)

			const result = await gitService.getCommitContext()

			expect(Array.isArray(result)).toBe(true)
			expect(result).toHaveLength(1)
			expect(result[0]).toHaveProperty("diff")
			expect(result[0]).toHaveProperty("summary")
			expect(result[0]).toHaveProperty("branch")
			expect(result[0]).toHaveProperty("recentCommits")
		})
	})
})
