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
import { Node } from './Node';
import { Resource } from './Resource';
import { PHYSICS_FRAME_SIZE, PHYSICS_MAX_FRAME_CATCHUP, SPAWN_PADDING, WORLD_HEIGHT, WORLD_WIDTH } from './constants';
import { EVT_PLAYER_DISCONNECTED, StateMessage } from '../model/EventsFromServer';
import { PhysicsSystem } from './PhysicsSystem';
import { Clock } from '../model/PhaserClock';
import { DistanceMatrix } from '../utils/DistanceMatrix'
import { names } from '../model/Names'
import { IPlayerState } from '../model/Player';
import { INodeState } from '../model/Node';
import { IResourceState } from '../model/Resource';
import { IPacketState } from '../model/Packet';
import { getUniqueID } from '../model/UniqueID';
import { threeDp } from '../utils/utils';


const verbose = Debug('shroom-io:Game:verbose');
const log = Debug('shroom-io:Game:log');
const spawnLog = Debug('shroom-io:Game.spawn:log');
const materialsLog = Debug('shroom-io:Game.materials:log');
const aiLog = Debug('shroom-io:Game.ai:log');
const inventoryLog = Debug('shroom-io:Game.inventory:log');

export class Game {
    public players: Player[] = [];
    public nodes: Node[] = [];
    public resources: Resource[] = [];
    public packets: IPacketState[] = [];
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
        for (let i = 0; i < 20; i++) {
            this.spawnResource();
        }
        for (let i = 0; i < 10; i++) {
            const player = this.spawnNpc();
        }

    }

    getPlayerById(socketId: string) {
        return this.players.find(p => p.socketId === socketId);
    }

    getNodesByPlayerId(playerEntityId: number) {
        return this.nodes.filter(n => n.playerEntityId === playerEntityId);
    }

    isPlayerExists(socketId: string) {
        return this.getPlayerById(socketId) != null;
    }

    getRandomPosition(minXY: XY, maxXY: XY, clearRadius: number, avoidObjectList: { x: number, y: number, r: number }[]): XY {
        const result = { x: 0, y: 0 };

        for (let i = 0; i < 100; i++) {
            result.x = Math.random() * (maxXY.x - minXY.x) + minXY.x;
            result.y = Math.random() * (maxXY.y - minXY.y) + minXY.y;

            // TODO: use distance matrix and/or box2d world query
            const hasCollision = avoidObjectList.some(({ x, y, r }) => {
                const dx = result.x - x;
                const dy = result.y - y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                return distance < (clearRadius + r);
            })

            if (!hasCollision) {
                return result;
            }
        }

        return result;


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

        for (const node of this.getNodesByPlayerId(leavingPlayer.entityId)) {
            node.destroyPhysics(this.physicsSystem);
            this.distanceMatrix.removeTransform(node);
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

        const playerStates = (this.players
            .filter(player => {
                if (!player.b2Body) return false;
                if (!isFullState && this.distanceMatrix.getDistanceBetween(existingPlayer, player) > 300) return false;
                return true;
            })
            .map(player => {
                return {
                    eid: player.entityId,
                    x: threeDp(player.x),
                    y: threeDp(player.y),
                    r: player.r, // radius

                    name: player.name,
                    color: player.color,
                    isHuman: player.isHuman,
                    isCtrl: (player.socketId === playerId), // for the player receiving this state pack, is this Player themselves?
                    nextMoveTick: player.nextMoveTick,
                    nextCanShoot: player.nextCanShoot,
                    mAmt: player.mineralAmount,
                    aAmt: player.ammoAmount,

                    nodes: this.getNodesByPlayerId(player.entityId).map(n => n.toStateObject()),
                } as IPlayerState;
            })
        );

        const resourceStates = this.resources
            .filter(resource => {
                if (!isFullState && this.distanceMatrix.getDistanceBetween(existingPlayer, resource) > 300) return false;
                return true;
            })
            .map(resource => resource.toStateObject());

        return {
            tick: this.fixedElapsedTime,
            playerStates,
            resourceStates,
        };
    }

    onPlayerCreateNode(clientId: string, x: number, y: number, playerEntityId: number, parentNodeId: number) {
        const player = this.getPlayerById(clientId);
        // TODO: do some checkings; reject some commands like too far or no money;
        // TODO: send some return message if not possible
        log('onPlayerCreateNode', x, y);
        this.spawnNode(x, y, playerEntityId, parentNodeId);
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
        this.updatePackets();
        this.updateNodes();
        this.updatePlayers();

        this.fixedTime.update(fixedTime, frameSize);
        // this.lateUpdate(fixedTime, frameSize);
        // verbose(`fixedUpdate complete`);
    }

    getTransformList = () => ([...this.players, ...this.nodes, ...this.resources]);

    spawnNpc() {
        log('spawnNpc');

        const npc = Player.create(names[~~(Math.random() * names.length)]);
        if (npc) this.players.push(npc);
        npc.createPhysics(this.physicsSystem, () => { });
        this.randomizePlayerPosition(npc);

        return npc;

    }
    spawnNode(x: number, y: number, playerEntityId: number, parentNodeId: number) {
        log('spawnNode');

        const node = Node.create(playerEntityId, parentNodeId, this.fixedElapsedTime);
        if (node) this.nodes.push(node);
        node.x = x;
        node.y = y;
        node.createPhysics(this.physicsSystem, () => { });
        this.distanceMatrix.insertTransform(node);

        return node;

    }
    spawnResource() {
        log('spawnResource');

        const padding = SPAWN_PADDING;
        let { x, y } = this.getRandomPosition(
            { x: padding, y: padding },
            { x: WORLD_WIDTH - padding, y: WORLD_HEIGHT - padding },
            400,
            this.resources
        );

        x = threeDp(x);
        y = threeDp(y);

        log(`spawnResource at (${x}, ${y})`);
        const resource = Resource.create(500);
        if (resource) this.resources.push(resource);
        resource.x = x;
        resource.y = y;
        resource.createPhysics(this.physicsSystem, () => { });
        this.distanceMatrix.insertTransform(resource);

        return resource;
    }

    updatePlayers() {

    }

    updateNodes() {
        for (const node of this.nodes) {
            if (node.nextCanShoot > Date.now()) continue;
            node.nextCanShoot = Date.now() + 5000;

            const closestEntities = this.distanceMatrix.getEntitiesClosestTo(node.entityId, 100000, 0, 300);

            materialsLog(`updateNodes(node-${node.entityId}) closestEntities[${closestEntities.length}]`);

            const resourceResult = closestEntities
                .map(([entityId, dist]) => [this.resources.find(r => r.entityId === entityId), dist])
                .find(([e, dist]) => e instanceof Resource);
            if (!resourceResult) continue;

            const [resource, dist] = resourceResult as [Resource, number];
            materialsLog(`resourceResult r-${resource.entityId} dist=${dist}`);
            if (dist > 100) continue;

            const player = this.players.find(p => p.entityId === node.playerEntityId);
            if (!player) continue;

            this.transferMaterials(resource, node, 10, 0, this.fixedElapsedTime, 2000);

        }
    }

    updatePackets() {
        this.packets.sort((a, b) => a.fromFixedTime + a.timeLength - b.fromFixedTime - b.timeLength);

        const packetReceivers = [
            ...this.players,
            ...this.nodes,
        ];

        for (const packet of this.packets) {
            const {
                fromEntityId,
                toEntityId,

                mineralAmount,
                ammoAmount,

                fromFixedTime,
                timeLength,
            } = packet;

            if (fromFixedTime + timeLength > this.fixedElapsedTime) break;

            let toEntity = packetReceivers.find(e => e.entityId === toEntityId);
            if (toEntity == null) continue;

            if (toEntity instanceof Node) {
                const node = toEntity as Node;
                toEntity = this.players.find(p => p.entityId == node.playerEntityId);
            }
            if (toEntity == null) continue;

            toEntity.mineralAmount += mineralAmount;
            toEntity.ammoAmount += ammoAmount;

            materialsLog(`updatePackets(${toEntityId}) min+${mineralAmount}=${toEntity.mineralAmount} ammo+${ammoAmount}=${toEntity.ammoAmount}`);
        }

        this.packets = this.packets.filter(p => (p.fromFixedTime + p.timeLength > this.fixedElapsedTime));
    }

    canTransferMaterials(fromEntity: Player | Node | Resource, toEntity: Player | Node, mineralAmount: number, ammoAmount: number) {
        if (fromEntity.mineralAmount < mineralAmount) return 'Not enough minerals';
        if (fromEntity.ammoAmount < ammoAmount) return 'Not enough ammo';
        return null;
    }

    transferMaterials(fromEntity: Player | Node | Resource, toEntity: Player | Node, mineralAmount: number, ammoAmount: number, fromFixedTime: number, timeLength: number): boolean {
        const entityId = getUniqueID();
        log(`transferMaterials ${entityId}(${fromEntity.entityId} to ${toEntity.entityId}, amount=${mineralAmount}/${ammoAmount})`);

        if (fromEntity.mineralAmount < mineralAmount) return false;
        if (fromEntity.ammoAmount < ammoAmount) return false;

        fromEntity.mineralAmount -= mineralAmount;
        fromEntity.ammoAmount -= ammoAmount;

        this.packets.push({
            entityId,
            fromEntityId: fromEntity.entityId,
            toEntityId: toEntity.entityId,

            mineralAmount,
            ammoAmount,

            fromFixedTime,
            timeLength,
        });
        return true;
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

