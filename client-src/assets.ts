import { AUDIO_START_MUTED } from "./constants";
import { MainScene } from "./scenes/MainScene";

export function preload(this: Phaser.Scene) {
    // this.load.json('sheetMap', url);

    this.load.atlasXML('allSprites_default',
        './assets/kenney_topdowntanksredux/allSprites_default.png',
        './assets/kenney_topdowntanksredux/allSprites_default.xml'
    );

    this.load.image('character', './assets/kenney_boardgameicons/character.png');

    this.load.image('dice_empty', './assets/kenney_boardgameicons/dice_empty.png');
    this.load.image('circle', './assets/kenney_boardgameicons/circle.png');
    this.load.image('dice_detailed', './assets/kenney_boardgameicons/dice_detailed.png');
    this.load.image('hexagon', './assets/kenney_boardgameicons/hexagon.png');
    this.load.image('structure_house', './assets/kenney_boardgameicons/structure_house.png');
    this.load.image('flag_triangle', './assets/kenney_boardgameicons/flag_triangle.png');
    this.load.image('cards_take', './assets/kenney_boardgameicons/cards_take.png');

    // suits
    this.load.image('sword', './assets/kenney_boardgameicons/sword.png');
    this.load.image('shield', './assets/kenney_boardgameicons/shield.png');
    this.load.image('structure_tower', './assets/kenney_boardgameicons/structure_tower.png');
    this.load.image('book_open', './assets/kenney_boardgameicons/book_open.png');
    this.load.image('skull', './assets/kenney_boardgameicons/skull.png');
    this.load.image('fastForward', './assets/kenney_boardgameicons/fastForward.png');
    this.load.image('bow', './assets/kenney_boardgameicons/bow.png');
    this.load.image('suit_hearts_broken', './assets/kenney_boardgameicons/suit_hearts_broken.png');
    this.load.image('suit_hearts_broken', './assets/kenney_boardgameicons/suit_hearts_broken.png');


    // this.load.atlas('items_icon',
    //     './assets/sprites/dicksonmd/spritesheet (1).png',
    //     './assets/sprites/dicksonmd/spritesheet (1).json'
    // );

    // this.load.audio('bgm', './assets/sfx/04 All of Us.mp3');
    // this.load.audio('point', './assets/sfx/270304__littlerobotsoundfactory__collect-point-00.wav');
    // this.load.audio('navigate', './assets/sfx/270315__littlerobotsoundfactory__menu-navigate-03.wav');
    // this.load.audio('hit', './assets/sfx/270332__littlerobotsoundfactory__hit-03.wav');
    // this.load.audio('open', './assets/sfx/270338__littlerobotsoundfactory__open-01.wav');
    // this.load.audio('shoot', './assets/sfx/270343__littlerobotsoundfactory__shoot-01.wav');
}

export function setUpAnimations(this: Phaser.Scene) {
    // this.anims.create({
    //     key: 'player_idle',
    //     frames: this.anims.generateFrameNames(
    //         'platformercharacters_Player',
    //         { frames: [0] }
    //     ),
    //     repeat: 0,
    //     frameRate: 1
    // });
}

export function setUpAudio(this: MainScene) {
    // this.sfx_bgm = this.sound.add('bgm', {
    //     mute: false,
    //     volume: 0.7,
    //     rate: 1,
    //     detune: 0,
    //     seek: 0,
    //     loop: true, // loop!!!
    //     delay: 0
    // });
    // this.sfx_shoot = this.sound.add('shoot', {
    //     mute: false,
    //     volume: 0.4,
    //     rate: 1,
    //     detune: 0,
    //     seek: 0,
    //     loop: false,
    //     delay: 0
    // });
    // this.sfx_hit = this.sound.add('hit', {
    //     mute: false,
    //     volume: 0.7,
    //     rate: 1,
    //     detune: 0,
    //     seek: 0,
    //     loop: false,
    //     delay: 0
    // });
    // this.sfx_navigate = this.sound.add('navigate', {
    //     mute: false,
    //     volume: 0.8,
    //     rate: 1,
    //     detune: 0,
    //     seek: 0,
    //     loop: false,
    //     delay: 0
    // });
    // this.sfx_point = this.sound.add('point', {
    //     mute: false,
    //     volume: 0.8,
    //     rate: 1,
    //     detune: 0,
    //     seek: 0,
    //     loop: false,
    //     delay: 0
    // });
    // this.sfx_open = this.sound.add('open', {
    //     mute: false,
    //     volume: 1,
    //     rate: 1,
    //     detune: 0,
    //     seek: 0,
    //     loop: false,
    //     delay: 0
    // });

    this.sound.mute = AUDIO_START_MUTED;
}