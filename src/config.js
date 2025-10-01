// src/config.js
export const OUTER_R = 3.2;        // base outer hex radius
export const DEFAULTS = {
  appearance: { color: 0x00ff33 },
  geometry: {
    gap: 0.5, relief: 4, rim: 10, round: 32, ratio: 26, thick: 0
  },
  rotation: { rx: 8, ry: 5, rz: -3 },
  anchors: {
    show: true, showLabels: true, size: 0.06, color: 0xff3040, idPrefix: ""
  },
  paths: {
    show: true,
    list: [
      // example path from perimeter P0 to center C0
      { id: "p0_to_c0", from: "P0", to: "C0", type: "auto", bend: 0.35 }
    ]
  },
  particles: {
    enabled: true,
    countPerPath: 80,
    speed: 0.35,
    size: 0.06,
    inboundColor: 0x47ff6a,    // toward segments
    outboundColor: 0xffffff,   // from segments
    trail: 6,                  // number of ghost points to draw as trail
    light: { enabled: true, intensity: 0.8, distance: 1.2, colorInbound: 0x00ff66, colorOutbound: 0xffffff }
  },
  view: { scale: 1.0 }
};
