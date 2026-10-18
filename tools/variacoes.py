"""Gera variações de cor de uma foto do banco com a API de imagens da OpenAI (edição a partir da foto-base).

A chave vem da variável OPENAI_API_KEY ou de ~/.config/tama/openai.env (nunca de arquivo versionado). Cada chamada custa dinheiro:
confira o preço do modelo antes de rodar um lote. As imagens saem em 1024 px e entram no banco como ilustrativas,
geradas com IA; use tools/produtos.py importar depois.

Uso:
  OPENAI_API_KEY=... python -I tools/variacoes.py <id-base> <cor> <hex> [<cor> <hex> ...] [--saida pasta] [--modelo gpt-image-1.5] [--qualidade medium]
  ex.: python -I tools/variacoes.py caneca~branco "Azul royal" "#1F4FB8" Preto "#1E1E1E"
  python -I tools/variacoes.py novo <id-novo> "<descrição do produto em inglês>" [--estilo caneca~branco]
      produto novo no mesmo padrão (fundo claro, luz suave, uma peça), só com a marca TaMa; a foto de estilo é
      referência de enquadramento e luz, não de produto. Nunca passe fotos de terceiros como referência.
Saída: <pasta>/<id>.png (pasta padrão: midia/produtos/geradas/).
"""
import argparse, json, os, sys, time, unicodedata, urllib.request, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MESTRE = os.path.join(ROOT, 'midia', 'produtos', 'mestre')
PROMPT = ('Edit this product photo. Keep exactly the same product, shape, angle, framing, soft studio lighting and the warm off-white '
          'background. Change ONLY the color of the product body to {cor} ({hex}). Keep the "TaMa Creative" logo (leaf symbol + wordmark) '
          'in the same place and size; if the logo would not read on the new color, render it in white or a contrasting tone. '
          'No text, no extra objects, no watermark. Photorealistic, catalog quality.')


def slug(s):
    s = unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()
    return '-'.join(''.join(c if c.isalnum() else ' ' for c in s).split())


def edit(key, modelo, qualidade, base_png, prompt, fidelidade='high', extras=(), tamanho='1024x1024'):
    boundary = uuid.uuid4().hex
    fields = {'model': modelo, 'prompt': prompt, 'size': tamanho, 'quality': qualidade, 'n': '1'}
    if modelo.startswith('gpt-image'):
        fields['input_fidelity'] = fidelidade
    body = b''
    for k, v in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    body += (f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="base.png"\r\nContent-Type: image/png\r\n\r\n').encode()
    body += open(base_png, 'rb').read() + b'\r\n'
    for i, extra in enumerate(extras):   # imagens adicionais (ex.: o logo oficial) vão em image[]
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="image[]"; filename="extra{i}.png"\r\nContent-Type: image/png\r\n\r\n').encode() + open(extra, 'rb').read() + b'\r\n'
    body += f'--{boundary}--\r\n'.encode()
    req = urllib.request.Request('https://api.openai.com/v1/images/edits', data=body, method='POST',
                                 headers={'Authorization': f'Bearer {key}', 'Content-Type': f'multipart/form-data; boundary={boundary}'})
    with urllib.request.urlopen(req, timeout=300) as r:
        out = json.load(r)
    d = out['data'][0]
    if 'b64_json' in d:
        import base64
        return base64.b64decode(d['b64_json']), out.get('usage')
    with urllib.request.urlopen(d['url'], timeout=120) as r:
        return r.read(), out.get('usage')


def chave_do_arquivo():
    """Lê OPENAI_API_KEY de ~/.config/tama/openai.env ou <repo>/.openai.env (ambos fora do Git)."""
    for f in (os.path.expanduser('~/.config/tama/openai.env'), os.path.join(ROOT, '.openai.env')):
        if os.path.exists(f):
            for line in open(f, encoding='utf-8'):
                if line.startswith('OPENAI_API_KEY='):
                    return line.split('=', 1)[1].strip().strip('"\'')
    return None


NOVO = ('The first image is a style reference only: the ENTIRE background of the new photo must be the same flat, uniform, warm '
        'off-white (#F6F2EC) from edge to edge, exactly like the first image: no gradient, no dark area, no glow, no vignette, no halo. '
        'Same soft diffuse studio lighting, camera height and product scale, product centered with a soft contact shadow.{sem_estilo} The second image is the exact official logo: reproduce it faithfully, letter by letter ("TaMa" '
        'in serif, "CREATIVE" in small spaced capitals, leaf symbol at the left). Create a NEW catalog photo of: {desc}. Apply the logo '
        '{aplicacao}. No other brands or logos, no other text, no people, no props, no watermark. Photorealistic catalog quality.')


def novo(a):
    key = os.environ.get('OPENAI_API_KEY') or chave_do_arquivo()
    if not key:
        sys.exit('defina OPENAI_API_KEY no ambiente ou grave OPENAI_API_KEY=... em ~/.config/tama/openai.env')
    estilo = next((os.path.join(MESTRE, f) for f in os.listdir(MESTRE) if f.rsplit('.', 1)[0] == a.estilo), None)
    if not estilo:
        sys.exit(f'foto de estilo não encontrada: {a.estilo}')
    os.makedirs(a.saida, exist_ok=True)
    dest = os.path.join(a.saida, a.id + '.png')
    if os.path.exists(dest):
        print('já existe:', os.path.relpath(dest, ROOT)); return
    t = time.time()
    try:
        png, usage = edit(key, a.modelo, a.qualidade, estilo, NOVO.format(desc=a.descricao, aplicacao=a.aplicacao, sem_estilo=' Do not show the mug.' if a.estilo.startswith('caneca') else ''), fidelidade='high', extras=[a.logo], tamanho=a.tamanho)
    except urllib.error.HTTPError as e:
        sys.exit(f'{a.id}: HTTP {e.code} {e.read()[:400].decode(errors="replace")}')
    open(dest, 'wb').write(png)
    print(f'{os.path.relpath(dest, ROOT)}  {len(png) // 1024} KB  {time.time() - t:.0f}s  {json.dumps(usage) if usage else ""}')


def main():
    if len(sys.argv) > 1 and sys.argv[1] == 'novo':
        ap = argparse.ArgumentParser(prog='variacoes.py novo')
        ap.add_argument('cmd'); ap.add_argument('id'); ap.add_argument('descricao')
        ap.add_argument('--estilo', default='caneca~branco'); ap.add_argument('--logo', required=True, help='PNG do logo oficial em fundo claro'); ap.add_argument('--tamanho', default='1024x1024'); ap.add_argument('--aplicacao', default='printed small on the front of the product, in a contrasting single color')
        ap.add_argument('--saida', default=os.path.join(ROOT, 'midia', 'produtos', 'geradas'))
        ap.add_argument('--modelo', default='gpt-image-1.5'); ap.add_argument('--qualidade', default='medium')
        return novo(ap.parse_args())
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('base'); ap.add_argument('cores', nargs='+', help='pares: nome hex')
    ap.add_argument('--saida', default=os.path.join(ROOT, 'midia', 'produtos', 'geradas'))
    ap.add_argument('--modelo', default='gpt-image-1.5'); ap.add_argument('--qualidade', default='medium')
    a = ap.parse_args()
    key = os.environ.get('OPENAI_API_KEY') or chave_do_arquivo()
    if not key:
        sys.exit('defina OPENAI_API_KEY no ambiente ou grave OPENAI_API_KEY=... em ~/.config/tama/openai.env (fora do repositório)')
    if len(a.cores) % 2:
        sys.exit('cores vêm em pares: nome hex')
    base = next((os.path.join(MESTRE, f) for f in os.listdir(MESTRE) if f.rsplit('.', 1)[0] == a.base), None)
    if not base:
        sys.exit(f'foto-base não encontrada em midia/produtos/mestre/: {a.base}')
    produto = a.base.split('~')[0]
    os.makedirs(a.saida, exist_ok=True)
    for nome, hexv in zip(a.cores[::2], a.cores[1::2]):
        dest = os.path.join(a.saida, f'{produto}~{slug(nome)}.png')
        if os.path.exists(dest):
            print('já existe:', os.path.relpath(dest, ROOT)); continue
        t = time.time()
        try:
            png, usage = edit(key, a.modelo, a.qualidade, base, PROMPT.format(cor=nome, hex=hexv))
        except urllib.error.HTTPError as e:
            sys.exit(f'{nome}: HTTP {e.code} {e.read()[:400].decode(errors="replace")}')
        open(dest, 'wb').write(png)
        print(f'{os.path.relpath(dest, ROOT)}  {len(png) // 1024} KB  {time.time() - t:.0f}s  {json.dumps(usage) if usage else ""}')


if __name__ == '__main__':
    main()
