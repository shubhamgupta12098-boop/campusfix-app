$ErrorActionPreference = 'Stop'

Write-Host "CampusFix MongoDB Setup" -ForegroundColor Cyan
Write-Host "MongoDB Atlas > Connect > Drivers se poori connection string copy karein." -ForegroundColor Yellow
Write-Host "Example: mongodb+srv://user:<db_password>@cluster.mongodb.net/?retryWrites=true&w=majority" -ForegroundColor DarkGray

$atlasUri = Read-Host "Atlas connection string paste karein"
if ([string]::IsNullOrWhiteSpace($atlasUri)) {
  throw "Connection string empty nahi ho sakti."
}
if ($atlasUri -notmatch '^mongodb(\+srv)?://') {
  throw "Ye valid MongoDB connection string nahi lag rahi."
}

if ($atlasUri -match '<db_password>') {
  Write-Host "Ab MongoDB database user ka password enter karein." -ForegroundColor Yellow
  $securePassword = Read-Host "MongoDB password" -AsSecureString
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try {
    $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
  if ([string]::IsNullOrWhiteSpace($plainPassword)) { throw "Password empty nahi ho sakta." }
  $encodedPassword = [System.Uri]::EscapeDataString($plainPassword)
  $atlasUri = $atlasUri.Replace('<db_password>', $encodedPassword)
}

# campusfix database name add karein jab URI host ke baad seedha /? ho.
$atlasUri = $atlasUri -replace '\.mongodb\.net/\?', '.mongodb.net/campusfix?'
if ($atlasUri -match '\.mongodb\.net/$') {
  $atlasUri = $atlasUri + 'campusfix'
}

$serverDir = Join-Path $PSScriptRoot 'server'
$envPath = Join-Path $serverDir '.env'
$envContent = @"
PORT=5000
MONGODB_URI=$atlasUri
JWT_SECRET=CampusFix_$(New-Guid)_2026
CLIENT_URL=http://localhost:5173
ADMIN_EMAIL=admin@campusfix.local
ADMIN_PASSWORD=Admin@123
"@
Set-Content -Path $envPath -Value $envContent -Encoding UTF8

Write-Host "server/.env successfully create ho gayi." -ForegroundColor Green
Write-Host "Ab chalayein:" -ForegroundColor Cyan
Write-Host "npm run install:all"
Write-Host "npm run server"
Write-Host "Naye terminal me: npm run dev"
