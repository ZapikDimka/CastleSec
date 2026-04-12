#!/bin/sh
envsubst '${API_URL}' < /usr/share/nginx/html/js/app.js.template > /usr/share/nginx/html/js/app.js
exec nginx -g 'daemon off;'
