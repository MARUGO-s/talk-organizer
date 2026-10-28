export function tableCells(line) {
  const source = line.trim().slice(1, -1), cells = [];
  let cell = '';
  for (let i = 0; i < source.length; i++) {
    if (source[i] === '\\' && source[i + 1] === '|') { cell += '\\|'; i++; }
    else if (source[i] === '|') { cells.push(cell.trim()); cell = ''; }
    else cell += source[i];
  }
  cells.push(cell.trim());
  return cells;
}
function visible(text) {
  return text.replace(/\\\|/g, '|').replace(/\*\*(.+?)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}
export function createSummaryEditor(text, doc) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  const originalLines = lines.slice(), edits = [], resets = [];
  const article = doc.createElement('article');
  article.className = 'result-markdown summary-editor';
  function field(element, raw, save) {
    const initial = visible(raw);
    element.textContent = initial;
    element.setAttribute('contenteditable', 'plaintext-only');
    element.setAttribute('role', 'textbox');
    element.setAttribute('aria-label', '内容を編集');
    element.addEventListener('paste', event => {
      event.preventDefault();
      const value = event.clipboardData?.getData('text/plain') || '';
      doc.execCommand('insertText', false, value);
    });
    edits.push(() => { if (element.textContent !== initial) save(element.textContent || ''); });
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], trimmed = line.trim();
    if (!trimmed) continue;
    if (/^\|.*\|$/.test(trimmed)) {
      const table = doc.createElement('table');
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const index = i, cells = tableCells(lines[i]), originalCells = cells.slice();
        resets.push(() => { cells.splice(0, cells.length, ...originalCells); });
        if (cells.every(c => /^:?-{3,}:?$/.test(c))) { i++; continue; }
        const row = doc.createElement('tr');
        const header = table.children.length === 0;
        cells.forEach((cell, column) => {
          const el = doc.createElement(header ? 'th' : 'td');
          field(el, cell, value => { cells[column] = value.replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|'); lines[index] = '| ' + cells.join(' | ') + ' |'; });
          row.appendChild(el);
        });
        table.appendChild(row); i++;
      }
      i--; article.appendChild(table); continue;
    }
    const match = line.match(/^(\s*(?:#{1,3}\s+|[-*]\s+)?)(.*)$/);
    const prefix = match[1], index = i;
    const heading = prefix.trim().match(/^(#{1,3})/);
    const el = doc.createElement(heading ? 'h' + heading[1].length : 'p');
    if (/^\s*[-*]\s/.test(prefix)) el.className = 'edit-list-item';
    field(el, match[2], value => { lines[index] = prefix + value.replace(/\r\n?/g, '\n'); });
    article.appendChild(el);
  }
  return { element: article, value() { lines.splice(0, lines.length, ...originalLines); resets.forEach(reset => reset()); edits.forEach(apply => apply()); return lines.join('\n'); } };
}
