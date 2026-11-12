<#
.SYNOPSIS
  Menjalankan server Claude Usage otomatis setiap kali Anda login ke Windows (lewat Task Scheduler).

.DESCRIPTION
  Install   : membuat tugas terjadwal "ClaudeUsageServer" (jalan tersembunyi, tanpa jendela, restart otomatis
              bila berhenti, tanpa batas waktu 72 jam bawaan Task Scheduler) lalu menjalankannya sekarang.
  Uninstall : menghentikan server dan menghapus tugas.
  Status    : menampilkan keadaan tugas dan apakah server menjawab.

  Tidak perlu hak administrator: tugas dibuat untuk akun Windows Anda sendiri.

.PARAMETER Action
  Install (default), Uninstall, atau Status.

.PARAMETER Lan
  Dengarkan di jaringan (sama seperti `node src/server.js --lan`) agar HP/tablet bisa membuka lewat IP komputer.
  Tidak perlu bila memakai `tailscale serve` (lihat README).

.PARAMETER Port
  Port server. Default 4747.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\windows-autostart.ps1 -Action Install

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File .\scripts\windows-autostart.ps1 -Action Install -Lan
#>
[CmdletBinding()]
param(
  [ValidateSet('Install', 'Uninstall', 'Status')]
  [string]$Action = 'Install',
  [switch]$Lan,
  [int]$Port = 4747
)

$ErrorActionPreference = 'Stop'
$TaskName = 'ClaudeUsageServer'
$Root = Split-Path -Parent $PSScriptRoot
$Server = Join-Path $Root 'src\server.js'

function Test-Listening([int]$p) {
  $c = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue
  return [bool]$c
}

# Hentikan proses node yang menjalankan server ini (cadangan bila Task Scheduler tidak ikut mematikannya).
function Stop-OurServer {
  Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
  $procs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.Contains($Server) }
  foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
}

switch ($Action) {
  'Install' {
    $node = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $node) {
      throw 'Node.js tidak ditemukan di PATH. Pasang Node 18+ dari nodejs.org, lalu buka PowerShell baru.'
    }
    if (-not (Test-Path $Server)) { throw "File server tidak ditemukan: $Server" }

    # Jalankan lewat PowerShell tersembunyi agar tidak ada jendela konsol yang menggantung di layar.
    $q = { param($s) "'" + $s.Replace("'", "''") + "'" }
    $cmd = "& $(& $q $node) $(& $q $Server) --port $Port"
    if ($Lan) { $cmd += ' --lan' }
    $arg = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -Command `"$cmd`""

    $user = "$env:USERDOMAIN\$env:USERNAME"
    $act = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg -WorkingDirectory $Root
    $trg = New-ScheduledTaskTrigger -AtLogOn -User $user
    $set = New-ScheduledTaskSettingsSet `
      -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
      -MultipleInstances IgnoreNew `
      -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) `
      -ExecutionTimeLimit ([TimeSpan]::Zero)
    $pri = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

    Stop-OurServer
    Register-ScheduledTask -TaskName $TaskName -Action $act -Trigger $trg -Settings $set -Principal $pri `
      -Description 'Server dashboard Claude Usage (jalan saat login)' -Force | Out-Null
    Write-Host "Terpasang: tugas '$TaskName' akan jalan setiap login."

    if (Test-Listening $Port) {
      Write-Warning "Port $Port sedang dipakai (mungkin server yang dijalankan manual). Tutup dulu, lalu jalankan: Start-ScheduledTask -TaskName $TaskName"
    }
    else {
      Start-ScheduledTask -TaskName $TaskName
      Start-Sleep -Seconds 2
      Write-Host "Server dijalankan: http://localhost:$Port"
    }
    if ($Lan) { Write-Host 'Mode --lan aktif: Windows Firewall mungkin meminta izin untuk Node (pilih Jaringan pribadi).' }
  }

  'Uninstall' {
    Stop-OurServer
    if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
      Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
      Write-Host "Tugas '$TaskName' dihapus dan server dihentikan."
    }
    else {
      Write-Host 'Tidak ada tugas yang perlu dihapus.'
    }
  }

  'Status' {
    $t = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if (-not $t) {
      Write-Host 'Belum terpasang. Jalankan dengan -Action Install.'
      return
    }
    $i = Get-ScheduledTaskInfo -TaskName $TaskName
    Write-Host "Tugas      : $TaskName ($($t.State))"
    Write-Host "Terakhir   : $($i.LastRunTime)  (hasil: $($i.LastTaskResult))"
    try {
      $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/usage.json" -TimeoutSec 3
      Write-Host "Server     : menjawab di port $Port"
      if ($r.usage -and $r.usage.fiveHour) { Write-Host "Data       : ada (5 jam $([math]::Round($r.usage.fiveHour.pct))%)" }
      else { Write-Host 'Data       : belum ada, kirim satu pesan di Claude Code' }
    }
    catch {
      Write-Host "Server     : tidak menjawab di port $Port"
    }
  }
}
