import { XY } from "@flyover/box2d";
import { IPacketState } from "./Packet";
import { IPlayerState } from "./Player";
import { IResourceState } from "./Resource";

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
    playerStates: IPlayerState[];
    resourceStates: IResourceState[];
};

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