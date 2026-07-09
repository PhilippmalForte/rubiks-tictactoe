#!/usr/bin/env python3
"""Tiny static file server for local development.

Unlike `python3 -m http.server`, this sends `Cache-Control: no-store` on every
response so the browser always re-fetches HTML/CSS/JS. That avoids the classic
"I edited the file but the browser runs the old version" trap with ES modules,
which browsers otherwise cache aggressively when no cache headers are present.
"""

import http.server
import socketserver

PORT = 5500


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


class Server(socketserver.TCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    with Server(("", PORT), NoCacheHandler) as httpd:
        print(f"Serving http://localhost:{PORT} (no-store)")
        httpd.serve_forever()
