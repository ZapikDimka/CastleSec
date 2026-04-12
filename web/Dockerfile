FROM nginx:alpine

COPY web/ /usr/share/nginx/html/
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
RUN sed 's|http://localhost:8000|${API_URL}|g' /usr/share/nginx/html/js/app.js > /usr/share/nginx/html/js/app.js.template

COPY web/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/docker-entrypoint.sh"]
