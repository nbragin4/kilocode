# Technology Stack

## Development Requirements

- **Node.js**: v20.18.1 (exact version via .nvmrc)
- **pnpm**: v10.8.1 (enforced via preinstall script) - NEVER use npm
- **Extension Runtime**: Extension runs automatically in VSCode - NEVER try to run watch mode

## Testing Commands

### Fast Targeted Testing

```bash
# Core extension test (Vitest) - ONLY TESTING FRAMEWORK USED
cd $WORKSPACE_ROOT/src; npx vitest run **/*.spec.ts

# Webview test (Vitest)
cd $WORKSPACE_ROOT/webview-ui; npx vitest run src/**/*.spec.ts
```

### Full Test Suite

```bash
# From workspace root only - slow, includes build
pnpm test
```

## Critical Testing Rules

- **NEVER run tests in watch mode** - causes system hang
- **Always verify file exists** with list_files before running tests
- **Use correct path format**: Remove `src/` prefix for core tests, keep for webview tests
- **Vitest config**: Looks for `**/__tests__/**/*.spec.ts` files
- **For verbose output**: Add `--no-silent` flag to see console logs

## Terminal Integration

- **WORKSPACE_ROOT Environment Variable**: All Kilo Code terminals automatically have `$WORKSPACE_ROOT` set to workspace root
- **Cross-platform**: Works on Windows (`%WORKSPACE_ROOT%`), macOS, and Linux (`$WORKSPACE_ROOT`)
