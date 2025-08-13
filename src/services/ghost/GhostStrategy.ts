import * as vscode from "vscode"
import { structuredPatch } from "diff"
import { GhostSuggestionContext, GhostSuggestionEditOperationType } from "./types"
import { GhostSuggestionsState } from "./GhostSuggestions"

export class GhostStrategy {
	getSystemPrompt(customInstructions: string = "") {
		const basePrompt = `
You are a hyper-competent AI pair-programmer specializing in real-time, in-line code assistance. Your task is to interpret a user's intent from a code diff and provide precise code modifications to complete their action. You will receive the code context and a diff of recent changes, and you MUST respond ONLY with a single line of XML containing the required changes.

## ⚙️ Core Logic: The Two Intents

Your entire strategy is determined by the \`Recent Changes (Diff)\`. First, analyze if the user is adding/modifying or deleting code.

* **\`+\` Add/Modify Intent ➡️ CONSTRUCTIVE COMPLETION**
    * If the diff shows new or incomplete code (e.g., \`const newVar =\`), your goal is to **complete it**.
    * Infer intent from names, comments, and surrounding code to write a logical and complete implementation.
    * If the diff shows a rename (e.g., \`count\` -> \`sum\`), **propagate the rename** to all other usages of the old name in the document.
    * **NEVER** delete new code written by the user. Always build upon it.

* **\`-\` Delete Intent ➡️ LOGICAL REMOVAL**
    * If the diff shows a deletion, your goal is to **clean up the consequences**.
    * Assume the user wants to remove the associated functionality.
    * Find all usages of the deleted variable, function, or component and **remove that related, now-obsolete code**.
    * **NEVER** re-introduce the deleted code. Propagate the removal.

---

## 📝 Output Format: [CRITICAL]

You **MUST** follow these rules precisely. Any deviation will break the tool.

1.  **Single-Line XML Only**: Your entire response **MUST BE a single line of XML** with no line breaks or whitespace between tags. All conversational text, explanations, or apologies are forbidden.
2.  **CDATA Wrappers**: All code content inside \`<search>\` and \`<replace>\` tags **MUST** be wrapped in \`<![CDATA[...]]>\`.
3.  **Exact Match Search**: The content within a \`<search>\` tag **MUST EXACTLY MATCH** a block of code in the current document, including all indentation, whitespace, and newlines.
4.  **Complete Blocks**: **ALWAYS** search for and replace complete logical blocks.
    * **Functions**: Include the entire function from its declaration/signature to its closing brace \`}\`.
    * **Classes/Objects**: Include the entire structure from declaration to closing brace \`}\`.
    * **Multi-line statements**: Include all lines of the statement.
    * **❌ NEVER** search for partial lines or incomplete fragments of a block.
5.  **No Overlapping Changes**: This is an **ABSOLUTE RULE**. You must not generate multiple \`<change>\` blocks that target the same or overlapping lines of code. If multiple edits are needed in the same function, create **ONE** \`<change>\` block that replaces the entire original function with the entire modified function.

### ✅ Correct Single-Line XML Example:
\`<change><search><![CDATA[function old() {
  console.log("old");
}]]></search><replace><![CDATA[function newVersion() {
  console.log("new and improved");
}]]></replace></change><change><search><![CDATA[const x = 1;]]></search><replace><![CDATA[const x = 2;]]></replace></change>\`
`
		return customInstructions ? `${basePrompt}${customInstructions}` : basePrompt
	}

	private getBaseSuggestionPrompt() {
		return `\
**Task: Analyze the code diff and context below. Infer my intent and generate a single-line XML response to complete the code.**

## Context for Analysis
`
	}

	private getRecentUserActions(context: GhostSuggestionContext) {
		if (!context.recentOperations || context.recentOperations.length === 0) {
			return ""
		}
		let result = `* **Recent User Actions:**\n\n`
		let actionIndex = 1

		// Flatten all actions from all groups and list them individually
		context.recentOperations.forEach((action) => {
			result += `${actionIndex}. ${action.description}\n`
			if (action.content) {
				result += `\`\`\`\n${action.content}\n\`\`\`\n`
			}
			result += `\n`
			actionIndex++
		})

		return result
	}

	private getUserFocusPrompt(context: GhostSuggestionContext) {
		const { range } = context
		if (!range) {
			return ""
		}
		const cursorLine = range.start.line + 1 // 1-based line number
		const cursorCharacter = range.start.character + 1 // 1-based character position
		return `* **User Focus:**
Cursor Position: Line ${cursorLine}, Character ${cursorCharacter}`
	}

	private getUserSelectedTextPrompt(context: GhostSuggestionContext) {
		const { document, range } = context
		if (!document || !range) {
			return ""
		}
		const selectedText = document.getText(range)
		const languageId = document.languageId
		return `* **Selected Text:**
\`\`\`${languageId}
${selectedText}
\`\`\``
	}

	private getUserCurrentDocumentPrompt(context: GhostSuggestionContext) {
		const { document } = context
		if (!document) {
			return ""
		}
		const documentUri = document.uri.toString()
		const languageId = document.languageId
		return `
## Full Document Code
\`\`\`${languageId}
${document.getText()}
\`\`\``
	}

	private getUserInputPrompt(context: GhostSuggestionContext) {
		const { userInput } = context
		if (!userInput) {
			return ""
		}
		return `* **User Input:**
\`\`\`
${userInput}
\`\`\``
	}

	private getASTInfoPrompt(context: GhostSuggestionContext) {
		if (!context.documentAST) {
			return ""
		}

		let astInfo = `* **AST Information:**\n`

		// Add language information
		astInfo += `Language: ${context.documentAST.language}\n\n`

		// If we have a cursor position with an AST node, include that information
		if (context.rangeASTNode) {
			const node = context.rangeASTNode
			astInfo += `Current Node Type: ${node.type}\n`
			astInfo += `Current Node Text: ${node.text.substring(0, 100)}${node.text.length > 100 ? "..." : ""}\n`

			// Include parent context if available
			if (node.parent) {
				astInfo += `Parent Node Type: ${node.parent.type}\n`

				// Include siblings for context
				const siblings = []
				let sibling = node.previousSibling
				while (sibling && siblings.length < 3) {
					siblings.unshift(
						`${sibling.type}: ${sibling.text.substring(0, 30)}${sibling.text.length > 30 ? "..." : ""}`,
					)
					sibling = sibling.previousSibling
				}

				sibling = node.nextSibling
				while (sibling && siblings.length < 5) {
					siblings.push(
						`${sibling.type}: ${sibling.text.substring(0, 30)}${sibling.text.length > 30 ? "..." : ""}`,
					)
					sibling = sibling.nextSibling
				}

				if (siblings.length > 0) {
					astInfo += `\nSurrounding Nodes:\n`
					siblings.forEach((s, i) => {
						astInfo += `${i + 1}. ${s}\n`
					})
				}
			}

			// Include children for context
			const children = []
			for (let i = 0; i < node.childCount && children.length < 5; i++) {
				const child = node.child(i)
				if (child) {
					children.push(`${child.type}: ${child.text.substring(0, 30)}${child.text.length > 30 ? "..." : ""}`)
				}
			}

			if (children.length > 0) {
				astInfo += `\nChild Nodes:\n`
				children.forEach((c, i) => {
					astInfo += `${i + 1}. ${c}\n`
				})
			}
		}

		return astInfo
	}

	private getDiagnosticsPrompt(context: GhostSuggestionContext) {
		if (!context.diagnostics || context.diagnostics.length === 0) {
			return ""
		}

		let diagnosticsInfo = `* **Document Diagnostics:**\n`

		// Group diagnostics by severity
		const errorDiagnostics = context.diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error)
		const warningDiagnostics = context.diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Warning)
		const infoDiagnostics = context.diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Information)
		const hintDiagnostics = context.diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Hint)

		// Format errors
		if (errorDiagnostics.length > 0) {
			diagnosticsInfo += `\nErrors (${errorDiagnostics.length}):\n`
			errorDiagnostics.forEach((diagnostic, index) => {
				const line = diagnostic.range.start.line + 1 // 1-based line number
				const character = diagnostic.range.start.character + 1 // 1-based character position
				diagnosticsInfo += `${index + 1}. Line ${line}, Char ${character}: ${diagnostic.message}\n`
			})
		}

		// Format warnings
		if (warningDiagnostics.length > 0) {
			diagnosticsInfo += `\nWarnings (${warningDiagnostics.length}):\n`
			warningDiagnostics.forEach((diagnostic, index) => {
				const line = diagnostic.range.start.line + 1 // 1-based line number
				const character = diagnostic.range.start.character + 1 // 1-based character position
				diagnosticsInfo += `${index + 1}. Line ${line}, Char ${character}: ${diagnostic.message}\n`
			})
		}

		// Format information
		if (infoDiagnostics.length > 0) {
			diagnosticsInfo += `\nInformation (${infoDiagnostics.length}):\n`
			infoDiagnostics.forEach((diagnostic, index) => {
				const line = diagnostic.range.start.line + 1 // 1-based line number
				const character = diagnostic.range.start.character + 1 // 1-based character position
				diagnosticsInfo += `${index + 1}. Line ${line}, Char ${character}: ${diagnostic.message}\n`
			})
		}

		// Format hints
		if (hintDiagnostics.length > 0) {
			diagnosticsInfo += `\nHints (${hintDiagnostics.length}):\n`
			hintDiagnostics.forEach((diagnostic, index) => {
				const line = diagnostic.range.start.line + 1 // 1-based line number
				const character = diagnostic.range.start.character + 1 // 1-based character position
				diagnosticsInfo += `${index + 1}. Line ${line}, Char ${character}: ${diagnostic.message}\n`
			})
		}

		return diagnosticsInfo
	}

	getSuggestionPrompt(context: GhostSuggestionContext) {
		const sections = [
			this.getBaseSuggestionPrompt(),
			this.getUserInputPrompt(context),
			this.getRecentUserActions(context),
			this.getUserFocusPrompt(context),
			this.getUserSelectedTextPrompt(context),
			this.getASTInfoPrompt(context),
			this.getDiagnosticsPrompt(context),
			this.getUserCurrentDocumentPrompt(context),
		]

		return `[INST]
${sections.filter(Boolean).join("\n\n")}
[/INST]
`
	}

	/**
	 * Check if the search pattern might be a partial match of a larger code construct
	 */
	private isPotentialPartialMatch(content: string, searchPattern: string): boolean {
		const trimmedPattern = searchPattern.trim()

		// Check for common patterns that suggest partial matches
		const partialPatterns = [
			/^(const|let|var|function|class|interface|type)\s+\w+\s*[=:]?\s*$/, // Variable/function declarations without body
			/^[^{]*\{\s*$/, // Opening brace without closing
			/^\s*[^}]*$/, // Content without closing brace when it should have one
			/^[^(]*\([^)]*$/, // Opening parenthesis without closing
			/^[^[]*\[[^\]]*$/, // Opening bracket without closing
		]

		return partialPatterns.some((pattern) => pattern.test(trimmedPattern))
	}

	/**
	 * Validate if a match represents a complete code construct
	 */
	private isCompleteMatch(
		content: string,
		matchIndex: number,
		matchLength: number,
		originalPattern: string,
	): boolean {
		const matchedText = content.substring(matchIndex, matchIndex + matchLength)
		const trimmedMatch = matchedText.trim()
		const trimmedPattern = originalPattern.trim()

		// Check for balanced braces, parentheses, and brackets
		const checkBalance = (open: string, close: string) => {
			const openCount = (trimmedMatch.match(new RegExp(`\\${open}`, "g")) || []).length
			const closeCount = (trimmedMatch.match(new RegExp(`\\${close}`, "g")) || []).length
			return openCount === closeCount
		}

		if (trimmedPattern.includes("{") || trimmedPattern.includes("}")) {
			if (!checkBalance("{", "}")) return false
		}
		if (trimmedPattern.includes("(") || trimmedPattern.includes(")")) {
			if (!checkBalance("(", ")")) return false
		}
		if (trimmedPattern.includes("[") || trimmedPattern.includes("]")) {
			if (!checkBalance("[", "]")) return false
		}

		return true
	}

	/**
	 * Find the best match for search content in the document, handling whitespace differences
	 */
	private findBestMatch(content: string, searchPattern: string): number {
		// First try exact match
		let index = content.indexOf(searchPattern)
		if (index !== -1) {
			return index
		}

		// Handle the case where search pattern has trailing whitespace that might not match exactly
		// This is common when the search pattern ends with a newline but the content has additional empty lines
		if (searchPattern.endsWith("\n")) {
			// Try matching without the trailing newline, then check if we can find it in context
			const searchWithoutTrailingNewline = searchPattern.slice(0, -1)
			index = content.indexOf(searchWithoutTrailingNewline)
			if (index !== -1) {
				// Check if the character after the match is a newline or end of string
				const afterMatchIndex = index + searchWithoutTrailingNewline.length
				if (afterMatchIndex >= content.length || content[afterMatchIndex] === "\n") {
					return index
				}
			}
		}

		// Normalize whitespace for both content and search pattern
		const normalizeWhitespace = (text: string): string => {
			return text
				.replace(/\r\n/g, "\n") // Normalize line endings
				.replace(/\r/g, "\n") // Handle old Mac line endings
				.replace(/\t/g, "    ") // Convert tabs to spaces
				.replace(/[ \t]+$/gm, "") // Remove trailing whitespace from each line
		}

		const normalizedContent = normalizeWhitespace(content)
		const normalizedSearch = normalizeWhitespace(searchPattern)

		// Try normalized match
		index = normalizedContent.indexOf(normalizedSearch)
		if (index !== -1) {
			// Map back to original content position
			return this.mapNormalizedToOriginalIndex(content, normalizedContent, index)
		}

		// Try trimmed search (remove leading/trailing whitespace)
		const trimmedSearch = searchPattern.trim()
		if (trimmedSearch !== searchPattern) {
			index = content.indexOf(trimmedSearch)
			if (index !== -1) {
				return index
			}
		}

		// NEW: Enhanced validation for partial matches
		// Before doing fuzzy matching, check if this might be a partial match of a larger construct
		if (this.isPotentialPartialMatch(content, searchPattern)) {
			console.warn(
				"Potential partial match detected. Search pattern might be incomplete:",
				searchPattern.substring(0, 100),
			)
			return -1 // Reject partial matches that could cause duplication
		}

		// Try fuzzy matching with flexible whitespace (only if not a potential partial match)
		const flexiblePattern = searchPattern
			.replace(/\s+/g, "\\s+") // Replace any whitespace sequence with flexible regex
			.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") // Escape regex special characters except our whitespace

		try {
			const regex = new RegExp(flexiblePattern, "g")
			const match = regex.exec(content)
			if (match) {
				// Additional validation: check if this match is part of a larger construct
				if (this.isCompleteMatch(content, match.index, match[0].length, searchPattern)) {
					return match.index
				}
			}
		} catch (e) {
			// Regex failed, continue with other methods
		}

		// Last resort: try to find the first few words of the search pattern
		const words = searchPattern.trim().split(/\s+/).slice(0, 3)
		if (words.length > 0) {
			const partialPattern = words.join("\\s+")
			try {
				const regex = new RegExp(partialPattern, "g")
				const match = regex.exec(content)
				if (match) {
					return match.index
				}
			} catch (e) {
				// Regex failed
			}
		}

		return -1 // No match found
	}

	/**
	 * Map an index from normalized content back to the original content
	 */
	private mapNormalizedToOriginalIndex(
		originalContent: string,
		normalizedContent: string,
		normalizedIndex: number,
	): number {
		let originalIndex = 0
		let normalizedPos = 0

		while (normalizedPos < normalizedIndex && originalIndex < originalContent.length) {
			const originalChar = originalContent[originalIndex]
			const normalizedChar = normalizedContent[normalizedPos]

			if (originalChar === normalizedChar) {
				originalIndex++
				normalizedPos++
			} else {
				// Handle whitespace normalization differences
				if (/\s/.test(originalChar)) {
					originalIndex++
					// Skip ahead in original until we find non-whitespace or match normalized
					while (originalIndex < originalContent.length && /\s/.test(originalContent[originalIndex])) {
						originalIndex++
					}
					if (normalizedPos < normalizedContent.length && /\s/.test(normalizedChar)) {
						normalizedPos++
					}
				} else {
					// Characters don't match, this shouldn't happen with proper normalization
					originalIndex++
					normalizedPos++
				}
			}
		}

		return originalIndex
	}

	private async parseSearchAndReplaceFormat(
		response: string,
		context: GhostSuggestionContext,
	): Promise<GhostSuggestionsState> {
		const suggestions = new GhostSuggestionsState()

		// Extract all <change> blocks from the response
		// Updated regex to handle both single-line XML format and traditional format with whitespace
		const changeRegex =
			/<change>\s*<search>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/search>\s*<replace>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/replace>\s*<\/change>/g
		const changes: Array<{ search: string; replace: string }> = []

		let match
		while ((match = changeRegex.exec(response)) !== null) {
			const searchContent = match[1]
			const replaceContent = match[2]
			changes.push({ search: searchContent, replace: replaceContent })
		}
		if (changes.length === 0) {
			return suggestions
		}

		// Process changes for the current document
		const document = context.document
		const currentContent = document.getText()
		let modifiedContent = currentContent

		// Apply changes in reverse order to maintain line numbers
		const appliedChanges: Array<{
			searchContent: string
			replaceContent: string
			startIndex: number
			endIndex: number
		}> = []

		for (const change of changes) {
			const searchIndex = this.findBestMatch(modifiedContent, change.search)
			if (searchIndex !== -1) {
				// Check for overlapping changes before applying
				const endIndex = searchIndex + change.search.length
				const hasOverlap = appliedChanges.some((existingChange) => {
					// Check if ranges overlap
					const existingStart = existingChange.startIndex
					const existingEnd = existingChange.endIndex
					return searchIndex < existingEnd && endIndex > existingStart
				})

				if (hasOverlap) {
					console.warn("Skipping overlapping change:", change.search.substring(0, 50))
					continue // Skip this change to avoid duplicates
				}

				// Handle the case where search pattern ends with newline but we need to preserve additional whitespace
				let adjustedReplaceContent = change.replace

				// If the search pattern ends with a newline, check if there are additional empty lines after it
				if (change.search.endsWith("\n")) {
					let nextCharIndex = endIndex
					let extraNewlines = ""

					// Count consecutive newlines after the search pattern
					while (nextCharIndex < modifiedContent.length && modifiedContent[nextCharIndex] === "\n") {
						extraNewlines += "\n"
						nextCharIndex++
					}

					// If we found extra newlines, preserve them by adding them to the replacement
					if (extraNewlines.length > 0) {
						// Only add the extra newlines if the replacement doesn't already end with enough newlines
						if (!adjustedReplaceContent.endsWith("\n" + extraNewlines)) {
							adjustedReplaceContent = adjustedReplaceContent.trimEnd() + "\n" + extraNewlines
						}
					}
				}

				appliedChanges.push({
					searchContent: change.search,
					replaceContent: adjustedReplaceContent,
					startIndex: searchIndex,
					endIndex: endIndex,
				})
			}
		}

		// Sort by start index in descending order to apply changes from end to beginning
		appliedChanges.sort((a, b) => b.startIndex - a.startIndex)

		// Apply the changes
		for (const change of appliedChanges) {
			modifiedContent =
				modifiedContent.substring(0, change.startIndex) +
				change.replaceContent +
				modifiedContent.substring(change.endIndex)
		}

		// Generate diff between original and modified content
		const relativePath = vscode.workspace.asRelativePath(document.uri, false)
		const patch = structuredPatch(relativePath, relativePath, currentContent, modifiedContent, "", "")

		// Create a suggestion file
		const suggestionFile = suggestions.addFile(document.uri)

		// Process each hunk in the patch
		for (const hunk of patch.hunks) {
			let currentOldLineNumber = hunk.oldStart
			let currentNewLineNumber = hunk.newStart

			// Iterate over each line within the hunk
			for (const line of hunk.lines) {
				const operationType = line.charAt(0) as GhostSuggestionEditOperationType
				const content = line.substring(1)

				switch (operationType) {
					// Case 1: The line is an addition
					case "+":
						suggestionFile.addOperation({
							type: "+",
							line: currentNewLineNumber - 1,
							content: content,
						})
						// Only increment the new line counter for additions and context lines
						currentNewLineNumber++
						break

					// Case 2: The line is a deletion
					case "-":
						suggestionFile.addOperation({
							type: "-",
							line: currentOldLineNumber - 1,
							content: content,
						})
						// Only increment the old line counter for deletions and context lines
						currentOldLineNumber++
						break

					// Case 3: The line is unchanged (context)
					default:
						// For context lines, we increment both counters
						currentOldLineNumber++
						currentNewLineNumber++
						break
				}
			}
		}

		suggestions.sortGroups()
		return suggestions
	}

	async parseResponse(response: string, context: GhostSuggestionContext): Promise<GhostSuggestionsState> {
		const suggestions = new GhostSuggestionsState()

		// First, try to parse as search-and-replace XML format
		if (response.includes("<change>") && response.includes("<search>") && response.includes("<replace>")) {
			return await this.parseSearchAndReplaceFormat(response, context)
		}

		// Try to parse as code block format (filename followed by code block)
		if (response.includes("```")) {
			return await this.parseCodeBlockFormat(response, context)
		}

		// No valid format found
		return suggestions
	}

	/**
	 * Parse code block format like:
	 * filename.js
	 * ```js
	 * code content
	 * ```
	 */
	private async parseCodeBlockFormat(
		response: string,
		context: GhostSuggestionContext,
	): Promise<GhostSuggestionsState> {
		const suggestions = new GhostSuggestionsState()

		// Extract filename and code block
		const lines = response.split("\n")
		let filename = ""
		let codeContent = ""
		let inCodeBlock = false
		let language = ""

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim()

			// Check for filename (usually first non-empty line)
			if (!filename && line && !line.startsWith("```") && !inCodeBlock) {
				filename = line
				continue
			}

			// Check for code block start
			if (line.startsWith("```")) {
				if (!inCodeBlock) {
					inCodeBlock = true
					language = line.substring(3).trim()
				} else {
					// End of code block
					break
				}
				continue
			}

			// Collect code content
			if (inCodeBlock) {
				codeContent += (codeContent ? "\n" : "") + lines[i]
			}
		}

		if (!codeContent || !context.document) {
			return suggestions
		}

		// Replace the entire document content with the new code
		const document = context.document
		const currentContent = document.getText()

		// Generate diff between original and new content
		const relativePath = vscode.workspace.asRelativePath(document.uri, false)
		const patch = structuredPatch(relativePath, relativePath, currentContent, codeContent, "", "")

		// Create a suggestion file
		const suggestionFile = suggestions.addFile(document.uri)

		// Process each hunk in the patch
		for (const hunk of patch.hunks) {
			let currentOldLineNumber = hunk.oldStart
			let currentNewLineNumber = hunk.newStart

			// Iterate over each line within the hunk
			for (const line of hunk.lines) {
				const operationType = line.charAt(0) as GhostSuggestionEditOperationType
				const content = line.substring(1)

				switch (operationType) {
					// Case 1: The line is an addition
					case "+":
						suggestionFile.addOperation({
							type: "+",
							line: currentNewLineNumber - 1,
							content: content,
						})
						// Only increment the new line counter for additions and context lines
						currentNewLineNumber++
						break

					// Case 2: The line is a deletion
					case "-":
						suggestionFile.addOperation({
							type: "-",
							line: currentOldLineNumber - 1,
							content: content,
						})
						// Only increment the old line counter for deletions and context lines
						currentOldLineNumber++
						break

					// Case 3: The line is unchanged (context)
					default:
						// For context lines, we increment both counters
						currentOldLineNumber++
						currentNewLineNumber++
						break
				}
			}
		}

		suggestions.sortGroups()
		return suggestions
	}
}
