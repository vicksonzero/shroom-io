
export type IBulletState = {
    fromEntityId: number,
    toEntityId: number,

    attDmg: number,

    fromFixedTime: number,
    interval: number, // TODO: fixme: was going to use absolute time, but i am too lazy
};
