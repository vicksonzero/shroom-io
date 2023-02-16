import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE, NODE_BASE_DEPTH, WORLD_HEIGHT } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { MainScene, hueToColor } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { getPhysicsDefinitions, INodeState, nodeSprites, NodeType } from '../../model/Node';
import { lerpRadians } from '../../utils/utils';
import { Player } from './Player';
import { HpBar } from './HpBar';
import { BUILD_RADIUS_MIN } from '../../model/constants';


const log = Debug('shroom-io:Node:log');
// const warn = Debug('shroom-io:Node:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

export class Node extends Phaser.GameObjects.Container {
    // entity
    scene: MainScene;
    uniqueID: number;
    entityId: number;
    playerEntityId: number;
    parentNodeId: number;
    birthday: number; // TODO: need to use birthday better

    // player info
    tint: number;
    isControlling: boolean;
    r: number; // radius
    nextCanShoot: number = 0;
    nextCanMine = 0;
    targetId = -1;

    // sprites
    debugText?: Text;
    nameTag: Text;
    diceCountIcon: Image;
    diceCountLabel: Text;
    bodySprite: Image;
    teamSprite: Image;
    baseGraphics: Graphics;
    hpBar: HpBar;

    fixtureDef?: b2FixtureDef;
    bodyDef?: b2BodyDef;
    b2Body?: b2Body;

    nodeType: NodeType;
    towerHeight: number;
    towerWidth: number;
    hp: 100;
    maxHp: 100;
    hue: number;

    /** 
     * is newest node of the player. currently used to show the name of that player so that the root is hidden
     */
    isNewestNode = false;

    // debug
    _debugShowEntityId = false;

    syncData = {
        x: 0, y: 0,
        nodeType: '' as NodeType,
        playerEntityId: -1,
    };

    constructor(scene: MainScene) {
        super(scene, 0, 0, []);
        this.uniqueID = getUniqueID();
        this.setName('player');
        this.createSprite();
    }
    createSprite() {
        const { key, scale, origin, towerHeight, towerWidth } = nodeSprites['bud'];
        this.add([
            this.baseGraphics = this.scene.make.graphics({
                x: 0, y: 0
            }, false),
            this.bodySprite = this.scene.make.sprite({
                x: 0, y: 0,
                key,
            }, false),
            this.teamSprite = this.scene.make.sprite({
                x: 0, y: 0,
                key,
            }, false),
            this.nameTag = this.scene.make.text({
                x: 0, y: -32,
                text: '',
                style: { align: 'center', color: '#000000' },
            }),
            this.hpBar = new HpBar(this.scene),
            // this.debugText = this.scene.make.text({
            //     x: 32, y: -32,
            //     text: '',
            //     style: { align: 'left', color: '#000000' },
            // }),
        ]);
        this.towerHeight = towerHeight;
        this.towerWidth = towerWidth;
        this.baseGraphics.setDepth(NODE_BASE_DEPTH);
        this.teamSprite.setTint(this.tint);
        this.teamSprite.setScale(scale);
        this.teamSprite.setOrigin(...origin);
        this.bodySprite.setScale(scale);
        this.bodySprite.setOrigin(...origin);
        this.hpBar.setPosition(0, 16);

        this.nameTag.setOrigin(0.5, 1);
        this.nameTag.setDepth(WORLD_HEIGHT);
    }

    init(state: INodeState): this {
        const { eid: entityId, x, y, r, parEid: parentNodeId, plEid: playerEntityId,
            hp, maxHp, nodeType, birthday } = state;
        this.entityId = entityId;
        // console.log(`init ${name} (${x}, ${y})`);

        this.playerEntityId = playerEntityId;
        this.parentNodeId = parentNodeId;
        this.birthday = birthday;
        this.setPosition(x, y);
        this.bodySprite.setDepth(y);
        this.teamSprite.setDepth(y);
        this.r = r;
        this.hpBar.init(this.hp, this.maxHp);
        this.nodeType = nodeType;
        this.hp = hp;
        this.maxHp = maxHp;
        this.hpBar.init(this.hp, this.maxHp);

        const isControlling = false;
        const player = this.scene.entityList[this.playerEntityId] as Player;
        if (player) {
            this.hue = player.hue;
            this.tint = hueToColor(this.hue, 0.5, 0.7);
            this.teamSprite.setTint(this.tint);

            const baseTint = hueToColor((this.hue + 30) % 360, 0.15, 0.8);
            this.baseGraphics.clear();
            this.baseGraphics.fillStyle(baseTint, 0.8);
            this.baseGraphics.fillEllipse(0, 0, BUILD_RADIUS_MIN, BUILD_RADIUS_MIN);
        }

        const {
            key,
            baseIndex, teamIndex,
            scale, origin,
            towerHeight, towerWidth,
        } = nodeSprites[nodeType];

        this.towerHeight = towerHeight;
        this.towerWidth = towerWidth;
        this.bodySprite.setTexture(key, baseIndex);
        this.bodySprite.setScale(scale);
        this.bodySprite.setOrigin(...origin);
        this.teamSprite.setTexture(key, teamIndex);
        this.teamSprite.setScale(scale);
        this.teamSprite.setOrigin(...origin);

        this.syncData.nodeType = nodeType;

        this.setName(`Node ${this.entityId} (of ${playerEntityId}) ${isControlling ? '(Me)' : ''}`);

        return this;
    }

    initPhysics(physicsFinishedCallback?: () => void): this {
        const { fixtureDef, bodyDef } = getPhysicsDefinitions(this.r * PIXEL_TO_METER);

        this.fixtureDef = fixtureDef;

        this.bodyDef = bodyDef;
        bodyDef.userData = {
            label: 'player',
            gameObject: this,
        };

        this.scene.getPhysicsSystem().scheduleCreateBody((world: b2World) => {
            this.b2Body = world.CreateBody(bodyDef);
            this.b2Body.CreateFixture(fixtureDef); // a body can have multiple fixtures
            this.b2Body.SetPositionXY(this.x * PIXEL_TO_METER, this.y * PIXEL_TO_METER);

            // this.on('destroy', () => {
            //     physicsSystem.scheduleDestroyBody(this.b2Body);
            //     this.b2Body.m_userData.gameObject = null;
            // });
            physicsFinishedCallback?.();
        });

        return this;
    }

    destroyPhysics() {
        if (!this.b2Body) return;
        log('destroyPhysics', this.entityId);

        this.scene.getPhysicsSystem().scheduleDestroyBody(this.b2Body);
        this.b2Body.m_userData.gameObject = null;
    }

    fixedUpdate(time: number, dt: number) {
        const {
            x, y,
        } = this.syncData;

        const smoothCap = 1000;// SMOOTH_CAP;
        this.setPosition(
            this.x + Math.max(-smoothCap, this.x),
            this.y + Math.max(-smoothCap, this.y),
        ); // TODO: lerp instead of set
        this.bodySprite.setDepth(y);
        this.teamSprite.setDepth(y);


        // this.debugText?.setText(this.isControlling ? `(${x.toFixed(1)}, ${y.toFixed(1)})` : '');
        // console.log(smoothX, );
    }

    lateUpdate() {
        // this.hpBar.setPosition(this.x, this.y);
    }

    applyState(state: INodeState, dt: number, isSmooth = true) {
        const {
            x, y,
            eid: entityId,
            plEid: playerEntityId,
            parEid: parentNodeId,
            nodeType,
            hp,
            maxHp,
        } = state;


        this.entityId = entityId;
        this.playerEntityId = playerEntityId;
        this.parentNodeId = parentNodeId;

        this.nodeType = nodeType;
        this.hp = hp;
        this.maxHp = maxHp;
        this.hpBar.init(this.hp, this.maxHp);

        if (!isSmooth) {
            this.x = x;
            this.y = y;

        } else {
            this.setPosition(
                this.x,
                this.y,
            ); // TODO: lerp instead of set
            this.bodySprite.setDepth(y);
            this.teamSprite.setDepth(y);
        }

        if (nodeType != this.syncData.nodeType) {
            const {
                key,
                baseIndex, teamIndex,
                scale, origin,
                towerHeight, towerWidth,
            } = nodeSprites[nodeType];

            this.towerHeight = towerHeight;
            this.towerWidth = towerWidth;
            this.bodySprite.setTexture(key, baseIndex);
            this.bodySprite.setScale(scale);
            this.bodySprite.setOrigin(...origin);
            this.teamSprite.setTexture(key, teamIndex);
            this.teamSprite.setScale(scale);
            this.teamSprite.setOrigin(...origin);
            this.scene.spawnExplosionEffect({
                color: hueToColor(this.hue, 0.5, 0.5),
                distance: 32,
                duration: 700,
                particleCount: 6,
                size: { min: 3, max: 6 },
                x: this.x,
                y: this.y,
            });
        }

        if (playerEntityId != this.syncData.playerEntityId) {
            this.updateBaseGraphics();
        }

        const debugString = this._debugShowEntityId ? ` (n-${this.entityId} of p-${this.playerEntityId})` : '';
        if (this.isNewestNode) {
            const player = this.scene.entityList[this.playerEntityId];
            this.nameTag.setText(player?.name + debugString);
        } else {
            this.nameTag.setText(debugString);
        }
        // this.nameTag.setText(this.name);

        // console.log(diceColors);


        this.syncData = {
            x, y,
            nodeType,
            playerEntityId,
        };


        // this.debugText?.setText(this.isControlling
        //     ? `(${x.toFixed(1)}, ${y.toFixed(1)})`
        //     : ''
        // );
    }

    updateBaseGraphics() {
        const player = this.scene.entityList[this.playerEntityId] as Player;
        const color = player
            ? hueToColor(player.hue, 0.5, 0.7)
            : 0xcccccc;

        this.tint = color;
        this.teamSprite.setTint(this.tint);

        const baseTint = player
            ? hueToColor((player.hue + 30) % 360, 0.15, 0.8)
            : 0x999999;
        this.baseGraphics.clear();
        this.baseGraphics.fillStyle(baseTint, 0.8);
        this.baseGraphics.fillEllipse(0, 0, BUILD_RADIUS_MIN, BUILD_RADIUS_MIN);
    }
}
