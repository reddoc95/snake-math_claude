// Generate Android launcher icons from canvas
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function genIcon(size) {
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');

    // Background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);

    // Red block (Numberblocks One)
    const bs = size * 0.5, bx = (size - bs) / 2, by = size * 0.15, r = bs * 0.2;
    const g = ctx.createLinearGradient(bx, by, bx, by + bs);
    g.addColorStop(0, '#ef5350');
    g.addColorStop(1, '#c62828');
    ctx.fillStyle = g;

    // Rounded rect
    ctx.beginPath();
    ctx.moveTo(bx + r, by);
    ctx.lineTo(bx + bs - r, by);
    ctx.quadraticCurveTo(bx + bs, by, bx + bs, by + r);
    ctx.lineTo(bx + bs, by + bs - r);
    ctx.quadraticCurveTo(bx + bs, by + bs, bx + bs - r, by + bs);
    ctx.lineTo(bx + r, by + bs);
    ctx.quadraticCurveTo(bx, by + bs, bx, by + bs - r);
    ctx.lineTo(bx, by + r);
    ctx.quadraticCurveTo(bx, by, bx + r, by);
    ctx.fill();

    // Eyes
    const es = bs * 0.12, ey = by + bs * 0.35;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(bx + bs * 0.35, ey, es, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + bs * 0.65, ey, es, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(bx + bs * 0.37, ey, es * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + bs * 0.67, ey, es * 0.5, 0, Math.PI * 2); ctx.fill();

    // Number "1"
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = `bold ${bs * 0.35}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('1', size / 2, by + bs * 0.7);

    // Text
    ctx.fillStyle = '#a29bfe';
    ctx.font = `bold ${size * 0.1}px sans-serif`;
    ctx.fillText('Snake', size / 2, by + bs + size * 0.08);
    ctx.fillStyle = '#fd79a8';
    ctx.fillText('Math', size / 2, by + bs + size * 0.18);

    return c.toBuffer('image/png');
}

// Android icon sizes
const sizes = {
    'mdpi': 48,
    'hdpi': 72,
    'xhdpi': 96,
    'xxhdpi': 144,
    'xxxhdpi': 192
};

const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');

for (const [density, size] of Object.entries(sizes)) {
    const dir = path.join(resDir, `mipmap-${density}`);
    if (fs.existsSync(dir)) {
        const iconBuf = genIcon(size);
        fs.writeFileSync(path.join(dir, 'ic_launcher.png'), iconBuf);
        fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), iconBuf);
        fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), iconBuf);
        console.log(`Generated ${density} icon (${size}x${size})`);
    }
}

console.log('Done!');
