import { getPhysicsDefinitions } from '../model/Player';
import { getUniqueID } from '../model/UniqueID';
import { b2Body, b2BodyDef, b2BodyType, b2CircleShape, b2FixtureDef, b2Vec2, b2World, XY } from "@flyover/box2d";
import { PIXEL_TO_METER } from "./constants.js";
import { BuffState, Dice, DiceState, DiceType, RollsStats, Suit } from "../model/Dice.js";
import { IFixtureUserData, PhysicsSystem } from "./PhysicsSystem.js";
import * as Debug from 'debug';

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
    public buffs: BuffState = {
        TEMP_SWORD: 0,
        TEMP_SHIELD: 0,
        TEMP_MORALE: 0,
        TEMP_ARROW: 0,
        TEMP_VENOM: 0,
        TEMP_BLEED: 0,
        VENOM: 0,
        BLEED: 0,
        BOOK: 0,
        FAST: 0,
    };

    public name = 'Player';
    public color = 0xffffff;
    public isHuman = false;
    public isControlling = false;

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

    public diceList: Dice[] = [];

    // ai
    public targetId: number;
    public aiNextTick: number = Date.now() + 2000;

    constructor() {
        this.entityId = getUniqueID();
    }
    static create(name: string, tier = 0, socketId?: string) {
        const result = new Player();
        result.name = name;

        if (socketId) {
            result.socketId = socketId;
            result.isHuman = true;
        }

        result.diceList = [
            Dice.getRandomDice(tier)!,
            Dice.getRandomDice(tier)!,
            Dice.getRandomDice(tier)!,
        ];

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

    canShoot() {
        return Date.now() >= this.nextCanShoot;
    }


    hasDiceInSlot(slotId: number) {
        return this.diceList.length > slotId;
    }

    applyDashImpulse(dashVector: XY) {
        if (this.b2Body == null) return;

        const pos = this.b2Body.GetPosition();
        const v = new b2Vec2(dashVector.x, dashVector.y);
        v.SelfMul(PIXEL_TO_METER);

        const angularFlick = 0.7;
        this.b2Body.ApplyLinearImpulse(
            v,
            {
                x: pos.x + (Math.random() * this.r * PIXEL_TO_METER * 2 - this.r * PIXEL_TO_METER) * angularFlick,
                y: pos.y + (Math.random() * this.r * PIXEL_TO_METER * 2 - this.r * PIXEL_TO_METER) * angularFlick,
            },
            true
        );
        // this.b2Body.ApplyAngularImpulse(dashVector.x * 1, true);
    }

    dashAwayFrom(other: Player, force: number) {
        if (this.b2Body == null) return;
        const awayVector = new b2Vec2(
            this.x - other.x,
            this.y - other.y
        );
        awayVector.SelfNormalize().SelfMul(force * PIXEL_TO_METER);
        const pos = this.b2Body.GetPosition();
        this.b2Body.ApplyLinearImpulse(
            awayVector,
            {
                x: pos.x,
                y: pos.y,
            },
            true
        );
    }

    addDice() {


    }

    removeDice(slotId: number): Dice {
        const dice = this.diceList.splice(slotId, 1)[0];

        return dice;
    }

    addBuff(buffName: string, stack = 1): this {
        if (this.buffs[buffName] == null) {
            console.warn(`${this.name} has no such buff: ${buffName}`);
        }

        this.buffs[buffName] += stack;
        return this;
    }

    removeBuff(buffName: string): this {
        if (this.buffs[buffName] == null) {
            console.warn(`${this.name} has no such buff: ${buffName}`);
            return this;
        }
        if (this.buffs[buffName] <= 0) {
            console.warn(`${this.name} has no stack for buff: ${buffName}`);
            return this;
        }

        this.buffs[buffName]--;
        return this;
    }

    resetBuffAfterFight(rollStats: RollsStats, rolls: DiceState[]): this {
        if (rollStats.suitCount.B > 0) { // rolled at least 1 book
            this.buffs.BOOK = 0; // reset all book
            rolls.forEach(roll => {
                if (roll.diceType != DiceType.BUFF) return;

                const suit = RollsStats.getBuffSuit(roll.diceName);
                if (suit != Suit.B) return;

                roll.diceIsKept = false;
            });
        } else {
            this.buffs.TEMP_SWORD = 0;
            this.buffs.TEMP_SHIELD = 0;
            this.buffs.TEMP_MORALE = 0;
            this.buffs.TEMP_ARROW = 0;
            this.buffs.TEMP_VENOM = 0;
            this.buffs.TEMP_BLEED = 0;
            rolls.forEach(roll => {
                if (roll.diceType != DiceType.TEMP_DICE) return;

                roll.diceIsKept = false;
            });
        }
        return this;
    }
}
