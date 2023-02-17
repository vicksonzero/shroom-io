import {
    b2AABB,
    b2Body,
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
    DEBUG_DISABLE_SPAWNING, DEBUG_PHYSICS,
    PHYSICS_FRAME_SIZE, PHYSICS_MAX_FRAME_CATCHUP, PIXEL_TO_METER,
    WORLD_WIDTH, WORLD_HEIGHT,
    CAMERA_WIDTH, CAMERA_HEIGHT,
    WS_URL,
} from '../constants';
import {
    BUILD_RADIUS_MAX,
    NODE_RADIUS,
    MINING_DISTANCE,
    MINING_INTERVAL,
    MINING_TIME,
    SHOOTING_DISTANCE,
    SHOOTING_INTERVAL,
} from '../../model/constants'
// import { Immutable } from '../utils/ImmutableType';
import { IBodyUserData, IFixtureUserData, PhysicsSystem } from '../PhysicsSystem';
import { DistanceMatrix } from '../../utils/DistanceMatrix';
// import { GameObjects } from 'phaser';
import { capitalize, lerpRadians, threeDp } from '../../utils/utils';
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { ToggleShootingMessage, DebugInspectReturn, EVT_TOGGLE_SHOOTING, EVT_DEBUG_INSPECT_RETURN, EVT_IO_CONNECT, EVT_IO_CONNECT_ERROR, EVT_IO_DISCONNECT, EVT_IO_RECONNECT, EVT_IO_RECONNECT_ATTEMPT, EVT_NODE_KILLED, EVT_PLAYER_DISCONNECTED, EVT_PONG, EVT_STATE, EVT_WELCOME, NodeKilledMessage, PongMessage, StateMessage } from '../../model/EventsFromServer';
import { CMD_CHEAT, CMD_CREATE_NODE, CMD_MORPH_NODE, CMD_PING, CMD_START, CreateNodeMessage, MorphNodeMessage, StartMessage } from '../../model/EventsFromClient';
import { IPlayerState } from '../../model/Player';
import { INodeState, nodeSprites } from '../../model/Node';
import { IResourceState } from '../../model/Resource';
import { IMiningState } from '../../model/Mining';

import { NodeBuilder } from '../gameObjects/NodeBuilder';
import { Player } from '../gameObjects/Player';
import { Node } from '../gameObjects/Node';
import { Resource } from '../gameObjects/Resource';
import { MiningEffect } from '../gameObjects/MiningEffect';
import { BulletEffect, BulletParams } from '../gameObjects/BulletEffect';
import { ToastMessage, ToastParams } from '../gameObjects/ToastMessage';
import { PingMeter } from '../gameObjects/PingMeter';
import { ExplosionEffect, ParticleParams } from '../gameObjects/ExplosionEffect';

export type NodeLike = Node | Player | Resource;
export type PlayerNode = Node | Player;

type BaseSound = Phaser.Sound.BaseSound;
type Key = Phaser.Input.Keyboard.Key;

type EventControl = Phaser.Types.Input.EventData;
type Pointer = Phaser.Input.Pointer;

type Container = Phaser.GameObjects.Container;
type Graphics = Phaser.GameObjects.Graphics;
type Image = Phaser.GameObjects.Image;
type Text = Phaser.GameObjects.Text;


const POINTER_MOVE = Phaser.Input.Events.POINTER_MOVE;
const POINTER_DOWN = Phaser.Input.Events.POINTER_DOWN;
const POINTER_UP = Phaser.Input.Events.POINTER_UP;

const Vector2 = Phaser.Math.Vector2;
const KeyCodes = Phaser.Input.Keyboard.KeyCodes;

const verbose = Debug('shroom-io:MainScene:verbose');
const log = Debug('shroom-io:MainScene:log');
const socketLog = Debug('shroom-io:MainScene.socket:log');
socketLog.log = console.log.bind(console);
const warn = Debug('shroom-io:MainScene:warn');
warn.log = console.warn.bind(console);


const HSVToRGB = Phaser.Display.Color.HSVToRGB;
const HSLToColor = Phaser.Display.Color.HSLToColor;

/**
 * @param {number} hue - 0-360 degree for the hue of color
 * @param {number} sat - 0-1 saturation of color. 0 = grayscale, 1 = vibrant color
 * @param {number} val - 0-1 value of color. 0 = black, 1 = max color
 */
export function hueToColor(hue: number, sat: number, val: number) {
    return (HSVToRGB(hue / 360, sat, val) as Phaser.Display.Color).color;
}

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

    entityList: { [x: number]: NodeLike } = {};
    effectEntityList: MiningEffect[] = [];

    backgroundUILayer: Container;
    factoryLayer: Container;
    itemLayer: Container;
    cameraInputLayer: Container;
    playerLayer: Container;
    towerLayer: Container;
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

    homeButton: Container;
    zoomButton: Container;
    zoomIndicator: Image;
    isPanMode: boolean;
    isPanning: boolean;
    zoomStart = { x: 0, y: 0 };
    mineralsLabel: Text;
    sporesLabel: Text;



    buildUi: Container;
    buildUiInfoLayer: Container;
    buildUiButtonsLayer: Container;

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

    distanceMatrix: DistanceMatrix = new DistanceMatrix();

    get mainCamera() { return this.sys.cameras.main; }

    constructor() {
        super({
            key: "MainScene",
        })
        this.distanceMatrix.getTransformList = () => this.getTransformList();
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
        this.socket.on(EVT_STATE, (stateMessage: StateMessage) => {
            const entityIdList = stateMessage.playerStates.map(p => p.eid).join(', ');
            socketLog(`Socket state (${stateMessage.playerStates.length}) [${entityIdList}]`);
            this.handlePlayerStateList(stateMessage);
        });
        this.socket.on(EVT_TOGGLE_SHOOTING, (bulletShotMessage: ToggleShootingMessage) => {
            const bullet = bulletShotMessage.bullet;
            socketLog(`Socket EVT_BULLET_SHOT (${JSON.stringify(bullet)})`);
        });
        this.socket.on(EVT_NODE_KILLED, (nodeKilledMessage: NodeKilledMessage) => {
            const entityList = nodeKilledMessage.entityList;

            this.onNodeKilled(entityList);
            socketLog(`Socket EVT_NODE_KILLED (${JSON.stringify(entityList)})`);
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
        this.isPanMode = false;
        this.isPanning = false;
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
        this.playerLayer = this.add.container(0, 0);
        this.towerLayer = this.add.container(0, 0);
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

        this.setUpTouch();
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
        this.distanceMatrix.init();
        this.updateAi(fixedTime, frameSize);


        this.fixedTime.update(fixedTime, frameSize);
        this.lateUpdate(fixedTime, frameSize);
        // verbose(`fixedUpdate complete`);
    }

    lateUpdate(fixedTime: number, frameSize: number) {
        this.playerLayer.sort('depth');
    }

    getTransformList = () => Object.values(this.entityList);

    setUpTouch() {
        console.log(`setUpTouch`);
        this.input.setTopOnly(false);

        this.input.on(POINTER_DOWN, (pointer: Pointer, objects: Phaser.GameObjects.GameObject[]) => {
            // console.log('(POINTER_DOWN)');
        });
        this.input.on(POINTER_MOVE, (pointer: Pointer, objects: Phaser.GameObjects.GameObject[]) => {
            // console.log('(POINTER_MOVE)');
        });
        this.input.on(POINTER_UP, (pointer: Pointer, objects: Phaser.GameObjects.GameObject[]) => {
            // console.log('(POINTER_UP)');
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

        // clickRect is below all items
        const clickRect = this.add.graphics();
        clickRect.fillStyle(0xFFFFFF, 0.01);
        clickRect.fillRect(0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);

        // clickRect is above all items
        const zoomRect = this.add.graphics();
        zoomRect.fillStyle(0xFFFFFF, 0.01);
        zoomRect.fillRect(0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);

        this.inventoryUi = this.createInventoryUi();
        this.zoomIndicator = this.make.image({
            x: CAMERA_WIDTH / 2, y: CAMERA_HEIGHT / 2,
            key: 'zoom',
        })
            .setTint(0x000000)
            .setScale(4)
            .setAlpha(0.4);
        ;
        this.zoomIndicator.setVisible(this.isPanMode);


        this.cameraInputLayer.add([
            clickRect,
        ]);

        this.buildUi = this.createBuildUi();
        this.hideBuildUi();

        this.uiLayer.add([
            this.coordinateLabel,
            this.pingMeter,
            zoomRect,
            this.inventoryUi,
            this.zoomIndicator,
            this.buildUi,
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
            .on(POINTER_DOWN, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                // ...
                console.log('clickRect pointerdown');
                this.zoomStart = {
                    x: pointer.x,
                    y: pointer.y,
                };
                this.isPanning = true;
                console.log('this.isPanning', this.isPanning);

            })
            .on(POINTER_UP, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                // ...
                console.log('clickRect pointerup', pointer.x, pointer.y);
                this.isPanning = false;
                console.log('this.isPanning', this.isPanning);
                this.handleNodeBuilder(pointer);
            });


        zoomRect.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(zoomRect.x, zoomRect.y, CAMERA_WIDTH, CAMERA_HEIGHT),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            draggable: false,
            dropZone: false,
            useHandCursor: false,
            cursor: 'pointer',
            pixelPerfect: false,
            alphaTolerance: 1,
        })
            .on(POINTER_DOWN, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                console.log('zoomRect POINTER_DOWN');
                if (this.isPanMode && (pointer.buttons & 1)) {
                    this.zoomStart = {
                        x: pointer.x,
                        y: pointer.y,
                    };
                    this.isPanning = true;
                    console.log('this.isPanning', this.isPanning);
                    event.stopPropagation();
                }

            })
            .on(POINTER_MOVE, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                if (this.isPanning && (pointer.buttons & 1)) {
                    console.log('zoomRect POINTER_MOVE dragged');
                    this.mainCamera.scrollX += this.zoomStart.x - pointer.x;
                    this.mainCamera.scrollY += this.zoomStart.y - pointer.y;
                    this.zoomStart = {
                        x: pointer.x,
                        y: pointer.y,
                    };
                    this.coordinateLabel.setText(`(${this.mainCamera.scrollX.toFixed(1)}, ${this.mainCamera.scrollY.toFixed(1)})`);
                    event.stopPropagation();
                }
            })
            .on(POINTER_UP, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                if (this.isPanMode && (pointer.buttons & 1)) {
                    console.log('zoomRect POINTER_UP', pointer.x, pointer.y);
                    this.isPanning = false;
                    console.log('this.isPanning', this.isPanning);
                    event.stopPropagation();
                }
            });
    }

    setUpTutorial() {
    }

    setUpConsoleCheat() {
        const w = (window as any);
        w._debugToggleEntityId = () => {
            let val: boolean | null = null;
            Object.values(this.entityList).forEach(player => {
                if (val == null) val = !player._debugShowEntityId;;
                player._debugShowEntityId = val;
            })
        };

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
                .fillRect(0, 0, CAMERA_WIDTH, 64),
            this.mineralsLabel = this.make.text({ x: CAMERA_WIDTH - 10, y: -32, text: 'Minerals: 0', style: { align: 'center' }, origin: { x: 1, y: 1 } }),
            this.sporesLabel = this.make.text({ x: CAMERA_WIDTH - 10, y: -16, text: 'Spore: 0', style: { align: 'center' }, origin: { x: 1, y: 1 } }),
        ])
            .on(POINTER_DOWN, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                console.log('inventoryUi POINTER_DOWN');
                event.stopPropagation();
            })
            .on(POINTER_MOVE, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                console.log('inventoryUi POINTER_MOVE');
                event.stopPropagation();
            })
            .on(POINTER_UP, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                console.log('inventoryUi POINTER_UP');
                event.stopPropagation();
            });

        this.inventoryUi.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(0, 0, CAMERA_WIDTH, 64),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            draggable: false,
            dropZone: false,
            useHandCursor: false,
            cursor: 'pointer',
            pixelPerfect: false,
            alphaTolerance: 1
        });

        this.inventoryUi.add([
            this.homeButton = this.make.container({ x: 0, y: 0 }).add([
                this.make.image({
                    x: 0, y: 0,
                    key: 'structure_house',
                })
                    .setTint(0x000000)
                    .setOrigin(0, 0),
            ])
                .setInteractive({
                    hitArea: new Phaser.Geom.Rectangle(0, 0, 64, 64),
                    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
                    draggable: false,
                    dropZone: false,
                    useHandCursor: false,
                    cursor: 'pointer',
                    pixelPerfect: false,
                    alphaTolerance: 1
                })
                .on(POINTER_DOWN, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                    (this.homeButton.list[0] as Image).setTint(0x666666);
                    event.stopPropagation();
                })
                .on(POINTER_UP, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                    console.log('pointerdown');

                    (this.homeButton.list[0] as Image).setTint(0x000000);
                    if (this.mainPlayer) {
                        this.mainCamera.centerOn(this.mainPlayer.x, this.mainPlayer.y);
                    }
                    event.stopPropagation();
                })
            ,
            this.zoomButton = this.make.container({ x: 64, y: 0 }).add([
                this.make.image({
                    x: 0, y: 0,
                    key: 'zoom',
                })
                    .setTint(0x000000)
                    .setOrigin(0, 0),
            ])
                .setInteractive({
                    hitArea: new Phaser.Geom.Rectangle(0, 0, 64, 64),
                    hitAreaCallback: Phaser.Geom.Rectangle.Contains,
                    draggable: false,
                    dropZone: false,
                    useHandCursor: false,
                    cursor: 'pointer',
                    pixelPerfect: false,
                    alphaTolerance: 1
                })
                .on(POINTER_DOWN, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                    (this.zoomButton.list[0] as Image).setTint(0x666666);
                    event.stopPropagation();
                })
                .on(POINTER_UP, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                    console.log('pointerdown');

                    this.isPanMode = !this.isPanMode;
                    this.zoomIndicator.setVisible(this.isPanMode);
                    (this.zoomButton.list[0] as Image).setTint(0x000000);
                    event.stopPropagation();
                })
            ,
        ]);

        return this.inventoryUi;
    }

    updateInventoryUi(playerState: IPlayerState) {
        this.mineralsLabel.setText(`Minerals: ${playerState.mAmt}`);
        this.sporesLabel.setText(`Spore: ${playerState.aAmt}`);
    }
    createBuildUi() {
        const buildUiRect = this.add.graphics();
        buildUiRect.fillStyle(0x000000, 0.7);
        buildUiRect.fillRect(0, 0, CAMERA_WIDTH, CAMERA_HEIGHT);

        this.buildUi = this.make.container({ x: 0, y: 0 }).add([
            buildUiRect,
            this.buildUiInfoLayer = this.make.container({ x: 0, y: 0 }),
            this.buildUiButtonsLayer = this.make.container({ x: 0, y: 0 }),
        ]);
        buildUiRect.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(0, 0, CAMERA_WIDTH, CAMERA_HEIGHT),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            draggable: false,
            dropZone: false,
            useHandCursor: false,
            cursor: 'pointer',
            pixelPerfect: false,
            alphaTolerance: 1
        })
            .on(POINTER_DOWN, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                console.log('buildUiRect POINTER_DOWN');
                event.stopPropagation();
            })
            .on(POINTER_MOVE, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                console.log('buildUiRect POINTER_MOVE');
                event.stopPropagation();
            })
            .on(POINTER_UP, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                console.log('buildUiRect POINTER_UP');

                this.hideBuildUi();

                event.stopPropagation();
            });


        return this.buildUi;
    }

    showBuildUi(playerNode: PlayerNode) {
        this.buildUi.setVisible(true);
        const buttons = [];

        if (playerNode instanceof Player && playerNode.isControlling) {
            this.buildUiInfoLayer.add([
                this.make.text({ x: 0, y: 30, text: 'Root', style: { align: 'center' }, origin: 0.5 }),
            ]);
            buttons.push(...[
                this.make.image({ key: 'cross', }).setName('Back'),
            ]);
        } else if (playerNode instanceof Node && playerNode.nodeType === 'bud') {
            this.buildUiInfoLayer.add([
                this.make.text({ x: 0, y: 30, text: 'Bud', style: { align: 'center' }, origin: 0.5 }),
                this.make.text({ x: 0, y: 48, text: `HP: ${playerNode.hp}/${playerNode.maxHp}`, style: { align: 'center' }, origin: 0.5 }),
            ]);
            buttons.push(...[
                this.make.image({ key: 'cross', }).setName('Back'),
                this.make.image({ key: 'trash', }).setName('Kill'),
                this.make.sprite({ key: nodeSprites['converter'].key, frame: nodeSprites['converter'].baseIndex, }).setName('Converter').setScale(nodeSprites['converter'].scale),
                this.make.sprite({ key: nodeSprites['shooter'].key, frame: nodeSprites['shooter'].baseIndex, }).setName('Shooter').setScale(nodeSprites['shooter'].scale),
                this.make.sprite({ key: nodeSprites['swarm'].key, frame: nodeSprites['swarm'].baseIndex, }).setName('Swarm').setScale(nodeSprites['swarm'].scale),
            ]);
        } else if (playerNode instanceof Node && playerNode.nodeType === 'converter') {
            buttons.push(...[
                this.make.image({ key: 'cross', }).setName('Back'),
                this.make.image({ key: 'pawn_down', }).setName('Downgrade'),
                // this.make.image({ key: 'pawn_up' }).setName('Upgrades'),
            ]);
        } else if (playerNode instanceof Node && playerNode.nodeType === 'shooter') {
            buttons.push(...[
                this.make.image({ key: 'cross', }).setName('Back'),
                this.make.image({ key: 'pawn_down', }).setName('Downgrade'),
                // this.make.image({ key: 'pawn_up' }).setName('Upgrades'),
            ]);
        } else if (playerNode instanceof Node && playerNode.nodeType === 'swarm') {
            buttons.push(...[
                this.make.image({ key: 'cross', }).setName('Back'),
                this.make.image({ key: 'pawn_down', }).setName('Downgrade'),
                // this.make.image({ key: 'pawn_up' }).setName('Upgrades'),
            ]);
        }

        let angle = Math.PI / 2;
        let radius = 80;
        for (const button of buttons) {
            button.setPosition(
                Math.cos(angle) * radius,
                Math.sin(angle) * radius
            );
            angle -= Math.PI / 4;
            this.buildUiInfoLayer.add([
                this.make.text({
                    x: button.x, y: button.y + 28,
                    text: button.name,
                    style: { align: 'center' },
                    origin: 0.5
                }),
            ]);
        }

        for (const button of buttons) {
            let buttonIsDown = false;
            button
                .setScale(0.6)
                .setTint(0xaaffff)
                .setInteractive({
                    hitArea: new Phaser.Geom.Circle(25, 25, 50),
                    hitAreaCallback: Phaser.Geom.Circle.Contains,
                    draggable: false,
                    dropZone: false,
                    useHandCursor: false,
                    cursor: 'pointer',
                    pixelPerfect: false,
                    alphaTolerance: 1
                })
                .on(POINTER_DOWN, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                    // console.log(`button ${button.name} POINTER_DOWN`);
                    buttonIsDown = true;
                    button.setTint(0xaaaaaa);
                    event.stopPropagation();
                })
                .on(POINTER_MOVE, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                    if (!buttonIsDown) return;
                    event.stopPropagation();
                })
                .on(POINTER_UP, (pointer: Pointer, localX: number, localY: number, event: EventControl) => {
                    // console.log(`button ${button.name} POINTER_UP`);
                    if (!buttonIsDown) return;
                    buttonIsDown = false;
                    button.setTint(0xffffff);

                    this.handleBuildButtonClicked(button, playerNode);

                    event.stopPropagation();
                });
        }
        this.buildUiButtonsLayer.add(buttons);
        this.buildUiButtonsLayer.setPosition(
            playerNode.x - this.mainCamera.scrollX,
            playerNode.y - this.mainCamera.scrollY,
        );
        this.buildUiInfoLayer.setPosition(
            playerNode.x - this.mainCamera.scrollX,
            playerNode.y - this.mainCamera.scrollY,
        );


        const { key, scale, origin, baseIndex } = nodeSprites[playerNode.nodeType];
        this.buildUiButtonsLayer.add(
            this.make.image({ key })
                .setTexture(key, baseIndex)
                .setScale(scale)
                .setOrigin(...origin)
        )
    }
    hideBuildUi() {
        this.buildUiInfoLayer.removeAll(true);
        this.buildUiButtonsLayer.removeAll(true);
        this.buildUi.setVisible(false);
    }
    handleBuildButtonClicked(button: Phaser.GameObjects.GameObject, playerNode: PlayerNode) {
        console.log('handleBuildButtonClicked', button.name);
        switch (button.name) {
            case 'Back': {
                this.hideBuildUi();
            } break;
            case 'Kill': {

            } break;
            case 'Converter': {
                this.socket.emit(CMD_MORPH_NODE, {
                    entityId: playerNode.entityId,
                    toNodeType: 'converter',
                } as MorphNodeMessage);

                this.hideBuildUi();
            } break;
            case 'Shooter': {
                this.socket.emit(CMD_MORPH_NODE, {
                    entityId: playerNode.entityId,
                    toNodeType: 'shooter',
                } as MorphNodeMessage);

                this.hideBuildUi();
            } break;
            case 'Swarm': {
                this.socket.emit(CMD_MORPH_NODE, {
                    entityId: playerNode.entityId,
                    toNodeType: 'swarm',
                } as MorphNodeMessage);

                this.hideBuildUi();
            } break;
            case 'Downgrade': {
                this.socket.emit(CMD_MORPH_NODE, {
                    entityId: playerNode.entityId,
                    toNodeType: 'bud',
                } as MorphNodeMessage);

                this.hideBuildUi();
            } break;
            case 'Upgrades': {

            } break;
        }
    }



    updateEntities(fixedTime: number, frameSize: number) {
        for (const entity of Object.values(this.entityList)) {

            entity.fixedUpdate(fixedTime, frameSize);
        }
    }

    updateAi(fixedTime: number, frameSize: number) {
        const entities = Object.values(this.entityList);
        for (const entity of entities) {
            if (!(entity instanceof Node)) continue;
            const node = entity as Node;
            // if it is time for node to spawn effect,
            if (node.nextCanMine > Date.now()) continue;
            node.nextCanMine = Date.now() + MINING_INTERVAL;

            this.updateMiningEffects(node);
        }
        for (const entity of entities) {
            if (!(entity instanceof Node)) continue;
            const node = entity as Node;
            // if it is time for node to spawn effect,
            if (node.nextCanShoot > Date.now()) continue;
            node.nextCanShoot = Date.now() + SHOOTING_INTERVAL;

            this.updateShootingEffects(node);
        }
        // trigger effect update()
        for (const miningEffect of this.effectEntityList) {

            const fromEntity = this.entityList[miningEffect.fromEntityId];
            const toEntity = this.entityList[miningEffect.toEntityId];
            const isInvalid = (
                fromEntity == null ||
                toEntity == null
            );
            if (!isInvalid) {
                miningEffect.fixedUpdate(fixedTime, frameSize);
            }
        }
    }

    updateMiningEffects(node: Node) {
        const player = this.entityList[node.playerEntityId];
        if (!player) return;


        const closestEntities = this.distanceMatrix.getEntitiesClosestTo(node.entityId, 100000, 0, MINING_DISTANCE);

        const resourceResult = closestEntities
            .map(([entityId, dist]) => [this.entityList[entityId], dist])
            .find(([e, dist]) => e instanceof Resource);
        if (!resourceResult) return;


        const [resource, dist] = resourceResult as [Resource, number];
        log(`resourceResult r-${resource.entityId} dist=${dist}`);
        if (dist > MINING_DISTANCE) return;

        // spawn effect
        this.spawnMiningEffect({
            entityId: -1,
            fromEntityId: resource.entityId,
            toEntityId: node.entityId,

            mineralAmount: 10,
            ammoAmount: 0,

            fromFixedTime: -1,
            timeLength: MINING_TIME,
        }, resource, node);


    }

    updateShootingEffects(node: Node) {
        console.log('2', node.nodeType);
        if (node.nodeType !== 'shooter' && node.nodeType !== 'swarm') return;
        console.log('3');

        if (node.targetId < 0) {
            console.log('4');
            const player = this.entityList[node.playerEntityId];
            if (!player) return;
            const closestEntities = this.distanceMatrix.getEntitiesClosestTo(node.entityId, 100000, 0, SHOOTING_DISTANCE);
            const nodeResult = closestEntities
                .map(([entityId, dist]) => [
                    this.entityList[entityId],
                    dist
                ])
                .find(([e, dist]) => (
                    e instanceof Node && e.playerEntityId != player.entityId ||
                    e instanceof Player && e.entityId != player.entityId));
            if (!nodeResult) return;

            const [enemyPlayerNode, dist] = nodeResult as [PlayerNode, number];

            node.targetId = enemyPlayerNode.entityId;
        }

        const targetPlayerNode = this.entityList[node.targetId] as PlayerNode;
        if (!targetPlayerNode) {
            node.targetId = -1;
            return;
        }
        console.log('5');

        if (targetPlayerNode.hp > 0) {
            // shoot!
            this.spawnBulletEffect(node, targetPlayerNode);
        }
    }

    spawnPlayer(playerState: IPlayerState) {
        const player = new Player(this);

        // console.log(`spawnPlayer ${playerState.name} (${playerState.x}, ${playerState.y})`);

        this.playerLayer.add(player);
        player.init(playerState).initPhysics();
        player.setDepth(-100);

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
            .on(POINTER_DOWN, (pointer: Pointer, localX: number, localY: number, eventCtrl: EventControl) => {
                console.log('player pointerdown');
                const xx = pointer.x + this.mainCamera.scrollX;
                const yy = pointer.y + this.mainCamera.scrollY;
                this.nodeBuilder = this.spawnNodeBuilder(xx, yy, NODE_RADIUS, player.entityId, player.entityId);
                eventCtrl.stopPropagation();
            })

        return player;
    }

    spawnNode(nodeState: INodeState) {
        const node = new Node(this);

        console.log(`spawnNode ${JSON.stringify(nodeState)})`);

        this.playerLayer.add(node);
        node.init(nodeState).initPhysics();
        node.setDepth(node.y);

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
            .on(POINTER_DOWN, (pointer: Pointer, localX: number, localY: number, eventCtrl: EventControl) => {
                console.log('node pointerdown');
                this.spawnNodeBuilder(pointer.x, pointer.y, node.r, node.playerEntityId, node.entityId);
                eventCtrl.stopPropagation();
            })
            ;

        const { plEid: playerEntityId, parEid: parentNodeId } = nodeState;
        // draw edge
        const player = this.entityList[playerEntityId] as Player;
        const parentNode = this.entityList[parentNodeId];
        if (parentNode && player) {
            player.addEdge(parentNode, node);
        } else {
            warn(`parentNode [${parentNodeId}] not found`);
        }

        return node;
    }

    spawnNodeBuilder(x: number, y: number, r: number, playerId: number, parentNodeId: number) {
        if (this.nodeBuilder) {
            this.nodeBuilder.destroy();
        }
        this.nodeBuilder = new NodeBuilder(this);

        console.log(`spawnNodeBuilder x: ${x}, y: ${y}, r: ${r}, playerId: ${playerId}, parentNodeId: ${parentNodeId})`);

        this.playerLayer.add(this.nodeBuilder);
        this.nodeBuilder.init(x, y, r, playerId, parentNodeId, 'bud');

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
            ;
        // nodeBuilder.input.dragState = 2;
        // nodeBuilder.input.dragStartX = x;
        // nodeBuilder.input.dragStartY = y;


        //     .on('pointerup', (pointer: Pointer, localX: number, localY: number, eventCtrl: EventControl) => {
        //         console.log('nodeBuilder pointerdown');
        //         eventCtrl.stopPropagation();
        //     })

        return this.nodeBuilder;
    }

    spawnResource(resourceState: IResourceState) {
        const resource = new Resource(this);

        console.log(`spawnResource ${JSON.stringify(resourceState)})`);

        this.playerLayer.add(resource);
        resource.init(resourceState).initPhysics();
        resource.setDepth(resource.y);

        return resource;
    }

    spawnBulletEffect(fromNode: Node, toPlayerNode: PlayerNode) {
        // feel free to put this effect in an object pool when more perf is needed
        const eff = new BulletEffect(this, {
            fromX: fromNode.x,
            fromY: fromNode.y,
            fromHeight: fromNode.towerHeight,
            toX: toPlayerNode.x,
            toY: toPlayerNode.y,
            toHeight: toPlayerNode.towerHeight,
            toWidth: toPlayerNode.towerWidth,
            duration: 1000,
            color: hueToColor(fromNode.hue, 0.7, 0.5),
            size: { min: 4, max: 6 },
        });
        this.effectsLayer.add(eff);
    }

    spawnMiningEffect(miningState: IMiningState, fromEntity: Container, toEntity: Container) {
        // feel free to put this effect in an object pool when perf is needed
        console.log('spawnMiningEffect');
        const eff = new MiningEffect(this);

        this.effectsLayer.add(eff);
        eff.init(miningState, fromEntity, toEntity);

        this.effectEntityList.push(eff);

        return eff;
    }

    spawnExplosionEffect(params: ParticleParams) {
        // feel free to put this effect in an object pool when perf is needed
        const eff = new ExplosionEffect(this, params);
        this.effectsLayer.add(eff);
    }

    spawnToast(params: ToastParams) {
        const eff = new ToastMessage(this, params);
        this.uiLayer.add(eff);
    }

    handleNodeBuilder(pointer: Pointer) {
        if (!this.nodeBuilder) return;

        const parentNode = this.entityList[this.nodeBuilder.parentNodeId];

        const dx = parentNode.x - this.nodeBuilder.x;
        const dy = parentNode.y - this.nodeBuilder.y;
        const distance = Math.sqrt(dx * dx + dy * dy);



        const collisions = this.getPhysicsSystem().queryCircle(this.nodeBuilder.x, this.nodeBuilder.y, this.nodeBuilder.r * 2);
        const hasCollision = collisions.length > 0;

        if (distance < NODE_RADIUS * 2) {
            console.log('handleNodeBuilder upgrade');
            this.showBuildUi(parentNode as PlayerNode);
        } else if (hasCollision) {
            // do nothing
        } else {
            this.socket.emit(CMD_CREATE_NODE, {
                x: threeDp(this.nodeBuilder.x),
                y: threeDp(this.nodeBuilder.y),
                playerEntityId: this.nodeBuilder.playerEntityId,
                parentNodeId: this.nodeBuilder.parentNodeId,
            } as CreateNodeMessage);
        }


        this.nodeBuilder?.destroy();
        this.nodeBuilder = undefined;
    }

    handlePlayerStateList(stateMessage: StateMessage) {
        const { tick, playerStates, resourceStates, orphanNodes } = stateMessage;

        const dt = (tick - this.lastUpdateTick) / 1000;
        this.fixedElapsedTime = tick; // HACK: just forgetting lerping for a while
        for (const playerState of playerStates) {
            const { eid: entityId, isCtrl } = playerState;
            if (!this.entityList[entityId]) {
                const player = this.entityList[entityId] = this.spawnPlayer(playerState);
                if (player.isControlling) {
                    console.log(`Me: ${playerState.eid}`);
                    // this.mainCamera.startFollow(player, true, 0.2, 0.2);
                    this.mainCamera.centerOn(player.x, player.y);
                    this.coordinateLabel.setText(`(${this.mainCamera.scrollX.toFixed(1)}, ${this.mainCamera.scrollY.toFixed(1)})`);
                    this.mainPlayer = player;
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
                }

                // if (isCtrl) console.log('handlePlayerStateList', playerState);
            }

            const { nodes } = playerState;
            for (const nodeState of nodes) {
                const { eid: entityId } = nodeState;
                if (!this.entityList[entityId]) {
                    // spawn node
                    const node = this.entityList[entityId] = this.spawnNode(nodeState);
                } else {
                    // update node state
                    const node = this.entityList[entityId] as Node;
                    node.applyState(nodeState, dt, false);
                    node.isNewestNode = (node.entityId === nodes[nodes.length - 1].eid);
                }
            }

        }
        for (const nodeState of orphanNodes) {
            const { eid: entityId } = nodeState;
            if (!this.entityList[entityId]) {
                // spawn node
                const orphanNode = this.entityList[entityId] = this.spawnNode(nodeState);
            } else {
                // update node state
                const orphanNode = this.entityList[entityId] as Node;
                orphanNode.applyState(nodeState, dt, false);
                orphanNode.isNewestNode = false;
            }
        }

        for (const resourceState of resourceStates) {
            const { eid: entityId } = resourceState;
            if (!this.entityList[entityId]) {
                // spawn node
                const resource = this.entityList[entityId] = this.spawnResource(resourceState);
            } else {
                // update node state
                const resource = this.entityList[entityId] as Resource;
                resource.applyState(resourceState, dt, false);
            }
        }

        this.lastUpdateTick = tick;
    }

    onNodeKilled(entityList: number[]) {
        const deadEntities = Object.values(this.entityList)
            .filter(e => entityList.includes(e.entityId));

        for (const entity of deadEntities) {
            if (entity instanceof Node || entity instanceof Player) {
                this.traverseNodes(entity, 0, null, (playerNode, layer) => {
                    if (playerNode instanceof Node) {
                        playerNode.playerEntityId = -1;
                        playerNode.updateBaseGraphics();
                    }
                });
                this.spawnExplosionEffect({
                    color: hueToColor(entity.hue, 0.5, 0.5),
                    distance: 32,
                    duration: 700,
                    particleCount: 8,
                    size: { min: 5, max: 8 },
                    x: entity.x,
                    y: entity.y,
                });
                entity.destroy();
                delete this.entityList[entity.entityId];
            }
            if (entity instanceof Resource) {
                entity.destroy();
                this.spawnExplosionEffect({
                    color: 0xc728a7,
                    distance: 32,
                    duration: 700,
                    particleCount: 8,
                    size: { min: 5, max: 8 },
                    x: entity.x,
                    y: entity.y,
                });
                delete this.entityList[entity.entityId];
            }
        }
    }

    /**
     *  
     * @param {PlayerNode} playerNode - any node-like stuff owned by a player. Can start from any node or the root
     * @param {number} layer - holder to count how many layers down the tree. Start by calling with value `0`.
     * @param {Node[] | null} allNodes - cache of the array version of node list. Start by calling with value `null`.
     */
    traverseNodes(
        playerNode: PlayerNode,
        layer: number,
        allNodes: Node[] | null,
        callback: (playerNode: PlayerNode, layer: number) => void
    ) {
        if (!playerNode) return;
        callback(playerNode, layer);
        if (!allNodes) {
            allNodes = Object.values(this.entityList)
                .filter((n): n is Node => n instanceof Node);
        }

        let childrenNodes: Node[] = allNodes
            .filter(n => n.parentNodeId == playerNode.entityId);
        if (!childrenNodes) return;

        for (const child of childrenNodes) {
            this.traverseNodes(child, layer + 1, allNodes, callback);
        }
    }


    addToList(
        gameObject: (GameObjects.Container & { uniqueID: number }),
        list: (GameObjects.Container & { uniqueID: number })[]
    ) {
        list.push(gameObject);
        // this.instancesByID[gameObject.uniqueID] = gameObject;
        gameObject.on(Phaser.GameObjects.Events.DESTROY, () => {
            list.splice(list.indexOf(gameObject), 1);
            // delete this.instancesByID[gameObject.uniqueID];
        });
    }



    getPhysicsSystem() {
        return (this.registry.get('physicsSystem') as PhysicsSystem);
    }
}
