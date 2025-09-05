import * as path from "path"
import * as os from "os"

export interface CommandConversionResult {
	finalCommand: string
	finalCwd: string
	wasConverted: boolean
}

const isWindowsAbs = (p: string) => /^[A-Za-z]:[\\/]/.test(p) || /^\\\\[^\\]/.test(p) // drive or UNC

const looksWin = (p: string) => /[A-Za-z]:\\/.test(p) || p.includes("\\")
const looksPosix = (p: string) => p.startsWith("/") || p.includes("/")

const expandHome = (p: string) => (p.startsWith("~") ? path.join(os.homedir(), p.slice(1)) : p)

function resolveCrossPlatform(baseCwd: string, cdArgRaw: string): { cwd?: string; ok: boolean } {
	// Expand ~ first (both shells commonly allow it)
	const cdArg = expandHome(cdArgRaw)

	const baseIsWin = looksWin(baseCwd)
	const baseIsPosix = !baseIsWin

	// If the cdArg clearly targets the *other* platform, bail (avoid wrong resolution)
	if (baseIsWin && cdArg.startsWith("/")) return { ok: false }
	if (baseIsPosix && isWindowsAbs(cdArg)) return { ok: false }

	if (baseIsWin) {
		if (isWindowsAbs(cdArg)) {
			return { cwd: path.win32.normalize(cdArg), ok: true }
		}
		return { cwd: path.win32.resolve(baseCwd, cdArg), ok: true }
	} else {
		if (cdArg.startsWith("/")) {
			return { cwd: path.posix.normalize(cdArg), ok: true }
		}
		return { cwd: path.posix.resolve(baseCwd, cdArg), ok: true }
	}
}

/**
 * Detects and converts leading `cd path && command` (or `chdir`) into
 * { cwd, command } while preserving semantics. Only converts for `&&`.
 * Avoids converting `;` or single `&` to prevent unconditional-execution changes.
 *
 * This function uses a robust parsing approach instead of regex to properly
 * handle quotes, escapes, and cross-platform path resolution.
 *
 * @param command - The command string to analyze
 * @param baseCwd - The base working directory to resolve relative paths against
 * @returns CommandConversionResult with the processed command and working directory
 */
export function detectAndConvertCdPattern(command: string, baseCwd: string): CommandConversionResult {
	const original = command.trim()
	if (!original) {
		return { finalCommand: original, finalCwd: baseCwd, wasConverted: false }
	}

	// Mini-parser over the *leading* statement: [cd|chdir] [/d]? <arg> && <rest>
	let i = 0
	const n = original.length

	// skip leading spaces
	while (i < n && /\s/.test(original[i])) i++

	// read first word
	let startWord = i
	while (i < n && /\S/.test(original[i])) i++
	const firstWord = original.slice(startWord, i).toLowerCase()

	if (firstWord !== "cd" && firstWord !== "chdir") {
		return { finalCommand: original, finalCwd: baseCwd, wasConverted: false }
	}

	// skip spaces after cd/chdir
	while (i < n && /\s/.test(original[i])) i++

	// Optional `/d` (cmd.exe only)
	let hadSlashD = false
	if (original.slice(i).toLowerCase().startsWith("/d")) {
		// accept "/d" token only if delimited by space or end
		const after = i + 2
		if (after >= n || /\s/.test(original[after])) {
			hadSlashD = true
			i = after
			while (i < n && /\s/.test(original[i])) i++
		}
	}

	// Parse one path argument (quoted or bare), respecting quotes
	if (i >= n) {
		// "cd" without arg — do not convert
		return { finalCommand: original, finalCwd: baseCwd, wasConverted: false }
	}

	let cdArg = ""
	if (original[i] === '"' || original[i] === "'") {
		const quote = original[i++]
		while (i < n) {
			const ch = original[i++]
			if (ch === quote) break
			if (ch === "\\" && quote === '"' && i < n) {
				// Only handle actual escape sequences: \" and \\
				const nextCh = original[i]
				if (nextCh === '"' || nextCh === "\\") {
					cdArg += nextCh
					i++ // consume the escaped character
				} else {
					// Not an escape sequence, keep the backslash as-is (important for Windows paths)
					cdArg += ch
				}
			} else {
				cdArg += ch
			}
		}
	} else {
		// read until whitespace or unquoted operator
		while (i < n && !/\s|&|;/.test(original[i])) {
			cdArg += original[i++]
		}
	}

	// Check if cdArg is empty after parsing (cd without arguments)
	if (!cdArg.trim()) {
		return { finalCommand: original, finalCwd: baseCwd, wasConverted: false }
	}

	// skip spaces before operator
	while (i < n && /\s/.test(original[i])) i++

	// Look for an unquoted && (only then we convert)
	if (!(original[i] === "&" && original[i + 1] === "&")) {
		// Don't convert for ';' or single '&' to avoid changing semantics
		return { finalCommand: original, finalCwd: baseCwd, wasConverted: false }
	}

	// consume &&
	i += 2

	// remaining command (may include further chaining)
	const rest = original.slice(i).trim()
	if (!rest) {
		// nothing to run; again, don't convert
		return { finalCommand: original, finalCwd: baseCwd, wasConverted: false }
	}

	// Resolve the target cwd robustly
	const { cwd, ok } = resolveCrossPlatform(baseCwd, cdArg)
	if (!ok || !cwd) {
		// If we can't confidently resolve (platform mismatch, etc), don't convert
		return { finalCommand: original, finalCwd: baseCwd, wasConverted: false }
	}

	// Optional: if you want to mimic '&&' semantics more strictly, you can
	// choose to check fs.existsSync(cwd) here; but letting the spawn fail with
	// invalid cwd replicates 'cd && cmd' behavior closely enough.

	console.log(`[commandUtils] Auto-converted '${original}' → cwd: '${cwd}'`)
	return {
		finalCommand: rest,
		finalCwd: cwd,
		wasConverted: true,
	}
}
