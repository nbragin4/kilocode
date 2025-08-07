// kilocode_change - new file
import { describe, it, expect, vi, beforeEach } from "vitest"
import { estimateTokenCount, getContextWindow, exceedsContextThreshold, chunkDiffByFiles } from "../commit-token-utils"
import * as countTokensModule from "../countTokens"
import * as apiModule from "../../api"
import { ContextProxy } from "../../core/config/ContextProxy"

vi.mock("../countTokens")
vi.mock("../../api")
vi.mock("../../core/config/ContextProxy", () => ({
	ContextProxy: {
		instance: {
			getProviderSettings: vi.fn().mockReturnValue({}),
		},
	},
}))

const mockCountTokens = vi.mocked(countTokensModule.countTokens)
const mockBuildApiHandler = vi.mocked(apiModule.buildApiHandler)

describe("commit-token-utils", () => {
	const mockApiHandler = {
		getModel: vi.fn().mockReturnValue({
			info: { contextWindow: 200000 },
		}),
	}

	beforeEach(() => {
		vi.clearAllMocks()
		mockBuildApiHandler.mockReturnValue(mockApiHandler as any)
	})

	describe("estimateTokenCount", () => {
		it("should return 0 for empty or whitespace-only text", async () => {
			expect(await estimateTokenCount("")).toBe(0)
			expect(await estimateTokenCount("   ")).toBe(0)
			expect(await estimateTokenCount("\n\t")).toBe(0)
		})

		it("should call countTokens with correct parameters", async () => {
			mockCountTokens.mockResolvedValue(42)
			const text = "Hello world"

			const result = await estimateTokenCount(text)

			expect(mockCountTokens).toHaveBeenCalledWith([{ type: "text", text }], { useWorker: false })
			expect(result).toBe(42)
		})

		it("should handle text with special characters", async () => {
			mockCountTokens.mockResolvedValue(15)
			const text = "Hello 世界! 🌍"

			const result = await estimateTokenCount(text)

			expect(result).toBe(15)
			expect(mockCountTokens).toHaveBeenCalledWith([{ type: "text", text }], { useWorker: false })
		})
	})

	describe("getContextWindow", () => {
		it("should return context window from API handler", () => {
			mockApiHandler.getModel.mockReturnValue({
				info: { contextWindow: 128000 },
			})

			const result = getContextWindow()

			expect(result).toBe(128000)
		})

		it("should return default context window when model info is missing", () => {
			mockApiHandler.getModel.mockReturnValue({
				info: {},
			})

			const result = getContextWindow()

			expect(result).toBe(200000)
		})

		it("should return default context window when API handler fails", () => {
			mockBuildApiHandler.mockImplementation(() => {
				throw new Error("API handler failed")
			})

			const result = getContextWindow()

			expect(result).toBe(200000)
		})
	})

	describe("exceedsContextThreshold", () => {
		it("should return false when text is within threshold", async () => {
			mockCountTokens.mockResolvedValue(50000) // 25% of 200000
			mockApiHandler.getModel.mockReturnValue({
				info: { contextWindow: 200000 },
			})

			const result = await exceedsContextThreshold("some text", 0.95)

			expect(result).toBe(false)
		})

		it("should return true when text exceeds threshold", async () => {
			mockCountTokens.mockResolvedValue(195000) // 97.5% of 200000
			mockApiHandler.getModel.mockReturnValue({
				info: { contextWindow: 200000 },
			})

			const result = await exceedsContextThreshold("large text", 0.95)

			expect(result).toBe(true)
		})

		it("should use default threshold of 0.95", async () => {
			mockCountTokens.mockResolvedValue(195000)
			mockApiHandler.getModel.mockReturnValue({
				info: { contextWindow: 200000 },
			})

			const result = await exceedsContextThreshold("large text")

			expect(result).toBe(true)
		})
	})

	describe("chunkDiffByFiles", () => {
		const singleFileDiff = `diff --git a/file1.ts b/file1.ts
index 1234567..abcdefg 100644
--- a/file1.ts
+++ b/file1.ts
@@ -1,3 +1,4 @@
 function hello() {
+  console.log("Hello");
   return "world";
 }`

		const multiFileDiff = `diff --git a/file1.ts b/file1.ts
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

		it("should not chunk small single file diff", async () => {
			mockCountTokens.mockResolvedValue(1000)
			mockApiHandler.getModel.mockReturnValue({
				info: { contextWindow: 200000 },
			})

			const result = await chunkDiffByFiles(singleFileDiff)

			expect(result.wasChunked).toBe(false)
			expect(result.chunks).toHaveLength(1)
			expect(result.chunks[0]).toBe(singleFileDiff)
			expect(result.chunkCount).toBe(1)
		})

		it("should not chunk small multi-file diff", async () => {
			mockCountTokens.mockResolvedValue(5000)
			mockApiHandler.getModel.mockReturnValue({
				info: { contextWindow: 200000 },
			})

			const result = await chunkDiffByFiles(multiFileDiff)

			expect(result.wasChunked).toBe(false)
			expect(result.chunks).toHaveLength(1)
			expect(result.chunks[0]).toBe(multiFileDiff)
			expect(result.chunkCount).toBe(1)
		})

		it("should chunk large multi-file diff", async () => {
			mockCountTokens.mockResolvedValueOnce(100000).mockResolvedValueOnce(50000).mockResolvedValueOnce(45000)

			mockApiHandler.getModel.mockReturnValue({
				info: { contextWindow: 200000 },
			})

			const result = await chunkDiffByFiles(multiFileDiff)

			expect(result.wasChunked).toBe(true)
			expect(result.chunks).toHaveLength(2)
			expect(result.chunks[0]).toContain("file1.ts")
			expect(result.chunks[1]).toContain("file2.ts")
			expect(result.chunkCount).toBe(2)
		})

		it("should handle empty diff", async () => {
			mockCountTokens.mockResolvedValue(0)

			const result = await chunkDiffByFiles("")

			expect(result.wasChunked).toBe(false)
			expect(result.chunks).toHaveLength(1)
			expect(result.chunks[0]).toBe("")
			expect(result.chunkCount).toBe(1)
		})

		it("should handle malformed diff gracefully", async () => {
			const malformedDiff = "not a valid diff"
			mockCountTokens.mockResolvedValue(1000)

			const result = await chunkDiffByFiles(malformedDiff)

			expect(result.wasChunked).toBe(false)
			expect(result.chunks).toHaveLength(1)
			expect(result.chunks[0]).toBe(malformedDiff)
			expect(result.chunkCount).toBe(1)
		})

		it("should handle large diff that would exceed limits", async () => {
			// Create a diff that would normally be chunked into many pieces
			const largeDiff = Array.from(
				{ length: 25 },
				(_, i) =>
					`diff --git a/file${i}.ts b/file${i}.ts
index 1234567..abcdefg 100644
--- a/file${i}.ts
+++ b/file${i}.ts
@@ -1,3 +1,4 @@
	function test${i}() {
+  console.log("test${i}");
		 return "test${i}";
	}`,
			).join("\n")

			// Mock token counts to force chunking - each file is large enough to need its own chunk
			mockCountTokens
				.mockResolvedValueOnce(2000000) // total tokens (very large)
				.mockResolvedValue(85000) // each file tokens (larger than target chunk size of 80000)

			mockApiHandler.getModel.mockReturnValue({
				info: { contextWindow: 200000 },
			})

			const result = await chunkDiffByFiles(largeDiff)

			// Should fall back to single chunk when too many chunks would be needed
			expect(result.wasChunked).toBe(false)
			expect(result.chunks).toHaveLength(1)
			expect(result.chunks[0]).toBe(largeDiff)
			expect(result.exceedsLimit).toBe(true)
			expect(result.chunkCount).toBe(25) // Reports actual chunk count that would be needed
		})

		it("should allow chunking when within reasonable limits", async () => {
			mockCountTokens
				.mockResolvedValueOnce(100000) // total tokens (large)
				.mockResolvedValueOnce(50000) // file1 tokens
				.mockResolvedValueOnce(45000) // file2 tokens

			mockApiHandler.getModel.mockReturnValue({
				info: { contextWindow: 200000 },
			})

			const result = await chunkDiffByFiles(multiFileDiff)

			expect(result.wasChunked).toBe(true)
			expect(result.chunks).toHaveLength(2)
			expect(result.exceedsLimit).toBe(false)
			expect(result.chunkCount).toBe(2)
		})
	})
})
