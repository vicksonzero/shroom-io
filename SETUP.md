# Setup the project fir the first time

This is our Server stack:

- Cloudflare
- Digitalocean
- nginx
- PM2
- NodeJS
- Socket-IO



# Server Setup

We use Digitalocean nodejs image.
This image has PM2 installed.
We need to turn off PM2 hello world app
and then modify nginx to self-reverse-proxy to `http://localhost:3000`,
and then turn on PM2 for this project instead.

Please use the `nodejs` account instead of `root` for security measures.

We also use cloudflare to reverse-proxy the websocket traffic.

1. Create a **Digitalocean droplet** with nodejs image. 
   1. Don't use the too-cheap CPU coz it doesn't even run `tsc` properly.
2. **SSH** into the droplet
3. Set up **nginx**:
   1. ```
      vi /etc/nginx/sites-available/default
      ```
      1. Change server name: `server_name ggj2023.dickson.md;`
      2. In `location / {`,
         1. Add reverse proxy like this: `proxy_pass http://localhost:3000;`
         2. (Optional) redirect base url to the client side:
            `rewrite ^/$ https://vicksonzero.itch.io/shroom-io?from-nginx=true redirect;`
      3. The result will look like this: [Sample nginx file](#sample-nginx-file)
      4. `[ESC]` and then `:x` to save and exit
   2. Restart nginx by:
      1. (as sudo) 
         ```
         systemctl config nginx && systemctl restart nginx
         ```
4. Set up **PM2**:
   1. Turn off existing hello world (Choose one):
      1. `pm2 delete hello` to delete the `hello` app, or 
      2. `pm2 delete 0` to delete the first app
5. Get Git **Personal access tokens**:
   1. https://github.com/settings/tokens
   2. **No need** to make SSH keys
   3. Save git credentials for later:
       ```
       git config --global credential.helper store
       ```
6. Install typescript cli:
   ```
   npm i -g typescript@4.7.4
   ```
7. Install project:
    ```bash
    cd /home/nodejs
    git clone https://github.com/vicksonzero/shroom-io.git
    # When git needs your login,
    #  - Fill in your github username,
    #  - Fill in **Personal access tokens** instead of password
    cd shroom-io
    echo "USE_SSL=false" > .env
    npm i
    ```
8.  Build and Run PM2 for the first time
    ```bash
    tsc && pm2 start /root/shroom-io/server-dist/server-src/index.js --name shroom-io
    ```



# Sample nginx file

```
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    root /var/www/html;

    # Add index.php to the list if you are using PHP
    index index.html index.htm index.nginx-debian.html;

    server_name ggj2023.dickson.md;

    location ^~ /assets/ {
        gzip_static on;
        expires 12h;
        add_header Cache-Control public;
    }

    location / {
        rewrite ^/$ https://vicksonzero.itch.io/shroom-io?from-nginx=true redirect;
        proxy_http_version 1.1;
        proxy_cache_bypass $http_upgrade;

        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_pass http://localhost:3000;
    }
}
```