import { XY } from "@flyover/box2d";
import { NodeType } from "./Node";

export const CMD_IO_DISCONNECT = 'disconnect';
export const CMD_START = 'CMD_START';
export type StartMessage = {
    name: string;
}

export const CMD_CREATE_NODE = 'CMD_CREATE_NODE';
export type CreateNodeMessage = {
    x: number;
    y: number;
    playerEntityId: number;
    parentNodeId: number;
}

export const CMD_MORPH_NODE = 'CMD_MORPH_NODE';
export type MorphNodeMessage = {
    entityId: number;
    toNodeType: NodeType;
}


export const CMD_DEBUG_INSPECT = 'CMD_DEBUG_INSPECT';
export type DebugInspectMessage = {
    cmd: string;
}

export const CMD_CHEAT = 'CMD_CHEAT';
export type CheatMessage = {
    cmd: string;
}
export type CheatPlayerDiceMessage = CheatMessage & {
    diceString: string;
}

export const CMD_PING = 'CMD_PING';
export type PingMessage = {
    id: number;
}