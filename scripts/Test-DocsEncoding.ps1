param([string]$Root = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
$strictUtf8 = [System.Text.UTF8Encoding]::new($true, $true)
$files = @('README.md', 'AGENTS.md', 'CLAUDE.md') | ForEach-Object { Get-Item -LiteralPath (Join-Path $Root $_) }
$files += Get-ChildItem -LiteralPath (Join-Path $Root 'docs') -Recurse -File | Where-Object { $_.Extension -in '.md', '.html' }
$errorsFound = @()
foreach ($file in $files) {
    $bytes = [IO.File]::ReadAllBytes($file.FullName)
    if ($bytes.Length -lt 3 -or $bytes[0] -ne 239 -or $bytes[1] -ne 187 -or $bytes[2] -ne 191) { $errorsFound += "$($file.FullName)：缺少 UTF-8 BOM" }
    try {
        $text = $strictUtf8.GetString($bytes)
        if ($text.Contains([char]0xfffd)) { $errorsFound += "$($file.FullName)：含替代字元" }
        if ([regex]::IsMatch($text, '(?<!\r)\n|\r(?!\n)')) { $errorsFound += "$($file.FullName)：不是 CRLF 換行" }
    } catch { $errorsFound += "$($file.FullName)：UTF-8 解碼失敗" }
}
if ($errorsFound.Count) { $errorsFound | Write-Error -ErrorAction Continue; exit 1 }
Write-Output "文件編碼檢查通過：$($files.Count) 個檔案（UTF-8 BOM、CRLF）。中文語意與誤植另需人工校閱。"
