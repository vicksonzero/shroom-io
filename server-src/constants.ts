export const USE_SSL = process.env.USE_SSL == 'true';
export const PORT_WSS = parseInt(process.env.PORT_WSS ?? '443', 10);
export const PORT_WS = parseInt(process.env.PORT_WS ?? '3000', 10);
export const WORLD_WIDTH = parseInt(process.env.WORLD_WIDTH ?? '2000', 10);
export const WORLD_HEIGHT = parseInt(process.env.WORLD_HEIGHT ?? '2000', 10);
export const CAMERA_WIDTH = parseInt(process.env.CAMERA_WIDTH ?? '400', 10);
export const CAMERA_HEIGHT = parseInt(process.env.CAMERA_HEIGHT ?? '640', 10);
export const SPAWN_PADDING = parseInt(process.env.SPAWN_PADDING ?? '30', 10);


export const METER_TO_PIXEL = 20; // pixel per meter
export const PIXEL_TO_METER = 1 / METER_TO_PIXEL; // meter per pixel
export const RADIAN_TO_DEGREE = 180 / Math.PI;
export const DEGREE_TO_RADIAN = 1 / RADIAN_TO_DEGREE;

// physics
export const PHYSICS_FRAME_SIZE = 16; // ms
export const PHYSICS_ALLOW_SLEEPING = false; // default false
export const PHYSICS_MAX_FRAME_CATCHUP = 100; // times, default 10 times (10*16 = 160ms)