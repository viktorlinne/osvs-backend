<#
.SYNOPSIS
  Dumps the OSVS Access tables to JSON (stage 1 of MIGRATION_PLAN.md §5).

.DESCRIPTION
  Reads OSVS_MDB_UID / OSVS_MDB_PASSWORD from osvs-backend/.env.migration
  (gitignored; never commit it). Writes one <table>.json per table plus
  _summary.json (row counts, source file, extraction time) to -OutDir.
  Output contains personal data (civicno) — keep it out of git.

.EXAMPLE
  powershell -File scripts/migration/extract-access.ps1 -Database C:\OSVS\osvs.mdb
#>
param(
  [Parameter(Mandatory = $true)][string]$Database,
  [string]$OutDir = (Join-Path $PSScriptRoot 'extract'),
  [string]$EnvFile = (Join-Path $PSScriptRoot '..\..\.env.migration'),
  [string[]]$Tables = @(
    'contacts', 'contacts_cv', 'events', 'events_items', 'tEvents',
    'mail', 'mail_items', 'news', 'na_pages', 'na_NodesTable', 'counter_logins'
  )
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Database)) { throw "Database not found: $Database" }
if (-not (Test-Path $EnvFile)) { throw "Missing $EnvFile (OSVS_MDB_UID / OSVS_MDB_PASSWORD)" }

$envVars = @{}
foreach ($line in Get-Content $EnvFile) {
  if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $envVars[$Matches[1]] = $Matches[2] }
}

New-Item -ItemType Directory -Force $OutDir | Out-Null

$cnnString = "Driver={Microsoft Access Driver (*.mdb, *.accdb)};Dbq=$Database;" +
  "Uid=$($envVars['OSVS_MDB_UID']);Pwd=$($envVars['OSVS_MDB_PASSWORD']);"
$cnn = New-Object System.Data.Odbc.OdbcConnection $cnnString
$cnn.Open()

function Convert-Value($value) {
  if ($value -is [System.DBNull]) { return $null }
  if ($value -is [datetime]) { return $value.ToString('yyyy-MM-ddTHH:mm:ss') }
  if ($value -is [byte[]]) { return [Convert]::ToBase64String($value) }
  return $value
}

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$summary = [ordered]@{
  source      = (Resolve-Path $Database).Path
  sourceDate  = (Get-Item $Database).LastWriteTime.ToString('yyyy-MM-ddTHH:mm:ss')
  extractedAt = (Get-Date).ToString('yyyy-MM-ddTHH:mm:ss')
  tables      = [ordered]@{}
}

try {
  foreach ($table in $Tables) {
    $cmd = $cnn.CreateCommand()
    $cmd.CommandText = "SELECT * FROM [$table]"
    $reader = $cmd.ExecuteReader()
    $rows = New-Object System.Collections.Generic.List[object]
    while ($reader.Read()) {
      $row = [ordered]@{}
      for ($i = 0; $i -lt $reader.FieldCount; $i++) {
        $row[$reader.GetName($i)] = Convert-Value $reader.GetValue($i)
      }
      $rows.Add([pscustomobject]$row)
    }
    $reader.Close()

    $json = if ($rows.Count -eq 0) { '[]' } else { ConvertTo-Json -InputObject $rows.ToArray() -Depth 3 }
    [System.IO.File]::WriteAllText((Join-Path $OutDir "$table.json"), $json, $utf8NoBom)
    $summary.tables[$table] = $rows.Count
    Write-Host ("{0,-16} {1,7} rows" -f $table, $rows.Count)
  }
} finally {
  $cnn.Close()
}

$summaryJson = ConvertTo-Json -InputObject $summary -Depth 3
[System.IO.File]::WriteAllText((Join-Path $OutDir '_summary.json'), $summaryJson, $utf8NoBom)
