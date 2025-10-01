import * as vscode from "vscode"

export interface EditableRegion {
	editableStart: number
	editableEnd: number
	totalLines: number
	tokensUsed: number
}

/**
 * Calculates the editable region around a cursor position using token-based expansion.
 * This is the core logic that determines what code gets sent to Mercury for editing.
 */
export class EditableRegionCalculator {
	/**
	 * Calculate optimal editable region using token-based expansion around cursor.
	 * Expands alternately above and below cursor until hitting token limit.
	 */
	public calculateEditableRegion(
		document: vscode.TextDocument,
		cursorRange: vscode.Range,
		maxTokens: number = 512,
	): EditableRegion {
		const fileLines = document.getText().split("\n")
		const cursorLine = cursorRange.start.line

		// Start with just the cursor line
		let editableStart = cursorLine
		let editableEnd = cursorLine
		let totalTokens = this.countTokens(fileLines[cursorLine] || "")

		// Expand alternately above and below cursor
		let addingAbove = true
		while (totalTokens < maxTokens) {
			let addedLine = false

			if (addingAbove) {
				if (editableStart > 0) {
					editableStart--
					const lineContent = fileLines[editableStart]
					const lineTokens = this.countTokens(lineContent)
					totalTokens += lineTokens
					addedLine = true
				}
			} else {
				if (editableEnd < fileLines.length - 1) {
					editableEnd++
					const lineContent = fileLines[editableEnd]
					const lineTokens = this.countTokens(lineContent)
					totalTokens += lineTokens
					addedLine = true
				}
			}

			if (!addedLine) break
			addingAbove = !addingAbove
		}

		return {
			editableStart,
			editableEnd,
			totalLines: fileLines.length,
			tokensUsed: totalTokens,
		}
	}

	/**
	 * Extract the editable region content from document
	 */
	public extractEditableContent(document: vscode.TextDocument, region: EditableRegion): string {
		const lines = document.getText().split("\n")
		return lines.slice(region.editableStart, region.editableEnd + 1).join("\n")
	}

	/**
	 * Simple token counting (approximate - 4 chars = 1 token)
	 */
	private countTokens(text: string): number {
		return Math.ceil(text.length / 4)
	}
}
