/**
 * Handles parsing and cleaning Mercury's responses to extract the updated code.
 * Mercury responses can come in various formats (markdown, with/without markers).
 */
export class MercuryResponseParser {
	private static readonly MERCURY_MARKERS = {
		OPEN: "<|code_to_edit|>",
		CLOSE: "<|/code_to_edit|>",
	}

	/**
	 * Extract clean code content from Mercury's response.
	 * Handles multiple fallback strategies for robust parsing.
	 */
	public extractCleanCode(response: string): string {
		// Step 1: Extract from markdown code blocks first
		let extractedCode = this.extractFromCodeBlocks(response)

		// Step 2: Handle Mercury markers (fallback in case they leak through)
		extractedCode = this.stripMercuryMarkers(extractedCode)

		return extractedCode.trim()
	}

	/**
	 * Extract content from markdown code blocks (```language code ```)
	 */
	private extractFromCodeBlocks(message: string): string {
		// Look for code blocks with optional language specifiers
		const codeBlockRegex = /```(?:\w+)?\s*\n?([\s\S]*?)\n?```/g
		const matches = codeBlockRegex.exec(message)

		if (matches && matches[1]) {
			return matches[1].trim()
		}

		// Fallback: try simpler patterns
		const startMarker = "```"
		const startIndex = message.indexOf(startMarker)
		const endIndex = message.lastIndexOf(startMarker)

		if (startIndex !== -1 && endIndex !== -1 && startIndex !== endIndex) {
			// Find the end of the first line after the opening ```
			let contentStart = message.indexOf("\n", startIndex)
			if (contentStart === -1) {
				contentStart = startIndex + 3
			} else {
				contentStart += 1
			}

			const content = message.slice(contentStart, endIndex).trim()
			return content
		}

		// No code blocks found, return the original message
		return message.trim()
	}

	/**
	 * Strip Mercury markers from content.
	 * These shouldn't be in the response, but add fallback in case they leak through.
	 * Also handles line number stripping while preserving indentation.
	 */
	private stripMercuryMarkers(content: string): string {
		const { OPEN, CLOSE } = MercuryResponseParser.MERCURY_MARKERS

		// Remove opening marker
		let cleaned = content.replace(new RegExp(OPEN, "g"), "")

		// Remove closing marker
		cleaned = cleaned.replace(new RegExp(CLOSE.replace(/[|]/g, "\\|"), "g"), "")

		// CRITICAL FIX: Remove line numbers while preserving indentation
		// Pattern: "123 | content" -> "content" (keeping all spaces after |)
		cleaned = this.stripLineNumbersPreservingIndentation(cleaned)

		return cleaned
	}

	/**
	 * Strip line numbers from Mercury response while preserving indentation.
	 * Fixes the critical whitespace loss bug.
	 */
	private stripLineNumbersPreservingIndentation(content: string): string {
		// Regex to match: [digits] [space] [|] [content including spaces]
		// Captures everything after "| " to preserve indentation
		return content.replace(/^\d+\s*\|\s?/gm, "")
	}

	/**
	 * Check if response appears to be empty or just whitespace
	 */
	public isEmpty(response: string): boolean {
		return !this.extractCleanCode(response).trim()
	}

	/**
	 * Get debug info about the parsing process
	 */
	public getParsingDebugInfo(response: string): {
		originalLength: number
		hasCodeBlocks: boolean
		hasMercuryMarkers: boolean
		extractedLength: number
	} {
		const { OPEN, CLOSE } = MercuryResponseParser.MERCURY_MARKERS

		return {
			originalLength: response.length,
			hasCodeBlocks: response.includes("```"),
			hasMercuryMarkers: response.includes(OPEN) || response.includes(CLOSE),
			extractedLength: this.extractCleanCode(response).length,
		}
	}
}
