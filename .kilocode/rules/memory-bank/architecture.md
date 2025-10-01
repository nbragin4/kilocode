# System Architecture

## Overall Architecture

Kilo Code is structured as a monorepo-based VSCode extension using pnpm workspaces and Turborepo.

## Key Components

- **Core Extension** (`src/`): Extension entry point, message handling, tool implementations
- **API Layer** (`src/api/`): 25+ AI providers with format transformation layer
- **Services** (`src/services/`): Browser automation, code analysis, MCP servers, checkpoints
- **Ghost System** (`src/services/ghost/`): AI-powered code suggestions with dual display modes
    - **GhostProvider**: Core suggestion generation and orchestration
    - **GhostInlineProvider**: VSCode native inline completion integration
    - **Mercury Coder Integration**: Enhanced prompting and diff processing
    - **Decorator System**: Traditional overlay-based suggestion display
- **Webview UI** (`webview-ui/`): React-based frontend
- **Integration Layer** (`src/integrations/`): Editor, terminal, file system integration

## Autocomplete System Architecture

**Profile + Strategy System**: Pairs API providers with prompt strategies for complete separation of concerns

- **GhostProfile**: Combines API profile (provider + model) with Enhanced Prompt Strategy
- **Enhanced Prompt Strategies**: Self-contained components that handle both prompting and response parsing
- **Streaming-First Interface**: All strategies implement unified streaming methods
- **Automatic Setup**: Mercury Coder profile created automatically when `enableCustomProvider = false`

**Key Components**:

- `MercuryEnhancedStrategy`: Mercury Coder prompting + markdown parsing with Myers diff
- `LegacyXmlEnhancedStrategy`: XML prompting + streaming XML parsing for other models
- `AutocompleteProfileManager`: Profile creation, loading, and factory system
- `MercuryAutocompleteSetup`: Simple integration helper for default Mercury setup

**Eliminated Complexity**:

- No more `DualStreamingParser` format detection
- No more `isStreamingCapable()` branching logic
- No Mercury vs non-Mercury conditional code paths
- Clean separation between API configuration and prompt strategy
