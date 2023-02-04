
export function capitalize(str: string) {
    return '' + str.charAt(0).toUpperCase() + str.substring(1);
}

function lerp(a: number, b: number, lerpFactor: number): number {
    const result: number = ((1 - lerpFactor) * a) + (lerpFactor * b);
    return result;
}

export function lerpRadians(a: number, b: number, lerpFactor: number): number// Lerps from angle a to b (both between 0.f and 2*Math.PI), taking the shortest path
{
    let result: number;
    let diff: number = b - a;
    if (diff < -Math.PI) {
        // lerp upwards past 2*Math.PI
        b += 2 * Math.PI;
        result = lerp(a, b, lerpFactor);
        if (result >= 2 * Math.PI) {
            result -= 2 * Math.PI;
        }
    }
    else if (diff > Math.PI) {
        // lerp downwards past 0
        b -= 2 * Math.PI;
        result = lerp(a, b, lerpFactor);
        if (result < 0) {
            result += 2 * Math.PI;
        }
    }
    else {
        // straight lerp
        result = lerp(a, b, lerpFactor);
    }

    return result;
}

export function randomInUnitDisc() {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random();

    return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
    };
}

export function threeDp(val: number) {
    return Math.floor(val * 1000) / 1000;
}

export function hueToColor(hue: number) {

}