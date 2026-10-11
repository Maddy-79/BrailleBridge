'use strict';

// BrailleBridge: a browser-only MDP software prototype.
const $ = id => document.getElementById(id);
const alphabet = 'abcdefghijklmnopqrstuvwxyz';
const letterDots = ['1','12','14','145','15','124','1245','125','24','245','13','123','134','1345','135','1234','12345','1235','234','2345','136','1236','2456','1346','13456','1356'];
const letterMap = Object.fromEntries([...alphabet].map((letter, index) => [letter, letterDots[index]]));
const punctuation = {' ': '', ',':'2', '.':'256', ';':'23', ':':'25', '!':'235', '?':'236', '-':'36', "'":'3', '/':'34'};
const digitMap = {'1':'a','2':'b','3':'c','4':'d','5':'e','6':'f','7':'g','8':'h','9':'i','0':'j'};
const reverseLetters = Object.fromEntries(Object.entries(letterMap).map(([key,value]) => [value,key]));
const reverseDigits = Object.fromEntries(Object.entries(digitMap).map(([digit,letter]) => [letterMap[letter],digit]));
const reversePunctuation = Object.fromEntries(Object.entries(punctuation).filter(([key])=>key!==' ').map(([key,value]) => [value,key]));

const unicode = dots => String.fromCodePoint(0x2800 + [...dots].reduce((n, dot) => n | (1 << (Number(dot)-1)), 0));
const createCell = (dots, label, extra={}) => ({dots, label, ...extra});

// Grade 1 English mapping. Capital letters and numbers use prefix cells.
function encodeBraille(text) {
  const cells = [];
  let numberMode = false;
  for(const ch of text) {
    if(ch === '\n') { cells.push(createCell('', '↵', {newline:true})); numberMode=false; continue; }
    if(/[0-9]/.test(ch)) {
      if(!numberMode) cells.push(createCell('3456', '#', {prefix:true}));
      cells.push(createCell(letterMap[digitMap[ch]], ch));
      numberMode=true; continue;
    }
    numberMode=false;
    if(/[A-Z]/.test(ch)) cells.push(createCell('6','↑',{prefix:true}));
    const dots = letterMap[ch.toLowerCase()] ?? punctuation[ch];
    cells.push(createCell(dots ?? '', ch, {unsupported:dots===undefined}));
  }
  return cells;
}
function decodeBraille(patterns) {
  let output='', numbers=false, uppercase=false;
  for(const dots of patterns) {
    if(dots==='3456') { numbers=true; continue; }
    if(dots==='6') { uppercase=true; continue; }
    if(dots==='') { output+=' '; numbers=false; uppercase=false; continue; }
    let value = numbers ? reverseDigits[dots] : undefined;
    if(value===undefined) { numbers=false; value=reverseLetters[dots] ?? reversePunctuation[dots] ?? '�'; }
    if(uppercase) { value=value.toUpperCase(); uppercase=false; }
    output+=value;
  }
  return output.trimEnd();
}
function dotHTML(dots, className='dot-grid') {
  return `<span class="${className}">${[1,2,3,4,5,6].map(n=>`<i class="${dots.includes(String(n))?'active':''}"></i>`).join('')}</span>`;
}
function download(filename,text) {
  const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
  const link=document.createElement('a'); link.href=url; link.download=filename; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1500);
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch { const input=document.createElement('textarea'); input.value=text; document.body.append(input); input.select(); const ok=document.execCommand('copy'); input.remove(); return ok; }
}
function status(id,message,type='') { const el=$(id); el.textContent=message; el.className='status-text '+type; }

// Navigation: Home remembers whichever translator was last open.
let activeTranslator='braille';
function showView(name) {
  if(name==='braille'||name==='text') activeTranslator=name;
  ['braille','text','learn','about'].forEach(view=>$(view+'View').hidden=view!==name);
  document.querySelectorAll('[data-nav]').forEach(link=>link.classList.toggle('active',link.dataset.nav===(name==='braille'||name==='text'?'home':name)));
  window.scrollTo({top:0,behavior:'smooth'});
  const hash = name==='braille'||name==='text' ? '#home' : '#'+name;
  if(location.hash!==hash) history.replaceState(null,'',hash);
}
$('goText').onclick=()=>showView('text');
$('goBraille').onclick=()=>showView('braille');
$('returnHome').onclick=$('aboutBack').onclick=()=>showView(activeTranslator);
document.querySelectorAll('[data-nav]').forEach(link=>link.addEventListener('click',event=>{
  event.preventDefault(); const dest=link.dataset.nav; showView(dest==='home'?activeTranslator:dest);
}));
$('profileButton').onclick=()=>showView('about');

// Text-to-Braille preview and solenoid bench simulation.
let cells=[], position=0, cycleTimer=null;
const playableCells=()=>cells.filter(cell=>!cell.newline);
function updateBench() {
  const list=playableCells();
  const selected=list[position];
  const dots=selected?.dots || '';
  $('benchDots').innerHTML=[1,2,3,4,5,6].map(n=>`<span class="pin ${dots.includes(String(n))?'raised':''}" aria-label="Pin ${n}: ${dots.includes(String(n))?'raised':'lowered'}"></span>`).join('');
  $('benchCharacter').textContent=selected?.label || '—';
  $('pinPattern').textContent='Pins raised: '+(dots ? [...dots].join(', ') : 'none');
  $('pinCount').textContent=dots.length+' / 6';
  $('positionText').textContent=list.length ? `${position+1} / ${list.length}` : '0 / 0';
  $('previousCell').disabled=position===0;
  $('nextCell').disabled=position>=list.length-1;
}
function stopCycle() { if(cycleTimer!==null) { clearInterval(cycleTimer); cycleTimer=null; } $('testCycle').textContent='Test Cycle'; }
function translateText() {
  stopCycle();
  const input=$('textInput').value;
  $('characterCount').textContent=`${input.length} characters`;
  cells=encodeBraille(input);
  position=0;
  $('unicodeOutput').textContent=cells.map(c=>c.newline?'\n':unicode(c.dots)).join('') || 'Your Braille will appear here.';
  $('cellPreview').innerHTML=cells.slice(0,120).map(cell=>`<span class="cell-unit">${dotHTML(cell.dots)}<small></small></span>`).join('');
  $('cellPreview').querySelectorAll('small').forEach((el,i)=>el.textContent=cells[i].label);
  status('benchStatus',cells.some(c=>c.unsupported)?'Some symbols are not supported by the Grade 1 mapping. Review the preview.':'Ready for simulation.');
  updateBench();
}
$('translateText').onclick=translateText;
$('textInput').addEventListener('input',()=>{$('characterCount').textContent=`${$('textInput').value.length} characters`;});
$('clearText').onclick=()=>{$('textInput').value='';translateText();};
$('previousCell').onclick=()=>{position=Math.max(0,position-1);updateBench();};
$('nextCell').onclick=()=>{position=Math.min(playableCells().length-1,position+1);updateBench();};
$('resetBench').onclick=()=>{stopCycle();position=0;updateBench();status('benchStatus','Bench simulation reset.');};
$('testCycle').onclick=()=>{
  if(cycleTimer!==null){stopCycle();status('benchStatus','Test stopped.');return;}
  if(!playableCells().length){status('benchStatus','Type and translate some text first.','error');return;}
  position=0;updateBench();$('testCycle').textContent='Stop Cycle';
  status('benchStatus','Running simulated pin sequence...');
  cycleTimer=setInterval(()=>{if(position>=playableCells().length-1){stopCycle();status('benchStatus','Test cycle completed.','success');return;}position++;updateBench();},700);
};
function getBrailleText(){return cells.map(c=>c.newline?'\n':unicode(c.dots)).join('');}
$('downloadBraille').onclick=()=>download('braille-output.txt',getBrailleText());
// BRF files use Braille ASCII cell codes, not the Unicode Braille symbols.
// Explicit inverse Braille ASCII mapping, indexed by the standard 6-dot bitmask.
const brfByMask = " A1B'K2L@CIF/MSP\"E3H9O6R^DJG>NTQ,*5<-U8V.%[$+X!&;:4\\0Z7(_?W]#Y)=";
$('saveBrf').onclick=()=>download('braille-output.brf',cells.map(c=>c.newline?'\r\n':brfByMask[unicode(c.dots).codePointAt(0)-0x2800]??' ').join(''));

// Upload, preview and spoken output. Recognition is approximate, not an OCR service.
let uploadedImage=null;
function setImageFile(file) {
  if(!file || !file.type.startsWith('image/')) { status('imageStatus','Please select an image file.','error');return; }
  if(file.size>12*1024*1024){status('imageStatus','Please choose an image smaller than 12 MB.','error');return;}
  const reader=new FileReader();
  reader.onload=()=>{
    const image=new Image();
    image.onload=()=>{ uploadedImage=image;$('imagePreview').src=image.src;$('imagePreview').hidden=false;$('dropPrompt').hidden=true;status('imageStatus',`Image loaded: ${file.name}. Click Translate Image.`);};
    image.onerror=()=>status('imageStatus','Could not open that image.','error');
    image.src=reader.result;
  };
  reader.readAsDataURL(file);
}
$('dropZone').onclick=()=>$('imageInput').click();
$('imageInput').onchange=event=>setImageFile(event.target.files[0]);
$('dropZone').ondragover=e=>{e.preventDefault();$('dropZone').classList.add('dragging');};
$('dropZone').ondragleave=()=>$('dropZone').classList.remove('dragging');
$('dropZone').ondrop=e=>{e.preventDefault();$('dropZone').classList.remove('dragging');setImageFile(e.dataTransfer.files[0]);};
$('editResult').onclick=()=>{const el=$('translatedText');el.readOnly=!el.readOnly;$('editResult').textContent=el.readOnly?'Edit Text':'Done Editing';if(!el.readOnly)el.focus();};
$('copyResult').onclick=async()=>status('imageStatus',await copyText($('translatedText').value)?'Text copied to clipboard.':'Copy failed.','success');
$('saveText').onclick=()=>download('translated-text.txt',$('translatedText').value);
$('speakText').onclick=()=>{const text=$('translatedText').value.trim();if(!text){status('imageStatus','There is no text to speak yet.','error');return;}if(!('speechSynthesis' in window)){status('imageStatus','Speech synthesis is not supported in this browser.','error');return;}speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.rate=.9;speechSynthesis.speak(utterance);};

// Image recognition is offline and works best on straight photos of printed,
// high-contrast Grade 1 Braille. Embossed paper often needs specialist OCR.
function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function groupCoords(points, axis, tolerance) {
  const groups = [];
  for (const point of [...points].sort((a, b) => a[axis] - b[axis])) {
    const group = groups[groups.length - 1];
    if (group && Math.abs(point[axis] - group.mean) <= tolerance) {
      group.points.push(point);
      group.mean = group.points.reduce((sum, p) => sum + p[axis], 0) / group.points.length;
    } else {
      groups.push({mean: point[axis], points: [point]});
    }
  }
  return groups;
}

// Interpret detected six-dot masks, including capital and number indicators.
function decodeCells(patterns) {
  return decodeBraille(patterns);
}

function extractDots(img, thresholdAdjustment = 0) {
  const scale = Math.min(1, 1100 / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  if (!width || !height) throw new Error('Unable to read the image dimensions.');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  ctx.drawImage(img, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const gray = new Uint8Array(width * height);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < gray.length; i++) {
    const k = i * 4;
    const value = Math.round(rgba[k] * 0.299 + rgba[k + 1] * 0.587 + rgba[k + 2] * 0.114);
    gray[i] = value;
    histogram[value]++;
  }

  // Otsu threshold, adjusted slightly when retrying tricky images.
  let total = 0;
  for (let i = 0; i < 256; i++) total += i * histogram[i];
  let backgroundTotal = 0, backgroundCount = 0, maximum = -1, threshold = 128;
  for (let i = 0; i < 256; i++) {
    backgroundCount += histogram[i];
    if (!backgroundCount) continue;
    const foregroundCount = gray.length - backgroundCount;
    if (!foregroundCount) break;
    backgroundTotal += i * histogram[i];
    const difference = backgroundTotal / backgroundCount - (total - backgroundTotal) / foregroundCount;
    const betweenVariance = backgroundCount * foregroundCount * difference * difference;
    if (betweenVariance > maximum) { maximum = betweenVariance; threshold = i; }
  }
  threshold = Math.max(20, Math.min(235, threshold + thresholdAdjustment));

  const dark = new Uint8Array(gray.length);
  const visited = new Uint8Array(gray.length);
  for (let i = 0; i < gray.length; i++) dark[i] = gray[i] <= threshold ? 1 : 0;

  const found = [];
  const stack = [];
  // Connected components: flood-fill all dark blobs and keep circular dot candidates.
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    const seed = y * width + x;
    if (!dark[seed] || visited[seed]) continue;
    stack.push(seed); visited[seed] = 1;
    let area = 0, minX = x, maxX = x, minY = y, maxY = y, sumX = 0, sumY = 0;
    while (stack.length) {
      const index = stack.pop(), px = index % width, py = (index / width) | 0;
      area++; sumX += px; sumY += py;
      minX = Math.min(minX, px); maxX = Math.max(maxX, px);
      minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      // Explicit x/y boundaries avoid accidentally connecting edges of adjacent rows.
      if (px > 0 && dark[index - 1] && !visited[index - 1]) { visited[index - 1] = 1; stack.push(index - 1); }
      if (px < width - 1 && dark[index + 1] && !visited[index + 1]) { visited[index + 1] = 1; stack.push(index + 1); }
      if (py > 0 && dark[index - width] && !visited[index - width]) { visited[index - width] = 1; stack.push(index - width); }
      if (py < height - 1 && dark[index + width] && !visited[index + width]) { visited[index + width] = 1; stack.push(index + width); }
    }
    const dotWidth = maxX - minX + 1, dotHeight = maxY - minY + 1;
    const aspect = Math.max(dotWidth, dotHeight) / Math.max(1, Math.min(dotWidth, dotHeight));
    if (area >= 4 && dotWidth >= 2 && dotHeight >= 2 &&
        dotWidth < width * .12 && dotHeight < height * .12 &&
        aspect < 1.8 && area / (dotWidth * dotHeight) > .38) {
      found.push({x: sumX / area, y: sumY / area, area, width: dotWidth, height: dotHeight});
    }
  }
  if (found.length < 2) throw new Error('Could not find enough dark Braille dots. Try a sharp, straight image with dark dots on white paper.');
  const typicalArea = median(found.map(p => p.area));
  const dots = found.filter(p => p.area >= typicalArea * .35 && p.area <= typicalArea * 2.8);
  if (dots.length < 2) throw new Error('Detected shapes do not look like consistent Braille dots.');
  return dots;
}

function recognizeBraille(img) {
  let dots;
  try { dots = extractDots(img); }
  catch (error) { dots = extractDots(img, 18); }

  const diameter = median(dots.map(p => Math.max(p.width, p.height)));
  // Cluster all dot centers into observed image rows and columns.
  const rows = groupCoords(dots, 'y', Math.max(2, diameter * .65));
  const columns = groupCoords(dots, 'x', Math.max(2, diameter * .65));
  if (rows.length < 2 || columns.length < 2) {
    throw new Error('Dot grid not detected. Crop the image to the Braille area and try again.');
  }
  const yGaps = rows.slice(1).map((r, i) => r.mean - rows[i].mean);
  const xGaps = columns.slice(1).map((c, i) => c.mean - columns[i].mean);
  const rowPitch = median(yGaps.filter(g => g > diameter * 1.1 && g < diameter * 5)) || diameter * 2.2;
  const colPitch = Math.min(...xGaps.filter(g => g > diameter * 1.1)) || diameter * 2.2;

  // Separate text lines only at gaps larger than one three-row Braille cell.
  const lines = [];
  let current = [];
  for (const row of rows) {
    if (current.length && row.mean - current[current.length - 1].mean > rowPitch * 1.85) {
      lines.push(current); current = [];
    }
    current.push(row);
  }
  if (current.length) lines.push(current);

  const translations = [];
  for (const lineRows of lines) {
    const top = lineRows[0].mean;
    const bottom = lineRows[lineRows.length - 1].mean;
    const lineDots = dots.filter(p => p.y >= top - rowPitch * .45 && p.y <= bottom + rowPitch * .45);
    const lineColumns = groupCoords(lineDots, 'x', Math.max(2, diameter * .65)).map(g => g.mean);
    if (!lineColumns.length) continue;

    // A tight pair of columns belongs to one cell; larger gaps start new cells.
    // Blank columns cannot always be recovered from photographs, so output is approximate.
    const cells = [];
    for (let i = 0; i < lineColumns.length;) {
      const left = lineColumns[i];
      let right = left + colPitch;
      if (i + 1 < lineColumns.length && lineColumns[i + 1] - left <= colPitch * 1.4) {
        right = lineColumns[i + 1]; i += 2;
      } else { i++; }
      let pattern = '';
      for (const dot of lineDots) {
        const leftSide = Math.abs(dot.x - left) < colPitch * .38;
        const rightSide = !leftSide && Math.abs(dot.x - right) < colPitch * .38;
        if (!leftSide && !rightSide) continue;
        const row = Math.round((dot.y - top) / rowPitch);
        if (row < 0 || row > 2) continue;
        pattern += String((leftSide ? 1 : 4) + row);
      }
      pattern = [...new Set(pattern)].sort().join('');
      if (pattern) cells.push({x: left, pattern});
    }
    if (!cells.length) continue;
    const patterns = [];
    for (let i = 0; i < cells.length; i++) {
      if (i && cells[i].x - cells[i - 1].x > colPitch * 3.6) patterns.push('');
      patterns.push(cells[i].pattern);
    }
    translations.push(decodeCells(patterns));
  }
  if (!translations.length) throw new Error('Could not assemble the Braille cells. Try a clearer cropped photo.');
  const result = translations.join('\n');
  if (!result.replace(/[�\s]/g, '')) throw new Error('Dots detected, but no recognizable Grade 1 letters were found.');
  return {text: result, dotCount: dots.length, lines: translations.length};
}

$('translateImage').onclick=()=>{
  if(!uploadedImage){status('imageStatus','Upload a Braille image first.','error');return;}
  status('imageStatus','Analyzing dots in your image...');
  setTimeout(()=>{try{const result=recognizeBraille(uploadedImage);$('translatedText').value=result.text;status('imageStatus',`Detected ${result.dotCount} dots across ${result.lines} line(s). Please verify the translation. It's experimental.`,'success');}catch(error){status('imageStatus',error.message,'error');}},50);
};
for(const letter of alphabet){const el=document.createElement('div');el.className='cell-unit';el.innerHTML=dotHTML(letterMap[letter])+'<small></small>';el.querySelector('small').textContent=letter.toUpperCase();$('alphabetGrid').append(el);}
translateText();
if(location.hash==='#learn')showView('learn');else if(location.hash==='#about')showView('about');
