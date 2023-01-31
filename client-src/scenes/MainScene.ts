import {
    b2Contact, b2ContactImpulse, b2ContactListener,
    b2Fixture, b2Manifold,
    // b2ParticleBodyContact, b2ParticleContact, b2ParticleSystem,
    b2Shape,
    b2Vec2
} from '@flyover/box2d';
import * as Debug from 'debug';
import "phaser";
import { GameObjects } from 'phaser';
import { preload as _assets_preload, setUpAudio as _assets_setUpAudio } from '../assets';
import { config, ItemType } from '../config/config';
import {
    BASE_LINE_WIDTH, BULLET_SPEED,
    DEBUG_DISABLE_SPAWNING, DEBUG_PHYSICS,
    PHYSICS_FRAME_SIZE, PHYSICS_MAX_FRAME_CATCHUP, PIXEL_TO_METER,
    PLAYER_MOVE_SPEED,
    SPAWN_DELAY, SPAWN_INTERVAL,
    WORLD_WIDTH, WORLD_HEIGHT,
    CAMERA_WIDTH, CAMERA_HEIGHT,
    WS_URL,
} from '../constants';
// import { Immutable } from '../utils/ImmutableType';
import { Player } from '../gameObjects/Player';
import { Node } from '../gameObjects/Node';
import { NodeBuilder } from '../gameObjects/NodeBuilder';
import { PingMeter } from '../gameObjects/PingMeter';
import { IBodyUserData, IFixtureUserData, PhysicsSystem } from '../PhysicsSystem';
import { DistanceMatrix } from '../../utils/DistanceMatrix';
// import { GameObjects } from 'phaser';
import { capitalize, lerpRadians } from '../../utils/utils';
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { DebugInspectReturn, EVT_DEBUG_INSPECT_RETURN, EVT_IO_CONNECT, EVT_IO_CONNECT_ERROR, EVT_IO_DISCONNECT, EVT_IO_RECONNECT, EVT_IO_RECONNECT_ATTEMPT, EVT_PLAYER_DISCONNECTED, EVT_PONG, EVT_STATE, EVT_WELCOME, PongMessage, StateMessage } from '../../model/EventsFromServer';
import { CMD_CHEAT, CMD_CREATE_NODE, CMD_PING, CMD_START, CreateNodeMessage, StartMessage } from '../../model/EventsFromClient';
import { IPlayerState } from '../../model/Player';
import { INodeState } from '../../model/Node';



type BaseSound = Phaser.Sound.BaseSound;
type Key = Phaser.Input.Keyboard.Key;

type EventControl = Phaser.Types.Input.EventData;
type Pointer = Phaser.Input.Pointer;

type Container = Phaser.GameObjects.Container;
type Graphics = Phaser.GameObjects.Graphics;
type Image = Phaser.GameObjects.Image;
type Text = Phaser.GameObjects.Text;

const Vector2 = Phaser.Math.Vector2;
const KeyCodes = Phaser.Input.Keyboard.KeyCodes;

const verbose = Debug('shroom-io:MainScene:verbose');
const log = Debug('shroom-io:MainScene:log');
const socketLog = Debug('shroom-io:MainScene.socket:log');
socketLog.log = console.log.bind(console);
// const warn = Debug('shroom-io:MainScene:warn');
// warn.log = console.warn.bind(console);


export type Controls = { up: Key, down: Key, left: Key, right: Key, action: Key };

export class MainScene extends Phaser.Scene {
    socket: Socket;
    controlsList: Controls[];

    isGameOver: boolean;
    bg: Phaser.GameObjects.TileSprite;

    // timing
    fixedTime: Phaser.Time.Clock;
    fixedElapsedTime: number;
    frameSize = PHYSICS_FRAME_SIZE; // ms
    lastUpdate = -1;
    lastUpdateTick = Date.now();

    entityList: { [x: number]: Player | Node } = {};

    backgroundUILayer: Container;
    factoryLayer: Container;
    itemLayer: Container;
    cameraInputLayer: Container;
    tankLayer: Container;
    playerLayer: Container;
    effectsLayer: Container;
    uiLayer: Container;
    physicsDebugLayer: Graphics;
    manualLayer: Container;

    btn_mute: Image;
    coordinateLabel: Text;
    pingMeter?: PingMeter;
    nodeBuilder?: NodeBuilder;

    mainPlayer?: Player;
    inventoryUi: Container;
    inventoryIcons: Container;

    // sfx_shoot: BaseSound;
    // sfx_hit: BaseSound;
    // sfx_navigate: BaseSound;
    // sfx_point: BaseSound;
    // sfx_open: BaseSound;
    // sfx_bgm: BaseSound;

    startButton: HTMLInputElement;
    startForm: HTMLFormElement;
    startScreen: HTMLDivElement;
    disconnectedScreen: HTMLDivElement;

    get mainCamera() { return this.sys.cameras.main; }

    constructor() {
        super({
            key: "MainScene",
        })
    }

    preload() {
        log('preload');
        _assets_preload.call(this);
        socketLog.enabled = (localStorage.getItem('dicksonMd.showSocketLog') || 'false') == 'true';
    }

    initSocket() {
        let reconnectionCounts = 0;
        if (this.startButton) this.startButton.value = 'Connecting...';
        const ws_url = localStorage.getItem('dicksonMd.ws_url') || WS_URL;
        if (localStorage.getItem('dicksonMd.ws_url')) {
            console.log(`Connection to ${ws_url}`);
        }
        this.socket = io(ws_url, {
            reconnectionDelayMax: 10000,
            // auth: {
            //     token: "123"
            // },
            // query: {
            //     "my-key": "my-value"
            // }
        });

        this.socket.on(EVT_IO_CONNECT, () => {
            socketLog(`Socket connected. id is ${this.socket.id}`);
            this.startButton.value = 'Start';
            reconnectionCounts = 0;
        });
        this.socket.on(EVT_IO_CONNECT_ERROR, () => {
            socketLog(`Socket connection error`);
            this.startButton.value = 'Socket Error';
        });
        this.socket.on(EVT_IO_DISCONNECT, () => {
            socketLog(`Socket disconnected`);
            this.startButton.value = 'Disconnected';
            if (this.startScreen.classList.contains('hidden')) {
                this.disconnectedScreen.classList.remove('hidden');
            }
        });
        this.socket.io.on(EVT_IO_RECONNECT, () => {
            socketLog(`Socket reconnected`);
            reconnectionCounts = 0;
            // don't re-enter the game, unless client side can clean up old state
        });
        this.socket.io.on(EVT_IO_RECONNECT_ATTEMPT, () => {
            socketLog(`Socket reconnecting...`);
            reconnectionCounts++;
            this.startButton.value = `Reconnecting (${reconnectionCounts})...`;
        });
        this.socket.on(EVT_WELCOME, (playerStateList?: StateMessage) => {
            socketLog(`Socket welcome`);
            this.input.keyboard.enabled = true;
            this.input.keyboard.enableGlobalCapture();

            this.startScreen.classList.add('hidden');

            if (playerStateList) this.handlePlayerStateList(playerStateList);

            // this.socket.emit('dash', { dashVector: { x: 10, y: 1 } });
            (window as any).socketT = this.socket;
        });
        this.socket.on(EVT_STATE, (playerStateList: StateMessage) => {
            const entityIdList = playerStateList.state.map(p => p.entityId).join(', ');
            socketLog(`Socket state (${playerStateList.state.length}) [${entityIdList}]`);
            this.handlePlayerStateList(playerStateList);
        });
        this.socket.on(EVT_PLAYER_DISCONNECTED, (data) => {
            const { playerId } = data;
            const leavingPlayer = this.entityList[playerId];
            if (leavingPlayer == null) {
                console.warn(`Player ${playerId} not found`);
                return;
            }

            leavingPlayer.destroyPhysics();
            leavingPlayer.destroy();
            delete this.entityList[playerId];
        });

        this.socket.onAny((event, ...args) => {
            if (event == EVT_STATE) return;
            if (event == EVT_DEBUG_INSPECT_RETURN) return;
            socketLog(`event ${event}`, ...args);
        });

        this.socket.on(EVT_DEBUG_INSPECT_RETURN, ({ msg, data }: DebugInspectReturn) => {
            console.log('EVT_DEBUG_INSPECT_RETURN', msg, data);
        });

        this.socket.on(EVT_PONG, ({ pingId, serverTimestamp }: PongMessage) => {
            this.pingMeter?.onPong(pingId, serverTimestamp);
        });
    }

    create(): void {
        this.setUpTitleMenu();
        this.initSocket();
        _assets_setUpAudio.call(this);
        log('create');
        this.mainCamera.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.fixedTime = new Phaser.Time.Clock(this);
        this.fixedElapsedTime = 0;
        // this.getPhysicsSystem().init(this as b2ContactListener);
        this.isGameOver = false;
        this.bg = this.add.tileSprite(0, 0, WORLD_WIDTH, WORLD_HEIGHT, 'allSprites_default', 'tileGrass1');
        this.bg.setOrigin(0, 0);
        this.bg.setAlpha(0.7);

        this.backgroundUILayer = this.add.container(0, 0);
        this.cameraInputLayer = this.add.container(0, 0);
        this.factoryLayer = this.add.container(0, 0);
        this.itemLayer = this.add.container(0, 0);
        this.tankLayer = this.add.container(0, 0);
        this.playerLayer = this.add.container(0, 0);
        this.effectsLayer = this.add.container(0, 0);
        this.uiLayer = this.add.container(0, 0);
        this.physicsDebugLayer = this.add.graphics({ lineStyle: { color: 0x000000, width: 1, alpha: 1 } });
        this.uiLayer.add(this.physicsDebugLayer);
        this.manualLayer = this.add.container(0, 0);



        // this.fixedTime.addEvent({
        //     delay: SPAWN_DELAY,
        //     callback: () => {
        //         this.sfx_bgm.play();
        //     },
        //     loop: false,
        // });

        this.setUpGUI();
        // this.setUpTutorial();
        this.setUpKeyboard();
        this.input.keyboard.enabled = false;
        this.input.keyboard.disableGlobalCapture();
        this.setUpConsoleCheat();

        this.renderer.on(Phaser.Renderer.Events.RENDER, () => {
            this.uiLayer.setPosition(
                this.mainCamera.scrollX,
                this.mainCamera.scrollY
            );
            this.cameraInputLayer.setPosition(
                this.mainCamera.scrollX,
                this.mainCamera.scrollY
            );
        });
        log('create complete');
    }

    update(time: number, dt: number) {
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

        this.pingMeter?.update(time, dt);
        this.nodeBuilder?.update(time, dt);
    }

    fixedUpdate(fixedTime: number, frameSize: number) {
        const timeStep = 1000 / frameSize;
        // verbose(`fixedUpdate start`);

        this.fixedTime.preUpdate(fixedTime, frameSize);
        this.getPhysicsSystem().update(
            timeStep,
            (DEBUG_PHYSICS ? this.physicsDebugLayer : undefined)
        );
        // this.distanceMatrix.init([this.bluePlayer, this.redPlayer, ...this.blueAi, ...this.redAi, ...this.items]);
        for (const scoreLabel of (this.effectsLayer.list as Container[])) {
            if (scoreLabel.name == 'roll-animation') {
                scoreLabel.update();
            }
        }


        this.fixedTime.update(fixedTime, frameSize);
        this.lateUpdate(fixedTime, frameSize);
        // verbose(`fixedUpdate complete`);
    }

    lateUpdate(fixedTime: number, frameSize: number) {
    }

    setUpTouch() {
        this.input.setTopOnly(false);
        this.input.on('pointerdown', (...args: any[]) => {
            log('pointerdown', args);
        });
        this.input.on('pointerup', (...args: any[]) => {
            log('pointerup', args);
        });
    }
    setUpKeyboard() {
        this.controlsList = [
            {
                up: this.input.keyboard.addKey(KeyCodes.W),
                down: this.input.keyboard.addKey(KeyCodes.S),
                left: this.input.keyboard.addKey(KeyCodes.A),
                right: this.input.keyboard.addKey(KeyCodes.D),
                action: this.input.keyboard.addKey(KeyCodes.C),
            },
            {
                up: this.input.keyboard.addKey(KeyCodes.UP),
                down: this.input.keyboard.addKey(KeyCodes.DOWN),
                left: this.input.keyboard.addKey(KeyCodes.LEFT),
                right: this.input.keyboard.addKey(KeyCodes.RIGHT),
                action: this.input.keyboard.addKey(KeyCodes.FORWARD_SLASH),
            }
        ];
        this.controlsList[0].action.on('down', (evt: any) => {
        });
        this.controlsList[1].action.on('down', (evt: any) => {
        });
    }

    setUpTitleMenu() {
        this.disconnectedScreen = document.querySelector('#disconnected-screen')!;
        this.startScreen = document.querySelector('#title-screen')!;
        this.startForm = document.querySelector('#title-screen .form')!;
        this.startButton = document.querySelector('#start-game')!;
        const submitNameToServer = () => {
            const name = (document.querySelector('input#player-name')! as HTMLInputElement).value;
            this.socket.emit(CMD_START, { name } as StartMessage);
        };

        this.startButton.onclick = submitNameToServer;
        this.startForm.onsubmit = (evt) => {
            evt.preventDefault();
            submitNameToServer();
        };
    }

    setUpGUI() {
        this.coordinateLabel = this.make.text({
            x: 0, y: 0,
            text: '',
            style: { color: 'black' }
        });

        this.pingMeter = new PingMeter(this).createSprite();
        this.pingMeter.setPosition(CAMERA_WIDTH, 0);
        this.pingMeter.emitSocket = (data) => {
            this.socket.volatile.emit(CMD_PING, data);
        };

        const clickRect = this.add.graphics();
        clickRect.fillStyle(0xFFFFFF, 0.1);
        clickRect.fillRect(0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);

        this.inventoryUi = this.createInventoryUi();

        this.cameraInputLayer.add([
            clickRect,
        ])
        this.uiLayer.add([
            this.coordinateLabel,
            this.pingMeter,
            this.inventoryUi,
        ]);


        clickRect.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(clickRect.x, clickRect.y, CAMERA_WIDTH, CAMERA_HEIGHT),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            draggable: false,
            dropZone: false,
            useHandCursor: false,
            cursor: 'pointer',
            pixelPerfect: false,
            alphaTolerance: 1,
        })
            .on('pointerdown', (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                // ...
                console.log('clickRect pointerdown');

            })
            .on('pointerup', (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                // ...
                console.log('clickRect pointerup', pointer.x, pointer.y);
                if (this.mainPlayer == null) return;

                const touchWorldPos = this.mainCamera.getWorldPoint(pointer.x, pointer.y);
                // console.log('pointerup', touchWorldPos.x, touchWorldPos.y);
                const dashVector = {
                    x: (touchWorldPos.x - this.mainPlayer.x) * 0.7,
                    y: (touchWorldPos.y - this.mainPlayer.y) * 0.7
                }
                // console.log('pointerup', dashVector);

                // this.socket.emit('dash', { dashVector });
            });
    }

    setUpTutorial() {
    }

    setUpConsoleCheat() {
        const w = (window as any);
        // w._debugToggleEntityId = () => {
        //     let val: boolean | null = null;
        //     Object.values(this.entityList).forEach(player => {
        //         if (val == null) val = !player._debugShowEntityId;;
        //         player._debugShowEntityId = val;
        //     })
        // };

        // w._debugInspectServer = (cmd: string, params?: any) => {
        //     if (cmd.startsWith('cheat')) {
        //        this.socket.emit(CMD_CHEAT, {
        //             cmd: cmd.replace('cheat-', ''),
        //             ...params,
        //         });
        //     } else {
        //         this.socket.emit(CMD_DEBUG_INSPECT, { cmd });
        //     }
        // };

        w._debugToggleSocketLogs = () => {
            socketLog.enabled = !socketLog.enabled;
        };
    }

    createInventoryUi() {
        this.inventoryUi = this.make.container({ x: 0, y: CAMERA_HEIGHT - 64 }).add([
            this.make.graphics({ x: 0, y: 0 })
                .fillStyle(0xFFFFFF, 1)
                .fillRect(0, 0, CAMERA_WIDTH, 64)
        ]);

        // this.inventoryUi.setInteractive({
        //     hitArea: new Phaser.Geom.Rectangle(0, 0, CAMERA_WIDTH, 64),
        //     hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        //     draggable: false,
        //     dropZone: false,
        //     useHandCursor: false,
        //     cursor: 'pointer',
        //     pixelPerfect: false,
        //     alphaTolerance: 1
        // })
        // .on('pointerover', (pointer: Pointer, localX: number, localY: number, event: EventData) => {
        //     console.log('pointerover');
        // })
        // .on('pointerout', (pointer: Pointer, localX: number, localY: number, event: EventData) => {
        //     console.log('pointerover');
        // })
        // .on('pointerdown', (pointer: Pointer, localX: number, localY: number, event: EventData) => {
        //     console.log('pointerdown');
        //     console.log(event);
        //     event.stopPropagation();
        // })
        // .on('pointerup', (pointer: Pointer, localX: number, localY: number, event: EventData) => {
        //     console.log('pointerup');
        //     console.log(event);
        //     event.stopPropagation();

        //     this.socket.emit('drop-dice', { slotId: 0 });
        // })
        ;

        return this.inventoryUi;
    }

    updateInventoryUi(playerState: IPlayerState) {
    }

    updateEntities(fixedTime: number, frameSize: number) {
        for (const entity of Object.values(this.entityList)) {

            entity.fixedUpdate(fixedTime, frameSize);
        }
    }

    spawnPlayer(playerState: IPlayerState) {
        const player = new Player(this);

        // console.log(`spawnPlayer ${playerState.name} (${playerState.x}, ${playerState.y})`);

        this.playerLayer.add(player);
        player.init(playerState).initPhysics();


        player.setInteractive({
            hitArea: new Phaser.Geom.Circle(0, 0, player.r),
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            draggable: false,
            dropZone: false,
            useHandCursor: false,
            cursor: 'pointer',
            pixelPerfect: false,
            alphaTolerance: 1
        })
            .on('pointerdown', (pointer: Pointer, localX: number, localY: number, eventCtrl: EventControl) => {
                console.log('player pointerdown');
                const xx = pointer.x + this.mainCamera.scrollX;
                const yy = pointer.y + this.mainCamera.scrollY;
                this.nodeBuilder = this.spawnNodeBuilder(xx, yy, player.r, player.entityId, player.entityId);
                eventCtrl.stopPropagation();
            })

        return player;
    }

    spawnNode(nodeState: INodeState) {
        const node = new Node(this);

        console.log(`spawnNode ${JSON.stringify(nodeState)})`);

        this.playerLayer.add(node);
        node.init(nodeState).initPhysics();

        node.setInteractive({
            hitArea: new Phaser.Geom.Circle(0, 0, node.r),
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            draggable: false,
            dropZone: false,
            useHandCursor: false,
            cursor: 'pointer',
            pixelPerfect: false,
            alphaTolerance: 1
        })
            .on('pointerdown', (pointer: Pointer, localX: number, localY: number, eventCtrl: EventControl) => {
                console.log('node pointerdown');
                this.spawnNodeBuilder(pointer.x, pointer.y, node.r, node.playerId, node.entityId);
                eventCtrl.stopPropagation();
            })
            ;

        // draw edge
        const player = this.entityList[nodeState.playerEntityId] as Player;
        const parentNode = this.entityList[nodeState.parentNodeId];

        player.addEdge(parentNode, node);

        return node;
    }

    spawnNodeBuilder(x: number, y: number, r: number, playerId: number, parentNodeId: number) {
        this.nodeBuilder = new NodeBuilder(this);

        console.log(`spawnNodeBuilder x: ${x}, y: ${y}, r: ${r}, playerId: ${playerId}, parentNodeId: ${parentNodeId})`);

        this.playerLayer.add(this.nodeBuilder);
        this.nodeBuilder.init(x, y, r, playerId, parentNodeId);

        // this.input.on('pointerup', (pointer: any, currentlyOver: any) => {
        //     log('global pointerup', pointer, currentlyOver);
        //     // ...
        // });

        this.nodeBuilder.setInteractive({
            hitArea: new Phaser.Geom.Circle(0, 0, this.nodeBuilder.r),
            hitAreaCallback: Phaser.Geom.Circle.Contains,
            draggable: true,
            dropZone: false,
            useHandCursor: false,
            cursor: 'pointer',
            pixelPerfect: false,
            alphaTolerance: 1
        })
            .on('dragend', () => {
                log('drag end');
            })
            .on('pointerup', (pointer: Pointer, localX: number, localY: number, eventCtrl: EventControl) => {
                console.log('nodebuilder pointerup');
                if (!this.nodeBuilder) return;

                this.socket.emit(CMD_CREATE_NODE, {
                    x: this.nodeBuilder.x,
                    y: this.nodeBuilder.y,
                    playerEntityId: this.nodeBuilder.playerEntityId,
                    parentNodeId: this.nodeBuilder.parentNodeId,
                } as CreateNodeMessage);


                this.nodeBuilder?.destroy();
                this.nodeBuilder = undefined;
            })
            ;
        // nodeBuilder.input.dragState = 2;
        // nodeBuilder.input.dragStartX = x;
        // nodeBuilder.input.dragStartY = y;


        //     .on('pointerup', (pointer: Pointer, localX: number, localY: number, eventCtrl: EventControl) => {
        //         console.log('nodebuilder pointerdown');
        //         eventCtrl.stopPropagation();
        //     })

        return this.nodeBuilder;
    }

    handlePlayerStateList(playerStateList: StateMessage) {
        const { tick, state } = playerStateList;

        const dt = (tick - this.lastUpdateTick) / 1000;
        for (const playerState of state) {
            const { entityId, isCtrl } = playerState;
            if (!this.entityList[entityId]) {
                const player = this.entityList[entityId] = this.spawnPlayer(playerState);
                if (player.isControlling) {
                    console.log(`Me: ${playerState.entityId}`);
                    this.mainPlayer = player;
                    this.mainCamera.startFollow(player, true, 0.2, 0.2);
                }
            } else {
                const isSmooth = (() => {
                    if (!this.mainPlayer) return false;
                    const dist = 500;
                    if (Math.abs(playerState.x - this.mainPlayer.x) > dist) return false;
                    if (Math.abs(playerState.y - this.mainPlayer.y) > dist) return false;
                    return true;
                })();
                const player = this.entityList[entityId] as Player;
                player.applyState(playerState, dt, isSmooth);

                if (playerState.isCtrl) {
                    this.updateInventoryUi(playerState);
                    // console.log({
                    //     ...playerState,
                    //     origAngle: this.entityList[entityId].angle,
                    //     angularVelo: this.entityList[entityId].b2Body?.GetAngularVelocity(),
                    // });
                    this.coordinateLabel.setText(`(${playerState.x.toFixed(1)}, ${playerState.y.toFixed(1)})`)
                }

                // if (isCtrl) console.log('handlePlayerStateList', playerState);
            }

            const { nodes } = playerState;
            for (const nodeState of nodes) {
                const { entityId } = nodeState;
                if (!this.entityList[entityId]) {
                    // spawn node
                    const node = this.entityList[entityId] = this.spawnNode(nodeState);
                } else {
                    // update node state
                    const node = this.entityList[entityId] as Node;
                    node.applyState(nodeState, dt, false);
                }
            }
        }
        this.lastUpdateTick = tick;
    }


    addToList(gameObject: (GameObjects.Container & { uniqueID: number }), list: (GameObjects.Container & { uniqueID: number })[]) {
        list.push(gameObject);
        // this.instancesByID[gameObject.uniqueID] = gameObject;
        gameObject.on('destroy', () => {
            list.splice(list.indexOf(gameObject), 1);
            // delete this.instancesByID[gameObject.uniqueID];
        });
    }




    getPhysicsSystem() {
        return (this.registry.get('physicsSystem') as PhysicsSystem);
    }
}
