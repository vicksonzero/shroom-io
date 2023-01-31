import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { MainScene } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { getPhysicsDefinitions, INodeState } from '../../model/Node';
import { lerpRadians } from '../../utils/utils';


const log = Debug('shroom-io:NodeBuilder:log');
// const warn = Debug('shroom-io:NodeBuilder:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

export class NodeBuilder extends Phaser.GameObjects.Container {
    // entity
    scene: MainScene;
    playerEntityId: number;
    parentNodeId: number;

    r: number;

    // sprites
    debugText?: Text;
    nameTag: Text;
    bodyGraphics: Graphics;

    constructor(scene: MainScene) {
        super(scene, 0, 0, []);
        this.setName('NodeBuilder');
        this.createSprite();
    }
    createSprite() {
        this.add([
            this.bodyGraphics = this.scene.make.graphics({
                x: 0, y: 0,
            }),
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

        this.nameTag.setOrigin(0.5, 1);
        this.nameTag.setText('NodeBuilder');
    }

    init(x: number, y: number, r: number, playerEntityId: number, parentNodeId: number): this {
        // console.log(`init ${name} (${x}, ${y})`);

        this.setPosition(x, y);
        this.r = r;
        this.playerEntityId = playerEntityId;
        this.parentNodeId = parentNodeId;

        const isControlling = false;

        this.setName(`NodeBuilder ${playerEntityId} ${isControlling ? '(Me)' : ''}`);


        const color = 0xff0000;
        this.bodyGraphics.clear();
        this.bodyGraphics.lineStyle(2, color, 1);
        this.bodyGraphics.strokeCircle(0, 0, this.r);
        return this;
    }

    update(time: number, dt: number) {
        const pos = this.scene.input.activePointer.position;
        const camera = this.scene.mainCamera;
        this.setPosition(
            pos.x + camera.scrollX,
            pos.y + camera.scrollY
        );

    }

    fixedUpdate(time: number, dt: number) {


        // this.debugText?.setText(this.isControlling ? `(${x.toFixed(1)}, ${y.toFixed(1)})` : '');
        // console.log(smoothX, );
    }

    lateUpdate() {
        // this.hpBar.setPosition(this.x, this.y);
    }

}
