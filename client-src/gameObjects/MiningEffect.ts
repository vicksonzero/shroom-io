import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World, XY } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { MainScene } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { IMiningState } from '../../model/Mining';
import { lerpRadians, randomInUnitDisc } from '../../utils/utils';


const log = Debug('shroom-io:MiningEffect:log');
// const warn = Debug('shroom-io:MiningEffect:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

export class MiningEffect extends Phaser.GameObjects.Container {
    // entity
    scene: MainScene;
    uniqueID: number;
    entityId: number;

    fromEntityId: number;
    toEntityId: number;

    mineralAmount: number;
    ammoAmount: number;

    fromFixedTime: number;
    toFixedTime: number;


    // player info
    tint: number;
    isControlling: boolean;

    // sprites
    debugText?: Text;
    nameTag: Text;
    diceCountIcon: Image;
    diceCountLabel: Text;
    bodySprites: Image[];
    baseGraphics: Graphics;

    fromPos: XY;
    toPos: XY; // is always zero

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
            this.baseGraphics = this.scene.make.graphics({
                x: 0, y: 0
            }, false),
            this.nameTag = this.scene.make.text({
                x: 0, y: 32,
                text: '',
                style: { align: 'center', color: '#000000' },
            }),
            // this.debugText = this.scene.make.text({
            //     x: 32, y: -32,
            //     text: '',
            //     style: { align: 'left', color: '#000000' },
            // }),
        ]);

        this.nameTag.setOrigin(0.5, 1);
    }

    init(state: IMiningState, fromEntity: Container, toEntity: Container): this {
        const {
            entityId,
            fromEntityId,
            toEntityId,

            mineralAmount,
            ammoAmount,

            fromFixedTime,
            timeLength,
        } = state;
        this.entityId = entityId;

        this.fromEntityId = fromEntityId;
        this.toEntityId = toEntityId;

        this.mineralAmount = mineralAmount;
        this.ammoAmount = ammoAmount;

        this.fromFixedTime = this.scene.fixedElapsedTime;
        this.toFixedTime = this.scene.fixedElapsedTime + timeLength;
        // console.log(`init ${name} (${x}, ${y})`);

        const random = randomInUnitDisc();
        this.setPosition(
            toEntity.x + random.x * 8,
            toEntity.y + random.y * 8 - 8,
        );

        this.fromPos = {
            x: fromEntity.x - toEntity.x,
            y: fromEntity.y - toEntity.y,
        };

        const tween = this.scene.tweens.addCounter({
            from: 5,
            to: 0,
            duration: timeLength,
            paused: false,
        }).on(Phaser.Tweens.Events.TWEEN_UPDATE, () => {


            this.baseGraphics.clear();
            this.baseGraphics.lineStyle(tween.getValue(), 0xc728a7);

            this.baseGraphics.lineBetween(
                0, 0,
                this.fromPos.x, this.fromPos.y
            );
        }).on(Phaser.Tweens.Events.TWEEN_COMPLETE, () => {
            this.destroy();
        });

        this.setName(`Resource (${mineralAmount})`);

        return this;
    }

    fixedUpdate(time: number, dt: number) {


        // this.nameTag.setText(``);
    }

    lateUpdate() {
        // this.hpBar.setPosition(this.x, this.y);
    }

}
