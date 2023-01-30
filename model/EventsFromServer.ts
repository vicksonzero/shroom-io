import { XY } from "@flyover/box2d";
import { BuffDefinition, BuffState, DiceDefinition, DiceState, TransferDiceResult } from "./Dice";


export type StateMessage = {
    tick: number;
    state: Array<PlayerState>
};

export type PlayerState = {
    entityId: number;
    x: number;
    y: number;
    angle: number; // in degrees
    r: number; // radius

    name: string;
    color?: number;
    isHuman?: boolean;
    isCtrl?: boolean; // for the player receiving this state pack, is this Player themselves?
    nextMoveTick?: number;
    nextCanShoot: number;

    vx: number,
    vy: number,
    vAngle: number,

    diceList: DiceState[];
    buffList: BuffState;
}


export type AttackHappenedMessage = {
    untilTick: number;
    result: 'A' | 'B' | 'DRAW';
    playerAPos: XY;
    displacementAB: XY;
    playerAId: number;
    playerBId: number;
    rollsA: DiceState[];
    rollsB: DiceState[];
    netDamageA: number;
    netDamageB: number;
    transferredDice: TransferDiceResult | null;
};

export type DiceDroppedMessage = {
    playerId: number;
    roll: DiceState;
    rollPosition: XY;
    addedBuffs: DiceState[];
}

export type DebugInspectReturn = {
    msg: string;
    data?: any;
}

export type PongMessage = {
    pingId: number,
    serverTimestamp: number,
}