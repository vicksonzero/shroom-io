import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { MainScene } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { IPacketState } from '../../model/Packet';
import { lerpRadians, randomInUnitDisc } from '../../utils/utils';


const log = Debug('shroom-io:PacketEffect:log');
// const warn = Debug('shroom-io:PacketEffect:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

export class PacketEffect extends Phaser.GameObjects.Container {
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

    init(state: IPacketState, fromEntity: Container, toEntity: Container): this {
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
            toEntity.x + random.x * 15,
            toEntity.y + random.y * 15,
        );


        this.baseGraphics.clear();
        this.baseGraphics.lineStyle(5, 0xc728a7);

        const xx = fromEntity.x - toEntity.x;
        const yy = fromEntity.y - toEntity.y;
        this.baseGraphics.lineBetween(
            0, 0,
            xx, yy
        );

        this.setName(`Resource (${mineralAmount})`);

        return this;
    }

    fixedUpdate(time: number, dt: number) {

        const fromEntity = this.scene.entityList[this.fromEntityId];
        const toEntity = this.scene.entityList[this.toEntityId];

        const lineThickness = 5 * (this.toFixedTime - this.scene.fixedElapsedTime) / (this.toFixedTime - this.fromFixedTime);
        this.baseGraphics.clear();
        if (lineThickness < 0) {
            this.setVisible(false);
            return;
        }
        this.baseGraphics.lineStyle(lineThickness, 0xc728a7, 0.5);

        const xx = fromEntity.x - this.x;
        const yy = fromEntity.y - this.y;
        this.baseGraphics.lineBetween(
            0, 0,
            xx, yy
        );

        this.nameTag.setText(``);
        // this.debugText?.setText(this.isControlling ? `(${x.toFixed(1)}, ${y.toFixed(1)})` : '');
        // console.log(smoothX, );
    }

    lateUpdate() {
        // this.hpBar.setPosition(this.x, this.y);
    }

}
