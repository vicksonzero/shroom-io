import 'dotenv/config'
import { createServer } from "https";
import { Server, Socket } from "socket.io"
import { readFileSync } from 'fs'
import { Game } from './Game.js'
import { CMD_CHEAT, CMD_CREATE_NODE, CMD_DEBUG_INSPECT, CMD_IO_DISCONNECT, CMD_PING, CMD_START, CreateNodeMessage, DebugInspectMessage, PingMessage, StartMessage } from '../model/EventsFromClient'
import { USE_SSL, PORT_WSS, PORT_WS, PHYSICS_FRAME_SIZE } from './constants'
import 'source-map-support/register'
import * as Debug from 'debug';
import { DebugInspectReturn, EVT_DEBUG_INSPECT_RETURN, EVT_PONG, EVT_STATE, EVT_WELCOME, PongMessage } from '../model/EventsFromServer.js';

Debug.enable('shroom-io:*:log');
const socketLog = Debug('shroom-io:Socket:log');



const io = (() => {
    if (USE_SSL) {
        socketLog(`Starting WSS server at ${PORT_WSS}`);

        const httpsServer = createServer({
            key: readFileSync("~/.ssh/ssl-key.pem"),
            cert: readFileSync("~/.ssh/ssl-cert.crt"),
            requestCert: true,
        });
        return new Server(httpsServer, {
            serveClient: false,
            // key: fs.readFileSync('./ssl_key.key'),
            // cert: fs.readFileSync('./ssl_cert.crt'),
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
    } else {
        socketLog(`Starting WS server at ${PORT_WS}`);
        return new Server(PORT_WS, {
            serveClient: false,
            cors: {
                origin: "*",
                methods: ["GET", "POST"],
            }

        });
    }
})();


let game = new Game();

game.init();
setInterval(() => game.update(), PHYSICS_FRAME_SIZE);
game.emitSocketEvent = (socketId: string, event: string, data: any) => {
    io.to(socketId).emit(event, data);
};
game.emitToAll = (event: string, data: any) => {
    io.emit(event, data);
};


io.on("connection", (socket: Socket) => {
    const count = io.engine.clientsCount;
    socketLog(`Socket connected (total=${count}). id=${socket.id}, ip=${socket.handshake.address}, ua=${socket.handshake.headers['user-agent']}`);

    const sendState = (isFullState = false) => {
        const playerStateList = game.getViewForPlayer(socket.id, isFullState);
        // console.log(`Socket sendState. (${players?.length})`);
        if (playerStateList && playerStateList.state.length > 0) {
            socket.emit(EVT_STATE, playerStateList);
        }
    };

    const interval = setInterval(() => sendState(true), 1000);
    const interval2 = setInterval(sendState, 50);

    socket.on(CMD_START, (data: StartMessage) => {
        const { name } = data;
        socketLog(`Socket player start. name=${name}`);

        game.onPlayerConnected(name, socket.id);

        socket.emit(EVT_WELCOME);
        sendState(true);
    });

    socket.on(CMD_IO_DISCONNECT, () => {
        socketLog(`Socket disconnected. (id=${socket.id})`);
        game.onPlayerDisconnected(socket.id);
        clearInterval(interval);
        clearInterval(interval2);
    });


    socket.on(CMD_CREATE_NODE, (data: CreateNodeMessage) => {
        sendState();
    });

    socket.on(CMD_PING, ({ id }: PingMessage) => {
        socket.volatile.emit(EVT_PONG, { pingId: id, serverTimestamp: Date.now() } as PongMessage);
    });

    socket.on(CMD_DEBUG_INSPECT, ({ cmd }: DebugInspectMessage) => {
        socketLog(`Socket debug-inspect (cmd=${cmd})`);

        const commands = {
            'entity-list': () => {
                socket.emit(EVT_DEBUG_INSPECT_RETURN, {
                    msg: `entity-list`,
                    data: game.getEntityList(),
                } as DebugInspectReturn);
            },
            'entity-data': () => {
                socket.emit(EVT_DEBUG_INSPECT_RETURN, {
                    msg: `entity-data`,
                    data: game.getEntityData(socket.id),
                } as DebugInspectReturn);
            },
            'body-data': () => {
                socket.emit(EVT_DEBUG_INSPECT_RETURN, {
                    msg: `body-data`,
                    data: game.getBodyData(),
                } as DebugInspectReturn);
            },

            'help': () => {
                socket.emit(EVT_DEBUG_INSPECT_RETURN, {
                    msg: `Command list:`,
                    data: Object.keys(commands),
                } as DebugInspectReturn);
            },
        };
        const command = Object.entries(commands).find(([key]) => key === cmd);

        if (!command) {
            socket.emit('debug-inspect-return', { msg: `unknown cmd: ${cmd}` } as DebugInspectReturn);
        } else {
            const [_, callback] = command;
            callback();
        }
    });

    socket.on(CMD_CHEAT, (data: DebugInspectMessage) => {
        const { cmd } = data;
        socketLog(`Socket cheat (cmd=${cmd})`);

        const commands = {
            'dice': () => {
                // eg: _debugInspectServer('cheat-dice', {diceString: 'WHITE,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE'})
            },
        };
        const command = Object.entries(commands).find(([key]) => key === cmd);

        if (!command) {
            socket.emit('debug-inspect-return', { msg: `unknown cmd: ${cmd}` } as DebugInspectReturn);
        } else {
            command[1]();
        }
    });
});


process.on('SIGINT', () => {
    console.log("\nGracefully shutting down from SIGINT (Ctrl-C)");
    // some other closing procedures go here
    process.exit(0);
});
