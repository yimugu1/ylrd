# 在 Linux 服务器上用 bash 运行 deploy-china.sh；本脚本仅用于 Windows 上准备 .env
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "已创建 .env，请编辑后把项目上传到服务器，在服务器执行: bash scripts/deploy-china.sh"
  exit 1
}
Write-Host ".env 已存在。请在 Linux 服务器上安装 Docker 后运行: docker compose up -d --build"
