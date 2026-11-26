// The cockpit instrument panel: a canvas strip across the bottom of the screen in
// cockpit view, drawn fresh each frame — attitude indicator, airspeed, altimeter,
// compass, vertical speed and throttle/fuel — with the warm backlight of a panel that
// has been flown at night. It reads the same state the HUD tapes read, in the older
// language of needles.

import { msToKnots, mToFeet, clamp } from './flightModel.js';

export function makePanel(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = 1280; canvas.height = 210;
  const W = 1280, H = 210;

  function dial(cx, cy, r, label, draw) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#101c22'; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = '#3d5a66'; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    draw(cx, cy, r);
    ctx.restore();
    ctx.fillStyle = '#c8b98f'; ctx.font = '11px Verdana'; ctx.textAlign = 'center';
    ctx.fillText(label, cx, cy + r + 15);
  }
  function needle(cx, cy, angle, len, colour = '#f6ecd7', w = 3) {
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(angle);
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(0, -len);
    ctx.lineWidth = w; ctx.strokeStyle = colour; ctx.stroke(); ctx.restore();
  }
  function ticks(cx, cy, r, from, to, count, majorEvery = 1) {
    ctx.strokeStyle = '#8fa5ad'; ctx.fillStyle = '#8fa5ad'; ctx.font = '10px Verdana'; ctx.textAlign = 'center';
    for (let i = 0; i <= count; i++) {
      const a = from + (to - from) * (i / count);
      const inner = i % majorEvery === 0 ? r - 12 : r - 7;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * inner, cy - Math.cos(a) * inner);
      ctx.lineTo(cx + Math.sin(a) * (r - 3), cy - Math.cos(a) * (r - 3));
      ctx.lineWidth = i % majorEvery === 0 ? 2 : 1; ctx.stroke();
    }
  }

  return {
    draw(state, aircraft) {
      ctx.clearRect(0, 0, W, H);
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, 'rgba(16,30,38,0.94)'); grad.addColorStop(1, 'rgba(8,18,24,0.97)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(242,165,65,0.13)'; ctx.fillRect(0, 0, W, 3);
      const cy = 96, r = 66;

      // attitude indicator
      dial(130, cy, r, 'ATTITUDE', (x, y, rr) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(-state.roll);
        ctx.fillStyle = '#2a6ea8'; ctx.fillRect(-rr, -rr + state.pitch * 90, rr * 2, rr * 2);
        ctx.fillStyle = '#7a5a34'; ctx.fillRect(-rr, state.pitch * 90, rr * 2, rr * 2);
        ctx.restore();
        ctx.strokeStyle = '#f2a541'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x - 8, y); ctx.lineTo(x, y + 5); ctx.lineTo(x + 8, y); ctx.lineTo(x + 26, y); ctx.stroke();
      });
      // airspeed
      const kt = msToKnots(state.speed);
      dial(320, cy, r, 'AIRSPEED · KT', (x, y, rr) => {
        ticks(x, y, rr, -2.3, 2.3, 20, 5);
        ctx.fillStyle = '#c8b98f'; ctx.font = '10px Verdana'; ctx.textAlign = 'center';
        for (let v = 0; v <= 200; v += 50) {
          const a = -2.3 + 4.6 * (v / 220);
          ctx.fillText(String(v), x + Math.sin(a) * (rr - 24), y - Math.cos(a) * (rr - 24) + 3);
        }
        // stall band
        ctx.beginPath(); ctx.arc(x, y, rr - 5, -2.3 + 4.6 * (msToKnots(aircraft.stallSpeed) / 220) - Math.PI / 2, -2.3 - Math.PI / 2, true);
        ctx.strokeStyle = '#c62f3b'; ctx.lineWidth = 4; ctx.stroke();
        needle(x, y, -2.3 + 4.6 * clamp(kt / 220, 0, 1), rr - 14);
      });
      // altimeter
      const ft = Math.max(0, mToFeet(state.y));
      dial(510, cy, r, 'ALTIMETER · FT', (x, y, rr) => {
        ticks(x, y, rr, 0, Math.PI * 2, 10, 1);
        needle(x, y, (ft % 1000) / 1000 * Math.PI * 2, rr - 12);
        needle(x, y, (ft % 10000) / 10000 * Math.PI * 2, rr - 26, '#f2a541', 4);
        ctx.fillStyle = '#101c22'; ctx.fillRect(x - 24, y + 14, 48, 17);
        ctx.fillStyle = '#f6ecd7'; ctx.font = 'bold 12px Verdana'; ctx.textAlign = 'center';
        ctx.fillText(String(Math.round(ft)).padStart(5, '0'), x, y + 27);
      });
      // compass
      dial(700, cy, r, 'HEADING', (x, y, rr) => {
        ctx.save(); ctx.translate(x, y); ctx.rotate(state.heading);
        ctx.fillStyle = '#c8b98f'; ctx.font = 'bold 12px Verdana'; ctx.textAlign = 'center';
        const pts = [['N', 0], ['E', Math.PI / 2], ['S', Math.PI], ['W', -Math.PI / 2]];
        for (const [t, a] of pts) ctx.fillText(t, Math.sin(a) * (rr - 16), -Math.cos(a) * (rr - 16) + 4);
        for (let d = 0; d < 360; d += 30) {
          const a = d * Math.PI / 180;
          ctx.beginPath();
          ctx.moveTo(Math.sin(a) * (rr - 4), -Math.cos(a) * (rr - 4));
          ctx.lineTo(Math.sin(a) * (rr - 10), -Math.cos(a) * (rr - 10));
          ctx.strokeStyle = '#8fa5ad'; ctx.stroke();
        }
        ctx.restore();
        ctx.fillStyle = '#f2a541';
        ctx.beginPath(); ctx.moveTo(x, y - rr + 2); ctx.lineTo(x - 6, y - rr + 13); ctx.lineTo(x + 6, y - rr + 13); ctx.fill();
      });
      // vertical speed
      const fpm = state.verticalSpeed * 196.85;
      dial(890, cy, r, 'VERT SPEED · FPM', (x, y, rr) => {
        ticks(x, y, rr, -2.4, 2.4, 12, 3);
        needle(x, y, clamp(fpm / 2000, -1, 1) * 2.4, rr - 14, fpm < -900 ? '#c62f3b' : '#f6ecd7');
      });
      // throttle + fuel as one power dial
      dial(1080, cy, r, 'THROTTLE · FUEL', (x, y, rr) => {
        ticks(x, y, rr, -2.3, 2.3, 10, 5);
        needle(x, y, -2.3 + 4.6 * state.throttle, rr - 14, '#f2a541', 4);
        const frac = state.fuel / aircraft.fuelCapacity;
        ctx.fillStyle = '#101c22'; ctx.fillRect(x - 27, y + 16, 54, 15);
        ctx.fillStyle = frac < 0.2 ? '#c62f3b' : '#f6ecd7'; ctx.font = 'bold 11px Verdana'; ctx.textAlign = 'center';
        ctx.fillText(`FUEL ${Math.round(frac * 100)}%`, x, y + 28);
      });
      // gear / flaps annunciators
      ctx.font = 'bold 13px Verdana'; ctx.textAlign = 'left';
      ctx.fillStyle = state.gearDown ? '#2e933c' : '#5c6a70';
      ctx.fillText(state.gearDown ? '● GEAR DOWN' : '○ GEAR UP', 1180, 60);
      ctx.fillStyle = state.flaps ? '#2e933c' : '#5c6a70';
      ctx.fillText(state.flaps ? '● FLAPS' : '○ FLAPS', 1180, 84);
      ctx.fillStyle = state.stalled ? '#c62f3b' : '#5c6a70';
      ctx.fillText(state.stalled ? '● STALL' : '○ STALL', 1180, 108);
      ctx.fillStyle = state.onGround ? '#c8b98f' : '#5c6a70';
      ctx.fillText(state.onGround ? '● ON GROUND' : '○ AIRBORNE', 1180, 132);
    },
  };
}
