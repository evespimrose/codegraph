---
paths:
  - "docs/specs/**"
---

# Specification & Documentation Rules

These rules ensure that the project's technical specifications and algorithms are well-documented and consistent with the implementation.

## Algorithm Documentation
- Every pathfinding algorithm (A*, Dijkstra, etc.) must have a corresponding `.md` file in `docs/specs/pathfinding/`.
- Specifications must include:
  - Input/Output data structures.
  - Heuristic function details.
  - Known limitations or edge cases.
  - Big O complexity analysis.

## Architecture Decision Records (ADR)
- Major architectural changes (e.g., switching to GPU Instancing, UI-Service separation) must be documented as an ADR.
- ADRs should state the context, the decision made, and the consequences (pros/cons).

## Consistency with Code
- When implementation changes, the corresponding specification MUST be updated.
- Use `docs/work.md` (작업 인수인계 로그) to record significant changes and their rationale for future sessions.
- Documentation should use clear, professional language (Korean as primary for logs, English/Korean for specs).

## Maintenance
- Stale documentation should be marked as `[DEPRECATED]` or moved to an archive folder.
- Every new feature must start with a `spec` update or a `plan` document.
