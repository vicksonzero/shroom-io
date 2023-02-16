import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World, XY } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { MainScene } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { lerpRadians, randomInUnitDisc } from '../../utils/utils';


const log = Debug('shroom-io:ToastMessage:log');
// const warn = Debug('shroom-io:ToastMessage:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

export type ToastParams = {
    x: number;
    y: number;
    height: number;
    text: string;
    color: number;
    duration: number;
    entryDuration?: number;
}

export class ToastMessage extends Phaser.GameObjects.Container {
    // entity
    scene: MainScene;


    text: Text;

    // debug
    _debugShowEntityId = false;


    constructor(scene: MainScene, params: ToastParams) {
        super(scene, 0, 0, []);
        this.setName('ToastMessage');
        this.createSprite(params);
    }
    createSprite(params: ToastParams) {
        const { x, y, height, text, color, duration, entryDuration } = params;

        this.setPosition(x, y);
        this.text = this.scene.make.text({
            x: 0, y: 0,
            text,
            style: { color: `#${color.toString(16)}` }
        }, false)
        this.add(this.text);

        this.scene.add.tween({
            targets: this.text,
            y: -height,
            duration,
            ease: Phaser.Math.Easing.Quadratic.Out,
        })
            .on(Phaser.Tweens.Events.TWEEN_COMPLETE, () => {
                this.destroy();
            })
            ;
    }
}
