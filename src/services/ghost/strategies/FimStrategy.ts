import * as vscode from "vscode"
import * as path from "node:path"
import * as fs from "node:fs"
import * as Handlebars from "handlebars"
import { GhostSuggestionContext } from "../types"
import { StreamingParseResult } from "../GhostStreamingParser"
import { GhostSuggestionsState } from "../GhostSuggestions"
import { PromptStrategy, UseCaseType } from "../types/PromptStrategy"

/**
 * Fill-in-Middle Strategy for code models with native FIM support (Qwen, StarCoder, CodeLlama).
 * Uses simple FIM tokens and processes raw text responses without XML parsing.
 * Designed for models that understand <|fim_prefix|>, <|fim_suffix|>, <|fim_middle|> tokens.
 */
export class FimStrategy implements PromptStrategy {
	public readonly name: string = "Fill-in-Middle"
	public readonly type: UseCaseType = UseCaseType.INLINE_COMPLETION

	private context: GhostSuggestionContext | null = null
	private accumulatedResponse: string = ""
	private template: HandlebarsTemplateDelegate | null = null

	constructor() {
		// No super() call needed - we're implementing the interface directly
	}

	/**
	 * FIM Strategy can handle any completion context
	 */
	canHandle(context: GhostSuggestionContext): boolean {
		return context.document !== undefined
	}

	/**
	 * Get relevant context for FIM analysis
	 */
	getRelevantContext(context: GhostSuggestionContext): Partial<GhostSuggestionContext> {
		return {
			document: context.document,
			range: context.range,
		}
	}

	/**
	 * Generate system instructions for the AI model
	 */
	getSystemInstructions(customInstructions?: string): string {
		const baseInstructions = `You are a Fill-in-Middle code completion model.
Complete the code between <|fim_prefix|> and <|fim_suffix|> tokens.
Provide only the missing code without any explanations or additional formatting.`

		if (customInstructions) {
			return `${baseInstructions}\n\n${customInstructions}`
		}
		return baseInstructions
	}

	/**
	 * Build user prompt with context for FIM strategy.
	 * Uses Handlebars template to create FIM-formatted prompt.
	 */
	async getUserPrompt(context: GhostSuggestionContext): Promise<string> {
		try {
			this.validateContext(context)

			// Load template if not already loaded
			if (!this.template) {
				await this.loadTemplate()
			}

			// Extract variables for template
			const variables = this.extractVariables(context)

			// Generate prompt using template
			const prompt = this.template!(variables)
			return prompt
		} catch (error) {
			console.error("Error generating FIM user prompt:", error)
			throw new Error(`Failed to generate FIM prompt: ${error}`)
		}
	}

	/**
	 * Initialize processing for FIM response
	 */
	initializeProcessing(context: GhostSuggestionContext): void {
		this.reset()
		this.context = context
		this.accumulatedResponse = ""
		this.validateContext(context)
	}

	/**
	 * Process response chunk - FIM models return raw text, accumulate until complete
	 */
	processResponseChunk(chunk: string): StreamingParseResult {
		this.accumulatedResponse += chunk

		// Check if response looks complete (contains stop tokens or seems finished)
		const stopTokens = ["<|endoftext|>", "<|fim_prefix|>", "<|fim_middle|>", "<|fim_suffix|>"]
		const hasStopToken = stopTokens.some((token) => this.accumulatedResponse.includes(token))

		if (hasStopToken) {
			// Clean up stop tokens from the response
			let cleanResponse = this.accumulatedResponse
			stopTokens.forEach((token) => {
				cleanResponse = cleanResponse.split(token)[0]
			})

			const trimmedResponse = cleanResponse.trim()
			if (trimmedResponse) {
				const suggestions = this.createSuggestionsFromCompletion(trimmedResponse)
				return this.createCompleteResult(suggestions)
			}
		}

		// Continue streaming - not complete yet
		return this.createEmptyResult()
	}

	/**
	 * Finish processing - handle any remaining content
	 */
	finishProcessing(): StreamingParseResult {
		// Clean up any stop tokens
		const stopTokens = ["<|endoftext|>", "<|fim_prefix|>", "<|fim_middle|>", "<|fim_suffix|>"]
		let cleanResponse = this.accumulatedResponse

		stopTokens.forEach((token) => {
			cleanResponse = cleanResponse.split(token)[0]
		})

		const trimmedResponse = cleanResponse.trim()
		if (trimmedResponse) {
			const suggestions = this.createSuggestionsFromCompletion(trimmedResponse)
			return this.createCompleteResult(suggestions)
		}

		return this.createEmptyResult()
	}

	/**
	 * Reset parser state
	 */
	reset(): void {
		this.context = null
		this.accumulatedResponse = ""
	}

	/**
	 * Load and compile the Handlebars template
	 */
	private async loadTemplate(): Promise<void> {
		try {
			const templatePath = path.join(__dirname, "../templates/files/standard-fim.hbs")
			const templateContent = fs.readFileSync(templatePath, "utf8")
			this.template = Handlebars.compile(templateContent)
		} catch (error) {
			console.error("Failed to load FIM template:", error)
			throw new Error(`Failed to load template: ${error}`)
		}
	}

	/**
	 * Extract template variables from Ghost context
	 */
	private extractVariables(context: GhostSuggestionContext): Record<string, string> {
		if (!context.document || !context.range) {
			throw new Error("Invalid context: missing document or range")
		}

		const document = context.document
		const position = context.range.start
		const fullText = document.getText()
		const cursorOffset = document.offsetAt(position)

		// Extract prefix (text before cursor)
		const prefix = fullText.substring(0, cursorOffset)

		// Extract suffix (text after cursor)
		const suffix = fullText.substring(cursorOffset)

		return {
			prefix: prefix,
			suffix: suffix,
		}
	}

	/**
	 * Create suggestions from completion text
	 */
	private createSuggestionsFromCompletion(completionText: string): GhostSuggestionsState {
		const suggestions = new GhostSuggestionsState()

		if (!this.context?.document || !this.context?.range || !completionText) {
			return suggestions
		}

		try {
			const document = this.context.document
			const position = this.context.range.start
			const line = position.line
			const character = position.character

			// Get the current line
			const currentLine = document.lineAt(line)
			const lineText = currentLine.text

			// Check if this is an inline completion (cursor in middle of line) or line completion (empty line)
			const isInlineCompletion = lineText.trim().length > 0 && character < lineText.length

			const suggestionFile = suggestions.addFile(document.uri)

			if (isInlineCompletion) {
				// Inline completion: replace just the cursor position with completion text
				// Get text before and after cursor
				const beforeCursor = lineText.substring(0, character)
				const afterCursor = lineText.substring(character)

				// Create new line content by inserting completion at cursor position
				const newLineContent = beforeCursor + completionText + afterCursor

				// Replace the entire line
				suggestionFile.addOperation({
					type: "-",
					line: line,
					oldLine: line,
					newLine: line,
					content: lineText,
				})

				suggestionFile.addOperation({
					type: "+",
					line: line,
					oldLine: line,
					newLine: line,
					content: newLineContent,
				})
			} else {
				// Line completion: replace empty line with completion (preserve indentation)
				const leadingWhitespace = lineText.match(/^(\s*)/)?.[1] || ""

				// Apply the leading whitespace to the first line of completion, keep others as-is
				const completionLines = completionText.split("\n")
				const indentedCompletion = completionLines
					.map((line, index) => {
						// First line gets the cursor position's indentation, others keep their relative indentation
						return index === 0 ? leadingWhitespace + line : line
					})
					.join("\n")

				// Delete the empty line at cursor position
				suggestionFile.addOperation({
					type: "-",
					line: line,
					oldLine: line,
					newLine: line,
					content: "",
				})

				// Add the completion content with proper indentation
				suggestionFile.addOperation({
					type: "+",
					line: line,
					oldLine: line,
					newLine: line,
					content: indentedCompletion,
				})
			}

			return suggestions
		} catch (error) {
			console.error("Error creating suggestions from FIM completion:", error)
			return suggestions
		}
	}

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
}
