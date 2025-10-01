# Platform-Independent Ghost System Implementation Plan

## CURRENT STATE ANALYSIS

**✅ FOUNDATION EXISTS:**

- Platform-independent types: `src/services/ghost/types/platform-independent.ts`
- Architecture vision documented: `docs/current/ghost-architecture.md`
- Benchmark system expecting platform-independent engine

**❌ IMPLEMENTATION GAPS:**

- `GhostSuggestionContext` still uses `vscode.TextDocument`, `vscode.TextEditor` (types.ts:61-75)
- `GhostEngine` → `GhostContext` → VSCode dependency chain
- No adapter pattern implementation
- Functions like `createMercuryContext`, `getAllSnippets` expect VSCode types

## SYSTEMATIC IMPLEMENTATION PLAN

### **PHASE 1: Create Platform-Independent Context Types**

**Step 1.1:** Create `PlatformIndependentGhostContext` interface

```typescript
// New interface in types/platform-independent.ts
export interface PlatformIndependentGhostContext {
	document: GhostDocument
	position: GhostPosition
	range?: GhostRange
	prefix: string
	suffix: string
	language: string
	filepath: string
	workspacePath: string
	userInput?: string

	// Platform-independent equivalents
	openFiles?: GhostDocument[]
	diagnostics?: PlatformIndependentDiagnostic[]
	mercuryContext?: any
	snippets?: any
}
```

**Step 1.2:** Update functions to accept both interfaces

- Modify `createMercuryContext()` to work with `GhostDocument`
- Modify `getAllSnippets()` to work with `GhostDocument`
- Create overloaded functions that accept either VSCode or platform-independent types

### **PHASE 2: Create Platform-Independent GhostEngine**

**Step 2.1:** Create `PlatformIndependentGhostEngine` class

```typescript
export class PlatformIndependentGhostEngine {
	// Zero VSCode dependencies
	// Uses only PlatformIndependentGhostContext
	async executeCompletion(context: PlatformIndependentGhostContext): Promise<GhostEngineResult>
}
```

**Step 2.2:** Update `GhostEngine` to delegate to platform-independent version

```typescript
export class GhostEngine {
	private platformEngine: PlatformIndependentGhostEngine

	// Adapter method - converts VSCode types to platform-independent
	async executeCompletion(vscodeContext: GhostSuggestionContext): Promise<GhostEngineResult> {
		const platformContext = VSCodeAdapter.toPlatformIndependent(vscodeContext)
		return this.platformEngine.executeCompletion(platformContext)
	}
}
```

### **PHASE 3: Create Adapter Layer**

**Step 3.1:** VSCode Adapter

```typescript
export class VSCodeGhostAdapter {
	static toPlatformIndependent(vscodeContext: GhostSuggestionContext): PlatformIndependentGhostContext
	static fromPlatformIndependent(result: GhostEngineResult): VSCodeSpecificResult
}
```

**Step 3.2:** Node.js Adapter (for benchmarks)

```typescript
export class NodeGhostAdapter {
	static createContext(testCase: BenchmarkTestCase): PlatformIndependentGhostContext
	// Already partially exists in benchmark system
}
```

### **PHASE 4: Update Benchmark System**

**Step 4.1:** Use real PlatformIndependentGhostEngine
**Step 4.2:** Remove duplicate mock implementations

## EXECUTION STRATEGY

**Priority Order:**

1. **MINIMAL VIABLE**: Get benchmark CLI working with real engine (Phase 2.1)
2. **INTEGRATION**: Ensure VSCode functionality preserved (Phase 2.2, 3.1)
3. **CLEANUP**: Remove duplications (Phase 4)

**Risk Mitigation:**

- Keep existing VSCode functionality intact during transition
- Create platform-independent version alongside, not replacing
- Test each phase before proceeding

## IMMEDIATE NEXT STEPS

1. Create `PlatformIndependentGhostContext` interface
2. Create `PlatformIndependentGhostEngine` class
3. Update benchmark system to use new engine
4. Test CLI functionality

This plan will deliver a working, VSCode-independent Ghost system that can be used in benchmarks without complex mocking.
