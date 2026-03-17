let createCanvas;
try {
  createCanvas = require('@napi-rs/canvas').createCanvas;
} catch (e) {
  console.error('[renderTracker] Failed to load @napi-rs/canvas:', e.message);
}
const { DateTime } = require('luxon');

// ── Colour palette — fixed 9 slots matching the team roster ─────────────────
// 0 Owel   → yellow   4 Kappy  → blue
// 1 Nerwi  → yellow   5 Bash   → green
// 2 Tata   → blue     6 Numpi  → purple
// 3 Thot   → blue     7 Bones  → purple   8 Raynor → brown
const PALETTE = [
  { bg: '#F9E49A', text: '#5A4000' }, // 0 yellow  (Owel)
  { bg: '#F9E49A', text: '#5A4000' }, // 1 yellow  (Nerwi)
  { bg: '#A8CCF8', text: '#1A3A8A' }, // 2 blue    (Tata)
  { bg: '#A8CCF8', text: '#1A3A8A' }, // 3 blue    (Thot)
  { bg: '#A8CCF8', text: '#1A3A8A' }, // 4 blue    (Kappy)
  { bg: '#B8EAA8', text: '#1A5A10' }, // 5 green   (Bash)
  { bg: '#C8B8EC', text: '#3A1A8A' }, // 6 purple  (Numpi)
  { bg: '#C8B8EC', text: '#3A1A8A' }, // 7 purple  (Bones)
  { bg: '#D4B896', text: '#5A3010' }, // 8 brown   (Raynor)
];

function col(idx) {
  return PALETTE[(idx ?? 0) % PALETTE.length];
}

// ── Drawing helpers ──────────────────────────────────────────────────────────

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function fillRR(ctx, x, y, w, h, r, fill, stroke) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/** Draws a coloured pill with centred, clipped text. */
function pill(ctx, x, y, w, h, text, bgColor, textColor, alpha = 1) {
  const r = h / 2;
  rr(ctx, x, y, w, h, r);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.globalAlpha = 1;

  ctx.fillStyle = alpha < 1 ? textColor + '99' : textColor;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Clip text to pill bounds
  ctx.save();
  rr(ctx, x + 6, y + 2, w - 12, h - 4, r - 2);
  ctx.clip();
  ctx.fillText(text, x + w / 2, y + h / 2);
  ctx.restore();
}

/** Draws a diamond centred at (cx, cy). */
function diamond(ctx, cx, cy, size, bgColor) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx + size * 0.72, cy);
  ctx.lineTo(cx, cy + size);
  ctx.lineTo(cx - size * 0.72, cy);
  ctx.closePath();
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

// ── Main render ──────────────────────────────────────────────────────────────

/**
 * @param {object}   opts
 * @param {object[]} opts.activeUsers  – active sessions, each with colorIndex merged in
 * @param {object[]} opts.allMembers   – all known members  {userId, username, colorIndex}
 * @param {string}   opts.timezone     – IANA timezone for display
 * @param {string}   opts.title        – tracker title shown at top
 * @returns {Buffer}  PNG image buffer
 */
function renderTracker({ activeUsers = [], rosterMembers = [], timezone = 'UTC', title = 'Dev Tracker' }) {
  if (!createCanvas) throw new Error('@napi-rs/canvas no está disponible en este entorno');
  const W = 1280, H = 720;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // ── Background ──
  fillRR(ctx, 0, 0, W, H, 16, '#E6E8EF');

  // ── Layout constants ──
  const PAD        = 26;
  const LEFT_W     = 250;   // offline panel width
  const SEP_X      = PAD + LEFT_W + 12;
  const ONL_X      = SEP_X + 14;
  const ONL_NAME_W = 186;
  const TL_X       = ONL_X + ONL_NAME_W + 8;  // where timeline columns begin
  const COL_W      = 82;
  const N_HOURS    = 8;
  const PILL_H     = 30;
  const ROW_H      = PILL_H + 7;
  const PROJ_H     = 26;

  // ── Timeline: next N_HOURS full hours in the display timezone ──
  const nowTZ    = DateTime.now().setZone(timezone);
  const startH   = nowTZ.startOf('hour').plus({ hours: 1 });
  const tlHours  = Array.from({ length: N_HOURS }, (_, i) => startH.plus({ hours: i }));

  /** Returns the centre-X of the timeline column matching a UTC ISO string. */
  function colCenterX(utcIso) {
    const dt   = DateTime.fromISO(utcIso, { zone: 'utc' }).setZone(timezone);
    const diff = dt.diff(startH, 'hours').hours;
    const idx  = Math.round(diff);
    if (idx < 0)        return TL_X + COL_W / 2;
    if (idx >= N_HOURS) return TL_X + N_HOURS * COL_W + COL_W / 2; // ¿? column
    return TL_X + idx * COL_W + COL_W / 2;
  }

  // ── Y zones ──
  const TIT_Y  = PAD;
  const TIT_H  = 46;
  const HDR_Y  = TIT_Y + TIT_H + 14;
  const HDR_H  = 34;
  const CNT_Y  = HDR_Y + HDR_H + 10;

  // ── Title ──
  fillRR(ctx, PAD, TIT_Y, 400, TIT_H, 10, '#FFFFFF', '#CED0D8');
  ctx.fillStyle = '#222';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(title, PAD + 200, TIT_Y + TIT_H / 2);

  // ── Stats box ──
  const activeCt = activeUsers.length;
  const totalCt  = Math.max(rosterMembers.length, activeCt);

  let peakCt = 0, peakLabel = '—';
  tlHours.forEach(h => {
    const c = activeUsers.filter(u =>
      DateTime.fromISO(u.until, { zone: 'utc' }).setZone(timezone) > h
    ).length;
    if (c > peakCt) { peakCt = c; peakLabel = h.toFormat('HH') + 'h'; }
  });

  const STATS_W = 288;
  const STATS_X = W - PAD - STATS_W;
  fillRR(ctx, STATS_X, TIT_Y, STATS_W, TIT_H, 10, '#FFFFFF', '#CED0D8');
  ctx.fillStyle = '#444';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(`Activos: ${activeCt}/${totalCt}`, STATS_X + STATS_W / 2, TIT_Y + 9);
  ctx.fillText(
    peakCt > 0 ? `Simultáneos: ${peakCt} (~${peakLabel})` : 'Sin actividad',
    STATS_X + STATS_W / 2, TIT_Y + 28
  );

  // ── Section headers ──
  // Offline
  fillRR(ctx, PAD, HDR_Y, LEFT_W, HDR_H, 8, '#FFFFFF', '#CED0D8');
  ctx.fillStyle = '#666';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Offline', PAD + LEFT_W / 2, HDR_Y + HDR_H / 2);

  // Online
  fillRR(ctx, ONL_X, HDR_Y, ONL_NAME_W, HDR_H, 8, '#FFFFFF', '#CED0D8');
  ctx.fillStyle = '#666';
  ctx.font = '14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Online', ONL_X + ONL_NAME_W / 2, HDR_Y + HDR_H / 2);

  // ── Timeline column headers ──
  for (let i = 0; i <= N_HOURS; i++) {
    const cx    = TL_X + i * COL_W;
    const label = i < N_HOURS ? tlHours[i].toFormat('HH') + 'h' : '¿?';
    fillRR(ctx, cx + 2, HDR_Y, COL_W - 4, HDR_H, 6,
      i < N_HOURS ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)',
      'rgba(180,185,200,0.45)'
    );
    ctx.fillStyle = i < N_HOURS ? '#555' : '#999';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx + COL_W / 2, HDR_Y + HDR_H / 2);
  }

  // ── Vertical dashed grid lines ──
  ctx.save();
  ctx.setLineDash([3, 6]);
  ctx.strokeStyle = 'rgba(130,140,165,0.40)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= N_HOURS; i++) {
    const lx = TL_X + i * COL_W + COL_W / 2;
    ctx.beginPath();
    ctx.moveTo(lx, CNT_Y);
    ctx.lineTo(lx, H - PAD);
    ctx.stroke();
  }
  ctx.restore();

  // ── Offline panel — fixed roster order ──────────────────────────────────
  // activeUser present → dashed gap (member went online)
  // activeUser absent  → coloured pill (member offline)
  let oY = CNT_Y;
  for (const m of rosterMembers) {
    if (oY + PILL_H > H - PAD) break;
    const c = col(m.colorIndex);
    if (m.activeUser) {
      // Desaturated dashed gap
      rr(ctx, PAD, oY, LEFT_W, PILL_H, PILL_H / 2);
      ctx.fillStyle = c.bg + '30';
      ctx.fill();
      ctx.save();
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = c.bg + 'AA';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    } else {
      pill(ctx, PAD, oY, LEFT_W, PILL_H, m.name, c.bg, c.text, 0.65);
    }
    oY += ROW_H;
  }

  // ── Online members grouped by project ──
  const groups = {};
  for (const u of activeUsers) {
    const p = u.project || 'Sin proyecto';
    (groups[p] = groups[p] || []).push(u);
  }

  const TL_TOTAL_W = (N_HOURS + 1) * COL_W;
  let nY = CNT_Y;

  for (const [proj, members] of Object.entries(groups)) {
    if (nY + PROJ_H > H - PAD) break;

    // Project group header
    const phW = ONL_NAME_W + TL_TOTAL_W;
    fillRR(ctx, ONL_X, nY, phW, PROJ_H, 7, '#FFFFFF', '#D0D3DC');
    ctx.fillStyle = '#333';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.save();
    rr(ctx, ONL_X + 10, nY + 3, phW - 20, PROJ_H - 6, 4);
    ctx.clip();
    ctx.fillText(proj, ONL_X + 12, nY + PROJ_H / 2);
    ctx.restore();
    nY += PROJ_H + 5;

    for (const u of members) {
      if (nY + PILL_H > H - PAD) break;
      const c   = col(u.colorIndex);
      const midY = nY + PILL_H / 2;

      // Member pill
      pill(ctx, ONL_X, nY, ONL_NAME_W, PILL_H, u.username, c.bg, c.text);

      // Arrow line from pill right edge to diamond
      const lineStartX = ONL_X + ONL_NAME_W + 6;
      const dX         = colCenterX(u.until);

      ctx.beginPath();
      ctx.moveTo(lineStartX, midY);
      ctx.lineTo(dX, midY);
      ctx.strokeStyle = '#444';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([]);
      ctx.stroke();

      // Diamond marker
      diamond(ctx, dX, midY, 12, c.bg);

      // Hour label inside diamond
      const untilDT = DateTime.fromISO(u.until, { zone: 'utc' }).setZone(timezone);
      ctx.fillStyle = c.text;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(untilDT.toFormat('HH') + 'h', dX, midY);

      nY += ROW_H;
    }
    nY += 10; // gap between groups
  }

  return canvas.toBuffer('image/png');
}

module.exports = { renderTracker };
