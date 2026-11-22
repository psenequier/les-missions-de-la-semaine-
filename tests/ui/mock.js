// Faux Supabase en mémoire, pour tester les écrans sans serveur. Contient une famille « hostile »
// dont les textes essaient d'injecter du code : rien ne doit s'exécuter.
window.supabase={createClient(){
  const db={families:[{id:"fx",name:"<img src=x onerror=window.__xss=1>Martin",invite_code:"AAAA1111",settings:{routines:{matin:{points:"<b onmouseover=x>",items:[1,"Lit"]}},tasks:[{label:"<svg onload=window.__xss=2>",points:"9<i>"}]}}],family_members:[{family_id:"fx",user_id:"u9",role:"admin"}],children:[{id:"kx",family_id:"fx",name:"<script>window.__xss=3</script>Zoé",character:"x\"><img onerror=1>",weekly_goal:25,position:0}],rewards:[],events:[{id:"ex",family_id:"fx",child_id:"kx",points:4,label:"<img src=y onerror=window.__xss=4>",created_at:new Date().toISOString()}],checks:[],weekly_goals:[]};
  const uid="u1"; let session=null, cb=null; const id=()=>Math.random().toString(36).slice(2);
  function q(t){const st={t,f:[],op:"select",data:null,single:false,emb:null};
    const b={select(s){if(st.op==="select"&&s&&s.includes("families("))st.emb=true;return b},eq(k,v){st.f.push([k,v]);return b},order(){return b},range(a,c){st.r=[a,c];return b},single(){st.single=true;return b},
      insert(d){st.op="insert";st.data=d;return b},update(d){st.op="update";st.data=d;return b},delete(){st.op="delete";return b},
      then(res,rej){try{res(run())}catch(e){rej(e)}}};
    function m(r){return st.f.every(([k,v])=>r[k]===v)}
    function run(){const T=db[st.t];
      if(st.op==="insert"){(Array.isArray(st.data)?st.data:[st.data]).forEach(d=>T.push(Object.assign({id:id(),created_at:new Date().toISOString()},d)));return{error:null}}
      if(st.op==="update"){T.filter(m).forEach(r=>Object.assign(r,st.data));return{error:null}}
      if(st.op==="delete"){db[st.t]=T.filter(r=>!m(r));return{error:null}}
      let rows=T.filter(m).map(r=>Object.assign({},r));
      if(st.emb)rows=rows.map(r=>Object.assign(r,{families:db.families.find(f=>f.id===r.family_id)}));
      if(st.r)rows=rows.slice(st.r[0],st.r[1]+1);
      return{data:st.single?rows[0]:rows,error:null}}
    return b}
  window.__db=db;
  return{auth:{getSession:async()=>({data:{session}}),onAuthStateChange(f){cb=f},
    signInWithPassword:async()=>{session={user:{id:uid,email:"pascal@exemple.fr"}};cb&&cb("SIGNED_IN",session);return{error:null}},
    signUp:async()=>({data:{session:null},error:null}),signOut:async()=>{session=null;cb&&cb("SIGNED_OUT",null)},resetPasswordForEmail:async()=>({}),updateUser:async()=>({})},
    from:q,
    rpc:async(n,a)=>{if(n==="remettre_semaine_a_zero"){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));db.events=db.events.filter(e=>e.family_id!==a.fid||Date.parse(e.created_at)<d.getTime());db.checks=db.checks.filter(c=>c.family_id!==a.fid);return{data:null,error:null}}if(n==="is_super_admin")return{data:true,error:null};if(n==="all_families")return{data:db.families.map(f=>({id:f.id,name:f.name,created_at:"2026-11-01",adults:db.family_members.filter(m=>m.family_id===f.id).length,kids:db.children.filter(k=>k.family_id===f.id).length,events:db.events.filter(e=>e.family_id===f.id).length,last_event:null})),error:null};if(n==="create_family"){const f={id:id(),name:a.fname,invite_code:"4F7A2C9B",settings:{routines:{matin:{label:"Missions du matin",icon:"🌅",points:2,items:["M'habiller","Faire mes tartines"]},soir:{label:"Missions du soir",icon:"🌙",points:3,items:["Pyjama"]}},tasks:[{label:"Chambre rangée",icon:"🧸",points:2},{label:"Devoirs tout seul",icon:"✏️",points:3}]}};db.families.push(f);db.family_members.push({family_id:f.id,user_id:uid,role:"admin"});[["Un Legami","🖍️",24],["Un livre","📘",88],["Un grand livre","📕",159]].forEach(([title,icon,cost])=>db.rewards.push({id:id(),family_id:f.id,title,icon,cost,child_ids:null,created_at:new Date().toISOString()}));return{data:f.id,error:null}}if(n==="leave_family"){db.family_members=db.family_members.filter(m=>!(m.family_id===a.fid&&m.user_id===uid));if(!db.family_members.some(m=>m.family_id===a.fid))db.families=db.families.filter(f=>f.id!==a.fid);return{data:null,error:null}}if(n==="delete_family"){db.families=db.families.filter(f=>f.id!==a.fid);db.family_members=db.family_members.filter(m=>m.family_id!==a.fid);return{data:null,error:null}}return{data:null,error:{message:"bad_code"}}},
    channel(){const c={on(){return c},subscribe(){return c}};return c},removeChannel(){}}
}};
