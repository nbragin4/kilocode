# Code Review Workflow

## Critical Analysis Framework

This workflow prioritizes identifying architectural flaws, technical debt, and maintainability issues over superficial praise. Focus on problems that impact long-term codebase health.

## Review Phases

### 1. Architectural Assessment (Primary Focus)

**Critical Questions:**

- Does this change introduce unnecessary complexity or coupling?
- Are abstractions appropriate for the problem scope?
- Does the code follow established patterns or create new inconsistencies?
- Are there performance implications that haven't been addressed?
- Does this change make the system harder to test or debug?

**Red Flags:**

- Violation of single responsibility principle
- Tight coupling between unrelated components
- Missing error handling or inadequate failure modes
- Code duplication that should be abstracted
- Breaking changes without migration strategy
- Inconsistent naming or terminology across the codebase

### 2. Implementation Quality

**Focus Areas:**

- Type safety and null handling
- Resource management and memory leaks
- Concurrency issues and race conditions
- Security vulnerabilities
- Edge case handling

**Common Issues:**

- Functions exceeding 20 lines without clear justification
- Missing unit tests for complex logic
- Inadequate input validation
- Hardcoded values that should be configurable
- Poor error messages that don't aid debugging

### 3. Technical Debt Assessment

**Debt Indicators:**

- TODO comments without tracking tickets
- Commented-out code blocks
- Temporary workarounds becoming permanent
- Inconsistent code style within the same module
- Missing documentation for complex algorithms

## Review Response Structure

### Required Sections

1. **Critical Issues** (Must Fix)

    - Architectural problems that affect system stability
    - Security vulnerabilities
    - Performance bottlenecks
    - Breaking changes without proper handling

2. **Significant Concerns** (Should Fix)

    - Code quality issues that impact maintainability
    - Missing test coverage for critical paths
    - Inconsistencies with established patterns
    - Potential future scalability problems

3. **Minor Issues** (Consider Fixing)
    - Style inconsistencies
    - Optimization opportunities
    - Documentation gaps

### Response Tone Guidelines

**Avoid:**

- Excessive praise ("Great job!", "Excellent work!")
- Vague feedback ("This looks good")
- Nitpicking without architectural justification

**Use:**

- Direct, specific feedback
- Clear rationale for requested changes
- References to established patterns or principles
- Concrete examples of better approaches

## Architecture-Specific Concerns

### For Ghost System Changes

- Does this maintain the separation between strategies and profiles?
- Are VSCode API dependencies properly abstracted?
- Is the change compatible with the benchmark system?
- Does this affect the streaming parser's reliability?

### For API Provider Changes

- Is error handling consistent across providers?
- Are rate limits and quotas properly managed?
- Is the format transformation layer maintained?
- Are provider-specific quirks properly isolated?

### For Service Layer Changes

- Does this maintain loose coupling between services?
- Are dependencies injected rather than hardcoded?
- Is the service interface consistent with others?
- Are lifecycle management concerns addressed?

## Approval Criteria

**Approve When:**

- All critical issues are resolved
- Architectural concerns are addressed
- Test coverage is adequate for the change scope
- Documentation is updated for public APIs

**Request Changes When:**

- Critical architectural flaws exist
- Security vulnerabilities are present
- Breaking changes lack proper migration
- Test coverage is insufficient for complex logic

**Conditional Approval When:**

- Minor issues exist but don't affect core functionality
- Style inconsistencies are present but isolated
- Documentation could be improved but isn't missing

## Post-Review Actions

1. **Track Technical Debt**: Document any accepted compromises
2. **Update Architecture Docs**: Reflect significant design decisions
3. **Monitor Performance**: Watch for regressions in critical paths
4. **Follow Up**: Ensure promised improvements are delivered

## Common Anti-Patterns to Flag

- God objects that handle too many responsibilities
- Circular dependencies between modules
- Leaky abstractions that expose implementation details
- Magic numbers or strings without explanation
- Copy-paste code instead of proper abstraction
- Synchronous operations that should be asynchronous
- Missing cleanup in resource-intensive operations

This workflow emphasizes substance over politeness, focusing on the architectural and technical issues that truly matter for codebase health.
