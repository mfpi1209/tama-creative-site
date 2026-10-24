#!/usr/bin/env python3
"""Login com usuário e senha do Inventário (/admin/inventario/), rodando no Easypanel. Só biblioteca padrão do Python.

Quem opera o inventário entra com usuário e senha da TaMa, sem conta no GitHub: este serviço confere a senha, abre
uma sessão (cookie assinado, HttpOnly) e grava no repositório com um token do GitHub que fica só aqui. O Nginx do site
expõe o serviço em https://tamacreative.com.br/api/admin/ (rede interna do Easypanel).

Rotas (JSON):
  GET  /health                 200 "ok"
  POST /login   {usuario, senha}
  POST /sair
  GET  /eu                     {usuario} ou 401
  POST /ler     {path}         {texto}: um dos arquivos de dados do catálogo, da branch de produção
  POST /salvar  {arquivos: [{path, texto | b64}], mensagem, publicar}
                               um commit numa branch inventario/<data-hora> + pull request; publicar = juntar na hora
  GET  /rascunhos              pull requests abertos do inventário
  POST /rascunhos/publicar {n} | /rascunhos/descartar {n}

Variáveis de ambiente (no Easypanel, nunca no repositório):
  ADMIN_USUARIOS   obrigatório: "usuario:hash;outro:hash" (gere cada linha com: python3 tools/admin_senha.py <usuario>).
                   Hash sem "$" (pbkdf2-sha256.<iterações>.<sal>.<hash>, base64url), para o painel não interpretar
                   "$" como variável; o formato antigo com "$" continua aceito
  ADMIN_SEGREDO    obrigatório: texto aleatório longo que assina as sessões (python tools/admin_senha.py --segredo)
  GITHUB_TOKEN     obrigatório: token "fine-grained" do GitHub só para o repositório, com Contents e Pull requests
                   em leitura e escrita
  GITHUB_REPO      padrão mfpi1209/tama-creative-site
  GITHUB_BRANCH    padrão main
  ALLOWED_ORIGIN   padrão https://tamacreative.com.br (só páginas desta origem podem chamar o serviço)
  SESSAO_HORAS     padrão 12
  PORT             padrão 8080
  INSEGURO=1       só para teste local em http: cookie sem "Secure"
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

SEGREDO = os.environ.get('ADMIN_SEGREDO', '').encode()
TOKEN = os.environ.get('GITHUB_TOKEN', '').strip()
REPO = os.environ.get('GITHUB_REPO', 'mfpi1209/tama-creative-site').strip()
BRANCH = os.environ.get('GITHUB_BRANCH', 'main').strip()
ORIGIN = os.environ.get('ALLOWED_ORIGIN', 'https://tamacreative.com.br').rstrip('/')
API = os.environ.get('GITHUB_API', 'https://api.github.com').rstrip('/')   # trocável só para testes
HORAS = float(os.environ.get('SESSAO_HORAS', '12'))
PORT = int(os.environ.get('PORT', '8080'))
INSEGURO = os.environ.get('INSEGURO') == '1'
COOKIE = 'tama_admin'

LER = {'src/data/produtos.json', 'src/data/modelos.json', 'src/data/selecoes.json', 'src/data/kits.json', 'src/data/site.json'}
GRAVAR_RE = re.compile(r'^(src/data/(produtos|modelos|selecoes|kits|site)\.json'
                       r'|img/produtos/[a-z0-9]+(-[a-z0-9]+)*~[a-z0-9]+(-[a-z0-9]+)*\.(webp|png|jpg)'
                       r'|img/v2/(kit|slide|topo)-[a-z0-9]+(-[a-z0-9]+)*\.(webp|png|jpg))$')   # fotos de kits, do carrossel e dos cabeçalhos
MAX_CORPO = 60 * 1024 * 1024        # pedido inteiro (fotos em base64)
MAX_FOTO = 12 * 1024 * 1024         # cada foto, já decodificada
TENTATIVAS, JANELA = 5, 15 * 60     # 5 senhas erradas por IP em 15 minutos


def usuarios():
    """ADMIN_USUARIOS -> {usuario: hash}. Hash: pbkdf2-sha256.<iterações>.<sal>.<hash> (base64url) ou o formato antigo
    pbkdf2_sha256$<iterações>$<sal base64>$<hash base64>."""
    out = {}
    for parte in os.environ.get('ADMIN_USUARIOS', '').replace('\n', ';').split(';'):
        if ':' in parte:
            u, h = parte.strip().split(':', 1)
            if u and h:
                out[u.strip().lower()] = h.strip()
    return out


def _partes(guardado):
    """(iterações, sal, hash) de um hash válido nos dois formatos; None se estiver incompleto ou corrompido."""
    try:
        if guardado.startswith('pbkdf2-sha256.'):
            _, it, sal, h = guardado.split('.')
            dec = lambda x: base64.urlsafe_b64decode(x + '=' * (-len(x) % 4))
        else:
            alg, it, sal, h = guardado.split('$')
            if alg != 'pbkdf2_sha256':
                return None
            dec = base64.b64decode
        sal, h = dec(sal), dec(h)
        return (int(it), sal, h) if int(it) >= 100000 and len(sal) >= 16 and len(h) == 32 else None
    except (ValueError, TypeError):
        return None


def confere_senha(senha, guardado):
    p = _partes(guardado)
    if not p:
        return False
    calc = hashlib.pbkdf2_hmac('sha256', senha.encode(), p[1], p[0])
    return hmac.compare_digest(calc, p[2])


_FALSO = 'pbkdf2-sha256.310000.' + base64.urlsafe_b64encode(b'x' * 16).decode().rstrip('=') + '.' + base64.urlsafe_b64encode(b'y' * 32).decode().rstrip('=')


def assinar(dados):
    corpo = base64.urlsafe_b64encode(json.dumps(dados, separators=(',', ':')).encode()).decode().rstrip('=')
    sig = base64.urlsafe_b64encode(hmac.new(SEGREDO, corpo.encode(), hashlib.sha256).digest()).decode().rstrip('=')
    return corpo + '.' + sig


def ler_sessao(valor):
    try:
        corpo, sig = valor.split('.')
        certo = base64.urlsafe_b64encode(hmac.new(SEGREDO, corpo.encode(), hashlib.sha256).digest()).decode().rstrip('=')
        if not hmac.compare_digest(sig, certo):
            return None
        dados = json.loads(base64.urlsafe_b64decode(corpo + '=' * (-len(corpo) % 4)))
        if dados.get('exp', 0) < time.time() or dados.get('u') not in usuarios():   # usuário removido perde a sessão
            return None
        return dados
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


_falhas, _trava = {}, threading.Lock()


def bloqueado(ip):
    with _trava:
        agora = time.time()
        _falhas[ip] = [t for t in _falhas.get(ip, []) if agora - t < JANELA]
        return len(_falhas[ip]) >= TENTATIVAS


def falhou(ip):
    with _trava:
        _falhas.setdefault(ip, []).append(time.time())


class ErroGitHub(Exception):
    pass


def gh(metodo, caminho, corpo=None, raw=False):
    req = urllib.request.Request(API + caminho, method=metodo, data=json.dumps(corpo).encode() if corpo is not None else None, headers={
        'Authorization': 'Bearer ' + TOKEN, 'User-Agent': 'tama-admin-api',
        'Accept': 'application/vnd.github.raw+json' if raw else 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            dados = r.read()
            return dados.decode('utf-8') if raw else (json.loads(dados) if dados else None)
    except urllib.error.HTTPError as e:
        raise ErroGitHub(f'GitHub respondeu {e.code} em {caminho}: {e.read()[:300].decode(errors="replace")}')
    except urllib.error.URLError as e:
        raise ErroGitHub(f'GitHub indisponível: {e.reason}')


def salvar(arquivos, mensagem, publicar, usuario):
    for a in arquivos:
        if not GRAVAR_RE.match(a.get('path') or ''):
            raise ValueError(f"caminho não permitido: {a.get('path')}")
        if a.get('b64') is not None and len(a['b64']) * 3 // 4 > MAX_FOTO:
            raise ValueError(f"foto grande demais: {a['path']}")
    mensagem = (mensagem or 'Inventário').strip()[:4000] + f'\n\nEnviado por {usuario} pelo Inventário (/admin/inventario/).'
    titulo = mensagem.split('\n')[0][:120]
    base = gh('GET', f'/repos/{REPO}/git/ref/heads/{BRANCH}')['object']['sha']
    arvore_base = gh('GET', f'/repos/{REPO}/git/commits/{base}')['tree']['sha']
    arvore = []
    for a in arquivos:
        blob = gh('POST', f'/repos/{REPO}/git/blobs', {'content': a['b64'], 'encoding': 'base64'} if a.get('b64') is not None
                  else {'content': a.get('texto') or '', 'encoding': 'utf-8'})
        arvore.append({'path': a['path'], 'mode': '100644', 'type': 'blob', 'sha': blob['sha']})
    tree = gh('POST', f'/repos/{REPO}/git/trees', {'base_tree': arvore_base, 'tree': arvore})
    agora = datetime.now(timezone.utc)
    commit = gh('POST', f'/repos/{REPO}/git/commits', {'message': mensagem, 'tree': tree['sha'], 'parents': [base],
                                                        'author': {'name': f'{usuario} (Inventário)', 'email': 'inventario@tamacreative.com.br', 'date': agora.isoformat()}})
    ramo = 'inventario/' + agora.strftime('%Y%m%d%H%M%S') + '-' + secrets.token_hex(2)
    gh('POST', f'/repos/{REPO}/git/refs', {'ref': 'refs/heads/' + ramo, 'sha': commit['sha']})
    pr = gh('POST', f'/repos/{REPO}/pulls', {'title': titulo, 'head': ramo, 'base': BRANCH, 'body': mensagem})
    if not publicar:
        return {'url': pr['html_url'], 'publicado': False}
    juntar(pr['number'], titulo, ramo)
    return {'url': pr['html_url'], 'publicado': True}


def juntar(n, titulo, ramo):
    gh('PUT', f'/repos/{REPO}/pulls/{n}/merge', {'merge_method': 'squash', 'commit_title': f'{titulo} (#{n})'})
    try:
        gh('DELETE', f'/repos/{REPO}/git/refs/heads/{ramo}')
    except ErroGitHub:
        pass


def rascunho(n):
    """Pull request aberto do inventário (branch inventario/…); qualquer outro número é recusado."""
    pr = gh('GET', f'/repos/{REPO}/pulls/{int(n)}')
    if not pr or pr.get('state') != 'open' or not pr['head']['ref'].startswith('inventario/') or pr['base']['ref'] != BRANCH:
        raise ValueError('rascunho não encontrado')
    return pr


class Handler(BaseHTTPRequestHandler):
    server_version = 'tama-admin'
    sys_version = ''

    def _ip(self):
        return (self.headers.get('X-Real-IP') or self.client_address[0]).strip()

    def _json(self, status, dados, cookie=None):
        corpo = json.dumps(dados, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        if cookie is not None:
            self.send_header('Set-Cookie', cookie)
        self.send_header('Content-Length', str(len(corpo)))
        self.end_headers()
        self.wfile.write(corpo)

    def _cookie(self, valor, idade):
        return (f'{COOKIE}={valor}; Path=/api/admin; Max-Age={idade}; HttpOnly; SameSite=Strict' + ('' if INSEGURO else '; Secure'))

    def _sessao(self):
        for parte in (self.headers.get('Cookie') or '').split(';'):
            k, _, v = parte.strip().partition('=')
            if k == COOKIE:
                return ler_sessao(v)
        return None

    def _corpo(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > MAX_CORPO:
            raise ValueError('envio grande demais (fotos acima do limite)')
        return json.loads(self.rfile.read(n) or b'{}')

    def do_GET(self):
        if self.path == '/health':
            # sem segredos: só quantos usuários estão configurados e quantos têm o hash completo (um "$" interpretado
            # pelo painel, por exemplo, corta o hash e nenhuma senha confere)
            us = usuarios()
            validos = sum(1 for h in us.values() if _partes(h))
            corpo = f'ok · {len(us)} usuário(s), {validos} com senha em formato válido'.encode()
            self.send_response(200); self.send_header('Content-Type', 'text/plain; charset=utf-8'); self.end_headers(); self.wfile.write(corpo)
            return
        s = self._sessao()
        if not s:
            return self._json(401, {'erro': 'login'})
        if self.path == '/eu':
            return self._json(200, {'usuario': s['u']})
        if self.path == '/rascunhos':
            try:
                l = gh('GET', f'/repos/{REPO}/pulls?state=open&per_page=50') or []
            except ErroGitHub as e:
                return self._json(502, {'erro': str(e)})
            return self._json(200, [{'n': p['number'], 'titulo': p['title'], 'url': p['html_url'], 'ref': p['head']['ref'], 'data': p['created_at']}
                                    for p in l if p['head']['ref'].startswith('inventario/')])
        return self._json(404, {'erro': 'rota desconhecida'})

    def do_POST(self):
        # só páginas do próprio site (o cookie também é SameSite=Strict) e só JSON
        if (self.headers.get('Origin') or '').rstrip('/') != ORIGIN or 'application/json' not in (self.headers.get('Content-Type') or ''):
            return self._json(403, {'erro': 'origem não permitida'})
        try:
            dados = self._corpo()
        except (ValueError, json.JSONDecodeError) as e:
            return self._json(400, {'erro': str(e)})
        if self.path == '/login':
            ip = self._ip()
            if bloqueado(ip):
                return self._json(429, {'erro': 'Muitas tentativas. Espere 15 minutos e tente de novo.'})
            u = str(dados.get('usuario') or '').strip().lower()
            senha = str(dados.get('senha') or '')
            guardado = usuarios().get(u)
            ok = confere_senha(senha, guardado or _FALSO) and guardado is not None   # mesmo tempo com usuário inexistente
            if not ok:
                falhou(ip)
                time.sleep(0.5)
                return self._json(401, {'erro': 'Usuário ou senha incorretos.'})
            return self._json(200, {'usuario': u}, self._cookie(assinar({'u': u, 'exp': int(time.time() + HORAS * 3600)}), int(HORAS * 3600)))
        if self.path == '/sair':
            return self._json(200, {'ok': True}, self._cookie('', 0))
        s = self._sessao()
        if not s:
            return self._json(401, {'erro': 'login'})
        try:
            if self.path == '/ler':
                if dados.get('path') not in LER:
                    return self._json(403, {'erro': 'arquivo não permitido'})
                return self._json(200, {'texto': gh('GET', f"/repos/{REPO}/contents/{dados['path']}?ref={BRANCH}", raw=True)})
            if self.path == '/salvar':
                r = salvar(dados.get('arquivos') or [], dados.get('mensagem'), bool(dados.get('publicar')), s['u'])
                print(f"{s['u']}: {'publicou' if r['publicado'] else 'salvou rascunho'} {r['url']}", flush=True)
                return self._json(200, r)
            if self.path == '/rascunhos/publicar':
                pr = rascunho(dados.get('n'))
                juntar(pr['number'], pr['title'], pr['head']['ref'])
                print(f"{s['u']}: publicou rascunho #{pr['number']}", flush=True)
                return self._json(200, {'ok': True})
            if self.path == '/rascunhos/descartar':
                pr = rascunho(dados.get('n'))
                gh('PATCH', f"/repos/{REPO}/pulls/{pr['number']}", {'state': 'closed'})
                try:
                    gh('DELETE', f"/repos/{REPO}/git/refs/heads/{pr['head']['ref']}")
                except ErroGitHub:
                    pass
                return self._json(200, {'ok': True})
        except ValueError as e:
            return self._json(400, {'erro': str(e)})
        except ErroGitHub as e:
            return self._json(502, {'erro': str(e)})
        return self._json(404, {'erro': 'rota desconhecida'})

    def log_message(self, fmt, *args):
        if not self.path.startswith('/health'):
            sys.stderr.write(f'{self._ip()} {self.command} {self.path} {args[1] if len(args) > 1 else ""}\n')


def main():
    faltam = [n for n, v in (('ADMIN_SEGREDO', len(SEGREDO) >= 32), ('ADMIN_USUARIOS', bool(usuarios())), ('GITHUB_TOKEN', bool(TOKEN))) if not v]
    if faltam:
        sys.exit('faltam variáveis de ambiente: ' + ', '.join(faltam) + ' (ADMIN_SEGREDO com 32 caracteres ou mais)')
    invalidos = [u for u, h in usuarios().items() if not _partes(h)]
    print(f'admin-api: {len(usuarios())} usuário(s), repositório {REPO}@{BRANCH}, origem {ORIGIN}, porta {PORT}', flush=True)
    if invalidos:   # aviso no log do Easypanel: o login desses usuários não vai funcionar até a linha ser corrigida
        print('AVISO: senha com formato inválido (linha cortada ou incompleta) para: ' + ', '.join(invalidos) +
              '. Gere de novo com tools/admin_senha.py e cole a linha inteira em ADMIN_USUARIOS.', flush=True)
    ThreadingHTTPServer(('0.0.0.0', PORT), Handler).serve_forever()


if __name__ == '__main__':
    main()
