# Motor de mockups da TaMa

Aplica os SVGs oficiais (ou o logo de um cliente) nas fotos dos produtos, com perspectiva e o efeito do material:
hot stamping (`foil`), baixo-relevo (`deboss`), impressão/silk (`print`), gravação a laser (`laser`) e bordado (`embroidery`).

| Arquivo | Uso |
|---|---|
| `brand.py` | motor: geometria (`rect`, `plane`, `quad`, `cyl`), efeitos, limpeza, recoloração por cor da curadoria |
| `specs*.py` | áreas de aplicação de cada foto, em px da foto de 850 px; os arquivos posteriores sobrescrevem os anteriores |
| `render.py` | mockups com a marca TaMa (`python -I render.py <foto>` / `"<foto>~"` para as cores) |
| `export.py` | leva os renders aprovados para `midia/mockups/` |
| `simulador_export.py` | fotos-base sem marca + áreas para o simulador do site (ver `docs/SIMULADOR.md`) |
| `upscale.py` | Real-ESRGAN x4 (gera `midia/mockups/x4/`, fora do Git) |
| `brands/` | marcas fictícias usadas em exemplos (Casa Mirelo, Ondora) |

O navegador usa uma cópia dos efeitos em `src/simulador.js`. Se mudar um efeito aqui, ajuste lá também.
Dependências além do build do site: `numpy` e `scipy`; `torch` só para o `upscale.py`.
