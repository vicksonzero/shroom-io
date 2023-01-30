
import { b2Body, b2BodyType, b2CircleShape, b2Contact, b2ContactImpulse, b2ContactListener, b2Fixture, b2JointType, b2Manifold, b2ParticleBodyContact, b2ParticleContact, b2ParticleSystem, b2PolygonShape, b2Shape, b2ShapeType, b2World, XY } from "@flyover/box2d";
import * as Debug from 'debug';
import { DEGREE_TO_RADIAN, METER_TO_PIXEL, PHYSICS_ALLOW_SLEEPING, PIXEL_TO_METER, RADIAN_TO_DEGREE } from "./constants";
import { GameObjects } from "phaser";
import { Player } from "./Player";


const verbose = Debug('shroom-io:PhysicsSystem:verbose');
const log = Debug('shroom-io:PhysicsSystem:log');
const contactsLog = Debug('shroom-io:PhysicsSystem.Contacts:log');
// const warn = Debug('shroom-io:PhysicsSystem:warn');
// warn.log = console.warn.bind(console);

export type CreateBodyCallback = (world: b2World) => void;

export interface IBodyUserData {
    label: string;
    gameObject: Player;
}

export interface IFixtureUserData {
    fixtureLabel: string;
}

export type ContactCallback = (fixtureA: b2Fixture, fixtureB: b2Fixture, contact: b2Contact<b2Shape, b2Shape>) => void;
export type FixturePropertyMapper = (fixture: b2Fixture) => string;
export type ContactFilterList = {
    [x: string]: FixturePropertyMapper
}
export type FilteredContactHandler = {
    title: string;
    filter: FixturePropertyMapper;
    labelA: string;
    labelB: string;
    callback: ContactCallback;
}

export class PhysicsSystem implements b2ContactListener {

    world: b2World;
    scheduledCreateBodyList: CreateBodyCallback[] = [];
    scheduledDestroyBodyList: b2Body[] = [];

    public byBodyLabel: FixturePropertyMapper = (fixture) => (fixture?.GetBody()?.GetUserData()?.label);
    public byGameObjectName: FixturePropertyMapper = (fixture) => (fixture?.GetBody()?.GetUserData()?.gameObject?.name);
    public byGameObjectEntityId: FixturePropertyMapper = (fixture) => (fixture?.GetBody()?.GetUserData()?.gameObject?.entityId);
    public byFixtureLabel: FixturePropertyMapper = (fixture) => (fixture?.GetUserData()?.fixtureLabel);

    public getGameObjectFromFixture = (fixture: b2Fixture) => (fixture?.GetBody()?.GetUserData()?.gameObject);

    beginContactHandlers: FilteredContactHandler[] = [];
    endContactHandlers: FilteredContactHandler[] = [];

    constructor(public gravity: XY = { x: 0, y: 0 }) {
        this.world = new b2World(gravity);
    }

    init(contactListener: b2ContactListener = this) {
        this.world.SetAllowSleeping(PHYSICS_ALLOW_SLEEPING);
        this.world.SetContactListener(contactListener);
    }

    readStateFromGame() {
        const verboseLogs: string[] = [];
        for (let body = this.world.GetBodyList(); body; body = body.GetNext()) {
            const userData: IBodyUserData = body.GetUserData(); // TODO: make an interface for user data
            const gameObject: Player = userData.gameObject || null;
            const label = userData.label || '(no label)';
            const name = (gameObject as any).name || '(no name)';

            if (!gameObject) { continue; }
            verboseLogs.push(`Body ${label} ${name}`);

            body.SetPosition({
                x: gameObject.x * PIXEL_TO_METER,
                y: gameObject.y * PIXEL_TO_METER,
            });
            body.SetAngle(gameObject.angle * DEGREE_TO_RADIAN);
        }
        // verbose('readStateFromGame\n' + verboseLogs.join('\n'));
    }

    writeStateIntoGame() {
        const verboseLogs: string[] = [];
        for (let body = this.world.GetBodyList(); body; body = body.GetNext()) {
            const userData: IBodyUserData = body.GetUserData();
            const gameObject: Player = userData.gameObject || null;
            const label = userData?.label || '(no label)';
            const name = (gameObject as any)?.name || '(no name)';

            if (!gameObject) { continue; }
            verboseLogs.push(`${name}'s body ${label}`);

            const pos = body.GetPosition();
            const rot = body.GetAngle(); // radians
            const velo = body.GetLinearVelocity();
            const vAngle = body.GetAngularVelocity() * RADIAN_TO_DEGREE;

            const x = pos.x * METER_TO_PIXEL;
            const y = pos.y * METER_TO_PIXEL;
            const angle = rot * RADIAN_TO_DEGREE;

            const lastUpdated = (
                (gameObject.x != x) ||
                (gameObject.y != y) ||
                (gameObject.angle != angle) ||
                false
            );


            gameObject.x = x;
            gameObject.y = y;
            gameObject.vx = velo.x;
            gameObject.vy = velo.y;
            gameObject.angle = angle;
            gameObject.vAngle = vAngle;
            gameObject.sync.lastUpdated = lastUpdated ? Date.now() : 0;
        }
        // verbose('writeStateIntoGame\n' + verboseLogs.join('\n'));
    }

    getBodyData() {
        const result = [];
        for (let body = this.world.GetBodyList(); body; body = body.GetNext()) {
            const userData: IBodyUserData = body.GetUserData();
            const gameObject: Player = userData.gameObject || null;
            const bodyLabel = userData?.label || '(no label)';
            const gameObjectName = (gameObject as any)?.name || '(no name)';

            const pos = body.GetPosition();
            const rot = body.GetAngle(); // radians
            const velo = body.GetLinearVelocity();
            const vAngle = body.GetAngularVelocity() * RADIAN_TO_DEGREE;

            const x = pos.x * METER_TO_PIXEL;
            const y = pos.y * METER_TO_PIXEL;
            const angle = rot * RADIAN_TO_DEGREE;

            if (!gameObject) {
                result.push({
                    entityId: null,
                    bodyLabel,
                    gameObjectName,
                    x: x,
                    y: y,
                    vx: velo.x,
                    vy: velo.y,
                    angle: angle,
                    vAngle: vAngle,
                });
                continue;
            }

            result.push({
                entityId: gameObject.entityId,
                bodyLabel,
                gameObjectName,
                x: x,
                y: y,
                vx: velo.x,
                vy: velo.y,
                angle: angle,
                vAngle: vAngle,
            });
        }

        return result;
    }

    update(timeStep: number, graphics?: Phaser.GameObjects.Graphics) {
        this.destroyScheduledBodies('before Step');
        this.readStateFromGame();
        // if (graphics) { this.debugDraw(graphics); }
        // verbose('Begin updateToFrame');
        this.updateOneFrame(timeStep);
        this.destroyScheduledBodies('after Step');
        // verbose('End updateToFrame');
        this.createScheduledBodies();
        this.writeStateIntoGame();
    }

    updateOneFrame(timeStep: number) {
        const velocityIterations = 10;   //how strongly to correct velocity
        const positionIterations = 10;   //how strongly to correct position
        this.world.Step(timeStep, velocityIterations, positionIterations);
    }

    scheduleCreateBody(callback: CreateBodyCallback) {
        this.scheduledCreateBodyList.push(callback);
    }

    createScheduledBodies() {
        const len = this.scheduledCreateBodyList.length;
        if (len > 0) {
            log(`createScheduledBodies: ${len} callbacks`);
        }
        this.scheduledCreateBodyList.forEach((callback) => {
            callback(this.world);
        });
        this.scheduledCreateBodyList = [];
    }

    scheduleDestroyBody(body: b2Body) {
        this.scheduledDestroyBodyList.push(body);
    }

    destroyScheduledBodies(debugString: string) {
        const len = this.scheduledCreateBodyList.length;
        if (len > 0) {
            // log(`destroyScheduledBodies(${debugString}): ${len} callbacks`);
        }
        this.scheduledDestroyBodyList.forEach((body) => {
            this.world.DestroyBody(body);
        });
        this.scheduledDestroyBodyList = [];
    }

    public registerBeginContactHandler(
        title: string,
        filter: FixturePropertyMapper,
        labelA: string,
        labelB: string,
        callback: ContactCallback
    ) {

        this.beginContactHandlers.push({
            title,
            filter,
            labelA,
            labelB,
            callback,
        });
    }

    public registerEndContactHandler(
        title: string,
        filter: FixturePropertyMapper,
        labelA: string,
        labelB: string,
        callback: ContactCallback
    ) {
        this.endContactHandlers.push({
            title,
            filter,
            labelA,
            labelB,
            callback,
        });
    }


    public BeginContact(pContact: b2Contact<b2Shape, b2Shape>): void {
        for (let contact: b2Contact<b2Shape, b2Shape> | null = pContact; contact != null; contact = contact.GetNext()) {
            if (!contact) { continue; } // satisfy eslint
            const fixtureA = contact.GetFixtureA();
            const fixtureB = contact.GetFixtureB();

            contactsLog(`BeginContact ` +
                `${this.byBodyLabel(fixtureA)}(${this.byGameObjectEntityId(fixtureA)})'s ${this.byFixtureLabel(fixtureA)}` +
                ` vs ` +
                `${this.byBodyLabel(fixtureB)}(${this.byGameObjectEntityId(fixtureB)})'s ${this.byFixtureLabel(fixtureB)}`
            );

            for (const handler of this.beginContactHandlers) {
                const {
                    title,
                    filter,
                    labelA,
                    labelB,
                    callback,
                } = handler;
                const checkPairWithMapper = this.checkPairWithMapper_(fixtureA, fixtureB, filter);
                checkPairWithMapper(labelA, labelB, (fixtureA: b2Fixture, fixtureB: b2Fixture) => {
                    if (title) contactsLog(`Handler "${title}" matched`);
                    callback(fixtureA, fixtureB, contact!);
                });
                if (this.someFixturesDied(fixtureA, fixtureB)) break;
            }
        }
    }
    public EndContact(pContact: b2Contact<b2Shape, b2Shape>): void {
        for (let contact: b2Contact<b2Shape, b2Shape> | null = pContact; contact != null; contact = contact.GetNext()) {
            if (!contact) { continue; } // satisfy eslint
            const fixtureA = contact.GetFixtureA();
            const fixtureB = contact.GetFixtureB();

            contactsLog(`EndContact ` +
                `${this.byBodyLabel(fixtureA)}(${this.byGameObjectEntityId(fixtureA)})'s ${this.byFixtureLabel(fixtureA)}` +
                ` vs ` +
                `${this.byBodyLabel(fixtureB)}(${this.byGameObjectEntityId(fixtureB)})'s ${this.byFixtureLabel(fixtureB)}`
            );

            for (const handler of this.endContactHandlers) {
                const {
                    title,
                    filter,
                    labelA,
                    labelB,
                    callback,
                } = handler;
                const checkPairWithMapper = this.checkPairWithMapper_(fixtureA, fixtureB, filter);
                checkPairWithMapper(labelA, labelB, (fixtureA: b2Fixture, fixtureB: b2Fixture) => {
                    if (title) contactsLog(`Handler "${title}" matched`);
                    callback(fixtureA, fixtureB, contact!);
                });
                if (this.someFixturesDied(fixtureA, fixtureB)) break;
            }
        }
    }

    public BeginContactFixtureParticle(system: b2ParticleSystem, contact: b2ParticleBodyContact): void {
        // do nothing
    }
    public EndContactFixtureParticle(system: b2ParticleSystem, contact: b2ParticleBodyContact): void {
        // do nothing
    }
    public BeginContactParticleParticle(system: b2ParticleSystem, contact: b2ParticleContact): void {
        // do nothing
    }
    public EndContactParticleParticle(system: b2ParticleSystem, contact: b2ParticleContact): void {
        // do nothing
    }
    public PreSolve(contact: b2Contact<b2Shape, b2Shape>, oldManifold: b2Manifold): void {
        // do nothing
    }
    public PostSolve(contact: b2Contact<b2Shape, b2Shape>, impulse: b2ContactImpulse): void {
        // do nothing
    }

    private checkPairWithMapper_(fixtureA: b2Fixture, fixtureB: b2Fixture, mappingFunction: FixturePropertyMapper) {
        const _nameA = mappingFunction(fixtureA);
        const _nameB = mappingFunction(fixtureA);

        return (
            nameA: string, nameB: string,
            matchFoundCallback: (a: b2Fixture, b: b2Fixture) => void
        ) => {
            if (_nameA === nameA && _nameB === nameB) {
                matchFoundCallback(fixtureA, fixtureB);
            } else if (_nameB === nameA && _nameA === nameB) {
                matchFoundCallback(fixtureB, fixtureA);
            }
        }
    }
    private someFixturesDied(fixtureA: b2Fixture, fixtureB: b2Fixture) {
        return fixtureA.GetBody()?.GetUserData()?.gameObject == null ||
            fixtureB.GetBody()?.GetUserData()?.gameObject == null;
    }
    // debugDraw(graphics: Phaser.GameObjects.Graphics) {
    //     // see node_modules/@flyover/box2d/Box2D/Dynamics/b2World.js DrawDebugData() 
    //     // for more example of drawing debug data onto screen
    //     graphics.clear();
    //     this.drawBodies(graphics);
    //     this.drawJoints(graphics);
    // }

    // drawBodies(graphics: Phaser.GameObjects.Graphics) {
    //     for (let body = this.world.GetBodyList(); body; body = body.GetNext()) {
    //         const pos = body.GetPosition();
    //         const angle = body.GetAngle(); // radian

    //         for (let fixture = body.GetFixtureList(); fixture; fixture = fixture.GetNext()) {
    //             const shape = fixture.GetShape();
    //             const type = shape.GetType();
    //             const isSensor = fixture.IsSensor();
    //             const fixtureLabel = (fixture.GetUserData() as IFixtureUserData).fixtureLabel;

    //             let color = 0xff8080;

    //             if (!body.IsActive()) {
    //                 color = 0x80804c;
    //             }
    //             else if (body.GetType() === b2BodyType.b2_staticBody) {
    //                 color = 0x80e580;
    //             }
    //             else if (body.GetType() === b2BodyType.b2_kinematicBody) {
    //                 color = 0x8080e5;
    //             }
    //             else if (!body.IsAwake()) {
    //                 color = 0x999999;
    //             }
    //             else {
    //                 color = 0xe6b2b2; // 0xf29999;
    //             }

    //             const alpha = isSensor ? 0 : 0.5;
    //             graphics.lineStyle(2, color, 1);
    //             graphics.fillStyle(color, alpha);

    //             switch (type) {
    //                 case b2ShapeType.e_circleShape:
    //                     {
    //                         const circleShape = shape as b2CircleShape;
    //                         const p = circleShape.m_p;
    //                         const r = circleShape.m_radius;

    //                         graphics.strokeCircle((pos.x + p.x) * METER_TO_PIXEL, (pos.y + p.y) * METER_TO_PIXEL, r * METER_TO_PIXEL);
    //                         graphics.fillCircle((pos.x + p.x) * METER_TO_PIXEL, (pos.y + p.y) * METER_TO_PIXEL, r * METER_TO_PIXEL);
    //                         graphics.lineBetween(
    //                             (pos.x + p.x) * METER_TO_PIXEL, (pos.y + p.y) * METER_TO_PIXEL,
    //                             (pos.x + p.x + Math.cos(angle) * r) * METER_TO_PIXEL, (pos.y + p.y + Math.sin(angle) * r) * METER_TO_PIXEL
    //                         );
    //                     } break;
    //                 case b2ShapeType.e_polygonShape:
    //                     {
    //                         const polygonShape = shape as b2PolygonShape;
    //                         const vertices = polygonShape.m_vertices;
    //                         graphics.beginPath();
    //                         vertices.forEach((v, i) => {
    //                             if (i === 0) {
    //                                 graphics.moveTo(
    //                                     (pos.x + v.x) * METER_TO_PIXEL,
    //                                     (pos.y + v.y) * METER_TO_PIXEL
    //                                 );
    //                             } else {
    //                                 graphics.lineTo(
    //                                     (pos.x + v.x) * METER_TO_PIXEL,
    //                                     (pos.y + v.y) * METER_TO_PIXEL
    //                                 );
    //                             }
    //                         });
    //                         graphics.closePath();
    //                         graphics.strokePath();
    //                         graphics.fillPath();
    //                     } break;
    //             }
    //         }
    //     }
    // }

    // drawJoints(graphics: Phaser.GameObjects.Graphics) {
    //     for (let joint = this.world.GetJointList(); joint; joint = joint.GetNext()) {
    //         const color = 0x81cccc;
    //         graphics.lineStyle(2, color, 1);
    //         const type = joint.GetType();
    //         const label = joint.GetUserData()?.label || '';

    //         const bodyA = joint.GetBodyA();
    //         const bodyB = joint.GetBodyB();
    //         const xf1 = bodyA.m_xf;
    //         const xf2 = bodyB.m_xf;
    //         const x1 = xf1.p;
    //         const x2 = xf2.p;
    //         const p1 = joint.GetAnchorA({ x: 0, y: 0 });
    //         const p2 = joint.GetAnchorB({ x: 0, y: 0 });

    //         switch (type) {
    //             case b2JointType.e_distanceJoint:
    //                 {
    //                     graphics.lineBetween(
    //                         (p1.x) * METER_TO_PIXEL, (p1.y) * METER_TO_PIXEL,
    //                         (p2.x) * METER_TO_PIXEL, (p2.y) * METER_TO_PIXEL
    //                     );
    //                 } break;
    //             default:
    //                 {
    //                     graphics.lineBetween(
    //                         (x1.x) * METER_TO_PIXEL, (x1.y) * METER_TO_PIXEL,
    //                         (p1.x) * METER_TO_PIXEL, (p1.y) * METER_TO_PIXEL
    //                     );
    //                     graphics.lineBetween(
    //                         (p1.x) * METER_TO_PIXEL, (p1.y) * METER_TO_PIXEL,
    //                         (p2.x) * METER_TO_PIXEL, (p2.y) * METER_TO_PIXEL
    //                     );
    //                     graphics.lineBetween(
    //                         (x2.x) * METER_TO_PIXEL, (x2.y) * METER_TO_PIXEL,
    //                         (p2.x) * METER_TO_PIXEL, (p2.y) * METER_TO_PIXEL
    //                     );
    //                 }
    //         }
    //     }
    // }
}