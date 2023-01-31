import { b2FixtureDef, b2CircleShape, b2BodyDef, b2BodyType } from "@flyover/box2d";
import { collisionCategory } from "../model/collisionCategory";

export type INodeState = {
    entityId: number,
    x: number,
    y: number,
    r: number,

    playerEntityId: number,
    parentNodeId: number,

    mineralAmount: number,
    ammoAmount: number,
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