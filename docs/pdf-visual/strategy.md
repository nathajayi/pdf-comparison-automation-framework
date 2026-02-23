## Test Strategy

### Scope
- Visual comparison of rendered PDF pages
- Page count and bookmark validation

### Out of Scope
- OCR-based semantic validation
- Text-level equality checks

### Risks
- Rendering noise from regenerated PDFs
- Large documents impacting performance

### Mitigations
- Configurable thresholds
- Page-level diff metrics
- Explicit reporting of all discrepancies