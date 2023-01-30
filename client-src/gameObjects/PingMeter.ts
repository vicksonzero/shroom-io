import * as Debug from 'debug';
import { PingMessage } from '../../model/EventsFromClient';
import { MainScene } from '../scenes/MainScene';


const log = Debug('shroom-io:DiceSprite:log');
// const warn = Debug('shroom-io:Player:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;

export class PingMeter extends Phaser.GameObjects.Container {
    // entity
    scene: MainScene;

    ping = 100;
    avgPing = 100;

    pingHistory: number[] = [];

    // timestamp to compare with server
    sentTimestamp = 0;
    // server's current time
    serverTimestamp = 0;

    // count the number of pings
    pingId = 0;
    // count miss pongs, used to add increment to nextPing
    pongMissCount = 0;
    // timestamp of next ping event
    nextPing = Date.now();
    // milliseconds. if ping succeeds, wait for this amount of time before the next ping
    pingInterval = 500;
    // every time, if ping fails, add this amount of time to the ping back-off
    pingIntervalIncrement = 500;

    // sprites
    label: Text;

    emitSocket = (data: any) => { console.warn(`Please bind emitSocket`) };


    constructor(scene: MainScene) {
        super(scene, 0, 0, []);
        this.setName('ping-meter');
    }

    init(pingInterval: number, pingIntervalIncrement: number) {
        this.pingInterval = pingInterval;
        this.pingIntervalIncrement = pingIntervalIncrement;
    }


    createSprite(): this {
        this.add([
            this.label = this.scene.make.text({
                x: 0, y: 0,
                text: 'ping',
                style: { color: 'black' },
            }, false).setOrigin(1, 0),
        ]);
        return this;
    }

    onPong(pingId: number, serverTimestamp: number) {
        // console.log('onPong', pingId);
        
        if (pingId === this.pingId) {
            this.ping = Date.now() - this.sentTimestamp;
            while (this.pingHistory.length >= 5) {
                this.pingHistory.shift();
            }
            this.pingHistory.push(this.ping);
            this.avgPing = (
                this.pingHistory.reduce((a, b) => (a + b), 0)
                / this.pingHistory.length
            );
            this.label.setText(`${this.ping.toFixed(0)}(${this.avgPing.toFixed(0)})`);
            this.pongMissCount = -1;
            this.serverTimestamp = serverTimestamp;
        }
    }

    update(time: number, dt: number) {
        if (Date.now() > this.nextPing) {
            this.pongMissCount++;
            this.sentTimestamp = Date.now();
            // if (this.pongMissCount > 0) {
            //     console.log(`pong missed`);
            // }
            this.emitSocket({ id: this.pingId } as PingMessage);
            this.nextPing += this.pingInterval + this.pingIntervalIncrement * this.pongMissCount;
        }
    }

    fixedUpdate(time: number, dt: number) {
    }

    lateUpdate() {
        // this.hpBar.setPosition(this.x, this.y);
    }
}
