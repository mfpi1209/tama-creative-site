"""Servidor local do Inventário (/admin/inventario/) para testar sem o GitHub.

Responde em http://localhost:8081/api/v1 às mesmas ações do servidor local do Decap (npx decap-server) que o inventário
usa: getEntry (lê um arquivo) e persistEntry (grava arquivos de dados e fotos). Grava direto nesta pasta, sem commit:
confira com `git diff` e rode o build para ver o resultado. Só aceita caminhos de src/data/, img/produtos/ e img/v2/.

Uso:
  python -I tools/admin_local.py [--porta 8081]
  em outro terminal: python build.py && python -m http.server 8215 --directory dist
  abra http://127.0.0.1:8215/admin/inventario/
"""
import argparse, base64, json, os, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PERMITIDOS = ('src/data/', 'img/produtos/', 'img/v2/')


def caminho(rel):
    rel = (rel or '').replace('\\', '/').lstrip('/')
    full = os.path.normpath(os.path.join(ROOT, rel))
    if not rel.startswith(PERMITIDOS) or os.path.commonpath([full, ROOT]) != ROOT:
        raise ValueError(f'caminho não permitido: {rel}')
    return full


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        origem = self.headers.get('Origin') or ''
        if origem.startswith(('http://localhost', 'http://127.0.0.1')):   # só páginas locais
            self.send_header('Access-Control-Allow-Origin', origem)
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')

    def _responder(self, status, dados):
        corpo = json.dumps(dados, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self._cors()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_POST(self):
        if self.path.rstrip('/') != '/api/v1':
            return self._responder(404, {'error': 'use /api/v1'})
        try:
            req = json.loads(self.rfile.read(int(self.headers.get('Content-Length') or 0)) or b'{}')
            acao, p = req.get('action'), req.get('params') or {}
            if acao == 'getEntry':
                full = caminho(p.get('path'))
                if not os.path.isfile(full):
                    return self._responder(404, {'error': 'arquivo não encontrado'})
                return self._responder(200, {'file': {'path': p['path']}, 'data': open(full, encoding='utf-8').read()})
            if acao == 'persistEntry':
                entry = p.get('entry') or {}
                gravados = []
                for f in entry.get('dataFiles') or []:
                    full = caminho(f.get('path'))
                    os.makedirs(os.path.dirname(full), exist_ok=True)
                    with open(full, 'w', encoding='utf-8') as out:
                        out.write(f.get('raw') or '')
                    gravados.append(f['path'])
                for a in entry.get('assets') or []:
                    full = caminho(a.get('path'))
                    os.makedirs(os.path.dirname(full), exist_ok=True)
                    with open(full, 'wb') as out:
                        out.write(base64.b64decode(a.get('content') or ''))
                    gravados.append(a['path'])
                print('gravado:', ', '.join(gravados), '|', (p.get('options') or {}).get('commitMessage', '').split('\n')[0], flush=True)
                return self._responder(200, {'message': 'ok', 'gravados': gravados})
            return self._responder(400, {'error': f'ação não suportada: {acao}'})
        except ValueError as e:
            return self._responder(403, {'error': str(e)})
        except Exception as e:   # noqa: BLE001 - devolve o erro ao navegador
            return self._responder(500, {'error': str(e)})

    def log_message(self, fmt, *args):
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--porta', type=int, default=int(os.environ.get('DECAP_PORT', '8081')))
    a = ap.parse_args()
    srv = ThreadingHTTPServer(('127.0.0.1', a.porta), Handler)
    print(f'Inventário local: http://localhost:{a.porta}/api/v1 → {ROOT} (Ctrl+C para parar)', flush=True)
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        sys.exit(0)


if __name__ == '__main__':
    main()
