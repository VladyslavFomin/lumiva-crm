#!/bin/bash
set -e
echo "Building lumiva-site..."
npm run build
echo "Deploying to /var/www/lumiva.agency..."
rsync -a --delete dist/ /var/www/lumiva.agency/
chown -R www-data:www-data /var/www/lumiva.agency
echo "Notifying search engines via IndexNow..."
npm run submit-indexnow || true
echo "Done. Site live at https://lumiva.agency"
