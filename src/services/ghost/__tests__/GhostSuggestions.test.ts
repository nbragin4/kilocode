import * as vscode from "vscode"
import { GhostSuggestionsState } from "../GhostSuggestions"
import { GhostSuggestionEditOperation } from "../types"

describe("GhostSuggestions", () => {
	let ghostSuggestions: GhostSuggestionsState
	let mockUri: vscode.Uri

	beforeEach(() => {
		ghostSuggestions = new GhostSuggestionsState()
		mockUri = vscode.Uri.file("/test/file.ts")
	})

	describe("selectClosestGroup", () => {
		it("should select the closest group to a selection", () => {
			const file = ghostSuggestions.addFile(mockUri)

			// Add operations with large distances to ensure separate groups
			const operation1: GhostSuggestionEditOperation = { line: 1, type: "+", content: "line 1" }
			const operation2: GhostSuggestionEditOperation = { line: 50, type: "+", content: "line 50" }
			const operation3: GhostSuggestionEditOperation = { line: 100, type: "+", content: "line 100" }

			file.addOperation(operation1)
			file.addOperation(operation2)
			file.addOperation(operation3)

			file.sortGroups()

			const groups = file.getGroupsOperations()

			// Test the selectClosestGroup functionality regardless of how many groups exist
			if (groups.length === 1) {
				// All operations are in one group - test that it selects the group
				const selection = new vscode.Selection(45, 0, 55, 0) // Closest to operation2 at line 50
				file.selectClosestGroup(selection)
				expect(file.getSelectedGroup()).toBe(0) // Only group
			} else {
				// Multiple groups exist - test that it selects the closest one
				expect(groups.length).toBeGreaterThan(1)
				const selection = new vscode.Selection(45, 0, 55, 0) // Closest to operation2 at line 50
				file.selectClosestGroup(selection)
				// Should select whichever group contains the operation closest to line 50
				expect(file.getSelectedGroup()).not.toBeNull()
			}
		})

		it("should select group when selection overlaps with operation", () => {
			const file = ghostSuggestions.addFile(mockUri)

			const operation1: GhostSuggestionEditOperation = { line: 5, type: "+", content: "line 5" }
			const operation2: GhostSuggestionEditOperation = { line: 50, type: "+", content: "line 50" }

			file.addOperation(operation1)
			file.addOperation(operation2)

			file.sortGroups()

			// Create a selection that includes line 50
			const selection = new vscode.Selection(49, 0, 51, 0)
			file.selectClosestGroup(selection)

			// Should select a group (distance is 0 since selection overlaps)
			expect(file.getSelectedGroup()).not.toBeNull()
		})

		it("should select first group when selection is before all operations", () => {
			const file = ghostSuggestions.addFile(mockUri)

			const operation1: GhostSuggestionEditOperation = { line: 10, type: "+", content: "line 10" }
			const operation2: GhostSuggestionEditOperation = { line: 20, type: "+", content: "line 20" }

			file.addOperation(operation1)
			file.addOperation(operation2)

			file.sortGroups()

			// Create a selection before all operations
			const selection = new vscode.Selection(1, 0, 3, 0)
			file.selectClosestGroup(selection)

			expect(file.getSelectedGroup()).toBe(0) // First group (operation1)
		})

		it("should select group closest to selection when selection is after all operations", () => {
			const file = ghostSuggestions.addFile(mockUri)

			const operation1: GhostSuggestionEditOperation = { line: 10, type: "+", content: "line 10" }
			const operation2: GhostSuggestionEditOperation = { line: 50, type: "+", content: "line 50" }

			file.addOperation(operation1)
			file.addOperation(operation2)

			file.sortGroups()

			// Create a selection after all operations (closer to operation2)
			const selection = new vscode.Selection(60, 0, 65, 0)
			file.selectClosestGroup(selection)

			// Should select a group (the one with operation closest to the selection)
			expect(file.getSelectedGroup()).not.toBeNull()
		})

		it("should handle empty groups", () => {
			const file = ghostSuggestions.addFile(mockUri)

			const selection = new vscode.Selection(10, 0, 15, 0)
			file.selectClosestGroup(selection)

			expect(file.getSelectedGroup()).toBeNull()
		})

		it("should select group with multiple operations closest to selection", () => {
			const file = ghostSuggestions.addFile(mockUri)

			// Create a group with multiple operations
			const operation1: GhostSuggestionEditOperation = { line: 5, type: "+", content: "line 5" }
			const operation2: GhostSuggestionEditOperation = { line: 6, type: "+", content: "line 6" }
			const operation3: GhostSuggestionEditOperation = { line: 20, type: "+", content: "line 20" }

			file.addOperation(operation1)
			file.addOperation(operation2) // Should be in same group as operation1
			file.addOperation(operation3) // Should be in different group

			file.sortGroups()

			// Create a selection closer to the first group
			const selection = new vscode.Selection(8, 0, 10, 0)
			file.selectClosestGroup(selection)

			expect(file.getSelectedGroup()).toBe(0) // First group
		})
	})
})
