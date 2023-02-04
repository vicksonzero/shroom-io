import { b2FixtureDef, b2CircleShape, b2BodyDef, b2BodyType } from "@flyover/box2d";
import { collisionCategory } from "../model/collisionCategory";

export type NodeType = 'root' | 'bud' | 'converter' | 'shooter' | 'swarm';
export type INodeState = {
    eid: number,
    x: number,
    y: number,
    r: number,

    plEid: number, // playerEntityId
    parEid: number, // parentNodeId
    birthday: number,

    mAmt: number, // mineralAmount
    aAmt: number, // ammoAmount

    nodeType: NodeType;
    hp: 100;
    maxHp: 100;
};

export const nodeSprites: { [x in NodeType]: { key: string, scale: number, origin: [number, number], baseIndex: number, teamIndex: number } } = {
    'root': {
        key: 'structure_house',
        baseIndex: 0,
        teamIndex: 0,
        scale: 0.6,
        origin: [0.5, 0.7],
    },
    'bud': {
        key: 'mushrooms',
        baseIndex: 0,
        teamIndex: 4,
        scale: 0.5,
        origin: [0.5, 0.6],
    },
    'converter': {
        key: 'mushrooms',
        baseIndex: 3,
        teamIndex: 7,
        scale: 1,
        origin: [0.5, 0.9],
    },
    'shooter': {
        key: 'mushrooms',
        baseIndex: 1,
        teamIndex: 5,
        scale: 1,
        origin: [0.5, 0.95],
    },
    'swarm': {
        key: 'mushrooms',
        baseIndex: 2,
        teamIndex: 6,
        scale: 1,
        origin: [0.6, 0.95],
    },
};

export const getPhysicsDefinitions = (radius: number) => {

    // body shape definition. can have many
    const fixtureDef = new b2FixtureDef();

    // doesn't participate in collisions? need to check
    fixtureDef.isSensor = false;

    // mass per volume
    fixtureDef.density = 1;

    // friction against other solids?
    fixtureDef.friction = 1.1;

    // bounciness
    fixtureDef.restitution = 0.2;

    fixtureDef.shape = new b2CircleShape();

    // fixture shape
    fixtureDef.shape.m_radius = radius;

    // I am a...
    fixtureDef.filter.categoryBits = collisionCategory.PLAYER;

    // I can collide with...
    fixtureDef.filter.maskBits = collisionCategory.WORLD | collisionCategory.PLAYER;


    // body def defines the body (well...)
    const bodyDef = new b2BodyDef();

    // dynamic(moving), static(walls) or kinematic(moving walls)
    bodyDef.type = b2BodyType.b2_staticBody;

    // sleeping disables physics when not moving.
    // troublesome to wake it back though
    bodyDef.allowSleep = false;

    return {
        fixtureDef,
        bodyDef,
    };
}