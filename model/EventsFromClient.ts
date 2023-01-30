import { XY } from "@flyover/box2d";

export type StartMessage = {
    name: string;
}

export type DashMessage = {
    dashVector: XY;
}

export type DropDiceMessage = {
    slotId: number;
}

export type DebugInspectMessage = {
    cmd: string;
}

export type CheatMessage = {
    cmd: string;
}

export type CheatPlayerDiceMessage = CheatMessage & {
    diceString: string;
}

export type PingMessage = {
    id: number;
}