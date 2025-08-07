// kilocode_change - new file
export interface CommitContext {
	diff: string
	summary?: string
	branch?: string
	recentCommits?: string[]
	// NO isStaged field - we don't distinguish between staged/unstaged
	isChunked?: boolean
	chunkIndex?: number
	totalChunks?: number
}

export interface ChunkResult {
	chunks: string[]
	wasChunked: boolean
	chunkCount: number
	exceedsLimit?: boolean
}
