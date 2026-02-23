# Reporting Specification – PDF Visual Comparison

## Purpose

The reporting layer is designed to make PDF comparison results **clear, auditable, and actionable**.

Rather than simply indicating pass/fail, the report explains:
- **What changed**
- **Where it changed**
- **How significant the change is**
- **Whether the change is structural or visual**

This enables informed decisions by QA, engineering, and stakeholders.

---

## Report Types

Each execution produces two report artifacts:

### 1. HTML Report (`report.html`)
Human-readable report intended for:
- Manual review
- Debugging
- Stakeholder sign-off

### 2. JSON Summary (`summary.json`)
Machine-readable report intended for:
- CI/CD consumption
- Trend analysis
- Future automation or dashboards

---

## HTML Report Structure

### Summary Table (Top Level)

For each PDF pair, the report includes:

| Field | Description |
|-----|------------|
| Pair Name | Logical identifier for the comparison |
| Baseline File | Name of the baseline PDF |
| Output File | Name of the output PDF |
| Result | PASS / FAIL |
| Page Count | Baseline vs Output page count |
| Pages with Differences | List of pages where diffs were detected |

This section provides an at-a-glance understanding of overall document health.

---

### Per-Page Difference Details

For each page with detected differences, the report shows:

| Field | Description |
|----|------------|
| Page Number | 1-based page index |
| Diff Metric | Pixel count and percentage difference |
| Baseline Thumbnail | Rendered baseline page image |
| Output Thumbnail | Rendered output page image |
| Diff Image | Highlighted visual differences |

Thumbnails link to full-resolution images to allow detailed inspection.

---

### Metadata Differences

If detected, the report also highlights **non-visual differences**, such as:

- Page count mismatches
- Bookmark (outline) additions, removals, or changes
- Page dimension mismatches

These differences are reported separately from visual diffs, as they often indicate
structural or semantic document changes.

---

## Pass / Fail Logic

A PDF pair is marked **FAIL** if **any** of the following conditions are met:

- Page count mismatch
- Bookmark (outline) structure mismatch
- One or more pages exceed the configured visual difference threshold

Otherwise, the pair is marked **PASS**.

The report always includes full details regardless of outcome.

---

## Visual Difference Metrics

Visual differences are quantified using:

- **Absolute pixel difference count**
- **Percentage difference relative to page dimensions**

This allows reviewers to distinguish between:
- Minor rendering noise (e.g., font anti-aliasing)
- Meaningful layout or content changes

---

## JSON Summary Structure

The `summary.json` file contains:

- Execution metadata
- One result object per PDF pair
- Per-page difference metrics
- Metadata differences (page count, bookmarks, dimensions)

This file is intended to support:
- CI assertions
- Trend tracking over time
- Integration with other quality systems

---

## Design Principles

The reporting system is built around the following principles:

- **Explainability**  
  Results should be understandable without inspecting raw images.

- **Auditability**  
  All artifacts (baseline, output, diff) are preserved and linked.

- **Transparency**  
  No differences are hidden or auto-suppressed.

- **Separation of concerns**  
  Visual diffs and structural metadata checks are reported independently.

---

## Intended Audience

- **QA Engineers / SDETs** – root cause analysis and debugging  
- **Developers** – identifying regressions in document generation  
- **Product / Stakeholders** – validating document correctness before release  

---

## Summary

The reporting layer transforms raw pixel comparisons into a **decision-support artifact**.

It ensures that PDF differences are:
- Visible
- Quantified
- Traceable
- Easy to reason about

This aligns the framework with real-world document quality and compliance needs.