import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { MainScene } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { getPhysicsDefinitions, INodeState } from '../../model/Node';
import { lerpRadians } from '../../utils/utils';


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
    playerId: number;
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

    fixtureDef?: b2FixtureDef;
    bodyDef?: b2BodyDef;
    b2Body?: b2Body;

    // debug
    _debugShowEntityId = false;

    syncData = {
        x: 0, y: 0,
    };

    constructor(scene: MainScene) {
        super(scene, 0, 0, []);
        this.uniqueID = getUniqueID();
        this.setName('player');
        this.createSprite();
    }
    createSprite() {
        this.add([
            this.bodySprite = this.scene.make.image({
                x: 0, y: 0,
                key: 'hexagon',
            }, false),
            this.nameTag = this.scene.make.text({
                x: 0, y: -32,
                text: '',
                style: { align: 'center', color: '#000000' },
            }),
            // this.debugText = this.scene.make.text({
            //     x: 32, y: -32,
            //     text: '',
            //     style: { align: 'left', color: '#000000' },
            // }),
        ]);
        this.bodySprite.setTint(this.tint);
        this.bodySprite.setScale(0.6);

        this.nameTag.setOrigin(0.5, 1);
    }

    init(state: INodeState): this {
        const { eid: entityId, x, y, r, parEid, plEid: playerEntityId, birthday } = state;
        this.entityId = entityId;
        // console.log(`init ${name} (${x}, ${y})`);

        this.birthday = birthday;
        this.setPosition(x, y);
        this.r = r;

        const isControlling = false;
        const color = 0; // TODO: playerId;
        if (color) {
            this.tint = color;
            this.bodySprite.setTint(this.tint);
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
        } = state;


        this.syncData = {
            x, y,
        };

        this.entityId = entityId;
        this.playerId = playerEntityId;
        this.parentNodeId = parEid;

        if (!isSmooth) {
            this.x = x;
            this.y = y;

        } else {
            this.setPosition(
                this.x,
                this.y,
            ); // TODO: lerp instead of set
        }

        // this.nameTag.setText(this.name);

        // console.log(diceColors);



        // this.debugText?.setText(this.isControlling
        //     ? `(${x.toFixed(1)}, ${y.toFixed(1)})`
        //     : ''
        // );
    }
}
