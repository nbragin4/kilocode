// kilocode_change - new file
import { countTokens } from "./countTokens"
import { buildApiHandler } from "../api"
import { ContextProxy } from "../core/config/ContextProxy"
import { ChunkResult } from "../services/commit-message/types"

const MAX_CHUNKS = 10

export async function estimateTokenCount(text: string): Promise<number> {
	if (!text || text.trim().length === 0) {
		return 0
	}

	const contentBlocks = [{ type: "text" as const, text }]
	return await countTokens(contentBlocks, { useWorker: false })
}

export function getContextWindow(): number {
	try {
		const contextProxy = ContextProxy.instance
		const apiConfiguration = contextProxy.getProviderSettings()
		const apiHandler = buildApiHandler(apiConfiguration)
		return apiHandler.getModel().info.contextWindow || 200000
	} catch (error) {
		return 200000
	}
}

export async function exceedsContextThreshold(text: string, threshold: number = 0.95): Promise<boolean> {
	const tokenCount = await estimateTokenCount(text)
	const contextWindow = getContextWindow()
	const maxTokensAllowed = Math.floor(contextWindow * threshold)

	return tokenCount > maxTokensAllowed
}

export async function chunkDiffByFiles(diffText: string): Promise<ChunkResult> {
	const contextWindow = getContextWindow()
	const maxTokens = Math.floor(contextWindow * 0.4)

	const totalTokens = await estimateTokenCount(diffText)
	if (totalTokens <= maxTokens) {
		return {
			chunks: [diffText],
			wasChunked: false,
			chunkCount: 1,
			exceedsLimit: false,
		}
	}

	// Simple file-based chunking
	const fileDiffs = diffText.split(/^diff --git /m).filter((chunk) => chunk.trim())

	if (fileDiffs.length > MAX_CHUNKS) {
		return {
			chunks: [diffText],
			wasChunked: false,
			chunkCount: fileDiffs.length,
			exceedsLimit: true,
		}
	}

	// Group files into chunks that fit within token limit
	const chunks: string[] = []
	let currentChunk = ""
	let currentTokens = 0

	for (const fileDiff of fileDiffs) {
		const fullDiff = fileDiff.startsWith("a/") ? `diff --git ${fileDiff}` : fileDiff
		const fileTokens = await estimateTokenCount(fullDiff)

		if (currentTokens + fileTokens > maxTokens && currentChunk) {
			chunks.push(currentChunk)
			currentChunk = fullDiff
			currentTokens = fileTokens
		} else {
			currentChunk += (currentChunk ? "\n" : "") + fullDiff
			currentTokens += fileTokens
		}
	}

	if (currentChunk) {
		chunks.push(currentChunk)
	}

	return {
		chunks,
		wasChunked: chunks.length > 1,
		chunkCount: chunks.length,
		exceedsLimit: false,
	}
}
