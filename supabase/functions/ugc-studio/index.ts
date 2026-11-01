import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@4";
import { Output } from "npm:ai@6";
import { createResponsesCall } from "../_shared/ugc-responses.ts";
const Script = z.object({ angle: z.string(), hook: z.string(), body: z.string(), cta: z.string(), caption: z.string() });
const Draft = z.object({ productName:z.string().trim().min(1).max(200), productUrl:z.string().max(1000).default(""), audience:z.string().max(1000), benefit:z.string().min(1).max(2000), offer:z.string().max(500), cta:z.string().max(300), productImages:z.array(z.string().url().refine(v=>v.startsWith("https://"))).min(1).max(6), scripts:z.array(Script).max(3), hooks:z.array(z.string()).max(5), selectedScript:z.number().int().min(0).max(2), demographics:z.object({gender:z.string(),bodyBuild:z.string(),ageRange:z.string(),ethnicity:z.array(z.string()).max(8)}), setting:z.string().max(200), tone:z.string().max(100), framework:z.string().max(100), aspectRatio:z.enum(["9:16","1:1","16:9","4:5"]), mediaType:z.enum(["image","video"]), imageStyle:z.string().max(100), customDirection:z.string().max(2000) });
const Input=z.object({ action:z.enum(["scripts","image","video"]), draft:Draft });
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 let adId:string|undefined;
 const sb=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
 try {
  const token=req.headers.get("Authorization")?.replace(/^Bearer /i,""); if(!token) return json({error:"Sign in to continue."},401);
  const {data:{user}}=await sb.auth.getUser(token); if(!user) return json({error:"Sign in to continue."},401);
  const parsed=Input.safeParse(await req.json()); if(!parsed.success) return json({error:"Check your product details and images.",details:parsed.error.flatten()},400);
  const {action,draft}=parsed.data;
  const {data:admin}=await sb.rpc("has_role",{_user_id:user.id,_role:"admin"});
  const {data:subscription}=await sb.from("subscriptions").select("credits,credits_used,renew_date,status").eq("user_id",user.id).eq("status","active").maybeSingle();
  if(!admin && (!subscription || new Date(subscription.renew_date)<=new Date() || subscription.credits<=subscription.credits_used)) return json({error:"An active plan with available credits is required.",code:"NO_SUBSCRIPTION"},402);
  if(action==="video") return json({error:"The existing UGC video service is unavailable. Your draft is preserved; no video credit was charged. A working UGC video workflow must be connected before rendering.",code:"UGC_VIDEO_UNAVAILABLE"},503);
  const key=Deno.env.get("LOVABLE_API_KEY"); if(!key) return json({error:"AI generation is not configured."},503);
  if(action==="scripts") {
   const {result}=createResponsesCall(req,{baseURL:"https://ai.gateway.lovable.dev/v1",apiKey:key,model:"openai/gpt-6-astra"},[{role:"user",content:JSON.stringify({product:draft.productName,audience:draft.audience,benefit:draft.benefit,offer:draft.offer,cta:draft.cta,framework:draft.framework})}],"Write exactly three distinct concise UGC ad scripts and exactly five alternative short hooks. Use only supplied facts. Never invent discounts, customer testimonials, certifications or performance claims. Scripts use hook, body, cta, caption, angle. Hooks should be short enough to speak in about three seconds.");
   const text=await result.text;
   const match=text.match(/\{[\s\S]*\}/); if(!match) return json({error:"AI returned no usable scripts. Your product details are preserved."},502);
   const output=z.object({scripts:z.array(Script).length(3),hooks:z.array(z.string()).length(5)}).safeParse(JSON.parse(match[0]));
   if(!output.success) return json({error:"AI did not return three scripts and five hooks. Please start a new script request."},502);
   return json(output.data);
  }
  const script=draft.scripts[draft.selectedScript]; if(!script) return json({error:"Choose a script before generating."},400);
  const {data:ad,error:insertError}=await sb.from("generated_ads").insert({user_id:user.id,email:user.email||"",product_image_url:draft.productImages[0],style_template:"ugc-image",aspect_ratio:draft.aspectRatio,status:"processing",ad_copy:{draft,productName:draft.productName,framework:draft.framework,headline:script.hook,cta:script.cta,caption:script.caption,pipelineStage:"generating image"},prompt_used:`UGC creative: ${draft.productName}`}).select("id").single();
  if(insertError||!ad) throw new Error("Could not save your ad job."); adId=ad.id;
  const prompt=`Create a realistic product-focused UGC advertising photo. Preserve the exact product, packaging, color and brand from these reference images. Product: ${draft.productName}. Known benefit: ${draft.benefit}. Style: ${draft.imageStyle}. Framework: ${draft.framework}. Setting: ${draft.setting}. Creator appearance: ${JSON.stringify(draft.demographics)}. Tone: ${draft.tone}. Direction: ${draft.customDirection}. Aspect ratio ${draft.aspectRatio}. No invented testimonials, text overlays or medical transformations.`;
  const response=await fetch("https://ai.gateway.lovable.dev/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"google/gemini-3.1-flash-image-preview",messages:[{role:"user",content:[{type:"text",text:prompt},...draft.productImages.map(url=>({type:"image_url",image_url:{url}}))]}],modalities:["image","text"]})});
  if(!response.ok){const status=response.status;const failure=status===402?"AI credits are unavailable. Review workspace billing before generating again.":status===403?"Image generation is blocked by the provider or workspace policy.":`Image generation could not complete (${status}).`; await sb.from("generated_ads").update({status:"failed",ad_copy:{draft,productName:draft.productName,error:failure,pipelineStage:"failed"}}).eq("id",adId); return json({error:failure,adId},status);}
  const payload=await response.json(); const raw=payload.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if(typeof raw!=="string" || !/^data:image\/(png|jpeg|webp);base64,/.test(raw)) throw new Error("The image model returned an empty or invalid image.");
  const mime=raw.split(";")[0].slice(5); const bytes=Uint8Array.from(atob(raw.split(",")[1]),c=>c.charCodeAt(0)); if(bytes.length<1024) throw new Error("The image payload was incomplete.");
  const path=`${user.id}/ugc-${adId}.${mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg"}`;
  const {error:uploadError}=await sb.storage.from("ugc-generated").upload(path,bytes,{contentType:mime,upsert:false}); if(uploadError) throw new Error("Could not save the generated image.");
  const {data:url}=sb.storage.from("ugc-generated").getPublicUrl(path);
  const {error:saveError}=await sb.from("generated_ads").update({generated_image_url:url.publicUrl,status:"completed",completed_at:new Date().toISOString(),ad_copy:{draft,productName:draft.productName,framework:draft.framework,headline:script.hook,cta:script.cta,caption:script.caption,pipelineStage:"done"}}).eq("id",adId); if(saveError) throw new Error("Could not save the completed ad.");
  await sb.from("notifications").insert({user_id:user.id,type:"ad_completed",title:"Your UGC image ad is ready",body:draft.productName,url:`/library?ad=${adId}`});
  return json({adId,generatedImageUrl:url.publicUrl});
 }catch(e){const message=e instanceof Error?e.message:"Generation could not complete."; console.error("ugc-studio failure",{adId,errorType:e instanceof Error?e.name:"unknown"}); if(adId) await sb.from("generated_ads").update({status:"failed"}).eq("id",adId); const status=typeof e==="object"&&e&&"statusCode"in e?Number(e.statusCode):500; return json({error:message,adId},[400,401,402,403,404,429].includes(status)?status:500);}
});
