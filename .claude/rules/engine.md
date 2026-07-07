---
paths:
  - "Assets/Core/Scripts/**"
---

# Core Engine & Simulation Rules

- ZERO allocations in hot paths (A* Search, Grid Updates, Rendering) — pre-allocate and REUSE collections (List, Array). DO NOT use Object Pooling for visual elements (prefer GPU Instancing).
- All simulation logic must be thread-safe where applicable OR explicitly documented
- Profile before AND after every optimization — document measured performance (e.g., cell update time)
- Simulation code must NEVER depend on UI/Presentation code (Strict: Domain/Service <- Presentation)
- Every algorithm implementation must have complexity (Big O) documented in comments
- Use `UniTask` for asynchronous operations (Grid Generation, Solve Routine) to prevent frame blocking and maintain responsive GPU-Instancing interaction.
- STRICTLY PROHIBIT the use of `UniTaskVoid`. All async methods must return `UniTask` or `UniTask<T>` and be properly awaited or handled via `Forget()` with a documented reason (though awaiting is preferred for traceability).
- Before modifying pathfinding logic, consult `docs/specs/pathfinding/` for algorithm specifications

## Examples

**Correct** (Zero-alloc & Cached Property ID):

```csharp
private static readonly int baseColorId = Shader.PropertyToID("_BaseColor");

// Reuse list to avoid allocation in loop
private List<Cell> neighborCache = new List<Cell>(6);

public void UpdateVisuals(MaterialPropertyBlock mpb) {
    neighborCache.Clear();
    // Logic using cached list...
}
```

**Incorrect** (Allocation in simulation loop):

```csharp
void Update() {
    var nodes = new List<Node>(); // VIOLATION: allocation in hot path
    foreach(var n in FindObjectsOfType<Node>()) { // VIOLATION: heavy engine call
        // ...
    }
}
```
