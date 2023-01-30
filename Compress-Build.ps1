New-Item -ItemType Directory -Force -Path "../builds/"

$compress = @{
  Path = "assets", "index.html", "client-dist/bundle.js"
  CompressionLevel = "Fastest"
  DestinationPath = "../builds/client-dist.$(get-date -f yyyyMMdd).zip"
}
Compress-Archive @compress
