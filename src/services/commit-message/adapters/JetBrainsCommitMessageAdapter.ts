// kilocode_change - new file
import { ICommitMessageAdapter } from "./ICommitMessageAdapter"
import { CommitMessageRequest, CommitMessageResult, ProgressUpdate } from "../types/core"
import { GitExtensionService, GitChange } from "../GitExtensionService"
import { CommitMessageGenerator } from "../CommitMessageGenerator"

/**
 * JetBrains-specific adapter for commit message generation.
 */
export class JetBrainsCommitMessageAdapter implements ICommitMessageAdapter {
	private gitService: GitExtensionService | null = null
	private currentWorkspaceRoot: string | null = null

	constructor(private messageGenerator: CommitMessageGenerator) {}

	async generateCommitMessage(request: CommitMessageRequest): Promise<CommitMessageResult> {
		try {
			const { workspacePath } = request
			let { selectedFiles } = request

			if (this.currentWorkspaceRoot !== workspacePath) {
				this.gitService?.dispose()
				this.gitService = new GitExtensionService(workspacePath)
				this.currentWorkspaceRoot = workspacePath
			}

			if (!this.gitService) {
				return {
					message: "",
					error: "Failed to initialize Git service",
				}
			}

			if (!selectedFiles || selectedFiles.length === 0) {
				let allChanges = await this.gitService.gatherChanges({ staged: true })
				if (allChanges.length === 0) {
					allChanges = await this.gitService.gatherChanges({ staged: false })
				}
				selectedFiles = allChanges.map((change) => change.filePath)
			}

			if (selectedFiles.length === 0) {
				return {
					message: "",
					error: "No files available for commit message generation",
				}
			}

			const changes = await this.resolveChangesForFiles(selectedFiles)

			if (changes.length === 0) {
				return {
					message: "",
					error: "No valid changes found for the provided files",
				}
			}

			const normalizedSelectedFiles = changes.map((change) => change.filePath)

			const defaultStaged = changes.every((change) => change.staged === false) ? false : true
			const gitContext = await this.gitService.getCommitContext(
				changes,
				{ staged: defaultStaged, includeRepoContext: true },
				normalizedSelectedFiles,
			)

			const generatedMessage = await this.messageGenerator.generateMessage({
				workspacePath,
				selectedFiles: normalizedSelectedFiles,
				gitContext,
				onProgress: this.createProgressCallback(),
			})

			return {
				message: generatedMessage,
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
			return {
				message: "",
				error: errorMessage,
			}
		}
	}

	private async resolveChangesForFiles(selectedFiles: string[]): Promise<GitChange[]> {
		if (!this.gitService) {
			throw new Error("Git service not initialized")
		}

		const matchedChanges: GitChange[] = []
		const stagedChanges = await this.gitService.gatherChanges({ staged: true })
		const unstagedChanges = await this.gitService.gatherChanges({ staged: false })

		const addChange = (change: GitChange) => {
			if (!matchedChanges.some((existing) => existing.filePath === change.filePath)) {
				matchedChanges.push(change)
			}
		}

		for (const filePath of selectedFiles) {
			const stagedMatch = stagedChanges.find(
				(change) => change.filePath === filePath || change.filePath.endsWith(filePath),
			)
			if (stagedMatch) {
				addChange(stagedMatch)
				continue
			}

			const unstagedMatch = unstagedChanges.find(
				(change) => change.filePath === filePath || change.filePath.endsWith(filePath),
			)
			if (unstagedMatch) {
				addChange(unstagedMatch)
				continue
			}
		}

		return matchedChanges
	}

	private createProgressCallback(): (progress: ProgressUpdate) => void {
		return () => {
			// Future: send progress updates to JetBrains via RPC
		}
	}

	dispose(): void {
		this.gitService?.dispose()
		this.gitService = null
		this.currentWorkspaceRoot = null
	}
}
