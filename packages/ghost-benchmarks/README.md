# Ghost Benchmarks

Comprehensive benchmarking system for Ghost autocomplete functionality, combining file-based test cases with live LLM integration and advanced scoring metrics.

## Features

- 🏗️ **Multi-file test cases** with standardized cursor markers
- 🤖 **Dual execution modes**: Hardcoded responses for fast regression testing, Live LLM for comprehensive evaluation
- 📊 **Advanced scoring**: Pattern matching, semantic similarity, compilation validation
- 🎯 **Ghost integration**: Full compatibility with existing Ghost test framework
- 📋 **CLI interface**: Easy-to-use command-line tools for running benchmarks
- 📈 **Comprehensive reporting**: Console, JSON, and HTML output formats

## Installation

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build
```

## Usage

### CLI Interface

```bash
# Run all test cases in hardcoded mode (fast, for CI)
ghost-benchmark run --mode hardcoded

# Run specific test cases with live LLM
ghost-benchmark run --mode live --profile mercury-coder --tests mercury-duplication-bug

# List available test cases
ghost-benchmark list --stats

# Validate test case structure
ghost-benchmark validate

# Show statistics
ghost-benchmark stats
```

### Programmatic API

```typescript
import { BenchmarkRunner, TestCaseLoader } from "@kilocode/ghost-benchmarks"

// Create runner and load test cases
const runner = new BenchmarkRunner()
const loader = new TestCaseLoader()

// Run specific test case
const testCase = await loader.loadTestCase("mercury-duplication-bug")
const result = await runner.runTestCase(testCase, {
	mode: "hardcoded",
	profile: "mercury-coder",
})

// Run all tests
const summary = await runner.runAllTests({
	mode: "live",
	profile: "mercury-coder",
	categories: ["mercury-bug"],
})
```

## Test Case Structure

Each test case follows this directory structure:

```
test-case-name/
├── src/
│   ├── main.js          # Input file with ␣ cursor marker
│   ├── utils.js         # Additional context files
│   └── types.ts         # Supporting files
├── responses/
│   ├── mercury-coder.txt    # Hardcoded Mercury response
│   ├── gpt4-turbo.txt       # Hardcoded GPT-4 response
│   └── claude-sonnet.txt    # Hardcoded Claude response
├── expected/
│   ├── main.js          # Expected final result
│   └── utils.js         # Expected changes to other files
├── metadata.json        # Test configuration
└── README.md           # Test documentation
```

### Metadata Schema

```json
{
	"name": "test-case-name",
	"description": "Test case description",
	"category": "mercury-bug",
	"expectedPatterns": ["regex-pattern"],
	"expectedGroupCount": 1,
	"expectedSelectedGroup": 0,
	"shouldCompile": true,
	"minimumSimilarityScore": 0.8
}
```

## Cursor Position System

- **Standard marker**: `␣` (U+2423 OPEN BOX)
- **Rule**: Exactly one file must contain the cursor marker
- **Active file**: File with cursor marker becomes the active editor context
- **Legacy support**: Automatic handling of `<|cursor|>` and `<| cursor |>` formats

## Scoring System

The benchmark system uses multiple evaluation metrics:

### Accuracy Metrics

- **Exact Match**: Generated output exactly matches expected result
- **Semantic Similarity**: AST-based comparison for structural similarity
- **Pattern Matches**: Regex-based validation (Mark's approach)

### Quality Metrics

- **Compilation Status**: Generated code compiles/parses successfully
- **Test Preservation**: Existing tests continue to pass
- **Linting**: No new linting errors introduced

### Performance Metrics

- **Response Time**: API call duration
- **Token Usage**: For cost tracking and optimization
- **Cache Hit Rate**: Ghost suggestion cache effectiveness

## Environment Variables

```bash
# Required for live LLM mode
KILOCODE_API_KEY=your-api-key-here

# Optional configuration
LLM_PROVIDER=kilocode
LLM_MODEL=mistralai/codestral-latest
```

## Architecture

The system is built with Clean Code principles:

- **BenchmarkRunner**: Main orchestrator for test execution
- **TestCaseLoader**: Multi-file test case loading with format detection
- **LLMClient**: Live API integration with Kilo Code services
- **ScoreCalculator**: Comprehensive scoring and evaluation
- **CLI Interface**: User-friendly command-line tools

## Integration

This package integrates seamlessly with:

- **Ghost System**: Reuses existing MockWorkspace and strategy infrastructure
- **Mercury Coder**: Full support for Mercury-specific prompting and responses
- **CI/CD**: Fast hardcoded mode for automated testing
- **Development Workflow**: Live mode for validating Ghost improvements

## Migration from Legacy

The system supports both new multi-file format and legacy single-file test cases:

- **Automatic Detection**: Framework detects format and loads appropriately
- **Backward Compatibility**: All existing test cases continue to work
- **Migration Tools**: Automated scripts for converting to new format

## Future Enhancements

- **HTML Reporting Interface**: Rich web-based results visualization
- **Multi-model Comparison**: Side-by-side evaluation of different LLM providers
- **Performance Regression Detection**: Historical trend analysis
- **Advanced Context Mocking**: Full Ghost context simulation including recent edits and imports

---

Built with ❤️ for the Kilo Code Ghost autocomplete system.
