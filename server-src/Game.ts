import {
    b2Contact, b2ContactImpulse, b2ContactListener,
    b2Fixture,
    b2Manifold, b2World,
    // b2ParticleBodyContact, b2ParticleContact, b2ParticleSystem,
    b2Shape, b2Vec2, XY
} from '@flyover/box2d';
import * as Debug from 'debug';
import { IFixtureUserData, IBodyUserData } from '../client-src/PhysicsSystem';
import { Player } from './Player';
import { PHYSICS_FRAME_SIZE, PHYSICS_MAX_FRAME_CATCHUP, SPAWN_PADDING, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { EVT_PLAYER_DISCONNECTED, PlayerState, StateMessage } from '../model/EventsFromServer';
import { PhysicsSystem } from './PhysicsSystem';
import { Clock } from '../model/PhaserClock';
import { DistanceMatrix } from '../utils/DistanceMatrix'
import { names } from '../model/Names'


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
        for (let i = 0; i < 10; i++) {
            const player = this.spawnNpc();
        }
    }

    getPlayerById(socketId: string) {
        return this.players.find(p => p.socketId === socketId);
    }

    isPlayerExists(socketId: string) {
        return this.getPlayerById(socketId) != null;
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

        this.emitToAll(EVT_PLAYER_DISCONNECTED, { playerId: leavingPlayer.entityId });
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
                if (!isFullState && this.distanceMatrix.getDistanceBetween(existingPlayer, player) > 300) return false;
                return true;
            })
            .map(player => {
                return {
                    entityId: player.entityId,
                    x: player.x,
                    y: player.y,
                    r: player.r, // radius

                    name: player.name,
                    color: player.color,
                    isHuman: player.isHuman,
                    isCtrl: (player.socketId === playerId), // for the player receiving this state pack, is this Player themselves?
                    nextMoveTick: player.nextMoveTick,
                    nextCanShoot: player.nextCanShoot,
                } as PlayerState;
            })
        );

        return {
            tick: Date.now(),
            state,
        };
    }

    onPlayerDash(playerId: string, dashVector: XY) {
    }

    onPlayerDropDice(playerId: string, slotId: number) {
    }

    getEntityList() {
        const list = (this.players
            .map(player => player.entityId)
        );

        return list;
    }

    getEntityData(playerId: string) {
        const state = {};
        return state;
    }

    getBodyData() {
        return this.physicsSystem.getBodyData();
    }

    cheatPlayerDice() {
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

    spawnNpc() {
        log('spawnNpc');

        const npc = Player.create(names[~~(Math.random() * names.length)]);
        if (npc) this.players.push(npc);
        npc.createPhysics(this.physicsSystem, () => { });
        this.randomizePlayerPosition(npc);

        return npc;

    }

    updatePlayers() {
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

