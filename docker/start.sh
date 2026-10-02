#!/bin/sh
set -eu
if [ -z "${APP_KEY:-}" ]; then
  echo "APP_KEY must be set to a persistent Laravel application key." >&2
  exit 1
fi
case "${PORT:-10000}" in *[!0-9]*|'') echo "PORT must be numeric." >&2; exit 1 ;; esac
sed -i "s/Listen 80/Listen ${PORT:-10000}/" /etc/apache2/ports.conf
sed -i "s/:10000>/:${PORT:-10000}>/" /etc/apache2/sites-available/000-default.conf
php artisan config:cache
php artisan route:cache
php artisan view:cache
chown -R www-data:www-data storage bootstrap/cache
# Recurring maintenance (event expiry, Google matching, source refresh, daily picks).
# Runs as the web user so cache files stay writable by Apache. Disable with RUN_SCHEDULER=false
# when another process or the external trigger at POST /api/internal/tasks handles it.
if [ "${RUN_SCHEDULER:-true}" != "false" ]; then
  (while true; do runuser -u www-data -- php artisan tasks:run-due --no-ansi || true; sleep 60; done) &
fi
exec apache2-foreground
