import { getPhysicsDefinitions } from '../model/Player';
import { getUniqueID } from '../model/UniqueID';
import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2FixtureDef, b2Vec2, b2World, XY } from "@flyover/box2d";
import { PIXEL_TO_METER } from "./constants.js";
import { IFixtureUserData, PhysicsSystem } from "./PhysicsSystem.js";
import * as Debug from 'debug';
import { NodeType } from '../model/Node';

const verbose = Debug('shroom-io:Player:verbose');
const log = Debug('shroom-io:Player:log');



export class Player {
    public entityId: number;
    public socketId = '';
    public nextMoveTick = 0;
    public sync = {
        lastReceived: 0,
        lastUpdated: 0,
    };
    public deleteAfterTick?: number;

    public nextCanShoot = 0;


    public name = 'Player';
    public hue = 0;
    public isHuman = false;
    public isControlling = false;

    public mineralAmount: number = 10;
    public ammoAmount: number = 0;


    public nodeType: NodeType;
    public hp = 100;
    public maxHp = 100;

    // physics
    public x = 0;
    public y = 0;
    public angle = 0;
    public r = 24;
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
    static create(name: string, tier = 0, socketId?: string) {
        const result = new Player();
        result.name = name;
        result.hue = Math.floor(Math.random() * 360);
        result.hp = 1000;
        result.maxHp = 1000;

        if (socketId) {
            result.socketId = socketId;
            result.isHuman = true;
        }

        return result;
    }


    createPhysics(physicsSystem: PhysicsSystem, physicsFinishedCallback?: () => void) {
        const { fixtureDef, bodyDef } = getPhysicsDefinitions(this.r * PIXEL_TO_METER);

        this.fixtureDef = fixtureDef;

        fixtureDef.userData = {
            fixtureLabel: 'player',
        } as IFixtureUserData;

        this.bodyDef = bodyDef;
        bodyDef.userData = {
            label: 'player',
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
}
