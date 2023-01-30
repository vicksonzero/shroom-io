// measurements
export const WORLD_WIDTH = 2000; // px
export const WORLD_HEIGHT = 2000; // px
export const CAMERA_WIDTH = 400; // px
export const CAMERA_HEIGHT = 640; // px
export const BASE_LINE_WIDTH = 100; // px
export const SMOOTH_FACTOR = 0.1;
export const SMOOTH_CAP = 3;

export const METER_TO_PIXEL = 20; // pixel per meter
export const PIXEL_TO_METER = 1 / METER_TO_PIXEL; // meter per pixel
export const RADIAN_TO_DEGREE = 180 / Math.PI;
export const DEGREE_TO_RADIAN = 1 / RADIAN_TO_DEGREE;

// game rules
export const SPAWN_INTERVAL = 10000; // ms
export const SPAWN_DELAY = 5000; // ms
export const PLAYER_MOVE_SPEED = 0.7; // px per second
export const TANK_SPEED = 0.2; // px per second
export const TANK_CHASE_ITEM_RANGE = 150; // px
export const BULLET_SPEED = 0.06; // px per second
export const ITEM_LIFESPAN = 20 * 1000; // ms
export const ITEM_LIFESPAN_WARNING = 17 * 1000; // ms

// debug
export const DEBUG_DISABLE_SPAWNING = false; // default false
export const DEBUG_PHYSICS = false; // default false, draws the physics bodies and constraints
export const AUDIO_START_MUTED = true; // default false

// physics
export const PHYSICS_FRAME_SIZE = 16; // ms
export const PHYSICS_ALLOW_SLEEPING = false; // default false
export const PHYSICS_MAX_FRAME_CATCHUP = 10; // times, default 10 times (10*16 = 160ms)
export const WS_URL = "wss://gmtk2022.dickson.md";
// export const WS_URL = localStorage.getItem('md.dickson.ws_url') || 'ws://localhost:3000'
