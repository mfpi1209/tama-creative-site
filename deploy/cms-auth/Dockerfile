# Login GitHub do editor do blog (/admin/). App "cms-auth" no Easypanel, mesmo projeto do site e do n8n.
# Build: GitHub mfpi1209/tama-creative-site, caminho deploy/cms-auth, Dockerfile. Sem domínio público:
# o Nginx do site encaminha https://tamacreative.com.br/api/cms-auth/ para este serviço (porta 8080).
FROM python:3.12-alpine
RUN adduser -D -H app
WORKDIR /app
COPY server.py .
USER app
ENV PORT=8080 PYTHONUNBUFFERED=1
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/health || exit 1
CMD ["python", "server.py"]
