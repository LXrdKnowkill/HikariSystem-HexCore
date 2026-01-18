# HikariSystem HexCore - Script de Conversao de Icones
# Este script converte BatHexCore.png para os formatos necessarios

$ErrorActionPreference = "Stop"
$RootDir = Split-Path -Parent $PSScriptRoot
$SourceImage = Join-Path $RootDir "BatHexCore.png"

Write-Host "[BAT] HikariSystem HexCore - Conversor de Icones" -ForegroundColor Magenta
Write-Host "================================================" -ForegroundColor DarkMagenta

# Verificar se o arquivo fonte existe
if (-not (Test-Path $SourceImage)) {
    Write-Error "Arquivo BatHexCore.png nao encontrado em $SourceImage"
    exit 1
}

Write-Host "[OK] Arquivo fonte encontrado: $SourceImage" -ForegroundColor Green

# Funcao para criar ICO usando .NET
function Convert-ToIco {
    param(
        [string]$SourcePath,
        [string]$DestPath,
        [int[]]$Sizes = @(16, 32, 48, 256)
    )

    Add-Type -AssemblyName System.Drawing

    $sourceImage = [System.Drawing.Image]::FromFile($SourcePath)
    $iconMemory = New-Object System.IO.MemoryStream
    $writer = New-Object System.IO.BinaryWriter($iconMemory)

    # ICO Header
    $writer.Write([UInt16]0)        # Reserved
    $writer.Write([UInt16]1)        # Type (1 = ICO)
    $writer.Write([UInt16]$Sizes.Count)  # Number of images

    # Prepare image data
    $imageDataList = @()
    $offset = 6 + (16 * $Sizes.Count)  # Header + directory entries

    foreach ($size in $Sizes) {
        $bitmap = New-Object System.Drawing.Bitmap($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.DrawImage($sourceImage, 0, 0, $size, $size)
        $graphics.Dispose()

        $ms = New-Object System.IO.MemoryStream
        $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
        $imageData = $ms.ToArray()
        $imageDataList += ,@{Size = $size; Data = $imageData}

        # Write directory entry
        $displaySize = if ($size -ge 256) { 0 } else { $size }
        $writer.Write([byte]$displaySize)     # Width
        $writer.Write([byte]$displaySize)     # Height
        $writer.Write([byte]0)                # Color palette
        $writer.Write([byte]0)                # Reserved
        $writer.Write([UInt16]1)              # Color planes
        $writer.Write([UInt16]32)             # Bits per pixel
        $writer.Write([UInt32]$imageData.Length)  # Size of image data
        $writer.Write([UInt32]$offset)        # Offset to image data

        $offset += $imageData.Length
        $bitmap.Dispose()
        $ms.Dispose()
    }

    # Write image data
    foreach ($imgData in $imageDataList) {
        $writer.Write($imgData.Data)
    }

    $writer.Flush()
    $iconBytes = $iconMemory.ToArray()
    [System.IO.File]::WriteAllBytes($DestPath, $iconBytes)

    $writer.Dispose()
    $iconMemory.Dispose()
    $sourceImage.Dispose()

    Write-Host "  [OK] ICO criado: $DestPath" -ForegroundColor Green
}

# Funcao para redimensionar PNG
function Resize-Png {
    param(
        [string]$SourcePath,
        [string]$DestPath,
        [int]$Size
    )

    Add-Type -AssemblyName System.Drawing

    $sourceImage = [System.Drawing.Image]::FromFile($SourcePath)
    $bitmap = New-Object System.Drawing.Bitmap($Size, $Size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($sourceImage, 0, 0, $Size, $Size)

    $bitmap.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)

    $graphics.Dispose()
    $bitmap.Dispose()
    $sourceImage.Dispose()

    Write-Host "  [OK] PNG (${Size}x${Size}) criado: $DestPath" -ForegroundColor Green
}

# Funcao para criar BMP para InnoSetup
function Convert-ToBmp {
    param(
        [string]$SourcePath,
        [string]$DestPath,
        [int]$Width,
        [int]$Height
    )

    Add-Type -AssemblyName System.Drawing

    $sourceImage = [System.Drawing.Image]::FromFile($SourcePath)
    $bitmap = New-Object System.Drawing.Bitmap($Width, $Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([System.Drawing.Color]::FromArgb(30, 30, 30))  # Dark background
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

    # Centralizar a imagem
    $scale = [Math]::Min($Width / $sourceImage.Width, $Height / $sourceImage.Height) * 0.8
    $newWidth = [int]($sourceImage.Width * $scale)
    $newHeight = [int]($sourceImage.Height * $scale)
    $x = [int](($Width - $newWidth) / 2)
    $y = [int](($Height - $newHeight) / 2)

    $graphics.DrawImage($sourceImage, $x, $y, $newWidth, $newHeight)

    $bitmap.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Bmp)

    $graphics.Dispose()
    $bitmap.Dispose()
    $sourceImage.Dispose()

    Write-Host "  [OK] BMP (${Width}x${Height}) criado: $DestPath" -ForegroundColor Green
}

# ========================================
# Converter icones
# ========================================

Write-Host ""
Write-Host "[DIR] Convertendo icones Windows..." -ForegroundColor Cyan
$win32Dir = Join-Path $RootDir "resources\win32"
Convert-ToIco -SourcePath $SourceImage -DestPath (Join-Path $win32Dir "code.ico")

Write-Host ""
Write-Host "[DIR] Convertendo icone Linux..." -ForegroundColor Cyan
$linuxDir = Join-Path $RootDir "resources\linux"
Resize-Png -SourcePath $SourceImage -DestPath (Join-Path $linuxDir "code.png") -Size 256

Write-Host ""
Write-Host "[DIR] Convertendo imagens do instalador InnoSetup..." -ForegroundColor Cyan
# Big images (164x314 base, scales up)
$bigSizes = @(
    @{Scale = 100; Width = 164; Height = 314},
    @{Scale = 125; Width = 205; Height = 393},
    @{Scale = 150; Width = 246; Height = 471},
    @{Scale = 175; Width = 287; Height = 550},
    @{Scale = 200; Width = 328; Height = 628},
    @{Scale = 225; Width = 369; Height = 707},
    @{Scale = 250; Width = 410; Height = 785}
)

foreach ($size in $bigSizes) {
    $destPath = Join-Path $win32Dir ("inno-big-{0}.bmp" -f $size.Scale)
    Convert-ToBmp -SourcePath $SourceImage -DestPath $destPath -Width $size.Width -Height $size.Height
}

# Small images (55x58 base, scales up)
$smallSizes = @(
    @{Scale = 100; Width = 55; Height = 58},
    @{Scale = 125; Width = 69; Height = 73},
    @{Scale = 150; Width = 83; Height = 87},
    @{Scale = 175; Width = 97; Height = 101},
    @{Scale = 200; Width = 110; Height = 116},
    @{Scale = 225; Width = 124; Height = 130},
    @{Scale = 250; Width = 138; Height = 145}
)

foreach ($size in $smallSizes) {
    $destPath = Join-Path $win32Dir ("inno-small-{0}.bmp" -f $size.Scale)
    Convert-ToBmp -SourcePath $SourceImage -DestPath $destPath -Width $size.Width -Height $size.Height
}

# Tile images para Windows 10/11
Write-Host ""
Write-Host "[DIR] Convertendo tile images..." -ForegroundColor Cyan
Resize-Png -SourcePath $SourceImage -DestPath (Join-Path $win32Dir "code_70x70.png") -Size 70
Resize-Png -SourcePath $SourceImage -DestPath (Join-Path $win32Dir "code_150x150.png") -Size 150

Write-Host ""
Write-Host "[DONE] Conversao completa!" -ForegroundColor Green
Write-Host "[BAT] HikariSystem HexCore esta pronto para build!" -ForegroundColor Magenta
