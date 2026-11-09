"""Gera src/fonts/sora-contorno-800.woff2: Sora 800 só com maiúsculas (A–Z, Ç, Ã, É, Ê, Í, Ó, Õ, Ú) e pontuação, com os
contornos sobrepostos removidos. Usada nas palavras grandes da abertura, que aparecem só em contorno
(-webkit-text-stroke): na fonte variável os traços internos das letras ficariam visíveis.

Uso:  pip install fonttools brotli skia-pathops   (só para esta ferramenta)
      python tools/fonte_contorno.py
"""
import os

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import OverlapMode, instantiateVariableFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'src', 'fonts', 'sora-latin.woff2')
OUT = os.path.join(ROOT, 'src', 'fonts', 'sora-contorno-800.woff2')

f = instantiateVariableFont(TTFont(SRC), {'wght': 800}, overlap=OverlapMode.REMOVE)
opts = subset.Options()
opts.flavor = 'woff2'
opts.layout_features = ['kern']
opts.name_IDs = ['*']
sub = subset.Subsetter(opts)
sub.populate(text='ABCDEFGHIJKLMNOPQRSTUVWXYZÇÃÉÊÍÓÕÚ.,!?- ')
sub.subset(f)
f.flavor = 'woff2'
f.save(OUT)
print(os.path.relpath(OUT, ROOT), os.path.getsize(OUT), 'bytes')
