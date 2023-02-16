import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World, XY } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { MainScene } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { lerpRadians, randomInUnitDisc } from '../../utils/utils';


const log = Debug('shroom-io:BulletEffect:log');
// const warn = Debug('shroom-io:BulletEffect:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

export type BulletParams = {
    fromX: number;
    fromY: number;
    fromHeight: number;
    toX: number;
    toY: number;
    toHeight: number;
    toWidth: number;
    duration: number;
    color: number;
    size: { min: number, max: number };
}

export class BulletEffect extends Phaser.GameObjects.Container {
    // entity
    scene: MainScene;


    sprites: Image[] = [];

    // debug
    _debugShowEntityId = false;


    constructor(scene: MainScene, params: BulletParams) {
        super(scene, 0, 0, []);
        this.setName('BulletEffect');
        this.createSprite(params);
    }
    createSprite(params: BulletParams) {
        const {
            duration, size, color,
            fromX, fromY, fromHeight,
            toX, toY, toHeight, toWidth
        } = params;

        const particleCount = 3;
        this.sprites = [...Array(particleCount)]
            .map((_, i) => this.scene.make.image({
                x: fromX,
                y: fromY - fromHeight,
                key: '2x2',
            }, true))
            ;
        this.add(this.sprites);
        this.setDepth(fromY);

        for (const [index, sprite] of this.sprites.entries()) {
            const scale = Math.random() * (size.max - size.min) + size.min;
            const angle = Math.random() * 360; // in degrees
            const endAngle = (Math.random() * 2 - 1) * 360 * 3; // in degrees

            sprite
                .setScale(scale)
                .setAlpha(0)
                .setAngle(angle)
                .setTint(color);


            this.scene.add.tween({
                targets: sprite,
                alpha: 1,
                duration: 100,
                delay: index * 150,
            });
            this.scene.add.tween({
                targets: sprite,
                angle: endAngle,
                duration,
                delay: index * 150,
            });
            this.scene.add.tween({
                targets: sprite,
                x: toX + (Math.random() * 2 - 1) * toWidth,
                y: toY - toHeight + (Math.random() * 2 - 1) * toWidth,
                duration,
                ease: Phaser.Math.Easing.Quadratic.In,
                delay: index * 150,
            })
                .on(Phaser.Tweens.Events.TWEEN_COMPLETE, () => {
                    sprite.setVisible(false);
                    if (index >= particleCount - 1) this.destroy();
                })
        }
    }
}
