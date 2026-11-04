# Мини-сервер для «Ширмы мастера»: отдаёт файлы из своей папки на 127.0.0.1.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path

$listener = New-Object System.Net.HttpListener
$port = 0
for ($i = 0; $i -lt 50; $i++) {
    $candidate = Get-Random -Minimum 49152 -Maximum 65535
    try {
        $listener.Prefixes.Clear()
        $listener.Prefixes.Add("http://127.0.0.1:$candidate/")
        $listener.Start()
        $port = $candidate
        break
    } catch { }
}
if ($port -eq 0) { Write-Host "Не удалось занять порт"; exit 1 }

$mime = @{
    ".html" = "text/html; charset=utf-8"; ".js" = "application/javascript; charset=utf-8";
    ".css" = "text/css; charset=utf-8"; ".json" = "application/json; charset=utf-8";
    ".svg" = "image/svg+xml"; ".png" = "image/png"; ".jpg" = "image/jpeg";
    ".jpeg" = "image/jpeg"; ".webp" = "image/webp"; ".ico" = "image/x-icon";
    ".woff2" = "font/woff2"; ".md" = "text/markdown; charset=utf-8"
}

Write-Host "Ширма мастера: http://127.0.0.1:$port/"
Start-Process "http://127.0.0.1:$port/"

while ($listener.IsListening) {
    try {
        $ctx = $listener.GetContext()
    } catch { break }
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart("/")
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }
    $path = Join-Path $root $rel
    if ((Test-Path $path) -and (Test-Path $path -PathType Leaf)) {
        $ext = [System.IO.Path]::GetExtension($path).ToLower()
        $type = $mime[$ext]
        if (-not $type) { $type = "application/octet-stream" }
        $bytes = [System.IO.File]::ReadAllBytes($path)
        $ctx.Response.ContentType = $type
        $ctx.Response.ContentLength64 = $bytes.Length
        $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $ctx.Response.StatusCode = 404
        $msg = [System.Text.Encoding]::UTF8.GetBytes("404")
        $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
    }
    $ctx.Response.OutputStream.Close()
}
