---
paths:
  - "Assets/Core/Scripts/Pathfinding/Domain/**"
  - "Assets/Core/Scripts/Pathfinding/Service/**"
---

# Simulation & Algorithm Rules

- ALL simulation parameters (Grid size limits, Pipe costs) MUST come from external config, NEVER hardcoded
- Pathfinding results must be Deterministic — same input/seed must yield same output
- Simulation logic must be decoupled from `MonoBehaviour` where possible (Pure C# Classes)
- NO direct references to UI code — use `Action` or `IObservable` for state change notifications
- Every algorithm (A*, DDA) must implement a clear interface for swappability
- Write unit tests for pathfinding edge cases (isolated cells, 1x1x1 grids, etc.)
- Document which specification file (`docs/specs/`) each logic implements
- Simulation state (CellGrid) should be the single source of truth for the renderer

## Examples

**Correct** (Deterministic & Decoupled):

```csharp
public class PathSolver {
    private readonly SimulationConfig _config;
    public PathSolver(SimulationConfig config) => _config = config;

    public PathResult Solve(Vector3Int start, Vector3Int end) {
        // Pure logic using _config.PipeCost...
    }
}
```

**Incorrect** (Hardcoded & UI Coupled):

```csharp
public class Solver : MonoBehaviour {
    public void Run() {
        float cost = 1.5f; // VIOLATION: hardcoded value
        GameObject.Find("ResultUI").GetComponent<Text>().text = "Solving..."; // VIOLATION: UI coupling
    }
}
```
