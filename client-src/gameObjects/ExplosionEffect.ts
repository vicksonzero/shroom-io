import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World, XY } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { MainScene } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { lerpRadians, randomInUnitDisc } from '../../utils/utils';


const log = Debug('shroom-io:ExplosionEffect:log');
// const warn = Debug('shroom-io:ExplosionEffect:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

export type ParticleParams = {
    particleCount: number;
    distance: number;
    duration: number;
    size: { min: number, max: number },
    color: number,
    x: number,
    y: number,
}

export class ExplosionEffect extends Phaser.GameObjects.Container {
    // entity
    scene: MainScene;


    sprites: Image[] = [];

    // debug
    _debugShowEntityId = false;


    constructor(scene: MainScene, params: ParticleParams) {
        super(scene, 0, 0, []);
        this.setName('explosionEffect');
        this.createSprite(params);
    }
    createSprite(params: ParticleParams) {
        const { duration, particleCount = 6, distance, size, color, x, y } = params;

        this.sprites = [...Array(particleCount)]
            .map(_ => this.scene.make.image({
                x, y,
                key: '2x2',
            }, true))
            ;
        this.add(this.sprites);

        for (const sprite of this.sprites) {
            const scale = Math.random() * (size.max - size.min) + size.min;
            const dir = Math.random() * 2 * Math.PI;
            const rotation = Math.random() * Math.PI * 2 - Math.PI;

            sprite
                .setScale(scale)
                .setTint(color);

            this.scene.add.tween({
                targets: sprite,
                x: x + Math.cos(dir) * distance,
                y: y + Math.sin(dir) * distance,
                angle: rotation,
                alpha: 0,
                duration,
            })
                .on(Phaser.Tweens.Events.TWEEN_COMPLETE, () => {
                    this.destroy();
                })
        }
    }
}
