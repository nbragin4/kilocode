import * as vscode from "vscode"
import * as path from "node:path"
import * as fs from "node:fs"
import * as Handlebars from "handlebars"
import { GhostSuggestionContext } from "../types"
import { StreamingParseResult } from "../GhostStreamingParser"
import { GhostSuggestionsState } from "../GhostSuggestions"
import { PromptStrategy, UseCaseType } from "../types/PromptStrategy"

/**
 * Hole Fill Strategy for chat models (GPT, Claude, Granite).
 * Uses Handlebars templates to create hole-filler prompts and parses <COMPLETION> XML responses.
 * Designed for models without native fill-in-middle support.
 */
export class HoleFillStrategy implements PromptStrategy {
	public readonly name: string = "Hole Filler"
	public readonly type: UseCaseType = UseCaseType.INLINE_COMPLETION

	private context: GhostSuggestionContext | null = null
	private accumulatedResponse: string = ""
	private template: HandlebarsTemplateDelegate | null = null

	constructor() {
		// No super() call needed - we're implementing the interface directly
	}

	/**
	 * Hole Fill Strategy can handle any completion context
	 */
	canHandle(context: GhostSuggestionContext): boolean {
		return context.document !== undefined
	}

	/**
	 * Get relevant context for hole fill analysis
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
		const baseInstructions = `You are a code completion assistant.
Complete the missing code in the provided context.
Wrap your completion in <COMPLETION></COMPLETION> tags.
Provide only the missing code without any explanations or additional formatting.`

		if (customInstructions) {
			return `${baseInstructions}\n\n${customInstructions}`
		}
		return baseInstructions
	}

	/**
	 * Build user prompt with context for Hole Fill strategy.
	 * Uses Handlebars template to create hole-filler formatted prompt.
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
			console.error("Error generating Hole Fill user prompt:", error)
			throw new Error(`Failed to generate Hole Fill prompt: ${error}`)
		}
	}

	/**
	 * Initialize processing for hole filler response
	 */
	initializeProcessing(context: GhostSuggestionContext): void {
		this.reset()
		this.context = context
		this.accumulatedResponse = ""
		this.validateContext(context)
	}

	/**
	 * Process response chunk - accumulate until we find <COMPLETION> tags
	 */
	processResponseChunk(chunk: string): StreamingParseResult {
		this.accumulatedResponse += chunk

		// Check if we have a complete <COMPLETION> block
		const completionMatch = this.accumulatedResponse.match(/<COMPLETION>([\s\S]*?)<\/COMPLETION>/i)

		if (completionMatch) {
			const completion = completionMatch[1].trim()
			if (completion) {
				const suggestions = this.createSuggestionsFromCompletion(completion)
				return this.createCompleteResult(suggestions)
			}
		}

		// Continue streaming - not complete yet
		return this.createEmptyResult()
	}

	/**
	 * Finish processing - extract any remaining completion
	 */
	finishProcessing(): StreamingParseResult {
		// Try to extract completion from accumulated response
		const completionMatch = this.accumulatedResponse.match(/<COMPLETION>([\s\S]*?)<\/COMPLETION>/i)

		if (completionMatch) {
			const completion = completionMatch[1].trim()
			if (completion) {
				const suggestions = this.createSuggestionsFromCompletion(completion)
				return this.createCompleteResult(suggestions)
			}
		}

		// If no completion tags found, try to use the raw response
		const trimmedResponse = this.accumulatedResponse.trim()
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
			const templatePath = path.join(__dirname, "../templates/files/hole-filler.hbs")
			const templateContent = fs.readFileSync(templatePath, "utf8")
			this.template = Handlebars.compile(templateContent)
		} catch (error) {
			console.error("Failed to load Hole Fill template:", error)
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

			// Get the current line to preserve indentation
			const currentLine = document.lineAt(line)
			const leadingWhitespace = currentLine.text.match(/^(\s*)/)?.[1] || ""

			// Apply the leading whitespace to the first line of completion, keep others as-is
			const completionLines = completionText.split("\n")
			const indentedCompletion = completionLines
				.map((line, index) => {
					// First line gets the cursor position's indentation, others keep their relative indentation
					return index === 0 ? leadingWhitespace + line : line
				})
				.join("\n")

			// Create a replacement operation at the cursor position
			const suggestionFile = suggestions.addFile(document.uri)

			// First delete the empty line at cursor position
			suggestionFile.addOperation({
				type: "-",
				line: line,
				oldLine: line,
				newLine: line,
				content: "",
			})

			// Then add the completion content with proper indentation
			suggestionFile.addOperation({
				type: "+",
				line: line,
				oldLine: line,
				newLine: line,
				content: indentedCompletion,
			})

			return suggestions
		} catch (error) {
			console.error("Error creating suggestions from Hole Fill completion:", error)
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
