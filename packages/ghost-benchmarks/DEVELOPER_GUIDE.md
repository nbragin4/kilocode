# Ghost Benchmarks Developer Guide

## Overview

The Ghost Benchmarks package is a standalone CLI tool for evaluating and comparing different Ghost autocomplete strategies across various code completion scenarios. It provides comprehensive testing capabilities for the Ghost system's performance, accuracy, and reliability.

## Architecture

### Core Components

- **BenchmarkRunner**: Main orchestrator that executes test cases using real Ghost system
- **Test Cases**: JSON-based test scenarios covering different completion types
- **Profile System**: Configurable strategy + model combinations
- **Results Analysis**: Detailed performance metrics and completion quality assessment

### Supported Strategies

1. **Mercury Coder** (`mercury`) - Specialized Mercury model with diff-based prompting
2. **Hole Filler** (`hole-filler`) - Chat models with hole-filler prompting and XML parsing
3. **Fill-in-Middle** (`fim`) - Code models with native FIM token support
4. **Legacy XML** (`legacy-xml`) - Traditional XML-based prompting for general models

### Current Profile Configuration

| Profile       | Model                         | Strategy    | Description                                        |
| ------------- | ----------------------------- | ----------- | -------------------------------------------------- |
| `mercury`     | `inception/mercury-coder`     | Mercury     | Specialized Mercury Coder with optimized prompting |
| `hole-filler` | `openai/gpt-4o-mini`          | Hole Filler | Chat model with hole-filler prompting              |
| `fim`         | `mistralai/codestral-2508`    | FIM         | Mistral Codestral with native FIM support          |
| `legacy-xml`  | `anthropic/claude-3.5-sonnet` | Legacy XML  | Claude 3.5 Sonnet with XML prompting               |

## Installation & Setup

### Prerequisites

- Node.js v20.18.1 (exact version via .nvmrc)
- pnpm v10.8.1 (enforced via preinstall script)
- Valid OpenRouter API key (for model access)

### Build Process

```bash
cd packages/ghost-benchmarks
npm run build
```

The build process uses esbuild to create a standalone CLI bundle with all dependencies included.

## Usage

### Basic Commands

#### List Available Test Cases

```bash
npm run benchmark:list
```

#### Run Single Test Case

```bash
npm run benchmark -- --profile <profile-name> --tests <test-name>
```

#### Run Multiple Test Cases

```bash
npm run benchmark -- --profile <profile-name> --tests <test1>,<test2>,<test3>
```

#### Run All Test Cases for a Profile

```bash
npm run benchmark -- --profile <profile-name>
```

### Examples

#### Test FIM Strategy with Single Test

```bash
npm run benchmark -- --profile fim --tests function-body-completion
```

#### Test Multiple Strategies

```bash
npm run benchmark -- --profile mercury --tests async-await-completion,class-method-completion
npm run benchmark -- --profile hole-filler --tests loop-completion,variable-assignment
```

#### Full Profile Evaluation

```bash
npm run benchmark -- --profile fim
npm run benchmark -- --profile mercury
npm run benchmark -- --profile legacy-xml
npm run benchmark -- --profile hole-filler
```

## Test Cases

### Available Test Categories

1. **async-completion**: `async-await-completion`
2. **class-completion**: `class-method-completion`
3. **conditional-completion**: `conditional-completion`
4. **function-completion**: `function-body-completion`
5. **import-completion**: `import-statement-completion`
6. **loop-completion**: `loop-completion`
7. **method-completion**: `object-method-completion`
8. **variable-completion**: `variable-assignment`

### Test Case Structure

Each test case includes:

- **Input file content** with cursor position
- **Expected completion behavior**
- **Context information** (surrounding code, imports, etc.)
- **Success criteria** for validation

## Results & Analysis

### Output Locations

- **Completion Files**: `completions/benchmark-<timestamp>/<profile>/`
- **Results JSON**: `results/benchmark-<timestamp>.json`
- **Console Output**: Real-time progress and summary statistics

### Performance Metrics

- **Pass Rate**: Percentage of successful completions
- **Average Response Time**: Mean completion time across all tests
- **Total Execution Time**: Complete benchmark run duration
- **Category Breakdown**: Success rates by completion type

### Example Results

```
📊 Benchmark Results
══════════════════════════════════════════════════

📈 Summary:
  ✅ Passed: 8
  ❌ Failed: 0
  📊 Pass Rate: 100.0%
  ⏱️  Total Time: 6786ms
  ⚡ Avg Time: 848ms

📁 Category Breakdown:
  ✅ async-completion: 1/1 (100%)
  ✅ class-completion: 1/1 (100%)
  ✅ conditional-completion: 1/1 (100%)
  ✅ function-completion: 1/1 (100%)
  ✅ import-completion: 1/1 (100%)
  ✅ loop-completion: 1/1 (100%)
  ✅ method-completion: 1/1 (100%)
  ✅ variable-completion: 1/1 (100%)
```

## Development

### Adding New Test Cases

1. Create test case JSON in `src/test-cases/`
2. Follow existing structure with `inputFiles`, `activeFile`, `cursorPosition`
3. Add validation criteria and expected behavior
4. Test with multiple profiles to ensure compatibility

### Adding New Profiles

1. Update `BenchmarkRunner.ensureBenchmarkProfilesLoaded()`
2. Configure model ID and strategy type
3. Test with representative test cases
4. Document performance characteristics

### Debugging

#### Enable Verbose Output

```bash
npm run benchmark -- --profile fim --tests function-body-completion --verbose
```

#### Check Build Issues

```bash
npm run build
# Review warnings and errors in output
```

#### Validate Test Cases

```bash
npm run benchmark:list
# Ensure all expected test cases are loaded
```

## Performance Benchmarks

### Current Performance (as of 2025-01-30)

| Strategy    | Model                       | Pass Rate | Avg Time | Notes                          |
| ----------- | --------------------------- | --------- | -------- | ------------------------------ |
| Mercury     | inception/mercury-coder     | 100%      | 757ms    | Excellent targeted completions |
| FIM         | mistralai/codestral-2508    | 100%      | 848ms    | Native FIM support, very fast  |
| Hole-Filler | openai/gpt-4o-mini          | 90%       | 1837ms   | Good general completions       |
| Legacy-XML  | anthropic/claude-3.5-sonnet | 100%      | 4561ms   | Precise but slower             |

### Optimization Tips

1. **FIM Strategy**: Best for code models with native FIM support
2. **Mercury Strategy**: Optimal for Mercury Coder model specifically
3. **Hole-Filler**: Good fallback for general chat models
4. **Legacy-XML**: Use with instruction-following models like Claude

## Troubleshooting

### Common Issues

#### Model ID Not Found

```
Error: OpenRouter completion error: 400 <model-id> is not a valid model ID
```

**Solution**: Verify model ID exists on OpenRouter and update profile configuration

#### Build Failures

```
▲ [WARNING] Import "X" will always be undefined
```

**Solution**: Check VSCode mock implementations in `src/mocks/vscode.ts`

#### Test Case Not Found

```
🚀 Starting benchmark run: 0 test cases
```

**Solution**: Verify test case name matches exactly (case-sensitive)

### Debug Mode

Enable detailed logging by setting environment variables:

```bash
GHOST_QUIET_MODE=false npm run benchmark -- --profile fim --tests function-body-completion
```

## Contributing

### Code Quality Standards

- Follow Clean Code principles
- Use intention-revealing names
- Keep functions small and focused
- Add comprehensive error handling
- Include unit tests for new features

### Testing New Features

1. Test with all existing profiles
2. Validate across different test case categories
3. Measure performance impact
4. Update documentation

## API Reference

### BenchmarkRunner Methods

- `runTestCase(testCase, options)`: Execute single test case
- `runTestCases(testCases, options)`: Execute multiple test cases
- `ensureBenchmarkProfilesLoaded()`: Initialize Ghost profiles

### Profile Configuration

```typescript
interface GhostProfileConfig {
	id: string
	name: string
	description: string
	apiProfileId: string
	promptStrategyType: string
	isDefault: boolean
	customSettings: {
		openRouterModelId: string
	}
}
```

### Test Case Format

```typescript
interface BenchmarkTestCase {
	metadata: {
		name: string
		category: string
		description: string
	}
	inputFiles: Record<string, string>
	activeFile: string
	cursorPosition: { line: number; character: number }
	expectedBehavior: string
}
```

## License

This package is part of the Kilo Code project and follows the same licensing terms.
