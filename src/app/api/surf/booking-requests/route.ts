import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bookingRequestSchema, normalizeEmail } from "@/features/bookings/domain";
import { Resend } from "resend";

const headers={"Cache-Control":"no-store"};
export async function POST(req:NextRequest){
 try{
  const body=bookingRequestSchema.safeParse(await req.json());
  if(!body.success)return NextResponse.json({error:"Please check your trip details."},{status:400,headers});
  if(body.data.website)return NextResponse.json({ok:true},{headers});
  const {SUPABASE_SERVICE_ROLE_KEY,NEXT_PUBLIC_SUPABASE_URL,RESEND_API_KEY,BOOKSURF_FROM_EMAIL}=process.env;
  if(!SUPABASE_SERVICE_ROLE_KEY||!NEXT_PUBLIC_SUPABASE_URL)return NextResponse.json({error:"Booking requests are temporarily unavailable."},{status:503,headers});
  const db=createClient(NEXT_PUBLIC_SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const {name,dates,guests,level,budget,notes}=body.data;
  const email=normalizeEmail(body.data.email);
  const {data,error}=await db.from("surf_booking_requests").insert({name,email,dates,guests,skill_level:level,budget,notes,operator_slug:"baja-experience-tours",destination:"Baja California, Mexico"}).select("id").single();
  if(error){console.error("Booking request insert failed",error.code);return NextResponse.json({error:"Could not save your request. Please try again."},{status:500,headers})}
  if(RESEND_API_KEY&&BOOKSURF_FROM_EMAIL){
   const resend=new Resend(RESEND_API_KEY);
   const safe=(v:string)=>v.replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]||ch));
   try{await resend.emails.send({from:BOOKSURF_FROM_EMAIL,to:"Booksurfingtrips@gmail.com",subject:"New Baja trip request "+data.id.slice(0,8),text:`Booking request: ${data.id}\nName: ${name}\nEmail: ${email}\nDates: ${dates}\nGuests: ${guests}\nSkill: ${level}\nBudget: ${budget}\nNotes: ${notes}`,html:`<h2>New Baja booking request</h2><p><b>Reference:</b> ${safe(data.id)}</p><p><b>Name:</b> ${safe(name)}<br/><b>Email:</b> ${safe(email)}<br/><b>Dates:</b> ${safe(dates)}<br/><b>Guests:</b> ${guests}<br/><b>Level:</b> ${safe(level)}<br/><b>Budget:</b> ${safe(budget)}</p><p>${safe(notes)}</p>`});}catch(err){console.error("Booking notification failed",err)}
  }
  return NextResponse.json({ok:true,reference:data.id},{status:201,headers});
 }catch{return NextResponse.json({error:"Unable to process request."},{status:400,headers})}
}
