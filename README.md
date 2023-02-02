# Shroom-IO
Roll dice to fight in an IO-style online multiplayer game



Play Here: https://vicksonzero.itch.io/shroom-io


How To Play
=====================

- Drag from a **Node** to spread your colony.
- Build a node near a **resource patch** to feed from it.
    (one per player per patch)
- Build ammo mushrooms to convert **minerals** into **spores**.
- Tap a **Node** to choose a mushroom to morph on it.
  - Mushrooms need **spores** to operate.
  - **Mushroom Towers** will attack automatically.
  - Tap a Mushroom Tower to choose an upgrade.
- Tap an enemy node to focus fire.



Local dev
=====================

First time:
```bash
npm i -g typescript@4.7.4

# test with...
tsc --version
# >>Version 4.7.4
npm install
```

Server:
```bash
npm start
```

Client:
```bash
npm run dev
```
When doing local-dev, add this to local storage of "http://localhost:8080":

| key              | value               |
| ---------------- | ------------------- |
| dicksonMd.ws_url | ws://localhost:3000 |


## Code

- `public_src` has the client side
- `src` has the server side


Deploy
=====================

For first time set up [see this](#server-Setup)


## Deploy Client

Run in Bash only
```bash
# create `../build` if not yet done
npm run build && ./compress-build.sh
```

Copy zip file to itch.io


## Deploy Server

Restart pm2 server:
```bash
# git reset --hard # if needed
git pull && tsc && pm2 restart shroom-io
```


## Server Setup

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
   1. `vi /etc/nginx/sites-available/default`
      1. Change server name: `server_name ggj2023.dickson.md;`
      2. In `location / {`,
         1. Add reverse proxy like this: `proxy_pass http://localhost:3000;`
         2. (Optional) redirect base url to the client side:
            `rewrite ^/$ https://vicksonzero.itch.io/shroom-io?from-nginx=true redirect;`
      3. The result will look like this: [Sample nginx file](#sample-nginx-file)
      4. `[ESC]` and then `:x` to save and exit
   2. Restart nginx by:
      1. (as sudo) `systemctl config nginx && systemctl restart nginx`
4. Set up **PM2**:
   1. Turn off existing hello world:
      1. `pm2 delete hello` to delete the `hello` app, or 
      2. `pm2 delete 0` to delete the first app
5. Get Git **Personal access tokens**:
   1. https://github.com/settings/tokens
   2. **No need** to make SSH keys
   3. Do try to use git credentials to store password though.
6. Install typescript cli:
   1. `npm i -g typescript@4.7.4`
7. Install project:
    1.  ```bash
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

### Sample nginx file

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


Housekeeping
---------------------

### PM2

PM2 status:
```bash
pm2 ls
pm2 logs shroom-io
pm2 show shroom-io
```


### Nginx

1. `systemctl restart nginx`, or
2. `systemctl stop nginx`, or
3. `systemctl start nginx`



Multiplayer Architecture
-------------------------------

![image](https://user-images.githubusercontent.com/6271771/213613186-8d656d6f-d266-49d8-acc6-e8aead28ba14.png)



# TODO

- [x] node, edge.
- [x] resource nodes.
- [x] gather minerals.
- [ ] spend materials to build towers.
- [ ] build converters to convert Minerals to Spores.
- [ ] Towers request Spores, distribution limited by clever network traffic.
- [ ] kill a tower or kill a node.
- [ ] make a ranking. the most income wins.
- [ ] resource nodes can run out, and respawn, to control the maximum colony size.
- [ ] perhaps edges should be invisible.

# Credits

- Kenney.nl (again, for hopefully placeholders only this time)!!!
- https://free-game-assets.itch.io/48-free-minerals-pixel-art-icons-pack (Free download, [License](https://craftpix.net/file-licenses/))
- https://iconduck.com/icons/19815/binoculars (Unlicensed)
