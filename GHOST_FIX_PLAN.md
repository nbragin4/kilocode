# Ghost System Fix Plan - TDD Approach

## Priority 1: Mercury Line Number Parsing (CRITICAL)

### Issue

Mercury responses contain line numbers in format `N|` or `N |` (with optional space before pipe) that aren't being stripped correctly.

**Example from benchmark:**

```
<|code_to_edit|>
9|    user.active
10|];
<|/code_to_edit|>
```

**Current regex**: `/^\d+\|\s?/` - Only matches `N|` at start of line
**Problem**: Doesn't match `N |` (space before pipe)

### TDD Steps

1. ✅ Write failing test for `9|` format (space before pipe)
2. ✅ Write failing test for `10|]` format (line number with content)
3. Fix regex pattern to handle both formats
4. Verify all tests pass
5. Run benchmarks to confirm fix

### Files to Modify

- [`src/services/ghost/strategies/MercuryStrategy.ts:450`](src/services/ghost/strategies/MercuryStrategy.ts:450) - Update `stripLineNumbers()` regex
- [`src/services/ghost/strategies/__tests__/MercuryLineNumberStripping.spec.ts`](src/services/ghost/strategies/__tests__/MercuryLineNumberStripping.spec.ts) - Add new test cases

---

## Priority 2: FIM Context Loss

### Issue

FIM strategy sometimes loses surrounding context (e.g., `const response =` becomes just the value).

**Example from benchmark:**

```
Input: const response = ␣
Output: await fetch(...)
Expected: const response = await fetch(...)
```

### TDD Steps

1. Write test for context preservation
2. Investigate FIM response format
3. Fix context application logic
4. Verify tests pass

### Files to Check

- FIM strategy implementation
- Response parsing logic

---

## Priority 3: Hole-Filler XML Tag Cleanup

### Issue

Hole-Filler responses sometimes include `</COMPLETION>` tag in output.

**Example:**

```
map(user => user.name)</COMPLETION>
```

### TDD Steps

1. Write test for XML tag stripping
2. Add cleanup logic to Hole-Filler parser
3. Verify tests pass

---

## Priority 4: Legacy-XML Verbosity Stripping

### Issue

Legacy-XML includes explanatory text that needs to be stripped.

### TDD Steps

1. Write test for verbose response handling
2. Implement text stripping logic
3. Verify tests pass

---

## Priority 5: GhostTestHarness Mercury Execution

### Issue

5 Mercury strategy tests failing in GhostTestHarness with `success: false`.

### Investigation Steps

1. Debug why harness returns false for Mercury
2. Check mock response format compatibility
3. Fix harness or test setup
4. Verify all 5 tests pass

---

## Priority 6: Snapshot Updates

### Issue

3 snapshot tests need updating after recent changes.

### Steps

1. Review snapshot diffs
2. Update snapshots if changes are correct
3. Verify tests pass

---

## Priority 7: Whitespace Normalization

### Issue

Extra newlines being added in some completions.

### Steps

1. Identify source of extra newlines
2. Add normalization logic
3. Write tests
4. Verify fixes

---

## Execution Order

1. **Mercury Line Numbers** (CRITICAL - affects all Mercury completions)
2. **GhostTestHarness** (blocks 5 tests)
3. **FIM Context Loss** (quality issue)
4. **Hole-Filler XML** (quality issue)
5. **Legacy-XML Verbosity** (quality issue)
6. **Snapshots** (maintenance)
7. **Whitespace** (polish)

## Success Criteria

- ✅ All unit tests passing (4288/4288)
- ✅ All benchmarks passing (32/32)
- ✅ No line numbers in Mercury output
- ✅ No XML tags in Hole-Filler output
- ✅ Proper context preservation in FIM
- ✅ Clean Legacy-XML output
