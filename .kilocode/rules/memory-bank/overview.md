# Project Overview

Kilo Code is a VSCode AI coding assistant with persistent project memory, multi-mode task execution, and advanced autocomplete powered by Ghost system with Mercury Coder integration.

## Core Features

- **Multi-Mode System**: Architect, Code, Test, Debug, Translate modes with file restrictions
- **Ghost Autocomplete**: AI-powered code completion with modular strategy system
- **Profile System**: Configurable pairing of API providers with prompt strategies
- **Memory Bank**: Persistent project context across coding sessions
- **MCP Servers**: Extensible tool and resource system
- **Ghost Benchmarks**: Production-ready CLI benchmarking system for evaluating strategies

## Ghost System - CURRENT STATUS: TEST REFACTORING IN PROGRESS ⚠️

**Date**: 2025-09-30  
**Status**: Core system functional, test infrastructure being refactored

### Major Discovery: Stale TypeScript Declaration Files

**Root Cause Identified**: Stale `.d.ts` files were providing outdated type definitions, causing:

- Methods appearing to exist when they didn't
- TypeScript not catching API mismatches
- Test harnesses using wrong APIs
- Confusion about actual vs expected interfaces

**Resolution**: All `.d.ts` files deleted from `src/services/ghost/` - system now using live source code

### Current Architecture Reality

**What Actually Works**:

- ✅ **Mercury Strategy**: Has `extractCompletion(response)` method, works perfectly
- ✅ **Other Strategies**: Use `initializeProcessing()`, `processResponseChunk()`, `finishProcessing()` API
- ✅ **Core Tests**: 186/186 tests passing for utilities, streaming parser, suggestions
- ✅ **Strategy-Specific Tests**: Mercury parsing, whitespace handling, line number stripping all working

**What Needs Fixing**:

- ⚠️ **BasePromptStrategy**: `super.initializeProcessing()` calls failing for FIM/HoleFill/LegacyXml
- ⚠️ **Test Harness**: Mixed API usage between Mercury (simple) and others (streaming)
- ⚠️ **Strategy Interface**: Inconsistency between interface definition and actual implementation

### Test Coverage Status

**Current Test Results**:

- ✅ **Core Ghost Tests**: 108/108 passing
- ✅ **Mercury Strategy Tests**: 20/20 passing
- ✅ **Utils Tests**: 53/53 passing
- ⚠️ **Strategy Integration Tests**: 3/13 passing (only Mercury working)

**Test Architecture**:

- **GhostTestHarness**: Being refactored to handle different strategy APIs
- **StringGhostApplicator**: Platform-independent testing (implemented)
- **Strategy Snapshot Tests**: Comprehensive end-to-end tests (in progress)

## Development Constraints

- **Package Manager**: pnpm ONLY (npm blocked by preinstall script)
- **Node Version**: v20.18.1 (exact, via .nvmrc)
- **Testing Framework**: Vitest only (no Jest)
- **Extension Runtime**: Extension runs automatically in VSCode

## Current Priority: Complete Test Refactoring

**Goal**: Ensure all Ghost strategies have proper unit test coverage with consistent APIs

**Next Steps**:

1. Fix BasePromptStrategy interface inconsistencies
2. Complete strategy snapshot tests for all 4 strategies
3. Validate end-to-end parsing pipeline with mocked responses
4. Return to benchmark testing once unit tests are solid

**Key Insight**: Focus on unit test foundation before benchmark validation - unit tests catch API issues that benchmarks miss.
