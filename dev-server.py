#!/usr/bin/env python3
import json
import os
import re
import tempfile
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOST = "127.0.0.1"
PORT = int(os.environ.get("PORT", "4173"))
ALLOWED_PATH = re.compile(
    r"^data/(?:catalog\.json|questions/[a-z0-9]+(?:-[a-z0-9]+)*/\d{4}/[A-Za-z0-9_-]+\.json)$"
)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        if self.path.endswith((".html", ".js", ".css", ".json")):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, status, payload):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/api/admin/capabilities":
            self.send_json(200, {"fileWrite": True, "root": str(ROOT)})
            return
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/admin/save-content":
            self.send_json(404, {"error": "Not found"})
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 25 * 1024 * 1024:
                raise ValueError("保存データのサイズが不正です")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            files = payload.get("files")
            if not isinstance(files, list) or not files or len(files) > 500:
                raise ValueError("files は1〜500件の配列で指定してください")

            prepared = []
            for item in files:
                relative = str(item.get("path", ""))
                content = item.get("content")
                if not ALLOWED_PATH.fullmatch(relative):
                    raise ValueError(f"保存できないパスです: {relative}")
                if not isinstance(content, str):
                    raise ValueError(f"content が文字列ではありません: {relative}")
                json.loads(content)
                destination = (ROOT / relative).resolve()
                if ROOT not in destination.parents:
                    raise ValueError(f"dataフォルダ外へは保存できません: {relative}")
                prepared.append((relative, content, destination))

            # catalogは各問題JSONの保存後に更新する。
            prepared.sort(key=lambda item: item[0] == "data/catalog.json")
            saved = []
            for relative, content, destination in prepared:
                destination.parent.mkdir(parents=True, exist_ok=True)
                with tempfile.NamedTemporaryFile(
                    "w", encoding="utf-8", dir=destination.parent, delete=False
                ) as temporary:
                    temporary.write(content)
                    temporary_path = Path(temporary.name)
                temporary_path.replace(destination)
                saved.append(relative)
            self.send_json(200, {"saved": saved, "count": len(saved)})
        except (ValueError, json.JSONDecodeError) as error:
            self.send_json(400, {"error": str(error)})
        except Exception as error:
            self.send_json(500, {"error": f"保存に失敗しました: {error}"})


if __name__ == "__main__":
    print(f"Seiho Study: http://{HOST}:{PORT}")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
