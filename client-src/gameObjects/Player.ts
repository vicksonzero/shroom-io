import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World, XY } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { MainScene } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { IPlayerState } from '../../model/Player';
import { getPhysicsDefinitions } from '../../model/Player';
import { hueToColor, lerpRadians } from '../../utils/utils';
import { nodeSprites, NodeType } from '../../model/Node';
import { HpBar } from './HpBar';


const log = Debug('shroom-io:Player:log');
// const warn = Debug('shroom-io:Player:warn');
// warn.log = console.warn.bind(console);

// phaser Display Objects
type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

// phaser input
type EventControl = Phaser.Types.Input.EventData;
type Pointer = Phaser.Input.Pointer;

export class Player extends Phaser.GameObjects.Container {
    // entity
    scene: MainScene;
    uniqueID: number;
    entityId: number;

    // player info
    tint: number;
    isControlling: boolean;
    r: number; // radius
    nextCanShoot: number = 0;

    mineralAmount = 0;
    ammoAmount = 0;

    nodeType: NodeType = 'root';
    hue: number;
    hp = 100;
    maxHp = 100;

    // sprites
    debugText?: Text;
    nameTag: Text;
    diceCountIcon: Image;
    diceCountLabel: Text;
    bodySprite: Image;
    edgeGraphics: Graphics;
    baseGraphics: Graphics;
    hpBar: HpBar;

    fixtureDef?: b2FixtureDef;
    bodyDef?: b2BodyDef;
    b2Body?: b2Body;

    // debug
    _debugShowEntityId = false;

    syncData = {
        dt: 0,
        x: 0, y: 0,
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
            this.edgeGraphics = this.scene.make.graphics({
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
        this.bodySprite
            .setScale(scale)
            .setOrigin(...origin)
            .setTint(this.tint);

        this.nameTag.setOrigin(0.5, 1);
    }

    init(state: IPlayerState): this {
        const { eid: entityId, x, y, r, name, hue, nextCanShoot, isHuman, isCtrl: isControlling } = state;
        this.entityId = entityId;
        // console.log(`init ${name} (${x}, ${y})`);

        this.setPosition(x, y);
        this.r = r;
        this.hue = hue;
        this.hpBar.setPosition(0, 16);
        this.hpBar.init(this.hp, this.maxHp);
        if (hue) {
            console.log('hue', hue);
            this.tint = hueToColor(hue, 0.5, 0.7);
            this.bodySprite.setTint(this.tint);
            this.edgeGraphics.lineStyle(1, this.tint);
        }

        this.isControlling = (isControlling == null ? this.isControlling : isControlling);
        this.setName(`Player ${name} (${this.entityId}) ${this.isControlling ? '(Me)' : ''}`);

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

    applyState(state: IPlayerState, dt: number, isSmooth = true) {
        const {
            x, y,
            r,
            name, hue,
            isHuman, isCtrl,
            nextCanShoot,
            mAmt: mineralAmount,
            aAmt: ammoAmount,
            hp, maxHp,
        } = state;


        this.mineralAmount = mineralAmount;
        this.ammoAmount = ammoAmount;
        this.hue = hue;
        this.hp = hp;
        this.maxHp = maxHp;
        this.hpBar.init(this.hp, this.maxHp);

        this.syncData = {
            dt,
            x, y,
        };

        if (!isSmooth) {
            this.x = x;
            this.y = y;

        } else {
            this.setPosition(
                this.x,
                this.y,
            ); // TODO: lerp instead of set
        }

        if (hue) {
            this.tint = hueToColor(hue, 0.5, 0.7);
            this.bodySprite.setTint(this.tint);
            this.edgeGraphics.lineStyle(1, this.tint);

            const baseTint = hueToColor((hue + 30) % 360, 0.15, 0.8);
            this.baseGraphics.clear();
            this.baseGraphics.fillStyle(baseTint, 0.8);
            this.baseGraphics.fillEllipse(0, 0, 20 * 2, 20 * 2 * 0.7);
        }

        this.isControlling = (isCtrl == null ? this.isControlling : isCtrl);
        this.setName(name);

        if (this.isControlling) {
            const { key, scale, origin } = nodeSprites['root'];
            this.bodySprite
                .setTexture(key)
                .setScale(scale)
                .setOrigin(...origin)
        }

        const materialStr = `${this.mineralAmount}/${this.ammoAmount}`;
        const entityIdStr = this._debugShowEntityId ? ` (${this.entityId})` : ``;
        this.nameTag.setText(`${name} (${materialStr}) ${entityIdStr}`);

        // console.log(diceColors);



        // this.debugText?.setText(this.isControlling
        //     ? `(${x.toFixed(1)}, ${y.toFixed(1)})`
        //     : ''
        // );
    }

    addEdge(fromNode: XY, toNode: XY) {
        // TODO: store the edge list and prepare to remove them

        this.edgeGraphics.lineBetween(
            fromNode.x - this.x, fromNode.y - this.y,
            toNode.x - this.x, toNode.y - this.y);
    }
}
