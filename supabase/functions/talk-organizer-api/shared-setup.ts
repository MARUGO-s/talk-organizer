export const SHARED_EMAIL = 'talk-organizer-marugo@example.com';
type Reply = { status: number; body: { error?: string; configured?: boolean } };
const failure = (status: number, error: string): Reply => ({status, body:{error}});

export async function setupShared(admin: any, auth: any, owner: string, password: unknown): Promise<Reply> {
  if(typeof password!=='string'||password.length<8||password.length>128)return failure(400,'パスワードは8〜128文字で入力してください。');
  const {data:eligible,error:eligibilityError}=await admin.rpc('talk_organizer_can_setup_shared',{p_owner:owner});
  if(eligibilityError||eligible!==true)return failure(403,'このアカウントでは初期設定できません。');
  const {data:existing,error:lookupError}=await admin.rpc('talk_organizer_shared_user_id');
  if(lookupError)return failure(500,'共通ログインを確認できませんでした。');
  let sharedId=existing as string|null;
  if(sharedId){
    const {data:check,error:checkError}=await auth.auth.signInWithPassword({email:SHARED_EMAIL,password});
    if(checkError||check.user?.id!==sharedId)return failure(400,'設定済みの共通パスワードを確認してください。');
  }else{
    const {data:created,error:createError}=await admin.auth.admin.createUser({email:SHARED_EMAIL,password,email_confirm:true,app_metadata:{talk_organizer_shared:true}});
    if(createError||!created.user)return failure(500,'共通ログインを作成できませんでした。時間をおいて再度お試しください。');
    sharedId=created.user.id;
  }
  const {error:moveError}=await admin.rpc('talk_organizer_share_existing',{p_owner:owner,p_shared:sharedId});
  return moveError?failure(500,'共通ログインは作成されましたが、データ移行が完了していません。同じパスワードで再度お試しください。'):{status:200,body:{configured:true}};
}
