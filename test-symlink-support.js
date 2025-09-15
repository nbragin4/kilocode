#!/usr/bin/env node

const fs = require("fs/promises")
const path = require("path")

/**
 * Simple readDirectory implementation to test symlink support
 */
async function readDirectory(directoryPath, excludedPaths = []) {
	const visitedPaths = new Set()
	const allFilePaths = []

	async function processEntry(entry, parentPath) {
		const fullPath = path.resolve(parentPath, entry.name)

		// Skip OS-generated files
		if ([".DS_Store", "Thumbs.db", "desktop.ini"].includes(entry.name)) {
			return
		}

		// Check if we've already visited this path (cycle detection)
		const normalizedPath = path.normalize(fullPath)
		if (visitedPaths.has(normalizedPath)) {
			return
		}
		visitedPaths.add(normalizedPath)

		if (entry.isFile()) {
			allFilePaths.push(fullPath)
		} else if (entry.isSymbolicLink()) {
			try {
				const linkTarget = await fs.readlink(fullPath)
				const resolvedTarget = path.isAbsolute(linkTarget)
					? linkTarget
					: path.resolve(path.dirname(fullPath), linkTarget)

				const normalizedTarget = path.normalize(resolvedTarget)
				if (visitedPaths.has(normalizedTarget)) {
					return
				}

				const fullyResolvedTarget = await fs.realpath(resolvedTarget)
				const normalizedFullyResolved = path.normalize(fullyResolvedTarget)

				if (visitedPaths.has(normalizedFullyResolved)) {
					return
				}

				const targetStats = await fs.stat(fullyResolvedTarget)

				if (targetStats.isFile()) {
					allFilePaths.push(fullyResolvedTarget)
					visitedPaths.add(normalizedFullyResolved)
					visitedPaths.add(normalizedTarget)
				} else if (targetStats.isDirectory()) {
					visitedPaths.add(normalizedFullyResolved)
					visitedPaths.add(normalizedTarget)
					const dirEntries = await fs.readdir(fullyResolvedTarget, { withFileTypes: true })
					await Promise.all(dirEntries.map((dirEntry) => processEntry(dirEntry, fullyResolvedTarget)))
				}
			} catch (err) {
				// Silently skip broken symlinks or permission errors
			}
		} else if (entry.isDirectory()) {
			const dirEntries = await fs.readdir(fullPath, { withFileTypes: true })
			await Promise.all(dirEntries.map((dirEntry) => processEntry(dirEntry, fullPath)))
		}
	}

	const rootEntries = await fs.readdir(directoryPath, { withFileTypes: true })
	await Promise.all(rootEntries.map((entry) => processEntry(entry, directoryPath)))

	return allFilePaths
}

async function testSymlinkSupport() {
	const testDir = path.join(__dirname, "symlink-test-demo")

	console.log("🧪 Testing Symlink Support for Workflows and Rules\n")
	console.log("=".repeat(50))

	try {
		// Clean up any existing test directory
		await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})

		// Create test structure
		console.log("\n📁 Creating test directory structure...")
		await fs.mkdir(testDir, { recursive: true })

		// Create .kilocode directories
		const kilocodeDir = path.join(testDir, ".kilocode")
		const workflowsDir = path.join(kilocodeDir, "workflows")
		const rulesDir = path.join(kilocodeDir, "rules")
		await fs.mkdir(workflowsDir, { recursive: true })
		await fs.mkdir(rulesDir, { recursive: true })

		// Create shared resources outside .kilocode
		const sharedDir = path.join(testDir, "shared-resources")
		await fs.mkdir(sharedDir, { recursive: true })

		// Create shared workflow files
		const sharedWorkflowsDir = path.join(sharedDir, "workflows")
		await fs.mkdir(sharedWorkflowsDir)
		await fs.writeFile(
			path.join(sharedWorkflowsDir, "ci-cd.yaml"),
			"name: CI/CD Pipeline\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest",
		)
		await fs.writeFile(
			path.join(sharedWorkflowsDir, "deploy.yaml"),
			"name: Deploy\non: release\njobs:\n  deploy:\n    runs-on: ubuntu-latest",
		)

		// Create shared rules
		const sharedRulesDir = path.join(sharedDir, "rules")
		await fs.mkdir(sharedRulesDir)
		await fs.writeFile(
			path.join(sharedRulesDir, "code-standards.md"),
			"# Code Standards\n- Use TypeScript\n- Follow ESLint rules\n- Write tests",
		)
		await fs.writeFile(
			path.join(sharedRulesDir, "security.md"),
			"# Security Guidelines\n- No hardcoded secrets\n- Use environment variables\n- Regular dependency updates",
		)

		// Create mode-specific rules
		const codeRulesDir = path.join(sharedDir, "mode-rules-code")
		await fs.mkdir(codeRulesDir)
		await fs.writeFile(
			path.join(codeRulesDir, "coding-practices.md"),
			"# Coding Practices\n- Functional programming preferred\n- Immutable data structures",
		)

		// Create symlinks
		console.log("\n🔗 Creating symlinks...")

		// Link entire shared workflows directory
		await fs.symlink(sharedWorkflowsDir, path.join(workflowsDir, "shared"))
		console.log("  ✓ Linked shared workflows directory")

		// Link individual rule files
		await fs.symlink(path.join(sharedRulesDir, "code-standards.md"), path.join(rulesDir, "code-standards.md"))
		console.log("  ✓ Linked code-standards.md")

		await fs.symlink(path.join(sharedRulesDir, "security.md"), path.join(rulesDir, "security.md"))
		console.log("  ✓ Linked security.md")

		// Link mode-specific rules directory
		await fs.symlink(codeRulesDir, path.join(rulesDir, "rules-code"))
		console.log("  ✓ Linked mode-specific rules directory")

		// Add local files
		await fs.writeFile(
			path.join(workflowsDir, "local-workflow.yaml"),
			"name: Local Workflow\non: workflow_dispatch",
		)
		await fs.writeFile(
			path.join(rulesDir, "project-specific.md"),
			"# Project Specific Rules\n- Use pnpm for package management",
		)

		// Test reading with readDirectory
		console.log("\n📖 Reading directories with symlink support...\n")

		console.log("Workflows (.kilocode/workflows):")
		console.log("-".repeat(30))
		const workflowFiles = await readDirectory(workflowsDir)
		for (const file of workflowFiles) {
			const relativePath = path.relative(testDir, file)
			const content = await fs.readFile(file, "utf-8")
			const firstLine = content.split("\n")[0]
			console.log(`  📄 ${relativePath}`)
			console.log(`     Content: ${firstLine}`)
		}

		console.log("\nRules (.kilocode/rules):")
		console.log("-".repeat(30))
		const ruleFiles = await readDirectory(rulesDir)
		for (const file of ruleFiles) {
			const relativePath = path.relative(testDir, file)
			const content = await fs.readFile(file, "utf-8")
			const firstLine = content.split("\n")[0]
			console.log(`  📄 ${relativePath}`)
			console.log(`     Content: ${firstLine}`)
		}

		// Summary
		console.log("\n" + "=".repeat(50))
		console.log("✅ Test Summary:")
		console.log(`  • Found ${workflowFiles.length} workflow files (2 via directory symlink, 1 local)`)
		console.log(`  • Found ${ruleFiles.length} rule files (2 via file symlinks, 1 via directory symlink, 1 local)`)
		console.log("  • All symlinks resolved correctly")
		console.log("  • Content accessible through symlinks")

		// Verification
		console.log("\n🔍 Verifying symlink functionality:")

		// Check that we found the expected files
		const expectedWorkflows = ["ci-cd.yaml", "deploy.yaml", "local-workflow.yaml"]
		const expectedRules = ["code-standards.md", "security.md", "coding-practices.md", "project-specific.md"]

		let allWorkflowsFound = true
		for (const expected of expectedWorkflows) {
			const found = workflowFiles.some((f) => f.endsWith(expected))
			console.log(`  ${found ? "✓" : "✗"} Found ${expected}`)
			if (!found) allWorkflowsFound = false
		}

		let allRulesFound = true
		for (const expected of expectedRules) {
			const found = ruleFiles.some((f) => f.endsWith(expected))
			console.log(`  ${found ? "✓" : "✗"} Found ${expected}`)
			if (!found) allRulesFound = false
		}

		if (!allWorkflowsFound || !allRulesFound) {
			throw new Error("Not all expected files were found through symlinks")
		}

		// Clean up
		console.log("\n🧹 Cleaning up test directory...")
		await fs.rm(testDir, { recursive: true, force: true })
		console.log("✓ Test directory removed")

		console.log("\n🎉 Symlink support test completed successfully!")
		console.log("   Symlinks work correctly for both workflows and rules directories.")
	} catch (error) {
		console.error("\n❌ Test failed:", error.message)
		// Try to clean up even on failure
		await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
		process.exit(1)
	}
}

// Run the test
testSymlinkSupport().catch(console.error)
