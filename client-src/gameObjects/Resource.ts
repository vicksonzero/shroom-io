import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { MainScene } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { getPhysicsDefinitions, IResourceState } from '../../model/Resource';
import { lerpRadians } from '../../utils/utils';


const log = Debug('shroom-io:Resource:log');
// const warn = Debug('shroom-io:Resource:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

export class Resource extends Phaser.GameObjects.Container {
    // entity
    scene: MainScene;
    uniqueID: number;
    entityId: number;

    amount: number;

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
    bodySprites: Image[];
    baseGraphics: Graphics;

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
        this.bodySprites = [
            this.scene.make.image({ // 0
                x: 0, y: 0,
                key: 'mineral1',
            }, false),
            this.scene.make.image({ // 1
                x: -10, y: -3,
                key: 'mineral1',
            }, false).setAngle(-14),
            this.scene.make.image({ // 2
                x: 5, y: -7,
                key: 'mineral1',
            }, false).setAngle(10),
            this.scene.make.image({ // 3
                x: 10, y: -2,
                key: 'mineral1',
            }, false).setAngle(20),
            this.scene.make.image({ // 4
                x: -2, y: -15,
                key: 'mineral1',
            }, false).setAngle(-3),
        ];
        for (const sprite of this.bodySprites) {
            // sprite.setTint(this.tint);
            sprite.setScale(1);
        }

        this.add([
            this.baseGraphics = this.scene.make.graphics({
                x: 0, y: 0
            }, false),
            this.bodySprites[4],
            this.bodySprites[2],
            this.bodySprites[3],
            this.bodySprites[1],
            this.bodySprites[0],
            this.nameTag = this.scene.make.text({
                x: 0, y: -32,
                text: '',
                style: {
                    align: 'center', color: '#000000',
                    stroke: '#dddddd', strokeThickness: 4,
                },
            }),
            // this.debugText = this.scene.make.text({
            //     x: 32, y: -32,
            //     text: '',
            //     style: { align: 'left', color: '#000000' },
            // }),
        ]);

        this.nameTag.setOrigin(0.5, 1);
    }

    init(state: IResourceState): this {
        const { eid: entityId, x, y, r, mAmt: mineralAmount } = state;
        this.entityId = entityId;
        // console.log(`init ${name} (${x}, ${y})`);

        this.setPosition(x, y);
        this.r = r;

        this.baseGraphics.clear();
        this.baseGraphics.fillStyle(0xc728a7, 0.8);
        this.baseGraphics.fillEllipse(0, 0, this.r * 2, this.r * 2 * 0.7);

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

        this.setPosition(x, y,);


        // this.debugText?.setText(this.isControlling ? `(${x.toFixed(1)}, ${y.toFixed(1)})` : '');
        // console.log(smoothX, );
    }

    lateUpdate() {
        // this.hpBar.setPosition(this.x, this.y);
    }

    applyState(state: IResourceState, dt: number, isSmooth = true) {
        const {
            x, y,
            eid: entityId,
            mAmt: mineralAmount,
        } = state;

        this.syncData = {
            x, y,
        };

        this.entityId = entityId;
        this.amount = mineralAmount;

        this.bodySprites[0].setVisible(this.amount > 0);
        this.bodySprites[1].setVisible(this.amount > 100);
        this.bodySprites[2].setVisible(this.amount > 250);
        this.bodySprites[3].setVisible(this.amount > 500);
        this.bodySprites[4].setVisible(this.amount > 1000);

        this.setPosition(
            x,
            y,
        );

        this.nameTag.setText(`Resource\n(${mineralAmount})`);

        // console.log(diceColors);



        // this.debugText?.setText(this.isControlling
        //     ? `(${x.toFixed(1)}, ${y.toFixed(1)})`
        //     : ''
        // );
    }
}
