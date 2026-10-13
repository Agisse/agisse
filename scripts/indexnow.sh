#!/bin/sh
# Tell Bing/Yandex (IndexNow) about every public URL. Run after a deploy that changes public pages.
# The key file public/d45c560c8a12272651ed2f47ad2c60fe.txt proves we own the host.
set -e
URLS=$(curl -s https://agisse.xyz/sitemap.xml https://agisse.xyz/docs/sitemap.xml | grep -o '<loc>[^<]*' | sed 's/<loc>//; s/.*/"&"/' | paste -sd, -)
curl -s -o /dev/null -w 'IndexNow %{http_code}\n' -X POST https://api.indexnow.org/indexnow -H 'content-type: application/json; charset=utf-8' \
  -d "{\"host\":\"agisse.xyz\",\"key\":\"d45c560c8a12272651ed2f47ad2c60fe\",\"keyLocation\":\"https://agisse.xyz/d45c560c8a12272651ed2f47ad2c60fe.txt\",\"urlList\":[$URLS]}"
