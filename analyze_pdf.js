const { PDFParse, VerbosityLevel } = require('pdf-parse');
const fs = require('fs');

async function main() {
  const buf = fs.readFileSync('correto.pdf');
  const parser = new PDFParse({ data: buf, verbosity: VerbosityLevel.ERRORS });
  const doc = await parser.load();
  const page = await doc.getPage(1);
  const ops = await page.getOperatorList();

  console.log('=== LINHAS E PATHS (fn=91 = paintSolidColorImageMask / rectangle paths) ===');
  
  // fn=91 parece ser paths/linhas no ReportLab
  // Vamos ver todos os fn=91
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    
    if (fn === 91) {
      console.log('fn91 args[0]:', args[0], 'args[1]:', JSON.stringify(args[1]));
    }
    
    // fn=2 é setGrayStrokeColor ou setAlpha
    if (fn === 2) {
      console.log('fn2 (alpha/gray):', args);
    }
  }

  // Contar quantos fn=91 existem
  const count91 = ops.fnArray.filter(f => f === 91).length;
  console.log('\nTotal fn=91:', count91);
  
  // Mostrar todos os fn=91 com contexto
  console.log('\n=== TODOS OS fn=91 COM COORDENADAS ===');
  for (let i = 0; i < ops.fnArray.length; i++) {
    if (ops.fnArray[i] === 91) {
      const args = ops.argsArray[i];
      // args[1] contém as coordenadas do path
      if (args[1] && args[1][0]) {
        const coords = args[1][0];
        console.log('Linha/rect:', {
          x1: Math.round(coords[1]),
          y1: Math.round(coords[2]),
          x2: Math.round(coords[3]),
          y2: Math.round(coords[4])
        });
      }
    }
  }

  await parser.destroy();
}
main().catch(e => console.error(e.message, e.stack));
