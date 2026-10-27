param([string]$Chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe', [int[]]$Cases = @(350,390,450,760,900,901))
$ErrorActionPreference = 'Stop'
$testRoot = Join-Path $env:TEMP ('mtprev-radial-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testRoot | Out-Null
foreach ($width in $Cases) {
  $fixtureName = if ($width -eq 907) { 'duplicate_preload.browser.html' } elseif ($width -eq 906) { 'workspace_api.browser.html' } elseif ($width -eq 905) { 'workspace_preload.browser.html' } elseif ($width -eq 904) { 'workspace.browser.html' } elseif ($width -eq 903) { 'triage_modern.browser.html' } elseif ($width -eq 902) { 'spa_adapter.browser.html' } elseif ($width -eq 901) { 'syntax.browser.html' } elseif ($width -eq 900) { 'mtprev_pop.browser.html' } else { 'radial_menu.browser.html' }
  $fixture = ([System.Uri](Join-Path $PSScriptRoot $fixtureName)).AbsoluteUri
  $outputFile = Join-Path $testRoot "result-$width.txt"
  $errorFile = Join-Path $testRoot "error-$width.txt"
  $profile = Join-Path $testRoot "profile-$width"
  $argsList = @('--headless','--disable-gpu','--no-first-run','--disable-background-networking','--disable-renderer-backgrounding','--disable-background-timer-throttling','--run-all-compositor-stages-before-draw',"--user-data-dir=$profile",'--window-size=900,900','--virtual-time-budget=24000','--dump-dom',"$fixture`?width=$width")
  if ($width -in @(905,906,907)) { $argsList += '--allow-file-access-from-files' }
  if ($width -eq 450) { $argsList += '--force-prefers-reduced-motion=reduce' }
  if ($width -eq 903) { $argsList += "--screenshot=$testRoot\triage-modern.png" }
  Start-Process -FilePath $Chrome -ArgumentList $argsList -WindowStyle Hidden -RedirectStandardOutput $outputFile -RedirectStandardError $errorFile | Out-Null
  $deadline = [DateTime]::UtcNow.AddSeconds(30)
  do {
    Start-Sleep -Milliseconds 250
    $resultText = ''
    try {
      if (Test-Path $outputFile) {
        $stream = [IO.File]::Open($outputFile, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
        $reader = [IO.StreamReader]::new($stream)
        try { $resultText = $reader.ReadToEnd() } finally { $reader.Dispose() }
      }
    } catch [IO.IOException] { $resultText = '' }
  } while ($resultText -notmatch 'data-result="(pass|fail)"' -and [DateTime]::UtcNow -lt $deadline)
  if ($resultText -notmatch 'data-result="pass"') { throw "FAIL largura $width. Consulte $outputFile e $errorFile" }
  if ($width -eq 903) { Write-Output 'PASS: integração real de scripts de Triagem, drawer, leitura e diagnóstico em fixture sem rede.' }
  elseif ($width -eq 902) { Write-Output 'PASS: SpaAdapter, espera/DOM, leitura, seleção, confirmação, inspetor e drawer.' }
  elseif ($width -eq 907) { Write-Output 'PASS: relatorio reutiliza lotes iniciais, salva cache e isola filtros.' }
  elseif ($width -eq 906) { Write-Output 'PASS: lotes de 25, progresso, cache e ausencia de rolagem mesmo com falha.' }
  elseif ($width -eq 905) { Write-Output 'PASS: carregamento automatico, lotes, barra de progresso e leitura sem novas paginas.' } elseif ($width -eq 904) { Write-Output 'PASS: cards do workspace, carregamento incremental e relatório real de duplicados sem rede.' }
  elseif ($width -eq 901) { Write-Output 'PASS: sintaxe dos scripts integrais no parser do Chrome, sem inicializar o SPA.' }
  elseif ($width -eq 900) { Write-Output 'PASS: diagnostico e grupos prioritarios POP, destinatarios, excecoes e revisao humana.' }
  else { Write-Output "PASS: widget $width px; acompanhamento existente, clique, arraste sintetico, navegacao, geometria, estado e persistencia." }
}
Write-Output "Resultados em $testRoot"
