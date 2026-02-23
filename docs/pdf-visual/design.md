## Design Overview

Rendering, comparison, and reporting are intentionally decoupled to allow:
- Swapping renderers without impacting diff logic
- Independent tuning of thresholds
- Easy CI integration

Each comparison produces immutable artifacts to support auditability and traceability.