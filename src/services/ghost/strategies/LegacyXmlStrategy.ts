import { GhostSuggestionContext } from "../types"
import { StreamingParseResult, GhostStreamingParser } from "../GhostStreamingParser"
import { PromptStrategy, UseCaseType } from "../types/PromptStrategy"
import { GhostContextError, GhostStrategyError } from "../utils/result"
import { GhostSuggestionsState } from "../GhostSuggestions"

/**
 * Legacy XML Prompt Strategy with integrated streaming parser.
 * Uses the existing XML format with streaming support, wrapped in the new strategy interface.
 * This provides backward compatibility while fitting into the new architecture.
 */
export class LegacyXmlStrategy implements PromptStrategy {
	public readonly name: string = "Legacy XML"
	public readonly type: UseCaseType = UseCaseType.AUTO_TRIGGER

	private streamingParser: GhostStreamingParser
	private accumulatedResponse: string = ""
	private context: GhostSuggestionContext | null = null

	constructor() {
		this.streamingParser = new GhostStreamingParser()
	}

	/**
	 * Legacy XML Strategy can handle most general contexts
	 */
	canHandle(context: GhostSuggestionContext): boolean {
		// Default strategy - accepts all contexts
		return context.document !== undefined
	}

	/**
	 * Get relevant context for Legacy XML analysis
	 */
	getRelevantContext(context: GhostSuggestionContext): Partial<GhostSuggestionContext> {
		// Return basic context for compatibility
		return {
			document: context.document,
			range: context.range,
			diagnostics: context.diagnostics,
		}
	}

	/**
	 * Generate system instructions for the AI model
	 */
	getSystemInstructions(customInstructions?: string): string {
		const baseInstructions = `You are a code completion assistant. Complete the code at the cursor position.

Output Format:
<change>
<search><![CDATA[exact text to find]]></search>
<replace><![CDATA[replacement text]]></replace>
</change>

Examples:

Complete a method call:
<change>
<search><![CDATA[const names = users.]]></search>
<replace><![CDATA[const names = users.map(u => u.name);]]></replace>
</change>

Complete a function body:
<change>
<search><![CDATA[function greet(name) {
	   ]]></search>
<replace><![CDATA[function greet(name) {
	   return \`Hello, \${name}!\`;]]></replace>
</change>

Add missing code:
<change>
<search><![CDATA[if (user) {
}]]></search>
<replace><![CDATA[if (user) {
	   console.log(user.name);
}]]></replace>
</change>`

		if (customInstructions) {
			return `${baseInstructions}\n\n${customInstructions}`
		}
		return baseInstructions
	}

	/**
	 * Build user prompt with context for Legacy XML strategy.
	 * Throws GhostContextError for unexpected failures (programming errors).
	 */
	async getUserPrompt(context: GhostSuggestionContext): Promise<string> {
		try {
			this.validateContext(context)

			const document = context.document!
			const range = context.range!
			const position = range.start

			// Get document content and cursor position
			const fullText = document.getText()
			const cursorOffset = document.offsetAt(position)

			// Extract context around cursor
			const beforeCursor = fullText.substring(0, cursorOffset)
			const afterCursor = fullText.substring(cursorOffset)

			// Create a simple prompt with context
			const prompt = `Complete the code at the cursor position:

\`\`\`${document.languageId}
${beforeCursor}<<<CURSOR>>>${afterCursor}
\`\`\`

Provide the completion using the XML format specified in the system instructions.`

			return prompt
		} catch (error) {
			console.error("Error generating Legacy XML user prompt:", error)
			throw new GhostContextError(`Failed to generate Legacy XML prompt: ${error}`)
		}
	}

	/**
	 * Initialize processing for Legacy XML response
	 */
	initializeProcessing(context: GhostSuggestionContext): void {
		this.reset()
		this.context = context
		this.validateContext(context)
	}

	/**
	 * Process response chunk - accumulate until we find complete <change> blocks
	 */
	processResponseChunk(chunk: string): StreamingParseResult {
		this.accumulatedResponse += chunk

		// Check if we have a complete <change> block
		const changeMatch = this.accumulatedResponse.match(
			/<change>\s*<search><!\[CDATA\[([\s\S]*?)\]\]><\/search>\s*<replace><!\[CDATA\[([\s\S]*?)\]\]><\/replace>\s*<\/change>/i,
		)

		if (changeMatch) {
			const searchContent = changeMatch[1]
			const replaceContent = changeMatch[2]

			if (searchContent && replaceContent) {
				const suggestions = this.createSuggestionsFromXmlChange(searchContent, replaceContent)
				return this.createCompleteResult(suggestions)
			}
		}

		// Continue streaming - not complete yet
		return this.createEmptyResult()
	}

	/**
	 * Finish processing - extract any remaining XML changes
	 */
	finishProcessing(): StreamingParseResult {
		// Try to extract change from accumulated response
		const changeMatch = this.accumulatedResponse.match(
			/<change>\s*<search><!\[CDATA\[([\s\S]*?)\]\]><\/search>\s*<replace><!\[CDATA\[([\s\S]*?)\]\]><\/replace>\s*<\/change>/i,
		)

		if (changeMatch) {
			const searchContent = changeMatch[1]
			const replaceContent = changeMatch[2]

			if (searchContent && replaceContent) {
				const suggestions = this.createSuggestionsFromXmlChange(searchContent, replaceContent)
				return this.createCompleteResult(suggestions)
			}
		}

		return this.createEmptyResult()
	}

	/**
	 * Reset parser state
	 */
	reset(): void {
		this.accumulatedResponse = ""
	}

	/**
	 * Create suggestions from XML change block
	 */
	private createSuggestionsFromXmlChange(searchContent: string, replaceContent: string): GhostSuggestionsState {
		const suggestions = new GhostSuggestionsState()

		if (!this.context?.document || !this.context?.range) {
			return suggestions
		}

		try {
			const document = this.context.document
			const position = this.context.range.start
			const line = position.line

			// Extract the function body content from the replacement
			let meaningfulContent = ""

			// Look for function body content in the replace section
			const functionMatch = replaceContent.match(/function\s+\w+\([^)]*\)\s*\{\s*([\s\S]*?)\s*\}$/s)

			if (functionMatch) {
				// Extract the function body content
				meaningfulContent = functionMatch[1].trim()
			} else {
				// If no function wrapper, use the replace content as-is
				meaningfulContent = replaceContent.trim()
			}

			// Get the current line to preserve indentation
			const currentLine = document.lineAt(line)
			const leadingWhitespace = currentLine.text.match(/^(\s*)/)?.[1] || ""

			// Apply the leading whitespace to the first line of completion, keep others as-is
			const completionLines = meaningfulContent.split("\n")
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

			// Then add the meaningful content with proper indentation
			suggestionFile.addOperation({
				type: "+",
				line: line,
				oldLine: line,
				newLine: line,
				content: indentedCompletion,
			})

			return suggestions
		} catch (error) {
			console.error("Error creating suggestions from XML change:", error)
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
