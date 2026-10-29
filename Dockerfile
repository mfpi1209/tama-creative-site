# Imagem final do site: só Nginx + o site já gerado (dist/ é gerado no GitHub Actions).
FROM nginx:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY deploy/admin-headers.conf /etc/nginx/snippets/admin-headers.conf
COPY dist /usr/share/nginx/html
EXPOSE 80
