// kilocode_change - new file
import * as vscode from "vscode"
import { ContextProxy } from "../../core/config/ContextProxy"
import { ProviderSettingsManager } from "../../core/config/ProviderSettingsManager"
import { singleCompletionHandler } from "../../utils/single-completion-handler"
import { GitExtensionService, GitRepository } from "./GitExtensionService"
import { CommitContext } from "./types"
import { supportPrompt } from "../../shared/support-prompt"
import { t } from "../../i18n"
import { addCustomInstructions } from "../../core/prompts/sections/custom-instructions"
import { getWorkspacePath } from "../../utils/path"
import { TelemetryEventName, type ProviderSettings } from "@roo-code/types"
import delay from "delay"
import { TelemetryService } from "@roo-code/telemetry"

/**
 * Provides AI-powered commit message generation for source control management.
 * Integrates with Git repositories to analyze staged changes and generate
 * conventional commit messages using AI.
 */
export class CommitMessageProvider {
	private gitService: GitExtensionService
	private providerSettingsManager: ProviderSettingsManager
	private previousGitContext: string | null = null
	private previousCommitMessage: string | null = null

	constructor(
		private context: vscode.ExtensionContext,
		private outputChannel: vscode.OutputChannel,
	) {
		this.gitService = new GitExtensionService()
		this.providerSettingsManager = new ProviderSettingsManager(this.context)
	}

	/**
	 * Activates the commit message provider by setting up Git integration.
	 */
	public async activate(): Promise<void> {
		this.outputChannel.appendLine(t("kilocode:commitMessage.activated"))

		try {
			await this.providerSettingsManager.initialize()
		} catch (error) {
			this.outputChannel.appendLine(t("kilocode:commitMessage.gitInitError", { error }))
		}

		// Register the command
		const disposable = vscode.commands.registerCommand(
			"kilo-code.generateCommitMessage",
			(commitContext?: GitRepository) => this.generateCommitMessage(commitContext),
		)
		this.context.subscriptions.push(disposable)
		this.context.subscriptions.push(this.gitService)
	}

	/**
	 * Generates an AI-powered commit message based on staged changes, or unstaged changes if no staged changes exist.
	 */
	public async generateCommitMessage(commitContext?: GitRepository): Promise<void> {
		await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.SourceControl,
				title: t("kilocode:commitMessage.cancellable.title"),
				cancellable: true,
			},
			async (progress, cancellationToken) => {
				try {
					this.gitService.configureRepositoryContext(commitContext?.rootUri)

					const changes = await this.gitService.gatherChanges({})
					if (changes.length === 0) {
						vscode.window.showInformationMessage(t("kilocode:commitMessage.noChanges"))
						return
					}

					progress.report({ increment: 10, message: t("kilocode:commitMessage.generating") })

					let lastReportedProgress = 0
					const onDiffProgress = (percentage: number) => {
						const currentProgress = (percentage / 100) * 70
						const increment = currentProgress - lastReportedProgress
						if (increment > 0) {
							progress.report({ increment, message: t("kilocode:commitMessage.generating") })
							lastReportedProgress = currentProgress
						}
					}

					const gitContext = await this.gitService.getCommitContext({
						onProgress: onDiffProgress,
					})

					const generatedMessage = await this.callAIForCommitMessageWithProgress(
						gitContext,
						progress,
						cancellationToken,
					)

					this.previousGitContext = gitContext.map((ctx) => this.formatContextForAI(ctx)).join("\n---\n")
					this.previousCommitMessage = generatedMessage
					this.gitService.setCommitMessage(generatedMessage)
					TelemetryService.instance.captureEvent(TelemetryEventName.COMMIT_MSG_GENERATED)
				} catch (error) {
					const errorMessage = error instanceof Error ? error.message : "Unknown error occurred"
					vscode.window.showErrorMessage(t("kilocode:commitMessage.generationFailed", { errorMessage }))
					console.error("Error generating commit message:", error)
				}
			},
		)
	}

	private async callAIForCommitMessageWithProgress(
		gitContext: CommitContext[],
		progress: vscode.Progress<{ increment?: number; message?: string }>,
		cancellationToken?: vscode.CancellationToken,
	): Promise<string> {
		let totalProgressUsed = 0
		const maxProgress = 20
		const maxIncrement = 1.0
		const minIncrement = 0.05

		const progressInterval = setInterval(() => {
			const remainingProgress = (maxProgress - totalProgressUsed) / maxProgress

			const incrementLimited = Math.max(
				remainingProgress * remainingProgress * maxIncrement + minIncrement,
				minIncrement,
			)
			const increment = Math.min(incrementLimited, maxProgress - totalProgressUsed)
			progress.report({ increment, message: t("kilocode:commitMessage.generating") })
			totalProgressUsed += increment
		}, 100)

		try {
			if (cancellationToken?.isCancellationRequested) {
				throw new Error(t("kilocode:commitMessage.operationCancelled"))
			}

			const message = await this.processChunkedContext(gitContext, progress, cancellationToken)

			for (let i = 0; i < maxProgress - totalProgressUsed; i++) {
				progress.report({ increment: 1 })
				await delay(25)
			}
			return message
		} finally {
			clearInterval(progressInterval)
		}
	}

	private formatContextForAI(context: CommitContext): string {
		let formatted = `## Git Context for Commit Message Generation\n\n`
		formatted += `### Full Diff\n\`\`\`diff\n${context.diff}\n\`\`\`\n\n`

		if (context.summary) {
			formatted += `### Statistical Summary\n\`\`\`\n${context.summary}\n\`\`\`\n\n`
		}

		if (context.branch) {
			formatted += `### Repository Context\n**Current branch:** \`${context.branch}\`\n`
		}

		if (context.recentCommits?.length) {
			formatted += `**Recent commits:**\n\`\`\`\n${context.recentCommits.join("\n")}\n\`\`\`\n`
		}

		return formatted
	}

	/**
	 * Processes git context using map-reduce pattern for multiple chunks or direct processing for single chunk
	 */
	private async processChunkedContext(
		gitContexts: CommitContext[],
		progress: vscode.Progress<{ increment?: number; message?: string }>,
		cancellationToken?: vscode.CancellationToken,
	): Promise<string> {
		// For single context, process directly
		if (gitContexts.length === 1) {
			const formatted = this.formatContextForAI(gitContexts[0])
			return await this.callAIForCommitMessage(formatted, cancellationToken)
		}

		// For multiple contexts, process each chunk
		progress.report({ message: t("kilocode:commitMessage.analyzingChunks") })

		const chunkSummaries: string[] = []
		for (let i = 0; i < gitContexts.length; i++) {
			progress.report({
				message: t("kilocode:commitMessage.processingChunk", {
					current: i + 1,
					total: gitContexts.length,
				}),
			})

			const formatted = this.formatContextForAI(gitContexts[i])
			const chunkMessage = await this.callAIForCommitMessage(formatted)
			chunkSummaries.push(`Chunk ${i + 1}: ${chunkMessage}`)
		}

		progress.report({ message: t("kilocode:commitMessage.combining") })

		// Combine results
		const combinedContext = `## Combined Analysis from Multiple Chunks

The following commit message suggestions were generated from different parts of the changes:

${chunkSummaries.join("\n\n")}

## Instructions
Generate a single, cohesive conventional commit message that best represents the overall changes.`

		return await this.callAIForCommitMessage(combinedContext, cancellationToken)
	}

	/**
	 * Calls the provider to generate a commit message based on the git context.
	 */
	private async callAIForCommitMessage(
		gitContextString: string,
		cancellationToken?: vscode.CancellationToken,
	): Promise<string> {
		const contextProxy = ContextProxy.instance
		const apiConfiguration = contextProxy.getProviderSettings()
		const commitMessageApiConfigId = contextProxy.getValue("commitMessageApiConfigId")
		const listApiConfigMeta = contextProxy.getValue("listApiConfigMeta") || []
		const customSupportPrompts =
			(contextProxy.getValue("customSupportPrompts") as Record<string, string> | undefined) || {}

		let configToUse: ProviderSettings = apiConfiguration

		if (
			commitMessageApiConfigId &&
			listApiConfigMeta.find(({ id }: { id: string }) => id === commitMessageApiConfigId)
		) {
			try {
				const { name: _, ...providerSettings } = await this.providerSettingsManager.getProfile({
					id: commitMessageApiConfigId,
				})

				if (providerSettings.apiProvider) {
					configToUse = providerSettings
				}
			} catch (error) {
				console.warn(`Failed to load commit message API config ${commitMessageApiConfigId}:`, error)
			}
		}

		const prompt = await this.buildCommitMessagePrompt(gitContextString, customSupportPrompts)

		if (cancellationToken?.isCancellationRequested) {
			throw new Error(t("kilocode:commitMessage.operationCancelled"))
		}

		const response = await singleCompletionHandler(configToUse, prompt)

		return this.extractCommitMessage(response)
	}

	/**
	 * Builds the AI prompt for commit message generation.
	 * Handles logic for generating different messages when requested for the same changes.
	 */
	private async buildCommitMessagePrompt(
		gitContextString: string,
		customSupportPrompts: Record<string, string>,
	): Promise<string> {
		const workspacePath = getWorkspacePath()
		const customInstructions = workspacePath
			? await addCustomInstructions("", "", workspacePath, "commit", {
					language: vscode.env.language,
					localRulesToggleState: this.context.workspaceState.get("localRulesToggles"),
					globalRulesToggleState: this.context.globalState.get("globalRulesToggles"),
				})
			: ""

		const shouldGenerateDifferentMessage =
			this.previousGitContext === gitContextString && this.previousCommitMessage !== null

		if (shouldGenerateDifferentMessage) {
			const differentMessagePrefix = `# CRITICAL INSTRUCTION: GENERATE A COMPLETELY DIFFERENT COMMIT MESSAGE
The user has requested a new commit message for the same changes.
The previous message was: "${this.previousCommitMessage}"
YOU MUST create a message that is COMPLETELY DIFFERENT by:
- Using entirely different wording and phrasing
- Focusing on different aspects of the changes
- Using a different structure or format if appropriate
- Possibly using a different type or scope if justifiable
This is the MOST IMPORTANT requirement for this task.

`
			const baseTemplate = supportPrompt.get(customSupportPrompts, "COMMIT_MESSAGE")
			const modifiedTemplate =
				differentMessagePrefix +
				baseTemplate +
				`

FINAL REMINDER: Your message MUST be COMPLETELY DIFFERENT from the previous message: "${this.previousCommitMessage}". This is a critical requirement.`

			return supportPrompt.create(
				"COMMIT_MESSAGE",
				{
					gitContext: gitContextString,
					customInstructions: customInstructions || "",
				},
				{
					...customSupportPrompts,
					COMMIT_MESSAGE: modifiedTemplate,
				},
			)
		} else {
			return supportPrompt.create(
				"COMMIT_MESSAGE",
				{
					gitContext: gitContextString,
					customInstructions: customInstructions || "",
				},
				customSupportPrompts,
			)
		}
	}

	private extractCommitMessage(response: string): string {
		const cleaned = response.trim()
		const withoutCodeBlocks = cleaned.replace(/```[a-z]*\n|```/g, "")
		const withoutQuotes = withoutCodeBlocks.replace(/^["'`]|["'`]$/g, "")
		return withoutQuotes.trim()
	}

	public dispose() {
		this.gitService.dispose()
	}
}
