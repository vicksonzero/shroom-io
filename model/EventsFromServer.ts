import { XY } from "@flyover/box2d";

// socket.io events
export const EVT_IO_CONNECT = 'connect';
export const EVT_IO_RECONNECT = 'reconnect';
export const EVT_IO_RECONNECT_ATTEMPT = 'reconnect_attempt';
export const EVT_IO_CONNECT_ERROR = 'connect_error';
export const EVT_IO_DISCONNECT = 'disconnect';

// server events
export const EVT_WELCOME = 'EVT_WELCOME';
export const EVT_PLAYER_DISCONNECTED = 'EVT_PLAYER_DISCONNECTED';


export const EVT_STATE = 'EVT_STATE';
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

export const EVT_DEBUG_INSPECT_RETURN = 'EVT_DEBUG_INSPECT_RETURN';
export type DebugInspectReturn = {
    msg: string;
    data?: any;
}

export const EVT_PONG = 'EVT_PONG';
export type PongMessage = {
    pingId: number,
    serverTimestamp: number,
}