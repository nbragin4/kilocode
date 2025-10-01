import * as vscode from "vscode"
import { GhostSuggestionContext } from "../types"
import { StreamingParseResult } from "../GhostStreamingParser"
import { GhostSuggestionsState } from "../GhostSuggestions"
import { PromptStrategy, UseCaseType } from "../types/PromptStrategy"
import { structuredPatch } from "diff"
import { collectUnifiedMercuryContext } from "../snippets/collector"
import { myersDiff } from "../utils/myers"
import {
	MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_OPEN,
	MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_CLOSE,
	MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_OPEN,
	MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_CLOSE,
	MERCURY_CURRENT_FILE_CONTENT_OPEN,
	MERCURY_CURRENT_FILE_CONTENT_CLOSE,
	MERCURY_CODE_TO_EDIT_OPEN,
	MERCURY_CODE_TO_EDIT_CLOSE,
	MERCURY_EDIT_DIFF_HISTORY_OPEN,
	MERCURY_EDIT_DIFF_HISTORY_CLOSE,
	MERCURY_CURSOR,
} from "../utils/ghostSuggestionConstants"
import { PromptMetadata, UserPrompt, EditableRegionConfig } from "../types/GhostSuggestionOutcome"
import { calculateOptimalEditableRegion, ContextExpansionOptions } from "../utils/tokenHelpers"
import { GhostContextError, GhostStrategyError } from "../utils/result"

/**
 * Mercury Prompt Strategy with integrated parsing.
 * Combines Mercury Coder prompting with markdown response parsing in a single strategy.
 * This eliminates the need for the DualStreamingParser format detection.
 */
export class MercuryStrategy implements PromptStrategy {
	public readonly name: string = "Mercury Coder"
	public readonly type: UseCaseType = UseCaseType.MERCURY_CODER

	private context: GhostSuggestionContext | null = null
	private accumulatedResponse: string = ""

	constructor() {
		// No super() call needed - we're implementing the interface directly
	}

	/**
	 * Mercury Strategy handles ALL completion scenarios when Mercury model is available
	 */
	canHandle(context: GhostSuggestionContext): boolean {
		return context.document !== undefined
	}

	/**
	 * Get relevant context for Mercury analysis
	 */
	getRelevantContext(context: GhostSuggestionContext): Partial<GhostSuggestionContext> {
		return {
			document: context.document,
			range: context.range,
			diagnostics: context.diagnostics,
			documentAST: context.documentAST,
			rangeASTNode: context.rangeASTNode,
			recentOperations: context.recentOperations,
			openFiles: context.openFiles,
			mercuryRecentlyViewedSnippets: context.mercuryRecentlyViewedSnippets,
			mercuryEditHistory: context.mercuryEditHistory,
		}
	}

	/**
	 * Generate system instructions for the AI model
	 */
	getSystemInstructions(customInstructions?: string): string {
		const baseInstructions = `You are Mercury, an AI coding assistant by Inception Labs. Complete code within <|code_to_edit|> tags based on developer context.

# Context Available
- recently_viewed_code_snippets: Recent code the developer viewed (oldest to newest, with line numbers in the form #| to help you understand the edit diff history)
- current_file_content: Full file context with line numbers in the form #| for reference
- edit_diff_history: Recent changes (oldest to latest, may be irrelevant)
- <|cursor|>: Current cursor position

# Task
Predict and complete the developer's next changes in <|code_to_edit|>. Continue their current path - implementing features, improving code quality, or fixing issues. Only suggest changes you're confident about.

# Process
1. Analyze context: snippets, edit history, surrounding code, cursor location
2. Evaluate if code needs corrections or enhancements
3. Suggest edits aligned with developer patterns and code quality
4. Maintain existing indentation and formatting

# Output Rules
- Return ONLY revised code between <|code_to_edit|> and <|/code_to_edit|> tags
- If no changes needed, return original code unchanged
- There are line numbers in the form #| in the code displayed to you above, but these are just for your reference. Please do not include the numbers of the form #| in your response.
- NEVER duplicate code outside the tags
- Avoid reverting developer's last change unless obvious errors exist`

		if (customInstructions) {
			return `${baseInstructions}\n\n${customInstructions}`
		}
		return baseInstructions
	}

	/**
	 * Build Mercury Coder prompt using unified context collection.
	 * Single context collection call eliminates duplication and improves performance.
	 * Throws GhostContextError for unexpected failures (programming errors).
	 * Handles expected failures gracefully within the implementation.
	 */
	async getUserPrompt(context: GhostSuggestionContext): Promise<string> {
		// Unexpected failure: missing required context (programming error)
		if (!context.document) {
			throw new GhostContextError("Document is required for Mercury Coder analysis", "MercuryStrategy")
		}
		if (!context.range) {
			throw new GhostContextError("Range is required for Mercury Coder analysis", "MercuryStrategy")
		}

		try {
			// UNIFIED CONTEXT COLLECTION - Single call replaces three separate systems
			// This eliminates duplicate file reads, processing, and API calls
			const workspaceDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath
			const unifiedContext = await collectUnifiedMercuryContext(context.document, context.range, workspaceDir)

			// Build blocks using Continue's exact approach with unified context data
			const recentlyViewedSnippets = unifiedContext.recentlyViewedSnippets.map((snippet) => snippet.content)
			const recentlyViewedBlock = this.buildRecentlyViewedCodeSnippetsBlock(recentlyViewedSnippets)
			const currentFileBlock = this.buildCurrentFileContentBlock(context, unifiedContext.editableRegion)
			const editHistoryBlock = this.buildEditHistoryBlock(unifiedContext.editHistory)

			// Combine all blocks into final prompt
			const prompt = `${recentlyViewedBlock}${currentFileBlock}${editHistoryBlock}`

			return prompt
		} catch (error) {
			// Expected failure: context collection issues (network, file access, etc.)
			console.error("Error generating Mercury user prompt:", error)
			throw new GhostStrategyError(`Failed to generate Mercury prompt: ${error}`, "MercuryStrategy")
		}
	}

	/**
	 * Initialize processing for Mercury response
	 */
	initializeProcessing(context: GhostSuggestionContext): void {
		this.reset()
		this.context = context
		this.accumulatedResponse = ""
	}

	/**
	 * Process response chunk - Mercury uses simple extraction, no streaming needed
	 */
	processResponseChunk(chunk: string): StreamingParseResult {
		this.accumulatedResponse += chunk

		// Mercury doesn't need streaming - just accumulate
		return this.createEmptyResult()
	}

	/**
	 * Finish processing and extract Mercury completion
	 */
	finishProcessing(): StreamingParseResult {
		if (!this.context || !this.accumulatedResponse.trim()) {
			return this.createEmptyResult()
		}

		try {
			this.validateContext(this.context)

			// Extract completion using Mercury's extractCompletion method
			const completion = this.extractCompletion(this.accumulatedResponse)
			if (!completion) {
				return this.createEmptyResult()
			}

			const originalContent = this.getDocumentContent(this.context)
			const suggestions = this.generateSuggestionsFromDiff(originalContent, completion, this.context)

			return this.createCompleteResult(suggestions)
		} catch (error) {
			console.error("Error in Mercury finishProcessing:", error)
			return this.createEmptyResult()
		}
	}

	/**
	 * Reset parser state
	 */
	reset(): void {
		this.context = null
		this.accumulatedResponse = ""
	}

	/**
	 * Extract completion from Mercury response (existing method)
	 */
	extractCompletion(response: string): string {
		const codeMatch = response.match(/<\|code_to_edit\|>([\s\S]*?)<\|\/code_to_edit\|>/i)
		if (codeMatch) {
			return this.stripLineNumbers(codeMatch[1])
		}
		return ""
	}

	// === PRIVATE HELPER METHODS ===

	/**
	 * Helper method to validate context
	 */
	private validateContext(context: GhostSuggestionContext): void {
		if (!context.document) {
			throw new Error("Document context is required")
		}
		if (!context.range) {
			throw new Error("Range context is required")
		}
	}

	/**
	 * Helper method to get document text content
	 */
	private getDocumentContent(context: GhostSuggestionContext): string {
		this.validateContext(context)
		return context.document!.getText()
	}

	/**
	 * Helper method to create empty result
	 */
	private createEmptyResult(): StreamingParseResult {
		return {
			suggestions: new GhostSuggestionsState(),
			isComplete: false,
			hasNewSuggestions: false,
		}
	}

	/**
	 * Helper method to create complete result
	 */
	private createCompleteResult(suggestions: GhostSuggestionsState): StreamingParseResult {
		return {
			suggestions,
			isComplete: true,
			hasNewSuggestions: suggestions.hasSuggestions(),
		}
	}

	// === MERCURY-SPECIFIC METHODS (keeping existing implementation) ===

	/**
	 * Determines if unique token injection is needed for this context
	 */
	shouldInjectUniqueToken(context: GhostSuggestionContext): boolean {
		if (!context.document || !context.range) {
			return false
		}

		const document = context.document
		const position = context.range.start
		const currentLine = document.lineAt(position.line)

		// Inject token for empty lines or lines with only whitespace
		return currentLine.text.trim() === ""
	}

	/**
	 * Generate unique token for cursor positioning
	 */
	getUniqueToken(): string {
		return MERCURY_CURSOR
	}

	/**
	 * Build prompt metadata for Mercury strategy
	 */
	buildPromptMetadata(context: GhostSuggestionContext): PromptMetadata {
		return {
			prompt: {
				role: "user",
				content: "",
			},
			userEdits: "",
			userExcerpts: "",
			cursorPosition: context.range?.start || { line: 0, character: 0 },
		}
	}

	/**
	 * Calculate editable region for Mercury context
	 */
	calculateEditableRegion(
		context: GhostSuggestionContext,
		options: ContextExpansionOptions = {
			maxPromptTokens: 8000,
			prefixPercentage: 0.85,
			maxSuffixPercentage: 0.15,
		},
	): EditableRegionConfig {
		if (!context.document || !context.range) {
			throw new Error("Document and range are required for editable region calculation")
		}

		const fileContent = context.document.getText()
		const cursorOffset = context.document.offsetAt(context.range.start)
		const result = calculateOptimalEditableRegion(fileContent, cursorOffset, options)

		// Convert the result to EditableRegionConfig format
		return {
			maxTokens: options.maxPromptTokens,
			topMargin: result.startLine,
			bottomMargin: result.endLine,
		}
	}

	/**
	 * Normalize whitespace in content to prevent false diff positives from Mercury's cleanup.
	 * Mercury often trims trailing whitespace, which shouldn't be treated as meaningful changes.
	 */
	private normalizeWhitespaceForDiff(content: string): string {
		return content
			.split("\n")
			.map((line) => line.trimEnd()) // Remove trailing whitespace from each line
			.join("\n")
			.trim() // Remove leading/trailing empty lines
	}

	/**
	 * Optimize diff operations to detect whitespace-only changes and convert them to pure additions.
	 * This prevents Mercury's whitespace cleanup from being interpreted as deletions + additions.
	 */
	private optimizeDiffOperations(patch: any, originalContent: string, mercuryContent: string): any[] {
		const operations: any[] = []
		const originalLines = originalContent.split("\n")
		const mercuryLines = mercuryContent.split("\n")

		// Check if this is a simple addition case (Mercury adds lines without changing existing content)
		if (mercuryLines.length > originalLines.length) {
			// Check if first N lines are equivalent (ignoring whitespace)
			const minLines = Math.min(originalLines.length, mercuryLines.length)
			let firstDifferentLine = -1

			for (let i = 0; i < minLines; i++) {
				const originalNormalized = originalLines[i].trim()
				const mercuryNormalized = mercuryLines[i].trim()

				if (originalNormalized !== mercuryNormalized) {
					firstDifferentLine = i
					break
				}
			}

			// If all existing lines are equivalent (ignoring whitespace), treat as pure addition
			if (firstDifferentLine === -1 && mercuryLines.length > originalLines.length) {
				// Add all new lines as additions
				for (let i = originalLines.length; i < mercuryLines.length; i++) {
					const addOp = {
						type: "+" as const,
						line: i,
						oldLine: i,
						newLine: i,
						content: mercuryLines[i],
					}
					operations.push(addOp)
				}

				return operations
			}
		}

		// Fallback to original diff processing if optimization doesn't apply
		for (const hunk of patch.hunks) {
			let currentOldLineNumber = hunk.oldStart
			let currentNewLineNumber = hunk.newStart

			for (const line of hunk.lines) {
				const operationType = line.charAt(0) as "+" | "-" | " "
				const content = line.substring(1)

				switch (operationType) {
					case "+": {
						const addOp = {
							type: "+" as const,
							line: currentNewLineNumber - 1, // Convert from 1-based to 0-based
							oldLine: currentOldLineNumber - 1,
							newLine: currentNewLineNumber - 1,
							content: content,
						}
						operations.push(addOp)
						currentNewLineNumber++
						break
					}
					case "-": {
						const deleteOp = {
							type: "-" as const,
							line: currentOldLineNumber - 1, // Convert from 1-based to 0-based
							oldLine: currentOldLineNumber - 1,
							newLine: currentNewLineNumber - 1,
							content: content,
						}
						operations.push(deleteOp)
						currentOldLineNumber++
						break
					}
					case " ": {
						// Context line - advance both counters
						currentOldLineNumber++
						currentNewLineNumber++
						break
					}
				}
			}
		}

		return operations
	}

	/**
	 * Extract code from markdown code blocks
	 */
	private extractCodeFromMarkdown(content: string): string {
		// Remove markdown code block markers
		const codeBlockMatch = content.match(/```[\w]*\n?([\s\S]*?)```/s)
		if (codeBlockMatch) {
			return codeBlockMatch[1]
		}
		return content
	}

	/**
	 * Extract from code blocks if present, otherwise return as-is
	 */
	private extractFromCodeBlocks(content: string): string {
		const extracted = this.extractCodeFromMarkdown(content)
		return extracted || content
	}

	/**
	 * Strip Mercury markers from content
	 */
	private stripMercuryMarkers(content: string): string {
		return content
			.replace(/<\|code_to_edit\|>/gi, "")
			.replace(/<\|\/code_to_edit\|>/gi, "")
			.replace(/<\|cursor\|>/gi, "")
			.trim()
	}

	/**
	 * Strip line numbers from Mercury response
	 * Handles formats: "N|content", "N |content", "N | content"
	 */
	stripLineNumbers(content: string): string {
		return content
			.split("\n")
			.map((line) => {
				// Remove line numbers with optional space before pipe: "1|", "1 |", "10|", "10 |"
				// Do NOT consume spaces after pipe - those are intentional indentation
				return line.replace(/^\d+\s*\|/, "")
			})
			.join("\n")
	}

	/**
	 * Generate suggestions from diff between original and Mercury content
	 */
	private generateSuggestionsFromDiff(
		originalContent: string,
		mercuryContent: string,
		context: GhostSuggestionContext,
	): GhostSuggestionsState {
		const suggestions = new GhostSuggestionsState()

		try {
			// Normalize content to prevent false positives from whitespace differences
			const normalizedOriginal = this.normalizeWhitespaceForDiff(originalContent)
			const normalizedMercury = this.normalizeWhitespaceForDiff(mercuryContent)

			// If content is identical after normalization, no suggestions needed
			if (normalizedOriginal === normalizedMercury) {
				return suggestions
			}

			// Create structured patch for diff analysis
			const patch = structuredPatch("original", "mercury", originalContent, mercuryContent, "", "")

			// Optimize operations to handle Mercury's whitespace cleanup patterns
			const operations = this.optimizeDiffOperations(patch, originalContent, mercuryContent)

			if (operations.length === 0) {
				return suggestions
			}

			// Add operations to suggestions
			const file = suggestions.addFile(context.document!.uri)
			for (const operation of operations) {
				file.addOperation(operation)
			}

			return suggestions
		} catch (error) {
			console.error("Error generating suggestions from Mercury diff:", error)
			return suggestions
		}
	}

	/**
	 * Extract editable region from context
	 */
	private extractEditableRegion(context: GhostSuggestionContext): { start: number; end: number } {
		if (!context.document || !context.range) {
			return { start: 0, end: 0 }
		}

		const document = context.document
		const position = context.range.start

		// Simple implementation - expand around cursor
		const startLine = Math.max(0, position.line - 10)
		const endLine = Math.min(document.lineCount - 1, position.line + 10)

		return { start: startLine, end: endLine }
	}

	/**
	 * Calculate optimal editable region
	 */
	private calculateOptimalEditableRegion(
		context: GhostSuggestionContext,
		options: ContextExpansionOptions = {
			maxPromptTokens: 8000,
			prefixPercentage: 0.85,
			maxSuffixPercentage: 0.15,
		},
	): EditableRegionConfig {
		if (!context.document || !context.range) {
			throw new Error("Document and range are required for editable region calculation")
		}

		const fileContent = context.document.getText()
		const cursorOffset = context.document.offsetAt(context.range.start)
		const result = calculateOptimalEditableRegion(fileContent, cursorOffset, options)

		// Convert the result to EditableRegionConfig format
		return {
			maxTokens: options.maxPromptTokens,
			topMargin: result.startLine,
			bottomMargin: result.endLine,
		}
	}

	/**
	 * Count tokens in text (simplified implementation)
	 */
	private countTokens(text: string): number {
		// Simple approximation: 1 token ≈ 4 characters
		return Math.ceil(text.length / 4)
	}

	/**
	 * Build recently viewed code snippets block
	 */
	private buildRecentlyViewedCodeSnippetsBlock(snippets: string[]): string {
		if (!snippets || snippets.length === 0) {
			return ""
		}

		let block = MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_OPEN + "\n"

		for (const snippet of snippets) {
			block += MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_OPEN + "\n"
			block += snippet + "\n"
			block += MERCURY_RECENTLY_VIEWED_CODE_SNIPPET_CLOSE + "\n"
		}

		block += MERCURY_RECENTLY_VIEWED_CODE_SNIPPETS_CLOSE + "\n\n"
		return block
	}

	/**
	 * Build current file content block
	 */
	private buildCurrentFileContentBlock(context: GhostSuggestionContext, editableRegion: any): string {
		if (!context.document) {
			return ""
		}

		const document = context.document
		const content = document.getText()

		// Add line numbers and cursor marker
		// Use #| format (matching Continue's approach) for line numbers
		const lines = content.split("\n")
		const numberedLines = lines.map((line, index) => {
			const lineNumber = index + 1
			let numberedLine = `${lineNumber} #| ${line}`

			// Add cursor marker if this is the cursor line
			if (context.range && index === context.range.start.line) {
				const character = context.range.start.character
				const beforeCursor = line.substring(0, character)
				const afterCursor = line.substring(character)
				numberedLine = `${lineNumber} #| ${beforeCursor}${MERCURY_CURSOR}${afterCursor}`
			}

			return numberedLine
		})

		let block = MERCURY_CURRENT_FILE_CONTENT_OPEN + "\n"
		block += numberedLines.join("\n") + "\n"
		block += MERCURY_CURRENT_FILE_CONTENT_CLOSE + "\n\n"

		return block
	}

	/**
	 * Build edit history block
	 */
	private buildEditHistoryBlock(editHistory: string[]): string {
		if (!editHistory || editHistory.length === 0) {
			return ""
		}

		let block = MERCURY_EDIT_DIFF_HISTORY_OPEN + "\n"
		block += editHistory.join("\n\n") + "\n"
		block += MERCURY_EDIT_DIFF_HISTORY_CLOSE + "\n\n"

		return block
	}
}
