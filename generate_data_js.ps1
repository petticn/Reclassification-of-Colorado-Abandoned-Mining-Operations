# Generate js/mines-data.js (var points = [...]) from the reclassified CSV.
$ErrorActionPreference = 'Stop'
$csv = 'colorado_clustered_mines_with_hazards.csv'
$out = 'js/mines-data.js'

$rows = Import-Csv $csv -Encoding UTF8
function RiskCode($r) {
    if ($r -eq 'Non-Hazardous')   { return 0 }
    if ($r -eq 'Moderate Hazard') { return 1 }
    if ($r -eq 'Extreme Hazard')  { return 2 }
    return 0
}
function Escape-Js($s) { return $s.Replace('\','\\').Replace('"','\"') }

$enc = New-Object System.Text.UTF8Encoding($false)
$w = New-Object System.IO.StreamWriter($out, $false, $enc)
try {
    $w.WriteLine('var points = [')
    $i = 0
    foreach ($r in $rows) {
        $code = RiskCode $r.'Risk Level'
        $haz = Escape-Js $r.'Specific Hazards'
        $comma = if ($i -lt $rows.Count - 1) { ',' } else { '' }
        $w.WriteLine("  [$($r.Latitude), $($r.Longitude), $code, $($r.'Hazards Count'), `"$haz`"]$comma")
        $i++
    }
    $w.WriteLine('];')
} finally { $w.Close() }
Write-Host "Wrote $out with $i points"
