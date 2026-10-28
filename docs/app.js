import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/+esm';
import {printSummary, summaryCsv, summaryTitle, combineTalks, MAX_COMBINED_CHARACTERS} from './summary-utils.mjs?v=20261029-5';
import {SHARED_ACCOUNT_EMAIL, isSharedLoginId} from './shared-login.mjs';
import {createSummaryEditor, tableCells} from './summary-editor.mjs?v=20261029-6';
const sb=createClient('https://ycsqfajidusuibqljjwr.supabase.co','sb_publishable_xAOS8yDSozbiGYnEwejKwQ_SZ4MYMmB');
const $=s=>document.querySelector(s);let selected=[],last='',lastSources=[],lastTitle='',lastId=null,lastSourceIds=null,editor=null,savingEdit=false,refining=false;
const login=$('#login-dialog'),settings=$('#settings-dialog'),question=$('#question'),fileInput=$('#file-input'),drop=$('#dropzone'),fileList=$('#file-list'),result=$('#result-content'),resultTools=$('#result-tools'),resultSources=$('#result-sources'),button=$('#analyze-button');
function notify(s){const n=$('#toast');n.textContent=s;n.classList.add('is-visible');setTimeout(()=>n.classList.remove('is-visible'),3000)}
function error(node,msg){node.textContent=msg;node.hidden=false}
function refreshButton(){button.disabled=!selected.length||!question.value.trim()}
function esc(x){return String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c])}
function inline(x){return esc(x).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/`([^`]+)`/g,'<code>$1</code>')}
function renderTable(data){
 const headers=data[0], rows=data.slice(1);
 const complex=headers.length>3||rows.some(row=>row.some((cell,i)=>cell.length>(i===0?24:55)));
 const table='<table'+(complex?' class="print-complex-table"':'')+'><thead><tr>'+headers.map(c=>'<th>'+inline(c)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+headers.map((_,i)=>'<td>'+inline(row[i]||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table>';
 if(!complex)return table;
 const cards='<div class="print-cards">'+rows.map(row=>'<section class="print-card"><h3>'+inline(row[0]||headers[0]||'項目')+'</h3>'+headers.slice(1).map((h,i)=>'<div class="print-field"><span class="print-field-label">'+inline(h)+'</span><span>'+inline(row[i+1]||'')+'</span></div>').join('')+'</section>').join('')+'</div>';
 return table+cards;
}
function markdown(t){const lines=t.replace(/\r/g,'').split('\n'), out=[];let list=false;for(let i=0;i<lines.length;i++){const l=lines[i].trim();if(/^\|.*\|$/.test(l)){if(list){out.push('</ul>');list=false}const rows=[];while(i<lines.length&&/^\s*\|.*\|\s*$/.test(lines[i]))rows.push(tableCells(lines[i++]).map(x=>x.replace(/\\\|/g,'|')));i--;const data=rows.filter(row=>!row.every(x=>/^:?-{3,}:?$/.test(x)));if(data.length)out.push(renderTable(data));continue}let m=l.match(/^(#{1,3})\s+(.+)/);if(m){if(list){out.push('</ul>');list=false}out.push('<h'+m[1].length+'>'+inline(m[2])+'</h'+m[1].length+'>');continue}m=l.match(/^[-*]\s+(.+)/);if(m){if(!list){out.push('<ul>');list=true}out.push('<li>'+inline(m[1])+'</li>');continue}if(list){out.push('</ul>');list=false}if(l)out.push('<p>'+inline(l)+'</p>')}if(list)out.push('</ul>');return out.join('')}
function display(text,sources=[],fallback='まとめ',id=null,sourceIds=null){editor=null;lastSourceIds=Array.isArray(sourceIds)&&sourceIds.length?sourceIds:null;last=text;lastSources=sources||[];sources=lastSources;lastTitle=fallback;lastId=id;setEditMode(false);resetRefine();result.innerHTML='<article class="result-markdown">'+markdown(text)+'</article>';resultTools.hidden=false;resultSources.replaceChildren();const safe=sources.filter(s=>{try{return ['http:','https:'].includes(new URL(s.url).protocol)}catch{return false}});if(safe.length){const h=document.createElement('strong');h.textContent='参照先';resultSources.append(h);safe.forEach(s=>{const a=document.createElement('a');a.href=s.url;a.textContent=s.title||s.url;a.target='_blank';a.rel='noopener noreferrer';resultSources.append(a)});resultSources.hidden=false}else resultSources.hidden=true}
function syncSelectedButtons(){document.querySelectorAll('[data-talk-id]').forEach(el=>{const active=selected.some(f=>f.id===el.dataset.talkId);el.textContent=active?'選択中':'使う';el.classList.toggle('is-selected',active);el.setAttribute('aria-pressed',String(active))})}
function showSelected(){fileList.replaceChildren();$('#selection-summary').textContent=selected.length?`${selected.length}件の履歴を選択中。まとめて検索します。`:'複数の履歴を追加・選択すると、一度にまとめられます。';if(!selected.length){fileList.innerHTML='<div class="empty-files"><span class="file-icon">TXT</span><span>まだファイルはありません</span></div>'}for(const f of selected){const row=document.createElement('div');row.className='file-item';const label=document.createElement('span');label.className='file-name';label.textContent=f.file_name;const remove=document.createElement('button');remove.className='remove-file';remove.textContent='×';remove.title='選択を解除';remove.onclick=()=>{selected=selected.filter(x=>x.id!==f.id);showSelected()};row.append(label,remove);fileList.append(row)}syncSelectedButtons();refreshButton()}
async function library(){const [f,s]=await Promise.all([sb.from('talk_organizer_files').select('id,file_name,created_at').order('created_at',{ascending:false}),sb.from('talk_organizer_summaries').select('id,title,created_at').order('created_at',{ascending:false})]);renderList($('#saved-files'),f,'files');renderList($('#saved-summaries'),s,'summaries')}
function renderList(target,response,kind){target.replaceChildren();if(response.error){target.textContent='一覧を読み込めませんでした。';return}if(!response.data.length){target.innerHTML='<p class="library-empty">保存されたものはありません</p>';return}for(const item of response.data){const row=document.createElement('div');row.className='library-item';const label=document.createElement('span');label.textContent=(item.file_name||item.title)+'　'+new Date(item.created_at).toLocaleDateString('ja-JP');const open=document.createElement('button');open.textContent=kind==='files'?'使う':'開く';if(kind==='files'){open.dataset.talkId=item.id;const active=selected.some(f=>f.id===item.id);open.textContent=active?'選択中':'使う';open.classList.toggle('is-selected',active);open.setAttribute('aria-pressed',String(active))}open.onclick=async()=>{if(kind==='files'&&selected.some(f=>f.id===item.id)){selected=selected.filter(f=>f.id!==item.id);showSelected();return}const {data,error:e}=await sb.from('talk_organizer_'+kind).select('*').eq('id',item.id).single();if(e){notify('読み込みに失敗しました');return}if(kind==='files'){if(!selected.some(x=>x.id===data.id))selected.push(data);showSelected();notify('履歴を選択しました')}else{if(!discardEdit())return;display(data.content,data.sources,data.title,data.id,data.source_file_ids);result.scrollIntoView({behavior:'smooth'})}};const del=document.createElement('button');del.className='delete';del.textContent='削除';del.onclick=async()=>{if(kind==='summaries'&&item.id===lastId&&(editor||refining)){notify('編集中は削除できません');return}if(!confirm('このファイルを削除しますか？'))return;const {error:e}=await sb.from('talk_organizer_'+kind).delete().eq('id',item.id);if(e){notify('削除できませんでした');return}if(kind==='files'){selected=selected.filter(x=>x.id!==item.id);showSelected()}await library();notify('削除しました')};row.append(label,open,del);target.append(row)}}
async function addFiles(list){for(const f of list){if(!f.name.toLowerCase().endsWith('.txt')){notify('テキストファイルを選択してください');continue}if(f.size>2000000){notify('ファイルが大きすぎます');continue}const content=await f.text();if(content.length>1500000){notify('ファイルが大きすぎます');continue}const {data,error:e}=await sb.from('talk_organizer_files').insert({file_name:f.name,content}).select().single();if(e){notify('保存できませんでした。再度お試しください');continue}selected.push(data)}showSelected();await library()}
drop.onclick=()=>fileInput.click();drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fileInput.click()}};fileInput.onchange=async()=>{await addFiles([...fileInput.files]);fileInput.value=''};for(const type of ['dragenter','dragover'])drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add('is-dragging')});for(const type of ['dragleave','drop'])drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('is-dragging')});drop.ondrop=e=>addFiles([...e.dataTransfer.files]);question.oninput=refreshButton;
async function canSetupShared(){
 const {data,error:err}=await sb.functions.invoke('talk-organizer-api',{body:{action:'shared_setup_status'}});
 if(err||data?.error)throw Error('初期設定の状態を確認できませんでした。');
 return data?.eligible===true;
}
async function showSession(session){
 const shared=session?.user?.email?.toLowerCase()===SHARED_ACCOUNT_EMAIL;
 if(shared){$('#shared-setup-open').hidden=true;await library();return true}
 try{if(await canSetupShared()){$('#shared-setup-open').hidden=false;await library();return true}}
 catch{notify('初期設定の状態を確認できませんでした。');return false}
 await sb.auth.signOut();$('#shared-setup-open').hidden=true;if(!login.open)login.showModal();return false;
}
$('#login-form').onsubmit=async e=>{
 e.preventDefault();const el=$('#login-error');el.hidden=true;
 if(!isSharedLoginId($('#login-id').value)){error(el,'IDまたはパスワードが違います。');return}
 const {data,error:err}=await sb.auth.signInWithPassword({email:SHARED_ACCOUNT_EMAIL,password:$('#login-password').value});
 if(err||!data.session){error(el,'IDまたはパスワードが違うか、共通ログインがまだ設定されていません。');return}
 $('#login-password').value='';login.close();await showSession(data.session);
};
$('#legacy-login-form').onsubmit=async e=>{
 e.preventDefault();const el=$('#legacy-error');el.hidden=true;
 const {data,error:err}=await sb.auth.signInWithPassword({email:$('#legacy-email').value.trim(),password:$('#legacy-password').value});
 $('#legacy-password').value='';if(err||!data.session){error(el,'初期設定用のログイン情報を確認してください。');return}
 try{if(!(await canSetupShared())){await sb.auth.signOut();error(el,'このアカウントでは初期設定できません。');return}}
 catch{error(el,'初期設定の状態を確認できませんでした。');return}
 login.close();$('#shared-setup-open').hidden=false;await library();
};
$('#signout').onclick=async()=>{if(!discardEdit())return;await sb.auth.signOut();selected=[];showSelected();last='';result.textContent='ログインしてください。';resultTools.hidden=true;resultSources.hidden=true;$('#shared-setup-open').hidden=true;if(!login.open)login.showModal()};
const sharedDialog=$('#shared-setup-dialog');
$('#shared-setup-open').onclick=()=>{$('#shared-password').value='';$('#shared-setup-error').hidden=true;sharedDialog.showModal()};
$('#shared-setup-close').onclick=()=>sharedDialog.close();
sharedDialog.addEventListener('close',()=>{$('#shared-password').value=''});
sharedDialog.addEventListener('click',e=>{if(e.target===sharedDialog)sharedDialog.close()});
$('#shared-setup-form').onsubmit=async e=>{
 e.preventDefault();const input=$('#shared-password'),el=$('#shared-setup-error'),save=$('#shared-setup-save');
 const password=input.value;el.hidden=true;save.disabled=true;
 try{
  const {data,error:err}=await sb.functions.invoke('talk-organizer-api',{body:{action:'setup_shared',password}});
  if(err||data?.error){let message=data?.error;try{if(!message&&err?.context)message=(await err.context.json()).error}catch{}throw Error(message||'初期設定を完了できませんでした。')}
  input.value='';const {data:signed,error:signError}=await sb.auth.signInWithPassword({email:SHARED_ACCOUNT_EMAIL,password});
  sharedDialog.close();selected=[];showSelected();$('#shared-setup-open').hidden=true;
  if(signError||!signed.session){await sb.auth.signOut();if(!login.open)login.showModal();error($('#login-error'),'共通ログインは設定済みです。IDとパスワードを入力してログインしてください。');return}
  await library();notify('共通ログインを設定し、履歴とAPIキーを引き継ぎました');
 }catch(err){error(el,err.message||'初期設定を完了できませんでした。')}
 finally{save.disabled=false}
};
$('#settings-open').onclick=async()=>{$('#api-key').value='';$('#settings-error').hidden=true;settings.showModal();const {data,error:e}=await sb.functions.invoke('talk-organizer-api',{body:{action:'key_status'}});$('#settings-status').textContent=e?'設定を確認できませんでした。':data.configured?'APIキーは保存済みです。':'APIキーは未設定です。'};$('#settings-close').onclick=()=>settings.close();settings.addEventListener('close',()=>{$('#api-key').value=''});settings.addEventListener('click',e=>{if(e.target===settings)settings.close()});$('#settings-form').onsubmit=async e=>{e.preventDefault();const save=$('#settings-save');save.disabled=true;$('#settings-error').hidden=true;const {data,error:err}=await sb.functions.invoke('talk-organizer-api',{body:{action:'save_key',key:$('#api-key').value}});save.disabled=false;if(err||data?.error){error($('#settings-error'),data?.error||'保存できませんでした');return}$('#api-key').value='';$('#settings-status').textContent='APIキーを保存しました。';notify('APIキーを保存しました')};
button.onclick=async()=>{if(button.disabled||!discardEdit())return;const chosen=selected.slice(), source=combineTalks(chosen),sourceIds=chosen.map(f=>f.id),request=question.value.trim();if(source.length>MAX_COMBINED_CHARACTERS){notify('選択した履歴の合計が上限を超えています。ファイル数を減らしてください');return}button.disabled=true;result.innerHTML='<div class="loading-state"><span class="loader"></span><strong>発言の流れを確認しています</strong></div>';resultTools.hidden=true;resultSources.hidden=true;try{const {data,error:err}=await sb.functions.invoke('talk-organizer-api',{body:{action:'analyze',question:request,source,webSearch:$('#web-search').checked}});if(err||data?.error)throw Error(data?.error||'処理に失敗しました。API設定と利用状況を確認してください。');display(data.text,data.citations||[],request);const {data:saved,error:saveError}=await sb.from('talk_organizer_summaries').insert({title:request.slice(0,100),question:request,content:data.text,sources:data.citations||[],source_file_ids:sourceIds}).select('id').single();if(saveError)notify('まとめは表示されましたが、保存できませんでした');else{if(last===data.text&&lastId===null){lastId=saved.id;lastSourceIds=sourceIds;$('#edit-button').hidden=false;$('#refine-area').hidden=false;resetRefine()}notify('まとめを保存しました');await library()}}catch(e){result.innerHTML='<div class="error-state">'+esc(e.message)+'</div>'}finally{refreshButton()}};
function setEditMode(active){
 $('#refine-area').hidden=active||!lastId;
 $('#edit-button').hidden=active||!lastId;$('#edit-cancel').hidden=!active;$('#edit-save').hidden=!active;$('#edit-help').hidden=!active;
 for(const id of ['copy-button','csv-button','download-button'])$('#'+id).hidden=active;
}
function discardEdit(){if(savingEdit||refining){notify('処理中です。しばらくお待ちください');return false}if(!editor)return true;if(editor.value()!==last&&!confirm('編集中の変更を破棄しますか？'))return false;editor=null;display(last,lastSources,lastTitle,lastId,lastSourceIds);return true}
window.addEventListener('beforeunload',event=>{if(editor&&editor.value()!==last){event.preventDefault();event.returnValue=''}});
$('#edit-button').onclick=()=>{if(!lastId||refining)return;editor=createSummaryEditor(last,document);result.replaceChildren(editor.element);setEditMode(true);editor.element.querySelector('[contenteditable]')?.focus()};
$('#edit-cancel').onclick=()=>{if(!discardEdit())return;display(last,lastSources,lastTitle,lastId,lastSourceIds)};
$('#edit-save').onclick=async()=>{
 if(!editor||savingEdit)return;const content=editor.value();if(!content.trim()){notify('まとめを空にすることはできません');return}
 if(content===last){editor=null;display(last,lastSources,lastTitle,lastId,lastSourceIds);return}
 savingEdit=true;$('#edit-save').disabled=true;$('#edit-cancel').disabled=true;
 try{
  const {data,error}=await sb.rpc('talk_organizer_update_summary',{p_id:lastId,p_original:last,p_content:content});
  if(error)throw error;
  if(data!==true){const check=await sb.from('talk_organizer_summaries').select('content').eq('id',lastId).single();if(check.error){notify('保存結果を確認できません。編集内容を控えて確認してください');return}if(check.data?.content!==content){notify('他の変更があるため保存できません。編集内容を控えてから開き直してください');return}}
  last=content;editor=null;display(last,lastSources,lastTitle,lastId,lastSourceIds);notify('変更を保存しました');
 }catch{
  try{const {data,error}=await sb.from('talk_organizer_summaries').select('content').eq('id',lastId).single();
   if(!error&&data?.content===content){last=content;editor=null;display(last,lastSources,lastTitle,lastId,lastSourceIds);notify('変更を保存しました')}
   else notify(error?'保存結果を確認できません。編集内容を控えて確認してください':'保存されていません。編集内容は画面に残っています');
  }catch{notify('保存結果を確認できません。編集内容を控えて確認してください')}
 }finally{savingEdit=false;$('#edit-save').disabled=false;$('#edit-cancel').disabled=false}
};
function resetRefine(){
 $('#refine-question').value='';$('#refine-notice').hidden=true;$('#refine-summary-only').hidden=true;$('#refine-link').hidden=!!lastSourceIds;
}
function refineNotice(message,allowFallback=false){$('#refine-notice').textContent=message;$('#refine-notice').hidden=false;$('#refine-summary-only').hidden=!allowFallback}
$('#refine-question').oninput=()=>{$('#refine-notice').hidden=true;$('#refine-summary-only').hidden=true};
$('#refine-link').onclick=async()=>{
 if(refining||!lastId||lastSourceIds)return;
 if(!selected.length){refineNotice('左側で元のトーク履歴を選択してから、このボタンを押してください。');return}
 const ids=selected.map(file=>file.id),names=selected.map(file=>file.file_name).join('、');
 if(!confirm(`「${names}」をこのまとめの元の履歴として紐づけますか？\n実際にまとめの作成に使った履歴を選んでください。`))return;
 refining=true;$('#refine-link').disabled=true;
 try{const {data,error}=await sb.from('talk_organizer_summaries').update({source_file_ids:ids}).eq('id',lastId).is('source_file_ids',null).select('source_file_ids').maybeSingle();
  if(error||!data){refineNotice('紐づけを確認できませんでした。まとめを開き直して確認してください。');return}
  lastSourceIds=data.source_file_ids;$('#refine-link').hidden=true;refineNotice('元のトーク履歴を紐づけました。');
 }catch{refineNotice('紐づけを確認できませんでした。まとめを開き直して確認してください。')}
 finally{refining=false;$('#refine-link').disabled=false}
};
async function refineSummary(summaryOnly=false){
 const request=$('#refine-question').value.trim();if(!request){refineNotice('追加のお願いを入力してください。');return}
 if(!lastId||editor||refining)return;
 const id=lastId,original=last,oldTitle=lastTitle,oldSources=lastSources;
 refining=true;$('#refine-submit').disabled=true;$('#refine-summary-only').disabled=true;$('#refine-link').disabled=true;$('#edit-button').disabled=true;
 refineNotice('元の資料を確認しています。しばらくお待ちください。');
 try{
  const {data,error}=await sb.functions.invoke('talk-organizer-api',{body:{action:'refine',summary_id:id,original_content:original,question:request,allow_summary_only:summaryOnly}});
  if(error||data?.error){let detail=data;try{if(error?.context)detail=await error.context.json()}catch{};
   const fallback=detail?.code==='source_missing'||detail?.code==='source_unknown';refineNotice(detail?.error||'追加のお願いを処理できませんでした。',fallback);return}
  const citations=[...oldSources,...(data.citations||[])].filter((source,index,all)=>all.findIndex(other=>other.url===source.url)===index);
  const title=summaryTitle(data.text,oldTitle), refs=data.source_file_ids;
  let saved=null,saveError=null;try{const reply=await sb.from('talk_organizer_summaries').insert({title,question:request,content:data.text,sources:citations,source_file_ids:refs}).select('id').single();saved=reply.data;saveError=reply.error}catch(e){saveError=e}
  display(data.text,citations,title,saveError||!saved?null:saved.id,refs);
  if(saveError||!saved)notify('結果は表示されましたが、保存を確認できませんでした。コピーして保管してください');
  else{notify('新しいまとめとして保存しました');await library()}
 }catch{refineNotice('追加のお願いを処理できませんでした。元のまとめは保存されています。')}
 finally{refining=false;$('#refine-submit').disabled=false;$('#refine-summary-only').disabled=false;$('#refine-link').disabled=false;$('#edit-button').disabled=false}
}
$('#refine-submit').onclick=()=>refineSummary(false);
$('#refine-summary-only').onclick=()=>refineSummary(true);
$('#copy-button').onclick=async()=>{if(last){try{await navigator.clipboard.writeText(last);notify('コピーしました')}catch{notify('コピーできませんでした')}}};$('#download-button').onclick=()=>{if(last)printSummary(last,lastTitle,document,window)};
$('#csv-button').onclick=()=>{if(!last)return;try{const blob=new Blob([summaryCsv(last,lastSources)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=summaryTitle(last,lastTitle)+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch{notify('CSVを保存できませんでした')}};
const {data:{session}}=await sb.auth.getSession();if(session){await showSession(session)}else login.showModal();showSelected();
