<#
rename-testing-assets.ps1

Purpose
- Renames image/gif files in a folder to match your "Testing Questions JSON" naming convention (question types 1–4).

High-level workflow
1) Load JSON (array of questions).
2) Build a lookup map: "normalized key" -> "destination filename".
3) Enumerate files in the target folder and rename any file whose normalized base name exists in the map.

What it renames
- Type 1/2 (multi-choice):
  - Uses answers[].label as the matching key.
  - Destination: "{questionId}-{answerId}{ext-from-answer.imagePath}"
- Type 3 (scene):
  Option B:
    - config.picture_path → destination "{questionId}{ext}"
  Option A:
    - config.pictures[].path (array order) → destination "{questionId}-scene-{NN}{ext}" (NN = 01,02,03…)
- Type 4 (single picture / naming):
  - imagePath → destination "{questionId}{ext}"

Matching rules (key normalization)
- All matching is done via Normalize-Name() which:
  - lowercases
  - removes diacritics (č/ď/ľ/… become c/d/l/…)
  - removes punctuation
  - collapses spaces
  - removes spaces entirely
This makes matching insensitive to case/diacritics/punctuation/spacing.

Special skip rule for Type 1/2 answers
- If the number inside answer.imagePath filename ("<q>-<a>.<ext>") is LESS than parent questionId → skip mapping.
  Example:
    questionId=14
    answer.imagePath=".../5-4.jpg"
    => mapping is skipped

Safety / non-destructive behaviors
- Does NOT overwrite an existing destination file.
- If a file is already named correctly, it is skipped.
- Supports -WhatIf to preview renames.

Usage
  # Preview changes
  .\rename_script.ps1 -FolderPath "C:\...\testing\zoo" -JsonPath "C:\...\zoo.json" -WhatIf

  # Apply changes
  .\rename_script.ps1 -FolderPath "C:\...\testing\zoo" -JsonPath "C:\...\zoo.json"
#>

param(
  # Folder containing images to rename (non-recursive).
  [Parameter(Mandatory = $true)]
  [string]$FolderPath,

  # JSON file path: array of questions in the schema you described (types 1–4).
  [Parameter(Mandatory = $true)]
  [string]$JsonPath,

  # If set, Rename-Item is called with -WhatIf so nothing actually changes.
  [switch]$WhatIf
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Normalize-Name([string]$s) {
  <#
    Converts an arbitrary label/filename base to a stable "matching key".

    Steps
    - Trim
    - Lowercase
    - Unicode normalize to FormD, then strip NonSpacingMarks (diacritics)
    - Normalize back to FormC
    - Replace any non [a-z0-9] with spaces
    - Collapse whitespace and remove all spaces

    Result: "Mašľa / gumička" → "maslagumicka"
  #>
  if ([string]::IsNullOrWhiteSpace($s)) { return "" }

  $t = $s.Trim().ToLowerInvariant().Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($ch in $t.ToCharArray()) {
    $cat = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($ch)
    if ($cat -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$sb.Append($ch)
    }
  }
  $t = $sb.ToString().Normalize([Text.NormalizationForm]::FormC)

  $t = ($t -replace "[^a-z0-9]+", " ").Trim()
  $t = ($t -replace "\s+", " ")
  return ($t -replace " ", "")
}

function Get-PathFilenameParts([string]$p) {
  <#
    Extracts filename + extension from a JSON path.

    Input:  "/images/testing/zoo/1-2.jpg"
    Output: @{ File="1-2.jpg"; Ext=".jpg" }
  #>
  $f = [IO.Path]::GetFileName($p)
  return @{
    File = $f
    Ext  = ([IO.Path]::GetExtension($f))
  }
}

function Get-ImageQuestionNoFromPath([string]$imagePath) {
  <#
    Parses "<q>-<a>.<ext>" from an imagePath and returns q as int.
    Returns $null if the filename does not match the expected pattern.
  #>
  $file = [IO.Path]::GetFileName($imagePath)
  $m = [regex]::Match($file, '^(?<q>\d+)-(?<a>\d+)\.[^\.]+$')
  if (-not $m.Success) { return $null }
  return [int]$m.Groups["q"].Value
}

# Validate input paths.
if (-not (Test-Path -LiteralPath $FolderPath)) {
  throw "FolderPath not found: $FolderPath"
}
if (-not (Test-Path -LiteralPath $JsonPath)) {
  throw "JsonPath not found: $JsonPath"
}
if ((Get-Item -LiteralPath $JsonPath).PSIsContainer) {
  throw "JsonPath must be a file path (e.g. C:\...\marketplace.json), not a folder: $JsonPath"
}

# Load JSON into PowerShell objects.
$json = Get-Content -LiteralPath $JsonPath -Raw -Encoding UTF8 | ConvertFrom-Json

# Build mapping: normalizedKey -> destination filename
# Key sources by type:
# - Type 1/2: answer.label
# - Type 3: filename bases in config.picture_path and config.pictures[].path
# - Type 4: base from imagePath, and (optionally) questionText
$map = @{}

function Add-Map([hashtable]$h, [string]$key, [string]$dest) {
  <#
    Adds a map entry only if the key does not already exist.
    This makes behavior stable when multiple candidates normalize to the same key.
  #>
  if ([string]::IsNullOrWhiteSpace($key)) { return }
  if (-not $h.ContainsKey($key)) { $h[$key] = $dest }
}

# 1) Build map from JSON.
foreach ($q in $json) {
  if ($null -eq $q.questionId -or $null -eq $q.questionType) { continue }
  $qid = [int]$q.questionId
  $qt = [int]$q.questionType

  switch ($qt) {
    1 {
      # Type 1: multi-choice using answers[].label
      foreach ($a in ($q.answers | ForEach-Object { $_ })) {
        if ($null -eq $a) { continue }

        # Apply your skip rule based on the "<q>-<a>" embedded in imagePath filename.
        $imgQ = Get-ImageQuestionNoFromPath $a.imagePath
        if ($null -eq $imgQ) { continue }
        if ($imgQ -lt $qid) { continue }

        # Destination extension is taken from JSON imagePath, not from the source file.
        $parts = Get-PathFilenameParts $a.imagePath
        $ext = $parts.Ext
        if ([string]::IsNullOrWhiteSpace($ext)) { continue }

        $dest = ("{0}-{1}{2}" -f $qid, [int]$a.answerId, $ext.ToLowerInvariant())

        # Map from normalized label to destination.
        Add-Map $map (Normalize-Name $a.label) $dest
      }
    }

    2 {
      # Type 2: same handling as type 1.
      foreach ($a in ($q.answers | ForEach-Object { $_ })) {
        if ($null -eq $a) { continue }

        $imgQ = Get-ImageQuestionNoFromPath $a.imagePath
        if ($null -eq $imgQ) { continue }
        if ($imgQ -lt $qid) { continue }

        $parts = Get-PathFilenameParts $a.imagePath
        $ext = $parts.Ext
        if ([string]::IsNullOrWhiteSpace($ext)) { continue }

        $dest = ("{0}-{1}{2}" -f $qid, [int]$a.answerId, $ext.ToLowerInvariant())
        Add-Map $map (Normalize-Name $a.label) $dest
      }
    }

    3 {
      # Type 3: scene question.
      # Option B: single picture_path (one file per question)
      if ($null -ne $q.config -and $null -ne $q.config.picture_path) {
        $parts = Get-PathFilenameParts $q.config.picture_path
        $ext = $parts.Ext
        if (-not [string]::IsNullOrWhiteSpace($ext)) {
          $dest = ("{0}{1}" -f $qid, $ext.ToLowerInvariant())

          # Matching is based on the base filename you already have in the folder.
          # Example: "story.jpg" in folder + JSON picture_path ".../story.jpg" → "12.jpg"
          $baseFromJson = [IO.Path]::GetFileNameWithoutExtension($parts.File)
          Add-Map $map (Normalize-Name $baseFromJson) $dest
        }
      }

      # Option A: multiple pictures[] (sequence of scene frames)
      if ($null -ne $q.config -and $null -ne $q.config.pictures) {
        $i = 0
        foreach ($p in ($q.config.pictures | ForEach-Object { $_ })) {
          if ($null -eq $p -or $null -eq $p.path) { continue }
          $i++

          $parts = Get-PathFilenameParts $p.path
          $ext = $parts.Ext
          if ([string]::IsNullOrWhiteSpace($ext)) { continue }

          $nn = $i.ToString("D2")
          $dest = ("{0}-scene-{1}{2}" -f $qid, $nn, $ext.ToLowerInvariant())

          # Again: match by base filename already in folder.
          $baseFromJson = [IO.Path]::GetFileNameWithoutExtension($parts.File)
          Add-Map $map (Normalize-Name $baseFromJson) $dest
        }
      }
    }

    4 {
      # Type 4: one image per question (imagePath → "{questionId}{ext}")
      if ($null -eq $q.imagePath) { continue }
      $parts = Get-PathFilenameParts $q.imagePath
      $ext = $parts.Ext
      if ([string]::IsNullOrWhiteSpace($ext)) { continue }

      $dest = ("{0}{1}" -f $qid, $ext.ToLowerInvariant())

      # Primary: base from JSON imagePath filename (without extension).
      $baseFromJson = [IO.Path]::GetFileNameWithoutExtension($parts.File)
      Add-Map $map (Normalize-Name $baseFromJson) $dest

      # Optional: also allow matching by questionText if your source files are named that way.
      if ($null -ne $q.questionText) {
        Add-Map $map (Normalize-Name $q.questionText) $dest
      }
    }

    default {
      # Unknown questionType: ignored.
    }
  }
}

# 2) Enumerate local files (non-recursive) and rename when a mapping exists.
$files = Get-ChildItem -LiteralPath $FolderPath -File |
Where-Object { $_.Extension.ToLowerInvariant() -in @(".jpg", ".jpeg", ".png", ".gif") }

$renamed = 0
$skipped = 0
$noMap = 0

foreach ($f in $files) {
  # Matching key is derived from the current filename base.
  $base = [IO.Path]::GetFileNameWithoutExtension($f.Name)
  $key = Normalize-Name $base

  if (-not $map.ContainsKey($key)) {
    $noMap++
    Write-Host ("NO MAP: {0}" -f $f.Name)
    continue
  }

  $destName = $map[$key]

  # If already named exactly (case-insensitive), skip.
  if ($f.Name -ieq $destName) {
    $skipped++
    Write-Host ("OK: {0} (already named)" -f $f.Name)
    continue
  }

  # Never overwrite existing destination files.
  $destPath = Join-Path $FolderPath $destName
  if (Test-Path -LiteralPath $destPath) {
    $skipped++
    Write-Host ("SKIP (dest exists): {0} -> {1}" -f $f.Name, $destName)
    continue
  }

  # Perform rename (or preview with -WhatIf).
  Write-Host ("RENAME: {0} -> {1}" -f $f.Name, $destName)
  Rename-Item -LiteralPath $f.FullName -NewName $destName -WhatIf:$WhatIf
  $renamed++
}

Write-Host ""
Write-Host ("Done. Renamed={0}, Skipped={1}, NoMap={2}" -f $renamed, $skipped, $noMap)
