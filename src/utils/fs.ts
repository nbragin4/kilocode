import * as fs from "fs/promises"
import * as path from "path"
import { Dirent } from "fs"

/**
 * Asynchronously creates all non-existing subdirectories for a given file path
 * and collects them in an array for later deletion.
 *
 * @param filePath - The full path to a file.
 * @returns A promise that resolves to an array of newly created directories.
 */
export async function createDirectoriesForFile(filePath: string): Promise<string[]> {
	const newDirectories: string[] = []
	const normalizedFilePath = path.normalize(filePath) // Normalize path for cross-platform compatibility
	const directoryPath = path.dirname(normalizedFilePath)

	let currentPath = directoryPath
	const dirsToCreate: string[] = []

	// Traverse up the directory tree and collect missing directories
	while (!(await fileExistsAtPath(currentPath))) {
		dirsToCreate.push(currentPath)
		currentPath = path.dirname(currentPath)
	}

	// Create directories from the topmost missing one down to the target directory
	for (let i = dirsToCreate.length - 1; i >= 0; i--) {
		await fs.mkdir(dirsToCreate[i])
		newDirectories.push(dirsToCreate[i])
	}

	return newDirectories
}

/**
 * Helper function to check if a path exists.
 *
 * @param path - The path to check.
 * @returns A promise that resolves to true if the path exists, false otherwise.
 */
export async function fileExistsAtPath(filePath: string): Promise<boolean> {
	try {
		await fs.access(filePath)
		return true
	} catch {
		return false
	}
}

//	kilocode_change start
/**
 * Checks if the path is a directory
 * @param filePath - The path to check.
 * @returns A promise that resolves to true if the path is a directory, false otherwise.
 */
export async function isDirectory(filePath: string): Promise<boolean> {
	try {
		const stats = await fs.stat(filePath)
		return stats.isDirectory()
	} catch {
		return false
	}
}

// Common OS-generated files that would appear in an otherwise clean directory
const OS_GENERATED_FILES = [
	".DS_Store", // macOS Finder
	"Thumbs.db", // Windows Explorer thumbnails
	"desktop.ini", // Windows folder settings
]

/**
 * Recursively reads a directory and returns an array of absolute file paths.
 *
 * @param directoryPath - The path to the directory to read.
 * @param excludedPaths - Nested array of paths to ignore.
 * @returns A promise that resolves to an array of absolute file paths.
 * @throws Error if the directory cannot be read.
 */
export const readDirectory = async (directoryPath: string, excludedPaths: string[][] = []) => {
	try {
		// Track visited paths to prevent infinite loops from cyclic symlinks
		const visitedPaths = new Set<string>()
		const allFilePaths: string[] = []

		// Helper function to recursively process directory entries
		const processEntry = async (entry: Dirent, parentPath: string): Promise<void> => {
			const fullPath = path.resolve(parentPath, entry.name)

			// Skip OS-generated files
			if (OS_GENERATED_FILES.includes(entry.name)) {
				return
			}

			// Check if we've already visited this path (cycle detection)
			const normalizedPath = path.normalize(fullPath)
			if (visitedPaths.has(normalizedPath)) {
				return
			}
			visitedPaths.add(normalizedPath)

			if (entry.isFile()) {
				// Regular file - add to results
				allFilePaths.push(fullPath)
			} else if (entry.isSymbolicLink()) {
				// Handle symbolic links
				try {
					// Get the symlink target
					const linkTarget = await fs.readlink(fullPath)
					// Resolve the target path (relative to the symlink location)
					const resolvedTarget = path.isAbsolute(linkTarget)
						? linkTarget
						: path.resolve(path.dirname(fullPath), linkTarget)

					// Check if we've already visited the resolved target
					const normalizedTarget = path.normalize(resolvedTarget)
					if (visitedPaths.has(normalizedTarget)) {
						return
					}

					// Fully resolve the symlink chain (in case it points to another symlink)
					const fullyResolvedTarget = await fs.realpath(resolvedTarget)
					const normalizedFullyResolved = path.normalize(fullyResolvedTarget)

					// Check if we've already visited the fully resolved target
					if (visitedPaths.has(normalizedFullyResolved)) {
						return
					}

					// Check what the symlink ultimately points to
					const targetStats = await fs.stat(fullyResolvedTarget)

					if (targetStats.isFile()) {
						// Symlink points to a file - add the fully resolved path
						allFilePaths.push(fullyResolvedTarget)
						visitedPaths.add(normalizedFullyResolved)
						visitedPaths.add(normalizedTarget)
					} else if (targetStats.isDirectory()) {
						// Symlink points to a directory - recursively process it
						visitedPaths.add(normalizedFullyResolved)
						visitedPaths.add(normalizedTarget)
						const dirEntries = await fs.readdir(fullyResolvedTarget, { withFileTypes: true })

						// Process all entries in the symlinked directory
						await Promise.all(dirEntries.map((dirEntry) => processEntry(dirEntry, fullyResolvedTarget)))
					}
				} catch (err) {
					// Silently skip broken symlinks or permission errors
				}
			} else if (entry.isDirectory()) {
				// Regular directory - recursively process it
				const dirEntries = await fs.readdir(fullPath, { withFileTypes: true })

				// Process all entries in the directory
				await Promise.all(dirEntries.map((dirEntry) => processEntry(dirEntry, fullPath)))
			}
		}

		// Start processing from the root directory
		const rootEntries = await fs.readdir(directoryPath, { withFileTypes: true })
		await Promise.all(rootEntries.map((entry) => processEntry(entry, directoryPath)))

		// Apply excluded paths filter
		const filteredPaths = allFilePaths.filter((filePath) => {
			if (excludedPaths.length === 0) {
				return true
			}

			for (const excludedPathList of excludedPaths) {
				const pathToSearchFor = path.sep + excludedPathList.join(path.sep) + path.sep
				if (filePath.includes(pathToSearchFor)) {
					return false
				}
			}

			return true
		})

		return filteredPaths
	} catch {
		throw new Error(`Error reading directory at ${directoryPath}`)
	}
}

// kilocode_change end
