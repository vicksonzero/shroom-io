# Shroom-IO
Roll dice to fight in an IO-style online multiplayer game



Play Here: https://vicksonzero.itch.io/shroom-io


How To Play
=====================

- Tap the screen to move, bump into players to fight
- (Long-press to shoot dice)
- Drag dice from inventory to drop it and get temporary buffs

Dice enter cooldown when used for fighting





Code
=====================


- `public_src` has the client side
- `src` has the server side

Local dev
---------------------

### Server
```bash
npm start
```

### Client
```bash
npm run dev
```
When doing local-dev, add this to local storage of "http://localhost:8080":

| key               | value               |
| ----------------- | ------------------- |
| md.dickson.ws_url | ws://localhost:3000 |



Deploy
---------------------

### Client

```bash
npm run build && ./compress-build.sh
```

Copy zip file to itch.io

### Server

install
```bash
git clone https://github.com/vicksonzero/shroom-io.git
cd shroom-io
echo "USE_SSL=true" > .env
npm i
npm i -g typescript
npm start
```

pm2 start
```bash
pm2 ls
pm2 start /root/shroom-io/server-dist/server-src/index.js --name shroom-io
pm2 logs shroom-io
pm2 show shroom-io
```

Restart pm2 server:
```bash
# git reset --hard # if needed
git pull && tsc && pm2 restart shroom-io
```


Multiplayer Architecture
-------------------------------

![image](https://user-images.githubusercontent.com/6271771/213613186-8d656d6f-d266-49d8-acc6-e8aead28ba14.png)



Play style discussions
=====================

Fight sequence
---------------------

1. Players Collide
2. Both players back off and locked for the duel. A virtual circle appears.
3. Max dice **M** is determined by the player with less dice slots. **M** is at most 10.
4. In 3 seconds, both players choose and throw at most **M** dice
   1. If not chosen, random dice are chosen
   2. Those dice enter cooldown and cannot be used for a while.
5. The damage is assessed and applied:
   1. The player with more **speed symbol** is going to attack first
      1. If the number of speed symbols are the same, then both damages are assessed at the same time
   2. Damage calculations:
      1. Raw damage: A is going to take damage of (B.Sword + B.Buff.Sword - A.Shield - A.Buff.Shield)
      2. Bleed: if A takes damage at all, A will also take bleed damage if A has Bleed Debuff
   3. When taking damage:
      1. If the player has 1 dice left, 
      2. if all dice are in cooldown, a random die from all dice is destroyed.
      3. a non-cooldown (?) die will be destroyed.
      4. When a dice is destroyed, the opponent gains XP for upgrades
6. All buffs are then cleared.
7. Add buffs according to rolled dice:
   1. **Books** add temp Sword Buffs to self
   2. **Venom** add Venom Debuff to opponent
   3. If you have more **Morale** than opponent, add x temp Shield buff to self, where x = Morale difference
8.  If all dice are in cooldown, reset their cooldown
9.  The winning player has 1~2s of immobility, able to be challenged but cannot move


Shooting Dice
---------------------

1. Long-press a direction to throw a ball of 3 dice
2. Whether it hits a player or not, it goes back to player and start cooldown.
3. If you roll a shield, you gain 1 temp shield to defend the next incoming attack.
4. If sword hits opponent, they will take damage like above
5. Books will no longer give temp swords, but will prevent some buffs from expiring.
6. Only players with an archery dice can shoot dice.


Upgrading
---------------------

1. When players stand close to pop-up stores, they can buy stuff by spending xp.
   1. Eg: add slots up to 10
   2. Buy temp sword and shield
   3. Sell dice for xp


Crown
---------------------

1. If player rolls a crown, player will wear the crown for unlimited time.
2. Scoreboard tracks the number of crowns held by the players


Drop dice for temp buffs
---------------------

1. Players can only have 8 dice at max.
2. Players can destroy the dice in return for a temporary boost in power.
3. The dice is thrown as usual, but all the rolls will give 2x temporary dice faces.
4. After the temp rolls are received, the dice will be destroyed.


Rewards
-----

1. Perhaps instead of getting the whole dice, each time you deal damage to an opponent, you level up the dice.
2. You start with 3 full dice, and then for the first win, you gain 1 side of the dice only.
3. When you buff yourself, the cost reduces from a whole dice to just 1 side.


Forts
------

What if the main gameplay is to capture castles?

You level up by fighting npcs, respawn in the closest fort.

When you fight you get xp with every dice you destroy.

When you level up, you get slots for capturing a dice.

You sacrifice dice at the fort to level it up.

Forts holds mostly green dice, plus dice sacrificed from players.




# TODO

- Fighting
   - [x] Change dice fight details
   - [ ] Add shooting dice
   - [ ] Hurting opponents gain chips instead of dice
   - [ ] Last hit to gain a random dice
   - [x] Add temp_dice
   - [ ] Add enemy AI
- Inventory
   - [ ] Add slots
   - [x] inventory management !!
   - [ ] Add eating items
   - [ ] Add pop-up stores
   - [ ] Loot boxes
     - [ ] Buy loaded dice
     - [ ] Buy dice with stronger faces
- Server
   - [x] Don't lerp client player pos if too far
   - [x] Spawn Player with (x, y) in client
   - [ ] Don't spawn Player in a crowded place 
   - [ ] Refactor fight into rule-based modules, also refactor client side presentations by rules
   - [ ] Dice code is too spaghetti
- UI
   - [ ] Add scoreboard
   - [x] Add buff icons
   - [x] ping value
   - [ ] Server `/say` messages
   - [ ] Phaser RenderTexture
   - [x] Turn off ui for far away players
     - just turned off rotating dice and buff containers


