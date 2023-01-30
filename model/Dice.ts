import { XY } from "@flyover/box2d";


export enum Suit {
    S = "S", // S=Sword
    H = "H", // H=Shield
    M = "M", // M=Morale
    B = "B", // B=Book
    A = "A", // A=Arrow
    F = "F", // F=Fast
    V = "V", // V=Venom
    L = "L", // L=Bleed
    P = "P", // P=Apple
    _ = "_", // _=Blank
}
export type SidesString = string;
export enum DiceType {
    DICE = 0,
    TEMP_DICE = 1,
    BUFF = 2,
    DEBUFF = 3,
}

export type DiceData = DiceDefinition | BuffDefinition;
export type DiceDefinition = {
    icon: Suit,
    type: DiceType.DICE,
    sides: string,
    color: number,
    disabledColor: number,
    desc: string,
};
export type BuffDefinition = {
    icon: Suit,
    type: DiceType.TEMP_DICE | DiceType.BUFF | DiceType.DEBUFF,
    color: number,
    disabledColor: number,
    desc: string,
};

export type DiceState = {
    diceEnabled: boolean;
    sideId: number;
    diceName: string;
    diceType: DiceType;
    diceIsKept: boolean;
    // diceData: DiceDefinition;
}

export type BuffState = {
    [suit: string]: number;
}

export type TransferDiceResult =
    {
        type: 'Dice';
        index: number;
    }
    |
    {
        type: 'Buff';
        index: number;
        roll: DiceState;
        rollDisplacement: XY;
        addedBuffs: DiceState[];
    }

export class Dice {
    public symbol: string = '';
    public sides: DiceSide[] = [];
    public diceName: string;
    public diceEnabled = true;

    constructor() {
    }

    loadSide(sideIndex: number) {
        // this.sides.forEach(side => side.weight = 1);
        this.sides[sideIndex].weight += 1;
    }

    roll(): DiceState {
        const weights = Object.entries(this.sides.map(s => s.weight));

        const totalWeight = 6;

        const roll = Math.random() * totalWeight;
        let acc = 0;
        let index = -1;
        do {
            ++index;
            const [name, weight] = weights[index];
            acc += weight;
        } while (!(roll < acc) && index + 1 < weights.length);

        // console.log(diceThrow.toFixed(1), totalWeight, index);

        const [name, weight] = weights[index];
        return {
            diceName: this.diceName,
            diceType: DiceType.DICE,
            diceEnabled: this.diceEnabled,
            sideId: Number(name),
            diceIsKept: true,
        };
    }

    static create(symbol: string, diceName: string) {
        const result = new Dice();

        const diceData = Dice.diceDefinitions[diceName];
        result.symbol = symbol;
        result.sides = diceData.sides.split('').map(sideType => DiceSide.create(sideType as Suit));
        result.diceName = diceName;

        return result;
    }
    static diceDefinitions: { [x: string]: DiceDefinition } = {
        /* cSpell:disable */
        WHITE: { icon: Suit.S, type: DiceType.DICE, sides: 'SSHHMM', color: 0xb1c6c7, disabledColor: 0x4a5959, desc: 'Balanced basic dice' },
        BLUE: { icon: Suit.H, type: DiceType.DICE, sides: 'HHHSSM', color: 0x4257f5, disabledColor: 0x2d367a, desc: 'Defense dice' },
        RED: { icon: Suit.S, type: DiceType.DICE, sides: 'SSSS__', color: 0xd11f19, disabledColor: 0x781d1a, desc: 'Offense dice' },
        GREEN: { icon: Suit.V, type: DiceType.DICE, sides: 'VBSMM_', color: 0x68d647, disabledColor: 0x265e15, desc: 'Poison dice' },
        AQUA: { icon: Suit.F, type: DiceType.DICE, sides: 'FFSSMM', color: 0x5fe8ed, disabledColor: 0x155457, desc: 'Speed dice' },
        YELLOW: { icon: Suit.M, type: DiceType.DICE, sides: 'MMSHH_', color: 0xf5dd53, disabledColor: 0x807222, desc: 'Morale dice' },
        PURPLE: { icon: Suit.B, type: DiceType.DICE, sides: 'BHMMM_', color: 0xc430e6, disabledColor: 0x590d6b, desc: 'Knowledge dice' },
        /* cSpell:enable */
    }

    static buffDefinitions: { [x: string]: BuffDefinition } = {
        TEMP_SWORD: { icon: Suit.S, type: DiceType.TEMP_DICE, color: 0x737373, disabledColor: 0, desc: 'Temp Sword' },
        TEMP_SHIELD: { icon: Suit.H, type: DiceType.TEMP_DICE, color: 0x737373, disabledColor: 0, desc: 'Temp Shield' },
        TEMP_MORALE: { icon: Suit.M, type: DiceType.TEMP_DICE, color: 0x737373, disabledColor: 0, desc: 'Temp Morale' },
        TEMP_ARROW: { icon: Suit.A, type: DiceType.TEMP_DICE, color: 0x737373, disabledColor: 0, desc: 'Temp Arrow' },
        TEMP_VENOM: { icon: Suit.V, type: DiceType.TEMP_DICE, color: 0x737373, disabledColor: 0, desc: 'Temp Venom' },
        TEMP_BLEED: { icon: Suit.L, type: DiceType.TEMP_DICE, color: 0x737373, disabledColor: 0, desc: 'Temp Bleed' },
        TEMP_: { icon: Suit._, type: DiceType.TEMP_DICE, color: 0x737373, disabledColor: 0, desc: 'Temp Empty' },
        BOOK: { icon: Suit.B, type: DiceType.BUFF, color: 0xc430e6, disabledColor: 0, desc: 'Book Buff' },
        FAST: { icon: Suit.F, type: DiceType.BUFF, color: 0x33b9bd, disabledColor: 0, desc: 'Fast Buff' },
        VENOM: { icon: Suit.V, type: DiceType.DEBUFF, color: 0x68d647, disabledColor: 0, desc: 'Venom Debuff' },
        BLEED: { icon: Suit.L, type: DiceType.DEBUFF, color: 0xd32868, disabledColor: 0, desc: 'Bleed Debuff' }, // 0xc91853 or 0xd32868
    };

    static diceDistribution = [
        { WHITE: 5, BLUE: 2, RED: 2, GREEN: 0, AQUA: 0, YELLOW: 1 },
        { WHITE: 1, BLUE: 4, RED: 4, GREEN: 1, AQUA: 2, YELLOW: 1, PURPLE: 1 },
        { WHITE: 0, BLUE: 2, RED: 2, GREEN: 3, AQUA: 3, YELLOW: 2, PURPLE: 3 },
    ];

    static selfTestDefinitions() {
        let fails = Object.entries(Dice.diceDefinitions)
            .filter(([key, diceData]) => {
                return !(
                    diceData.sides.length === 6 &&
                    (diceData.sides.split('')
                        .every(s => Object.values(Suit).includes(s as Suit)))
                );
            }).map(([key, diceData]) => {
                console.error(`Syntax error for DiceDefinition "${key}": Sides "${diceData.sides}"`);
                return true;
            });
        if (fails.length > 0) return false;


        fails = Object.entries(Dice.diceDistribution)
            .filter(([key, row]) => {
                return !(true
                    && Object.keys(row).every(r => Object.keys(Dice.diceDefinitions).includes(r))
                    // && Object.keys(Dice.diceDefinitions).every(r => Object.keys(row).includes(r))
                );
            }).map(([key, row]) => {
                console.error(`Syntax error for Dice Distribution "${key}": Row "${Object.keys(row).join(', ')}" must contain valid Dice Name.`);
                return true;
            });
        if (fails.length > 0) return false;

        return true;
    }

    static getRandomDice(tier: number) {
        const diceName = Dice.getRandomDiceName(tier);

        return Dice.create(diceName[0], diceName);
    }

    static getRandomDiceName(tier: integer) {
        let dist = Dice.diceDistribution[tier] ?? Dice.diceDistribution[Dice.diceDistribution.length - 1];

        const weights = Object.entries(dist);

        const totalWeight = Object.values(dist).reduce((a, b) => a + b, 0);

        const roll = Math.random() * totalWeight;
        let acc = 0;
        let index = -1;
        do {
            ++index;
            const [name, weight] = weights[index];
            acc += weight;
        } while (!(roll < acc) && index + 1 < weights.length);

        // console.log(diceThrow.toFixed(1), totalWeight, index);

        const [name, weight] = weights[index];
        return name;
    }


    static getBuffNameFromDiceSuit(suit: Suit): string {
        const map: { [x in Suit]: string } = {
            [Suit.S]: "TEMP_SWORD", // S=Sword
            [Suit.H]: "TEMP_SHIELD", // H=Shield
            [Suit.M]: "TEMP_MORALE", // M=Morale
            [Suit.B]: "BOOK", // B=Book
            [Suit.A]: "TEMP_ARROW", // A=Arrow
            [Suit.F]: "FAST", // F=Fast
            [Suit.V]: "TEMP_VENOM", // V=Venom
            [Suit.L]: "TEMP_BLEED", // L=Bleed
            [Suit.P]: "APPLE", // P=Apple
            [Suit._]: "TEMP_", // _=Blank
        };
        return map[suit];
    }
}

export class DiceSide {
    public suit: Suit = Suit._;
    public weight: number = 1;

    static spriteKey = {
        "_": '', //  =Blank
        "S": 'sword', // S=Sword
        "H": 'shield', // H=Shield
        "M": 'structure_tower', // M=Morale
        "B": 'book_open', // B=Book
        "V": 'skull', // V=Venom
        "F": 'fastForward', // F=Fast
        "L": 'suit_hearts_broken', // L=Bleed
        "P": 'apple', // P=Apple
        "A": 'bow', // A=Arrow
    };


    constructor() {
    }

    static create(suit: Suit) {
        const result = new DiceSide();

        result.suit = suit;
        return result;
    }
}

export class RollsStats {
    public suitCount: { [x in Suit]: number };

    constructor() {
        this.suitCount = {
            "_": 0, //  =Blank
            "S": 0, // S=Sword
            "H": 0, // H=Shield
            "M": 0, // M=Morale
            "B": 0, // B=Book
            "V": 0, // V=Venom
            "F": 0, // F=Fast
            "L": 0, // L=Bleed
            "P": 0, // P=Apple
            "A": 0, // A=Arrow
        };
    }
    static create(rolls: DiceState[]) {
        const result = new RollsStats();

        for (const roll of rolls) {
            if (roll.diceType === DiceType.DICE) {
                const suit = RollsStats.getRollSuit(roll);
                result.suitCount[suit]++;
            } else if (roll.diceType === DiceType.TEMP_DICE) {
                const suit = RollsStats.getBuffSuit(roll.diceName);
                if (suit == null) continue;
                result.suitCount[suit]++;
            }else if (roll.diceType === DiceType.BUFF && roll.diceName === 'BOOK') {
                const suit = Suit.B;
                result.suitCount[suit]++;
            }
        }


        return result;
    }

    static getRollSuits(rolls: DiceState[]) {
        return rolls.map((roll) => {
            if (roll.diceType === DiceType.DICE) {
                const suit = RollsStats.getRollSuit(roll);
                return suit;
            } else if (roll.diceType === DiceType.TEMP_DICE) {
                const suit = RollsStats.getBuffSuit(roll.diceName);
                return suit;
            }
        });
    }

    static getRollSuit({ sideId, diceName }: DiceState) {
        const diceData = Dice.diceDefinitions[diceName];
        return diceData.sides[sideId] as Suit;
    }

    static getBuffSuit(buffName: string) {
        return {
            TEMP_SWORD: Suit.S,
            TEMP_ARROW: Suit.A,
            TEMP_SHIELD: Suit.H,
            TEMP_MORALE: Suit.M,
            TEMP_VENOM: Suit.V,
            TEMP_BLEED: Suit.L,
            BOOK: Suit.B,
            VENOM: Suit.V,
            FAST: Suit.V,
            BLEED: Suit.L,
        }[buffName];
    }
}