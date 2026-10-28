import { loadRefineContext } from '../supabase/functions/talk-organizer-api/refine.ts';
import { deepStrictEqual as assertEquals } from 'node:assert/strict';
function db(ids: string[]|null, files: any[], fileError: unknown = null) {
 return {from(table: string) {return table === 'talk_organizer_summaries'
  ? {select(){return {eq(){return {single:async()=>({data:{content:'元のまとめ',source_file_ids:ids},error:null})}}}}}
  : {select(){return {in:async()=>({data:files,error:fileError})}}};}};
}
Deno.test('複数の元履歴を記録された順番ですべて参照する',async()=>{
 const result=await loadRefineContext(db(['a','b'],[{id:'b',file_name:'二.txt',content:'二'},{id:'a',file_name:'一.txt',content:'一'}]),'id','元のまとめ',false);
 assertEquals(result,{summary:'元のまとめ',source:'【一.txt】\n一\n\n【二.txt】\n二',sourceIds:['a','b'],summaryOnly:false});
});
Deno.test('履歴が一部削除されていたら確認を求め、許可後だけまとめのみで続行',async()=>{
 const source=db(['a','b'],[{id:'a',file_name:'一.txt',content:'一'}]);
 const denied=await loadRefineContext(source,'id','元のまとめ',false);
 assertEquals('code' in denied && denied.code,'source_missing');
 const accepted=await loadRefineContext(source,'id','元のまとめ',true);
 assertEquals(accepted,{summary:'元のまとめ',source:'',sourceIds:['a','b'],summaryOnly:true});
});
Deno.test('旧まとめは元の履歴を推測せず、明示的な許可を求める',async()=>{
 const source=db(null,[]);
 const denied=await loadRefineContext(source,'id','元のまとめ',false);
 assertEquals('code' in denied && denied.code,'source_unknown');
 const accepted=await loadRefineContext(source,'id','元のまとめ',true);
 assertEquals(accepted,{summary:'元のまとめ',source:'',sourceIds:null,summaryOnly:true});
});
Deno.test('履歴の取得失敗を削除扱いにせず、まとめの変更も検出する',async()=>{
 const failed=await loadRefineContext(db(['a'],[],{message:'network'}),'id','元のまとめ',true);
 assertEquals('status' in failed && failed.status,503);
 const changed=await loadRefineContext(db(['a'],[]),'id','古いまとめ',false);
 assertEquals('code' in changed && changed.code,'summary_changed');
});
