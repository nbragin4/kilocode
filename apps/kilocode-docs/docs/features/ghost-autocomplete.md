# Ghost Autocomplete

Ghost is Kilo Code's intelligent AI-powered code completion system that provides real-time suggestions as you type. Unlike traditional autocomplete, Ghost understands your code context and generates multi-line completions that match your coding style and intent.

## What is Ghost Autocomplete?

Ghost autocomplete analyzes your code in real-time and suggests completions based on:

- **Current file context:** The code you're writing and surrounding code
- **Recent edits:** Your recent changes and coding patterns
- **Open files:** Related code from other files you're working on
- **Project structure:** Understanding of your codebase organization
- **Language patterns:** Best practices for your programming language

## Key Features

### 🎯 Intelligent Suggestions

Ghost provides context-aware completions that understand:

- Function implementations based on signatures
- Code patterns from your project
- Multi-line code blocks
- Complex refactoring suggestions

### ⚡ Smart Caching

Ghost caches suggestions to provide instant responses:

- **30-40% cache hit rate** during active coding
- Instant suggestions when you backspace and retype
- Responsive "type-into" behavior that extends suggestions as you type

### 🎨 Dual Display Modes

Ghost adapts its display based on the suggestion type:

- **Inline completions:** For simple, single-line additions (like GitHub Copilot)
- **Decorator overlays:** For complex, multi-line changes with visual diff highlighting

### 🔧 Multiple Strategies

Ghost supports different completion strategies optimized for various AI models:

- **Mercury Coder:** Advanced strategy with sophisticated context analysis
- **Legacy XML:** Compatible with most AI models using XML formatting
- **Fill-in-Middle (FIM):** Native support for code completion models
- **Hole Filler:** Chat-based completion for general models

## Getting Started

### Basic Usage

1. **Start typing** in any code file
2. **Wait briefly** for Ghost to analyze context (typically <1 second)
3. **Review the suggestion** displayed inline or as an overlay
4. **Accept or dismiss:**
    - Press `Tab` to accept inline suggestions
    - Press `Cmd/Ctrl + Shift + Enter` to accept decorator suggestions
    - Press `Escape` to dismiss

### Keyboard Shortcuts

| Action                      | Shortcut                   |
| --------------------------- | -------------------------- |
| Accept inline suggestion    | `Tab`                      |
| Accept decorator suggestion | `Cmd/Ctrl + Shift + Enter` |
| Dismiss suggestion          | `Escape`                   |
| Manually trigger Ghost      | `Cmd/Ctrl + Shift + Space` |

## Configuration

### Choosing a Strategy

Ghost uses different strategies optimized for different AI models. The strategy is configured through **Ghost Profiles** which combine an API provider with a prompt strategy.

#### Available Strategies

**Mercury Coder** (Recommended)

- Best for: Complex code generation and refactoring
- Model: `inception/mercury-coder` via OpenRouter
- Features: Advanced context analysis, precise diff-based editing
- Use when: You need sophisticated multi-line completions

**Legacy XML**

- Best for: General-purpose models (GPT-4, Claude)
- Models: Most chat-based AI models
- Features: XML-formatted prompts for broad compatibility
- Use when: Using standard AI models without FIM support

**Fill-in-Middle (FIM)**

- Best for: Code-specific models with native FIM tokens
- Models: Qwen Coder, StarCoder, CodeLlama
- Features: Native fill-in-middle token support
- Use when: Using models designed specifically for code completion

**Hole Filler**

- Best for: Chat models without FIM support
- Models: GPT-4, Claude, Granite
- Features: Chat-based completion with context markers
- Use when: Using general chat models for code completion

### Creating Ghost Profiles

Ghost profiles combine an API provider with a completion strategy:

1. Open **Settings** → **Providers**
2. Click the **"+"** button to create a new profile
3. Configure the profile:

    - **Name:** Give it a descriptive name (e.g., "Mercury Autocomplete")
    - **Provider:** Select your API provider (OpenRouter, OpenAI, etc.)
    - **API Key:** Enter your API key
    - **Model:** Choose the model (e.g., `inception/mercury-coder`)
    - **Strategy:** Select the appropriate strategy for your model

4. **Save** the profile

### Switching Profiles

You can switch Ghost profiles to use different models or strategies:

1. Open the **API Configuration** dropdown in the chat interface
2. Select your desired Ghost profile
3. Ghost will immediately start using the new configuration

:::tip
Create multiple profiles for different scenarios:

- **Fast profile:** Smaller, faster model for simple completions
- **Advanced profile:** Larger model for complex refactoring
- **Local profile:** Local model for offline work
  :::

## Advanced Features

### Template Customization

Ghost uses Handlebars templates for prompt generation. Advanced users can customize these templates:

**Template Location:** `src/services/ghost/templates/files/`

**Available Templates:**

- `hole-filler.hbs` - For chat-based models
- `standard-fim.hbs` - For FIM-capable models

To customize a template:

1. Locate the template file
2. Edit the Handlebars template
3. Reload VS Code to apply changes

### Performance Optimization

**Caching Settings:**
Ghost's caching system is enabled by default. To adjust:

```typescript
// In GhostSuggestionCache.ts
private readonly maxCacheSize = 100  // Adjust cache size
private readonly maxPrefixCacheSize = 50  // Adjust prefix cache
```

**Context Window:**
Ghost automatically manages context size based on your model's token limits. The system uses accurate token counting with the `tiktoken` library.

### Using with Local Models

Ghost works with local models through Ollama or LM Studio:

1. Set up your local model provider (see [Local Models](/advanced-usage/local-models))
2. Create a Ghost profile with your local provider
3. Select an appropriate strategy:
    - Use **FIM strategy** for code-specific models
    - Use **Hole Filler** for chat models

**Recommended Local Models:**

- **Qwen 2.5 Coder** (32B): Excellent FIM support
- **DeepSeek Coder** (33B): Strong code understanding
- **CodeLlama** (34B): Good general-purpose coding

## Understanding Ghost Behavior

### When Ghost Triggers

Ghost automatically triggers when:

- You pause typing for ~500ms
- You press a trigger character (`.`, `(`, `{`, etc.)
- You manually invoke it with `Cmd/Ctrl + Shift + Space`

### Display Mode Selection

Ghost intelligently chooses between inline and decorator display:

**Inline Display** (like Copilot):

- Single-line additions after cursor
- Up to 3 consecutive line additions
- Simple completions without deletions

**Decorator Display** (Ghost's rich visualization):

- Multi-line refactoring
- Code with deletions or modifications
- Complex structural changes
- Better visualization of what's changing

### Cache Behavior

Ghost's caching provides responsive typing:

**Exact Cache Hits:**

- Same position = instant suggestion (0ms)
- Happens when you backspace and retype

**Prefix Cache Hits:**

- Similar context = fast suggestion (<50ms)
- Uses stable anchor points (`.`, `(`, etc.)

**Cache Miss:**

- New context = LLM call (varies by model)
- Suggestion cached for future use

## Troubleshooting

### Ghost Not Showing Suggestions

**Check these common issues:**

1. **API Configuration:**

    - Verify your API key is valid
    - Check that your selected model is available
    - Ensure you have sufficient API credits

2. **Profile Configuration:**

    - Confirm a Ghost profile is selected
    - Verify the strategy matches your model type
    - Check that the profile is properly initialized

3. **File Type:**
    - Ghost works best with code files
    - Some file types may have limited support

### Slow Suggestions

**Performance tips:**

1. **Use a faster model:**

    - Switch to a smaller, faster model for simple completions
    - Reserve larger models for complex tasks

2. **Check network connection:**

    - Slow API responses affect suggestion speed
    - Consider using local models for better latency

3. **Reduce context size:**
    - Close unnecessary open files
    - Ghost includes fewer files in context

### Suggestions Not Matching Intent

**Improve suggestion quality:**

1. **Add context:**

    - Write descriptive comments
    - Use clear variable and function names
    - Include type hints where applicable

2. **Try different strategies:**

    - Mercury Coder for complex logic
    - FIM for simple completions
    - Experiment with different models

3. **Adjust temperature:**
    - Lower temperature (0.2-0.4) for predictable code
    - Higher temperature (0.6-0.8) for creative solutions

## Best Practices

### Getting the Most from Ghost

1. **Write clear code:**

    - Use descriptive names
    - Add comments for complex logic
    - Follow consistent patterns

2. **Provide context:**

    - Keep related files open
    - Write function signatures before implementations
    - Use type annotations

3. **Review suggestions:**

    - Always review generated code
    - Test completions before committing
    - Understand what Ghost is suggesting

4. **Use appropriate strategies:**
    - Mercury for refactoring and complex logic
    - FIM for simple completions
    - Match strategy to your task

### Privacy and Security

**Data handling:**

- Ghost sends code context to your configured AI provider
- Use local models for sensitive code
- Review your provider's privacy policy
- Consider using self-hosted models for maximum privacy

**API keys:**

- Store API keys securely in VS Code's Secret Storage
- Never commit API keys to version control
- Rotate keys regularly

## Performance Metrics

Ghost is designed for speed and efficiency:

| Metric                      | Target | Typical    |
| --------------------------- | ------ | ---------- |
| Cache hit rate              | 30-40% | 35%        |
| Exact cache response        | <10ms  | ~0ms       |
| Prefix cache response       | <100ms | ~50ms      |
| First suggestion (cached)   | <50ms  | ~25ms      |
| First suggestion (uncached) | Varies | 500-2000ms |

## Related Features

- **[API Configuration Profiles](/features/api-configuration-profiles):** Manage multiple AI provider configurations
- **[Custom Modes](/features/custom-modes):** Create specialized modes that work with Ghost
- **[Local Models](/advanced-usage/local-models):** Use Ghost with offline AI models
- **[Model Temperature](/features/model-temperature):** Adjust creativity vs. predictability

## Community and Support

- **Discord:** Join our community for Ghost tips and tricks
- **GitHub:** Report issues or request features
- **Documentation:** Check the FAQ for common questions

---

Ghost autocomplete represents a significant advancement in AI-powered code completion, combining the familiarity of inline suggestions with the power of context-aware, multi-line completions. Whether you're writing new code, refactoring existing code, or exploring different approaches, Ghost adapts to your workflow and helps you code faster and more efficiently.
