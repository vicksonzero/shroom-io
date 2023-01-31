import * as Debug from 'debug';
import { getPhysicsDefinitions, INodeState } from '../model/Node';
import { getUniqueID } from '../model/UniqueID';
import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2FixtureDef, b2Vec2, b2World, XY } from "@flyover/box2d";
import { PIXEL_TO_METER } from "./constants.js";
import { IFixtureUserData, PhysicsSystem } from "./PhysicsSystem.js";
import { IResourceState } from '../model/Resource';

const verbose = Debug('shroom-io:Resource:verbose');
const log = Debug('shroom-io:Resource:log');



export class Resource {
    public entityId: number;
    public socketId = '';
    public nextMoveTick = 0;
    public sync = {
        lastReceived: 0,
        lastUpdated: 0,
    };
    public deleteAfterTick?: number;

    public nextCanShoot = 0;


    public name = 'Resource';
    public color = 0xffffff;
    public isHuman = false;
    public isControlling = false;

    public mineralAmount: number;
    public ammoAmount: number = 0;


    // physics
    public x = 0;
    public y = 0;
    public angle = 0;
    public r = 20;
    public friction = 0;
    public vx = 0;
    public vy = 0;
    public vAngle = 0;

    public fixtureDef?: b2FixtureDef;
    public bodyDef?: b2BodyDef;
    public b2Body?: b2Body;

    // ai
    public targetId: number;
    public aiNextTick: number = Date.now() + 2000;

    constructor() {
        this.entityId = getUniqueID();
    }
    static create(mineralAmount: number) {
        const result = new Resource();
        result.name = `Resource`;
        result.mineralAmount = mineralAmount;

        return result;
    }


    createPhysics(physicsSystem: PhysicsSystem, physicsFinishedCallback?: () => void) {
        const { fixtureDef, bodyDef } = getPhysicsDefinitions(this.r * PIXEL_TO_METER);

        this.fixtureDef = fixtureDef;

        fixtureDef.userData = {
            fixtureLabel: 'node',
        } as IFixtureUserData;

        this.bodyDef = bodyDef;
        bodyDef.userData = {
            label: 'node',
            gameObject: this,
        };


        physicsSystem.scheduleCreateBody((world: b2World) => {
            this.b2Body = world.CreateBody(bodyDef);
            this.b2Body.CreateFixture(fixtureDef); // a body can have multiple fixtures
            this.b2Body.SetPositionXY(this.x * PIXEL_TO_METER, this.y * PIXEL_TO_METER);

            // this.on('destroy', () => {
            //     physicsSystem.scheduleDestroyBody(this.b2Body);
            //     this.b2Body.m_userData.gameObject = null;
            // });
            log('Body created');
            physicsFinishedCallback?.();
        });
    }

    destroyPhysics(physicsSystem: PhysicsSystem) {
        if (!this.b2Body) return;
        log('destroyPhysics', this.entityId);

        physicsSystem.scheduleDestroyBody(this.b2Body);
        this.b2Body.m_userData.gameObject = null;
    }

    toStateObject() {
        return {
            x: this.x,
            y: this.y,
            r: this.r,
            entityId: this.entityId,
            mineralAmount: this.mineralAmount,
        } as IResourceState;
    }
}
