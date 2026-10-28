# Script de Compilación e Instalación de NexusPF CRM en Google Pixel (Windows PowerShell)
param(
    [string]$LocalIp = ""
)

Write-Host "=================================================================" -ForegroundColor Cyan
Write-Host " 📱 NEXUSPF CRM - GENERADOR & INSTALADOR PARA GOOGLE PIXEL" -ForegroundColor Emerald
Write-Host "=================================================================" -ForegroundColor Cyan

# 1. Detectar la IP Wi-Fi Local de este PC para conectarse desde el Google Pixel
if (-not $LocalIp) {
    $ipObj = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.InterfaceAlias -match "Wi-Fi|Ethernet" -and $_.IPAddress -notmatch "^127\.|^169\.254\."
    } | Select-Object -First 1
    if ($ipObj) {
        $LocalIp = $ipObj.IPAddress
    } else {
        $LocalIp = "192.168.1.100"
    }
}

Write-Host "📶 IP Local Wi-Fi detectada de tu PC: http://${LocalIp}:3400" -ForegroundColor Green
Write-Host "☁️ URL Cloud Render configurada:     https://nexuspf-web.onrender.com" -ForegroundColor Cyan

# 2. Actualizar la IP local por defecto en app/build.gradle.kts
$gradleFile = Join-Path $PSScriptRoot "app\build.gradle.kts"
if (Test-Path $gradleFile) {
    $content = Get-Content $gradleFile -Raw
    $content = $content -replace 'buildConfigField\("String", "DEFAULT_LOCAL_WIFI_URL", ".*?"\)', "buildConfigField(`"String`", `"DEFAULT_LOCAL_WIFI_URL`", `"\`"http://${LocalIp}:3400\`"`")"
    Set-Content -Path $gradleFile -Value $content -Encoding UTF8
    Write-Host "✓ app/build.gradle.kts actualizado con tu IP Wi-Fi local ($LocalIp)." -ForegroundColor Green
}

# 3. Verificar si ADB tiene un Google Pixel conectado por USB / Wireless Debugging
$adbCmd = Get-Command adb -ErrorAction SilentlyContinue
if ($adbCmd) {
    Write-Host "`n🔍 Verificando dispositivos Google Pixel conectados vía ADB..." -ForegroundColor Yellow
    adb devices -l
} else {
    Write-Host "`nℹ️ Tip: Puedes abrir esta carpeta ('android-pixel-app') en Android Studio y pulsar ▶ Run sobre tu Google Pixel, o instalar la PWA directo desde Chrome en tu Pixel abriendo http://${LocalIp}:3400" -ForegroundColor Yellow
}
