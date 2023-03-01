import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2Fixture, b2FixtureDef, b2World } from '@flyover/box2d';
import * as Debug from 'debug';
import { PIXEL_TO_METER, DEGREE_TO_RADIAN, SMOOTH_CAP, SMOOTH_FACTOR, RADIAN_TO_DEGREE } from '../constants';
import { IBodyUserData, IFixtureUserData } from '../PhysicsSystem';
import { hueToColor, MainScene, PlayerNode } from '../scenes/MainScene';
import { getUniqueID } from '../../model/UniqueID';
import { config } from '../config/config';
import { getPhysicsDefinitions, INodeState, nodeDefs, NodeType } from '../../model/Node';
import { lerpRadians } from '../../utils/utils';

import {
    BUILD_RADIUS_MAX,
    NODE_RADIUS,
} from '../../model/constants'

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
    nodeType: NodeType;
    playerEntityId: number;
    parentNodeId: number;

    r: number;

    // sprites
    debugText?: Text;
    nameTag: Text;
    baseGraphics: Graphics;
    bodyGraphics: Graphics;
    lineGraphics: Graphics;
    nodeImage: Image;

    constructor(scene: MainScene) {
        super(scene, 0, 0, []);
        this.setName('NodeBuilder');
        this.createSprite();
    }
    createSprite() {
        this.add([
            this.lineGraphics = this.scene.make.graphics({
                x: 0, y: 0,
            }),
            this.baseGraphics = this.scene.make.graphics({
                x: 0, y: 0
            }, false),
            this.nodeImage = this.scene.make.image({
                x: 0, y: 0,
                key: 'pawn',
            }, false),
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

        this.baseGraphics.setAlpha(0.7);
        this.nodeImage.setScale(0.5);

        this.nameTag.setOrigin(0.5, 1);
        this.nameTag.setText('NodeBuilder');
    }

    init(x: number, y: number, r: number, playerEntityId: number, parentNodeId: number, nodeType: NodeType): this {
        // console.log(`init ${name} (${x}, ${y})`);

        this.setPosition(x, y);
        this.r = r;
        this.playerEntityId = playerEntityId;
        this.parentNodeId = parentNodeId;
        this.nodeType = nodeType;

        const isControlling = false;

        this.setName(`NodeBuilder ${playerEntityId} ${isControlling ? '(Me)' : ''}`);



        const { key, scale, origin, baseIndex } = nodeDefs[this.nodeType];
        this.nodeImage
            .setTexture(key, baseIndex)
            .setScale(scale)
            .setOrigin(...origin)

        const color = 0xff0000;
        this.bodyGraphics.clear();
        this.bodyGraphics.lineStyle(2, color, 1);
        this.bodyGraphics.strokeCircle(0, 0, this.r * 1.5);

        const parentNode = this.scene.entityList[this.parentNodeId] as PlayerNode;
        if (parentNode) {
            this.lineGraphics.lineStyle(5, parentNode.tint);
            this.nodeImage.setTint(parentNode.tint);

            const baseTint = hueToColor((parentNode.hue + 30) % 360, 0.15, 0.8);
            this.baseGraphics.clear();
            this.baseGraphics.fillStyle(baseTint, 0.8);
            this.baseGraphics.fillEllipse(0, 0, NODE_RADIUS * 2, NODE_RADIUS * 2);

        }
        return this;
    }

    update(time: number, dt: number) {
        const parentNode = this.scene.entityList[this.parentNodeId];
        if (!parentNode) return;


        const pointerPos = this.scene.input.activePointer.position;
        const camera = this.scene.mainCamera;

        let xx = pointerPos.x + camera.scrollX;
        let yy = pointerPos.y + camera.scrollY;


        let dx = parentNode.x - xx;
        let dy = parentNode.y - yy;
        let distanceToParentNode = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);

        if (distanceToParentNode > BUILD_RADIUS_MAX) distanceToParentNode = BUILD_RADIUS_MAX;

        dx = distanceToParentNode * Math.cos(angle);
        dy = distanceToParentNode * Math.sin(angle);

        this.setPosition(parentNode.x - dx, parentNode.y - dy);

        const collisions = this.scene.getPhysicsSystem().queryCircle(this.x, this.y, this.r * 2);
        const hasCollision = collisions.length > 0;

        if (hasCollision) {
            this.nodeImage.setAlpha(0.3);
            this.lineGraphics?.clear();
            this.bodyGraphics?.setVisible(false);
        } else {
            this.lineGraphics?.clear()
                .lineStyle(2, parentNode.tint)
                .lineBetween(
                    0, 0,
                    dx, dy
                );
            this.nodeImage.setAlpha(0.7);
            this.baseGraphics.setAlpha(0.7);
            this.bodyGraphics?.setVisible(true);
        }
    }

    fixedUpdate(time: number, dt: number) {


        // this.debugText?.setText(this.isControlling ? `(${x.toFixed(1)}, ${y.toFixed(1)})` : '');
        // console.log(smoothX, );
    }

    lateUpdate() {
        // this.hpBar.setPosition(this.x, this.y);
    }

}
