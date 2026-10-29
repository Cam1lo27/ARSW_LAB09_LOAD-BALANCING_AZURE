<#
  Lanza N ejecuciones de newman en paralelo, cada una en su propia ventana de PowerShell
  (equivale a los comandos "newman run ... &" del enunciado, que en Windows no funcionan igual).
  Cada ventana muestra la tabla resumen de newman (para el pantallazo) y además guarda
  un reporte JSON en evidencias/<parte>/newman/<etiqueta>/.

  Ejemplos:
    .\scripts\run-newman.ps1 -Target 20.10.30.40 -Part part1 -Parallel 2 -Label b1ls
    .\scripts\run-newman.ps1 -Target 20.10.30.40 -Part part1 -Parallel 4 -Label b2ms-4
    .\scripts\run-newman.ps1 -Target 52.1.2.3    -Part part2 -Parallel 2 -Label lb-3vms
#>
param(
    [Parameter(Mandatory = $true)][string]$Target,  # IP de la VM (parte 1) o del balanceador (parte 2)
    [ValidateSet('part1', 'part2')][string]$Part = 'part1',
    [int]$Parallel = 2,
    [int]$Iterations = 10,
    [string]$Label = 'run'
)

$root = Split-Path -Parent $PSScriptRoot
$postmanDir = Join-Path $root "FibonacciApp\postman\$Part"
$collection = Join-Path $postmanDir 'ARSW_LOAD-BALANCING_AZURE.postman_collection.json'
$environment = Join-Path $postmanDir '[ARSW_LOAD-BALANCING_AZURE].postman_environment.json'
$variable = if ($Part -eq 'part1') { 'VM1' } else { 'loadbalancer' }

$outDir = Join-Path $root "evidencias\$Part\newman\$Label"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

if (-not (Get-Command newman -ErrorAction SilentlyContinue)) {
    Write-Error 'newman no está instalado. Ejecute: npm install -g newman'
    exit 1
}

for ($i = 1; $i -le $Parallel; $i++) {
    $report = Join-Path $outDir "newman-$i.json"
    $cmd = @"
`$Host.UI.RawUI.WindowTitle = 'newman $i/$Parallel - $Label'
newman run '$collection' -e '$environment' --env-var '$variable=$Target' -n $Iterations -r 'cli,json' --reporter-json-export '$report'
Read-Host 'Ejecucion $i terminada. Tome el pantallazo y presione Enter para cerrar'
"@
    $encoded = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($cmd))
    Start-Process powershell -ArgumentList '-NoProfile', '-EncodedCommand', $encoded
}

Write-Host "Se lanzaron $Parallel ejecuciones de newman contra $Target ($Part)."
Write-Host "Reportes JSON en: $outDir"
Write-Host "Cuando terminen todas, ejecute: node .\scripts\resumen-newman.js '$outDir'"
