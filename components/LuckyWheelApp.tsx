"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase, supabaseConfigured } from "@/lib/supabase";
import { Customer, Prize, Winner, defaultPrizes } from "@/lib/types";
import { QRCodeSVG } from "qrcode.react";
import confetti from "canvas-confetti";
import * as XLSX from "xlsx";
import {
  Users, Trophy, ClipboardCheck, UserRound, Disc3, Upload, Download, QrCode,
  Search, Plus, Trash2, RotateCcw, Settings2, ShieldCheck, Sparkles, FileSpreadsheet,
  ClipboardList, CheckCircle2, ChartNoAxesCombined, X, Copy, ExternalLink, RefreshCw, Maximize2, Minimize2, ZoomIn, ZoomOut
} from "lucide-react";

type Tab = "wheel"|"register"|"customers"|"top"|"advisors"|"topadvisors"|"winners"|"survey"|"settings";
const wheelColors = ["#0b5b46","#d8a63e","#193d5a","#d95d39","#4b7b68","#e9c96f","#7a5a9b","#df8e5b","#246b86","#c9d8ce"];
const id = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const now = () => new Date().toISOString();
const sampleCustomers: Customer[] = [];
function loadLocal<T>(key:string, fallback:T):T {
  if (typeof window === "undefined") return fallback;
  try { const v=localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; } catch { return fallback; }
}
function saveLocal(key:string,value:unknown) {
  if (typeof window !== "undefined") localStorage.setItem(key,JSON.stringify(value));
}
function downloadWorkbook(rows:Record<string,unknown>[], name:string) {
  const ws=XLSX.utils.json_to_sheet(rows);
  const wb=XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Danh sach");
  XLSX.writeFile(wb,name);
}
function safeText(v:unknown) { return String(v ?? "").trim(); }
// Older deployments may contain only a subset of the original prize rows.
// Restore any missing standard prize IDs while preserving existing counts/names.
function completePrizeList(input: Prize[]): Prize[] {
  const existing = new Set(input.map(p => p.id));
  return [...input, ...defaultPrizes.filter(p => !existing.has(p.id)).map(p => ({ ...p }))];
}

export default function LuckyWheelApp() {
  const [tab,setTab]=useState<Tab>("wheel");
  const [wheelFullscreen,setWheelFullscreen]=useState(false);
  const [wheelMode,setWheelMode]=useState<"customers"|"advisors">("customers");
  const [wheelZoom,setWheelZoom]=useState(1);
  const [customers,setCustomers]=useState<Customer[]>([]);
  const [prizes,setPrizes]=useState<Prize[]>(defaultPrizes);
  const [winners,setWinners]=useState<Winner[]>([]);
  const [loaded,setLoaded]=useState(false);
  const [search,setSearch]=useState("");
  const [customerEventFilter,setCustomerEventFilter]=useState("all");
  const [topEventFilter,setTopEventFilter]=useState("all");
  const [topLimit,setTopLimit]=useState<5|10>(5);
  const [advisorTopLimit,setAdvisorTopLimit]=useState<5|10>(5);
  const [advisorCampaignId,setAdvisorCampaignId]=useState("");
  const [wheelEventFilter,setWheelEventFilter]=useState("current");
  const [notice,setNotice]=useState<{type:"success"|"error"|"info";text:string}|null>(null);
  const [spinning,setSpinning]=useState(false);
  const [soundEnabled,setSoundEnabled]=useState(true);
  const audioContextRef=useRef<AudioContext|null>(null);
  const soundTimer=useRef<ReturnType<typeof setInterval>|null>(null);
  const soundStep=useRef(0);
  const [rotation,setRotation]=useState(0);
  const [winnerModal,setWinnerModal]=useState<Winner|null>(null);
  const [selectedCustomer,setSelectedCustomer]=useState<Customer|null>(null);
  const [selectedPrize,setSelectedPrize]=useState("p1");
  const [eventName,setEventName]=useState("Tri Ân Khách Hàng VIP");
  const [eventDate,setEventDate]=useState("");
  const [eventTime,setEventTime]=useState("17:30");
  const [publicRegistration,setPublicRegistration]=useState(false);
  const [registrationEventName,setRegistrationEventName]=useState("");
  const [registrationEventDate,setRegistrationEventDate]=useState("");
  const [registrationEventTime,setRegistrationEventTime]=useState("");
  const [adminPin,setAdminPin]=useState("");
  const [pinInput,setPinInput]=useState("");
  const [isAdmin,setIsAdmin]=useState(false);
  const [qrOpen,setQrOpen]=useState(false);
  const [qrFullscreen,setQrFullscreen]=useState(false);
  const [registrationUrl,setRegistrationUrl]=useState("");
  const [form,setForm]=useState({full_name:"",phone:"",customer_code:"",advisor_name:"",agency:"",appointment_date:"",survey_rating:"5",survey_interest:"Giải pháp sức khỏe",survey_feedback:"",consent:false});
  const [advisorOptions,setAdvisorOptions]=useState<string[]>([]);
  const [agencyOptions,setAgencyOptions]=useState<string[]>([]);
  const [advisorOptionsText,setAdvisorOptionsText]=useState("");
  const [agencyOptionsText,setAgencyOptionsText]=useState("");
  const [survey,setSurvey]=useState({rating:"",interest:"",feedback:""});
  const [newPrize,setNewPrize]=useState({name:"",quantity:"1"});
  const [prizeEdits,setPrizeEdits]=useState<Record<string,{name:string;quantity:string}>>({});
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const wheelRef=useRef<HTMLDivElement>(null);
  const spinTimer=useRef<ReturnType<typeof setTimeout>|null>(null);

  const advisorEntries=useMemo(()=>customers.filter(c=>c.event_name==="__TVV_SURVEY__" && (!advisorCampaignId || c.advisor_campaign_id===advisorCampaignId)),[customers,advisorCampaignId]);
  const regularCustomers=useMemo(()=>customers.filter(c=>c.event_name!=="__TVV_SURVEY__"),[customers]);
  const eligible=useMemo(()=>regularCustomers.filter(c=>c.eligible!==false && !winners.some(w=>w.customer_id===c.id)),[regularCustomers,winners]);
  const activePrizes=useMemo(()=>prizes.filter(p=>p.active && p.won<p.quantity),[prizes]);
  const currentPrize=prizes.find(p=>p.id===selectedPrize);
  const eventKey=(c:Customer)=>`${safeText(c.event_name)||"Chưa phân loại"} | ${safeText(c.event_date)||"Chưa có ngày"} | ${safeText(c.event_time)||"Chưa có giờ"}`;
  const customerEventOptions=useMemo(()=>Array.from(new Set<string>(regularCustomers.map(eventKey))).sort((a,b)=>a.localeCompare(b,"vi")),[regularCustomers]);
  const currentEventKey=`${safeText(eventName)||"Chưa phân loại"} | ${safeText(eventDate)||"Chưa có ngày"} | ${safeText(eventTime)||"Chưa có giờ"}`;
  const wheelEventOptions=useMemo(()=>Array.from(new Set<string>([currentEventKey,...customerEventOptions])).sort((a,b)=>a.localeCompare(b,"vi")),[currentEventKey,customerEventOptions]);
  const selectedWheelEvent=wheelEventFilter==="current"?currentEventKey:wheelEventFilter;
  const wheelEligible=useMemo(()=>wheelMode==="advisors"?advisorEntries.filter(c=>c.eligible!==false&&!winners.some(w=>w.customer_id===c.id)):eligible.filter(c=>eventKey(c)===selectedWheelEvent),[wheelMode,advisorEntries,eligible,selectedWheelEvent,winners]);
  const wheelWinners=useMemo(()=>winners.filter(w=>{const c=customers.find(x=>x.id===w.customer_id);return c&&(wheelMode==="advisors"?c.event_name==="__TVV_SURVEY__":c.event_name!=="__TVV_SURVEY__"&&eventKey(c)===selectedWheelEvent);}),[winners,customers,selectedWheelEvent,wheelMode]);
  const filteredCustomers=useMemo(()=>regularCustomers.filter(c=>(customerEventFilter==="all"||eventKey(c)===customerEventFilter)&&[c.full_name,c.phone,c.advisor_name,c.customer_code].some(x=>safeText(x).toLowerCase().includes(search.toLowerCase()))),[regularCustomers,search,customerEventFilter]);
  const filteredWinners=useMemo(()=>winners.filter(w=>[w.full_name,w.phone,w.advisor_name,w.prize_name].some(x=>safeText(x).toLowerCase().includes(search.toLowerCase()))),[winners,search]);
  const topAppointmentCustomers=useMemo(()=>regularCustomers.filter(c=>Boolean(safeText(c.appointment_date))&&(topEventFilter==="all"||eventKey(c)===topEventFilter)).sort((a,b)=>new Date(a.created_at).getTime()-new Date(b.created_at).getTime()).slice(0,topLimit),[regularCustomers,topEventFilter,topLimit]);
  const topAdvisorCommitments=useMemo(()=>advisorEntries.map(c=>{let m:any={};try{m=JSON.parse(c.survey_feedback||"{}")}catch{};return {customer:c,metrics:m,revenue:Number(m.revenue)||0,recruit:Number(m.recruit)||0}}).sort((a,b)=>b.revenue-a.revenue||b.recruit-a.recruit||new Date(a.customer.created_at).getTime()-new Date(b.customer.created_at).getTime()).slice(0,advisorTopLimit),[advisorEntries,advisorTopLimit]);
  const topRegistrationUrl=useMemo(()=>{
    if(topEventFilter==="all") return registrationUrl;
    const parts=topEventFilter.split(" | ");
    const name=parts[0]||""; const date=parts[1]==="Chưa có ngày"?"":(parts[1]||""); const time=parts[2]==="Chưa có giờ"?"":(parts[2]||"");
    try {
      const base=registrationUrl || (typeof window!=="undefined" ? `${window.location.origin}/register` : "");
      if(!base) return "";
      const url=new URL(base); url.searchParams.set("eventName",name);
      if(date) url.searchParams.set("eventDate",date); else url.searchParams.delete("eventDate");
      if(time) url.searchParams.set("eventTime",time); else url.searchParams.delete("eventTime");
      return url.toString();
    } catch { return ""; }
  },[topEventFilter,registrationUrl]);

  useEffect(()=>{if(!qrFullscreen)return;const onKeyDown=(e:KeyboardEvent)=>{if(e.key==="Escape")setQrFullscreen(false);};window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown);},[qrFullscreen]);

  const showNotice=(text:string,type:"success"|"error"|"info"="success")=>{setNotice({text,type});setTimeout(()=>setNotice(null),5000);};
  const persistAll=useCallback(async (cs:Customer[],ps:Prize[],ws:Winner[])=>{
    saveLocal("lwv_customers",cs); saveLocal("lwv_prizes",ps); saveLocal("lwv_winners",ws);
    if(!supabase) return;
    try {
      // Upsert to keep the demo usable with the supplied SQL schema and anon-key policies.
      if(cs.length) await supabase.from("lwv_customers").upsert(cs.map(c=>({...c,updated_at:now()})),{onConflict:"id"});
      if(ps.length) await supabase.from("lwv_prizes").upsert(ps,{onConflict:"id"});
      if(ws.length) await supabase.from("lwv_winners").upsert(ws,{onConflict:"id"});
    } catch(e) { console.warn("Supabase sync failed",e); }
  },[]);
  const savePrizesToServer=useCallback(async (next:Prize[])=>{
    saveLocal("lwv_prizes",next);
    if(!supabaseConfigured) return true;
    const response=await fetch("/api/admin/prizes",{method:"POST",headers:{"Content-Type":"application/json","x-admin-pin":adminPin},body:JSON.stringify({prizes:next}),cache:"no-store"});
    const result=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(result.error||"Không thể lưu cơ cấu giải thưởng lên Supabase.");
    return true;
  },[adminPin]);

  useEffect(()=>{
    setCustomers(loadLocal("lwv_customers",sampleCustomers));
    const savedPrizes=completePrizeList(loadLocal<Prize[]>("lwv_prizes",defaultPrizes));
    saveLocal("lwv_prizes",savedPrizes);
    setPrizes(savedPrizes);
    setPrizeEdits(Object.fromEntries(savedPrizes.map((p:Prize)=>[p.id,{name:p.name,quantity:String(p.quantity)}])));
    setWinners(loadLocal("lwv_winners",[]));
    setEventName(loadLocal("lwv_event_name","Tri Ân Khách Hàng VIP"));
    setEventDate(loadLocal("lwv_event_date",""));
    setEventTime(loadLocal("lwv_event_time","17:30"));
    setAdminPin(loadLocal("lwv_admin_pin",""));
    const savedAdvisors=loadLocal<string[]>("lwv_advisor_options",[]); const savedAgencies=loadLocal<string[]>("lwv_agency_options",[]); setAdvisorCampaignId(loadLocal<string>("lwv_advisor_campaign_id",""));
    setAdvisorOptions(savedAdvisors); setAgencyOptions(savedAgencies); setAdvisorOptionsText(savedAdvisors.join("\n")); setAgencyOptionsText(savedAgencies.join("\n"));
    const params = new URLSearchParams(window.location.search);
    const isPublic = params.get("page") === "register";
    setPublicRegistration(isPublic);
    if (isPublic) {
      setTab("register");
      setRegistrationEventName(params.get("eventName") || "");
      setRegistrationEventDate(params.get("eventDate") || "");
      setRegistrationEventTime(params.get("eventTime") || "");
    }
    setLoaded(true);
  },[]);
  useEffect(()=>{if(!loaded)return;saveLocal("lwv_event_name",eventName);saveLocal("lwv_event_date",eventDate);saveLocal("lwv_event_time",eventTime);},[loaded,eventName,eventDate,eventTime,advisorOptions,agencyOptions]);
  useEffect(()=>{
    if(!loaded || typeof window === "undefined") return;
    const url = new URL("/register", window.location.origin);
    if(eventName.trim()) url.searchParams.set("eventName",eventName.trim());
    if(eventDate) url.searchParams.set("eventDate",eventDate);
    if(eventTime) url.searchParams.set("eventTime",eventTime);
    const advisors=loadLocal<string[]>("lwv_advisor_options",[]); const agencies=loadLocal<string[]>("lwv_agency_options",[]);
    if(advisors.length) url.searchParams.set("advisors",advisors.join("|"));
    if(agencies.length) url.searchParams.set("agencies",agencies.join("|"));
    setRegistrationUrl(url.toString());
  },[loaded,eventName,eventDate,eventTime,advisorOptions,agencyOptions]);
  useEffect(()=>{if(!loaded)return;drawWheel();},[loaded,wheelEligible,rotation]);
  useEffect(()=>()=>{if(spinTimer.current)clearTimeout(spinTimer.current);},[]);

  function drawWheel() {
    const canvas=canvasRef.current; if(!canvas) return;
    const size=1000; canvas.width=size; canvas.height=size;
    const ctx=canvas.getContext("2d"); if(!ctx)return;
    const list=wheelEligible.length?wheelEligible:[{id:"empty",full_name:"Chưa có khách trong sự kiện này",phone:"",created_at:now()} as Customer];
    const arc=Math.PI*2/list.length;
    ctx.clearRect(0,0,size,size);
    list.forEach((c,i)=>{
      const start=-Math.PI/2+i*arc;
      ctx.beginPath();ctx.moveTo(size/2,size/2);ctx.arc(size/2,size/2,size/2-8,start,start+arc);ctx.closePath();
      ctx.fillStyle=wheelColors[i%wheelColors.length];ctx.fill();
      ctx.strokeStyle="#fff";ctx.lineWidth=4;ctx.stroke();
      ctx.save();ctx.translate(size/2,size/2);ctx.rotate(start+arc/2);
      ctx.textAlign="right";ctx.fillStyle="#fff";ctx.font=`${Math.max(18,Math.min(29,380/list.length))}px Arial`;
      const label=c.full_name.length>20?c.full_name.slice(0,18)+"…":c.full_name;
      ctx.fillText(label,size/2-40,10);ctx.restore();
    });
    ctx.beginPath();ctx.arc(size/2,size/2,56,0,Math.PI*2);ctx.fillStyle="#f6d77e";ctx.fill();ctx.strokeStyle="#fff";ctx.lineWidth=8;ctx.stroke();
  }
  async function refreshFromSupabase() {
    if(!supabaseConfigured){showNotice("Chưa cấu hình Supabase. Dữ liệu chỉ nằm trên trình duyệt này.","error");return;}
    try {
      const response = await fetch("/api/admin/sync", {
        method: "GET",
        headers: { "x-admin-pin": adminPin },
        cache: "no-store"
      });
      const result = await response.json();
      if(!response.ok) {
        showNotice(result.error || "Không đồng bộ được dữ liệu. Kiểm tra ADMIN_PIN và SUPABASE_SERVICE_ROLE_KEY trên Vercel.","error");
        return;
      }
      const cs = (result.customers || []) as Customer[];
      const ps = completePrizeList((result.prizes || []) as Prize[]);
      const ws = (result.winners || []) as Winner[];
      setCustomers(cs); setPrizes(ps); setPrizeEdits(Object.fromEntries(ps.map((p:Prize)=>[p.id,{name:p.name,quantity:String(p.quantity)}]))); setWinners(ws);
      saveLocal("lwv_customers",cs); saveLocal("lwv_prizes",ps); saveLocal("lwv_winners",ws);
      showNotice(`Đã đồng bộ dữ liệu từ Supabase: ${cs.length} khách hàng, ${ws.length} lượt trúng.`);
    } catch {
      showNotice("Không kết nối được máy chủ đồng bộ. Vui lòng thử lại.","error");
    }
  }
  // Load shared data automatically on admin-facing pages; QR registration stays public.
  useEffect(()=>{
    if(!loaded || !supabaseConfigured || !adminPin || tab === "register") return;
    void refreshFromSupabase();
    // Refresh when navigating between admin tabs or after the saved PIN is loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[loaded,adminPin,tab]);

  async function submitRegistration(e:React.FormEvent) {
    e.preventDefault();
    if(!form.consent){showNotice("Vui lòng xác nhận đồng ý tham gia và xử lý dữ liệu theo thông báo của sự kiện.","error");return;}
    if(!form.full_name.trim()||!form.phone.trim()){showNotice("Vui lòng nhập họ tên và số điện thoại.","error");return;}
    const c:Customer={id:id(),full_name:form.full_name.trim(),phone:form.phone.trim(),customer_code:"",advisor_name:form.advisor_name.trim(),agency:form.agency.trim(),appointment_date:form.appointment_date||"",survey_rating:Number(form.survey_rating),survey_interest:form.survey_interest,survey_feedback:form.survey_feedback.trim(),consent:true,eligible:true,created_at:now(),event_name:registrationEventName || eventName,event_date:registrationEventDate || eventDate,event_time:registrationEventTime || eventTime} as Customer;
    if (!supabaseConfigured) {
      showNotice("Website chưa kết nối cơ sở dữ liệu chung. Đăng ký chưa được lưu; vui lòng báo ban tổ chức.","error");
      return;
    }
    try {
      const response = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c)
      });
      const result = await response.json();
      if (!response.ok) {
        showNotice(result.error || "Chưa lưu được đăng ký vào hệ thống. Vui lòng thử lại hoặc báo ban tổ chức.","error");
        return;
      }
    } catch {
      showNotice("Không kết nối được máy chủ. Đăng ký chưa được xác nhận; vui lòng thử lại.","error");
      return;
    }
    const next=[c,...customers];setCustomers(next);saveLocal("lwv_customers",next);
    setForm({full_name:"",phone:"",customer_code:"",advisor_name:"",agency:"",appointment_date:"",survey_rating:"5",survey_interest:"Giải pháp sức khỏe",survey_feedback:"",consent:false});
    showNotice("🎉 ĐĂNG KÝ THÀNH CÔNG! Thông tin đã được lưu vào hệ thống. Ban tổ chức sẽ xác nhận điều kiện tham gia quay thưởng.");
    if (typeof window !== "undefined") window.scrollTo({top:0,behavior:"smooth"});
  }
  function getAudioContext() {
    if (typeof window === "undefined") return null;
    const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioContextRef.current || audioContextRef.current.state === "closed") audioContextRef.current = new AudioContextClass();
    return audioContextRef.current;
  }
  async function unlockAudio() {
    const ctx = getAudioContext();
    if (!ctx) {
      showNotice("Trình duyệt này không hỗ trợ âm thanh. Vui lòng dùng Chrome hoặc Edge mới nhất.", "error");
      return false;
    }
    try {
      if (ctx.state !== "running") await ctx.resume();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.075, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
      oscillator.connect(gain); gain.connect(ctx.destination);
      oscillator.start(ctx.currentTime); oscillator.stop(ctx.currentTime + 0.24);
      return ctx.state === "running";
    } catch {
      showNotice("Chưa bật được âm thanh. Hãy bấm nút Âm thanh bật một lần nữa.", "error");
      return false;
    }
  }
  function playTone(frequency:number, duration:number, type:OscillatorType="sine", volume=0.045, delay=0) {
    if (!soundEnabled) return;
    const ctx=getAudioContext(); if(!ctx || ctx.state !== "running") return;
    const start=ctx.currentTime+delay;
    const oscillator=ctx.createOscillator(); const gain=ctx.createGain();
    oscillator.type=type; oscillator.frequency.setValueAtTime(frequency,start);
    gain.gain.setValueAtTime(0.0001,start); gain.gain.exponentialRampToValueAtTime(volume,start+0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001,start+duration);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(start); oscillator.stop(start+duration+0.03);
  }
  function startSpinSound() {
    if(!soundEnabled) return;
    const ctx=getAudioContext();
    if(!ctx) return;
    soundStep.current=0;
    if(soundTimer.current) clearInterval(soundTimer.current);
    // Resume first, then start the tick loop. If a browser suspends Web Audio,
    // the previous implementation started the interval too early and stayed silent.
    const begin = () => {
      if(!soundEnabled || !audioContextRef.current) return;
      soundTimer.current=setInterval(()=>{
        const step=soundStep.current++;
        const freq=step%4===0?660:step%2===0?520:440;
        playTone(freq,0.09,"square",0.035);
      },180);
    };
    if(ctx.state === "running") begin();
    else void ctx.resume().then(()=>{ if(ctx.state === "running") begin(); }).catch(err=>console.warn("Audio resume failed",err));
  }
  function stopSpinSound() {
    if(soundTimer.current) clearInterval(soundTimer.current);
    soundTimer.current=null;
  }
  function playWinSound() {
    stopSpinSound(); if(!soundEnabled) return;
    [523.25,659.25,783.99,1046.5,783.99,1046.5].forEach((f,i)=>playTone(f,0.28,"triangle",0.065,i*0.16));
  }
  useEffect(()=>()=>{ if(soundTimer.current) clearInterval(soundTimer.current); if(audioContextRef.current) void audioContextRef.current.close(); },[]);

  function randomIndex(n:number) {
    if(n<=1)return 0;
    // Use cryptographic randomness when available, with a safe browser fallback.
    try {
      if(typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        const arr=new Uint32Array(1);const max=0x100000000-(0x100000000%n);
        let x=0;do{crypto.getRandomValues(arr);x=arr[0];}while(x>=max);
        return x%n;
      }
    } catch (err) { console.warn("Secure random unavailable; using fallback", err); }
    return Math.floor(Math.random()*n);
  }
  async function spin() {
    if(spinning)return;
    if(!isAdmin){setWheelFullscreen(false);showNotice("Bạn chưa đăng nhập quản trị. Đã thoát chế độ toàn màn hình; hãy đăng nhập ở mục Quản trị quay thưởng rồi bấm Quay ngay.","error");return;}
    if(!wheelEligible.length){showNotice("Sự kiện đang chọn chưa có khách hàng đủ điều kiện hoặc tất cả khách đã trúng thưởng.","error");return;}
    // Unlock/resume Web Audio directly from the user's click before starting timers.
    // Browsers may block audio contexts that are first created inside a delayed callback.
    if (soundEnabled) {
      // Call resume synchronously from the click gesture so Chrome/Cốc Cốc allows audio.
      // Do not block the wheel animation on audio initialization.
      void unlockAudio().then(audioReady=>{
        if(!audioReady) showNotice("Chưa kích hoạt được âm thanh. Hãy bấm nút Âm thanh bật để thử tiếng.","error");
      });
    }
    // In fullscreen, the prize selector is hidden. If the saved selection is stale
    // (for example after deleting/editing prizes), automatically use the first available prize.
    const advisorMode = wheelMode === "advisors";
    const prizeToSpin = advisorMode ? null : (currentPrize && currentPrize.active && currentPrize.won < currentPrize.quantity ? currentPrize : activePrizes[0]);
    if(!advisorMode && !prizeToSpin){showNotice("Không còn giải thưởng đang hoạt động hoặc tất cả giải đã hết số lượng. Vào Cài đặt để kiểm tra giải thưởng.","error");return;}
    if(prizeToSpin && prizeToSpin.id !== selectedPrize) setSelectedPrize(prizeToSpin.id);
    try {
      const idx=randomIndex(wheelEligible.length);const picked=wheelEligible[idx];
      const arc=360/wheelEligible.length;
      // Canvas segment 0 starts at 12 o'clock; rotate to place the chosen segment under the pointer.
      const targetOffset=360-(idx*arc+arc/2);
      const normalized=((rotation%360)+360)%360;
      const delta=((targetOffset-normalized)%360+360)%360;
      const nextRotation=rotation+360*7+delta;
      if(spinTimer.current)clearTimeout(spinTimer.current);
      setSpinning(true);setRotation(nextRotation);startSpinSound();
      spinTimer.current=setTimeout(async()=>{
        try {
          const prize=prizeToSpin;
          const win:Winner={id:id(),customer_id:picked.id,full_name:picked.full_name,phone:picked.phone,advisor_name:picked.advisor_name||"",prize_name:advisorMode?"Quà tư vấn viên":(prize?.name||""),customer_code:picked.customer_code||"",won_at:now()};
          // Show and save the result locally immediately, so a temporary Supabase/API
          // failure cannot suppress the winner popup or erase the result on this device.
          const nextW=[win,...winners];
          const nextP=advisorMode?prizes:prizes.map(p=>p.id===prize?.id?{...p,won:p.won+1}:p);
          setWinners(nextW);
          setPrizes(nextP);
          setWinnerModal(win);
          saveLocal("lwv_winners",nextW);
          saveLocal("lwv_prizes",nextP);
          playWinSound();
          confetti({particleCount:160,spread:90,origin:{y:.6},colors:["#d9a441","#ffffff","#0b694e","#d95d39"]});

          // Sync to the shared database after the result is already visible locally.
          // A server error should show a warning, not cancel the popup or local winner record.
          if(supabaseConfigured){
            try {
              const controller = new AbortController();
              const requestTimeout = setTimeout(()=>controller.abort(),10000);
              let response: Response;
              try {
                response=await fetch("/api/admin/winners",{
                  method:"POST",
                  headers:{"Content-Type":"application/json","x-admin-pin":adminPin},
                  body:JSON.stringify({winner:win,prizeId:prize?.id,advisorMode}),
                  cache:"no-store",
                  signal:controller.signal
                });
              } finally { clearTimeout(requestTimeout); }
              const result=await response.json().catch(()=>({}));
              if(!response.ok) throw new Error(result.error||"Không lưu được kết quả lên Supabase.");
            } catch(syncError) {
              console.error("Winner was saved locally but Supabase sync failed",syncError);
              showNotice("Đã ghi nhận người trúng và hiển thị popup trên thiết bị này, nhưng chưa đồng bộ được Supabase. Kiểm tra ADMIN_PIN/API rồi đồng bộ lại.","error");
            }
          }
        } catch(err) {
          console.error("Spin result failed",err);
          showNotice("Vòng quay đã chạy nhưng không lưu được kết quả. Hãy kiểm tra kết nối và thử lại.","error");
        } finally { stopSpinSound(); setSpinning(false); }
      },7000);
    } catch(err) {
      console.error("Spin failed",err);
      stopSpinSound(); setSpinning(false);
      showNotice("Không thể bắt đầu quay. Hãy tải lại trang và thử lại.","error");
    }
  }
  function exportCustomers() {
    downloadWorkbook(regularCustomers.map((c,i)=>({"STT":i+1,"Họ và tên":c.full_name,"Số điện thoại":c.phone,"Mã khách hàng":c.customer_code||"","TVV mời":c.advisor_name||"","Đơn vị/nhóm":c.agency||"","Ngày hẹn tư vấn":c.appointment_date||"","Điểm hài lòng":c.survey_rating??"","Quan tâm":c.survey_interest||"","Góp ý":c.survey_feedback||"","Đủ điều kiện":c.eligible===false?"Không":"Có","Sự kiện":c.event_name||"Chưa phân loại","Ngày tổ chức":c.event_date||"","Giờ tổ chức":c.event_time||"","Ngày đăng ký":new Date(c.created_at).toLocaleString("vi-VN")})),"danh-sach-khach-hang.xlsx");
  }
  function exportWinners() {
    downloadWorkbook(winners.map((w,i)=>({"STT":i+1,"Họ và tên":w.full_name,"Số điện thoại":w.phone,"Mã khách hàng":w.customer_code||"","TVV mời":w.advisor_name,"Giải thưởng":w.prize_name,"Thời gian trúng":new Date(w.won_at).toLocaleString("vi-VN")})),"danh-sach-trung-thuong.xlsx");
  }
  function importExcel(e:React.ChangeEvent<HTMLInputElement>) {
    const file=e.target.files?.[0];if(!file)return;
    const reader=new FileReader();
    reader.onload=async ev=>{
      try {
        const wb=XLSX.read(ev.target?.result,{type:"array"});const rows=XLSX.utils.sheet_to_json<Record<string,unknown>>(wb.Sheets[wb.SheetNames[0]],{defval:""});
        const get=(r:Record<string,unknown>,keys:string[])=>{for(const k of keys){const found=Object.keys(r).find(x=>x.toLowerCase().trim()===k.toLowerCase());if(found&&safeText(r[found]))return safeText(r[found]);}return "";};
        let added=0;const next=[...customers];const phones=new Set(customers.map(c=>c.phone.replace(/\s/g,"")));
        rows.forEach(r=>{
          const name=get(r,["Họ và tên","Họ tên","Tên khách hàng","full_name","name"]);const phone=get(r,["Số điện thoại","Điện thoại","phone","mobile"]);
          if(!name||!phone||phones.has(phone.replace(/\s/g,"")))return;
          phones.add(phone.replace(/\s/g,""));next.unshift({id:id(),full_name:name,phone,customer_code:get(r,["Mã khách hàng","customer_code","Mã KH"]),advisor_name:get(r,["TVV mời","TVV","Tư vấn viên","advisor_name"]),agency:get(r,["Đơn vị","Nhóm","agency"]),survey_rating:0,survey_interest:"",survey_feedback:"",consent:true,eligible:true,created_at:now(),event_name:eventName,event_date:eventDate,event_time:eventTime});added++;
        });
        setCustomers(next);await persistAll(next,prizes,winners);showNotice(`Đã nhập ${added} khách hàng mới. Các dòng thiếu họ tên/số điện thoại hoặc trùng số điện thoại đã được bỏ qua.`);
      }catch{showNotice("Không đọc được file. Hãy dùng Excel .xlsx hoặc .csv với cột Họ và tên và Số điện thoại.","error");}
      e.target.value="";
    };reader.readAsArrayBuffer(file);
  }
  async function addPrize(e:React.FormEvent) {
    e.preventDefault();if(!newPrize.name.trim()||Number(newPrize.quantity)<1)return;
    const next=[...prizes,{id:id(),name:newPrize.name.trim(),quantity:Math.floor(Number(newPrize.quantity)),won:0,active:true}];
    try { await savePrizesToServer(next); setPrizes(next);setPrizeEdits(Object.fromEntries(next.map(p=>[p.id,{name:p.name,quantity:String(p.quantity)}])));setNewPrize({name:"",quantity:"1"});showNotice("Đã lưu giải thưởng lên Supabase."); } catch(error) { showNotice(error instanceof Error?error.message:"Không thể lưu giải thưởng.","error"); }
  }
  async function toggleEligibility(c:Customer) {
    const next=customers.map(x=>x.id===c.id?{...x,eligible:x.eligible===false}:x);setCustomers(next);await persistAll(next,prizes,winners);
  }
  async function resetCustomerWin(c:Customer) {
    const customerWinners=winners.filter(w=>w.customer_id===c.id);
    if(!customerWinners.length) { showNotice("Khách hàng này chưa có kết quả trúng thưởng.","info"); return; }
    if(!confirm(`Đặt lại trạng thái trúng thưởng của ${c.full_name} để khách có thể quay lại?`)) return;
    const nextW=winners.filter(w=>w.customer_id!==c.id);
    const nextC=customers.map(x=>x.id===c.id?{...x,eligible:true}:x);
    const nextP=prizes.map(p=>({...p,won:Math.max(0,p.won-customerWinners.filter(w=>w.prize_name===p.name).length)}));
    try {
      const response=await fetch(`/api/admin/winners?customerId=${encodeURIComponent(c.id)}`,{method:"DELETE",headers:{"x-admin-pin":adminPin},cache:"no-store"});
      const result=await response.json().catch(()=>({}));
      if(!response.ok && response.status!==404) throw new Error(result.error||"Không thể đặt lại kết quả trên máy chủ.");
      await savePrizesToServer(nextP);
      setCustomers(nextC);setWinners(nextW);setPrizes(nextP);await persistAll(nextC,nextP,nextW);setSelectedCustomer({...c,eligible:true});
      showNotice(`Đã đặt lại trạng thái trúng thưởng của ${c.full_name}. Khách có thể quay lại.`);
    } catch(error) { showNotice(error instanceof Error?error.message:"Không thể đặt lại trạng thái trúng thưởng.","error"); }
  }
  async function removeCustomer(c:Customer) {
    if(!confirm(`Xóa khách hàng ${c.full_name}? Hành động này không xóa lịch sử trúng thưởng.`))return;
    const next=customers.filter(x=>x.id!==c.id);setCustomers(next);await persistAll(next,prizes,winners);showNotice("Đã xóa khách hàng.");
  }
  async function resetAdvisorWinners() {
    const advisorIds = new Set(advisorEntries.map(c=>c.id));
    const advisorWinners = winners.filter(w=>advisorIds.has(w.customer_id));
    if(!advisorWinners.length){showNotice("Chưa có kết quả quay TVV để đặt lại.","info");return;}
    if(!confirm(`Đặt lại ${advisorWinners.length} kết quả quay tư vấn viên? Danh sách TVV sẽ được phép quay lại.`))return;
    try {
      if(supabaseConfigured){
        const response=await fetch("/api/admin/winners?mode=advisors",{method:"DELETE",headers:{"x-admin-pin":adminPin},cache:"no-store"});
        const result=await response.json().catch(()=>({}));
        if(!response.ok)throw new Error(result.error||"Không thể reset kết quả TVV trên Supabase.");
      }
      const nextW=winners.filter(w=>!advisorIds.has(w.customer_id));
      setWinners(nextW);saveLocal("lwv_winners",nextW);await persistAll(customers,prizes,nextW);
      showNotice("Đã reset kết quả quay TVV. Tư vấn viên có thể quay lại.");
    } catch(error){showNotice(error instanceof Error?error.message:"Không thể reset kết quả TVV.","error");}
  }
  async function resetWinners() {
    if(!confirm("Xóa toàn bộ kết quả trúng thưởng và đưa số lượng giải về 0? Chỉ thực hiện nếu ban tổ chức đã xác nhận."))return;
    const nextP=prizes.map(p=>({...p,won:0}));try{await savePrizesToServer(nextP);setWinners([]);setPrizes(nextP);await persistAll(customers,nextP,[]);showNotice("Đã đặt lại kết quả trúng thưởng.");}catch(error){showNotice(error instanceof Error?error.message:"Không thể lưu thay đổi giải thưởng.","error");}
  }
  async function saveSettings() {
    if(adminPin.trim()) saveLocal("lwv_admin_pin",adminPin.trim()); else localStorage.removeItem("lwv_admin_pin"); const advisors=advisorOptionsText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); const agencies=agencyOptionsText.split(/\r?\n/).map(x=>x.trim()).filter(Boolean); setAdvisorOptions(advisors); setAgencyOptions(agencies); saveLocal("lwv_advisor_options",advisors); saveLocal("lwv_agency_options",agencies); await persistAll(customers,prizes,winners);showNotice("Đã lưu cấu hình, danh sách TVV và đơn vị/nhóm trên trình duyệt này.");
  }
  function doLogin(e:React.FormEvent){e.preventDefault();if(!adminPin.trim()){showNotice("Chưa thiết lập PIN trên thiết bị này. Vào Cài đặt để tạo PIN riêng trước khi đăng nhập.","error");return;}if(pinInput===adminPin){setIsAdmin(true);setPinInput("");showNotice("Đăng nhập quản trị thành công.");}else showNotice("Mã PIN không đúng.","error");}
  const navItems:[Tab,string,any][]=[["wheel","Vòng quay",Disc3],["register","Đăng ký QR",QrCode],["customers","Khách hàng",Users],["top","Top đặt lịch",ChartNoAxesCombined],["advisors","Tư vấn viên",UserRound],["topadvisors","Top cam kết TVV",ChartNoAxesCombined],["winners","Trúng thưởng",Trophy],["survey","Khảo sát",ClipboardList],["settings","Cài đặt",Settings2]];
  const stats=[{label:"Khách hàng",value:regularCustomers.length,sub:"Tổng hồ sơ đã ghi nhận",Icon:Users},{label:"Đủ điều kiện",value:eligible.length,sub:"Chưa trúng thưởng",Icon:UserRound},{label:"Lượt trúng",value:winners.length,sub:"Kết quả đã lưu",Icon:Trophy},{label:"Khảo sát",value:regularCustomers.filter(c=>Number(c.survey_rating)>0).length,sub:"Khách có câu trả lời",Icon:ClipboardCheck}];

  return <div className="app-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark">✦</div><div><h1>VÒNG QUAY MAY MẮN</h1><p>Hệ thống quay thưởng · {publicRegistration && registrationEventName ? registrationEventName : eventName}</p></div></div>
      {!publicRegistration&&<div className="top-actions">{navItems.filter(([key])=>key!=="register").map(([key,label,Icon])=><button key={key} className={`navbtn ${tab===key?"active":""}`} onClick={()=>setTab(key)}><Icon size={14} style={{display:"inline",verticalAlign:"-2px",marginRight:5}}/>{label}</button>)}</div>}
    </header>
    <main className="container">
      <div className="hero"><div><div className="eyebrow">Customer appreciation event</div><h2>{tab==="wheel"?"Vòng quay may mắn":tab==="register"?"Đăng ký tham gia":tab==="customers"?"Quản lý khách hàng":tab==="top"?"Top khách hàng đặt lịch tư vấn":tab==="advisors"?"Tư vấn viên · Cam kết kinh doanh":tab==="topadvisors"?"Top TVV cam kết cao nhất":tab==="winners"?"Danh sách trúng thưởng":tab==="survey"?"Khảo sát khách hàng":"Thiết lập sự kiện"}</h2><p>{tab==="wheel"?"Mỗi khách hàng chỉ có một cơ hội trúng thưởng trong toàn bộ sự kiện.":tab==="register"?"Quét QR, đăng ký thông tin và hoàn thành khảo sát.":tab==="customers"?"Quản lý danh sách khách hàng đăng ký trực tiếp và nhập từ Excel.":tab==="top"?"Xếp hạng khách quét QR đăng ký sớm nhất và đã chọn ngày hẹn tư vấn để xét tặng quà.":tab==="advisors"?"Khảo sát riêng về cam kết kinh doanh, doanh thu và tuyển dụng; quản lý danh sách để quay thưởng TVV độc lập.":tab==="topadvisors"?"Xếp hạng TVV theo doanh thu cam kết cao nhất, số tuyển dụng và thời điểm hoàn thành khảo sát sớm nhất.":tab==="winners"?"Lưu lại kết quả minh bạch theo từng giải thưởng.":tab==="survey"?"Theo dõi mức độ hài lòng và nhu cầu khách hàng.":"Cấu hình thông tin sự kiện, giải thưởng và quản trị."}</p></div><div className="status-pill"><span className="dot"/>{supabaseConfigured?"Supabase đã cấu hình":"Chế độ demo · lưu trình duyệt"}</div></div>
      {publicRegistration&&<div className="notice success" style={{marginBottom:16}}><b>{registrationEventName||eventName}</b>{(registrationEventDate||eventDate)&&<> · Ngày {new Date((registrationEventDate||eventDate)+"T00:00:00").toLocaleDateString("vi-VN")}</>}{(registrationEventTime||eventTime)&&<> · {registrationEventTime||eventTime}</>}</div>}
      {notice&&<div className={`notice ${notice.type==="success"?"success":notice.type==="error"?"error":""}`}>{notice.text}</div>}
      {!publicRegistration&&<section className="stats">{stats.map(({label,value,sub,Icon})=><div className="stat" key={label}><div className="stat-label"><Icon size={15}/>{label}</div><div className="stat-value">{value}</div><div className="stat-sub">{sub}</div></div>)}</section>}

      {tab==="wheel"&&<div className={`wheel-layout ${wheelFullscreen?"wheel-fullscreen-active":""}`}>
        <section className={`panel wheel-panel ${wheelFullscreen?"wheel-fullscreen-panel":""}`}>
          <div style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><div><h3>{wheelMode==="advisors"?"VÒNG QUAY TƯ VẤN VIÊN":"VÒNG QUAY MAY MẮN"}</h3><p>{wheelEligible.length} {wheelMode==="advisors"?"TVV":"khách hàng"} đủ điều kiện · {wheelMode==="advisors"?"Khảo sát cam kết TVV":selectedWheelEvent}</p></div><div className="toolbar"><button className={wheelMode==="customers"?"primary-btn":"secondary-btn"} onClick={()=>setWheelMode("customers")}>Quay khách hàng</button><button className={wheelMode==="advisors"?"primary-btn":"secondary-btn"} onClick={()=>{setWheelMode("advisors");setTab("wheel");}}>Quay TVV</button><button className="secondary-btn" aria-label="Thu nhỏ vòng quay" title="Thu nhỏ vòng quay" onClick={()=>setWheelZoom(z=>Math.max(0.65,Math.round((z-0.15)*100)/100))}><ZoomOut size={15}/></button><button className="secondary-btn" aria-label="Phóng to vòng quay" title="Phóng to vòng quay" onClick={()=>setWheelZoom(z=>Math.min(1.6,Math.round((z+0.15)*100)/100))}><ZoomIn size={15}/></button>{wheelMode==="customers"&&<div className="field" style={{minWidth:260,margin:0}}><label>Chọn sự kiện để quay</label><select value={wheelEventFilter==="current"?currentEventKey:wheelEventFilter} onChange={e=>setWheelEventFilter(e.target.value)}>{wheelEventOptions.map(ev=><option key={ev} value={ev}>{ev} · {regularCustomers.filter(c=>eventKey(c)===ev&&c.eligible!==false&&!winners.some(w=>w.customer_id===c.id)).length} khách đủ điều kiện</option>)}</select></div>}<button className="secondary-btn" onClick={async()=>{if(soundEnabled){stopSpinSound();setSoundEnabled(false);showNotice("Đã tắt âm thanh vòng quay.");}else{setSoundEnabled(true);const ok=await unlockAudio();if(ok){playTone(660,0.16,"sine",0.055);showNotice("Đã bật âm thanh. Hãy thử quay số.");}}}} title="Bật hoặc tắt âm thanh">{soundEnabled?"🔊 Âm thanh bật":"🔇 Âm thanh tắt"}</button><button className="secondary-btn" onClick={()=>setQrOpen(true)}><QrCode size={15}/> Mở QR</button><button className="secondary-btn" onClick={()=>{if(!wheelFullscreen&&!isAdmin){showNotice("Vui lòng đăng nhập quản trị trước khi mở toàn màn hình để quay số.","error");return;}setWheelFullscreen(v=>!v);}}>{wheelFullscreen?<><Minimize2 size={15}/> Thu nhỏ màn hình</>:<><Maximize2 size={15}/> Toàn màn hình</>}</button></div></div>
          <div className="wheel-wrap" ref={wheelRef} style={{width:wheelFullscreen?`min(88vmin, ${620*wheelZoom}px)`:`min(100%, ${500*wheelZoom}px)`,maxWidth:"100%"}}><div className="wheel-pointer"/><div className="wheel" style={{transform:`rotate(${rotation}deg)`}}><canvas ref={canvasRef}/></div><div className="wheel-center">✦</div></div>
          <button className="spin-btn" onClick={spin} disabled={spinning||!wheelEligible.length||(wheelMode==="customers"&&!activePrizes.length)}>{spinning?"ĐANG QUAY... 7 GIÂY":"✦  QUAY NGAY  ✦"}</button>
          <div className="wheel-caption">{spinning?"Chúc bạn may mắn! Đang xác định kết quả...":"Kết quả ngẫu nhiên · Mỗi khách chỉ trúng một lần"}</div>
        </section>
        <div className="side-stack">
          <section className="panel"><div className="panel-head"><div><h3><Trophy size={17} style={{display:"inline",verticalAlign:"-3px",marginRight:7,color:"#b88b30"}}/>Cơ cấu giải thưởng</h3><p>Chọn giải trước khi bắt đầu quay.</p></div></div>
            <div className="field"><label>Giải thưởng đang quay</label><select value={selectedPrize} onChange={e=>setSelectedPrize(e.target.value)}>{prizes.filter(p=>p.active&&p.won<p.quantity).map(p=><option key={p.id} value={p.id}>{p.name} · còn {p.quantity-p.won}</option>)}</select></div>
            <div className="prize-list" style={{marginTop:13}}>{prizes.map(p=><div className="prize-row" key={p.id}><div><div className="prize-name">{p.name}</div><div className="prize-meta">Đã trao {p.won}/{p.quantity} giải</div></div><span className="prize-count">{Math.max(0,p.quantity-p.won)} còn lại</span></div>)}</div>
          </section>
          <section className="panel"><div className="panel-head"><div><h3><ShieldCheck size={17} style={{display:"inline",verticalAlign:"-3px",marginRight:7,color:"#0b775a"}}/>Quản trị quay thưởng</h3><p>Chỉ người quản trị được phép bắt đầu quay.</p></div></div>
            {!isAdmin?<form onSubmit={doLogin}><div className="field"><label>PIN quản trị</label><input value={pinInput} onChange={e=>setPinInput(e.target.value)} type="password" inputMode="numeric" placeholder="Nhập PIN quản trị" required/></div><button className="primary-btn full-btn" style={{marginTop:12}}>Đăng nhập quản trị</button><p className="small-muted" style={{marginTop:10}}>Demo dùng PIN phía trình duyệt. Trước khi chạy sự kiện thật, hãy triển khai xác thực server và phân quyền Supabase theo hướng dẫn README.</p></form>:<><div className="notice success">Đã đăng nhập quản trị trên thiết bị này.</div><button className="secondary-btn full-btn" onClick={()=>{setIsAdmin(false);showNotice("Đã đăng xuất quản trị.","info");}}>Đăng xuất</button></>}
          </section>
          <section className="panel"><div className="panel-head"><div><h3>Kết quả gần nhất</h3><p>{wheelWinners.length} {wheelMode==="advisors"?"tư vấn viên":"khách hàng"} đã trúng thưởng trong {wheelMode==="advisors"?"danh sách TVV":"sự kiện này"}</p></div><button className="secondary-btn" onClick={()=>setTab("winners")}>Xem tất cả</button></div>
            {wheelWinners.slice(0,3).map(w=><div className="prize-row" key={w.id}><div><div className="prize-name">{w.full_name}</div><div className="prize-meta">{w.prize_name}</div></div><Trophy size={17} color="#b88b30"/></div>)}
            {!wheelWinners.length&&<div className="empty">{wheelMode==="advisors"?"Chưa có tư vấn viên trúng thưởng.":"Sự kiện này chưa có kết quả trúng thưởng."}</div>}
            {wheelMode==="advisors"&&isAdmin&&<button className="danger-btn full-btn" style={{marginTop:12}} onClick={()=>void resetAdvisorWinners()}><RotateCcw size={14}/> Reset kết quả quay TVV</button>}
          </section>
        </div>
      </div>}

      {tab==="register"&&<div className={publicRegistration?"":"section-grid"}>
        <section className="panel"><div className="panel-head"><div><h3>Thông tin khách hàng</h3><p>Điền thông tin để đăng ký tham gia sự kiện.</p></div><QrCode color="#0b775a"/></div>
          <form onSubmit={submitRegistration} className="field-grid">
            <div className="field full"><label>Họ và tên *</label><input value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})} placeholder="Nguyễn Văn A" required/></div>
            <div className="field"><label>Số điện thoại *</label><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} type="tel" placeholder="09xxxxxxxx" required/></div>
            
            <div className="field"><label>TVV mời khách</label><select value={form.advisor_name} onChange={e=>setForm({...form,advisor_name:e.target.value})}><option value="">-- Chọn TVV mời khách --</option>{advisorOptions.map(v=><option key={v} value={v}>{v}</option>)}</select></div>
            <div className="field"><label>Đơn vị / nhóm</label><select value={form.agency} onChange={e=>setForm({...form,agency:e.target.value})}><option value="">-- Chọn đơn vị / nhóm --</option>{agencyOptions.map(v=><option key={v} value={v}>{v}</option>)}</select></div>
            <div className="field full"><label>Ngày hẹn tư vấn chi tiết / kiểm tra hợp đồng</label><input type="date" value={form.appointment_date} onChange={e=>setForm({...form,appointment_date:e.target.value})}/></div>
            <div className="field full"><label>Mức độ hài lòng với chương trình</label><select value={form.survey_rating} onChange={e=>setForm({...form,survey_rating:e.target.value})}><option value="5">5 - Rất hài lòng</option><option value="4">4 - Hài lòng</option><option value="3">3 - Bình thường</option><option value="2">2 - Chưa hài lòng</option><option value="1">1 - Không hài lòng</option></select></div>
            <div className="field full"><label>Anh/chị quan tâm giải pháp nào?</label><select value={form.survey_interest} onChange={e=>setForm({...form,survey_interest:e.target.value})}><option>Giải pháp sức khỏe</option><option>Bảo vệ tài chính gia đình</option><option>Tích lũy dài hạn</option><option>Đầu tư và quỹ</option><option>Chưa có nhu cầu</option><option>Khác</option></select></div>
            <div className="field full"><label>Ý kiến góp ý (không bắt buộc)</label><textarea value={form.survey_feedback} onChange={e=>setForm({...form,survey_feedback:e.target.value})} placeholder="Chia sẻ ý kiến của anh/chị..."/></div>
            <div className="field full"><label className="checkbox-row"><input type="checkbox" checked={form.consent} onChange={e=>setForm({...form,consent:e.target.checked})}/><span>Tôi xác nhận thông tin đã cung cấp là chính xác và đồng ý để ban tổ chức sử dụng thông tin cho việc tổ chức sự kiện, khảo sát và quay thưởng theo thông báo về quyền riêng tư.</span></label></div>
            <div className="field full"><button className="primary-btn full-btn" type="submit"><CheckCircle2 size={16}/> Gửi đăng ký</button></div>
          </form>
        </section>
        {!publicRegistration&&<section className="panel"><div className="panel-head"><div><h3>QR đăng ký sự kiện</h3><p>Khách hàng có thể quét mã để mở trang đăng ký trên thiết bị của mình.</p></div></div><div className="qr-box"><QRCodeSVG value={registrationUrl||"https://example.com"} size={190} level="H" includeMargin/></div><p className="small-muted" style={{marginTop:12}}>QR hiện dẫn đến đường dẫn trang đăng ký của ứng dụng sau khi deploy. Hãy quét thử bằng điện thoại khác trước khi in.</p><div className="link-break">{registrationUrl}</div><div className="toolbar" style={{marginTop:12}}><button className="secondary-btn" onClick={()=>{navigator.clipboard?.writeText(registrationUrl);showNotice("Đã sao chép đường dẫn đăng ký.");}}><Copy size={14}/> Sao chép link</button><button className="secondary-btn" onClick={()=>setQrOpen(true)}><ExternalLink size={14}/> Xem QR lớn</button></div><div className="notice" style={{marginTop:18}}>Nếu triển khai sự kiện thật, nên dùng đường dẫn công khai riêng cho biểu mẫu và không để khách truy cập vào màn hình quản trị.</div></section>}
      </div>}

      {tab==="customers"&&<section className="panel"><div className="panel-head"><div><h3>Danh sách khách hàng</h3><p>Quản lý hồ sơ, điều kiện tham gia và dữ liệu TVV giới thiệu.</p></div><div className="toolbar"><label className="secondary-btn"><Upload size={15}/> Import Excel<input type="file" accept=".xlsx,.xls,.csv" onChange={importExcel} hidden/></label><button className="secondary-btn" onClick={exportCustomers}><Download size={15}/> Xuất Excel</button><button className="primary-btn" onClick={()=>setTab("register")}><Plus size={15}/> Thêm khách</button></div></div><div style={{position:"relative",maxWidth:420,marginBottom:14}}><Search size={15} style={{position:"absolute",left:12,top:13,color:"#829087"}}/><input className="search-input" style={{paddingLeft:36}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm tên, số điện thoại, TVV..."/></div><div className="field" style={{maxWidth:520,marginBottom:14}}><label>Lọc theo sự kiện (tên · ngày · giờ)</label><select value={customerEventFilter} onChange={e=>setCustomerEventFilter(e.target.value)}><option value="all">Tất cả sự kiện ({regularCustomers.length})</option>{customerEventOptions.map(ev=><option key={ev} value={ev}>{ev} ({customers.filter(c=>eventKey(c)===ev).length})</option>)}</select></div><div className="table-wrap"><table><thead><tr><th>Khách hàng</th><th>Số điện thoại</th><th>Sự kiện</th><th>Ngày / giờ tổ chức</th><th>TVV mời</th><th>Khảo sát</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{filteredCustomers.map(c=><tr key={c.id}><td><button type="button" onClick={()=>setSelectedCustomer(c)} style={{border:0,background:"transparent",padding:0,textAlign:"left",cursor:"pointer",color:"#173d59",fontWeight:700}} title="Xem thông tin và khảo sát khách hàng">{c.full_name}</button><div className="small-muted">{c.customer_code||"Chưa có mã KH"}</div></td><td>{c.phone}</td><td>{c.event_name||"Chưa phân loại"}</td><td>{c.event_date?new Date(c.event_date+"T00:00:00").toLocaleDateString("vi-VN"):"—"} {c.event_time||""}</td><td>{c.advisor_name||"—"}</td><td>{c.survey_rating?`${c.survey_rating}/5`:"Chưa có"}</td><td><span className="tag" style={c.eligible===false?{background:"#fff0ed",color:"#a43a2c"}:{}}>{c.eligible===false?"Không đủ điều kiện":winners.some(w=>w.customer_id===c.id)?"Đã trúng":"Đủ điều kiện"}</span></td><td><div className="toolbar"><button className="secondary-btn" onClick={()=>toggleEligibility(c)}>{c.eligible===false?"Cho phép quay":"Loại khỏi quay"}</button><button className="danger-btn" onClick={()=>removeCustomer(c)} title="Xóa khách"><Trash2 size={14}/></button></div></td></tr>)}</tbody></table>{!filteredCustomers.length&&<div className="empty">Chưa có dữ liệu. Đăng ký khách hàng hoặc nhập Excel để bắt đầu.</div>}</div><p className="small-muted" style={{marginTop:12}}>Mỗi khách hàng được gắn tên sự kiện, ngày và giờ tổ chức; khách nhập từ Excel sẽ gắn với sự kiện đang cài đặt. Excel hỗ trợ các cột: Họ và tên, Số điện thoại, Mã khách hàng, TVV mời, Đơn vị/nhóm. Số điện thoại trùng được tự động bỏ qua.</p></section>}

      {tab==="top"&&<section className="panel"><div className="panel-head"><div><h3><ChartNoAxesCombined size={18} style={{display:"inline",verticalAlign:"-3px",marginRight:8,color:"#0b775a"}}/>Top khách hàng đăng ký sớm có lịch tư vấn</h3><p>Chỉ tính khách đăng ký thành công qua QR, có ngày hẹn tư vấn. Xếp hạng theo thời điểm ghi nhận đăng ký sớm nhất.</p></div><div className="toolbar"><button className={topLimit===5?"primary-btn":"secondary-btn"} onClick={()=>setTopLimit(5)}>Top 5</button><button className={topLimit===10?"primary-btn":"secondary-btn"} onClick={()=>setTopLimit(10)}>Top 10</button></div></div><div className="field" style={{maxWidth:560,marginBottom:16}}><label>Lọc theo sự kiện (tên · ngày · giờ)</label><select value={topEventFilter} onChange={e=>setTopEventFilter(e.target.value)}><option value="all">Tất cả sự kiện</option>{customerEventOptions.map(ev=><option key={ev} value={ev}>{ev}</option>)}</select></div><section className="panel" style={{marginBottom:16,background:"#fbfdfc",borderStyle:"dashed"}}><div className="panel-head"><div><h3><QrCode size={17} style={{display:"inline",verticalAlign:"-3px",marginRight:7,color:"#0b775a"}}/>QR đăng ký bổ sung theo sự kiện</h3><p>Hiển thị mã QR và đường dẫn để TVV mời thêm khách đăng ký đúng sự kiện đang chọn.</p></div></div>{topRegistrationUrl?<div style={{display:"flex",alignItems:"center",gap:18,flexWrap:"wrap"}}><div className="qr-box" style={{background:"#fff",padding:12}}><QRCodeSVG value={topRegistrationUrl} size={190} level="H" includeMargin/></div><div style={{flex:"1 1 300px",minWidth:0}}><b>{topEventFilter==="all"?`${eventName}${eventDate?` · ${eventDate}`:""}${eventTime?` · ${eventTime}`:""}`:topEventFilter}</b><p className="link-break" style={{marginTop:10}}>{topRegistrationUrl}</p><div className="toolbar" style={{marginTop:12,flexWrap:"wrap"}}><button className="primary-btn" onClick={()=>window.open(topRegistrationUrl,"_blank","noopener,noreferrer")}><ExternalLink size={14}/> Mở trang đăng ký</button><button className="secondary-btn" onClick={()=>{void navigator.clipboard?.writeText(topRegistrationUrl).then(()=>showNotice("Đã sao chép link đăng ký theo sự kiện.")).catch(()=>showNotice("Không sao chép được. Hãy chọn và sao chép link bên trên.","error"));}}><Copy size={14}/> Sao chép link</button><button className="secondary-btn" onClick={(e)=>{const panel=e.currentTarget.closest("section");const svg=panel?.querySelector(".qr-box svg");if(!svg){showNotice("Không tìm thấy mã QR để tải.","error");return;}const blob=new Blob([new XMLSerializer().serializeToString(svg)],{type:"image/svg+xml;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="qr-dang-ky-su-kien.svg";a.click();URL.revokeObjectURL(url);showNotice("Đã tải mã QR dạng SVG.");}}><Download size={14}/> Tải QR</button></div><p className="small-muted" style={{marginTop:10}}>Khách quét mã sẽ thấy biểu mẫu đăng ký với tên, ngày và giờ sự kiện đã chọn.</p></div></div>:<div className="notice">Đang tạo link QR. Vui lòng chờ trang tải xong.</div>}</section><div className="notice success" style={{marginBottom:14}}>Đủ điều kiện xét tặng quà: đã đăng ký thành công và có ngày hẹn tư vấn. Số điện thoại được ẩn, chỉ hiển thị 4 số cuối.</div><div className="table-wrap"><table><thead><tr><th>Hạng</th><th>Khách hàng</th><th>Số điện thoại</th><th>Sự kiện</th><th>Ngày hẹn tư vấn</th><th>TVV mời</th><th>Thời điểm đăng ký</th></tr></thead><tbody>{topAppointmentCustomers.map((c,i)=><tr key={c.id}><td><span className="tag" style={{background:i===0?"#fff3cd":i<3?"#e8f4ee":undefined,color:i===0?"#805b00":undefined}}>{i+1}</span></td><td><b>{c.full_name}</b><div className="small-muted">{c.customer_code||""}</div></td><td>••••{safeText(c.phone).replace(/\D/g,"").slice(-4)||"----"}</td><td>{c.event_name||"Chưa phân loại"}<div className="small-muted">{c.event_date||""} {c.event_time||""}</div></td><td>{c.appointment_date}</td><td>{c.advisor_name||"—"}</td><td>{c.created_at?new Date(c.created_at).toLocaleString("vi-VN"):"—"}</td></tr>)}</tbody></table>{!topAppointmentCustomers.length&&<div className="empty">Chưa có khách nào vừa đăng ký thành công vừa chọn ngày hẹn tư vấn trong sự kiện đang lọc.</div>}</div><div className="toolbar" style={{marginTop:14}}><button className="secondary-btn" onClick={()=>downloadWorkbook(topAppointmentCustomers.map((c,i)=>({"Hạng":i+1,"Họ và tên":c.full_name,"Số điện thoại":"••••"+safeText(c.phone).replace(/\D/g,"").slice(-4),"Sự kiện":c.event_name||"","Ngày tổ chức":c.event_date||"","Giờ tổ chức":c.event_time||"","Ngày hẹn tư vấn":c.appointment_date||"","TVV mời":c.advisor_name||"","Thời điểm đăng ký":new Date(c.created_at).toLocaleString("vi-VN")})),`top-${topLimit}-khach-hang-dat-lich.xlsx`)}><Download size={14}/> Xuất danh sách xét tặng quà</button></div></section>}
      {tab==="topadvisors"&&<section className="panel"><div className="panel-head"><div><h3><ChartNoAxesCombined size={18} style={{display:"inline",verticalAlign:"-3px",marginRight:8,color:"#0b775a"}}/>Top tư vấn viên cam kết cao nhất</h3><p>Xếp hạng theo doanh thu mục tiêu cao nhất; nếu bằng nhau, ưu tiên số TVV dự kiến tuyển dụng cao hơn, sau đó khảo sát gửi sớm hơn.</p></div><div className="toolbar"><button className={advisorTopLimit===5?"primary-btn":"secondary-btn"} onClick={()=>setAdvisorTopLimit(5)}>Top 5</button><button className={advisorTopLimit===10?"primary-btn":"secondary-btn"} onClick={()=>setAdvisorTopLimit(10)}>Top 10</button></div></div><div className="stats" style={{gridTemplateColumns:"repeat(3,minmax(0,1fr))",marginBottom:16}}><div className="stat"><div className="stat-label">TVV đã khảo sát</div><div className="stat-value">{advisorEntries.length}</div></div><div className="stat"><div className="stat-label">Tổng doanh thu cam kết (triệu)</div><div className="stat-value">{advisorEntries.reduce((sum,c)=>{try{return sum+(Number(JSON.parse(c.survey_feedback||"{}").revenue)||0)}catch{return sum}},0).toLocaleString("vi-VN")}</div></div><div className="stat"><div className="stat-label">Tổng TVV dự kiến tuyển</div><div className="stat-value">{advisorEntries.reduce((sum,c)=>{try{return sum+(Number(JSON.parse(c.survey_feedback||"{}").recruit)||0)}catch{return sum}},0)}</div></div></div><div className="notice success" style={{marginBottom:14}}>Tiêu chí: doanh thu cam kết cao nhất → số TVV tuyển dụng cao nhất → thời gian gửi khảo sát sớm nhất.</div><div className="table-wrap"><table><thead><tr><th>Hạng</th><th>Tư vấn viên</th><th>Đơn vị / Nhóm</th><th>Cam kết kinh doanh</th><th>Doanh thu mục tiêu (triệu)</th><th>TVV tuyển dụng</th><th>Thời điểm khảo sát</th></tr></thead><tbody>{topAdvisorCommitments.map((item,i)=><tr key={item.customer.id}><td><span className="tag" style={{background:i===0?"#fff3cd":i<3?"#e8f4ee":undefined,color:i===0?"#805b00":undefined}}>{i+1}</span></td><td><b>{item.customer.full_name}</b><div className="small-muted">••••{safeText(item.customer.phone).replace(/\D/g,"").slice(-4)||"----"}</div></td><td>{item.customer.agency||"—"}</td><td style={{minWidth:220,whiteSpace:"pre-wrap"}}>{item.metrics.commitment||"—"}</td><td><b>{item.revenue.toLocaleString("vi-VN")}</b></td><td>{item.recruit}</td><td>{new Date(item.customer.created_at).toLocaleString("vi-VN")}</td></tr>)}</tbody></table>{!topAdvisorCommitments.length&&<div className="empty">Chưa có TVV gửi khảo sát cam kết. Khi có dữ liệu, bảng sẽ tự xếp hạng.</div>}</div><div className="toolbar" style={{marginTop:14}}><button className="secondary-btn" onClick={()=>downloadWorkbook(topAdvisorCommitments.map((item,i)=>({"Hạng":i+1,"Tư vấn viên":item.customer.full_name,"Điện thoại":"••••"+safeText(item.customer.phone).replace(/\D/g,"").slice(-4),"Đơn vị/Nhóm":item.customer.agency||"","Cam kết kinh doanh":item.metrics.commitment||"","Doanh thu mục tiêu (triệu)":item.revenue,"TVV tuyển dụng":item.recruit,"Ghi chú":item.metrics.notes||"","Thời điểm khảo sát":new Date(item.customer.created_at).toLocaleString("vi-VN")})),`top-${advisorTopLimit}-tvv-cam-ket.xlsx`)}><Download size={14}/> Xuất Top {advisorTopLimit} TVV</button><button className="primary-btn" onClick={()=>{setWheelMode("advisors");setTab("wheel");}}><Disc3 size={14}/> Quay thưởng TVV</button></div></section>}

      {tab==="advisors"&&<section className="panel"><div className="panel-head"><div><h3><UserRound size={18} style={{display:"inline",verticalAlign:"-3px",marginRight:7,color:"#0b775a"}}/>Khảo sát cam kết kinh doanh tư vấn viên</h3><p>TVV quét link riêng để đăng ký cam kết tháng; danh sách này được dùng cho vòng quay TVV, tách khỏi vòng quay khách hàng.</p></div></div><div className="section-grid"><div><div className="field" style={{marginBottom:12}}><label>ID đợt khảo sát TVV (UUID từ Supabase)</label><input value={advisorCampaignId} onChange={e=>{setAdvisorCampaignId(e.target.value.trim());saveLocal("lwv_advisor_campaign_id",e.target.value.trim());}} placeholder="Dán ID từ bảng lwv_advisor_campaigns"/><p className="small-muted">Tạo đợt mới trong Supabase bằng SQL migration trong thư mục supabase; nhập ID ở đây để QR, danh sách, Top và vòng quay chỉ dùng đợt đó. Để xem dữ liệu TVV cũ, xóa ô này.</p></div><div className="notice success">Link khảo sát TVV: {typeof window!=="undefined"?`${window.location.origin}/advisor-survey?campaign=${encodeURIComponent(advisorCampaignId)}`:"/advisor-survey"}</div><div className="qr-box" style={{marginTop:12,background:"white",padding:12,display:"inline-block"}}><QRCodeSVG value={typeof window!=="undefined"?`${window.location.origin}/advisor-survey?campaign=${encodeURIComponent(advisorCampaignId)}`:"/advisor-survey"} size={220} level="H" includeMargin/></div><div className="toolbar" style={{marginTop:12,flexWrap:"wrap"}}><button className="primary-btn" onClick={()=>{if(!advisorCampaignId){showNotice("Nhập ID đợt khảo sát từ Supabase trước khi mở QR riêng.","error");return;}window.open(`/advisor-survey?campaign=${encodeURIComponent(advisorCampaignId)}`,"_blank","noopener,noreferrer")}}><ExternalLink size={14}/> Mở khảo sát TVV</button><button className="secondary-btn" onClick={()=>{if(!advisorCampaignId){showNotice("Nhập ID đợt khảo sát từ Supabase trước khi sao chép link riêng.","error");return;}saveLocal("lwv_advisor_campaign_id",advisorCampaignId.trim());void navigator.clipboard?.writeText(`${window.location.origin}/advisor-survey?campaign=${encodeURIComponent(advisorCampaignId.trim())}`).then(()=>showNotice("Đã sao chép link khảo sát TVV của đợt đang chọn."));}}><Copy size={14}/> Sao chép link</button></div><p className="small-muted" style={{marginTop:10}}>Biểu mẫu gồm họ tên, số điện thoại, đơn vị/nhóm, cam kết doanh thu tháng, doanh thu mục tiêu (triệu đồng), số TVV tuyển dụng và ghi chú.</p></div><div><div className="stats" style={{gridTemplateColumns:"repeat(2,minmax(0,1fr))"}}><div className="stat"><div className="stat-label">TVV đăng ký</div><div className="stat-value">{advisorEntries.length}</div></div><div className="stat"><div className="stat-label">Chưa trúng</div><div className="stat-value">{advisorEntries.filter(c=>!winners.some(w=>w.customer_id===c.id)).length}</div></div></div><div className="toolbar" style={{margin:"12px 0"}}><button className="primary-btn" onClick={()=>{setWheelMode("advisors");setTab("wheel");}}><Disc3 size={14}/> Mở vòng quay TVV</button><button className="secondary-btn" onClick={()=>downloadWorkbook(advisorEntries.map((c,i)=>{let m:any={};try{m=JSON.parse(c.survey_feedback||"{}")}catch{};return {"STT":i+1,"Tư vấn viên":c.full_name,"Điện thoại":c.phone,"Đơn vị/Nhóm":c.agency||"","Cam kết kinh doanh":m.commitment||"","Doanh thu mục tiêu (triệu)":m.revenue||"","TVV tuyển dụng":m.recruit||"","Ghi chú":m.notes||"","Thời điểm gửi":c.created_at}}),"khao-sat-cam-ket-tvv.xlsx")}><Download size={14}/> Xuất Excel</button></div></div></div><div className="table-wrap" style={{marginTop:18}}><table><thead><tr><th>STT</th><th>Tư vấn viên</th><th>Điện thoại</th><th>Đơn vị / Nhóm</th><th>Cam kết</th><th>Doanh thu mục tiêu</th><th>TVV tuyển dụng</th><th>Thời gian gửi</th><th>Trạng thái</th></tr></thead><tbody>{advisorEntries.map((c,i)=>{let m:any={};try{m=JSON.parse(c.survey_feedback||"{}")}catch{};return <tr key={c.id}><td>{i+1}</td><td><b>{c.full_name}</b></td><td>{c.phone}</td><td>{c.agency||"—"}</td><td>{m.commitment||"—"}</td><td>{m.revenue||"—"}</td><td>{m.recruit||"—"}</td><td>{new Date(c.created_at).toLocaleString("vi-VN")}</td><td><span className="tag">{winners.some(w=>w.customer_id===c.id)?"Đã trúng":"Đủ điều kiện"}</span></td></tr>})}</tbody></table>{!advisorEntries.length&&<div className="empty">Chưa có TVV gửi khảo sát. Sao chép link hoặc quét QR để bắt đầu.</div>}</div></section>}

      {tab==="winners"&&<section className="panel"><div className="panel-head"><div><h3><Trophy size={18} style={{display:"inline",verticalAlign:"-3px",marginRight:8,color:"#b88b30"}}/>Danh sách trúng thưởng</h3><p>Danh sách lịch sử kết quả của sự kiện.</p></div><div className="toolbar"><button className="secondary-btn" onClick={exportWinners}><Download size={15}/> Xuất Excel</button>{isAdmin&&<button className="danger-btn" onClick={resetWinners}><RotateCcw size={15}/> Đặt lại kết quả</button>}</div></div><div style={{position:"relative",maxWidth:420,marginBottom:14}}><Search size={15} style={{position:"absolute",left:12,top:13,color:"#829087"}}/><input className="search-input" style={{paddingLeft:36}} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm người trúng, TVV hoặc giải..."/></div><div className="table-wrap"><table><thead><tr><th>STT</th><th>Khách hàng</th><th>Số điện thoại</th><th>TVV mời</th><th>Giải thưởng</th><th>Thời gian</th></tr></thead><tbody>{filteredWinners.map((w,i)=><tr key={w.id}><td>{i+1}</td><td><b>{w.full_name}</b><div className="small-muted">{w.customer_code}</div></td><td>{w.phone}</td><td>{w.advisor_name||"—"}</td><td><span className="tag">{w.prize_name}</span></td><td>{new Date(w.won_at).toLocaleString("vi-VN")}</td></tr>)}</tbody></table>{!filteredWinners.length&&<div className="empty">Chưa có khách hàng trúng thưởng.</div>}</div></section>}

      {tab==="survey"&&<div className="section-grid"><section className="panel"><div className="panel-head"><div><h3><ChartNoAxesCombined size={18} style={{display:"inline",verticalAlign:"-3px",marginRight:7,color:"#0b775a"}}/>Tổng quan khảo sát</h3><p>Tổng hợp ý kiến từ khách đã đăng ký.</p></div></div><div className="stats" style={{gridTemplateColumns:"repeat(2,minmax(0,1fr))"}}><div className="stat"><div className="stat-label">Đã phản hồi</div><div className="stat-value">{customers.filter(c=>Number(c.survey_rating)>0).length}</div></div><div className="stat"><div className="stat-label">Điểm trung bình</div><div className="stat-value">{customers.filter(c=>Number(c.survey_rating)>0).length?(customers.reduce((a,c)=>a+Number(c.survey_rating||0),0)/customers.filter(c=>Number(c.survey_rating)>0).length).toFixed(1):"—"}<span style={{fontSize:13,color:"#8b9a92"}}>/5</span></div></div></div><h3 style={{marginTop:15}}>Mức độ hài lòng</h3>{[5,4,3,2,1].map(n=>{const count=customers.filter(c=>Number(c.survey_rating)===n).length;return <div key={n} style={{margin:"14px 0"}}><div style={{display:"flex",justifyContent:"space-between",fontSize:12,marginBottom:6}}><span>{n} / 5 điểm</span><b>{count}</b></div><div style={{height:8,background:"#edf2ee",borderRadius:10,overflow:"hidden"}}><div style={{height:"100%",width:`${customers.length?count/customers.length*100:0}%`,background:"#0c7958",borderRadius:10}}/></div></div>})}</section><section className="panel"><div className="panel-head"><div><h3>Nhu cầu khách hàng</h3><p>Thống kê chủ đề khách quan tâm.</p></div><button className="secondary-btn" onClick={()=>downloadWorkbook(customers.map(c=>({"Họ tên":c.full_name,"TVV":c.advisor_name,"Điểm":c.survey_rating,"Nhu cầu":c.survey_interest,"Góp ý":c.survey_feedback})),"khao-sat-khach-hang.xlsx")}><Download size={14}/> Xuất khảo sát</button></div>{Array.from(new Set(customers.map(c=>c.survey_interest).filter(Boolean))).map(topic=>{const count=customers.filter(c=>c.survey_interest===topic).length;return <div key={topic} className="prize-row" style={{marginBottom:9}}><div><div className="prize-name">{topic}</div><div className="prize-meta">{customers.length?Math.round(count/customers.length*100):0}% số khách đăng ký</div></div><span className="prize-count">{count}</span></div>})}{!customers.some(c=>c.survey_interest)&&<div className="empty">Chưa có phản hồi khảo sát.</div>}<h3 style={{marginTop:20}}>Góp ý gần đây</h3>{customers.filter(c=>c.survey_feedback).slice(0,8).map(c=><div className="prize-row" key={c.id} style={{display:"block",marginTop:8}}><div className="prize-name">{c.full_name}</div><div className="prize-meta" style={{whiteSpace:"normal",lineHeight:1.6}}>{c.survey_feedback}</div></div>)}</section></div>}

      {tab==="settings"&&<div className="section-grid"><section className="panel"><div className="panel-head"><div><h3><Settings2 size={17} style={{display:"inline",verticalAlign:"-3px",marginRight:7}}/>Thông tin sự kiện</h3><p>Cập nhật tiêu đề hiển thị và ngày tổ chức.</p></div></div><div className="field-grid"><div className="field full"><label>Tên sự kiện</label><input value={eventName} onChange={e=>setEventName(e.target.value)}/></div><div className="field full"><label>Ngày tổ chức</label><input type="date" value={eventDate} onChange={e=>setEventDate(e.target.value)}/></div><div className="field full"><label>Giờ bắt đầu sự kiện</label><input type="time" value={eventTime} onChange={e=>setEventTime(e.target.value)}/></div></div><div style={{marginTop:15}}><button className="primary-btn" onClick={saveSettings}>Lưu cấu hình</button></div><hr style={{border:0,borderTop:"1px solid #e6ece8",margin:"24px 0"}}/><h3>Danh sách chọn nhanh khi đăng ký</h3><p className="small-muted">Mỗi dòng là một lựa chọn trong danh sách thả xuống trên biểu mẫu đăng ký QR.</p><div className="field-grid" style={{marginTop:12}}><div className="field"><label>Danh sách TVV mời khách</label><textarea rows={6} value={advisorOptionsText} onChange={e=>setAdvisorOptionsText(e.target.value)} placeholder={"Nguyễn Văn A\nTrần Thị B"}/></div><div className="field"><label>Danh sách Đơn vị / Nhóm</label><textarea rows={6} value={agencyOptionsText} onChange={e=>setAgencyOptionsText(e.target.value)} placeholder={"GA 1\nNhóm kinh doanh A"}/></div><div className="field full"><button className="secondary-btn" onClick={saveSettings}>Lưu danh sách TVV và Đơn vị/Nhóm</button></div></div><hr style={{border:0,borderTop:"1px solid #e6ece8",margin:"24px 0"}}/><h3>QR riêng cho sự kiện</h3><p className="small-muted">Mã QR bên dưới chứa tên sự kiện, ngày và giờ đã cài đặt. Khách quét mã sẽ vào trang đăng ký độc lập, không thấy menu quản trị.</p><div className="qr-box" style={{marginTop:12}}><QRCodeSVG value={registrationUrl||"https://example.com"} size={210} level="H" includeMargin/></div><p className="link-break" style={{marginTop:10}}>{registrationUrl}</p><button className="secondary-btn" style={{marginTop:10}} onClick={()=>{navigator.clipboard?.writeText(registrationUrl);showNotice("Đã sao chép QR/link của sự kiện này.");}}><Copy size={14}/> Sao chép link QR</button><div style={{marginTop:12,display:"flex",flexWrap:"wrap",gap:10}}><button className="primary-btn" style={{minHeight:44}} onClick={()=>setQrFullscreen(true)}><Maximize2 size={16}/> PHÓNG TO QR TOÀN MÀN HÌNH</button></div><hr style={{border:0,borderTop:"1px solid #e6ece8",margin:"24px 0"}}/><h3>Quản lý giải thưởng</h3><form onSubmit={addPrize} className="field-grid" style={{marginTop:15}}><div className="field"><label>Tên giải</label><input value={newPrize.name} onChange={e=>setNewPrize({...newPrize,name:e.target.value})} placeholder="Ví dụ: Giải Tư" required/></div><div className="field"><label>Số lượng</label><input type="number" min="1" value={newPrize.quantity} onChange={e=>setNewPrize({...newPrize,quantity:e.target.value})} required/></div><div className="field full"><button className="secondary-btn" type="submit"><Plus size={14}/> Thêm giải thưởng</button></div></form><div className="prize-list" style={{marginTop:15}}>{prizes.map(p=>{const edit=prizeEdits[p.id]||{name:p.name,quantity:String(p.quantity)};return <div className="prize-row" key={p.id} style={{alignItems:"flex-start",gap:12}}><div style={{flex:1,minWidth:0}}><div className="field-grid" style={{gridTemplateColumns:"minmax(0,1.4fr) minmax(90px,.7fr)",gap:10}}><div className="field"><label>Tên giải</label><input aria-label={`Tên giải ${p.name}`} value={edit.name} onChange={e=>setPrizeEdits(prev=>({...prev,[p.id]:{...edit,name:e.target.value}}))} /></div><div className="field"><label>Số lượng</label><input aria-label={`Số lượng ${p.name}`} type="number" min={Math.max(1,p.won)} step="1" value={edit.quantity} onChange={e=>setPrizeEdits(prev=>({...prev,[p.id]:{...edit,quantity:e.target.value}}))} /></div></div><div className="prize-meta" style={{marginTop:7}}>Đã trao {p.won}/{p.quantity} giải</div></div><div className="toolbar" style={{flexWrap:"wrap",justifyContent:"flex-end"}}><button className="primary-btn" onClick={async()=>{const name=edit.name.trim();const quantity=Number(edit.quantity);if(!name||!Number.isInteger(quantity)||quantity<1){showNotice("Vui lòng nhập tên giải và số lượng nguyên lớn hơn 0.","error");return;}if(quantity<p.won){showNotice(`Số lượng không thể thấp hơn ${p.won} giải đã trao.`,"error");return;}const next=prizes.map(x=>x.id===p.id?{...x,name,quantity}:x);try{await savePrizesToServer(next);setPrizes(next);setPrizeEdits(prev=>({...prev,[p.id]:{name,quantity:String(quantity)}}));showNotice(`Đã lưu giải ${name} lên Supabase.`);}catch(error){showNotice(error instanceof Error?error.message:"Không thể lưu giải thưởng.","error");}}} >Lưu</button><button className="secondary-btn" onClick={async()=>{const next=prizes.map(x=>x.id===p.id?{...x,active:!x.active}:x);try{await savePrizesToServer(next);setPrizes(next);showNotice(`Đã ${p.active?"tắt":"bật"} ${p.name} và lưu lên Supabase.`);}catch(error){showNotice(error instanceof Error?error.message:"Không thể cập nhật giải thưởng.","error");}}}>{p.active?"Tắt":"Bật"}</button><button className="danger-btn" disabled={p.won>0} onClick={async()=>{if(!confirm(`Xóa giải ${p.name}? Giải sẽ bị xóa khỏi cơ sở dữ liệu chung và không còn xuất hiện trên vòng quay.`))return;try{if(supabaseConfigured){const response=await fetch("/api/admin/prizes",{method:"DELETE",headers:{"Content-Type":"application/json","x-admin-pin":adminPin},body:JSON.stringify({id:p.id}),cache:"no-store"});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Không thể xóa giải khỏi Supabase.");}const next=prizes.filter(x=>x.id!==p.id);setPrizes(next);setSelectedPrize(current=>current===p.id?(next.find(x=>x.active&&x.won<x.quantity)?.id||""):current);setPrizeEdits(prev=>{const copy={...prev};delete copy[p.id];return copy;});saveLocal("lwv_prizes",next);showNotice("Đã xóa giải thưởng và cập nhật danh sách vòng quay.");}catch(error){showNotice(error instanceof Error?error.message:"Không thể xóa giải thưởng. Vui lòng thử lại.","error");}}}><Trash2 size={13}/></button></div></div>})}</div></section><section className="panel"><div className="panel-head"><div><h3><ShieldCheck size={17} style={{display:"inline",verticalAlign:"-3px",marginRight:7}}/>Kết nối dữ liệu</h3><p>Đồng bộ nhiều thiết bị bằng Supabase.</p></div></div>{supabaseConfigured?<div className="notice success">Đã phát hiện biến môi trường Supabase. Hãy chạy SQL schema và kiểm tra chính sách truy cập trước khi dùng thật.</div>:<div className="notice">Chưa có biến môi trường Supabase. Dữ liệu demo lưu trong localStorage của trình duyệt hiện tại và không tự đồng bộ sang thiết bị khác.</div>}<button className="secondary-btn full-btn" onClick={refreshFromSupabase}><RefreshCw size={15}/> Đồng bộ từ Supabase</button><div style={{marginTop:20}}><h3>PIN quản trị trên thiết bị</h3><p className="small-muted">Chưa có PIN mặc định. Tạo PIN riêng cho thiết bị này; PIN thiết bị chỉ lưu trên trình duyệt và không thay thế xác thực máy chủ.</p><div className="field" style={{marginTop:12}}><label>PIN quản trị trên thiết bị</label><input value={adminPin} onChange={e=>setAdminPin(e.target.value)} type="password" inputMode="numeric" placeholder="Tạo PIN riêng, không dùng PIN mặc định"/></div><button className="secondary-btn" style={{marginTop:12}} onClick={saveSettings}>Lưu PIN demo</button></div><div style={{marginTop:22}}><h3>Hướng dẫn đưa lên Vercel</h3><ol className="small-muted" style={{paddingLeft:18,lineHeight:2}}><li>Tạo project Supabase và chạy file <b>supabase/schema.sql</b>.</li><li>Thêm NEXT_PUBLIC_SUPABASE_URL và NEXT_PUBLIC_SUPABASE_ANON_KEY trong Vercel Environment Variables.</li><li>Đẩy source lên GitHub, import repository vào Vercel và deploy.</li><li>Kiểm thử QR trên điện thoại khác, import Excel, quay 7 giây và xuất danh sách.</li></ol><p className="small-muted">Bản source hiện là nền tảng MVP. Trước sự kiện thật cần bổ sung đăng nhập Supabase Auth, RLS/phân quyền admin và API quay thưởng phía máy chủ; không dùng PIN trình duyệt làm bảo mật thật.</p></div></section></div>}
      {!publicRegistration&&<footer className="footer">VÒNG QUAY MAY MẮN · {eventName} · Dữ liệu khách hàng cần được bảo vệ và chỉ dùng đúng mục đích đã thông báo.</footer>}
    </main>
    {selectedCustomer&&<div className="modal-backdrop" role="dialog" aria-modal="true" onClick={()=>setSelectedCustomer(null)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="panel-head"><div><h3>Thông tin khách hàng</h3><p>Chi tiết đăng ký và kết quả khảo sát</p></div><button className="secondary-btn" onClick={()=>setSelectedCustomer(null)}><X size={15}/></button></div><div className="customer-detail-grid"><div><span className="small-muted">Họ và tên</span><b>{selectedCustomer.full_name}</b></div><div><span className="small-muted">Mã khách hàng</span><b>{selectedCustomer.customer_code||"Chưa có mã KH"}</b></div><div><span className="small-muted">Số điện thoại</span><b>{selectedCustomer.phone}</b></div><div><span className="small-muted">TVV mời</span><b>{selectedCustomer.advisor_name||"—"}</b></div><div><span className="small-muted">Đơn vị / nhóm</span><b>{selectedCustomer.agency||"—"}</b></div><div><span className="small-muted">Ngày hẹn tư vấn</span><b>{selectedCustomer.appointment_date||"Chưa đặt lịch"}</b></div><div><span className="small-muted">Sự kiện</span><b>{selectedCustomer.event_name||"Chưa phân loại"}</b></div><div><span className="small-muted">Ngày / giờ tổ chức</span><b>{selectedCustomer.event_date||"—"} {selectedCustomer.event_time||""}</b></div><div><span className="small-muted">Mức độ hài lòng</span><b>{selectedCustomer.survey_rating?`${selectedCustomer.survey_rating}/5`:"Chưa trả lời"}</b></div><div><span className="small-muted">Quan tâm giải pháp</span><b>{selectedCustomer.survey_interest||"Chưa cung cấp"}</b></div><div style={{gridColumn:"1 / -1"}}><span className="small-muted">Ý kiến góp ý</span><p style={{whiteSpace:"pre-wrap",margin:"5px 0 0"}}>{selectedCustomer.survey_feedback||"Không có góp ý"}</p></div><div style={{gridColumn:"1 / -1"}}><span className="small-muted">Trạng thái</span><b>{winners.some(w=>w.customer_id===selectedCustomer.id)?`Đã trúng: ${winners.find(w=>w.customer_id===selectedCustomer.id)?.prize_name}`:selectedCustomer.eligible===false?"Không đủ điều kiện":"Đủ điều kiện quay"}</b></div></div><div className="toolbar" style={{marginTop:18,justifyContent:"flex-end",flexWrap:"wrap"}}>{winners.some(w=>w.customer_id===selectedCustomer.id)&&isAdmin&&<button className="danger-btn" onClick={()=>void resetCustomerWin(selectedCustomer)}><RotateCcw size={14}/> Reset trúng thưởng · cho quay lại</button>}<button className="primary-btn" onClick={()=>setSelectedCustomer(null)}>Đóng</button></div></div></div>}
    {winnerModal&&<div className="result-overlay result-overlay-fullscreen" role="dialog" aria-modal="true"><div className="celebration-confetti" aria-hidden="true">🎉 ✨ 🎊 ✨ 🏆 ✨ 🎉</div><div className="result-card result-card-fullscreen"><div className="result-icon result-icon-large">🏆</div><h2>{customers.some(c=>c.id===winnerModal.customer_id&&c.event_name==="__TVV_SURVEY__")?"CHÚC MỪNG TƯ VẤN VIÊN TRÚNG THƯỞNG":"CHÚC MỪNG KHÁCH HÀNG MAY MẮN"}</h2><div className="winner-name winner-name-large">{winnerModal.full_name}</div><div className="winner-prize winner-prize-large">✦ {winnerModal.prize_name} ✦</div><div className="winner-detail winner-detail-large">Số điện thoại: ••••{String(winnerModal.phone||"").replace(/\D/g,"").slice(-4)}<br/>TVV mời: {winnerModal.advisor_name||"—"}<br/>Thời gian: {new Date(winnerModal.won_at).toLocaleString("vi-VN")}</div><p className="winner-congrats-note">Chúc mừng quý khách! Kính chúc quý khách nhiều sức khỏe và may mắn.</p><button className="primary-btn winner-confirm-btn" onClick={()=>setWinnerModal(null)}><CheckCircle2 size={20}/> XÁC NHẬN KẾT QUẢ · TIẾP TỤC</button></div></div>}
    {!publicRegistration&&qrFullscreen&&<div className="qr-fullscreen-overlay" role="dialog" aria-modal="true" aria-label="QR đăng ký sự kiện toàn màn hình"><div className="qr-fullscreen-top"><div><div className="qr-fullscreen-title">{eventName||"VÒNG QUAY MAY MẮN"}</div><div className="qr-fullscreen-meta">{eventDate?new Date(eventDate+"T00:00:00").toLocaleDateString("vi-VN"):""}{eventTime?` · ${eventTime}`:""}</div></div><button className="qr-fullscreen-close" onClick={()=>setQrFullscreen(false)}><X size={18}/> Đóng <span>(ESC)</span></button></div><div className="qr-fullscreen-content"><div className="qr-fullscreen-code"><QRCodeSVG value={registrationUrl||"https://example.com"} size={640} level="H" includeMargin/></div><h2>QUÉT MÃ QR ĐỂ ĐĂNG KÝ</h2><p>Dùng camera điện thoại để quét mã và điền thông tin tham gia sự kiện</p></div><div className="qr-fullscreen-url">{registrationUrl}</div></div>}
    {!publicRegistration&&qrOpen&&<div className="modal-backdrop" onClick={()=>setQrOpen(false)}><div className="modal" onClick={e=>e.stopPropagation()}><div className="panel-head"><div><h3>QR đăng ký khách hàng</h3><p>Quét bằng điện thoại để mở biểu mẫu.</p></div><button className="secondary-btn" onClick={()=>setQrOpen(false)}><X size={15}/></button></div><div className="qr-box"><QRCodeSVG value={registrationUrl||"https://example.com"} size={260} level="H" includeMargin/></div><p className="link-break" style={{marginTop:12}}>{registrationUrl}</p><div className="toolbar" style={{marginTop:14}}><button className="secondary-btn" onClick={()=>{navigator.clipboard?.writeText(registrationUrl);showNotice("Đã sao chép link QR.");}}><Copy size={14}/> Sao chép link</button><button className="primary-btn" onClick={()=>setQrOpen(false)}>Đóng</button></div></div></div>}
  </div>;
}
