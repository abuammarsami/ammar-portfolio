---
status: active
---

## Intro

The resume PDF on this site is compiled from LaTeX source in CI — the same
pipeline that writes this manifest. If the copy you hold matches the numbers
below, it is the canonical build, unmodified.

## How to verify

1. The build hash printed in the PDF footer must equal the **build version**
   shown above.
2. `shasum -a 256 resume.pdf` must equal the sha256 above.
3. `pdfdetach -saveall resume.pdf` extracts the embedded machine-readable
   `resume.json`.
