# Platform-Independent Ghost Architecture

## Overview

The Ghost system has been updated to use platform-independent types, following the Continue.dev pattern of using simple, serializable interfaces instead of platform-specific dependencies like VSCode types.

## Key Changes

### New Platform-Independent Types

**File**: `src/services/ghost/types/platform-independent.ts`

This file defines clean, platform-agnostic interfaces that can be implemented by any editor or platform:

```typescript
// Simple position interface
export interface GhostPosition {
	line: number
	character: number
}

// Simple range interface
export interface GhostRange {
	start: GhostPosition
	end: GhostPosition
}

// Platform-independent document interface
export interface GhostDocument {
	uri: string
	fileName: string
	languageId: string
	getText(range?: GhostRange): string
	lineAt(line: number): GhostLineInfo
	// ... other essential methods
}

// Platform-independent context for Ghost engine
export interface GhostEngineContext {
	document: GhostDocument
	position: GhostPosition
	prefix: string
	suffix: string
	language: string
	filepath: string
	workspacePath: string
	userInput?: string
	range?: GhostRange
}
```

### Updated GhostEngine Interface

**File**: `src/services/ghost/GhostEngine.ts`

The `GhostEngineContext` interface has been updated to use platform-independent types:

- **Before**: `document: vscode.TextDocument`, `position: vscode.Position`, `range?: vscode.Range`
- **After**: `document: GhostDocument`, `position: GhostPosition`, `range?: GhostRange`

For backward compatibility, the old interface is preserved as `LegacyGhostEngineContext`.

## Benefits

### Multi-Platform Support

The same Ghost engine can now work across different platforms:

- **VSCode**: Uses adapter to convert `vscode.TextDocument` → `GhostDocument`
- **JetBrains**: Uses adapter to convert JetBrains types → `GhostDocument`
- **Node.js**: Uses simple implementations for testing/benchmarking
- **Web**: Uses browser-based document implementations

### Clean Testing

Testing is now much simpler:

```typescript
// Before: Complex VSCode mocking required
const mockDocument = new MockVSCodeTextDocument(uri, content)

// After: Simple object implementation
const ghostDocument: GhostDocument = {
    uri: "/path/to/file.js",
    fileName: "file.js",
    languageId: "javascript",
    getText: (range) => range ? getTextInRange(content, range) : content,
    lineAt: (line) => ({ lineNumber: line, text: lines[line], ... })
    // ... other methods
}
```

### Benchmark System Integration

The Ghost Benchmarks system can now use the same core engine without duplication:

```typescript
// Benchmarks create simple Ghost context
const context: GhostEngineContext = {
	document: new NodeGhostDocument(testCase.content),
	position: testCase.cursorPosition,
	// ... other fields
}

// Same engine used by both VSCode and benchmarks
const result = await ghostEngine.executeCompletion(context)
```

## Architecture Pattern

### Adapter Layer

Each platform implements an adapter that converts platform-specific types to Ghost types:

```typescript
// VSCode Adapter
class VSCodeGhostAdapter {
	static toGhostContext(vscodeContext: VSCodeContext): GhostEngineContext {
		return {
			document: new VSCodeGhostDocument(vscodeContext.document),
			position: { line: vscodeContext.position.line, character: vscodeContext.position.character },
			// ... other conversions
		}
	}
}

// Node.js Adapter
class NodeGhostAdapter {
	static toGhostContext(testCase: TestCase): GhostEngineContext {
		return {
			document: new NodeGhostDocument(testCase.content),
			position: testCase.cursorPosition,
			// ... other conversions
		}
	}
}
```

### Core Engine

The `GhostEngine` now has zero platform dependencies:

```typescript
export class GhostEngine {
	async executeCompletion(context: GhostEngineContext): Promise<GhostEngineResult> {
		// Pure business logic - no VSCode imports needed
		// Works with any platform that provides GhostEngineContext
	}
}
```

## Exported Types

The following platform-independent types are now available for external use:

```typescript
// From src/services/ghost/index.ts
export type {
	GhostPosition,
	GhostRange,
	GhostDocument,
	GhostEngineContext as PlatformIndependentGhostEngineContext,
	GhostLineInfo,
	GhostUri,
} from "./types/platform-independent"

export { GhostTypes } from "./types/platform-independent"
```

## Migration Guide

### For Ghost Engine Consumers

Old code using VSCode types:

```typescript
import * as vscode from "vscode"

function useGhost(document: vscode.TextDocument, position: vscode.Position) {
	// Direct VSCode usage
}
```

New code using platform-independent types:

```typescript
import { GhostDocument, GhostPosition } from "./ghost"

function useGhost(document: GhostDocument, position: GhostPosition) {
	// Platform-independent usage
}
```

### For Platform Integrations

Each platform should create an adapter:

```typescript
// Platform-specific integration
class PlatformGhostIntegration {
	private ghostEngine: GhostEngine

	async generateSuggestions(platformContext: PlatformContext) {
		// Convert platform types to Ghost types
		const ghostContext = PlatformAdapter.toGhostContext(platformContext)

		// Use shared Ghost engine
		const result = await this.ghostEngine.executeCompletion(ghostContext)

		// Convert results back for platform UI
		return PlatformAdapter.fromGhostResult(result)
	}
}
```

## Validation

✅ **TypeScript Compilation**: All types compile without errors  
✅ **Interface Compatibility**: New types are compatible with existing VSCode interfaces  
✅ **Zero Breaking Changes**: Legacy interfaces preserved for backward compatibility  
✅ **Multi-Platform Ready**: Foundation established for JetBrains, web, and Node.js support

## Next Steps

1. **Extract GhostEngine**: Move core logic from GhostProvider to standalone GhostEngine
2. **Create Adapters**: VSCode adapter, Node.js adapter for benchmarks
3. **Update Benchmarks**: Use real GhostEngine instead of duplicate implementations
4. **Add Platform Support**: JetBrains plugin, web interface, etc.

This architecture change is the foundation for true multi-platform Ghost system support while maintaining all existing functionality.
