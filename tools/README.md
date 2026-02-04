# Testing Assets PowerShell Scripts

This folder contains two PowerShell scripts used to standardize and rename testing image assets so they match the filenames referenced by **Testing Questions JSON** (question types 1–4).

## Scripts

### 1) `convert_to_jpg.ps1`

Ensures images are available as `.jpg` by converting/renaming files in a folder (recursively).

Behavior:

- Skips `.gif` entirely.
- Skips `.jpg` (already correct).
- `.jpeg` and `.jfif` are already JPEG:
  - without `-InPlace`: copy to `.jpg`
  - with `-InPlace`: move/rename to `.jpg`
- All other formats (e.g. `.png`) are re-encoded to `.jpg` with `System.Drawing`.

Safety:

- Will not overwrite an existing `*.jpg` with the same basename; those files are skipped.
- With `-InPlace`, originals of re-encoded files are deleted after successful conversion.

Examples:

```powershell
# Non-destructive: create .jpg files next to originals
.\convert_to_jpg.ps1 -Directory "C:\project\assets\testing\zoo"

# Destructive: rename/convert and remove originals when applicable
.\convert_to_jpg.ps1 -Directory "C:\project\assets\testing\zoo" -InPlace

# Re-encode quality for non-JPEG sources (1..100)
.\convert_to_jpg.ps1 -Directory "C:\project\assets\testing\zoo" -JpegQuality 90
```

Notes:

- `System.Drawing` is best supported on Windows. If you need cross-platform conversion, use ImageMagick or similar tooling instead.

---

### 2) `rename_script.ps1` (a.k.a. `rename-testing-assets.ps1`)

Renames files in a folder to match filenames referenced by your JSON.

Supported question types:

- **Type 1 / Type 2** (multi-choice): rename files matched by `answers[].label`
  - Destination: `{questionId}-{answerId}{ext-from-answer.imagePath}`
- **Type 3** (scene)
  - Option B: `config.picture_path` → `{questionId}{ext}`
  - Option A: `config.pictures[].path` → `{questionId}-scene-{NN}{ext}`
- **Type 4** (single image): `imagePath` → `{questionId}{ext}`

Matching:

- Matching uses a normalization routine so filenames can be messy:
  - case-insensitive
  - diacritics removed (e.g. `č` → `c`)
  - punctuation ignored
  - spacing ignored

Special skip rule (Type 1/2):

- If the filename embedded in `answer.imagePath` is `<q>-<a>.<ext>` and `<q> < questionId`, that answer is ignored.
  - Example: `questionId=14` and `imagePath=".../5-4.jpg"` → skipped.

Safety:

- Will not overwrite destination files.
- Skips files already named correctly.
- Supports `-WhatIf` preview mode.

Examples:

```powershell
# Preview rename operations
.\rename_script.ps1 -FolderPath "C:\project\assets\testing\zoo" -JsonPath "C:\project\config\zoo.json" -WhatIf

# Apply rename operations
.\rename_script.ps1 -FolderPath "C:\project\assets\testing\zoo" -JsonPath "C:\project\config\zoo.json"
```

---

## Recommended pipeline

1. Convert everything to `.jpg` first (optional but reduces edge cases):

```powershell
.\convert_to_jpg.ps1 -Directory "C:\project\assets\testing\zoo"
```

2. Rename assets to match JSON:

```powershell
.\rename_script.ps1 -FolderPath "C:\project\assets\testing\zoo" -JsonPath "C:\project\config\zoo.json" -WhatIf
.\rename_script.ps1 -FolderPath "C:\project\assets\testing\zoo" -JsonPath "C:\project\config\zoo.json"
```
