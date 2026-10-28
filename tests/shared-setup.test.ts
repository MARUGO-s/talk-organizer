import { setupShared, SHARED_EMAIL } from '../supabase/functions/talk-organizer-api/shared-setup.ts';
function assert(v:unknown,message='assertion failed'){if(!v)throw new Error(message)}
Deno.test('eligible owner creates account and moves existing data',async()=>{
 let created:any,moved:any;const admin={auth:{admin:{createUser:async(x:any)=>{created=x;return {data:{user:{id:'shared-id'}},error:null}}}},rpc:async(name:string,args:any)=>name==='talk_organizer_can_setup_shared'?{data:true,error:null}:name==='talk_organizer_shared_user_id'?{data:null,error:null}:(moved=args,{error:null})};
 const reply=await setupShared(admin,{},'owner-id','fakepassword');assert(reply.status===200);assert(created.email===SHARED_EMAIL&&created.email_confirm===true&&created.app_metadata.talk_organizer_shared===true);assert(moved.p_owner==='owner-id'&&moved.p_shared==='shared-id');
});
Deno.test('other users cannot create shared accounts',async()=>{
 let created=false;const admin={auth:{admin:{createUser:()=>{created=true}}},rpc:async()=>({data:false,error:null})};const reply=await setupShared(admin,{},'other-id','fakepassword');assert(reply.status===403&&!created);
});
Deno.test('retry requires the existing password and never resets it',async()=>{
 let created=false,moved=false;const admin={auth:{admin:{createUser:()=>{created=true}}},rpc:async(name:string)=>name==='talk_organizer_can_setup_shared'?{data:true,error:null}:name==='talk_organizer_shared_user_id'?{data:'shared-id',error:null}:(moved=true,{error:null})};
 const bad={auth:{signInWithPassword:async()=>({data:{user:null},error:{}})}};const r=await setupShared(admin,bad,'owner-id','wrongpassword');assert(r.status===400&&!created&&!moved);
 const good={auth:{signInWithPassword:async()=>({data:{user:{id:'shared-id'}},error:null})}};const r2=await setupShared(admin,good,'owner-id','fakepassword');assert(r2.status===200&&!created&&moved);
});
Deno.test('invalid password rejected before any writes',async()=>{const r=await setupShared({}, {},'owner','short');assert(r.status===400)});
