# Ghost Benchmarks Web Interface - PRD

## Overview

Internal web tool for Ghost autocomplete benchmarking with real-time test execution, matrix analysis, and file-based configuration.

## Core Requirements

### Must-Have Features (MVP)

1. **Test Case Browser** - Sidebar showing all test cases loaded from file system
2. **Profile Selector** - Dropdown with Ghost profiles loaded from profiles.json
3. **Matrix Execution** - Run all tests × all profiles with real-time progress
4. **Results Display** - Color-coded matrix showing pass/fail with scores
5. **WebSocket Communication** - Real-time updates during test execution

### Interface Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Header: Ghost Benchmarks | [Profile: mercury-coder ▼] [🔄] │
├───────────────┬─────────────────────────────────────────────┤
│ Sidebar       │ Main Content Area                           │
│               │                                             │
│ 📋 Test Cases │ 🔄 Matrix Benchmark                         │
│ ┌─────────────┤                                             │
│ │☐ All       ││ [Select Tests] [Select Profiles] [Execute]  │
│ │☐ mercury-* ││                                             │
│ │☐ general   ││ ┌─────────────────────────────────────────┐ │
│ │☐ legacy    ││ │ Test × Profile Matrix Results           │ │
│ └─────────────┤ │                                         │ │
│               │ │ test-name    │mercury│gpt4o│claude│score│ │
│ 🤖 Profiles   │ │ ─────────────┼───────┼─────┼──────┼─────│ │
│ ┌─────────────┤ │ duplication  │  ✅   │ ❌  │  ⏳  │ 2/3 │ │
│ │☐ All       ││ │ incomplete   │  ⏳   │ ⭕  │ ⭕  │ 0/3 │ │
│ │☐ mercury-* ││ │ line-index   │  ✅   │ ✅  │ ✅  │ 3/3 │ │
│ │☐ gpt4o-*   ││ │ ─────────────┼───────┼─────┼──────┼─────│ │
│ │☐ claude-*  ││ │ Global Score │ 67%   │ 50% │ 67%  │ 62% │ │
│ └─────────────┤ │                                         │ │
│               │ └─────────────────────────────────────────┘ │
│ ⚡ Actions    │                                             │
│ [Run All]     │ 📊 Progress: [████████████████▓▓▓▓] 80%    │
│ [Quick Test]  │                                             │
│ [Refresh]     │                                             │
└───────────────┴─────────────────────────────────────────────┘
```

## Data Flow Architecture

### File-Based Configuration

- **Test Cases**: Auto-discovered from `src/services/ghost/__tests__/__test_cases_migrated__/*/metadata.json`
- **Profiles**: Loaded from `apps/ghost-benchmarks-web/profiles.json`
- **Results**: Stored in memory (session-based, not persistent)

### WebSocket Communication

```typescript
// Client → Server Messages
{ type: 'run-test', testName: string, profile: string, mode: 'hardcoded' | 'live' }
{ type: 'run-matrix', tests: string[], profiles: string[], mode: 'hardcoded' | 'live' }
{ type: 'refresh-data' }

// Server → Client Messages
{ type: 'test-cases', data: TestCase[] }
{ type: 'profiles', data: Profile[] }
{ type: 'test-progress', testName: string, profile: string, progress: number }
{ type: 'test-result', testName: string, profile: string, result: TestResult }
{ type: 'matrix-complete', results: TestResult[] }
```

## UI Components Specification

### 1. Layout Components

#### `<AppLayout />`

- **Purpose**: Root layout with sidebar and main content
- **Props**: `children: ReactNode`
- **Features**: Fixed sidebar, responsive main area, WebSocket connection status

#### `<Sidebar />`

- **Purpose**: Test case and profile browser with actions
- **Features**:
    - Test case tree with category grouping
    - Profile selector with model info
    - Quick action buttons (Run All, Refresh)
    - Connection status indicator

#### `<Header />`

- **Purpose**: Global controls and status

#### `<TestDetailViewer />`

- **Purpose**: Show detailed test case information when selected
- **Props**: `selectedTest: string, testResult?: TestResult`
- **Features**:
    - **Input Panel**: Source code with cursor marker highlighted (`␣`)
    - **Expected Panel**: Expected output after applying suggestions
    - **Actual Panel**: Live/hardcoded response from LLM
    - **Diff Panel**: Side-by-side comparison of expected vs actual
    - **Metadata Panel**: Test configuration and execution details
    - **Response Actions**: Save live response as hardcoded fixture

### Test Detail Layout (When Test Selected)

```
┌─────────────────────────────────────────────────────────────┐
│ Selected Test: mercury-duplication-bug                     │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────┬─────────────────┬─────────────────────┐ │
│ │ Input Code      │ Expected Output │ Actual Response     │ │
│ │ ┌─────────────┐ │ ┌─────────────┐ │ ┌─────────────────┐ │ │
│ │ │const hello= │ │ │const hello= │ │ │const hello =    │ │ │
│ │ │'␣           │ │ │'Hello, World!│ │ │'Hello, World!'; │ │ │
│ │ │             │ │ │';           │ │ │console.log(hello│ │ │
│ │ │             │ │ │console.log( │ │ │);               │ │ │
│ │ │             │ │ │hello);      │ │ │                 │ │ │
│ │ └─────────────┘ │ └─────────────┘ │ └─────────────────┘ │ │
│ └─────────────────┴─────────────────┴─────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ 📊 Execution Details:                                   │ │
│ │ • Profile: mercury-coder                                │ │
│ │ • Mode: hardcoded                                       │ │
│ │ • Result: ✅ PASS (1.2s, 3 groups, inline mode)       │ │
│ │ • Score: 95% semantic similarity                       │ │
│ │ [💾 Save as Hardcoded] [🔄 Re-run] [📋 Copy Result]   │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Enhanced Data Flow

#### Additional WebSocket Messages

```typescript
// Client → Server (test details)
{ type: 'get-test-details', testName: string }

// Server → Client (test details)
{
  type: 'test-details',
  testName: string,
  inputFiles: { [filename: string]: string },
  expectedFiles: { [filename: string]: string },
  activeFile: string,
  cursorPosition: { line: number, character: number },
  metadata: TestMetadata
}
```

### Enhanced User Workflows

#### Primary Enhanced Workflow: Test Investigation

1. **Browse Matrix** → See overview of all test×profile results
2. **Select Test** → Click test name or matrix cell to view details
3. **Analyze Details** → See input, expected, actual side-by-side
4. **Debug Issues** → Understand why test passed/failed
5. **Save Response** → If live mode, save good responses as fixtures
6. **Re-run Single** → Test specific scenario after changes

#### Test Detail Interaction Flow

1. **Click Test Name** → Load test details from file system
2. **View Source** → See input code with cursor position highlighted
3. **Compare Results** → Expected vs actual response analysis
4. **Check Metadata** → Review test configuration and expectations
5. **Take Action** → Save response, re-run test, or copy results

- **Features**:
    - App title and current profile display
    - Global progress bar during matrix execution
    - WebSocket connection indicator

### 2. Core Feature Components

#### `<TestCaseBrowser />`

- **Purpose**: Browse and select test cases
- **Props**: `testCases: TestCase[], selectedTests: Set<string>, onSelectionChange: (tests: Set<string>) => void`
- **Features**:
    - Checkbox tree with category grouping
    - "Select All" / "Clear" buttons per category
    - Search/filter capability
    - Test count indicators

#### `<ProfileSelector />`

- **Purpose**: Choose Ghost profiles for execution
- **Props**: `profiles: Profile[], selectedProfiles: Set<string>, onSelectionChange: (profiles: Set<string>) => void`
- **Features**:
    - Checkbox list with model descriptions
    - "Select All" / "Clear" buttons
    - Provider grouping (OpenRouter, Kilocode)

#### `<MatrixResults />`

- **Purpose**: Display test×profile execution matrix
- **Props**: `testResults: Map<string, TestResult>, runningTests: Set<string>`
- **Features**:
    - Grid layout: tests as rows, profiles as columns
    - Color-coded cells: green (pass), red (fail), yellow (running), gray (pending)
    - Click cells for detailed results
    - Global scores per row/column
    - Export functionality

#### `<ExecutionControls />`

- **Purpose**: Start/stop test execution
- **Props**: `selectedTests: Set<string>, selectedProfiles: Set<string>, isRunning: boolean`
- **Features**:
    - Mode selector (hardcoded vs live)
    - Execute button with combination count
    - Abort button when running
    - Progress indicator

### 3. Data Display Components

#### `<TestResultCell />`

- **Purpose**: Individual matrix cell showing test result
- **Props**: `result?: TestResult, isRunning: boolean`
- **Features**:
    - Status icon (✅ ❌ ⏳ ⭕)
    - Execution time display
    - Score percentage
    - Hover tooltip with details

#### `<ProgressBar />`

- **Purpose**: Show global execution progress
- **Props**: `progress: number, total: number, current?: string`
- **Features**:
    - Animated progress bar
    - Percentage display
    - Current test indicator
    - ETA calculation

#### `<ConnectionStatus />`

- **Purpose**: Show WebSocket connection state
- **Props**: `connected: boolean`
- **Features**:
    - Green dot (connected) / Red dot (disconnected)
    - Auto-reconnection indicator
    - Last update timestamp

## Page Structure

### `/` - Dashboard (Main Interface)

- **Components**: `<AppLayout>`, `<Sidebar>`, `<MatrixResults>`, `<ExecutionControls>`
- **Purpose**: Single-page interface for all functionality
- **Data**: Real-time via WebSocket

### Future Pages (Not MVP)

- `/test-cases/[name]` - Individual test case details
- `/profiles` - Profile management interface
- `/results/history` - Historical results analysis

## User Workflows

### Primary Workflow: Quick Matrix Test

1. **Load Interface** → Auto-loads test cases and profiles via WebSocket
2. **Select Scope** → Use "Select All" buttons or choose specific tests/profiles
3. **Choose Mode** → Select hardcoded (fast) or live (comprehensive)
4. **Execute** → Click "Execute Matrix" button
5. **Monitor Progress** → Watch real-time updates in matrix grid
6. **Review Results** → See pass/fail status and scores in matrix
7. **Drill Down** → Click cells for detailed execution information

### Secondary Workflow: Single Test Debug

1. **Select One Test** → Click specific test case checkbox
2. **Select One Profile** → Choose target profile
3. **Execute** → Run single test for detailed analysis
4. **Review Details** → See full execution logs and results

## Technical Decisions

### Why Single Page Interface?

- **Simplicity**: All functionality visible at once
- **Real-time Updates**: WebSocket state easier to manage in one component
- **Internal Tool**: No need for complex navigation

### Why WebSocket over REST?

- **Real-time Updates**: Matrix execution needs live progress
- **Simplicity**: Single connection handles all communication
- **Bidirectional**: Server can push updates without polling

### Why File-Based Configuration?

- **Dynamic**: Add test cases by dropping files in directory
- **Version Control**: Profiles.json can be committed and shared
- **Flexibility**: Easy to modify without code changes

## Success Metrics

### User Experience

- **Load Time**: < 2 seconds to show test cases and profiles
- **Execution Feedback**: Real-time progress updates < 500ms latency
- **Results Clarity**: Immediate pass/fail status with drill-down details

### Technical Performance

- **Matrix Execution**: Handle 15 tests × 4 profiles (60 combinations)
- **WebSocket Stability**: Auto-reconnection on connection loss
- **Memory Usage**: Keep results in memory during session

## MVP Implementation Priority

### Phase 1: Basic Interface (30 minutes)

1. Create layout with sidebar and main content
2. Display test cases and profiles from WebSocket data
3. Basic selection checkboxes
4. Simple matrix grid layout

### Phase 2: WebSocket Integration (20 minutes)

1. Connect useWebSocket hook to components
2. Implement test execution triggers
3. Real-time progress updates
4. Results display in matrix

### Phase 3: Polish (10 minutes)

1. Styling improvements with Tailwind
2. Loading states and error handling
3. Basic export functionality
4. Connection status indicators

## Out of Scope (Future)

- Historical data persistence
- Complex filtering and search
- Advanced analytics and charting
- User authentication
- Test case editing interface

This PRD focuses on the core functionality needed for internal Ghost system validation and performance analysis.
