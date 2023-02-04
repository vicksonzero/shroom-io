import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { MainScene } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { getPhysicsDefinitions, INodeState, nodeSprites, NodeType } from '../../model/Node';
import { lerpRadians } from '../../utils/utils';
import { Player } from './Player';
import { HpBar } from './HpBar';


const log = Debug('shroom-io:Node:log');
// const warn = Debug('shroom-io:Node:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

const HSVToRGB = Phaser.Display.Color.HSVToRGB;

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

    // sprites
    debugText?: Text;
    nameTag: Text;
    diceCountIcon: Image;
    diceCountLabel: Text;
    bodySprite: Image;
    baseGraphics: Graphics;
    hpBar: HpBar;

    fixtureDef?: b2FixtureDef;
    bodyDef?: b2BodyDef;
    b2Body?: b2Body;

    nodeType: NodeType;
    hp: 100;
    maxHp: 100;

    // debug
    _debugShowEntityId = false;

    syncData = {
        x: 0, y: 0,
        nodeType: '' as NodeType,
    };

    constructor(scene: MainScene) {
        super(scene, 0, 0, []);
        this.uniqueID = getUniqueID();
        this.setName('player');
        this.createSprite();
    }
    createSprite() {
        const { key, scale, origin } = nodeSprites['bud'];
        this.add([
            this.baseGraphics = this.scene.make.graphics({
                x: 0, y: 0
            }, false),
            this.bodySprite = this.scene.make.image({
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
        this.bodySprite.setTint(this.tint);
        this.bodySprite.setScale(scale);
        this.bodySprite.setOrigin(...origin);

        this.nameTag.setOrigin(0.5, 1);
    }

    init(state: INodeState): this {
        const { eid: entityId, x, y, r, parEid: parentNodeId, plEid: playerEntityId, birthday } = state;
        this.entityId = entityId;
        // console.log(`init ${name} (${x}, ${y})`);

        this.playerEntityId = playerEntityId;
        this.parentNodeId = parentNodeId;
        this.birthday = birthday;
        this.setPosition(x, y);
        this.r = r;
        this.hpBar.init(this.hp, this.maxHp);

        const isControlling = false;
        const player = this.scene.entityList[this.playerEntityId] as Player;
        if (player) {
            this.tint = (HSVToRGB(player.hue / 360, 0.5, 0.5, new Phaser.Display.Color()) as Phaser.Display.Color).color;
            this.bodySprite.setTint(this.tint);

            const baseTint = (HSVToRGB(player.hue / 360, 0.3, 0.7, new Phaser.Display.Color()) as Phaser.Display.Color).color;
            this.baseGraphics.clear();
            this.baseGraphics.fillStyle(baseTint, 0.8);
            this.baseGraphics.fillEllipse(0, 0, 20 * 2, 20 * 2 * 0.7);
        }

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
            parEid,
            nodeType,
            hp,
            maxHp,
        } = state;


        this.entityId = entityId;
        this.playerEntityId = playerEntityId;
        this.parentNodeId = parEid;

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
        }

        if (nodeType != this.syncData.nodeType) {
            const { key, scale, origin } = nodeSprites[nodeType];
            this.bodySprite.setTexture(key);
            this.bodySprite.setScale(scale);
            this.bodySprite.setOrigin(...origin);
        }

        this.nameTag.setText(this._debugShowEntityId ? `(${this.entityId})` : '');
        // this.nameTag.setText(this.name);

        // console.log(diceColors);


        this.syncData = {
            x, y,
            nodeType,
        };


        // this.debugText?.setText(this.isControlling
        //     ? `(${x.toFixed(1)}, ${y.toFixed(1)})`
        //     : ''
        // );
    }
}
