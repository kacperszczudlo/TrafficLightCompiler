# Skrypt generujący kod parsera i leksera ANTLR4 dla Pythona
$ErrorActionPreference = "Stop"

$JavaCmd = "java"
if (Get-Command "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" -ErrorAction SilentlyContinue) {
    $JavaCmd = "C:\Program Files\Android\Android Studio\jbr\bin\java.exe"
}

Write-Host "[*] Generowanie klas ANTLR4 z gramatyki grammar/TrafficLight.g4..."
& $JavaCmd -jar tools/antlr-4.13.2-complete.jar -Dlanguage=Python3 -visitor -o src/generated grammar/TrafficLight.g4

if ($LASTEXITCODE -eq 0) {
    Write-Host "[+] Parser i lekser wygenerowane pomyślnie w src/generated/"
} else {
    Write-Error "[-] Błąd generowania parsera."
}
