<#
.SYNOPSIS
  Them mot video Vimeo vao videos.json (tu lay tieu de, thoi luong, anh bia tu Vimeo).

.EXAMPLE
  .\tools\add-video.ps1 -VimeoUrl "https://vimeo.com/123456789" -CategoryId IT-03

.EXAMPLE
  # Video an (unlisted) co hash, hoac gioi han nhung theo domain: dung token de lay thong tin day du
  .\tools\add-video.ps1 -VimeoUrl "https://vimeo.com/123456789/abcdef1234" -CategoryId IT-05 -Token $env:VIMEO_TOKEN

.NOTES
  - Token: tao tai https://developer.vimeo.com/apps (Generate access token, quyen "Public" + "Private").
  - Khong co token: script dung oEmbed. Neu video gioi han nhung theo domain, oEmbed co the bi chan;
    them -SiteUrl "https://video.ricons.vn/" de gui kem Referer, hoac cu nhap tay tieu de/thoi luong khi duoc hoi.
  - Script sao luu videos.json thanh videos.json.bak truoc khi ghi.
#>
param(
  [Parameter(Mandatory = $true)][string]$VimeoUrl,
  [string]$CategoryId,
  [string]$Title,
  [string]$Description,
  [string]$Token,
  [string]$SiteUrl,
  [string]$JsonPath = (Join-Path $PSScriptRoot '..\videos.json')
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Format-Duration([int]$Seconds) {
  if ($Seconds -ge 3600) {
    return ('{0}:{1:00}:{2:00}' -f [math]::Floor($Seconds / 3600), [math]::Floor(($Seconds % 3600) / 60), ($Seconds % 60))
  }
  return ('{0:00}:{1:00}' -f [math]::Floor($Seconds / 60), ($Seconds % 60))
}

# 1. Lay ID (va hash neu co) tu link
$m = [regex]::Match($VimeoUrl, 'vimeo\.com/(?:.*/)?(\d{6,})')
if (-not $m.Success) { throw 'Khong tim thay ID video trong link Vimeo.' }
$vimeoId = $m.Groups[1].Value
$hash = ''
$h1 = [regex]::Match($VimeoUrl, '[?&]h=([0-9a-fA-F]+)')
$h2 = [regex]::Match($VimeoUrl, '/' + $vimeoId + '/([0-9a-fA-F]{8,})')
if ($h1.Success) { $hash = $h1.Groups[1].Value } elseif ($h2.Success) { $hash = $h2.Groups[1].Value }

# 2. Doc videos.json
if (-not (Test-Path $JsonPath)) { throw "Khong thay file: $JsonPath" }
$db = [IO.File]::ReadAllText($JsonPath, [Text.Encoding]::UTF8) | ConvertFrom-Json
foreach ($v in $db.videos) {
  # PowerShell 7 tu doi chuoi ngay thanh DateTime, doi lai thanh chuoi de khong bi hong dinh dang
  if ($v.date -is [datetime]) { $v.date = $v.date.ToString('yyyy-MM-dd') }
}
foreach ($v in $db.videos) {
  if ([string]$v.vimeoId -eq $vimeoId) { throw "Video $vimeoId da co trong videos.json (ma $($v.id))." }
}

# 3. Chon danh muc
if (-not $CategoryId) {
  Write-Host ''
  Write-Host 'Danh muc:'
  foreach ($c in $db.categories) { Write-Host ("  {0}  {1}" -f $c.id, $c.name) }
  $CategoryId = (Read-Host 'Nhap ma danh muc (vi du IT-03)').Trim()
}
if (-not ($db.categories | Where-Object { $_.id -eq $CategoryId })) { throw "Khong co danh muc $CategoryId trong videos.json." }

# 4. Lay thong tin tu Vimeo
$info = @{ title = ''; duration = 0; description = ''; thumb = '' }
try {
  if ($Token) {
    $api = Invoke-RestMethod -Uri "https://api.vimeo.com/videos/$vimeoId" -Headers @{ Authorization = "Bearer $Token" }
    $info.title = [string]$api.name
    $info.duration = [int]$api.duration
    $info.description = [string]$api.description
    if ($api.pictures -and $api.pictures.sizes) {
      $pic = $api.pictures.sizes | Where-Object { $_.width -ge 640 } | Select-Object -First 1
      if ($pic) { $info.thumb = [string]$pic.link }
    }
  } else {
    $target = "https://vimeo.com/$vimeoId"
    if ($hash) { $target = "$target/$hash" }
    $headers = @{}
    if ($SiteUrl) { $headers['Referer'] = $SiteUrl }
    $o = Invoke-RestMethod -Uri ('https://vimeo.com/api/oembed.json?url=' + [uri]::EscapeDataString($target)) -Headers $headers
    $info.title = [string]$o.title
    $info.duration = [int]$o.duration
    $info.description = [string]$o.description
    $info.thumb = [string]$o.thumbnail_url
  }
} catch {
  Write-Warning ('Khong lay duoc thong tin tu Vimeo: ' + $_.Exception.Message)
  Write-Warning 'Se hoi nhap tay tieu de va thoi luong.'
}

if (-not $Title) { $Title = $info.title }
if (-not $Title) { $Title = (Read-Host 'Tieu de video').Trim() }
if ($info.duration -gt 0) {
  $duration = Format-Duration $info.duration
} else {
  $duration = (Read-Host 'Thoi luong (mm:ss)').Trim()
}
if (-not $Description) { $Description = $info.description }
$Description = ($Description -replace '\s+', ' ').Trim()
if ($Description.Length -gt 160) { $Description = $Description.Substring(0, 157).TrimEnd() + '...' }

# 5. Tao ma video tiep theo (IT-001, IT-002, ...)
$max = 0
foreach ($v in $db.videos) {
  if ($v.id -match '^IT-(\d+)$') { $n = [int]$Matches[1]; if ($n -gt $max) { $max = $n } }
}
$newId = 'IT-{0:000}' -f ($max + 1)

$entry = [pscustomobject][ordered]@{
  id          = $newId
  vimeoId     = $vimeoId
  vimeoHash   = $hash
  title       = $Title
  categoryId  = $CategoryId
  duration    = $duration
  date        = (Get-Date -Format 'yyyy-MM-dd')
  description = $Description
  thumbnail   = $info.thumb
  keywords    = @()
  chapters    = @()
  transcript  = @()
  attachments = @()
}
$db.videos = @($db.videos) + $entry

# 6. Ghi lai (co sao luu)
Copy-Item $JsonPath ($JsonPath + '.bak') -Force
$json = $db | ConvertTo-Json -Depth 10
[IO.File]::WriteAllText($JsonPath, $json, $utf8NoBom)

Write-Host ''
Write-Host "Da them $newId : $Title ($duration) vao danh muc $CategoryId" -ForegroundColor Green
Write-Host 'Mo videos.json de bo sung chuong (chapters), ban ghi (transcript), tep dinh kem neu can.'
Write-Host 'Sau do commit + push len GitHub de web tu cap nhat.'
