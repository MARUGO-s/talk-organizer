export type RefineContext = { summary: string; source: string; sourceIds: string[] | null; summaryOnly: boolean };
type Reply = { status: number; error: string; code?: string };

export async function loadRefineContext(db: any, summaryId: unknown, original: unknown, allowSummaryOnly: boolean): Promise<RefineContext | Reply> {
  if (typeof summaryId !== 'string' || typeof original !== 'string') return {status: 400, error: 'まとめを確認してください。'};
  const {data: summary, error} = await db.from('talk_organizer_summaries').select('content, source_file_ids').eq('id', summaryId).single();
  if (error || !summary) return {status: 404, error: 'まとめを読み込めませんでした。'};
  if (summary.content !== original) return {status: 409, error: 'まとめが変更されています。開き直してからお試しください。', code: 'summary_changed'};
  const ids = Array.isArray(summary.source_file_ids) && summary.source_file_ids.length ? summary.source_file_ids as string[] : null;
  if (!ids && !allowSummaryOnly) return {status: 409, code: 'source_unknown', error: 'このまとめの元のトーク履歴は記録されていません。履歴を選んで紐づけるか、まとめだけを使って続けられます。'};
  if (!ids) return {summary:summary.content, source:'', sourceIds:null, summaryOnly:true};
  const uniqueIds = [...new Set(ids)];
  const {data: files, error: fileError} = await db.from('talk_organizer_files').select('id,file_name,content').in('id', uniqueIds);
  if (fileError) return {status: 503, error: '元のトーク履歴を確認できませんでした。時間をおいて再度お試しください。'};
  const byId = new Map((files || []).map((file: any) => [file.id, file]));
  if (uniqueIds.some(id => !byId.has(id))) {
    if (!allowSummaryOnly) return {status:409,code:'source_missing',error:'元のトーク履歴の一部または全部が削除されているため、情報を精査できません。まとめだけを使って続けますか？'};
    return {summary:summary.content,source:'',sourceIds:ids,summaryOnly:true};
  }
  const source = uniqueIds.map(id => { const file:any=byId.get(id); return `【${file.file_name}】\n${file.content}`; }).join('\n\n');
  if (source.length > 1500000) return {status:400,error:'元の履歴の合計が大きすぎます。'};
  return {summary:summary.content,source,sourceIds:ids,summaryOnly:false};
}
