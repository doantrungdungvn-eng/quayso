"use client";
import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function LoginPage() {
 const [email,setEmail]=useState(""); const [password,setPassword]=useState(""); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage("");
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL, key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key){setMessage("Website chưa cấu hình Supabase Auth.");setBusy(false);return;}
  const sb=createBrowserClient(url,key); const {error}=await sb.auth.signInWithPassword({email:email.trim(),password});
  if(error){setMessage("Đăng nhập không thành công. Kiểm tra email và mật khẩu.");setBusy(false);return;}
  window.location.href="/";
 }
 return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f1f7f4",padding:20}}><form onSubmit={submit} style={{width:"100%",maxWidth:420,background:"white",padding:32,borderRadius:20,boxShadow:"0 12px 40px #1232",display:"grid",gap:16}}><h1 style={{fontSize:28,fontWeight:800,color:"#12364a"}}>Đăng nhập</h1><p style={{color:"#607486",marginTop:-8}}>Vòng Quay May Mắn</p><label>Email<input required type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} style={field}/></label><label>Mật khẩu<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} style={field}/></label>{message&&<p role="alert" style={{color:"#b42318"}}>{message}</p>}<button disabled={busy} style={{background:"#08795d",color:"white",padding:13,border:0,borderRadius:10,fontWeight:700}}>{busy?"Đang đăng nhập…":"Đăng nhập"}</button><a href="/reset-password" style={{color:"#08795d",textAlign:"center"}}>Quên mật khẩu?</a></form></main>
}
const field:React.CSSProperties={display:"block",width:"100%",marginTop:6,padding:12,border:"1px solid #d6e2dd",borderRadius:9,boxSizing:"border-box"};
