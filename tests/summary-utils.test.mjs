import test from 'node:test';
import assert from 'node:assert/strict';
import {summaryTitle, summaryCsv, combineTalks, MAX_COMBINED_CHARACTERS, printSummary} from '../docs/summary-utils.mjs';
test('まとめの見出しをPDF保存名に使う',()=>{
 assert.equal(summaryTitle('# 生ハムOEM「掬月」まとめ\n\n内容'), '生ハムOEM「掬月」まとめ');
 assert.equal(summaryTitle('**八幡平フェアまとめ**\n内容'), '八幡平フェアまとめ');
 assert.equal(summaryTitle('**生ハムOEM「掬月」まとめ**\n\n## 1. 現状'), '生ハムOEM「掬月」まとめ');
 assert.equal(summaryTitle('','以前の質問'), '以前の質問');
 assert.equal(summaryTitle('# A/B: C?'), 'A B C');
});
test('複数履歴をファイル名と本文を保ってまとめる',()=>{
 const text=combineTalks([{file_name:'1.txt',content:'一つ目の履歴'},{file_name:'2.txt',content:'二つ目の履歴'}]);
 assert.equal(text,'【1.txt】\n一つ目の履歴\n\n【2.txt】\n二つ目の履歴');
 assert.equal(combineTalks([]),'');assert.equal(MAX_COMBINED_CHARACTERS,1500000);
});
test('印刷時に見出しをタイトルにし終了後に戻す',()=>{
 const doc={title:'トーク整理室'};let after;let seen;const win={addEventListener:(event,fn)=>{assert.equal(event,'afterprint');after=fn},print:()=>{seen=doc.title}};
 printSummary('# 生ハムOEM「掬月」まとめ','まとめ',doc,win);assert.equal(seen,'生ハムOEM「掬月」まとめ');after();assert.equal(doc.title,'トーク整理室');
});
test('CSVは日本語をBOM付きUTF-8で保持し、表をセルに分ける',()=>{
 const csv=summaryCsv('# 八幡平フェア\n\n| 店舗 | 食材・期間 |\n| --- | --- |\n| マルゴ | 舞茸、11月 |\n| CAVA | "羊" と豚 |\n\n## 確認事項\n- 量は未定', [{title:'参考',url:'https://example.com/'}]);
 assert.equal(csv, '\ufeff"八幡平フェア"\r\n\r\n"店舗","食材・期間"\r\n"マルゴ","舞茸、11月"\r\n"CAVA","""羊"" と豚"\r\n\r\n"確認事項"\r\n"量は未定"\r\n\r\n"参照先"\r\n"参考","https://example.com/"\r\n');
 assert.deepEqual([...new TextEncoder().encode(csv).slice(0,3)], [0xef,0xbb,0xbf]);
});
test('CSVはエスケープされた縦線と危険な式を安全に扱う',()=>{
 const csv=summaryCsv('| 店舗 | 値 |\n| --- | --- |\n| A\\|B | =1+1 |\n| C | @危険 |');
 assert.ok(csv.includes('"A|B","\'=1+1"'));
 assert.ok(csv.includes('"C","\'@危険"'));
});
