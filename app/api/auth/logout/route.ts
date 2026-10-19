import { NextResponse } from "next/server"; import { createSupabaseServerClient } from "@/lib/supabase-server";
export async function POST(){const sb=await createSupabaseServerClient();await sb.auth.signOut();return NextResponse.redirect(new URL("/login",process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000"),303);}
