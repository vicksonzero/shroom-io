date=$(date +%Y%m%d)

7z a client-dist.zip assets index.html ./client-dist/bundle.js

cp client-dist.zip ../builds/client-dist.$date.zip