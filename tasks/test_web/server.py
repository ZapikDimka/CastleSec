from http.server import HTTPServer, BaseHTTPRequestHandler
import sys

HTML = b"""<!DOCTYPE html>
<html>
<body>
  <h1>Test Task</h1>
  <form method="POST" action="/succeed"><button type="submit">Succeed</button></form>
  <form method="POST" action="/fail"><button type="submit">Fail</button></form>
</body>
</html>"""


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(HTML)

    def do_POST(self):
        self.send_response(200)
        self.end_headers()
        if self.path == "/succeed":
            self.wfile.write(b"Success!")
            sys.exit(0)
        else:
            self.wfile.write(b"Failed!")
            sys.exit(1)

    def log_message(self, *args):
        pass


HTTPServer(("0.0.0.0", 8080), Handler).serve_forever()
