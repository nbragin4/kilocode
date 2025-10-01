# Ghost Testing Architecture Plan

## **Problem Statement**

We need a unified testing framework that:

1. Uses 100% real Ghost pipeline (no custom test implementations)
2. Allows mocking LLM responses for deterministic testing
3. Works consistently across all strategies (Mercury, FIM, Hole-Filler, Legacy-XML)
4. Provides clean input → expected output testing pattern

## **Current Architecture Analysis**

### **Real Pipeline Flow**

```
GhostEngine.executeCompletion()
→ ghostContext.generate() [build context]
→ strategy.getStrategyInfo() [create prompt]
→ model.generateResponse() [🎯 LLM CALL - INJECTION POINT]
→ strategy.processStreamingChunk() [parse response]
→ strategy.finishStreamingParser() [final processing]
→ GhostSuggestionsState [return suggestions]
```

### **Key Injection Point**

**Line 227 in GhostEngine.ts**: `await this.model.generateResponse(systemPrompt, userPrompt, onChunk)`

This is where we need to intercept and inject mock responses instead of making real API calls.

## **Proposed Solution: GhostTestHarness**

### **Architecture Design**

```typescript
// High-level API
const testResult = await GhostTestHarness.execute({
	inputFile: "class User { ... }",
	cursorPosition: { line: 7, character: 8 },
	mockResponse: "<|code_to_edit|>...<|/code_to_edit|>",
	strategy: "mercury-coder", // or "fim", "hole-filler", "legacy-xml"
	expectedOutput: "class User { ... }", // final file content
})

// Test Result
expect(testResult.finalContent).toBe(expectedOutput)
expect(testResult.success).toBe(true)
```

### **Implementation Strategy**

#### **1. GhostTestHarness Class**

- Copies BenchmarkRunner pattern exactly
- Uses real GhostEngine, real context generation, real strategy processing
- Mocks only the `model.generateResponse()` call

#### **2. Mock Injection Method**

- Create MockGhostModel that implements the same interface as GhostModel
- Override `generateResponse()` to return pre-configured mock response
- Everything else uses real implementation

#### **3. Unified Test Interface**

```typescript
interface GhostTestCase {
	name: string
	inputFile: string // Content with cursor marker ␣
	mockResponse: string // What the LLM would return
	expectedOutput: string // Expected final file content
	strategy: "mercury" | "fim" | "hole-filler" | "legacy-xml"
}
```

### **Benefits**

1. **100% Real Implementation**: Every part except LLM call uses real Ghost code
2. **Deterministic Testing**: Mock responses ensure consistent test results
3. **Strategy Agnostic**: Same interface works for all strategies
4. **Easy TDD**: Write failing tests with broken responses, fix implementation, tests pass
5. **Pipeline Validation**: Tests the complete flow including context → strategy → suggestions → final file

## **Implementation Plan**

### **Phase 1: Create GhostTestHarness**

- `src/services/ghost/__tests__/GhostTestHarness.ts`
- Copy BenchmarkRunner architecture
- Implement mock injection for `model.generateResponse()`

### **Phase 2: Create MockGhostModel**

- `src/services/ghost/__tests__/MockGhostModel.ts`
- Implement same interface as GhostModel
- Override generateResponse() to use mock data

### **Phase 3: Update BenchmarkFailureReproduction.spec.ts**

- Replace custom implementations with GhostTestHarness calls
- Create failing tests that demonstrate current bugs
- Expect correct output, tests fail due to bugs

### **Phase 4: Fix Implementation Issues**

- Use failing tests to guide debugging
- Fix Mercury line scrambling
- Fix FIM indentation issues
- Fix Hole-Filler XML pollution

### **Phase 5: Verify Success**

- All tests should pass after fixes
- Re-run benchmarks to confirm improvements

## **Detailed File Structure**

```
src/services/ghost/__tests__/
├── GhostTestHarness.ts           # Main test harness
├── MockGhostModel.ts             # Mock model for response injection
├── MockProviderSettingsManager.ts # Mock settings (copy from benchmarks)
├── testCases/                    # Test case definitions
│   ├── mercury/                  # Mercury-specific test cases
│   ├── fim/                      # FIM-specific test cases
│   ├── hole-filler/             # Hole-Filler test cases
│   └── legacy-xml/              # Legacy-XML test cases
└── BenchmarkFailureReproduction.spec.ts # Updated tests using harness
```

## **Integration Points**

### **With Existing Code**

- Reuses BenchmarkRunner patterns
- Leverages existing mock infrastructure
- Works with existing `parseContentWithCursor()` utility
- Compatible with current `applyAllSuggestions()` logic

### **With Future Development**

- Easy to add new strategies (just add profile + test cases)
- Supports both unit tests and integration tests
- Can be extended for performance testing
- Foundation for regression testing

## **Success Criteria**

✅ **Zero custom implementations in tests**
✅ **Complete real Ghost pipeline execution**
✅ **Unified API across all strategies**
✅ **Deterministic test results via mocking**
✅ **Easy TDD workflow: write failing test → fix bug → test passes**
✅ **Comprehensive coverage of benchmark failure scenarios**

This architecture ensures we test exactly what runs in production while maintaining clean, readable, and maintainable tests.
