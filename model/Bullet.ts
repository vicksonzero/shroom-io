
export type IBulletState = {
    fromEntityId: number,
    toEntityId: number,

    attDmg: number,

    fromFixedTime: number,
    timeLength: number, // TODO: fixme: was going to use absolute time, but i am too lazy
    interval: number, // TODO: fixme: was going to use absolute time, but i am too lazy
};
