import { GameObjects } from "phaser";

export type TransformWithEntityId = { x: number, y: number, entityId: number };

export class DistanceMatrix {

    distanceMatrix: number[][] = [];

    getTransformList = () => [] as TransformWithEntityId[];
    constructor() {

    }
    init(transformList = this.getTransformList(), graphics?: Phaser.GameObjects.Graphics) {

        const distanceMatrix: number[][] = [];
        transformList.forEach((transform) => {
            distanceMatrix[transform.entityId] = [];
        });
        transformList.forEach((transform1) => {
            transformList.forEach((transform2) => {
                this.updateDistanceBetween(transform1, transform2, distanceMatrix);

                graphics?.lineStyle(1, 0xAAAAAA, 0.7);
                graphics?.lineBetween(transform1.x, transform1.y, transform2.x, transform2.y);
            });
        });

        this.distanceMatrix = distanceMatrix;
    }

    insertTransform(transform: TransformWithEntityId, transformList = this.getTransformList()) {
        console.log('insertTransform', transform.entityId);

        const distanceMatrix = this.distanceMatrix.map((row) => [...row]);
        transformList.forEach((transform2) => {
            this.updateDistanceBetween(transform, transform2, distanceMatrix);
        });
        this.distanceMatrix = distanceMatrix;
    }

    removeTransform(transform: TransformWithEntityId) {
        delete this.distanceMatrix[transform.entityId];
    }

    updateDistanceBetween(transform1: TransformWithEntityId, transform2: TransformWithEntityId, distanceMatrix: number[][]) {
        const dx = transform1.x - transform2.x;
        const dy = transform1.y - transform2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (!distanceMatrix[transform1.entityId]) {
            distanceMatrix[transform1.entityId] = [];
        }
        distanceMatrix[transform1.entityId][transform2.entityId] = distance;
        distanceMatrix[transform2.entityId][transform1.entityId] = distance;
    }

    getDistanceBetween(transform1: TransformWithEntityId, transform2: TransformWithEntityId) {
        return this.distanceMatrix[transform1.entityId][transform2.entityId];
    }

    /**
     * @param {number} [minDistIncl=0] - min distance (inclusive)
     * @param {number} [maxDistExcl=Infinity] - max distance (exclusive)
     * @return {[entityId:number, dist:number][]} array of [entityId, distance] pairs
     */
    getEntitiesClosestTo(entityId: number, count = 5, minDistIncl = 0, maxDistExcl = Infinity) {
        const distanceWithMe = (this.distanceMatrix[entityId]
            .map((dist, _entityId) => [_entityId, dist])
            .filter(([_entityId, dist]) => (_entityId != entityId))
            .filter(([_entityId, dist]) => (minDistIncl <= dist && dist < maxDistExcl))
        );

        distanceWithMe.sort((a, b) => a[1] - b[1]);
        const result = (distanceWithMe
            .slice(0, count) // top 5
        );


        return result as [entityId: number, dist: number][];
    }
}