
export type IPacketState = {
    entityId: number,
    fromEntityId: number,
    toEntityId: number,

    mineralAmount: number,
    ammoAmount: number,

    fromFixedTime: number,
    timeLength: number, // was going to use absolute time, but am too lazy
};
