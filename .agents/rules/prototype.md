---
paths:
  - "Assets/_Prototypes/**"
---

# Prototype Code Standards (Unity Focus)

Prototypes are throwaway code for validating pathfinding ideas or UI concepts.
Standards are relaxed to maximize iteration speed, but must remain within the prototype scope.

## What's Allowed in Prototypes
- Hardcoded values (no need for `SimulationConfig`)
- Minimal or no doc comments
- Simple architecture (Singletons, direct references)
- Copy-pasted code for quick testing
- Debug logs and gizmos left in place
- Placeholder assets and quick-and-dirty UI

## What's Still Required
- Each prototype lives in its own subdirectory: `Assets/_Prototypes/[name]/`
- Every prototype MUST have a `README.md` with:
  - Hypothesis/Goal: what algorithm or UX is being tested?
  - How to run: which scene to open?
  - Findings: results of the test.
- No production code may reference or import from `_Prototypes/`
- Prototypes must not modify files outside their own directory

## When a Prototype Succeeds
If a concept is validated and moves to production:
1. The code is REWRITTEN to production standards (Zero-alloc, Decoupled, Unit-tested)
2. The prototype findings inform the official specification (`docs/specs/`)
3. The original prototype directory is preserved for reference or archived

## Cleanup
Concluded prototypes should be archived after findings are captured.
Never let prototype code grow into production code through incremental "cleanup."
