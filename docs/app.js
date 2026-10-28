import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.95.3/+esm';
import {printSummary, summaryCsv, summaryTitle, combineTalks, MAX_COMBINED_CHARACTERS} from './summary-utils.mjs?v=20261029-5';
import {SHARED_ACCOUNT_EMAIL, isSharedLoginId} from './shared-login.mjs';
const sb=createClient('https://ycsqfajidusuibqljjwr.supabase.co','sb_publishable_xAOS8yDSozbiGYnEwejKwQ_SZ4MYMmB');
const $=s=>document.querySelector(s);let selected=[],last='',lastSources=[],lastTitle='';
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
function markdown(t){const lines=t.replace(/\r/g,'').split('\n'), out=[];let list=false;for(let i=0;i<lines.length;i++){const l=lines[i].trim();if(/^\|.*\|$/.test(l)){if(list){out.push('</ul>');list=false}const rows=[];while(i<lines.length&&/^\s*\|.*\|\s*$/.test(lines[i]))rows.push(lines[i++].trim().slice(1,-1).split('|').map(x=>x.trim()));i--;const data=rows.filter(row=>!row.every(x=>/^:?-{3,}:?$/.test(x)));if(data.length)out.push(renderTable(data));continue}let m=l.match(/^(#{1,3})\s+(.+)/);if(m){if(list){out.push('</ul>');list=false}out.push('<h'+m[1].length+'>'+inline(m[2])+'</h'+m[1].length+'>');continue}m=l.match(/^[-*]\s+(.+)/);if(m){if(!list){out.push('<ul>');list=true}out.push('<li>'+inline(m[1])+'</li>');continue}if(list){out.push('</ul>');list=false}if(l)out.push('<p>'+inline(l)+'</p>')}if(list)out.push('</ul>');return out.join('')}
function display(text,sources=[],fallback='まとめ'){last=text;lastSources=sources;lastTitle=fallback;result.innerHTML='<article class="result-markdown">'+markdown(text)+'</article>';resultTools.hidden=false;resultSources.replaceChildren();const safe=sources.filter(s=>{try{return ['http:','https:'].includes(new URL(s.url).protocol)}catch{return false}});if(safe.length){const h=document.createElement('strong');h.textContent='参照先';resultSources.append(h);safe.forEach(s=>{const a=document.createElement('a');a.href=s.url;a.textContent=s.title||s.url;a.target='_blank';a.rel='noopener noreferrer';resultSources.append(a)});resultSources.hidden=false}else resultSources.hidden=true}
function syncSelectedButtons(){document.querySelectorAll('[data-talk-id]').forEach(el=>{const active=selected.some(f=>f.id===el.dataset.talkId);el.textContent=active?'選択中':'使う';el.classList.toggle('is-selected',active);el.setAttribute('aria-pressed',String(active))})}
function showSelected(){fileList.replaceChildren();$('#selection-summary').textContent=selected.length?`${selected.length}件の履歴を選択中。まとめて検索します。`:'複数の履歴を追加・選択すると、一度にまとめられます。';if(!selected.length){fileList.innerHTML='<div class="empty-files"><span class="file-icon">TXT</span><span>まだファイルはありません</span></div>'}for(const f of selected){const row=document.createElement('div');row.className='file-item';const label=document.createElement('span');label.className='file-name';label.textContent=f.file_name;const remove=document.createElement('button');remove.className='remove-file';remove.textContent='×';remove.title='選択を解除';remove.onclick=()=>{selected=selected.filter(x=>x.id!==f.id);showSelected()};row.append(label,remove);fileList.append(row)}syncSelectedButtons();refreshButton()}
async function library(){const [f,s]=await Promise.all([sb.from('talk_organizer_files').select('id,file_name,created_at').order('created_at',{ascending:false}),sb.from('talk_organizer_summaries').select('id,title,created_at').order('created_at',{ascending:false})]);renderList($('#saved-files'),f,'files');renderList($('#saved-summaries'),s,'summaries')}
function renderList(target,response,kind){target.replaceChildren();if(response.error){target.textContent='一覧を読み込めませんでした。';return}if(!response.data.length){target.innerHTML='<p class="library-empty">保存されたものはありません</p>';return}for(const item of response.data){const row=document.createElement('div');row.className='library-item';const label=document.createElement('span');label.textContent=(item.file_name||item.title)+'　'+new Date(item.created_at).toLocaleDateString('ja-JP');const open=document.createElement('button');open.textContent=kind==='files'?'使う':'開く';if(kind==='files'){open.dataset.talkId=item.id;const active=selected.some(f=>f.id===item.id);open.textContent=active?'選択中':'使う';open.classList.toggle('is-selected',active);open.setAttribute('aria-pressed',String(active))}open.onclick=async()=>{if(kind==='files'&&selected.some(f=>f.id===item.id)){selected=selected.filter(f=>f.id!==item.id);showSelected();return}const {data,error:e}=await sb.from('talk_organizer_'+kind).select('*').eq('id',item.id).single();if(e){notify('読み込みに失敗しました');return}if(kind==='files'){if(!selected.some(x=>x.id===data.id))selected.push(data);showSelected();notify('履歴を選択しました')}else{display(data.content,data.sources,data.title);result.scrollIntoView({behavior:'smooth'})}};const del=document.createElement('button');del.className='delete';del.textContent='削除';del.onclick=async()=>{if(!confirm('このファイルを削除しますか？'))return;const {error:e}=await sb.from('talk_organizer_'+kind).delete().eq('id',item.id);if(e){notify('削除できませんでした');return}if(kind==='files'){selected=selected.filter(x=>x.id!==item.id);showSelected()}await library();notify('削除しました')};row.append(label,open,del);target.append(row)}}
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
$('#signout').onclick=async()=>{await sb.auth.signOut();selected=[];showSelected();last='';result.textContent='ログインしてください。';resultTools.hidden=true;resultSources.hidden=true;$('#shared-setup-open').hidden=true;if(!login.open)login.showModal()};
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
button.onclick=async()=>{if(button.disabled)return;const source=combineTalks(selected);if(source.length>MAX_COMBINED_CHARACTERS){notify('選択した履歴の合計が上限を超えています。ファイル数を減らしてください');return}button.disabled=true;result.innerHTML='<div class="loading-state"><span class="loader"></span><strong>発言の流れを確認しています</strong></div>';resultTools.hidden=true;resultSources.hidden=true;try{const {data,error:err}=await sb.functions.invoke('talk-organizer-api',{body:{action:'analyze',question:question.value.trim(),source,webSearch:$('#web-search').checked}});if(err||data?.error)throw Error(data?.error||'処理に失敗しました。API設定と利用状況を確認してください。');display(data.text,data.citations||[],question.value.trim());const {error:saveError}=await sb.from('talk_organizer_summaries').insert({title:question.value.trim().slice(0,100),question:question.value.trim(),content:data.text,sources:data.citations||[]});if(saveError)notify('まとめは表示されましたが、保存できませんでした');else{notify('まとめを保存しました');await library()}}catch(e){result.innerHTML='<div class="error-state">'+esc(e.message)+'</div>'}finally{refreshButton()}};
$('#copy-button').onclick=async()=>{if(last){try{await navigator.clipboard.writeText(last);notify('コピーしました')}catch{notify('コピーできませんでした')}}};$('#download-button').onclick=()=>{if(last)printSummary(last,lastTitle,document,window)};
$('#csv-button').onclick=()=>{if(!last)return;try{const blob=new Blob([summaryCsv(last,lastSources)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=summaryTitle(last,lastTitle)+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}catch{notify('CSVを保存できませんでした')}};
const {data:{session}}=await sb.auth.getSession();if(session){await showSession(session)}else login.showModal();showSelected();
