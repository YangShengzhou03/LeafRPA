@echo off
rem 轻羽RPA Native Host 启动器（Chrome 要求 manifest 的 path 指向可直接执行的文件）
rem 由 Chrome native messaging 拉起；stdin/stdout 已重定向到命名管道，必须保持进程前台运行。
setlocal
set "HOST_DIR=%~dp0"

rem 依次尝试：随包运行时 ^> 本机已安装 Python ^> PATH
if exist "%~dp0python-runtime\python.exe" (
  set "PY=%~dp0python-runtime\python.exe"
) else if exist "%LOCALAPPDATA%\Programs\Python\Python312\python.exe" (
  set "PY=%LOCALAPPDATA%\Programs\Python\Python312\python.exe"
) else if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
  set "PY=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
) else (
  set "PY=python"
)

"%PY%" "%HOST_DIR%leaf_host.py"
