import { XY } from "@flyover/box2d";


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
}




export type DebugInspectReturn = {
    msg: string;
    data?: any;
}

export type PongMessage = {
    pingId: number,
    serverTimestamp: number,
}