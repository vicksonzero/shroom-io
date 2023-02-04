import { AUDIO_START_MUTED } from "./constants";
import { MainScene } from "./scenes/MainScene";

export function preload(this: Phaser.Scene) {
    // this.load.json('sheetMap', url);

    this.load.atlasXML('allSprites_default',
        './assets/kenney_topdowntanksredux/allSprites_default.png',
        './assets/kenney_topdowntanksredux/allSprites_default.xml'
    );

    // this.load.image('character', './assets/kenney_boardgameicons/character.png');

    // this.load.image('dice_empty', './assets/kenney_boardgameicons/dice_empty.png');
    this.load.image('circle', './assets/kenney_boardgameicons/circle.png');
    // this.load.image('dice_detailed', './assets/kenney_boardgameicons/dice_detailed.png');
    this.load.image('hexagon', './assets/kenney_boardgameicons/hexagon.png');
    this.load.image('structure_house', './assets/kenney_boardgameicons/structure_house.png');
    // this.load.image('flag_triangle', './assets/kenney_boardgameicons/flag_triangle.png');
    // this.load.image('cards_take', './assets/kenney_boardgameicons/cards_take.png');

    this.load.image('mineral1', './assets/craftpix/48 Free Minerals Pixel Art Icons Pack/Icon16.png');

    this.load.image('pawn', './assets/kenney_boardgameicons/pawn.png'); // bud
    this.load.image('pawn_up', './assets/kenney_boardgameicons/pawn_up.png'); // upgrade button
    this.load.image('pawn_down', './assets/kenney_boardgameicons/pawn_down.png'); // return to pawn form
    this.load.image('skull', './assets/kenney_boardgameicons/skull.png');

    this.load.image('chess_pawn', './assets/kenney_boardgameicons/chess_pawn.png'); // converters
    this.load.image('chess_bishop', './assets/kenney_boardgameicons/chess_bishop.png'); //
    this.load.image('chess_knight', './assets/kenney_boardgameicons/chess_knight.png');// spore shooters
    this.load.image('chess_rook', './assets/kenney_boardgameicons/chess_rook.png'); // swarm tower
    this.load.image('chess_king', './assets/kenney_boardgameicons/chess_king.png');
    this.load.image('chess_queen', './assets/kenney_boardgameicons/chess_queen.png');

    this.load.image('cross', './assets/kenney-gameicons/PNG/White/1x/cross.png'); // cancel button
    this.load.image('zoom', './assets/iconduck/icons/binoculars_64x64.png'); // camera button
    this.load.image('trash', './assets/flaticon/trash_white.png'); // destroy button
    this.load.image('2x2', './assets/dicksonMD/2x2.png'); // destroy button
    this.load.spritesheet('mushrooms', './assets/jintii/mushrooms_e.png', { frameWidth: 64, frameHeight: 64 }); // destroy button


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