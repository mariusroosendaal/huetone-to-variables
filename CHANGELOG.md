# Changelog

## [Unreleased] - 2026-05-09

### Fixed

- Variable alias values no longer cause silent overwrites — alias mode values are now skipped when comparing colors
- Malformed hex strings in the JSON payload are now skipped instead of writing NaN color values
- JSON payload is structurally validated before iteration; non-object shades and null color entries are skipped gracefully
- `getVariableCollectionByIdAsync` is now called at most once per collection (not once per variable), fixing redundant async calls during option population
- Import button is now disabled when the JSON field is empty or no collection is specified, preventing the no-op error path
- Import button is disabled while an import is in progress, preventing double-submit
- Per-variable "Overwriting:" notifications removed; a single success notification is shown instead
- Success notification now includes "Press Cmd+Z to undo."
- Error paths in `generate-variables` now post a `done` message so the button re-enables on failure
- `populateOptions` error path now posts an empty options list so the UI unblocks rather than waiting indefinitely

### Added

- `overwrite` toggle and selected collection are saved to `clientStorage` and restored on next open
- Hint text shown below the collection dropdown when no variable collections exist in the document

### Changed

- Huetone JSON textarea and new collection name input have associated labels
- Select collection dropdown has an accessible name
