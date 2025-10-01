import { createServer } from "http"
import { parse } from "url"
import next from "next"
import { Server } from "socket.io"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import chokidar from "chokidar"
import dotenv from "dotenv"
import { spawn } from "child_process"

// Load environment variables
dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const dev = process.env.NODE_ENV !== "production"
const port = process.env.PORT || 3004
const hostname = "localhost"

const app = next({ dev, hostname, port })
const handler = app.getRequestHandler()

// Paths to our file-based system - use the ghost-benchmarks package test cases
const TEST_CASES_DIR = path.join(__dirname, "../../packages/ghost-benchmarks/test-cases")
const PROFILES_CONFIG = path.join(__dirname, "profiles.json")

// Dynamic test case discovery
function loadTestCasesFromFileSystem() {
	try {
		const testCases = []
		const testDirs = fs
			.readdirSync(TEST_CASES_DIR, { withFileTypes: true })
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name)

		for (const testDir of testDirs) {
			const metadataPath = path.join(TEST_CASES_DIR, testDir, "metadata.json")
			if (fs.existsSync(metadataPath)) {
				const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"))
				testCases.push({
					id: metadata.name, // Use name as ID for consistency
					name: metadata.name,
					category: metadata.category,
					description: metadata.description,
					expectedGroupCount: metadata.expectedGroupCount,
					shouldCompile: metadata.shouldCompile,
					hasLiveModeSupport: metadata.hasLiveModeSupport !== false,
					supportedProfiles: metadata.supportedProfiles || ["mercury-coder"],
					filePath: testDir,
					// Autocomplete-specific fields
					cursorPosition: metadata.cursorPosition,
					expectedPatterns: metadata.expectedPatterns,
					isAutocompleteTest: metadata.isAutocompleteTest || false,
				})
			}
		}

		console.log(`📋 Loaded ${testCases.length} test cases from file system`)
		return testCases
	} catch (error) {
		console.error("Failed to load test cases:", error)
		return []
	}
}

// Load profiles from configuration file
function loadProfiles() {
	try {
		if (fs.existsSync(PROFILES_CONFIG)) {
			const profiles = JSON.parse(fs.readFileSync(PROFILES_CONFIG, "utf8"))
			console.log(`🤖 Loaded ${profiles.length} profiles from configuration`)
			return profiles
		} else {
			// Create default profiles file if it doesn't exist
			const defaultProfiles = [
				{
					name: "mercury-coder",
					model: "inception/mercury-coder",
					description: "Mercury Coder - Specialized code completion",
					provider: "openrouter",
				},
				{
					name: "gpt4o-mini",
					model: "openai/gpt-4o-mini",
					description: "GPT-4o Mini - Fast and cost-effective",
					provider: "openrouter",
				},
				{
					name: "claude-sonnet",
					model: "anthropic/claude-3.5-sonnet",
					description: "Claude 3.5 Sonnet - High quality reasoning",
					provider: "openrouter",
				},
				{
					name: "codestral",
					model: "mistralai/codestral-latest",
					description: "Codestral - Specialized for code generation",
					provider: "openrouter",
				},
			]
			fs.writeFileSync(PROFILES_CONFIG, JSON.stringify(defaultProfiles, null, 2))
			console.log(`🤖 Created default profiles configuration at ${PROFILES_CONFIG}`)
			return defaultProfiles
		}
	} catch (error) {
		console.error("Failed to load profiles:", error)
		return []
	}
}

// Real test execution using the CLI package
async function executeTest(testName, profile) {
	return new Promise((resolve) => {
		console.log(`🧪 Executing ${testName} with ${profile} (live mode)`)

		// Use the built CLI binary (with correct path and options)
		const cliProcess = spawn('node', ['dist/benchmark-cli.cjs', '--tests', testName, '--profile', profile, '--format', 'json'], {
			cwd: path.join(__dirname, '../../packages/ghost-benchmarks'),
			env: {
				...process.env,
				OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
			},
			stdio: ['pipe', 'pipe', 'pipe']
		})

		let stderr = ''

		cliProcess.stderr.on('data', (data) => {
			stderr += data.toString()
		})

		cliProcess.on('close', (code) => {
			console.log(`🔍 CLI finished with exit code: ${code}`)

			if (code === 0) {
				try {
					// Read results from the latest.json file that CLI auto-saves
					const latestResultsPath = path.join(__dirname, '../../packages/ghost-benchmarks/results/latest.json')

					if (!fs.existsSync(latestResultsPath)) {
						throw new Error('Latest results file not found - CLI may not have saved results')
					}

					const resultData = fs.readFileSync(latestResultsPath, 'utf-8')
					const benchmarkRun = JSON.parse(resultData)
					const result = benchmarkRun.summary

					console.log('✅ CLI test execution successful - read from JSON file')
					console.log('🔍 CLI Summary structure:', {
						totalTests: result.totalTests,
						passedTests: result.passedTests,
						failedTests: result.failedTests,
						resultsCount: result.results?.length || 0
					})

					// Transform CLI result to web format
					// Find the specific test result from the CLI results
					const testResult = result.results?.find(r => r.testCase?.metadata?.name === testName)
					console.log('🔍 Found test result:', !!testResult)
					if (testResult) {
						console.log('🔍 Test result structure:', {
							passed: testResult.passed,
							executionTime: testResult.executionTime,
							hasSuggestions: !!testResult.suggestions,
							suggestionsType: typeof testResult.suggestions,
							finalFileContent: !!testResult.finalFileContent,
							rawResponse: !!testResult.rawResponse
						})
						if (testResult.suggestions) {
							console.log('🔍 Suggestions structure:', {
								type: typeof testResult.suggestions,
								keys: Object.keys(testResult.suggestions),
								hasSuggestionsArray: !!testResult.suggestions.suggestions,
								suggestionsLength: testResult.suggestions.suggestions?.length || 0
							})
						}
					}

					const webResult = {
						success: result.passedTests > 0 && result.failedTests === 0,
						testName,
						profile,
						mode: 'live',
						passed: testResult?.passed || false,
						executionTime: testResult?.executionTime || result.averageExecutionTime || 0,
						groups: testResult?.suggestions?.suggestions?.length || 0,
						selectedGroup: 0,
						suggestions: testResult?.suggestions || null,
						finalFileContent: testResult?.finalFileContent || null,
						rawResponse: testResult?.rawResponse || null,
						metrics: testResult?.metrics || null,
						error: testResult?.error || result.errors?.find(e => e.testName === testName)?.error,
					}

					console.log(`📝 Transformed result: passed=${webResult.passed}, time=${webResult.executionTime}ms`)
					console.log(`📄 Final content available: ${!!webResult.finalFileContent}`)
					console.log(`🧪 Suggestions available: ${webResult.suggestions ? 'YES' : 'NO'}`)
					if (webResult.suggestions) {
						console.log(`🧪 Suggestions content sample:`, JSON.stringify(webResult.suggestions).substring(0, 200) + '...')
					}

					resolve(webResult)
				} catch (parseError) {
					console.log('❌ Failed to read CLI result from JSON file:', parseError)
					resolve({
						success: false,
						testName,
						profile,
						mode: 'live',
						passed: false,
						error: `Failed to read results: ${parseError.message}`,
						executionTime: 0
					})
				}
			} else {
				console.log(`❌ CLI execution failed with code: ${code}`)
				resolve({
					success: false,
					testName,
					profile,
					mode: 'live',
					passed: false,
					error: `CLI exit code ${code}. stderr: ${stderr.substring(0, 200)}...`,
					executionTime: 0
				})
			}
		})

		// Timeout after 30 seconds
		setTimeout(() => {
			if (!cliProcess.killed) {
				cliProcess.kill('SIGTERM')
				resolve({
					success: false,
					testName,
					profile,
					mode: 'live',
					passed: false,
					error: 'Test execution timed out after 30 seconds',
					executionTime: 0
				})
			}
		}, 30000)
	})
}

app.prepare().then(() => {
	const server = createServer(handler)
	const io = new Server(server)

	// Load data from file system on startup
	let testCases = loadTestCasesFromFileSystem()
	let profiles = loadProfiles()

	// Set up file watching with Chokidar for auto-refresh
	const watcher = chokidar.watch([TEST_CASES_DIR, PROFILES_CONFIG], {
		ignored: /node_modules/,
		persistent: true,
		ignoreInitial: true
	})

	watcher.on('all', (event, filePath) => {
		console.log(`📁 File ${event}: ${filePath}`)

		// Reload data from file system
		testCases = loadTestCasesFromFileSystem()
		profiles = loadProfiles()

		// Broadcast updated data to all connected clients
		io.emit('test-cases', testCases)
		io.emit('profiles', profiles)

		console.log(`🔄 Auto-refreshed: ${testCases.length} test cases, ${profiles.length} profiles`)
	})

	io.on("connection", (socket) => {
		console.log("Client connected:", socket.id)

		// Send initial data (dynamically loaded)
		socket.emit("test-cases", testCases)
		socket.emit("profiles", profiles)

		// Handle single test execution
		socket.on("run-test", async (data) => {
			const { testName, profile } = data

			socket.emit("test-progress", { testName, profile, progress: 0 })

			try {
				const result = await executeTest(testName, profile)
				socket.emit("test-result", result)
			} catch (error) {
				socket.emit("test-result", {
					success: false,
					testName,
					profile,
					mode: 'live',
					passed: false,
					error: error.message,
					executionTime: 0
				})
			}
		})

		// Handle matrix execution
		socket.on("run-matrix", async (data) => {
			const { tests, profiles: selectedProfiles } = data
			const totalCombinations = tests.length * selectedProfiles.length
			let completed = 0

			console.log(
				`🔄 Starting matrix execution: ${tests.length} tests × ${selectedProfiles.length} profiles = ${totalCombinations} combinations`,
			)

			const results = []

			for (const testName of tests) {
				for (const profileName of selectedProfiles) {
					socket.emit("test-progress", {
						testName,
						profile: profileName,
						progress: Math.round((completed / totalCombinations) * 100),
					})

					try {
						const result = await executeTest(testName, profileName)
						results.push(result)
						socket.emit("test-result", result)
					} catch (error) {
						const errorResult = {
							success: false,
							testName,
							profile: profileName,
							mode: 'live',
							passed: false,
							error: error.message,
							executionTime: 0
						}
						results.push(errorResult)
						socket.emit("test-result", errorResult)
					}

					completed++
				}
			}

			socket.emit("matrix-complete", { results, totalCombinations })
			console.log(`✅ Matrix execution complete: ${results.length} results`)
		})

		// Handle test details requests (load actual test files)
		socket.on("get-test-details", (data) => {
			const { testName } = data
			console.log(`📄 Loading test details for: ${testName}`)

			try {
				const testDir = path.join(TEST_CASES_DIR, testName)
				if (!fs.existsSync(testDir)) {
					throw new Error(`Test directory not found: ${testName}`)
				}

				// Load metadata
				const metadataPath = path.join(testDir, "metadata.json")
				const metadata = fs.existsSync(metadataPath) ? JSON.parse(fs.readFileSync(metadataPath, "utf8")) : {}

				// Load input files (src directory)
				const srcDir = path.join(testDir, "src")
				const inputFiles = {}
				let activeFile = ""
				let cursorPosition = { line: 0, character: 0 }

				if (fs.existsSync(srcDir)) {
					const srcFiles = fs.readdirSync(srcDir)
					for (const fileName of srcFiles) {
						const filePath = path.join(srcDir, fileName)
						if (fs.statSync(filePath).isFile()) {
							let content = fs.readFileSync(filePath, "utf8")

							// Find cursor position and clean content
							const cursorMarker = "␣" // U+2423 OPEN BOX
							console.log(`🔍 Checking file ${fileName} for cursor marker...`)
							console.log(`📄 Content includes cursor marker: ${content.includes(cursorMarker)}`)

							if (content.includes(cursorMarker)) {
								activeFile = fileName
								const lines = content.split("\n")
								console.log(`📍 Found cursor marker in ${fileName}, scanning ${lines.length} lines...`)

								for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
									const line = lines[lineIndex]
									const markerIndex = line.indexOf(cursorMarker)
									if (markerIndex !== -1) {
										cursorPosition = { line: lineIndex, character: markerIndex }
										console.log(`✅ Cursor found at line ${lineIndex}, character ${markerIndex}`)
										// Remove cursor marker from content
										content = content.replace(cursorMarker, "")
										break
									}
								}
							} else {
								console.log(`ℹ️ No cursor marker found in ${fileName}`)
							}
							inputFiles[fileName] = content
						}
					}
				}

				// Load expected files (expected directory)
				const expectedDir = path.join(testDir, "expected")
				const expectedFiles = {}

				if (fs.existsSync(expectedDir)) {
					const expectedFilesList = fs.readdirSync(expectedDir)
					for (const fileName of expectedFilesList) {
						const filePath = path.join(expectedDir, fileName)
						if (fs.statSync(filePath).isFile()) {
							expectedFiles[fileName] = fs.readFileSync(filePath, "utf8")
						}
					}
				}

				// If no active file detected, use first input file
				if (!activeFile && Object.keys(inputFiles).length > 0) {
					activeFile = Object.keys(inputFiles)[0]
				}

				const testDetails = {
					testName,
					inputFiles,
					expectedFiles,
					activeFile,
					cursorPosition,
					metadata,
				}

				socket.emit("test-details", testDetails)
				console.log(
					`✅ Test details sent for: ${testName} (${Object.keys(inputFiles).length} input files, ${Object.keys(expectedFiles).length} expected files)`,
				)
			} catch (error) {
				console.error(`❌ Failed to load test details for ${testName}:`, error)
				socket.emit("test-details", {
					testName,
					inputFiles: {},
					expectedFiles: {},
					activeFile: "",
					cursorPosition: { line: 0, character: 0 },
					metadata: {},
					error: error.message,
				})
			}
		})

		// Handle refresh requests (reload from file system)
		socket.on("refresh-data", () => {
			const refreshedTestCases = loadTestCasesFromFileSystem()
			const refreshedProfiles = loadProfiles()
			socket.emit("test-cases", refreshedTestCases)
			socket.emit("profiles", refreshedProfiles)
		})

		socket.on("disconnect", () => {
			console.log("Client disconnected:", socket.id)
		})
	})

	server.listen(port, (err) => {
		if (err) throw err
		console.log(`🚀 Ghost Benchmarks Web Interface ready!`)
		console.log(`📊 Dashboard: http://${hostname}:${port}`)
		console.log(`📁 Test Cases: ${testCases.length} loaded from ${TEST_CASES_DIR}`)
		console.log(`🤖 Profiles: ${profiles.length} loaded from ${PROFILES_CONFIG}`)
	})
})
