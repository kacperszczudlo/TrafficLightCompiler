#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Serwer aplikacji GUI i symulatora TrafficLightCompiler.
Opiera się wyłącznie na standardowej bibliotece Pythona (http.server),
co gwarantuje zerową zależność od zewnętrznych bibliotek (brak konieczności instalowania czegokolwiek z pip).
"""

import os
import sys
import json
import socket
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

# Upewniamy się, że bieżący katalog jest na ścieżce importów
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from compiler import compile_source_string

class TrafficCompilerHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        # Serwujemy pliki z katalogu gui/
        gui_dir = os.path.join(BASE_DIR, "gui")
        super().__init__(*args, directory=gui_dir, **kwargs)

    def end_headers(self):
        # Zapobiegamy cache'owaniu w przeglądarce podczas testów
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/examples":
            self.handle_get_examples()
            return
        elif parsed.path == "/" or parsed.path == "/index.html":
            self.path = "/index.html"
            return super().do_GET()
        else:
            return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)

        if parsed.path == "/api/compile":
            self.handle_post_compile()
            return
        else:
            self.send_error(404, "Nieznany endpoint API")

    def handle_get_examples(self):
        examples_dir = os.path.join(BASE_DIR, "examples")
        examples_data = {}

        if os.path.exists(examples_dir):
            for filename in sorted(os.listdir(examples_dir)):
                if filename.endswith(".traffic"):
                    filepath = os.path.join(examples_dir, filename)
                    try:
                        with open(filepath, "r", encoding="utf-8") as f:
                            examples_data[filename] = f.read()
                    except Exception as e:
                        examples_data[filename] = f"// Błąd odczytu: {e}"

        response_body = json.dumps(examples_data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response_body)))
        self.end_headers()
        self.wfile.write(response_body)

    def handle_post_compile(self):
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            post_data = self.rfile.read(content_length).decode("utf-8")
            payload = json.loads(post_data)
            source_code = payload.get("code", "")

            # Wywołanie kompilatora
            result = compile_source_string(source_code)

            response_body = json.dumps(result, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)

        except Exception as e:
            err_data = {
                "valid": False,
                "error_type": "ServerException",
                "error_message": f"Wewnętrzny błąd serwera: {str(e)}",
                "logs": [f"[!] Wyjątek serwera: {str(e)}"],
                "dfa": None,
                "target_code": None
            }
            response_body = json.dumps(err_data, ensure_ascii=False).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)

def find_free_port(preferred_ports=[8000, 8080, 8888, 5000]):
    for port in preferred_ports:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            if s.connect_ex(("127.0.0.1", port)) != 0:
                return port
    # Jeśli wszystkie zajęte, pozwól systemowi przydzielić wolny
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("", 0))
        return s.getsockname()[1]

def main():
    port = find_free_port()
    server_address = ("127.0.0.1", port)
    httpd = HTTPServer(server_address, TrafficCompilerHandler)

    url = f"http://localhost:{port}"
    print("=" * 70)
    print("🚦 TrafficLightCompiler — Interaktywne GUI i Symulator Skrzyżowania")
    print(f"[*] Serwer uruchomiony pod adresem: {url}")
    print("[*] Wciśnij Ctrl+C, aby zatrzymać serwer.")
    print("=" * 70)

    # Otwórz przeglądarkę automatycznie, jeśli nie przekazano flagi --no-browser
    if "--no-browser" not in sys.argv:
        try:
            webbrowser.open(url)
        except Exception:
            pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n[*] Zatrzymywanie serwera GUI...")
        httpd.server_close()
        print("[+] Serwer zatrzymany.")

if __name__ == "__main__":
    main()
