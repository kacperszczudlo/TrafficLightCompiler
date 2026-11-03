@echo off
set JAVA_CMD="C:\Program Files\Android\Android Studio\jbr\bin\java.exe"
if not exist %JAVA_CMD% (
    set JAVA_CMD=java
)

echo [*] Generowanie klas ANTLR4 z gramatyki grammar/TrafficLight.g4...
%JAVA_CMD% -jar tools\antlr-4.13.2-complete.jar -Dlanguage=Python3 -visitor -o src\generated grammar\TrafficLight.g4

if %ERRORLEVEL% equ 0 (
    echo [+] Parser i lekser wygenerowane pomyslnie w src\generated\
) else (
    echo [-] Blad podczas generowania parsera.
)
