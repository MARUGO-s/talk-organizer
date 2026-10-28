export function summaryTitle(text, fallback = 'まとめ') {
  const lines = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const heading = lines.find(line => /^#{1,6}\s+\S/.test(line));
  const first = lines[0] || '';
  const firstIsTitle = /^#{1,6}\s+\S/.test(first) || /^\*\*[^*]+\*\*$/.test(first);
  const candidate = (firstIsTitle ? first : heading) || (first.length <= 100 && !/^[-*]\s|^\||^\d+[.)]\s/.test(first) ? first : '') || fallback;
  const cleaned = candidate
    .replace(/^#{1,6}\s*/, '')
    .replace(/\s+#+\s*$/, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`]/g, '')
    .replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  return [...(cleaned || 'まとめ')].slice(0, 100).join('');
}

export function combineTalks(files) {
  return files.map(file => `【${file.file_name}】\n${file.content}`).join('\n\n');
}

export const MAX_COMBINED_CHARACTERS = 1500000;

export function printSummary(text, fallback, doc, win) {
  const previousTitle = doc.title;
  const restore = () => { doc.title = previousTitle; };
  doc.title = summaryTitle(text, fallback);
  win.addEventListener('afterprint', restore, { once: true });
  try { win.print(); } catch (error) { restore(); throw error; }
}

// Preserve each Markdown table as editable spreadsheet columns, and keep other
// lines in their original order. Multiple tables retain their own headers.
export function summaryCsv(text, sources = []) {
  const rows = [];
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const splitTable = line => {
    const cells = [];
    let cell = '';
    const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
    for (let i = 0; i < body.length; i++) {
      if (body[i] === '\\' && body[i + 1] === '|') { cell += '|'; i++; }
      else if (body[i] === '|') { cells.push(cell.trim()); cell = ''; }
      else cell += body[i];
    }
    cells.push(cell.trim());
    return cells;
  };
  for (const line of lines) {
    const value = line.trim();
    if (!value) { rows.push([]); continue; }
    if (/^\|.*\|$/.test(value)) {
      const cells = splitTable(value);
      if (cells.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
      rows.push(cells);
    } else {
      rows.push([value.replace(/^#{1,6}\s+/, '').replace(/^[-*]\s+/, '')]);
    }
  }
  if (Array.isArray(sources) && sources.length) {
    rows.push([], ['参照先']);
    for (const source of sources) {
      if (source && (source.title || source.url)) rows.push([String(source.title || ''), String(source.url || '')]);
    }
  }
  const cell = value => {
    let safe = String(value ?? '');
    // Spreadsheet programs can execute cells beginning with formula characters.
    if (/^[\s\u0000-\u001f]*[=+@-]/.test(safe)) safe = "'" + safe;
    return '"' + safe.replace(/"/g, '""') + '"';
  };
  return '\ufeff' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
