# Login com usuário e senha do Inventário (/admin/inventario/). App "admin-api" no Easypanel, mesmo projeto do site,
# do n8n e do cms-auth. Build: GitHub mfpi1209/tama-creative-site, caminho deploy/admin-api, Dockerfile. Sem domínio
# público: o Nginx do site encaminha https://tamacreative.com.br/api/admin/ para este serviço (porta 8080).
# Variáveis de ambiente: ver o início de server.py e docs/INVENTARIO.md.
FROM python:3.12-alpine
RUN adduser -D -H app
WORKDIR /app
COPY server.py .
USER app
ENV PORT=8080 PYTHONUNBUFFERED=1
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["python", "server.py"]
