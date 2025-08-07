// kilocode_change - new file
import * as vscode from "vscode"
import * as path from "path"
import { spawnSync } from "child_process"
import { shouldExcludeLockFile } from "./exclusionUtils"
import { RooIgnoreController } from "../../core/ignore/RooIgnoreController"
import { chunkDiffByFiles, estimateTokenCount, getContextWindow } from "../../utils/commit-token-utils"
import { t } from "../../i18n"
import { CommitContext } from "./types"

export interface GitChange {
	filePath: string
	status: string
}

export interface GitProgressOptions {
	onProgress?: (percentage: number) => void
}

export interface GitRepository {
	inputBox: { value: string }
	rootUri?: vscode.Uri
}

/**
 * Utility class for Git operations using direct shell commands
 */
export class GitExtensionService {
	private ignoreController: RooIgnoreController | null = null
	private targetRepository: GitRepository | null = null

	/**
	 * Configures the repository context for multi-workspace scenarios
	 */
	public configureRepositoryContext(resourceUri?: vscode.Uri): void {
		const newTargetRepository = this.determineTargetRepository(resourceUri)
		if (newTargetRepository && newTargetRepository !== this.targetRepository) {
			this.targetRepository = newTargetRepository

			// Create new ignore controller with the updated workspace root
			const newWorkspaceRoot = this.targetRepository?.rootUri?.fsPath
			if (newWorkspaceRoot) {
				this.ignoreController?.dispose()
				this.ignoreController = new RooIgnoreController(newWorkspaceRoot)
				this.ignoreController.initialize()
			}
		}
	}

	private determineTargetRepository(resourceUri?: vscode.Uri): GitRepository | null {
		try {
			const gitExtension = vscode.extensions.getExtension("vscode.git")
			if (!gitExtension || !gitExtension.isActive) {
				return null
			}

			const gitApi = gitExtension?.exports.getAPI(1)
			for (const repo of gitApi?.repositories ?? []) {
				if (repo.rootUri && resourceUri?.fsPath.startsWith(repo.rootUri.fsPath)) {
					return repo
				}
			}

			return gitApi.repositories[0] // Fallback to first repository
		} catch (error) {
			console.error("Error determining target repository:", error)
			return null
		}
	}

	/**
	 * Gathers information about changes (staged or unstaged)
	 */
	public async gatherChanges(options: GitProgressOptions): Promise<GitChange[]> {
		try {
			const statusOutput = this.getStatus()
			if (!statusOutput.trim()) {
				return []
			}

			const changes: GitChange[] = []
			const lines = statusOutput.split("\n").filter((line: string) => line.trim())
			const workspaceRoot = this.targetRepository?.rootUri?.fsPath || process.cwd()

			for (const line of lines) {
				if (line.length < 2) continue

				const statusCode = line.substring(0, 1).trim()
				const filePath = line.substring(1).trim()

				changes.push({
					filePath: path.join(workspaceRoot, filePath),
					status: this.getChangeStatusFromCode(statusCode),
				})
			}

			return changes
		} catch (error) {
			console.error(`Error gathering changes:`, error)
			return []
		}
	}

	/**
	 * Sets the commit message in the Git input box
	 */
	public setCommitMessage(message: string): void {
		if (this.targetRepository) {
			this.targetRepository.inputBox.value = message
			return
		}

		// Fallback to clipboard if VS Code Git Extension API is not available
		this.copyToClipboardFallback(message)
	}

	/**
	 * Runs a git command with arguments and returns the output
	 * @param args The git command arguments as an array
	 * @returns The command output as a string
	 */
	public spawnGitWithArgs(args: string[]): string {
		try {
			const workspaceRoot = this.targetRepository?.rootUri?.fsPath || process.cwd()
			const result = spawnSync("git", args, {
				cwd: workspaceRoot,
				encoding: "utf8",
				stdio: ["ignore", "pipe", "pipe"],
			})

			if (result.error) {
				throw result.error
			}

			if (result.status !== 0) {
				throw new Error(`Git command failed with status ${result.status}: ${result.stderr}`)
			}

			return result.stdout
		} catch (error) {
			console.error(`Error executing git command: git ${args.join(" ")}`, error)
			throw error
		}
	}

	private async getDiffForChanges(options?: GitProgressOptions): Promise<string> {
		const { onProgress } = options || {}
		try {
			const diffs: string[] = []
			// Just get ALL changes - no staged/unstaged distinction
			const files = this.spawnGitWithArgs(["diff", "--name-only"])
				.split("\n")
				.map((line) => line.trim())
				.filter((line) => line.length > 0)

			let processedFiles = 0
			for (const filePath of files) {
				if (this.ignoreController?.validateAccess(filePath) && !shouldExcludeLockFile(filePath)) {
					const diff = this.getGitDiff(filePath).trim()
					diffs.push(diff)
				}

				processedFiles++
				if (onProgress && files.length > 0) {
					const percentage = (processedFiles / files.length) * 100
					onProgress(percentage)
				}
			}

			return diffs.join("\n")
		} catch (error) {
			console.error("Error generating diff:", error)
			return ""
		}
	}

	private getStatus(): string {
		return this.spawnGitWithArgs(["diff", "--name-status"])
	}

	private getSummary(): string {
		return this.spawnGitWithArgs(["diff", "--stat"])
	}

	private getGitDiff(filePath: string): string {
		return this.spawnGitWithArgs(["diff", "--", filePath])
	}

	private getCurrentBranch(): string {
		return this.spawnGitWithArgs(["branch", "--show-current"])
	}

	private getRecentCommits(count: number = 5): string {
		return this.spawnGitWithArgs(["log", "--oneline", `-${count}`])
	}

	public async getCommitContext(options?: GitProgressOptions): Promise<CommitContext[]> {
		try {
			const diff = await this.getDiffForChanges(options)

			if (await this.shouldChunk(diff)) {
				return await this.createChunkedContexts(diff, options)
			}

			return [
				{
					diff,
					summary: this.getSummary(),
					branch: this.getCurrentBranch()?.trim(),
					recentCommits: this.getRecentCommits()
						?.split("\n")
						.filter((c) => c.trim()),
				},
			]
		} catch (error) {
			console.error("Error generating commit context:", error)
			return [
				{
					diff: "",
					summary: "Error generating context",
				},
			]
		}
	}

	private async shouldChunk(diff: string): Promise<boolean> {
		const tokens = await estimateTokenCount(diff)
		const contextWindow = getContextWindow()
		const maxTokens = Math.floor(contextWindow * 0.4)
		return tokens > maxTokens
	}

	private async createChunkedContexts(diff: string, options?: GitProgressOptions): Promise<CommitContext[]> {
		const chunkResult = await chunkDiffByFiles(diff)

		if (chunkResult.exceedsLimit) {
			return [
				{
					diff,
					summary: this.getSummary(),
					branch: this.getCurrentBranch()?.trim(),
					recentCommits: this.getRecentCommits()
						?.split("\n")
						.filter((c) => c.trim()),
				},
			]
		}

		// Return array of contexts, one per chunk
		return chunkResult.chunks.map((chunk, index) => ({
			diff: chunk,
			summary: index === 0 ? this.getSummary() : undefined,
			branch: this.getCurrentBranch()?.trim(),
			recentCommits: this.getRecentCommits()
				?.split("\n")
				.filter((c) => c.trim()),
			isChunked: true,
			chunkIndex: index,
			totalChunks: chunkResult.chunks.length,
		}))
	}

	/**
	 * Fallback method to copy commit message to clipboard when Git extension API is unavailable
	 */
	private copyToClipboardFallback(message: string): void {
		try {
			vscode.env.clipboard.writeText(message)
			vscode.window.showInformationMessage(
				"Commit message copied to clipboard. Paste it into the commit message field.",
			)
		} catch (clipboardError) {
			console.error("Error copying to clipboard:", clipboardError)
			throw new Error("Failed to set commit message")
		}
	}

	/**
	 * Converts Git status code to readable text
	 */
	private getChangeStatusFromCode(code: string): string {
		switch (code) {
			case "M":
				return "Modified"
			case "A":
				return "Added"
			case "D":
				return "Deleted"
			case "R":
				return "Renamed"
			case "C":
				return "Copied"
			case "U":
				return "Updated"
			case "?":
				return "Untracked"
			default:
				return "Unknown"
		}
	}

	public dispose() {
		this.ignoreController?.dispose()
	}
}
