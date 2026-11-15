import Phaser from 'phaser';

export function textStyle(
  size: number,
  color = '#ffffff',
  extra: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: 'Arial, sans-serif', fontSize: `${size}px`, color, align: 'center', ...extra };
}

// 'pointerdown' (e non 'pointerup') per evitare click accidentali
// se il dito era gia' appoggiato quando compare la schermata.
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Rectangle {
  const bg = scene.add.rectangle(x, y, w, h, 0x3399e6).setInteractive({ useHandCursor: true });
  scene.add.text(x, y, label, textStyle(34)).setOrigin(0.5);
  bg.on('pointerover', () => bg.setFillStyle(0x52adf2));
  bg.on('pointerout', () => bg.setFillStyle(0x3399e6));
  bg.on('pointerdown', onClick);
  return bg;
}
