"use client"

import { TestDetails, Profile, TestResult } from "@/types"
import { CodeBlock } from "./CodeBlock"

interface TestDetailViewerProps {
	testDetails: TestDetails | null
	globalProfile: string
	profiles: Profile[]
	testResults: Map<string, TestResult>
	runningTests: Set<string>
	onRunTest: (testName: string, profile: string) => void
	onClose: () => void
}

export function TestDetailViewer({
	testDetails,
	globalProfile,
	profiles,
	testResults,
	runningTests,
	onRunTest,
	onClose,
}: TestDetailViewerProps) {
	if (!testDetails) {
		return (
			<div className="bg-white shadow-sm border border-gray-200 rounded-lg p-8 text-center">
				<div className="text-gray-400 mb-4">
					<div className="text-4xl mb-2">📄</div>
					<h3 className="text-lg font-medium text-gray-900">No Test Selected</h3>
					<p className="text-gray-500">Click on a test case to view its details</p>
				</div>
			</div>
		)
	}

	const highlightCursor = (content: string, line: number, character: number) => {
		const lines = content.split("\n")
		if (line >= 0 && line < lines.length) {
			const targetLine = lines[line]
			const before = targetLine.slice(0, character)
			const after = targetLine.slice(character)
			lines[line] = before + "|" + after
		}
		return lines.join("\n")
	}

	const getFileContent = (files: { [filename: string]: string }, fileName: string) => {
		const content = files[fileName] || "File not found"

		// Highlight cursor position if this is the active file
		if (fileName === testDetails.activeFile && testDetails.cursorPosition) {
			return highlightCursor(content, testDetails.cursorPosition.line, testDetails.cursorPosition.character)
		}

		return content
	}

	const extractFinalFileContent = (result: TestResult) => {
		// Try to get finalFileContent if available
		if (result.finalFileContent) {
			return result.finalFileContent
		}

		// Try to extract from suggestions if available
		if (result.suggestions) {
			// If suggestions has a finalFileContent property
			if (result.suggestions.finalFileContent) {
				return result.suggestions.finalFileContent
			}

			// If suggestions has suggestions array with applied content
			if (result.suggestions.suggestions && result.suggestions.suggestions.length > 0) {
				const firstSuggestion = result.suggestions.suggestions[0]
				if (firstSuggestion.finalFileContent) {
					return firstSuggestion.finalFileContent
				}
				if (firstSuggestion.content) {
					return firstSuggestion.content
				}
			}

			// Try to apply suggestions to original content
			if (testDetails && testDetails.inputFiles && testDetails.activeFile) {
				const originalContent = testDetails.inputFiles[testDetails.activeFile]

				// Try to find the actual suggestion content
				if (result.suggestions.suggestions && result.suggestions.suggestions.length > 0) {
					const suggestion = result.suggestions.suggestions[0]

					// Try different ways to get the final content
					if (suggestion.newText) {
						// Apply the suggestion to get final content
						const lines = originalContent.split("\n")
						const { line, character } = testDetails.cursorPosition || { line: 0, character: 0 }

						if (line < lines.length) {
							const before = lines[line].slice(0, character)
							const after = lines[line].slice(character)
							lines[line] = before + suggestion.newText + after
							return lines.join("\n")
						}
					}

					if (suggestion.text || suggestion.content) {
						const suggestionText = suggestion.text || suggestion.content
						const lines = originalContent.split("\n")
						const { line, character } = testDetails.cursorPosition || { line: 0, character: 0 }

						if (line < lines.length) {
							const before = lines[line].slice(0, character)
							const after = lines[line].slice(character)
							lines[line] = before + suggestionText + after
							return lines.join("\n")
						}
					}
				}

				// Fallback: show original content with note about suggestions
				return `${originalContent}\n\n// --- Autocomplete suggestion applied but couldn't extract final content ---\n// Suggestions available: ${result.suggestions.suggestions?.length || 0}`
			}
		}

		return "No final content available - run test to generate results"
	}

	const inputFiles = Object.keys(testDetails.inputFiles)
	const expectedFiles = Object.keys(testDetails.expectedFiles)
	const activeFileName = testDetails.activeFile || inputFiles[0] || "main.js"

	// Test execution helpers
	const testKey = testDetails && globalProfile ? `${testDetails.testName}-${globalProfile}` : null
	const currentResult = testKey ? testResults.get(testKey) : null
	const isRunning = testKey ? runningTests.has(testKey) : false

	const handleRunTest = () => {
		if (testDetails && globalProfile) {
			onRunTest(testDetails.testName, globalProfile)
		}
	}

	return (
		<div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
			{/* Header */}
			<div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="text-lg font-bold text-gray-900">📄 {testDetails.testName}</h2>
						<div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
							<span>📁 {inputFiles.length} input files</span>
							<span>✅ {expectedFiles.length} expected files</span>
							{testDetails.activeFile && <span>🎯 Active: {testDetails.activeFile}</span>}
							{testDetails.cursorPosition && (
								<span>
									📍 Cursor: {testDetails.cursorPosition.line}:{testDetails.cursorPosition.character}
								</span>
							)}
						</div>
					</div>
					<button
						onClick={onClose}
						className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border">
						← Back
					</button>
				</div>
			</div>

			{/* Three-Panel Layout - Input (40%) | Results (40%) | Metadata (20%) */}
			<div
				className="grid divide-x divide-gray-200"
				style={{ height: "600px", gridTemplateColumns: "2fr 2fr 1fr" }}>
				{/* Input Files Panel */}
				<div className="flex flex-col">
					<div className="bg-blue-50 px-4 py-2 border-b border-gray-200">
						<h3 className="font-semibold text-blue-900">📝 Input Files</h3>
					</div>
					<div className="flex-1 overflow-hidden">
						{inputFiles.length > 0 ? (
							<div className="h-full flex flex-col">
								{/* File tabs for multiple input files */}
								{inputFiles.length > 1 && (
									<div className="flex border-b border-gray-200 bg-gray-50">
										{inputFiles.map((fileName) => (
											<div
												key={fileName}
												className={`px-3 py-2 text-xs border-r border-gray-200 ${
													fileName === activeFileName
														? "bg-white text-blue-600 font-medium"
														: "text-gray-600 hover:bg-gray-100"
												}`}>
												{fileName}
											</div>
										))}
									</div>
								)}
								<div className="flex-1 overflow-auto p-4">
									<CodeBlock
										code={getFileContent(testDetails.inputFiles, activeFileName)}
										language="javascript"
										theme="github-light"
									/>
								</div>
							</div>
						) : (
							<div className="flex items-center justify-center h-full text-gray-400">
								<div className="text-center">
									<div className="text-2xl mb-2">📄</div>
									<p className="text-sm">No input files</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Actual Results Panel */}
				<div className="flex flex-col">
					<div className="bg-green-50 px-4 py-2 border-b border-gray-200">
						<h3 className="font-semibold text-green-900">🚀 Actual Results</h3>
						{currentResult && (
							<div className="text-xs text-green-700 mt-1">{activeFileName} after autocomplete</div>
						)}
					</div>
					<div className="flex-1 overflow-hidden">
						{currentResult?.suggestions ? (
							<div className="h-full flex flex-col">
								<div className="flex-1 overflow-auto p-4">
									<CodeBlock
										code={extractFinalFileContent(currentResult)}
										language="javascript"
										theme="github-light"
									/>
								</div>
								{/* Show raw JSON in collapsible section for debugging */}
								<details className="border-t border-gray-200 bg-gray-50">
									<summary className="px-4 py-2 text-xs text-gray-600 cursor-pointer hover:bg-gray-100">
										🔍 Debug: View Raw JSON Response
									</summary>
									<div className="px-4 pb-4 max-h-40 overflow-auto">
										<pre className="text-xs font-mono text-gray-600 whitespace-pre-wrap">
											{JSON.stringify(currentResult.suggestions, null, 2)}
										</pre>
									</div>
								</details>
							</div>
						) : currentResult && !isRunning ? (
							<div className="flex items-center justify-center h-full text-gray-400">
								<div className="text-center">
									<div className="text-2xl mb-2">❌</div>
									<p className="text-sm">No suggestions generated</p>
									{currentResult.error && (
										<p className="text-xs text-red-600 mt-2">{currentResult.error}</p>
									)}
								</div>
							</div>
						) : (
							<div className="flex items-center justify-center h-full text-gray-400">
								<div className="text-center">
									<div className="text-2xl mb-2">🚀</div>
									<p className="text-sm">Run test to see actual results</p>
									<p className="text-xs text-gray-500 mt-1">Final file content will appear here</p>
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Metadata & Info Panel */}
				<div className="flex flex-col">
					<div className="bg-purple-50 px-4 py-2 border-b border-gray-200">
						<h3 className="font-semibold text-purple-900">ℹ️ Test Metadata</h3>
					</div>
					<div className="flex-1 overflow-auto p-4">
						{testDetails.error ? (
							<div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
								<h4 className="font-medium text-red-900 mb-2">❌ Error Loading Test</h4>
								<p className="text-sm text-red-700">{testDetails.error}</p>
							</div>
						) : null}

						{/* Test Execution Section */}
						{globalProfile && (
							<div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
								<h4 className="font-medium text-blue-900 mb-2">🚀 Test Execution</h4>
								<div className="space-y-2 text-sm">
									<div>
										<span className="text-blue-700">Profile: </span>
										<span className="font-mono text-blue-800">{globalProfile}</span>
									</div>

									<div className="flex space-x-2">
										<button
											onClick={() => handleRunTest()}
											disabled={isRunning}
											className={`px-3 py-1 text-xs rounded ${
												isRunning
													? "bg-gray-100 text-gray-400 cursor-not-allowed"
													: "bg-green-100 hover:bg-green-200 text-green-700"
											}`}>
											🔴 Run Live Test
										</button>
									</div>

									{isRunning && (
										<div className="flex items-center space-x-2 text-blue-600">
											<div className="animate-spin w-3 h-3 border border-blue-300 border-t-blue-600 rounded-full"></div>
											<span className="text-xs">Running test...</span>
										</div>
									)}

									{currentResult && !isRunning && (
										<div
											className={`p-2 rounded text-xs ${
												currentResult.passed
													? "bg-green-50 border border-green-200 text-green-700"
													: "bg-red-50 border border-red-200 text-red-700"
											}`}>
											<div className="font-medium">
												{currentResult.passed ? "✅ PASSED" : "❌ FAILED"}
											</div>
											{currentResult.executionTime && (
												<div>Time: {currentResult.executionTime}ms</div>
											)}
											{currentResult.groups !== undefined && (
												<div>Groups: {currentResult.groups}</div>
											)}
											{currentResult.error && (
												<div className="mt-1 text-red-600">Error: {currentResult.error}</div>
											)}
										</div>
									)}
								</div>
							</div>
						)}

						<div className="space-y-4 text-sm">
							{testDetails.metadata.description && (
								<div>
									<h4 className="font-medium text-gray-900 mb-1">Description</h4>
									<p className="text-gray-600">{testDetails.metadata.description}</p>
								</div>
							)}

							{testDetails.metadata.category && (
								<div>
									<h4 className="font-medium text-gray-900 mb-1">Category</h4>
									<span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
										{testDetails.metadata.category}
									</span>
								</div>
							)}

							{testDetails.metadata.expectedGroupCount && (
								<div>
									<h4 className="font-medium text-gray-900 mb-1">Expected Groups</h4>
									<p className="text-gray-600">{testDetails.metadata.expectedGroupCount}</p>
								</div>
							)}

							{testDetails.metadata.shouldCompile !== undefined && (
								<div>
									<h4 className="font-medium text-gray-900 mb-1">Should Compile</h4>
									<span
										className={`inline-block px-2 py-1 rounded text-xs ${
											testDetails.metadata.shouldCompile
												? "bg-green-100 text-green-800"
												: "bg-red-100 text-red-800"
										}`}>
										{testDetails.metadata.shouldCompile ? "Yes" : "No"}
									</span>
								</div>
							)}

							{testDetails.metadata.supportedProfiles && (
								<div>
									<h4 className="font-medium text-gray-900 mb-1">Supported Profiles</h4>
									<div className="space-y-1">
										{testDetails.metadata.supportedProfiles.map((profile: string) => (
											<span
												key={profile}
												className="inline-block bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs mr-1">
												{profile}
											</span>
										))}
									</div>
								</div>
							)}

							{testDetails.metadata.isAutocompleteTest && (
								<div>
									<h4 className="font-medium text-gray-900 mb-1">Test Type</h4>
									<span className="inline-block bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
										🚀 Live Autocomplete Test
									</span>
								</div>
							)}

							{testDetails.metadata.expectedPatterns && (
								<div>
									<h4 className="font-medium text-gray-900 mb-1">Expected Patterns</h4>
									<div className="bg-green-50 border border-green-200 rounded p-2 text-xs">
										{testDetails.metadata.expectedPatterns.map((pattern: string, index: number) => (
											<div key={index} className="font-mono text-green-800 mb-1">
												<span className="text-green-600">▸</span> <code>{pattern}</code>
											</div>
										))}
									</div>
								</div>
							)}

							{testDetails.activeFile && testDetails.cursorPosition && (
								<div>
									<h4 className="font-medium text-gray-900 mb-1">Cursor Position</h4>
									<div className="bg-blue-50 border border-blue-200 rounded p-2 text-xs font-mono">
										<div>
											<strong>File:</strong> {testDetails.activeFile}
										</div>
										<div>
											<strong>Line:</strong> {testDetails.cursorPosition.line + 1}
										</div>
										<div>
											<strong>Column:</strong> {testDetails.cursorPosition.character + 1}
										</div>
										<div className="text-blue-600 mt-1">
											🎯 This is where the autocomplete should trigger
										</div>
									</div>
								</div>
							)}

							<div>
								<h4 className="font-medium text-gray-900 mb-1">File Summary</h4>
								<div className="bg-gray-50 rounded p-2 text-xs">
									<div>Input files: {inputFiles.length}</div>
									<div>Expected files: {expectedFiles.length}</div>
									{inputFiles.length > 0 && (
										<div className="mt-1 text-gray-500">{inputFiles.join(", ")}</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	)
}
