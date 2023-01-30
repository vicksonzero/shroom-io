import * as Debug from 'debug';
import { Dice, DiceData, DiceSide, DiceType, Suit } from '../../model/Dice';
import { MainScene } from '../scenes/MainScene';


const log = Debug('shroom-io:DiceSprite:log');
// const warn = Debug('shroom-io:Player:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

export class DiceSprite extends Phaser.GameObjects.Container {
    // entity
    scene: MainScene;

    isTransferred = false;
    playerEntityId: number; // -1 = no owners
    diceSlotId: number;

    diceName: string = 'WHITE';
    diceType: DiceType = DiceType.DICE;
    // state
    diceEnabled = true;
    sideId = -1; // 0-5, -1 = use icon

    // sprites
    debugText: Text;

    // debug
    _debugShowEntityId = false;
    diceSprite: Phaser.GameObjects.Image | null;
    diceGraphics: Phaser.GameObjects.Graphics | null;
    suitSprite: Phaser.GameObjects.Image;

    constructor(scene: MainScene, diceName: string, diceType: DiceType, sideId: number, playerEntityId: number, diceSlotId: number) {
        super(scene, 0, 0, []);
        this.playerEntityId = playerEntityId;
        this.diceSlotId = diceSlotId;
        this.diceName = diceName;
        this.diceType = diceType;
        this.sideId = sideId;
        this.setName('player');
        this.createSprite();
    }

    getDefinitions(diceName: string, diceType: DiceType): DiceData | undefined {

        return {
            [DiceType.DICE]: Dice.diceDefinitions,
            [DiceType.TEMP_DICE]: Dice.buffDefinitions,
            [DiceType.BUFF]: Dice.buffDefinitions,
            [DiceType.DEBUFF]: Dice.buffDefinitions,
        }[diceType]?.[diceName];
    }

    createSprite() {
        this.add([
            this.diceSprite = this.scene.make.image({
                x: 0, y: 0,
                key: 'dice_empty',
            }, false),
            // this.diceGraphics = this.scene.make.graphics({
            //     x: 0, y: 0,
            // }),
            this.suitSprite = this.scene.make.image({
                x: 0, y: 0,
                key: 'dice_empty',
            }, false),
        ]);
        this.diceSprite?.setScale(0.9);
        this.suitSprite.setScale(0.7);
        this.updateDice();
    }

    setDiceEnabled(val: boolean): this {
        this.diceEnabled = val;
        this.updateDice();
        return this;
    }

    setDiceName(diceName: string, diceType: DiceType): this {
        this.diceName = diceName;
        this.diceType = diceType;
        return this;
    }

    updateDice() {
        const diceData = this.getDefinitions(this.diceName, this.diceType);
        if (diceData == null) {
            console.warn(`Cannot find definition for ${this.diceName} of ${DiceType[this.diceType]}`);
            return;
        }
        const color = (this.diceEnabled
            ? diceData.color
            : diceData.disabledColor
        );

        const suitColor = {
            [DiceType.DICE]: 0x444444,
            [DiceType.TEMP_DICE]: 0xffffff,
            [DiceType.BUFF]: color,
            [DiceType.DEBUFF]: color,
        }[this.diceType];

        this.diceSprite?.setTint(color);
        this.diceGraphics?.clear();
        this.diceGraphics?.fillStyle(color, 1);

        const iconSize = 48;

        switch (diceData.type) {
            case DiceType.DICE: {
                this.diceGraphics?.fillRoundedRect(-iconSize / 2, -iconSize / 2, iconSize, iconSize, 6);
                this.diceSprite?.setTexture('dice_empty');
                // this.suitSprite?.setScale(0.7);
                // this.diceSprite?.setScale(0.9);

            } break;
            case DiceType.TEMP_DICE: {
                this.diceGraphics?.fillCircle(0, 0, iconSize / 2);
                this.diceSprite?.setTexture('circle');
                // this.suitSprite?.setScale(0.7);
                // this.diceSprite?.setScale(0.9);

            } break;
            case DiceType.BUFF: {
                this.diceSprite?.setTint(0xffffff);
                this.diceGraphics?.clear();
                this.diceGraphics?.fillStyle(0xffffff, 1);
                this.diceGraphics?.fillCircle(0, 0, iconSize / 2);
                this.diceSprite?.setTexture('circle');
                // this.suitSprite?.setScale(0.9);
                // this.diceSprite?.setScale(1.1);

            } break;
            case DiceType.DEBUFF: {
                this.diceSprite?.setTint(0x3333333);
                this.diceGraphics?.clear();
                this.diceGraphics?.fillStyle(0x3333333, 1);
                this.diceGraphics?.fillCircle(0, 0, iconSize / 2);
                this.diceSprite?.setTexture('circle');
                // this.suitSprite?.setScale(0.9);
                // this.diceSprite?.setScale(1.1);

            } break;

            default:
                break;
        }

        this.suitSprite.setTint(suitColor);

        const suit = (diceData.type === DiceType.DICE && this.sideId >= 0
            ? diceData.sides[this.sideId] as Suit
            : diceData.icon
        );
        const key = DiceSide.spriteKey[suit];
        if (key == null) throw new Error(`key ${key} is an unknown dice suit`);

        this.suitSprite.setTexture(key);
        this.suitSprite.setVisible(suit != '_');
    }

    init(): this {

        return this;
    }

    initPhysics(physicsFinishedCallback?: () => void): this {
        // const { fixtureDef, bodyDef } = getPhysicsDefinitions(this.r * PIXEL_TO_METER);

        // this.fixtureDef = fixtureDef;

        // this.bodyDef = bodyDef;
        // bodyDef.userData = {
        //     label: 'player',
        //     gameObject: this,
        // };

        // this.scene.getPhysicsSystem().scheduleCreateBody((world: b2World) => {
        //     // this.b2Body = world.CreateBody(bodyDef);
        //     // this.b2Body.CreateFixture(fixtureDef); // a body can have multiple fixtures
        //     // this.b2Body.SetPositionXY(this.x * PIXEL_TO_METER, this.y * PIXEL_TO_METER);

        //     // this.on('destroy', () => {
        //     //     physicsSystem.scheduleDestroyBody(this.b2Body);
        //     //     this.b2Body.m_userData.gameObject = null;
        //     // });
        //     physicsFinishedCallback?.();
        // });

        return this;
    }

    fixedUpdate(time: number, dt: number) {
    }

    lateUpdate() {
        // this.hpBar.setPosition(this.x, this.y);
    }
}
