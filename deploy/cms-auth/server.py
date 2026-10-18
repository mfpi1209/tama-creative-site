#!/usr/bin/env python3
"""Login do editor do blog (Decap CMS) com GitHub, rodando no Easypanel. Só biblioteca padrão do Python.

Fluxo OAuth (o mesmo protocolo do provedor do Netlify que o Decap espera):
  GET /auth      -> redireciona para o GitHub (com 'state' anti-CSRF em cookie)
  GET /callback  -> troca o 'code' pelo token no GitHub e entrega o token à janela do editor (postMessage)
  GET /health    -> 200 "ok"

O Nginx do site expõe este serviço em https://tamacreative.com.br/api/cms-auth/ (rede interna do Easypanel).

Variáveis de ambiente (no Easypanel, nunca no repositório):
  GITHUB_CLIENT_ID      obrigatório: Client ID do OAuth App do GitHub
  GITHUB_CLIENT_SECRET  obrigatório: Client secret do OAuth App
  ALLOWED_ORIGIN        origem do editor que pode receber o token (padrão https://tamacreative.com.br)
  PUBLIC_URL            endereço público deste serviço (padrão https://tamacreative.com.br/api/cms-auth)
  PORT                  porta interna (padrão 8080)
"""
import html
import http.cookies
import json
import os
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

CLIENT_ID = os.environ.get('GITHUB_CLIENT_ID', '').strip()
CLIENT_SECRET = os.environ.get('GITHUB_CLIENT_SECRET', '').strip()
ORIGIN = os.environ.get('ALLOWED_ORIGIN', 'https://tamacreative.com.br').rstrip('/')
PUBLIC_URL = os.environ.get('PUBLIC_URL', ORIGIN + '/api/cms-auth').rstrip('/')
PORT = int(os.environ.get('PORT', '8080'))
AUTHORIZE_URL = os.environ.get('GITHUB_AUTHORIZE_URL', 'https://github.com/login/oauth/authorize')   # trocáveis só para testes
TOKEN_URL = os.environ.get('GITHUB_TOKEN_URL', 'https://github.com/login/oauth/access_token')
SCOPES = {'repo', 'public_repo', 'user', 'read:user', 'user:email'}
COOKIE = 'cms_oauth_state'
COOKIE_PATH = urllib.parse.urlsplit(PUBLIC_URL).path or '/'   # cookie só vale para /api/cms-auth


def log(msg):
    print(msg, file=sys.stderr, flush=True)


class Handler(BaseHTTPRequestHandler):
    server_version = 'cms-auth'
    sys_version = ''

    def log_message(self, fmt, *args):  # sem querystring no log (pode ter o code)
        log(f'{self.address_string()} {self.command} {self.path.split("?")[0]} {args[1] if len(args) > 1 else ""}')

    def send(self, status, body, ctype='text/plain; charset=utf-8', headers=None):
        data = body.encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        for k, v in (headers or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urllib.parse.urlsplit(self.path)
        q = dict(urllib.parse.parse_qsl(url.query))
        path = url.path.rstrip('/') or '/'
        if path.endswith('/health'):
            return self.send(200, 'ok')
        if not CLIENT_ID or not CLIENT_SECRET:
            return self.send(503, 'Login do editor ainda não configurado: defina GITHUB_CLIENT_ID e GITHUB_CLIENT_SECRET no Easypanel.')
        if path.endswith('/auth'):
            return self.auth(q)
        if path.endswith('/callback'):
            return self.callback(q)
        return self.send(404, 'não encontrado')

    def auth(self, q):
        if q.get('provider', 'github') != 'github':
            return self.send(400, 'Provedor não suportado.')
        scope = ','.join(s for s in q.get('scope', 'repo').replace(' ', ',').split(',') if s in SCOPES) or 'repo'
        state = secrets.token_urlsafe(24)
        target = AUTHORIZE_URL + '?' + urllib.parse.urlencode({
            'client_id': CLIENT_ID, 'redirect_uri': PUBLIC_URL + '/callback', 'scope': scope, 'state': state})
        cookie = f'{COOKIE}={state}; Path={COOKIE_PATH}; Max-Age=600; HttpOnly; SameSite=Lax' + ('; Secure' if PUBLIC_URL.startswith('https://') else '')
        self.send_response(302)
        self.send_header('Location', target)
        self.send_header('Set-Cookie', cookie)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def callback(self, q):
        jar = http.cookies.SimpleCookie(self.headers.get('Cookie', ''))
        expected = jar[COOKIE].value if COOKIE in jar else ''
        clear = {'Set-Cookie': f'{COOKIE}=; Path={COOKIE_PATH}; Max-Age=0; HttpOnly; SameSite=Lax'}
        if q.get('error'):
            return self.finish_login('error', {'message': q.get('error_description') or q['error']}, clear)
        if not q.get('code') or not expected or not secrets.compare_digest(q.get('state', ''), expected):
            return self.finish_login('error', {'message': 'Sessão de login expirada ou inválida. Feche esta janela e tente entrar de novo.'}, clear)
        body = urllib.parse.urlencode({'client_id': CLIENT_ID, 'client_secret': CLIENT_SECRET, 'code': q['code'],
                                       'redirect_uri': PUBLIC_URL + '/callback'}).encode()
        req = urllib.request.Request(TOKEN_URL, data=body, headers={'Accept': 'application/json', 'User-Agent': 'tama-cms-auth'})
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                data = json.loads(r.read().decode('utf-8'))
        except (urllib.error.URLError, ValueError) as e:
            log(f'erro ao falar com o GitHub: {e}')
            return self.finish_login('error', {'message': 'Não foi possível falar com o GitHub agora. Tente de novo.'}, clear)
        token = data.get('access_token')
        if not token:
            log(f'GitHub recusou o código: {data.get("error")}')
            return self.finish_login('error', {'message': data.get('error_description') or 'O GitHub recusou o login.'}, clear)
        return self.finish_login('success', {'token': token, 'provider': 'github'}, clear)

    def finish_login(self, status, content, headers):
        """Entrega o resultado à janela do Decap: espera o 'authorizing:github' dele e responde só para ALLOWED_ORIGIN."""
        nonce = secrets.token_urlsafe(16)
        msg = json.dumps(f'authorization:github:{status}:' + json.dumps(content)).replace('</', '<\\/')
        origin = json.dumps(ORIGIN)
        text = 'Login concluído. Esta janela vai fechar.' if status == 'success' else html.escape(content.get('message', 'Erro no login.'))
        page = f'''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="robots" content="noindex">
<title>Editor do blog · login</title></head><body style="font-family:system-ui,sans-serif;padding:24px"><p>{text}</p>
<script nonce="{nonce}">
(function () {{
  var origin = {origin}, msg = {msg};
  function receive(e) {{
    if (e.origin !== origin) return;
    window.removeEventListener('message', receive);
    window.opener.postMessage(msg, origin);
    {'setTimeout(function () { window.close(); }, 400);' if status == 'success' else ''}
  }}
  if (!window.opener) return;
  window.addEventListener('message', receive, false);
  window.opener.postMessage('authorizing:github', origin);
}})();
</script></body></html>'''
        csp = f"default-src 'none'; script-src 'nonce-{nonce}'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
        return self.send(200, page, 'text/html; charset=utf-8', dict(headers, **{'Content-Security-Policy': csp, 'Referrer-Policy': 'no-referrer'}))


if __name__ == '__main__':
    if not CLIENT_ID or not CLIENT_SECRET:
        log('AVISO: GITHUB_CLIENT_ID/GITHUB_CLIENT_SECRET não definidos; /auth responde 503 até serem configurados.')
    log(f'cms-auth na porta {PORT} | origem permitida {ORIGIN} | callback {PUBLIC_URL}/callback')
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()
