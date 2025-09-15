import { describe, it, expect, beforeEach, afterEach } from "vitest"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"
import { readDirectory, fileExistsAtPath, isDirectory } from "../fs"

describe("Symlink Support in readDirectory", () => {
	let testDir: string
	let workflowsDir: string
	let rulesDir: string

	beforeEach(async () => {
		// Create a unique temporary directory for each test
		testDir = path.join(
			os.tmpdir(),
			`kilocode-symlink-test-${Date.now()}-${Math.random().toString(36).substring(7)}`,
		)
		await fs.mkdir(testDir, { recursive: true })

		// Create .kilocode directory structure
		const kilocodeDir = path.join(testDir, ".kilocode")
		workflowsDir = path.join(kilocodeDir, "workflows")
		rulesDir = path.join(kilocodeDir, "rules")

		await fs.mkdir(kilocodeDir, { recursive: true })
		await fs.mkdir(workflowsDir, { recursive: true })
		await fs.mkdir(rulesDir, { recursive: true })
	})

	afterEach(async () => {
		// Clean up test directory
		try {
			await fs.rm(testDir, { recursive: true, force: true })
		} catch (error) {
			console.warn(`Failed to clean up test directory: ${testDir}`, error)
		}
	})

	describe("Workflows Directory Symlinks", () => {
		it("should follow file symlinks in workflows directory", async () => {
			// Create a workflow file outside the workflows directory
			const externalWorkflow = path.join(testDir, "external-workflow.md")
			await fs.writeFile(externalWorkflow, "# External Workflow\nTest content")

			// Create a symlink to it inside workflows directory
			const symlinkPath = path.join(workflowsDir, "linked-workflow.md")
			await fs.symlink(externalWorkflow, symlinkPath)

			// Read the workflows directory
			const files = await readDirectory(workflowsDir)

			// Should find the external workflow file via symlink
			expect(files).toHaveLength(1)
			// Normalize paths to handle platform differences (e.g., /private prefix on macOS)
			expect(await fs.realpath(files[0])).toBe(await fs.realpath(externalWorkflow))

			// Verify the content is accessible
			const content = await fs.readFile(files[0], "utf-8")
			expect(content).toContain("External Workflow")
		})

		it("should follow directory symlinks in workflows directory", async () => {
			// Create an external directory with workflow files
			const externalDir = path.join(testDir, "external-workflows")
			await fs.mkdir(externalDir)

			const workflow1 = path.join(externalDir, "workflow1.md")
			const workflow2 = path.join(externalDir, "workflow2.yaml")
			await fs.writeFile(workflow1, "# Workflow 1")
			await fs.writeFile(workflow2, "name: Workflow 2")

			// Create a symlink to the directory
			const symlinkDir = path.join(workflowsDir, "linked-workflows")
			await fs.symlink(externalDir, symlinkDir)

			// Read the workflows directory
			const files = await readDirectory(workflowsDir)

			// Should find both workflow files
			expect(files).toHaveLength(2)
			// Normalize paths for comparison
			const normalizedFiles = await Promise.all(files.map((f) => fs.realpath(f)))
			const expectedFiles = await Promise.all([workflow1, workflow2].map((f) => fs.realpath(f)))
			expect(normalizedFiles.sort()).toEqual(expectedFiles.sort())
		})

		it("should handle nested symlinks in workflows", async () => {
			// Create a complex nested structure
			const level1Dir = path.join(testDir, "level1")
			const level2Dir = path.join(testDir, "level2")
			await fs.mkdir(level1Dir)
			await fs.mkdir(level2Dir)

			// Create files at different levels
			const file1 = path.join(level1Dir, "workflow1.md")
			const file2 = path.join(level2Dir, "workflow2.md")
			await fs.writeFile(file1, "# Level 1 Workflow")
			await fs.writeFile(file2, "# Level 2 Workflow")

			// Create symlink from level1 to level2
			const level2Link = path.join(level1Dir, "level2-link")
			await fs.symlink(level2Dir, level2Link)

			// Create symlink from workflows to level1
			const workflowsLink = path.join(workflowsDir, "nested-link")
			await fs.symlink(level1Dir, workflowsLink)

			// Read the workflows directory
			const files = await readDirectory(workflowsDir)

			// Should find both files through nested symlinks
			expect(files).toHaveLength(2)
			// Normalize paths for comparison
			const normalizedFiles = await Promise.all(files.map((f) => fs.realpath(f)))
			const expectedFiles = await Promise.all([file1, file2].map((f) => fs.realpath(f)))
			expect(normalizedFiles.sort()).toEqual(expectedFiles.sort())
		})
	})

	describe("Rules Directory Symlinks", () => {
		it("should follow file symlinks in rules directory", async () => {
			// Create a rule file outside the rules directory
			const externalRule = path.join(testDir, "external-rule.md")
			await fs.writeFile(externalRule, "# External Rule\nAlways use TypeScript")

			// Create a symlink to it inside rules directory
			const symlinkPath = path.join(rulesDir, "linked-rule.md")
			await fs.symlink(externalRule, symlinkPath)

			// Read the rules directory
			const files = await readDirectory(rulesDir)

			// Should find the external rule file via symlink
			expect(files).toHaveLength(1)
			// Normalize paths to handle platform differences
			expect(await fs.realpath(files[0])).toBe(await fs.realpath(externalRule))

			// Verify the content is accessible
			const content = await fs.readFile(files[0], "utf-8")
			expect(content).toContain("External Rule")
		})

		it("should follow directory symlinks in rules directory", async () => {
			// Create an external directory with rule files
			const externalDir = path.join(testDir, "external-rules")
			await fs.mkdir(externalDir)

			const rule1 = path.join(externalDir, "code-style.md")
			const rule2 = path.join(externalDir, "testing.md")
			await fs.writeFile(rule1, "# Code Style Rules")
			await fs.writeFile(rule2, "# Testing Rules")

			// Create a symlink to the directory
			const symlinkDir = path.join(rulesDir, "linked-rules")
			await fs.symlink(externalDir, symlinkDir)

			// Read the rules directory
			const files = await readDirectory(rulesDir)

			// Should find both rule files
			expect(files).toHaveLength(2)
			// Normalize paths for comparison
			const normalizedFiles = await Promise.all(files.map((f) => fs.realpath(f)))
			const expectedFiles = await Promise.all([rule1, rule2].map((f) => fs.realpath(f)))
			expect(normalizedFiles.sort()).toEqual(expectedFiles.sort())
		})

		it("should handle mode-specific rule directories via symlinks", async () => {
			// Create mode-specific rule directories
			const codeRulesDir = path.join(testDir, "code-rules")
			const debugRulesDir = path.join(testDir, "debug-rules")
			await fs.mkdir(codeRulesDir)
			await fs.mkdir(debugRulesDir)

			// Add rules to each directory
			const codeRule = path.join(codeRulesDir, "coding-standards.md")
			const debugRule = path.join(debugRulesDir, "debugging-tips.md")
			await fs.writeFile(codeRule, "# Coding Standards")
			await fs.writeFile(debugRule, "# Debugging Tips")

			// Create symlinks in rules directory
			const codeLink = path.join(rulesDir, "rules-code")
			const debugLink = path.join(rulesDir, "rules-debug")
			await fs.symlink(codeRulesDir, codeLink)
			await fs.symlink(debugRulesDir, debugLink)

			// Read the rules directory
			const files = await readDirectory(rulesDir)

			// Should find both rule files through directory symlinks
			expect(files).toHaveLength(2)
			// Normalize paths for comparison
			const normalizedFiles = await Promise.all(files.map((f) => fs.realpath(f)))
			const expectedFiles = await Promise.all([codeRule, debugRule].map((f) => fs.realpath(f)))
			expect(normalizedFiles.sort()).toEqual(expectedFiles.sort())
		})
	})

	describe("Edge Cases", () => {
		it("should detect and handle circular symlinks", async () => {
			// Create a circular symlink structure
			const dirA = path.join(workflowsDir, "dirA")
			const dirB = path.join(workflowsDir, "dirB")
			await fs.mkdir(dirA)
			await fs.mkdir(dirB)

			// Add a file to dirA
			const fileInA = path.join(dirA, "workflow.md")
			await fs.writeFile(fileInA, "# Workflow in A")

			// Create circular symlinks
			const linkToB = path.join(dirA, "linkToB")
			const linkToA = path.join(dirB, "linkToA")
			await fs.symlink(dirB, linkToB)
			await fs.symlink(dirA, linkToA)

			// This should not cause infinite recursion
			const files = await readDirectory(workflowsDir)

			// Should find the file only once despite circular links
			expect(files).toHaveLength(1)
			expect(files[0]).toBe(fileInA)
		})

		it("should handle broken symlinks gracefully", async () => {
			// Create a valid file and symlink
			const tempFile = path.join(testDir, "temp-workflow.md")
			await fs.writeFile(tempFile, "# Temporary Workflow")

			const symlink1 = path.join(workflowsDir, "valid-link.md")
			await fs.symlink(tempFile, symlink1)

			// Create a broken symlink (pointing to non-existent file)
			const nonExistentFile = path.join(testDir, "non-existent.md")
			const brokenLink = path.join(workflowsDir, "broken-link.md")
			await fs.symlink(nonExistentFile, brokenLink)

			// Add a regular file
			const regularFile = path.join(workflowsDir, "regular.md")
			await fs.writeFile(regularFile, "# Regular Workflow")

			// Now delete the temp file to break the first symlink
			await fs.unlink(tempFile)

			// Read directory should handle broken symlinks gracefully
			const files = await readDirectory(workflowsDir)

			// Should only find the regular file (broken symlinks are skipped)
			expect(files).toHaveLength(1)
			expect(files[0]).toBe(regularFile)
		})

		it("should handle symlinks with relative paths", async () => {
			// Create a file in a sibling directory
			const siblingDir = path.join(testDir, "sibling")
			await fs.mkdir(siblingDir)
			const siblingFile = path.join(siblingDir, "shared-rule.md")
			await fs.writeFile(siblingFile, "# Shared Rule")

			// Create a relative symlink
			const originalCwd = process.cwd()
			try {
				process.chdir(rulesDir)
				const relativePath = path.join("..", "..", "sibling", "shared-rule.md")
				await fs.symlink(relativePath, "relative-link.md")
			} finally {
				process.chdir(originalCwd)
			}

			// Read the rules directory
			const files = await readDirectory(rulesDir)

			// Should resolve the relative symlink correctly
			expect(files).toHaveLength(1)
			// Normalize paths to handle platform differences
			expect(await fs.realpath(files[0])).toBe(await fs.realpath(siblingFile))
		})

		it("should handle symlinks to symlinks", async () => {
			// Create a chain of symlinks
			const actualFile = path.join(testDir, "actual-workflow.md")
			await fs.writeFile(actualFile, "# Actual Workflow")

			const firstLink = path.join(testDir, "first-link.md")
			await fs.symlink(actualFile, firstLink)

			const secondLink = path.join(testDir, "second-link.md")
			await fs.symlink(firstLink, secondLink)

			const finalLink = path.join(workflowsDir, "final-link.md")
			await fs.symlink(secondLink, finalLink)

			// Read the workflows directory
			const files = await readDirectory(workflowsDir)

			// Should follow the chain and find the actual file
			expect(files).toHaveLength(1)
			// Normalize paths to handle platform differences
			expect(await fs.realpath(files[0])).toBe(await fs.realpath(actualFile))
		})

		it("should handle mixed content in directories", async () => {
			// Create a mix of regular files, symlinked files, and symlinked directories
			const regularRule = path.join(rulesDir, "regular.md")
			await fs.writeFile(regularRule, "# Regular Rule")

			const externalFile = path.join(testDir, "external.md")
			await fs.writeFile(externalFile, "# External Rule")
			const fileLink = path.join(rulesDir, "file-link.md")
			await fs.symlink(externalFile, fileLink)

			const externalDir = path.join(testDir, "external-dir")
			await fs.mkdir(externalDir)
			const fileInDir = path.join(externalDir, "nested.md")
			await fs.writeFile(fileInDir, "# Nested Rule")
			const dirLink = path.join(rulesDir, "dir-link")
			await fs.symlink(externalDir, dirLink)

			// Read the rules directory
			const files = await readDirectory(rulesDir)

			// Should find all three files
			expect(files).toHaveLength(3)
			// Normalize paths for comparison
			const normalizedFiles = await Promise.all(files.map((f) => fs.realpath(f)))
			const expectedFiles = await Promise.all([regularRule, externalFile, fileInDir].map((f) => fs.realpath(f)))
			expect(normalizedFiles.sort()).toEqual(expectedFiles.sort())
		})

		it("should respect excluded paths even through symlinks", async () => {
			// Create directories with files
			const includedDir = path.join(testDir, "included")
			const excludedDir = path.join(testDir, "excluded")
			await fs.mkdir(includedDir)
			await fs.mkdir(excludedDir)

			const includedFile = path.join(includedDir, "include.md")
			const excludedFile = path.join(excludedDir, "exclude.md")
			await fs.writeFile(includedFile, "# Include")
			await fs.writeFile(excludedFile, "# Exclude")

			// Create symlinks to both directories
			const includedLink = path.join(workflowsDir, "included-link")
			const excludedLink = path.join(workflowsDir, "excluded-link")
			await fs.symlink(includedDir, includedLink)
			await fs.symlink(excludedDir, excludedLink)

			// Read with exclusion
			const files = await readDirectory(workflowsDir, [["excluded"]])

			// Should only find the included file
			expect(files).toHaveLength(1)
			// Normalize paths to handle platform differences
			expect(await fs.realpath(files[0])).toBe(await fs.realpath(includedFile))
		})
	})

	describe("Cross-platform Compatibility", () => {
		it("should handle symlinks on the current platform", async () => {
			// This test verifies that symlink creation and reading works on the current OS
			const file = path.join(testDir, "platform-test.md")
			await fs.writeFile(file, "# Platform Test")

			const link = path.join(workflowsDir, "platform-link.md")

			try {
				await fs.symlink(file, link)

				// If symlink creation succeeded, reading should work
				const files = await readDirectory(workflowsDir)
				expect(files).toHaveLength(1)
				// Normalize paths to handle platform differences
				expect(await fs.realpath(files[0])).toBe(await fs.realpath(file))
			} catch (error: any) {
				// On Windows without admin rights, symlink creation might fail
				if (process.platform === "win32" && error.code === "EPERM") {
					console.warn("Symlink test skipped on Windows due to insufficient permissions")
					expect(true).toBe(true) // Pass the test as it's a known limitation
				} else {
					throw error
				}
			}
		})
	})

	describe("Performance with Large Symlink Structures", () => {
		it("should handle many symlinks efficiently", async () => {
			const startTime = Date.now()

			// Create 100 files and 100 symlinks
			const promises = []
			for (let i = 0; i < 100; i++) {
				const file = path.join(testDir, `file-${i}.md`)
				const link = path.join(rulesDir, `link-${i}.md`)
				promises.push(fs.writeFile(file, `# File ${i}`).then(() => fs.symlink(file, link)))
			}
			await Promise.all(promises)

			// Read the directory
			const files = await readDirectory(rulesDir)

			const duration = Date.now() - startTime

			// Should find all 100 files
			expect(files).toHaveLength(100)

			// Should complete in reasonable time (< 1 second)
			expect(duration).toBeLessThan(1000)
		})
	})
})

describe("Integration Tests for Workflows and Rules Loading", () => {
	let testProjectDir: string

	beforeEach(async () => {
		// Create a test project structure
		testProjectDir = path.join(os.tmpdir(), `kilocode-integration-test-${Date.now()}`)
		await fs.mkdir(testProjectDir, { recursive: true })

		// Create .kilocode directory structure
		const kilocodeDir = path.join(testProjectDir, ".kilocode")
		await fs.mkdir(path.join(kilocodeDir, "workflows"), { recursive: true })
		await fs.mkdir(path.join(kilocodeDir, "rules"), { recursive: true })

		// Create some shared resources
		const sharedDir = path.join(testProjectDir, "shared")
		await fs.mkdir(sharedDir, { recursive: true })
	})

	afterEach(async () => {
		try {
			await fs.rm(testProjectDir, { recursive: true, force: true })
		} catch (error) {
			console.warn(`Failed to clean up test project directory: ${testProjectDir}`, error)
		}
	})

	it("should support a realistic project structure with symlinks", async () => {
		// Create shared workflows
		const sharedWorkflowsDir = path.join(testProjectDir, "shared", "workflows")
		await fs.mkdir(sharedWorkflowsDir)
		await fs.writeFile(path.join(sharedWorkflowsDir, "ci.yaml"), "name: CI Workflow")
		await fs.writeFile(path.join(sharedWorkflowsDir, "deploy.yaml"), "name: Deploy Workflow")

		// Create shared rules
		const sharedRulesDir = path.join(testProjectDir, "shared", "rules")
		await fs.mkdir(sharedRulesDir)
		await fs.writeFile(path.join(sharedRulesDir, "code-style.md"), "# Code Style Guidelines")
		await fs.writeFile(path.join(sharedRulesDir, "security.md"), "# Security Rules")

		// Create team-specific rules
		const teamRulesDir = path.join(testProjectDir, "team-rules")
		await fs.mkdir(teamRulesDir)
		await fs.writeFile(path.join(teamRulesDir, "team-practices.md"), "# Team Best Practices")

		// Set up symlinks in .kilocode
		const workflowsDir = path.join(testProjectDir, ".kilocode", "workflows")
		const rulesDir = path.join(testProjectDir, ".kilocode", "rules")

		// Link shared workflows directory
		await fs.symlink(sharedWorkflowsDir, path.join(workflowsDir, "shared"))

		// Link individual rule files
		await fs.symlink(path.join(sharedRulesDir, "code-style.md"), path.join(rulesDir, "code-style.md"))
		await fs.symlink(path.join(sharedRulesDir, "security.md"), path.join(rulesDir, "security.md"))

		// Link team rules directory
		await fs.symlink(teamRulesDir, path.join(rulesDir, "team"))

		// Add some local files too
		await fs.writeFile(path.join(workflowsDir, "local.yaml"), "name: Local Workflow")
		await fs.writeFile(path.join(rulesDir, "project-specific.md"), "# Project Specific Rules")

		// Read workflows
		const workflowFiles = await readDirectory(workflowsDir)
		expect(workflowFiles).toHaveLength(3) // 2 shared + 1 local
		expect(workflowFiles.some((f) => f.endsWith("ci.yaml"))).toBe(true)
		expect(workflowFiles.some((f) => f.endsWith("deploy.yaml"))).toBe(true)
		expect(workflowFiles.some((f) => f.endsWith("local.yaml"))).toBe(true)

		// Read rules
		const ruleFiles = await readDirectory(rulesDir)
		expect(ruleFiles).toHaveLength(4) // 2 shared + 1 team + 1 local
		expect(ruleFiles.some((f) => f.endsWith("code-style.md"))).toBe(true)
		expect(ruleFiles.some((f) => f.endsWith("security.md"))).toBe(true)
		expect(ruleFiles.some((f) => f.endsWith("team-practices.md"))).toBe(true)
		expect(ruleFiles.some((f) => f.endsWith("project-specific.md"))).toBe(true)
	})

	it("should maintain symlink structure for organization", async () => {
		// Create a corporate structure with shared resources
		const corpDir = path.join(testProjectDir, "corp")
		await fs.mkdir(path.join(corpDir, "standards"), { recursive: true })
		await fs.mkdir(path.join(corpDir, "workflows"), { recursive: true })

		// Corporate standards
		await fs.writeFile(path.join(corpDir, "standards", "compliance.md"), "# Corporate Compliance Rules")
		await fs.writeFile(path.join(corpDir, "workflows", "audit.yaml"), "name: Security Audit")

		// Department specific
		const deptDir = path.join(testProjectDir, "dept")
		await fs.mkdir(path.join(deptDir, "rules"), { recursive: true })
		await fs.writeFile(path.join(deptDir, "rules", "dept-guidelines.md"), "# Department Guidelines")

		// Set up project with symlinks to corporate and department resources
		const projectRulesDir = path.join(testProjectDir, ".kilocode", "rules")
		const projectWorkflowsDir = path.join(testProjectDir, ".kilocode", "workflows")

		// Create a "corp" subdirectory via symlink
		await fs.symlink(path.join(corpDir, "standards"), path.join(projectRulesDir, "corp"))

		// Create a "dept" subdirectory via symlink
		await fs.symlink(path.join(deptDir, "rules"), path.join(projectRulesDir, "dept"))

		// Link corporate workflows
		await fs.symlink(path.join(corpDir, "workflows", "audit.yaml"), path.join(projectWorkflowsDir, "audit.yaml"))

		// Read and verify structure
		const ruleFiles = await readDirectory(projectRulesDir)
		expect(ruleFiles).toHaveLength(2)

		// Verify the files maintain their organizational context
		const complianceFile = ruleFiles.find((f) => f.endsWith("compliance.md"))
		const deptFile = ruleFiles.find((f) => f.endsWith("dept-guidelines.md"))

		expect(complianceFile).toBeTruthy()
		expect(deptFile).toBeTruthy()

		// Verify content is accessible
		if (complianceFile) {
			const content = await fs.readFile(complianceFile, "utf-8")
			expect(content).toContain("Corporate Compliance")
		}
	})
})
