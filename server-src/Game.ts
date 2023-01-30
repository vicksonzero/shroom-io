import {
    b2Contact, b2ContactImpulse, b2ContactListener,
    b2Fixture,
    b2Manifold, b2World,
    b2ParticleBodyContact, b2ParticleContact, b2ParticleSystem,
    b2Shape, b2Vec2, XY
} from '@flyover/box2d';
import * as Debug from 'debug';
import { IFixtureUserData, IBodyUserData } from '../client-src/PhysicsSystem';
import { Player } from './Player';
import { PHYSICS_FRAME_SIZE, PHYSICS_MAX_FRAME_CATCHUP, SPAWN_PADDING, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { AttackHappenedMessage, DiceDroppedMessage, PlayerState, StateMessage } from '../model/EventsFromServer';
import { PhysicsSystem } from './PhysicsSystem';
import { Clock } from '../model/PhaserClock';
import { DistanceMatrix } from '../utils/DistanceMatrix'
import { names } from '../model/Names'
import { Dice, DiceState, DiceType, RollsStats, Suit, TransferDiceResult } from '../model/Dice';


const verbose = Debug('shroom-io:Game:verbose');
const log = Debug('shroom-io:Game:log');
const spawnLog = Debug('shroom-io:Game.spawn:log');
const fightLog = Debug('shroom-io:Game.fight:log');
const aiLog = Debug('shroom-io:Game.ai:log');
const inventoryLog = Debug('shroom-io:Game.inventory:log');

export class Game {
    public players: Player[] = [];
    sfx_point: any;

    frameSize = PHYSICS_FRAME_SIZE; // ms
    lastUpdate = -1;
    fixedTime: Clock;
    fixedElapsedTime: number;

    physicsSystem: PhysicsSystem = new PhysicsSystem();
    distanceMatrix: DistanceMatrix = new DistanceMatrix();

    emitSocketEvent = (socketId: string, event: string, data: any) => { };
    emitToAll = (event: string, data: any) => { };


    constructor() {
        this.fixedTime = new Clock();
        this.fixedElapsedTime = 0;
        this.distanceMatrix.getTransformList = () => this.getTransformList();
    }

    init() {
        this.setUpPhysics();
        for (let i = 0; i < 50; i++) {
            const player = this.spawnNpc();
        }
    }

    getPlayerById(socketId: string) {
        return this.players.find(p => p.socketId === socketId);
    }

    isPlayerExists(socketId: string) {
        return this.getPlayerById(socketId) != null;
    }

    spawnNpc() {
        const npc = Player.create(names[~~(Math.random() * names.length)]);
        if (npc) this.players.push(npc);
        npc.createPhysics(this.physicsSystem, () => { });

        this.randomizePlayerPosition(npc);

        const displacement = new b2Vec2(
            WORLD_WIDTH / 2 - npc.x,
            WORLD_HEIGHT / 2 - npc.y
        );
        let tier = 0;
        if (displacement.Length() < 200) tier = 2;
        else if (displacement.Length() < 500) tier = 1;

        npc.diceList = [
            Dice.getRandomDice(tier)!,
            Dice.getRandomDice(tier)!,
            Dice.getRandomDice(tier)!,
        ];
        if (tier == 1) npc.diceList.push(Dice.getRandomDice(0)!);
        if (tier == 2) npc.diceList.push(Dice.getRandomDice(1)!);


        spawnLog('getRandomDice', npc.diceList.map(d => d.symbol).join(''));


        return npc;
    }
    reuseNpc(npc: Player) {
        spawnLog('reuseNpc', npc.entityId);

        this.randomizePlayerPosition(npc);

        const displacement = new b2Vec2(
            WORLD_WIDTH / 2 - npc.x,
            WORLD_HEIGHT / 2 - npc.y
        );
        let tier = 0;
        if (displacement.Length() < 600) tier = 2;
        else if (displacement.Length() < 1200) tier = 1;

        npc.diceList = [
            Dice.getRandomDice(tier)!,
            Dice.getRandomDice(tier)!,
            Dice.getRandomDice(tier)!,
        ];
        spawnLog('getRandomDice', npc.diceList.map(d => d.symbol).join(''));

        npc.deleteAfterTick = undefined;
    }


    randomizePlayerPosition(player: Player) {
        const padding = SPAWN_PADDING + player.r;
        const x = Math.random() * (WORLD_WIDTH - padding * 2) + padding;
        const y = Math.random() * (WORLD_HEIGHT - padding * 2) + padding;

        spawnLog(`randomizePlayerPosition(player=${player.entityId}, ${player.socketId || 'ai'})`);

        player.x = x;
        player.y = y;
    }

    onPlayerConnected(name: string, playerId: string) {
        const existingPlayer = this.getPlayerById(playerId);
        if (existingPlayer != null) {
            return existingPlayer;
        }

        const player = Player.create(name, 0, playerId);
        player.isHuman = true;
        this.players.push(player);
        player.createPhysics(this.physicsSystem, () => {
        });
        this.randomizePlayerPosition(player);
        this.distanceMatrix.insertTransform(player);

        spawnLog(`Created player ${player.entityId}`);
        spawnLog('getRandomDice', player.diceList.map(d => d.symbol).join(''));
        return player;
    }
    onPlayerDisconnected(playerId: string) {
        // TODO: perhaps mark inactive and clean up later?
        const leavingPlayer = this.getPlayerById(playerId);
        if (leavingPlayer == null) {
            console.warn('onPlayerDisconnected: no player found');
            return;
        }

        leavingPlayer.destroyPhysics(this.physicsSystem);
        this.distanceMatrix.removeTransform(leavingPlayer);
        this.players.splice(this.players.indexOf(leavingPlayer), 1);

        spawnLog(`Deleted player ${leavingPlayer.entityId}`);

        this.emitToAll('player-disconnected', { playerId: leavingPlayer.entityId });
        return leavingPlayer;
    }

    getViewForPlayer(playerId: string, isFullState = false): StateMessage | null {
        const existingPlayer = this.getPlayerById(playerId);
        if (existingPlayer == null) {
            // console.warn('getViewForPlayer: no player found');
            return null;
        }

        const state = (this.players
            .filter(player => {
                if (!player.b2Body) return false;
                // if (!isWelcome && player.b2Body.m_linearVelocity.Length() < 0.001) return false;
                // if (player.sync.lastUpdated==0) return false;
                if (!isFullState && this.distanceMatrix.getDistanceBetween(existingPlayer, player) > 300) return false;

                return true;
            })
            .map(player => {

                return {
                    entityId: player.entityId,
                    x: player.x,
                    y: player.y,
                    vx: player.vx,
                    vy: player.vy,
                    angle: player.angle, // in degrees
                    vAngle: player.vAngle,
                    r: player.r, // radius

                    name: player.name,
                    color: player.color,
                    isHuman: player.isHuman,
                    isCtrl: (player.socketId === playerId), // for the player receiving this state pack, is this Player themselves?
                    nextMoveTick: player.nextMoveTick,
                    nextCanShoot: player.nextCanShoot,

                    diceList: player.diceList.map(dice => ({
                        diceName: dice.diceName,
                        diceEnabled: dice.diceEnabled,
                        diceType: DiceType.DICE,
                        diceIsKept: true,
                        sideId: -1,
                    })),
                    buffList: player.buffs,
                } as PlayerState;
            })
        );

        return {
            tick: Date.now(),
            state,
        };
    }

    onPlayerDash(playerId: string, dashVector: XY) {
        const player = this.getPlayerById(playerId);
        if (player == null) {
            console.warn('onPlayerDash: no player found');
            return;
        }

        player.applyDashImpulse(dashVector);
    }

    onPlayerDropDice(playerId: string, slotId: number) {
        const player = this.getPlayerById(playerId);
        if (player == null) {
            console.warn('onPlayerDropDice: no player found');
            return;
        }

        if (player.diceList.length <= 0) {
            console.warn(`dropDice: Player ${player.name} can't drop the last dice!`);
            return;
        }

        if (!player.hasDiceInSlot(slotId)) {
            console.warn(`dropDice: Player ${player.name} doesn't have dice in slot ${slotId}`);
            return;
        }


        const dice = player.removeDice(slotId);
        const {
            roll,
            rollDisplacement,
            addedBuffs,
        } = this.turnDiceIntoBuff(player, dice);

        if (addedBuffs.length > 0) {
            player.nextCanShoot = Date.now() + 2500;
        } else {
            player.nextCanShoot = Date.now() + 1500;
        }

        const message: DiceDroppedMessage = {
            playerId: player.entityId,
            roll,
            rollPosition: {
                x: player.x + rollDisplacement.x,
                y: player.y + rollDisplacement.y,
            },
            addedBuffs,
        };
        this.emitToAll('dice-dropped', message);
    }

    getEntityList() {
        const list = (this.players
            .map(player => player.entityId)
        );

        return list;
    }

    getEntityData(playerId: string) {
        const state = (this.players
            .map(player => {
                return {
                    entityId: player.entityId,
                    x: player.x,
                    y: player.y,
                    vx: player.vx,
                    vy: player.vy,
                    angle: player.angle, // in degrees
                    vAngle: player.vAngle,
                    r: player.r, // radius

                    name: player.name,
                    color: player.color,
                    isHuman: player.isHuman,
                    isCtrl: (player.socketId === playerId), // for the player receiving this state pack, is this Player themselves?
                    nextMoveTick: player.nextMoveTick,

                    diceList: player.diceList.map(dice => ({
                        diceName: dice.diceName,
                        diceEnabled: dice.diceEnabled,
                        sideId: -1,
                    })),
                } as PlayerState;
            })
        );

        return state;
    }

    getBodyData() {
        return this.physicsSystem.getBodyData();
    }

    cheatPlayerDice(playerId: string, diceString: string) {
        const existingPlayer = this.getPlayerById(playerId);
        if (existingPlayer == null) {
            console.warn('onPlayerDisconnected: no player found');
            return;
        }

        existingPlayer.diceList = diceString.split(',').filter(a => a).map((diceName: string) => {
            return Dice.create(diceName[0], diceName);
        });
    }

    update() {
        const time = Date.now();
        // verbose(`update ${time}`);

        const lastGameTime = this.lastUpdate;
        // log(`update (from ${lastGameTime} to ${gameTime})`);

        if (this.lastUpdate === -1) {
            this.lastUpdate = time;

            // seconds
            this.fixedElapsedTime += this.frameSize;
            this.fixedUpdate(this.fixedElapsedTime, this.frameSize);
        } else {
            let i = 0;
            while (this.lastUpdate + this.frameSize < time && i < PHYSICS_MAX_FRAME_CATCHUP) {
                i++;

                this.fixedElapsedTime += this.frameSize;
                this.fixedUpdate(this.fixedElapsedTime, this.frameSize);
                this.lastUpdate += this.frameSize;
            }
            this.lastUpdate = time;

            // verbose(`update: ${i} fixedUpdate-ticks at ${time.toFixed(3)} (from ${lastGameTime.toFixed(3)} to ${this.lastUpdate.toFixed(3)})`);
        }
    }

    fixedUpdate(fixedTime: number, frameSize: number) {
        const timeStep = 1000 / frameSize;
        verbose(`fixedUpdate start`);

        this.fixedTime.preUpdate(fixedTime, frameSize);
        this.physicsSystem.update(
            timeStep,
            // (DEBUG_PHYSICS ? this.physicsDebugLayer : undefined)
        );
        this.distanceMatrix.init();
        this.updatePlayers();

        this.fixedTime.update(fixedTime, frameSize);
        // this.lateUpdate(fixedTime, frameSize);
        // verbose(`fixedUpdate complete`);
    }

    getTransformList = () => ([...this.players]);

    updatePlayers() {
        const updatePlayer = (player: Player) => {
            let xx = 0;
            let yy = 0;

            if (!player.isHuman && player.canShoot() && Date.now() >= player.aiNextTick) {
                type AiMetadata = {
                    player: Player,
                    dist: number,
                    diceCount: number,
                };
                const distanceWithMe: AiMetadata[] = (this.distanceMatrix.getEntitiesClosestTo(player.entityId, 5)
                    // map to player + distance
                    .map(([entityId, dist]) => [
                        this.players.find(p => p.entityId == entityId),
                        dist,
                    ])
                    .filter((arr): arr is [Player, number] => arr[0] != null) // filter undefined
                    .map(([player, dist]) => ({ player, dist }))
                    .map((metadata) => {
                        const { player } = metadata;
                        const diceCount = player.diceList.length;
                        return {
                            ...metadata,
                            diceCount,
                        };
                    })
                );
                distanceWithMe.sort((a, b) => a.diceCount - b.diceCount);

                aiLog('Closest 5 enemies: ', distanceWithMe.map(({ player: p, diceCount, dist }) => `${p.name}(${diceCount}, ${dist.toFixed()})`));
                const target = distanceWithMe[0];

                player.targetId = target.player.entityId;

                const dashVector = {
                    x: target.player.x - player.x,
                    y: target.player.y - player.y
                };

                player.applyDashImpulse(dashVector);

                player.aiNextTick = Date.now() + 1000 + Math.floor(Math.random() * 3000);
            }

        };

        // death of npc
        for (let i = 0; i < this.players.length; /* */) {
            const player = this.players[i];
            if (player.deleteAfterTick != null && Date.now() > player.deleteAfterTick) {
                this.reuseNpc(player);
            } else if (!player.isHuman && (player.x < 0 || player.x > WORLD_WIDTH || player.y < 0 || player.y > WORLD_HEIGHT)) {
                this.reuseNpc(player);
            }
            i++;
        }


        for (const player of this.players) {
            updatePlayer(player);
        }

        // const updatedPlayers = this.players.filter(player => {
        //     return (player.sync.lastUpdated > 0);
        // }).map(player => (
        //     [
        //         player.entityId,
        //         player.x.toFixed(1),
        //         player.y.toFixed(1),
        //     ].join(' ')
        // ));
        // if (updatedPlayers.length > 0) {
        //     console.log(`updatedPlayers: ${updatedPlayers.join('\n')}`);
        // }
    }

    setUpPhysics() {
        this.physicsSystem.init();
        this.physicsSystem.registerBeginContactHandler('player-player',
            this.physicsSystem.byFixtureLabel,
            'player', 'player',
            (playerFixtureA: b2Fixture, playerFixtureB: b2Fixture, contact) => {
                if (!contact.IsTouching()) return;

                const playerA: Player = this.physicsSystem.getGameObjectFromFixture(playerFixtureA) as Player;
                const playerB: Player = this.physicsSystem.getGameObjectFromFixture(playerFixtureB) as Player;

            },
        );
        this.physicsSystem.registerBeginContactHandler('bullet-player',
            this.physicsSystem.byFixtureLabel,
            'bullet', 'player',
            (fixtureA: b2Fixture, playerFixtureB: b2Fixture, contact) => {
                if (!contact.IsTouching()) return;

                const bullet: Player = this.physicsSystem.getGameObjectFromFixture(fixtureA) as Player;
                const playerB: Player = this.physicsSystem.getGameObjectFromFixture(playerFixtureB) as Player;

                // const a = contact.GetManifold();
                // a.localNormal
                // TODO: do something
            },
        );
    }



}

