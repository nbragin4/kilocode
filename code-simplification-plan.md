# Code Simplification Plan for Commit Message Generation

## Core Problems Identified

1. **String-based context passing** - Building markdown strings throughout the code instead of using structured data
2. **Unnecessary configuration complexity** - Too many options (chunkRatio, enableChunking, etc.) that add complexity without clear value
3. **Mixed responsibilities** - Data gathering mixed with formatting
4. **Redundant code** - The `changeType` variable and similar patterns
5. **Overly complex chunking logic** - Too many thresholds and warnings

## Proposed Architecture Simplification

### 1. Replace String Context with Structured Data

**Current Problem:**

- Context is built as markdown strings throughout `GitExtensionService`
- Strings are passed around and concatenated
- Hard to test and maintain

**Solution: Create a structured CommitContext interface**

```typescript
// Add to GitExtensionService.ts or create new file commit-types.ts
interface CommitContext {
  diff: string;
  summary?: string;
  branch?: string;
  recentCommits?: string[];
  // REMOVED: isStaged - we don't distinguish between staged/unstaged
  isChunked?: boolean;
  chunkIndex?: number;
  totalChunks?: number;
}

// Change method signature
public async getCommitContext(options: GitProgressOptions): Promise<CommitContext[]>
```

**Benefits:**

- Type-safe data structure
- Easy to test
- Clear separation of data and presentation
- Simpler to extend

### 2. Simplify Chunking Logic

**Current Problem:**

- Complex configuration with `chunkRatio`, `maxChunks`, `warnThreshold`
- Multiple warning dialogs
- Overly configurable for no clear benefit

**Solution: Fixed, simple chunking**

```typescript
// Remove all these configuration options
// Use model-based threshold
const MAX_CHUNKS = 10 // Reasonable limit

// Simplified chunking using model's context window
async function shouldChunk(diff: string): Promise<boolean> {
	const tokens = await estimateTokenCount(diff)
	const contextWindow = getContextWindow() // Already exists in commit-token-utils.ts
	const maxTokens = Math.floor(contextWindow * 0.4) // Use 40% of context for safety
	return tokens > maxTokens
}

// Remove the complex chunkDiffByFiles options
// Just split by files when needed
```

**Benefits:**

- Less configuration to manage
- Predictable behavior
- Fewer edge cases
- Simpler testing

### 3. Remove Unnecessary Variables and Inline Simple Logic

**Line 219 Issue:**

```typescript
// REMOVE THIS:
const changeType = staged
	? "Staged"
	: "Unstaged" // Later: `### Full Diff of ${changeType} Changes`
		// REPLACE WITH SIMPLE:
		`### Full Diff`
// We don't care if changes are staged or not - just show the diff
```

**Other simplifications:**

- Remove the `proceed` variable that's never used (line 228)
- Inline simple conditionals
- Remove intermediate variables that are only used once

### 4. Separate Formatting from Data Collection

**Current Problem:**

- GitExtensionService builds markdown strings
- Mixing data collection with presentation

**Solution: Move formatting to where it's used**

```typescript
// In GitExtensionService - just return data
public async getCommitContext(options: GitProgressOptions): Promise<CommitContext[]> {
  const diff = await this.getDiffForChanges(options);
  const summary = this.getSummary(options);
  const branch = this.getCurrentBranch();
  const commits = this.getRecentCommits();

  // Return structured data
  return [{
    diff,
    summary,
    branch: branch?.trim(),
    recentCommits: commits?.split('\n').filter(c => c),
    isStaged: options.staged
  }];
}

// In CommitMessageProvider - format for AI
private formatContextForAI(context: CommitContext): string {
  // Build the markdown here where it's needed
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

### 5. Simplify Progress Reporting

**Current Problem:**

- Complex progress calculation with exponential decay
- Hard to understand what's happening

**Solution: Simple linear progress**

```typescript
// Remove the complex formula
// Just use simple progress steps
const PROGRESS_STEPS = {
	GATHERING_CHANGES: 10,
	COLLECTING_DIFF: 30,
	CALLING_AI: 50,
	COMPLETE: 10,
}

// Report progress at clear milestones
progress.report({ increment: PROGRESS_STEPS.GATHERING_CHANGES })
```

### 6. Remove Unused Parameters

**Main issue: `_changes` parameter in getCommitContext**

```typescript
// CURRENT (line 210):
public async getCommitContext(_changes: GitChange[], options: GitProgressOptions)

// CHANGE TO:
public async getCommitContext(options: GitProgressOptions)
```

**Update all callers:**

- Line 97 in CommitMessageProvider.ts
- All test files

### 7. Consolidate Error Handling

**Current Problem:**

- Multiple try-catch blocks with similar patterns
- Some catch blocks that don't add value

**Solution: Let errors bubble up naturally**

```typescript
// Remove unnecessary try-catch blocks that just log and rethrow
// Keep only the top-level error handling in CommitMessageProvider
```

## Implementation Steps

### Phase 1: Structural Changes

1. Create `CommitContext` interface
2. Update `getCommitContext` to return structured data
3. Remove unused `_changes` parameter
4. Update all tests

### Phase 2: Simplification

1. Remove complex chunking configuration
2. Use fixed thresholds
3. Remove unnecessary variables (changeType, proceed, etc.)
4. Inline simple conditionals

### Phase 3: Separation of Concerns

1. Move markdown formatting to CommitMessageProvider
2. Keep GitExtensionService focused on Git operations only
3. Simplify progress reporting

### Phase 4: Cleanup

1. Remove unnecessary comments
2. Remove unused imports
3. Consolidate error handling
4. Update tests for new structure

## Specific File Changes

### src/services/commit-message/GitExtensionService.ts

1. **Line 210:** Remove `_changes` parameter
2. **Line 219:** Remove `changeType` variable, inline the conditional
3. **Lines 213-285:** Replace string building with structured data return
4. **Lines 227-236:** Remove unused `proceed` variable
5. **Line 21-22:** Remove `enableChunking` and `chunkRatio` from GitProgressOptions

### src/services/commit-message/CommitMessageProvider.ts

1. **Line 97:** Remove `changes` argument from `getCommitContext` call
2. **Lines 100-101:** Remove `enableChunking: true` (make it default behavior)
3. **Lines 168-206:** Simplify `processChunkedContext` - just handle array of contexts
4. **Add:** New method `formatContextForAI` to convert structured data to markdown

### src/utils/commit-token-utils.ts

1. **Lines 18-22:** Remove CHUNKING_LIMITS constant or simplify to just MAX_TOKENS
2. **Lines 52-113:** Simplify `chunkDiffByFiles` - remove options parameter
3. **Remove:** `ChunkingOptions` interface

### Test Files

1. Update all mocks and calls to match new signatures
2. Simplify test cases - remove configuration testing
3. Add tests for structured data

## Expected Benefits

1. **Reduced Complexity:** ~30% less code
2. **Better Testability:** Structured data is easier to test than strings
3. **Clearer Separation:** Git operations separate from formatting
4. **Fewer Configuration Options:** Less to go wrong
5. **Type Safety:** Structured data with TypeScript interfaces
6. **Maintainability:** Clearer code intent and flow

## Metrics for Success

- [ ] All tests pass
- [ ] No string concatenation in GitExtensionService
- [ ] Structured CommitContext interface used throughout
