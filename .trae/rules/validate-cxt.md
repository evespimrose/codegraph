
# Validate CXT Rules

**Mandatory** — applies to every task that creates or edits context files (cxt[N].md) in the project.

## Rule 1 — BLK Tag Required on Line 2
- **Format**: Line 2 must be `&lt;!-- BLK: BLK-XXX --&gt;`
- **Examples**: `&lt;!-- BLK: BLK-005, BLK-006 --&gt;` or `&lt;!-- BLK: 인프라 --&gt;`
- **Error case**: Invalid if line 2 is empty or missing BLK tag

## Rule 2 — BLK Tag Content Rules
- **Code block targets**: Numeric format like `BLK-001`, `BLK-002`
- **Infrastructure targets**: hook/skill/documentation work → `BLK: 인프라`
- **Multiple BLK targets**: Multiple blocks separated by commas: `BLK: BLK-001, BLK-005`

## Rule 3 — Dictionary Link Validation
- If numeric BLK is in BLK tag, check if BLK exists in § 1
- Warn that § 1 needs update if BLK not in dictionary

## Rule 4 — Validation Process
1. Check cxt file exists → error if not
2. Read line 2 → match BLK tag pattern
3. BLK tag exists → dictionary § 1 search
4. All conditions satisfied → OK (exit 0)
5. Conditions not satisfied → error message + exit 1

## Validation Scripts (for Execution)
- **Windows**: `.trae/hooks/validate-cxt.ps1`
- **Linux/macOS**: `.trae/hooks/validate-cxt.sh`
- **Usage**: Called automatically by context-sharer or run manually
