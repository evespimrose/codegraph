# Validate CXT Rules

**Mandatory** — applies to every task that creates or edits context files (cxt[N].md) in the project.

## Rule 1 — BLK Tag Required on Line 2
- **Format**: Line 2 must be `<!-- BLK: BLK-XXX -->`
- **Examples**: `<!-- BLK: BLK-005, BLK-006 -->` or `<!-- BLK: 인프라 -->`
- **Error case**: Invalid if line 2 is empty or missing BLK tag

## Rule 2 — BLK Tag Content Rules
- **Code block targets**: Numeric format like `BLK-001`, `BLK-002`
- **Infrastructure targets**: hook/skill/documentation work → `<!-- BLK: 인프라 -->`
- **Multiple BLK targets**: Multiple blocks separated by commas: `<!-- BLK: BLK-001, BLK-005 -->`

## Rule 3 — Dictionary Link Validation
- If numeric BLK is in BLK tag, check if BLK exists in `manage/dictionary.md` § 1
- Warn that § 1 needs update if BLK not in dictionary
- **Non-blocking**: Warning only — does not fail validation

## Rule 4 — Validation Process (No Recursion)
1. Check cxt file exists → error if not
2. Read line 2 → match BLK tag pattern
3. Validate BLK tag syntax is correct
4. **EXIT IMMEDIATELY** → Do not re-run validation or call context-sharer again
5. All conditions satisfied → SUCCESS (exit 0)
6. Conditions not satisfied → error message (exit 1) — do NOT retry

## Rule 5 — Infinite Loop Prevention
- **context-sharer MUST NOT call validate-cxt more than once per cxt file creation**
- **If validate fails**: Return error to user, do NOT automatically retry
- **If plan-scope requires new cxt**: user must explicitly request new cxt file creation
- **Max validation attempts per session**: 1 per cxt file

## Validation Scripts (for Execution)
- **Windows**: `.trae/hooks/validate-cxt.ps1`
- **Linux/macOS**: `.trae/hooks/validate-cxt.sh`
- **Usage**: Called automatically by context-sharer after file creation (max 1 time)
- **Failure handling**: Log error, return exit 1, halt — do NOT loop

## Success/Failure Matrix

| Condition | Outcome | Exit Code | Action |
|-----------|---------|-----------|--------|
| cxt file exists + Line 2 has BLK tag | ✅ PASS | 0 | Exit validation |
| cxt file missing | ❌ FAIL | 1 | Error message, halt |
| Line 2 empty or malformed | ❌ FAIL | 1 | Error message, halt |
| BLK tag syntax invalid | ❌ FAIL | 1 | Error message, halt |
| BLK numeric ref not in dictionary | ⚠️ WARN | 0 | Warning logged, continue |
| Any validation fails | ❌ FAIL | 1 | Halt immediately, do NOT retry |
