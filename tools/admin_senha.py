"""Gera a linha de um usuário do Inventário (/admin/inventario/) para a variável ADMIN_USUARIOS do app admin-api.

A senha é digitada aqui (não aparece na tela nem fica gravada); sai só o hash (PBKDF2-SHA256, 310 mil iterações),
sem o caractere "$", para colar no Easypanel sem que ele seja lido como variável.
Cole a linha em ADMIN_USUARIOS no Easypanel; vários usuários ficam separados por ";". Para trocar uma senha, gere de
novo e substitua a linha; para tirar o acesso de alguém, apague a linha dele (a sessão aberta cai na hora).

Uso:
  python3 tools/admin_senha.py <usuario>     linha "usuario:hash" para ADMIN_USUARIOS
  python3 tools/admin_senha.py --segredo     valor aleatório para ADMIN_SEGREDO
"""
import base64, getpass, hashlib, os, re, secrets, sys

ITERACOES = 310000


def gerar(senha):
    """Hash sem "$" (o Easypanel pode interpretar "$" como variável): pbkdf2-sha256.<iterações>.<sal>.<hash>, base64url."""
    b = lambda x: base64.urlsafe_b64encode(x).decode().rstrip('=')
    sal = os.urandom(16)
    h = hashlib.pbkdf2_hmac('sha256', senha.encode(), sal, ITERACOES)
    return f'pbkdf2-sha256.{ITERACOES}.{b(sal)}.{b(h)}'


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    if sys.argv[1] == '--segredo':
        print(secrets.token_urlsafe(48))
        return
    usuario = sys.argv[1].strip().lower()
    if not re.fullmatch(r'[a-z0-9._-]{3,40}', usuario):
        sys.exit('usuário: 3 a 40 caracteres, só letras minúsculas, números, ponto, hífen e sublinhado')
    senha = getpass.getpass('Senha (mínimo 10 caracteres): ')
    if len(senha) < 10:
        sys.exit('senha curta: use pelo menos 10 caracteres')
    if getpass.getpass('Repita a senha: ') != senha:
        sys.exit('as senhas não conferem')
    print(f'{usuario}:{gerar(senha)}')


if __name__ == '__main__':
    main()
