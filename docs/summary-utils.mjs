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
