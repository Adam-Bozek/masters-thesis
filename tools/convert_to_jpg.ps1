<#
convert-to-jpg.ps1

Purpose
- Walk a directory recursively and ensure image files end up as ".jpg".
- Special handling:
  - Never touches GIFs.
  - ".jpeg" and ".jfif" are already JPEG → rename/copy to ".jpg" without re-encoding.
  - Other raster formats (e.g., .png, .bmp) are re-encoded to JPEG using System.Drawing.

Safety/behavior
- Will NOT overwrite an existing "<same basename>.jpg". Those files are skipped.
- With -InPlace:
  - ".jpeg/.jfif" are renamed to ".jpg"
  - non-JPEG sources are converted and the original is deleted after successful conversion
- Without -InPlace:
  - outputs are created alongside originals; originals remain unchanged

Requirements
- PowerShell
- Windows (recommended): System.Drawing is supported.
  On non-Windows, System.Drawing may be unsupported or require extra setup.

Examples
  # Create .jpg copies next to originals (non-destructive)
  .\convert_to_jpg.ps1 -Directory "C:\path\to\images"

  # Convert/rename in place (destructive for non-JPEG sources)
  .\convert_to_jpg.ps1 -Directory "C:\path\to\images" -InPlace

  # Control JPEG quality for re-encoded sources (1..100)
  .\convert_to_jpg.ps1 -Directory "C:\path\to\images" -JpegQuality 90
#>

param(
  # Root folder to process (recursively).
  [Parameter(Mandatory = $true)]
  [string]$Directory,

  # If set:
  # - ".jpeg/.jfif" are moved to ".jpg"
  # - non-JPEG files are converted to ".jpg" and originals are deleted after a successful save
  [switch]$InPlace,

  # Used ONLY when re-encoding non-JPEG formats to JPEG.
  # (Renaming ".jpeg/.jfif" does not use this.)
  [ValidateRange(1, 100)]
  [int]$JpegQuality = 92
)

# Strict mode = fail fast on common PowerShell foot-guns (undefined vars, etc.)
Set-StrictMode -Version Latest
# Treat all errors as terminating, so try/catch behaves predictably.
$ErrorActionPreference = "Stop"

# Validate input folder.
if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
  throw "Directory not found: $Directory"
}

# System.Drawing is used to decode/encode images for conversion.
Add-Type -AssemblyName System.Drawing

function Save-AsJpeg {
  <#
    Re-encodes an image to JPEG with a specific quality setting.

    Notes
    - This is called only for formats that are NOT already JPEG.
    - Disposes the image object to avoid file locks and memory leaks.
  #>
  param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$OutputPath,
    [Parameter(Mandatory = $true)][int]$Quality
  )

  # Load the image from disk. This can throw on corrupt/unsupported files.
  $img = [System.Drawing.Image]::FromFile($InputPath)
  try {
    # Find the JPEG encoder.
    $jpgCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
    Where-Object { $_.MimeType -eq "image/jpeg" } |
    Select-Object -First 1

    # Configure encoder parameters: JPEG quality (0..100; we validate 1..100 above).
    $encParams = New-Object System.Drawing.Imaging.EncoderParameters 1
    $encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
      [System.Drawing.Imaging.Encoder]::Quality,
      [long]$Quality
    )

    # Save as JPEG.
    $img.Save($OutputPath, $jpgCodec, $encParams)
  }
  finally {
    # Always release file handles.
    $img.Dispose()
  }
}

# Process files recursively.
# - Skip GIF entirely.
# - Skip .jpg since it's already the desired extension.
Get-ChildItem -LiteralPath $Directory -Recurse -File | ForEach-Object {
  $ext = $_.Extension.ToLowerInvariant()

  if ($ext -eq ".gif") { return }     # never touch gifs
  if ($ext -eq ".jpg") { return }     # already .jpg

  # Compute the target output path with ".jpg" extension.
  $outPath = [System.IO.Path]::ChangeExtension($_.FullName, ".jpg")

  # If a target already exists, skip to avoid accidental overwrites.
  if (Test-Path -LiteralPath $outPath) { return }

  try {
    # ".jpeg" and ".jfif" are already JPEG.
    # No need to re-encode; just rename/copy to ".jpg".
    if ($ext -eq ".jpeg" -or $ext -eq ".jfif") {
      if ($InPlace) {
        Move-Item -LiteralPath $_.FullName -Destination $outPath
        Write-Host "Renamed: $($_.FullName) -> $outPath"
      }
      else {
        Copy-Item -LiteralPath $_.FullName -Destination $outPath
        Write-Host "Copied:  $($_.FullName) -> $outPath"
      }
      return
    }

    # For all other formats, attempt re-encode to JPEG.
    Save-AsJpeg -InputPath $_.FullName -OutputPath $outPath -Quality $JpegQuality
    Write-Host "Converted: $($_.FullName) -> $outPath"

    # If requested, delete the original after successful conversion.
    if ($InPlace) {
      Remove-Item -LiteralPath $_.FullName -Force
    }
  }
  catch {
    # Non-terminating reporting for individual files.
    # (Global $ErrorActionPreference is Stop; try/catch prevents script from aborting here.)
    Write-Warning "Failed: $($_.FullName) ($($_.Exception.Message))"
  }
}
