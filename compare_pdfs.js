const { PDFParse, VerbosityLevel } = require('pdf-parse');
const fs = require('fs');

async function getPositions(file) {
  const buf = fs.readFileSync(file);
  const parser = new PDFParse({ data: buf, verbosity: VerbosityLevel.ERRORS });
  const doc = await parser.load();
  const page = await doc.getPage(1);
  const content = await page.getTextContent({ includeMarkedContent: false });
  await parser.destroy();
  return content.items
    .filter(i => i.str && i.str.trim())
    .map(i => ({
      str: i.str,
      x: Math.round(i.transform[4]),
      y: Math.round(i.transform[5]),
      fs: Math.round(Math.abs(i.transform[3])),
    }));
}

async function getLines(file) {
  const buf = fs.readFileSync(file);
  const parser = new PDFParse({ data: buf, verbosity: VerbosityLevel.ERRORS });
  const doc = await parser.load();
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();
  const lines = [];
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === 91 && ops.argsArray[i][1] && ops.argsArray[i][1][0]) {
      const c = ops.argsArray[i][1][0];
      lines.push({ y: Math.round(c[2]), x1: Math.round(c[1]), x2: Math.round(c[3]) });
    }
  }
  await parser.destroy();
  return lines;
}

async function main() {
  const [posC, posG, linesC, linesG] = await Promise.all([
    getPositions('correto.pdf'),
    getPositions('teste-gerado.pdf'),
    getLines('correto.pdf'),
    getLines('teste-gerado.pdf'),
  ]);

  console.log('=== LINHAS HORIZONTAIS ===');
  console.log('CORRETO:', linesC);
  console.log('GERADO: ', linesG);

  console.log('\n=== COMPARAÇÃO TEXTO (apenas diffs) ===');
  const maxLen = Math.max(posC.length, posG.length);
  for (let i = 0; i < maxLen; i++) {
    const c = posC[i];
    const g = posG[i];
    const xDiff = c && g ? Math.abs(c.x - g.x) : 99;
    const yDiff = c && g ? Math.abs(c.y - g.y) : 99;
    if (xDiff > 2 || yDiff > 2 || !c || !g) {
      const cStr = c ? `${c.str.substring(0,25).padEnd(25)} x:${String(c.x).padStart(4)} y:${String(c.y).padStart(4)} fs:${c.fs}` : '(sem item)';
      const gStr = g ? `${g.str.substring(0,25).padEnd(25)} x:${String(g.x).padStart(4)} y:${String(g.y).padStart(4)} fs:${g.fs}` : '(sem item)';
      console.log(`C: ${cStr}`);
      console.log(`G: ${gStr}`);
      console.log('');
    }
  }
}

main().catch(e => console.error(e.message));
