# Site TaMa Creative: gera o site estático (build.py) e serve com Nginx.
# Usado pelo Easypanel (app "site", origem: GitHub mfpi1209/tama-creative-site, build por Dockerfile).
FROM python:3.12-slim AS build
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# variáveis públicas (SITE_URL, WHATSAPP, EMAIL, INSTAGRAM, GA4_ID, FORM_ENDPOINT...) podem vir do Easypanel como build args
ARG SITE_URL
ARG FORM_ENDPOINT
ENV SITE_URL=${SITE_URL} FORM_ENDPOINT=${FORM_ENDPOINT}
RUN python build.py

FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/common-headers.conf deploy/security-headers.conf /etc/nginx/snippets/
COPY --from=build /app/dist /usr/share/nginx/html
# cabeçalhos de /admin/ gerados pelo build (blog.py); arquivos só do Netlify não ficam públicos
RUN mv /usr/share/nginx/html/_nginx/admin-headers.conf /etc/nginx/snippets/ \
 && rm -rf /usr/share/nginx/html/_nginx /usr/share/nginx/html/_headers /usr/share/nginx/html/_redirects \
 && nginx -t
EXPOSE 80
