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
| `upscale.py` | Real-ESRGAN x4 (bases em `../tama-mockups/motor/x4/`, fora do Git; ou `MOCKUP_X4=<pasta>`) |
| `brands/` | marcas fictícias usadas em exemplos (Casa Mirelo, Ondora) |

Esta é a cópia versionada do motor. A pasta de trabalho dos mockups é `../tama-mockups/motor` (fora do Git, com `x4/` e `out/`):
se mudar `brand.py` ou `specs*.py` lá, copie para cá (e vice-versa).
O navegador usa uma cópia dos efeitos em `src/simulador.js`. Se mudar um efeito aqui, ajuste lá também.
Dependências além do build do site: `numpy` e `scipy`; `torch` só para o `upscale.py`.
