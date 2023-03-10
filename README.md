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

See [the setup document](SETUP.md).



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
- [x] spend materials to build towers.
- [x] The tower can shoot.
- [x] Nodes can die. 
- [x] Orphan nodes reduce HP until they die
- [ ] Dead nodes become small resource nodes
- [x] Improve network traffic of mining.
- [ ] perhaps edges should be invisible.
- [ ] build converters to convert Minerals to Spores.
- [x] kill a tower or kill a node.
- [ ] make a ranking. the most income wins.
- [x] resource nodes can run out, and respawn, to control the maximum colony size.
- [ ] Towers require Spores, 
- [ ] ~~distribution limited by clever network traffic.~~
- [ ] Include Git revision number on client and server

# Credits

- Kenney.nl (again, for hopefully placeholders only this time)!!!
- https://free-game-assets.itch.io/48-free-minerals-pixel-art-icons-pack (Free download, [License](https://craftpix.net/file-licenses/))
- https://iconduck.com/icons/19815/binoculars (Unlicensed)
- <a href="https://www.flaticon.com/free-icons/trash" title="trash icons">Trash icons created by Becris - Flaticon</a> (Free to use with this notice)
