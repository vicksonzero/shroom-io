import { getPhysicsDefinitions, INodeState, NodeType } from '../model/Node';
import { getUniqueID } from '../model/UniqueID';
import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2FixtureDef, b2Vec2, b2World, XY } from "@flyover/box2d";
import { PIXEL_TO_METER } from "./constants.js";
import { IFixtureUserData, PhysicsSystem } from "./PhysicsSystem.js";
import * as Debug from 'debug';
import { DistanceMatrix } from '../utils/DistanceMatrix';
import { Resource } from './Resource';
import { threeDp } from '../utils/utils';

const verbose = Debug('shroom-io:Node:verbose');
const log = Debug('shroom-io:Node:log');



export class Node {
    public entityId: number;
    public socketId = '';
    public nextMoveTick = 0;
    public sync = {
        lastReceived: 0,
        lastUpdated: 0,
    };
    public deleteAfterTick?: number;

    public nextCanShoot = 0;
    public nextCanMine = 0;


    public name = 'Player';
    public color = 0xffffff;
    public isHuman = false;
    public isControlling = false;
    public playerEntityId: number; // -1 means no owners
    public parentNodeId: number;
    public birthday: number;

    public nodeType: NodeType;
    public hp= 100;
    public maxHp= 100;

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


    public mineralAmount: number;
    public ammoAmount: number;
    // ai
    public targetId: number;
    public aiNextTick: number = Date.now() + 2000;

    constructor() {
        this.entityId = getUniqueID();
    }
    static create(playerEntityId: number, parentNodeId: number, birthday: number, nodeType: NodeType = 'bud') {
        const result = new Node();
        result.name = `Node of ${playerEntityId}`;

        result.playerEntityId = playerEntityId;
        result.parentNodeId = parentNodeId;
        result.birthday = birthday;
        result.targetId = -1;

        result.nodeType = nodeType;
        result.hp = 100;
        result.maxHp = 100;

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
            x: threeDp(this.x),
            y: threeDp(this.y),
            r: this.r,
            eid: this.entityId,
            plEid: this.playerEntityId,
            parEid: this.parentNodeId,
            birthday: this.birthday,
            nodeType: this.nodeType,
            hp: this.hp,
            maxHp: this.maxHp,
        } as INodeState;
    }
}
