param(
    [string]$ListenAddress = '',
    [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9:._/-]{0,100}$')]
    [string]$Model = 'qwen3:4b'
)

$ErrorActionPreference = 'Stop'
$ollamaCommand = Get-Command ollama -ErrorAction SilentlyContinue
$ollamaPath = if ($ollamaCommand) { $ollamaCommand.Source } else { Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe' }
if (-not (Test-Path $ollamaPath)) {
    throw 'Ollama einmal auf diesem Server installieren: https://ollama.com/download/windows. Die Toolbox-PCs brauchen Ollama nicht.'
}

$localAddresses = @(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notmatch '^(127\.|169\.254\.)' } | Select-Object -ExpandProperty IPAddress)
if (-not $ListenAddress) {
    Write-Host ('Adressen dieses Rechners: ' + ($localAddresses -join ', '))
    $ListenAddress = Read-Host 'Interne IPv4-Adresse dieses KI-Servers'
}
if ($ListenAddress -notin $localAddresses) { throw 'Bitte eine interne IPv4-Adresse dieses Rechners angeben.' }
$ip = [System.Net.IPAddress]::Parse($ListenAddress).GetAddressBytes()
$privateAddress = $ip[0] -eq 10 -or ($ip[0] -eq 192 -and $ip[1] -eq 168) -or ($ip[0] -eq 172 -and $ip[1] -ge 16 -and $ip[1] -le 31)
if (-not $privateAddress) { throw 'Der Serverhelfer bindet nur an eine private LAN-Adresse (10.x, 172.16-31.x oder 192.168.x).' }

$previousHost = $env:OLLAMA_HOST
$env:OLLAMA_HOST = $ListenAddress + ':11434'
$baseUrl = 'http://' + $env:OLLAMA_HOST
$started = $null
try {
    try { $models = Invoke-RestMethod ($baseUrl + '/api/tags') -TimeoutSec 3 } catch { $models = $null }
    if (-not $models) {
        $started = Start-Process -FilePath $ollamaPath -ArgumentList 'serve' -PassThru
        for ($attempt = 0; $attempt -lt 30; $attempt++) {
            try { $models = Invoke-RestMethod ($baseUrl + '/api/tags') -TimeoutSec 2; break } catch { Start-Sleep -Seconds 1 }
        }
        if (-not $models) { throw 'Ollama konnte auf dieser Adresse nicht gestartet werden. Das Serverfenster auf Fehlermeldungen pruefen.' }
    }
    if ($Model -notin @($models.models.name)) {
        Write-Host ('Das freie Modell ' + $Model + ' wird einmal heruntergeladen. Der Download kann mehrere GB gross sein.')
        & $ollamaPath pull $Model
        if ($LASTEXITCODE -ne 0) { throw 'Der Modelldownload ist fehlgeschlagen.' }
    }
    Write-Host ''
    Write-Host 'KI-Server bereit. In der Toolbox unter KI-Verbindung eintragen:'
    Write-Host ('Serveradresse: ' + $baseUrl + '/api/chat')
    Write-Host ('Modell: ' + $Model)
    Write-Host 'Kein API-Schluessel erforderlich. Dieses Fenster waehrend der Nutzung offen lassen.'
    Write-Host 'Nur das interne Firmennetz verwenden. Der Helfer aendert keine Firewallregeln.'
    Read-Host 'Eingabetaste beendet den von diesem Helfer gestarteten Server'
} finally {
    if ($started -and -not $started.HasExited) { Stop-Process -Id $started.Id }
    $env:OLLAMA_HOST = $previousHost
}
