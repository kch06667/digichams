# Local, private Windows portable build. Run after downloading the source ZIP
# and extracting ALL files. Git is NOT required. No upload or publishing.
[CmdletBinding()]
param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$package = Join-Path $PSScriptRoot 'package.json'
$index = Join-Path $root 'index.html'
$catalog = Join-Path $root 'assets\sprite-index.json'
if (-not (Test-Path $package) -or -not (Test-Path $index) -or -not (Test-Path $catalog)) {
    throw '게임의 모든 파일을 먼저 압축 해제해야 합니다. desktop 폴더만 따로 실행하지 마세요.'
}
if (-not $IsWindows -and $PSVersionTable.PSEdition -eq 'Core') {
    throw 'Windows PC에서 PowerShell로 실행해 주세요.'
}
foreach ($command in @('node.exe', 'npm.cmd')) {
    if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
        throw "$command 이(가) 없습니다. 먼저 Node.js LTS를 설치해 주세요."
    }
}
Push-Location $PSScriptRoot
try {
    Write-Host '1/4: 기존 원본 게임 리소스 검증'
    & node.exe 'tests/release-preflight.test.cjs'
    if ($LASTEXITCODE -ne 0) { throw '출시 전 원본 파일 검사 실패' }

    if (-not $SkipInstall) {
        Write-Host '2/4: Windows 전용 Electron 의존성 설치'
        & npm.cmd install --no-audit --no-fund --no-package-lock
        if ($LASTEXITCODE -ne 0) { throw '의존성 설치 실패' }
    } else {
        Write-Host '2/4: 기존 node_modules 사용'
        if (-not (Test-Path 'node_modules')) { throw 'node_modules가 없습니다. -SkipInstall 없이 다시 실행하세요.' }
    }

    Write-Host '3/4: 실행기 테스트 및 서명 없는 개인용 Windows EXE 빌드'
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Windows 실행기 테스트 실패' }
    & npm.cmd run build:win
    if ($LASTEXITCODE -ne 0) { throw 'Portable Windows EXE 빌드 실패' }

    Write-Host '4/4: 산출물 검사 (공개 업로드 없음)'
    $output = Join-Path $root 'dist\desktop'
    $files = @(Get-ChildItem -Path $output -Filter 'Digimon-Championship-*-Windows-x64.exe' -File)
    if ($files.Count -ne 1) { throw "Portable EXE가 정확히 1개 있어야 합니다. 실제: $($files.Count)개" }
    $exe = $files[0]
    if ($exe.Length -lt 10000000) { throw 'EXE 크기가 지나치게 작습니다.' }
    $sha = Get-FileHash -Path $exe.FullName -Algorithm SHA256
    Write-Host ('PASS 개인용 EXE: ' + $exe.FullName)
    Write-Host ('SHA256: ' + $sha.Hash)
    Write-Warning '서명되지 않은 개인 검수용 빌드입니다. 원작 관련 자산의 재배포 권한은 확인되지 않았으므로 공개 업로드하지 마세요.'
    Write-Warning '실제 화면과 원작 밸런스/연출의 최종 검수는 아직 필요합니다. 첫 플레이 전 기존 세이브를 JSON으로 백업하세요.'
} finally {
    Pop-Location
}
