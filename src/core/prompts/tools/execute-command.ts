import { ToolArgs } from "./types"

export function getExecuteCommandDescription(args: ToolArgs): string | undefined {
	return `## execute_command
Description: Execute CLI commands efficiently. **CRITICAL: Use the 'cwd' parameter instead of 'cd directory && command' patterns to prevent terminal fragmentation and improve performance.**

Parameters:
- command: (required) The CLI command to execute (DONT start w/ 'cd' or 'chdir' commands)
- cwd: (optional) Working directory to execute the command in (default: ${args.cwd})

**Directory Navigation - USE CWD PARAMETER:**
✅ CORRECT - Reuses existing terminals:
  Use cwd parameter: "./frontend" with command: "npm install"
  Use cwd parameter: "../backend" with command: "python test.py"

The cwd parameter allows terminal reuse while cd commands force new terminal creation.

Usage:
<execute_command>
<command>Your command here</command>
<cwd>Working directory path (optional)</cwd>
</execute_command>

Example: Installing dependencies in a subdirectory
<execute_command>
<command>npm install</command>
<cwd>./frontend</cwd>
</execute_command>

Example: Running tests in parent directory
<execute_command>
<command>python test.py</command>
<cwd>../backend</cwd>
</execute_command>`
}
