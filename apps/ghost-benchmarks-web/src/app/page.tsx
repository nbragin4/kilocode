"use client"

import { useState } from "react"
import { useWebSocket } from "@/hooks/useWebSocket"
import { TestDetailViewer } from "@/components/TestDetailViewer"

export default function Dashboard() {
	const {
		connected,
		testCases,
		profiles,
		testResults,
		runningTests,
		globalProgress,
		selectedTestDetails,
		runTest,
		runMatrix,
		getTestDetails,
		refreshData,
	} = useWebSocket()

	const [selectedTests, setSelectedTests] = useState<Set<string>>(new Set())
	const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set())
	const [selectedTestForDetails, setSelectedTestForDetails] = useState<string | null>(null)
	const [viewMode, setViewMode] = useState<"batch" | "browse">("browse")
	const [globalProfile, setGlobalProfile] = useState<string>("")

	// Helper functions
	const selectAllTests = () => setSelectedTests(new Set(testCases.map((tc) => tc.name)))
	const clearTests = () => setSelectedTests(new Set())
	const selectAllProfiles = () => setSelectedProfiles(new Set(profiles.map((p) => p.name)))
	const clearProfiles = () => setSelectedProfiles(new Set())

	// Set default global profile when profiles load
	if (profiles.length > 0 && !globalProfile) {
		setGlobalProfile(profiles[0].name)
	}

	const handleTestToggle = (testName: string) => {
		if (viewMode === "browse") {
			// In browse mode: single-select for detail viewing
			console.log("🔍 Browse mode: Selecting test for details:", testName)
			setSelectedTestForDetails(testName)
			getTestDetails(testName)
		} else {
			// In batch mode: multi-select for execution
			console.log("📊 Batch mode: Toggling test selection:", testName)
			const newSelected = new Set(selectedTests)
			if (newSelected.has(testName)) {
				newSelected.delete(testName)
			} else {
				newSelected.add(testName)
			}
			setSelectedTests(newSelected)
		}
	}

	const handleProfileToggle = (profileName: string) => {
		const newSelected = new Set(selectedProfiles)
		if (newSelected.has(profileName)) {
			newSelected.delete(profileName)
		} else {
			newSelected.add(profileName)
		}
		setSelectedProfiles(newSelected)
	}

	const executeMatrix = () => {
		if (selectedTests.size === 0 || selectedProfiles.size === 0) {
			alert("Please select at least one test and one profile")
			return
		}
		runMatrix(Array.from(selectedTests), Array.from(selectedProfiles))
	}

	const isExecuting = runningTests.size > 0

	// Calculate scores
	const getTestScore = (testName: string) => {
		let passed = 0
		let total = 0
		for (const profileName of selectedProfiles) {
			const result = testResults.get(`${testName}-${profileName}`)
			if (result) {
				total++
				if (result.passed) passed++
			}
		}
		return total > 0 ? { passed, total, rate: Math.round((passed / total) * 100) } : null
	}

	const getProfileScore = (profileName: string) => {
		let passed = 0
		let total = 0
		for (const testName of selectedTests) {
			const result = testResults.get(`${testName}-${profileName}`)
			if (result) {
				total++
				if (result.passed) passed++
			}
		}
		return total > 0 ? { passed, total, rate: Math.round((passed / total) * 100) } : null
	}

	const getGlobalScore = () => {
		let passed = 0
		let total = 0
		for (const result of testResults.values()) {
			total++
			if (result.passed) passed++
		}
		return total > 0 ? Math.round((passed / total) * 100) : 0
	}

	return (
		<div className="h-screen flex bg-gray-50">
			{/* Header */}
			<div className="absolute top-0 left-0 right-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
				<div className="flex items-center justify-between">
					<div className="flex items-center space-x-4">
						<h1 className="text-xl font-bold text-gray-900">Ghost Benchmarks</h1>
						<div className="flex items-center space-x-2">
							<div className={`w-2 h-2 rounded-full ${connected ? "bg-green-500" : "bg-red-500"}`}></div>
							<span className="text-sm text-gray-500">{connected ? "Connected" : "Disconnected"}</span>
						</div>
					</div>

					<div className="flex items-center space-x-4">
						{/* View Mode Toggle */}
						{viewMode === "browse" ? (
							<button
								onClick={() => setViewMode("batch")}
								className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">
								📊 Build Batch Run
							</button>
						) : (
							<button
								onClick={() => setViewMode("browse")}
								className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-medium rounded-md transition-colors">
								← Cancel Batch
							</button>
						)}

						{/* Profile Selector for Browse Mode */}
						{viewMode === "browse" && profiles.length > 0 && (
							<div className="flex items-center space-x-2">
								<span className="text-sm text-gray-600">Profile:</span>
								<select
									value={globalProfile}
									onChange={(e) => setGlobalProfile(e.target.value)}
									className="px-2 py-1 text-xs border border-gray-300 rounded bg-white">
									{profiles.map((profile) => (
										<option key={profile.name} value={profile.name}>
											{profile.name}
										</option>
									))}
								</select>
							</div>
						)}

						{/* Profile Selector for Batch Mode */}
						{viewMode === "batch" && profiles.length > 0 && (
							<div className="flex items-center space-x-2">
								<span className="text-sm text-gray-600">Profiles:</span>
								<div className="flex space-x-1">
									{profiles.map((profile) => (
										<label
											key={profile.name}
											className={`px-2 py-1 text-xs rounded cursor-pointer transition-colors ${
												selectedProfiles.has(profile.name)
													? "bg-blue-100 text-blue-700"
													: "bg-gray-100 text-gray-600 hover:bg-gray-200"
											}`}>
											<input
												type="checkbox"
												checked={selectedProfiles.has(profile.name)}
												onChange={() => handleProfileToggle(profile.name)}
												className="mr-1"
											/>
											{profile.name}
										</label>
									))}
								</div>
							</div>
						)}

						<div className="text-sm text-gray-600">
							Global Score: <span className="font-bold text-lg">{getGlobalScore()}%</span>
						</div>
						{isExecuting && (
							<div className="flex items-center space-x-2">
								<div className="w-32 bg-gray-200 rounded-full h-2">
									<div
										className="bg-blue-500 h-2 rounded-full transition-all duration-300"
										style={{ width: `${globalProgress}%` }}></div>
								</div>
								<span className="text-sm text-gray-600">{Math.round(globalProgress)}%</span>
							</div>
						)}
						<button
							onClick={refreshData}
							className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded border">
							🔄 Refresh
						</button>
					</div>
				</div>
			</div>

			{/* Sidebar */}
			<div className="w-80 bg-white border-r border-gray-200 pt-20 flex flex-col">
				<div className="p-4 flex-1 flex flex-col">
					{/* Test Cases Section - Full Height */}
					<div className="flex-1 flex flex-col">
						<div className="flex items-center justify-between mb-3">
							<h3 className="font-semibold text-gray-900">📋 Test Cases ({testCases.length})</h3>
							<div className="space-x-1">
								<button
									onClick={selectAllTests}
									className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 rounded">
									All
								</button>
								<button
									onClick={clearTests}
									className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded">
									Clear
								</button>
							</div>
						</div>

						<div className="space-y-1 flex-1 overflow-y-auto">
							{testCases.map((testCase) => {
								const score = getTestScore(testCase.name)
								const isSelected =
									viewMode === "browse"
										? selectedTestForDetails === testCase.name
										: selectedTests.has(testCase.name)

								return (
									<div
										key={testCase.name}
										onClick={() => handleTestToggle(testCase.name)}
										className={`flex items-center space-x-2 px-3 py-2 cursor-pointer transition-colors ${
											isSelected
												? viewMode === "browse"
													? "bg-blue-50 border-l-2 border-blue-400"
													: "bg-gray-50"
												: "hover:bg-gray-50"
										}`}>
										{viewMode === "batch" && (
											<input
												type="checkbox"
												checked={selectedTests.has(testCase.name)}
												onChange={() => handleTestToggle(testCase.name)}
												className="flex-shrink-0"
												onClick={(e) => e.stopPropagation()}
											/>
										)}
										<div className="flex-1 min-w-0">
											<div className="flex items-center justify-between">
												<span className="text-sm font-medium text-gray-900 truncate">
													{testCase.name}
												</span>
												{score && (
													<span
														className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
															score.rate === 100
																? "bg-green-100 text-green-700"
																: score.rate >= 50
																	? "bg-yellow-100 text-yellow-700"
																	: "bg-red-100 text-red-700"
														}`}>
														{score.passed}/{score.total}
													</span>
												)}
											</div>
											<p className="text-xs text-gray-500 truncate">{testCase.description}</p>
										</div>
									</div>
								)
							})}
						</div>
					</div>

					{/* Execution Controls - Only show in batch mode */}
					{viewMode === "batch" && (
						<div className="border-t border-gray-200 pt-4 mt-4">
							<h3 className="font-semibold text-gray-900 mb-3">⚡ Execution</h3>

							<div className="space-y-3">
								<div className="text-xs text-gray-500">
									Selected: {selectedTests.size} tests × {selectedProfiles.size} profiles ={" "}
									{selectedTests.size * selectedProfiles.size} combinations
								</div>

								<button
									onClick={executeMatrix}
									disabled={selectedTests.size === 0 || selectedProfiles.size === 0 || isExecuting}
									className={`w-full py-2 px-4 rounded-md text-sm font-medium ${
										isExecuting
											? "bg-gray-100 text-gray-400 cursor-not-allowed"
											: selectedTests.size === 0 || selectedProfiles.size === 0
												? "bg-gray-100 text-gray-400 cursor-not-allowed"
												: "bg-blue-600 hover:bg-blue-700 text-white"
									}`}>
									{isExecuting
										? "⏳ Running..."
										: `▶️ Execute Matrix (${selectedTests.size} × ${selectedProfiles.size})`}
								</button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Main Content */}
			<div className="flex-1 pt-20 p-6 overflow-y-auto">
				<div className="max-w-7xl mx-auto">
					<div className="mb-6">
						<h2 className="text-2xl font-bold text-gray-900">
							{viewMode === "browse" ? "Ghost Benchmarks" : "Batch Matrix Execution"}
						</h2>
						<p className="text-gray-600">
							{viewMode === "browse"
								? "Browse and examine individual test cases in detail"
								: "Execute multiple tests across selected profiles"}
						</p>
					</div>

					{viewMode === "browse" ? (
						<TestDetailViewer
							testDetails={selectedTestDetails}
							globalProfile={globalProfile}
							profiles={profiles}
							testResults={testResults}
							runningTests={runningTests}
							onRunTest={(testName, profile) => runTest(testName, profile)}
							onClose={() => {
								setSelectedTestForDetails(null)
							}}
						/>
					) : selectedTests.size > 0 && selectedProfiles.size > 0 ? (
						<div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
							<div className="overflow-x-auto">
								<table className="w-full">
									<thead className="bg-gray-50">
										<tr>
											<th className="px-4 py-3 text-left text-sm font-medium text-gray-900 border-b border-gray-200">
												Test Case
											</th>
											{Array.from(selectedProfiles).map((profileName) => {
												const score = getProfileScore(profileName)
												return (
													<th
														key={profileName}
														className="px-4 py-3 text-center text-sm font-medium text-gray-900 border-b border-gray-200 min-w-32">
														<div>
															<div className="font-semibold">{profileName}</div>
															{score && (
																<div className="text-xs text-gray-500 font-normal">
																	{score.passed}/{score.total} ({score.rate}%)
																</div>
															)}
														</div>
													</th>
												)
											})}
											<th className="px-4 py-3 text-center text-sm font-medium text-gray-900 border-b border-gray-200">
												Test Score
											</th>
										</tr>
									</thead>
									<tbody>
										{Array.from(selectedTests).map((testName) => {
											const testScore = getTestScore(testName)
											return (
												<tr key={testName} className="hover:bg-gray-50">
													<td className="px-4 py-3 border-b border-gray-200">
														<div>
															<div className="font-medium text-gray-900">{testName}</div>
															{testScore && (
																<div className="text-xs text-gray-500">
																	{testScore.passed}/{testScore.total} (
																	{testScore.rate}%)
																</div>
															)}
														</div>
													</td>
													{Array.from(selectedProfiles).map((profileName) => {
														const key = `${testName}-${profileName}`
														const result = testResults.get(key)
														const isRunning = runningTests.has(key)

														return (
															<td
																key={profileName}
																className="px-2 py-3 border-b border-gray-200">
																<div
																	className={`p-3 rounded text-center text-sm transition-all ${
																		isRunning
																			? "bg-yellow-100 text-yellow-800 animate-pulse"
																			: result?.passed === true
																				? "bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer"
																				: result?.passed === false
																					? "bg-red-100 text-red-800 hover:bg-red-200 cursor-pointer"
																					: "bg-gray-100 text-gray-500"
																	}`}>
																	{isRunning ? (
																		<div>⏳ Running...</div>
																	) : result ? (
																		<div className="space-y-1">
																			<div className="font-bold">
																				{result.passed ? "✅ PASS" : "❌ FAIL"}
																			</div>
																			{result.executionTime && (
																				<div className="text-xs">
																					{result.executionTime}ms
																				</div>
																			)}
																			{result.groups && (
																				<div className="text-xs">
																					{result.groups} groups
																				</div>
																			)}
																		</div>
																	) : (
																		<div className="text-gray-400">—</div>
																	)}
																</div>
															</td>
														)
													})}
													<td className="px-4 py-3 border-b border-gray-200 text-center">
														{testScore ? (
															<span
																className={`px-2 py-1 rounded text-xs font-medium ${
																	testScore.rate === 100
																		? "bg-green-100 text-green-700"
																		: testScore.rate >= 50
																			? "bg-yellow-100 text-yellow-700"
																			: "bg-red-100 text-red-700"
																}`}>
																{testScore.rate}%
															</span>
														) : (
															<span className="text-gray-400">—</span>
														)}
													</td>
												</tr>
											)
										})}
									</tbody>
									<tfoot className="bg-gray-50">
										<tr>
											<td className="px-4 py-3 font-medium text-gray-900 border-t border-gray-200">
												Global Score
											</td>
											{Array.from(selectedProfiles).map((profileName) => {
												const score = getProfileScore(profileName)
												return (
													<td
														key={profileName}
														className="px-4 py-3 text-center border-t border-gray-200">
														{score ? (
															<span
																className={`px-2 py-1 rounded text-sm font-medium ${
																	score.rate === 100
																		? "bg-green-100 text-green-700"
																		: score.rate >= 50
																			? "bg-yellow-100 text-yellow-700"
																			: "bg-red-100 text-red-700"
																}`}>
																{score.rate}%
															</span>
														) : (
															<span className="text-gray-400">—</span>
														)}
													</td>
												)
											})}
											<td className="px-4 py-3 text-center border-t border-gray-200">
												<button className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded border">
													📊 Export
												</button>
											</td>
										</tr>
									</tfoot>
								</table>
							</div>
						</div>
					) : (
						<div className="bg-white shadow-sm border border-gray-200 rounded-lg p-8 text-center">
							<div className="text-gray-400 mb-4">
								<div className="text-4xl mb-2">🎯</div>
								<h3 className="text-lg font-medium text-gray-900">Select Tests and Profiles</h3>
								<p className="text-gray-500">
									Choose test cases and profiles from the sidebar to start benchmarking
								</p>
							</div>

							<div className="space-y-2 text-sm text-gray-600">
								<div>📋 {testCases.length} test cases available</div>
								<div>🤖 {profiles.length} profiles available</div>
								<div>🔌 WebSocket: {connected ? "Connected" : "Disconnected"}</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
