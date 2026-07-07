---
paths:
  - "Assets/Core/Shaders/**"
---

# Shader & Rendering Standards (GPU Instancing Focus)

All shaders must be optimized for large-scale grid rendering using GPU Instancing.

## Naming Conventions
- File naming: `[Pipeline]_[Category]_[Name].shader`
  - e.g., `URP_Grid_Cell.shader`
- Prefix with render pipeline: `URP_`, `HDRP_`, `Legacy_`

## Code Quality & Instancing
- All shaders MUST support `GPU Instancing` (Use `#pragma multi_compile_instancing`)
- Use `UNITY_INSTANCING_BUFFER_START/END` for per-instance data (Color, Alpha, State)
- Group related parameters using `[Header]` or `[Space]` attributes in the inspector
- Comment non-obvious math, especially coordinate transformations (Grid -> World)
- No magic numbers — use named constants or `MaterialPropertyBlock` values

## Performance Requirements
- Use `MaterialPropertyBlock` for per-cell visual updates (Color, Alpha) to avoid material leaks
- Minimize texture samples; prefer vertex-color or buffer-data for cell states
- Avoid dynamic branching in fragment shaders — use `step()`, `lerp()`, `smoothstep()`
- Test performance with maximum grid size (e.g., 80x80x80 = 512,000 cells)

## Built-in Pipeline Compatibility
- Shaders must be written in CG/HLSL and compatible with the Built-in Render Pipeline
- Include core libraries: `#include "UnityCG.cginc"`
- Document the Render Queue and ZTest settings (important for Layer Focus modes)

## Variant Management
- Minimize shader variants to reduce build size and memory footprint
- Use `#pragma shader_feature` only for global settings, `#pragma multi_compile` for runtime changes
- Log and monitor total variant count during build
