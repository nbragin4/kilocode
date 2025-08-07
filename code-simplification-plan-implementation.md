# Detailed Implementation Instructions for Code Simplification

## Step-by-Step Implementation Guide

### Step 1: Create the CommitContext Interface

**File:** Create new file `src/services/commit-message/types.ts`

```typescript
// kilocode_change - new file
export interface CommitContext {
	diff: string
	summary?: string
	branch?: string
	recentCommits?: string[]
	// NO isStaged field - we don't distinguish between staged/unstaged
	isChunked?: boolean
	chunkIndex?: number
	totalChunks?: number
}

export interface ChunkResult {
	chunks: string[]
	wasChunked: boolean
	chunkCount: number
	exceedsLimit?: boolean
}
```

### Step 2: Simplify GitExtensionService

**File:** `src/services/commit-message/GitExtensionService.ts`

#### 2.1 Update Interfaces (Lines 10-23)

```typescript
// REMOVE staged from GitOptions
export interface GitOptions {
	// Remove the staged field entirely
}

// SIMPLIFY GitProgressOptions - remove enableChunking and chunkRatio
export interface GitProgressOptions {
	onProgress?: (percentage: number) => void
}
```

#### 2.2 Update getCommitContext Method (Line 210)

```typescript
// CHANGE FROM:
public async getCommitContext(_changes: GitChange[], options: GitProgressOptions): Promise<string[]>

// CHANGE TO:
public async getCommitContext(options?: GitProgressOptions): Promise<CommitContext[]>
```

#### 2.3 Rewrite getCommitContext Implementation (Lines 211-291)

```typescript
public async getCommitContext(options?: GitProgressOptions): Promise<CommitContext[]> {
  try {
    // Get the diff (no longer caring about staged vs unstaged)
    const diff = await this.getDiffForChanges(options);

    // Check if we need to chunk
    if (await this.shouldChunk(diff)) {
      return await this.createChunkedContexts(diff, options);
    }

    // Single context - return structured data
    return [{
      diff,
      summary: this.getSummary(),
      branch: this.getCurrentBranch()?.trim(),
      recentCommits: this.getRecentCommits()
        ?.split('\n')
        .filter(c => c.trim())
    }];
  } catch (error) {
    console.error("Error generating commit context:", error);
    // Return minimal context on error
    return [{
      diff: '',
      summary: 'Error generating context'
    }];
  }
}

// Add new helper method
private async shouldChunk(diff: string): Promise<boolean> {
  const tokens = await estimateTokenCount(diff);
  const contextWindow = getContextWindow();
  const maxTokens = Math.floor(contextWindow * 0.4);
  return tokens > maxTokens;
}

// Add new helper method for chunking
private async createChunkedContexts(
  diff: string,
  options?: GitProgressOptions
): Promise<CommitContext[]> {
  const chunkResult = await chunkDiffByFiles(diff);

  if (chunkResult.exceedsLimit) {
    // Too many chunks - just return single context
    return [{
      diff,
      summary: this.getSummary(),
      branch: this.getCurrentBranch()?.trim(),
      recentCommits: this.getRecentCommits()?.split('\n').filter(c => c.trim())
    }];
  }

  // Return array of contexts, one per chunk
  return chunkResult.chunks.map((chunk, index) => ({
    diff: chunk,
    summary: index === 0 ? this.getSummary() : undefined,
    branch: this.getCurrentBranch()?.trim(),
    recentCommits: this.getRecentCommits()?.split('\n').filter(c => c.trim()),
    isChunked: true,
    chunkIndex: index,
    totalChunks: chunkResult.chunks.length
  }));
}
```

#### 2.4 Simplify getDiffForChanges (Lines 152-182)

```typescript
private async getDiffForChanges(options?: GitProgressOptions): Promise<string> {
  const { onProgress } = options || {};
  try {
    const diffs: string[] = [];
    // Just get ALL changes - no staged/unstaged distinction
    const files = this.spawnGitWithArgs(["diff", "--name-only"])
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    let processedFiles = 0;
    for (const filePath of files) {
      if (this.ignoreController?.validateAccess(filePath) && !shouldExcludeLockFile(filePath)) {
        const diff = this.getGitDiff(filePath).trim();
        diffs.push(diff);
      }

      processedFiles++;
      if (onProgress && files.length > 0) {
        const percentage = (processedFiles / files.length) * 100;
        onProgress(percentage);
      }
    }

    return diffs.join("\n");
  } catch (error) {
    console.error("Error generating diff:", error);
    return "";
  }
}
```

#### 2.5 Remove Line 219 changeType Variable

```typescript
// DELETE THIS LINE:
const changeType = staged ? "Staged" : "Unstaged"

// And change any usage to just:
;("Full Diff")
```

#### 2.6 Remove Unused proceed Variable (Lines 228-236)

```typescript
// DELETE the assignment:
const proceed = await vscode.window.showErrorMessage(...)

// Just show the error and throw:
await vscode.window.showErrorMessage(
  t("kilocode:commitMessage.tooManyChunks.message", {
    chunkCount: chunkResult.chunkCount,
    maxChunks: CHUNKING_LIMITS.MAX_CHUNKS,
  }),
  { modal: true },
  t("kilocode:commitMessage.tooManyChunks.ok"),
)
throw new Error(t("kilocode:commitMessage.operationCancelled"))
```

### Step 3: Update CommitMessageProvider

**File:** `src/services/commit-message/CommitMessageProvider.ts`

#### 3.1 Import the New Types

```typescript
import { CommitContext } from "./types"
```

#### 3.2 Simplify Change Gathering (Lines 69-81)

```typescript
// REMOVE all the staged/unstaged logic
const changes = await this.gitService.gatherChanges()
if (changes.length === 0) {
	vscode.window.showInformationMessage(t("kilocode:commitMessage.noChanges"))
	return
}
```

#### 3.3 Update getCommitContext Call (Line 97)

```typescript
// CHANGE FROM:
const gitContext = await this.gitService.getCommitContext(changes, {
	staged,
	onProgress: onDiffProgress,
	enableChunking: true,
})

// CHANGE TO:
const gitContext = await this.gitService.getCommitContext({
	onProgress: onDiffProgress,
})
```

#### 3.4 Add formatContextForAI Method

```typescript
private formatContextForAI(context: CommitContext): string {
  let formatted = `## Git Context for Commit Message Generation\n\n`;
  formatted += `### Full Diff\n\`\`\`diff\n${context.diff}\n\`\`\`\n\n`;

  if (context.summary) {
    formatted += `### Statistical Summary\n\`\`\`\n${context.summary}\n\`\`\`\n\n`;
  }

  if (context.branch) {
    formatted += `### Repository Context\n**Current branch:** \`${context.branch}\`\n`;
  }

  if (context.recentCommits?.length) {
    formatted += `**Recent commits:**\n\`\`\`\n${context.recentCommits.join('\n')}\n\`\`\`\n`;
  }

  return formatted;
}
```

#### 3.5 Update processChunkedContext (Lines 168-206)

```typescript
private async processChunkedContext(
  gitContexts: CommitContext[],
  progress: vscode.Progress<{ increment?: number; message?: string }>,
  cancellationToken?: vscode.CancellationToken,
): Promise<string> {
  // For single context, process directly
  if (gitContexts.length === 1) {
    const formatted = this.formatContextForAI(gitContexts[0]);
    return await this.callAIForCommitMessage(formatted, cancellationToken);
  }

  // For multiple contexts, process each chunk
  progress.report({ message: t("kilocode:commitMessage.analyzingChunks") });

  const chunkSummaries: string[] = [];
  for (let i = 0; i < gitContexts.length; i++) {
    progress.report({
      message: t("kilocode:commitMessage.processingChunk", {
        current: i + 1,
        total: gitContexts.length,
      }),
    });

    const formatted = this.formatContextForAI(gitContexts[i]);
    const chunkMessage = await this.callAIForCommitMessage(formatted);
    chunkSummaries.push(`Chunk ${i + 1}: ${chunkMessage}`);
  }

  progress.report({ message: t("kilocode:commitMessage.combining") });

  // Combine results
  const combinedContext = `## Combined Analysis from Multiple Chunks

The following commit message suggestions were generated from different parts of the changes:

${chunkSummaries.join("\n\n")}

## Instructions
Generate a single, cohesive conventional commit message that best represents the overall changes.`;

  return await this.callAIForCommitMessage(combinedContext, cancellationToken);
}
```

#### 3.6 Update Line 110 to Use CommitContext

```typescript
// CHANGE FROM:
this.previousGitContext = gitContext.join("\n---\n")

// CHANGE TO:
this.previousGitContext = gitContext.map((ctx) => this.formatContextForAI(ctx)).join("\n---\n")
```

### Step 4: Simplify commit-token-utils.ts

**File:** `src/utils/commit-token-utils.ts`

#### 4.1 Remove Complex Configuration

```typescript
// DELETE ChunkingOptions interface
// DELETE CHUNKING_LIMITS constant

// Keep only:
const MAX_CHUNKS = 10
```

#### 4.2 Simplify chunkDiffByFiles Function

```typescript
export async function chunkDiffByFiles(diffText: string): Promise<ChunkResult> {
	const contextWindow = getContextWindow()
	const maxTokens = Math.floor(contextWindow * 0.4)

	const totalTokens = await estimateTokenCount(diffText)
	if (totalTokens <= maxTokens) {
		return {
			chunks: [diffText],
			wasChunked: false,
			chunkCount: 1,
			exceedsLimit: false,
		}
	}

	// Simple file-based chunking
	const fileDiffs = diffText.split(/^diff --git /m).filter((chunk) => chunk.trim())

	if (fileDiffs.length > MAX_CHUNKS) {
		// Too many files, return as single chunk
		return {
			chunks: [diffText],
			wasChunked: false,
			chunkCount: 1,
			exceedsLimit: true,
		}
	}

	// Group files into chunks that fit within token limit
	const chunks: string[] = []
	let currentChunk = ""
	let currentTokens = 0

	for (const fileDiff of fileDiffs) {
		const fullDiff = fileDiff.startsWith("a/") ? `diff --git ${fileDiff}` : fileDiff
		const fileTokens = await estimateTokenCount(fullDiff)

		if (currentTokens + fileTokens > maxTokens && currentChunk) {
			chunks.push(currentChunk)
			currentChunk = fullDiff
			currentTokens = fileTokens
		} else {
			currentChunk += (currentChunk ? "\n" : "") + fullDiff
			currentTokens += fileTokens
		}
	}

	if (currentChunk) {
		chunks.push(currentChunk)
	}

	return {
		chunks,
		wasChunked: chunks.length > 1,
		chunkCount: chunks.length,
		exceedsLimit: false,
	}
}
```

### Step 5: Update All Test Files

#### 5.1 CommitMessageProvider.test.ts

- Remove all references to `staged` parameter
- Update `getCommitContext` mocks to return `CommitContext[]` instead of `string[]`
- Remove the `changes` parameter from `getCommitContext` calls
- Update test expectations for the new structure

#### 5.2 GitExtensionService.spec.ts and GitExtensionService.test.ts

- Update all calls to `getCommitContext` to remove the `mockChanges` parameter
- Update expectations to check for `CommitContext[]` return type
- Remove tests specific to staged/unstaged behavior

### Step 6: Clean Up Comments (Only in Modified Lines)

Remove these comments from modified lines:

- Line 83 in CommitMessageProvider.ts: `// Report initial progress after gathering changes (10% of total)`
- Line 86 in CommitMessageProvider.ts: `// Track progress for diff collection (70% of total progress)`
- Line 109 in CommitMessageProvider.ts: `// Store the current context and message for future reference`
- Line 146 in CommitMessageProvider.ts: `// Check for cancellation before starting`
- Line 151 in CommitMessageProvider.ts: `// Use unified processing flow for both single and multiple contexts`
- Line 173 in CommitMessageProvider.ts: `// For single chunk, process directly without map-reduce overhead`
- Line 178 in CommitMessageProvider.ts: `// For multiple chunks, use map-reduce pattern`
- Line 213 in GitExtensionService.ts: `// Start building the context with the required sections`
- Line 245 in CommitMessageProvider.ts: `// Check for cancellation before making API call`

Keep these comments as they explain important behavior:

- Line 154 in CommitMessageProvider.ts: `// Now, animate the bar to 100% to make it look nicer :)`
- Line 161 in CommitMessageProvider.ts: `// Always clear when done`
- Line 284 in GitExtensionService.ts: `// Always return as array for consistency`
- Comments explaining error handling behavior

## Final Checklist

- [ ] CommitContext interface created
- [ ] GitExtensionService updated to return structured data
- [ ] Removed unused `_changes` parameter
- [ ] Removed staged/unstaged concept throughout
- [ ] CommitMessageProvider updated to format data for AI
- [ ] Simplified chunking logic with model-based thresholds
- [ ] Updated all test files
- [ ] Removed unnecessary comments from modified lines
- [ ] All tests pass
- [ ] TypeScript compiles without errors
