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
import {
    PHYSICS_FRAME_SIZE,
    PHYSICS_MAX_FRAME_CATCHUP,
    SPAWN_PADDING,
    WORLD_HEIGHT,
    WORLD_WIDTH
} from './constants';
import {
    ToggleShootingMessage,
    EVT_TOGGLE_SHOOTING,
    EVT_NODE_KILLED,
    EVT_PLAYER_DISCONNECTED,
    NodeKilledMessage,
    StateMessage
} from '../model/EventsFromServer';
import { PhysicsSystem } from './PhysicsSystem';
import { Clock } from '../model/PhaserClock';
import { DistanceMatrix } from '../utils/DistanceMatrix'
import { names } from '../model/Names'
import { IPlayerState } from '../model/Player';
import { INodeState, NodeType } from '../model/Node';
import { IResourceState } from '../model/Resource';
import { IMiningState } from '../model/Mining';
import { IBulletState } from '../model/Bullet';
import { getUniqueID } from '../model/UniqueID';
import { threeDp } from '../utils/utils';
import {
    BUD_COST,
    BUILD_RADIUS_MAX,
    BUILD_RADIUS_MIN,
    BULLET_FLY_TIME,
    MINING_DISTANCE,
    MINING_INTERVAL,
    MINING_TIME,
    SHOOTING_DISTANCE,
    SHOOTING_INTERVAL,
} from '../model/constants'


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
    public delayedMiningList: IMiningState[] = [];
    public bullets: IBulletState[] = [];
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
        this.fixedTime.addEvent({
            delay: 10 * 1000,
            loop: true,
            callback: () => {
                const missing = 20 - this.resources.length;
                materialsLog(`Respawning ${missing} resources...`);

                for (let i = 0; i < missing; i++) {
                    this.spawnResource();
                }
            }
        })
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
            spawnLog('onPlayerDisconnected: no player found');
            return;
        }

        for (const node of this.getNodesByPlayerId(leavingPlayer.entityId)) {
            node.destroyPhysics(this.physicsSystem);
            this.distanceMatrix.removeTransform(node);
        }

        leavingPlayer.destroyPhysics(this.physicsSystem);
        this.distanceMatrix.removeTransform(leavingPlayer);
        this.players.splice(this.players.indexOf(leavingPlayer), 1);

        spawnLog(`Deleted player "${leavingPlayer.name}"(${leavingPlayer.entityId})`);

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
                    hue: player.hue,
                    isHuman: player.isHuman,
                    isCtrl: (player.socketId === playerId), // for the player receiving this state pack, is this Player themselves?
                    nextMoveTick: player.nextMoveTick,
                    nextCanShoot: player.nextCanShoot,
                    mAmt: player.mineralAmount,
                    aAmt: player.ammoAmount,

                    hp: player.hp,
                    maxHp: player.maxHp,

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
        if (!player) return;

        const parentNode = [...this.players, ...this.nodes].find(n => n.entityId == parentNodeId);
        if (!parentNode) return;

        // TODO: collision checks

        // TODO: distance checks
        const dx = parentNode.x - x;
        const dy = parentNode.y - y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > BUILD_RADIUS_MAX + 10) return;

        // TODO: money checks
        const cost = BUD_COST;
        if (player.mineralAmount < cost) return;

        // TODO: perhaps send some return message if not possible

        log('onPlayerCreateNode', x, y);
        player.mineralAmount -= cost;
        this.spawnNode(x, y, playerEntityId, parentNodeId);
    }

    onPlayerMorphNode(clientId: string, entityId: number, toNodeType: NodeType) {
        const player = this.getPlayerById(clientId);
        if (!player) return;
        const node = this.nodes.find(n => n.entityId === entityId);
        if (!node) return;

        // TODO: checking
        // if (node.playerEntityId !== player.entityId) return;

        node.nodeType = toNodeType;
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
        this.updateBullets();
        this.updateDelayedMinings();
        this.updateNodes();
        this.updatePlayers();
        this.cleanUpDeadEntities();

        this.fixedTime.update(fixedTime, frameSize);
        // this.lateUpdate(fixedTime, frameSize);
        // verbose(`fixedUpdate complete`);
    }

    getTransformList = () => ([...this.players, ...this.nodes, ...this.resources]);

    spawnNpc() {
        log('spawnNpc');

        const npc = Player.create(`AI ${names[~~(Math.random() * names.length)]}`);
        if (npc) this.players.push(npc);
        npc.createPhysics(this.physicsSystem, () => { });
        this.randomizePlayerPosition(npc);

        return npc;
    }

    spawnNode(x: number, y: number, playerEntityId: number, parentNodeId: number) {
        log(`spawnNode ${x}, ${y}, ${playerEntityId}, ${parentNodeId} }}`);

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
        for (const player of this.players) {
            if (player.isHuman) continue;

            if (player.aiNextTick > Date.now()) {
                continue;
            }
            player.aiNextTick = Date.now() + MINING_INTERVAL; //  SHOOTING_INTERVAL;
            aiLog(`[${player.entityId}] ai tick:`);

            this.updateAiMining(player);
            this.updateAiAttack(player);

        }
    }

    updateAiMining(player: Player) {
        return;

        if (player.mineralAmount < BUD_COST) {
            aiLog(`[${player.entityId}] not enough minerals`);
            return;
        }

        const closestEntities = this.distanceMatrix.getEntitiesClosestTo(player.entityId, 100000, 0, 100000);

        if (player.targetId == -1) {
            const closestResourceResult = closestEntities
                .map(([entityId, dist]) => [this.resources.find(r => r.entityId === entityId), dist])
                .find(([e, dist]) => e instanceof Resource) as [Resource, number];
            if (closestResourceResult) {
                player.targetId = closestResourceResult[0].entityId;
            }
        }
        const closestResourceOrNot = this.resources.find(r => r.entityId === player.targetId);
        if (!closestResourceOrNot) {
            player.targetId = -1;
            aiLog(`[${player.entityId}] player.targetId lost`);

            return;
        }
        const closestResource = closestResourceOrNot!;

        const nodesAndPlayers = [...this.nodes, ...this.players];

        const distanceFromResource = this.distanceMatrix.getEntitiesClosestTo(closestResource.entityId, 100000, 0, 100000);
        const closestNodeToResourceResult = distanceFromResource
            .map(([entityId, dist]) => [nodesAndPlayers.find(n => n.entityId === entityId), dist])
            .filter(([e, dist]) => e instanceof Node || e instanceof Player)
            .find(([e, dist]) => (
                (e instanceof Player && e.entityId == player.entityId) ||
                (e instanceof Node && e.playerEntityId == player.entityId)
            )) as [Node | Player, number];

        if (!closestNodeToResourceResult) {
            aiLog(`[${player.entityId}] no node closest to resource`);
            return;
        }
        const [closestNodeToResource, distToResource] = closestNodeToResourceResult;

        if (closestNodeToResource instanceof Node && distToResource < MINING_DISTANCE) {
            player.targetId = -1;
            aiLog(`[${player.entityId}] resource reached (${distToResource}).`);
            return;
        }


        const buildDistance = (distToResource > BUILD_RADIUS_MAX
            ? BUILD_RADIUS_MAX
            : distToResource - BUILD_RADIUS_MIN);


        const angle = Math.atan2(
            closestResource.y - closestNodeToResource.y,
            closestResource.x - closestNodeToResource.x,
        );
        const xx = closestNodeToResource.x + Math.cos(angle) * buildDistance;
        const yy = closestNodeToResource.y + Math.sin(angle) * buildDistance;

        aiLog(`[${player.entityId}] buildDistance ${buildDistance}, angle ${angle}`);


        this.spawnNode(xx, yy, player.entityId, closestNodeToResource.entityId);
    }

    updateAiAttack(player: Player) {

    }


    updateNodes() {
        for (const node of this.nodes) {
            if (node.aiNextTick > Date.now()) continue;

            const player = this.players.find(p => p.entityId === node.playerEntityId);
            if (!player) continue;

            node.aiNextTick = Date.now() + MINING_INTERVAL; //  SHOOTING_INTERVAL;

            this.updateNodeMining(node, player);
        }
        for (const node of this.nodes) {
            if (node.nodeType !== 'shooter' && node.nodeType !== 'swarm') continue;
            if (node.nextCanShoot > Date.now()) continue;

            const player = this.players.find(p => p.entityId === node.playerEntityId);
            if (!player) continue;

            node.nextCanShoot = Date.now() + SHOOTING_INTERVAL;

            this.updateNodeAttack(node, player);
        }
    }

    updateNodeMining(node: Node, player: Player) {
        const closestEntities = this.distanceMatrix.getEntitiesClosestTo(node.entityId, 100000, 0, MINING_DISTANCE);

        // materialsLog(`updateNodeMining(node-${node.entityId}, player=${player.name}) closestEntities[${closestEntities.length}]`);

        const resourceResult = closestEntities
            .map(([entityId, dist]) => [this.resources.find(r => r.entityId === entityId), dist])
            .find(([e, dist]) => e instanceof Resource);
        if (!resourceResult) return;

        const [resource, dist] = resourceResult as [Resource, number];
        // materialsLog(`resourceResult r-${resource.entityId} dist=${dist}`);
        if (dist > MINING_DISTANCE) return;

        materialsLog(`r-${resource.entityId} give mineral to (${node.entityId})`);
        this.transferMaterials(resource, node, 10, 0, this.fixedElapsedTime, MINING_TIME);
    }


    updateNodeAttack(node: Node, player: Player) {
        if (node.nodeType !== 'shooter' && node.nodeType !== 'swarm') return;
        if (node.targetId < 0) {
            const closestEntities = this.distanceMatrix.getEntitiesClosestTo(node.entityId, 100000, 0, SHOOTING_DISTANCE);
            const nodeResult = closestEntities
                .map(([entityId, dist]) => [
                    [...this.nodes, ...this.players].find(n => n.entityId === entityId),
                    dist
                ])
                .find(([e, dist]) => (
                    e instanceof Node && e.playerEntityId != player.entityId ||
                    e instanceof Player && e.entityId != player.entityId));
            if (!nodeResult) return;

            const [resource, dist] = nodeResult as [Node | Player, number];

            node.targetId = resource.entityId;
        }
        const targetNodeOrPlayer = [...this.nodes, ...this.players].find(n => n.entityId === node.targetId);
        if (!targetNodeOrPlayer) return;

        if (targetNodeOrPlayer.hp > 0) {
            // shoot!
            this.shootNode(node, targetNodeOrPlayer);
        }
    }

    updateDelayedMinings() {
        this.delayedMiningList.sort((a, b) => a.fromFixedTime + a.timeLength - b.fromFixedTime - b.timeLength);

        const miningReceivers = [
            ...this.players,
            ...this.nodes,
        ];

        for (const mining of this.delayedMiningList) {
            const {
                fromEntityId,
                toEntityId,

                mineralAmount,
                ammoAmount,

                fromFixedTime,
                timeLength,
            } = mining;

            if (fromFixedTime + timeLength > this.fixedElapsedTime) break;

            let toEntity = miningReceivers.find(e => e.entityId === toEntityId);
            if (toEntity == null) continue;

            if (toEntity instanceof Node) {
                const node = toEntity as Node;
                toEntity = this.players.find(p => p.entityId == node.playerEntityId);
            }
            if (toEntity == null) continue;

            toEntity.mineralAmount += mineralAmount;
            toEntity.ammoAmount += ammoAmount;

            materialsLog(`mining (${toEntityId}) min+${mineralAmount}=${toEntity.mineralAmount} ammo+${ammoAmount}=${toEntity.ammoAmount}`);
        }

        this.delayedMiningList = this.delayedMiningList.filter(p => (p.fromFixedTime + p.timeLength > this.fixedElapsedTime));
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

        this.delayedMiningList.push({
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

    shootNode(fromNode: Node, toNodeOrPlayer: Node | Player) {
        log(`(${fromNode.entityId}) shoot at (${toNodeOrPlayer.entityId})`);

        const bullet = {
            fromEntityId: fromNode.entityId,
            toEntityId: toNodeOrPlayer.entityId,

            attDmg: 10,

            fromFixedTime: this.fixedElapsedTime,
            timeLength: BULLET_FLY_TIME,
            interval: BULLET_FLY_TIME, // TODO: should be attack interval config
        };
        this.bullets.push(bullet);

        this.emitToAll(EVT_TOGGLE_SHOOTING, {
            tick: this.fixedElapsedTime,
            bullet,
        } as ToggleShootingMessage);
    }

    updateBullets() {
        this.bullets.sort((a, b) => a.fromFixedTime + a.timeLength - b.fromFixedTime - b.timeLength);

        const bulletReceivers = [
            ...this.players,
            ...this.nodes,
        ];

        for (const bullet of this.bullets) {
            const {
                fromEntityId,
                toEntityId,

                attDmg,

                fromFixedTime,
                timeLength,
            } = bullet;

            if (fromFixedTime + timeLength > this.fixedElapsedTime) break;

            let toEntity = bulletReceivers.find(e => e.entityId === toEntityId);
            if (toEntity == null) continue;

            toEntity.hp -= attDmg;
        }

        this.bullets = this.bullets.filter(b => (b.fromFixedTime + b.timeLength > this.fixedElapsedTime));
    }

    cleanUpDeadEntities() {
        // console.log('cleanUpDeadEntities');

        const killedEntities: number[] = [];
        for (const entity of [...this.players, ...this.nodes]) {
            if (entity.hp > 0) continue;
            log(`entity bye bye (hp= ${entity.hp}`);

            // kill entity
            this.killEntity(entity, killedEntities);
        }
        for (const resource of this.resources) {
            if (!(resource.mineralAmount <= 0 && resource.ammoAmount <= 0)) continue;

            // kill entity
            this.killEntity(resource, killedEntities);
        }
    }

    killEntity(entity: Node | Player | Resource, killedEntities: number[]) {
        log('killEntity ', entity.name);
        if (entity instanceof Node) {
            // clear connections

            this.traverseNodes(entity, 0, (entity, layer) => {
                if (entity instanceof Node) {
                    entity.playerEntityId = -1;
                    // don't kill these nodes yet, coz nodes without a root can still shoot for a while
                }
            });

            killedEntities.push(entity.entityId);
            this.nodes.splice(this.nodes.indexOf(entity), 1);
        }
        if (entity instanceof Player) {
            // clear connections

            killedEntities.push(entity.entityId);
            this.players.splice(this.players.indexOf(entity), 1);
        }
        if (entity instanceof Resource) {
            // clear connections


            killedEntities.push(entity.entityId);
            this.resources.splice(this.resources.indexOf(entity), 1);
        }

        if (killedEntities.length > 0) {
            this.emitToAll(EVT_NODE_KILLED, {
                tick: this.fixedElapsedTime,
                entityList: killedEntities,
            } as NodeKilledMessage);
        }
    }

    traverseNodes(entity: Node | Player, layer: number, callback: (entity: Node | Player, layer: number) => void) {
        if (!entity) return;
        callback(entity, layer);

        let childrenNodes = this.nodes.filter(n => n.parentNodeId == entity.entityId);
        if (!childrenNodes) return;

        for (const child of childrenNodes) {
            this.traverseNodes(child, layer + 1, callback);
        }
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

