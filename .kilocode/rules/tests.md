# Test Running Guidelines

## Critical Rules

- **NEVER use `--watch`** (causes system hang)
- **All tests use Vitest** (Jest not installed)

## Command Templates

```bash
cd $WORKSPACE_ROOT/src && npx vitest run <relative-path-no-src-prefix>
# Example: cd $WORKSPACE_ROOT/src && npx vitest run api/providers/__tests__/anthropic.spec.ts
```

```bash
cd $WORKSPACE_ROOT/webview-ui && npx vitest run <relative-path-with-src-prefix>
# Example: cd $WORKSPACE_ROOT/webview-ui && npx vitest run src/utils/__tests__/context-mentions.spec.ts
```

### Verbose Debugging

To see console output during tests, use the native vitest `--no-silent` flag:

```bash
cd $WORKSPACE_ROOT/src && npx vitest run <relative-path-no-src-prefix> --no-silent
# Example: cd $WORKSPACE_ROOT/src && npx vitest run api/providers/__tests__/anthropic.spec.ts --no-silent
```

```bash
cd $WORKSPACE_ROOT/webview-ui && npx vitest run <relative-path-with-src-prefix> --no-silent
# Example: cd $WORKSPACE_ROOT/webview-ui && npx vitest run src/utils/__tests__/context-mentions.spec.ts --no-silent
```
