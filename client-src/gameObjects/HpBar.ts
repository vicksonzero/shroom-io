import * as Debug from 'debug';
import { MainScene } from '../scenes/MainScene';


const log = Debug('shroom-io:HpBar:log');
// const warn = Debug('shroom-io:HpBar:warn');
// warn.log = console.warn.bind(console);

type Image = Phaser.GameObjects.Image;
type GameObject = Phaser.GameObjects.GameObject;
type Container = Phaser.GameObjects.Container;
type Text = Phaser.GameObjects.Text;
type Graphics = Phaser.GameObjects.Graphics;


export class HpBar extends Phaser.GameObjects.Container {
    // entity
    scene: MainScene;

    value: number;
    maxValue: number;

    // sprites
    debugText?: Text;
    nameTag: Text;
    diceCountIcon: Image;
    diceCountLabel: Text;
    bodySprite: Image;
    baseGraphics: Graphics;


    constructor(scene: MainScene) {
        super(scene, 0, 0, []);
        this.setName('hp bar');
        this.createSprite();
    }
    createSprite() {
        this.add([
            this.baseGraphics = this.scene.make.graphics({
                x: 0, y: 0
            }, false),
            // this.debugText = this.scene.make.text({
            //     x: 32, y: -32,
            //     text: '',
            //     style: { align: 'left', color: '#000000' },
            // }),
        ]);

    }

    init(value: number, maxValue: number): this {
        const w = 40;
        const h = 6;
        const percent = Math.max(0, Math.min(value / maxValue, 100));

        this.value = value;
        this.maxValue = maxValue;

        this.baseGraphics.clear();
        this.baseGraphics.lineStyle(1, 0x008800);
        this.baseGraphics.fillStyle(0x008800);
        this.baseGraphics.strokeRect(-w / 2, 0, w, h);
        this.baseGraphics.fillRect(-w / 2, 0, w * percent, h);

        return this;
    }
}
