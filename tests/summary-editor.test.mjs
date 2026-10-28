import test from 'node:test';
import assert from 'node:assert/strict';
import {createSummaryEditor, tableCells} from '../docs/summary-editor.mjs';
class Element {
  constructor(tag) { this.tagName=tag; this.children=[]; this.textContent=''; }
  setAttribute() {}
  addEventListener() {}
  appendChild(child) { this.children.push(child); }
}
const document={createElement:tag=>new Element(tag)};
test('既存の文章と表を保持し、変更したセルだけ保存する',()=>{
 const original='# 見出し\n\n**説明**\n\n| 店舗 | 期間 | 食材 |\n| --- | --- | --- |\n| マルゴ | 11月 | 舞茸 |\n\n- 未確定';
 const editor=createSummaryEditor(original,document);
 assert.equal(editor.value(),original);
 const [heading,description,table,list]=editor.element.children;
 heading.textContent='新しい見出し';
 table.children[1].children[1].textContent='12月';
 table.children[1].children[2].textContent='羊|豚';
 assert.equal(editor.value(),'# 新しい見出し\n\n**説明**\n\n| 店舗 | 期間 | 食材 |\n| --- | --- | --- |\n| マルゴ | 12月 | 羊\\|豚 |\n\n- 未確定');
 heading.textContent='見出し';table.children[1].children[1].textContent='11月';table.children[1].children[2].textContent='舞茸';
 assert.equal(editor.value(),original);
 assert.equal(description.textContent,'説明');assert.equal(list.textContent,'未確定');
});
test('表内のエスケープされた縦線を同一セルとして扱う',()=>{
 assert.deepEqual(tableCells('| A\\|B | 11月 |'),['A\\|B','11月']);
});
