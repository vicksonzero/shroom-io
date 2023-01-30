import 'dotenv/config'
import { createServer } from "https";
import { Server, Socket } from "socket.io"
import { readFileSync } from 'fs'
import { Game } from './Game.js'
import { CheatPlayerDiceMessage, DashMessage, DebugInspectMessage, DropDiceMessage, PingMessage, StartMessage } from '../model/EventsFromClient'
import { USE_SSL, PORT_WSS, PORT_WS, PHYSICS_FRAME_SIZE } from './constants'
import 'source-map-support/register'
import * as Debug from 'debug';
import { DebugInspectReturn, PongMessage } from '../model/EventsFromServer.js';
import { Dice } from '../model/Dice.js';

Debug.enable('shroom-io:*:log');
const socketLog = Debug('shroom-io:Socket:log');



if (!Dice.selfTestDefinitions()) {
    console.log('Cannot start server due to data syntax errors. See error logs for details');
    process.exit(1);
}

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
            socket.emit('state', playerStateList);
        }
    };

    const interval = setInterval(() => sendState(true), 1000);
    const interval2 = setInterval(sendState, 50);

    socket.on("start", (data: StartMessage) => {
        const { name } = data;
        socketLog(`Socket player start. name=${name}`);

        game.onPlayerConnected(name, socket.id);

        socket.emit('welcome');
        sendState(true);
    });

    socket.on("disconnect", () => {
        socketLog(`Socket disconnected. (id=${socket.id})`);
        game.onPlayerDisconnected(socket.id);
        clearInterval(interval);
        clearInterval(interval2);
    });

    socket.on("dash", (data: DashMessage) => {
        const { dashVector } = data;
        // socketLog(`Socket dash. (${dashVector.x}, ${dashVector.y})`);
        game.onPlayerDash(socket.id, dashVector);
        sendState();
    });

    socket.on("drop-dice", (data: DropDiceMessage) => {
        const { slotId } = data;
        socketLog(`Socket drop-dice. (${slotId})`);
        game.onPlayerDropDice(socket.id, slotId);
        sendState();
    });

    socket.on("ping", ({ id }: PingMessage) => {
        socket.volatile.emit('pong', { pingId: id, serverTimestamp: Date.now() } as PongMessage);
    });

    socket.on('debug-inspect', ({ cmd }: DebugInspectMessage) => {
        socketLog(`Socket debug-inspect (cmd=${cmd})`);

        const commands = {
            'entity-list': () => {
                socket.emit('debug-inspect-return', {
                    msg: `entity-list`,
                    data: game.getEntityList(),
                } as DebugInspectReturn);
            },
            'entity-data': () => {
                socket.emit('debug-inspect-return', {
                    msg: `entity-data`,
                    data: game.getEntityData(socket.id),
                } as DebugInspectReturn);
            },
            'body-data': () => {
                socket.emit('debug-inspect-return', {
                    msg: `body-data`,
                    data: game.getBodyData(),
                } as DebugInspectReturn);
            },

            'help': () => {
                socket.emit('debug-inspect-return', {
                    msg: `Command list:`,
                    data: Object.keys(commands),
                } as DebugInspectReturn);
            },
        };
        const command = Object.entries(commands).find(([key]) => key === cmd);

        if (!command) {
            socket.emit('debug-inspect-return', { msg: `unknown cmd: ${cmd}` } as DebugInspectReturn);
        } else {
            command[1]();
        }
    });

    socket.on('cheat', (data: DebugInspectMessage) => {
        const { cmd } = data;
        socketLog(`Socket cheat (cmd=${cmd})`);

        const commands = {
            'dice': () => {
                // eg: _debugInspectServer('cheat-dice', {diceString: 'WHITE,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE,WHITE'})
                const { diceString } = data as CheatPlayerDiceMessage;
                if (!/^[A-Z,_]+$/.test(diceString)) return;
                game.cheatPlayerDice(socket.id, diceString);
                socket.emit('debug-inspect-return', {
                    msg: `cheat-${cmd} success`,
                } as DebugInspectReturn);
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
