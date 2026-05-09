# Changelog

## [Unreleased] - 2026-05-09

### Added

- Prism palette format (GitHub Primer) now supported alongside Huetone — format is auto-detected from the JSON structure; no extra configuration needed
- Plugin window resizes when the new collection name input is revealed
- `overwrite` toggle and selected collection are saved to `clientStorage` and restored on next open

### Changed

- Collection selection redesigned: the dropdown now includes "Create new collection…" as its last option, revealing a name input only when selected — replaces the always-visible separate field
- JSON textarea label changed to "Color JSON" to reflect multi-format support
- Collection fetches in `populateOptions` now run in parallel via `Promise.all`
- `done` message moved to a `finally` block in `generate-variables`, ensuring the button always re-enables after any failure
- Error messages are less technical and more actionable
- Import button tooltip is now format-agnostic

### Fixed

- Variable alias values no longer cause silent overwrites — alias mode values are now skipped when comparing colors
- Malformed hex strings in the JSON payload are now skipped instead of writing NaN color values
- JSON payload is structurally validated before iteration; non-object shades and null color entries are skipped gracefully
- Import button is now disabled when the JSON field is empty or no collection is specified, preventing the no-op error path
- Import button is disabled while an import is in progress, preventing double-submit
- Per-variable "Overwriting:" notifications removed; a single success notification is shown instead
- Success notification now includes "Press Ctrl/Cmd+Z to undo."
- `populateOptions` error path now posts an empty options list so the UI unblocks rather than waiting indefinitely

### Accessibility

- Added `<title>` to `index.html`
- Import button uses `ariaDisabled` and a `Tooltip` with a context-aware reason when unavailable
- Huetone JSON textarea and new collection name input have associated labels
- Select collection dropdown has an accessible name
