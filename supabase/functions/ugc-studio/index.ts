import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@4";
import { Output } from "npm:ai@6";
import { createResponsesCall } from "../_shared/ugc-responses.ts";
import { generateFluxImage, synthesizeVoice, submitTalkingVideo, checkTalkingVideo, falKey } from "../_shared/fal-ugc.ts";
import { validateCharacterPaths, characterDirection } from "../_shared/ugc-characters.ts";
const Script = z.object({ angle: z.string(), hook: z.string(), body: z.string(), cta: z.string(), caption: z.string() });
const Draft = z.object({ productName:z.string().trim().min(1).max(200), productUrl:z.string().max(1000).default(""), audience:z.string().max(1000), benefit:z.string().min(1).max(2000), offer:z.string().max(500), cta:z.string().max(300), productImages:z.array(z.string().url().refine(v=>v.startsWith("https://"))).min(1).max(6), scripts:z.array(Script).max(3), hooks:z.array(z.string()).max(5), selectedScript:z.number().int().min(0).max(2), demographics:z.object({gender:z.string(),bodyBuild:z.string(),ageRange:z.string(),ethnicity:z.array(z.string()).max(8)}), setting:z.string().max(200), tone:z.string().max(100), framework:z.string().max(100), aspectRatio:z.enum(["9:16","1:1","16:9","4:5"]), mediaType:z.enum(["image","video"]), imageStyle:z.string().max(100), imageEngine:z.enum(["gemini","flux"]).default("gemini"), customDirection:z.string().max(2000), characterId:z.string().uuid().nullable().optional() });
const CharacterInput = z.discriminatedUnion("action", [
 z.object({action:z.literal("characters-list")}),
 z.object({action:z.literal("character-save"),id:z.string().uuid().optional(),name:z.string().trim().min(1).max(100),imagePaths:z.array(z.string().min(1).max(300)).min(1).max(3)}),
 z.object({action:z.literal("character-delete"),id:z.string().uuid()})
]);
const Input=z.object({ action:z.enum(["scripts","image","video"]), draft:Draft });
function json(body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});}
Deno.serve(async req=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:corsHeaders});
 let adId:string|undefined;
 const sb=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"");
 try {
  const token=req.headers.get("Authorization")?.replace(/^Bearer /i,""); if(!token) return json({error:"Sign in to continue."},401);
  const {data:{user}}=await sb.auth.getUser(token); if(!user) return json({error:"Sign in to continue."},401);
  const body=await req.json();
  if (["characters-list","character-save","character-delete"].includes(body?.action)) {
   const input=CharacterInput.safeParse(body);
   if(!input.success) return json({error:"Use a character name and one to three reference photos (maximum 3).",details:input.error.flatten()},400);
   const value=input.data;
   if(value.action==="characters-list") {
    const {data:rows,error}=await sb.from("ugc_characters").select("id,name,image_paths").eq("user_id",user.id).order("created_at",{ascending:false});
    if(error) throw new Error("Could not load your characters.");
    const characters=await Promise.all((rows||[]).map(async row=>{
     const {data:images,error:signedError}=await sb.storage.from("character-references").createSignedUrls(row.image_paths,3600);
     if(signedError||images?.some(image=>image.error)) throw new Error("Could not load character photos. Edit the character to replace missing photos.");
     return {id:row.id,name:row.name,imagePaths:row.image_paths,imageUrls:images?.map(image=>image.signedUrl)||[]};
    }));
    return json({characters});
   }
   if(value.action==="character-save") {
    const invalid=validateCharacterPaths(value.imagePaths,user.id); if(invalid) return json({error:invalid},400);
    for(const path of value.imagePaths) {
     const [folder,file]=path.split("/");
     if(!folder||!file) return json({error:"Invalid character photo path."},400);
     const {data:files,error}=await sb.storage.from("character-references").list(folder,{search:file});
     const object=files?.find(item=>item.name===file);
     if(error||!object||!["image/png","image/jpeg","image/webp"].includes(object.metadata?.mimetype||"")) return json({error:"A reference photo is missing or invalid. Upload PNG, JPG, or WEBP images."},400);
    }
    const record={name:value.name,image_paths:value.imagePaths,updated_at:new Date().toISOString()};
    const result=value.id?await sb.from("ugc_characters").update(record).eq("id",value.id).eq("user_id",user.id).select("id").maybeSingle():await sb.from("ugc_characters").insert({...record,user_id:user.id}).select("id").single();
    if(result.error) throw new Error("Could not save your character.");
    if(!result.data) return json({error:"Character not found."},404);
    return json({id:result.data.id});
   }
   const {data:removed,error}=await sb.from("ugc_characters").delete().eq("id",value.id).eq("user_id",user.id).select("image_paths").maybeSingle();
   if(error) throw new Error("Could not delete your character.");
   if(!removed) return json({error:"Character not found."},404);
   for(const path of removed.image_paths){
    const {data:shared,error:lookupError}=await sb.from("ugc_characters").select("id").eq("user_id",user.id).contains("image_paths",[path]).limit(1);
    if(!lookupError&&!shared?.length) await sb.storage.from("character-references").remove([path]);
   }
   return json({deleted:true});
  }
  if(body?.action==="video-status"){
   const id=z.string().uuid().safeParse(body.adId); if(!id.success) return json({error:"Missing ad."},400);
   const {data:row}=await sb.from("generated_ads").select("id,user_id,status,ad_copy,generated_video_url").eq("id",id.data).maybeSingle();
   if(!row||row.user_id!==user.id) return json({error:"Ad not found."},404);
   const copy=(row.ad_copy||{}) as Record<string,any>;
   if(row.status!=="processing"||!copy.fal?.statusUrl) return json({adId:row.id,status:row.status,videoUrl:row.generated_video_url});
   const r=await checkTalkingVideo(copy.fal.statusUrl,copy.fal.responseUrl);
   if(r.state==="running") return json({adId:row.id,status:"processing",stage:r.status});
   if(r.state==="failed"){await sb.from("generated_ads").update({status:"failed",ad_copy:{...copy,error:r.error,pipelineStage:"failed"}}).eq("id",row.id); return json({adId:row.id,status:"failed",error:r.error});}
   const vid=await fetch(r.videoUrl); if(!vid.ok) throw new Error("Could not download the rendered video.");
   const bytes=new Uint8Array(await vid.arrayBuffer()); const path=`${user.id}/ugc-${row.id}.mp4`;
   const {error:upErr}=await sb.storage.from("ugc-generated").upload(path,bytes,{contentType:"video/mp4",upsert:true}); if(upErr) throw new Error("Could not save the rendered video.");
   const {data:pub}=sb.storage.from("ugc-generated").getPublicUrl(path);
   await sb.from("generated_ads").update({status:"completed",generated_video_url:pub.publicUrl,video_duration:r.duration?Math.round(r.duration):null,completed_at:new Date().toISOString(),ad_copy:{...copy,pipelineStage:"done"}}).eq("id",row.id);
   await sb.from("notifications").insert({user_id:user.id,type:"ad_completed",title:"Your UGC video ad is ready",body:copy.productName||"Video ad",url:`/library?ad=${row.id}`});
   return json({adId:row.id,status:"completed",videoUrl:pub.publicUrl});
  }
  const parsed=Input.safeParse(body); if(!parsed.success) return json({error:"Check your product details and images.",details:parsed.error.flatten()},400);
  const {action}=parsed.data;
  const draft={...parsed.data.draft,characterSnapshot:undefined as {id:string;name:string;imagePaths:string[]}|undefined};
  const {data:admin}=await sb.rpc("has_role",{_user_id:user.id,_role:"admin"});
  const {data:subscription}=await sb.from("subscriptions").select("credits,credits_used,renew_date,status").eq("user_id",user.id).eq("status","active").maybeSingle();
  if(!admin && (!subscription || new Date(subscription.renew_date)<=new Date() || subscription.credits<=subscription.credits_used)) return json({error:"An active plan with available credits is required.",code:"NO_SUBSCRIPTION"},402);
  if(action==="video"&&!falKey()) return json({error:"Video generation is not configured yet. Your draft is preserved; no credit was charged.",code:"UGC_VIDEO_UNAVAILABLE"},503);
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
  let characterUrls:string[]=[];
  if(draft.characterId){
   const {data:character,error}=await sb.from("ugc_characters").select("id,name,image_paths").eq("id",draft.characterId).eq("user_id",user.id).maybeSingle();
   if(error||!character) return json({error:"The selected character is unavailable. Choose another character or use a new creator."},400);
   const invalid=validateCharacterPaths(character.image_paths,user.id); if(invalid) return json({error:invalid},400);
   const {data:images,error:signedError}=await sb.storage.from("character-references").createSignedUrls(character.image_paths,3600);
   if(signedError||!images||images.some(image=>image.error||!image.signedUrl)) return json({error:"Character photos could not be loaded. Replace missing photos before generating."},400);
   characterUrls=images.flatMap(image=>image.signedUrl?[image.signedUrl]:[]);
   draft.characterSnapshot={id:character.id,name:character.name,imagePaths:character.image_paths};
  }
  const {data:ad,error:insertError}=await sb.from("generated_ads").insert({user_id:user.id,email:user.email||"",product_image_url:draft.productImages[0],style_template:action==="video"?"ugc-video":"ugc-image",aspect_ratio:draft.aspectRatio,status:"processing",ad_copy:{draft,productName:draft.productName,framework:draft.framework,headline:script.hook,cta:script.cta,caption:script.caption,pipelineStage:action==="video"?"creating creator shot":"generating image"},prompt_used:`UGC creative: ${draft.productName}`}).select("id").single();
  if(insertError||!ad) throw new Error("Could not save your ad job."); adId=ad.id;
  const prompt=action==="video"?`Photorealistic vertical selfie-style UGC frame of one creator facing the camera, mouth closed, face clearly visible and centered, holding the exact product from the reference images near their chest. Product: ${draft.productName}. Creator appearance: ${JSON.stringify(draft.demographics)}. Setting: ${draft.setting}. Tone: ${draft.tone}. Natural lighting, no text overlays, aspect ratio ${draft.aspectRatio}.`:`Create a realistic product-focused UGC advertising photo. Preserve the exact product, packaging, color and brand from these reference images. Product: ${draft.productName}. Known benefit: ${draft.benefit}. Style: ${draft.imageStyle}. Framework: ${draft.framework}. Setting: ${draft.setting}. Creator appearance: ${JSON.stringify(draft.demographics)}. Tone: ${draft.tone}. Direction: ${draft.customDirection}. Aspect ratio ${draft.aspectRatio}. No invented testimonials, text overlays or medical transformations.`;
  const identity=draft.characterSnapshot?characterDirection(draft.characterSnapshot.name,draft.productImages.length,characterUrls.length):"";
  let mime:string; let bytes:Uint8Array; const engine=action==="image"?draft.imageEngine:"gemini";
  if(engine==="flux"){
   if(!falKey()){await sb.from("generated_ads").update({status:"failed",ad_copy:{draft,productName:draft.productName,error:"FLUX is not configured.",pipelineStage:"failed"}}).eq("id",adId); return json({error:"FLUX image generation is not configured. No credit was charged.",adId},503);}
   const imgUrl=await generateFluxImage([prompt,identity].filter(Boolean).join("\n"),[...draft.productImages,...characterUrls],draft.aspectRatio);
   const r=await fetch(imgUrl); if(!r.ok) throw new Error("Could not download the FLUX image.");
   mime=(r.headers.get("content-type")||"image/jpeg").split(";")[0]; if(!/^image\/(png|jpeg|webp)$/.test(mime)) mime="image/jpeg";
   bytes=new Uint8Array(await r.arrayBuffer()); if(bytes.length<1024) throw new Error("The image payload was incomplete.");
  } else {
  const response=await fetch("https://ai.gateway.lovable.dev/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"google/gemini-3.1-flash-image",messages:[{role:"user",content:[{type:"text",text:[prompt,identity].filter(Boolean).join("\n")},...[...draft.productImages,...characterUrls].map(url=>({type:"image_url",image_url:{url}}))]}],modalities:["image","text"]})});
  if(!response.ok){const status=response.status;const failure=status===402?"AI credits are unavailable. Review workspace billing before generating again.":status===403?"Image generation is blocked by the provider or workspace policy.":`Image generation could not complete (${status}).`; await sb.from("generated_ads").update({status:"failed",ad_copy:{draft,productName:draft.productName,error:failure,pipelineStage:"failed"}}).eq("id",adId); return json({error:failure,adId},status);}
  const payload=await response.json(); const raw=payload.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if(typeof raw!=="string" || !/^data:image\/(png|jpeg|webp);base64,/.test(raw)) throw new Error("The image model returned an empty or invalid image.");
  mime=raw.split(";")[0].slice(5); bytes=Uint8Array.from(atob(raw.split(",")[1]),c=>c.charCodeAt(0)); if(bytes.length<1024) throw new Error("The image payload was incomplete.");
  }
  const path=`${user.id}/ugc-${adId}.${mime==="image/png"?"png":mime==="image/webp"?"webp":"jpg"}`;
  const {error:uploadError}=await sb.storage.from("ugc-generated").upload(path,bytes,{contentType:mime,upsert:false}); if(uploadError) throw new Error("Could not save the generated image.");
  const {data:url}=sb.storage.from("ugc-generated").getPublicUrl(path);
  if(action!=="video"&&!admin){const {data:charged,error:credErr}=await sb.rpc("consume_credit",{_user_id:user.id,_amount:1}); if(credErr||charged!==true){await sb.storage.from("ugc-generated").remove([path]); await sb.from("generated_ads").update({status:"failed",ad_copy:{draft,productName:draft.productName,error:"No credits left.",pipelineStage:"failed"}}).eq("id",adId); return json({error:"An active plan with available credits is required.",code:"NO_SUBSCRIPTION",adId},402);}}
  if(action==="video"){
   const baseCopy={draft,productName:draft.productName,framework:draft.framework,headline:script.hook,cta:script.cta,caption:script.caption};
   await sb.from("generated_ads").update({generated_image_url:url.publicUrl,ad_copy:{...baseCopy,pipelineStage:"recording voiceover"}}).eq("id",adId);
   const audioUrl=await synthesizeVoice([script.hook,script.body,script.cta].filter(Boolean).join(" "),draft.demographics.gender?.toLowerCase().startsWith("m")?"am_michael":"af_heart");
   const job=await submitTalkingVideo(url.publicUrl,audioUrl);
   if(!admin){const {error:credErr}=await sb.rpc("consume_credit",{_user_id:user.id,_amount:1}); if(credErr) console.error("consume_credit failed",credErr.message);}
   await sb.from("generated_ads").update({ad_copy:{...baseCopy,voiceoverUrl:audioUrl,fal:{requestId:job.requestId,statusUrl:job.statusUrl,responseUrl:job.responseUrl},pipelineStage:"rendering talking video"}}).eq("id",adId);
   return json({adId,status:"processing"});
  }
  const {error:saveError}=await sb.from("generated_ads").update({generated_image_url:url.publicUrl,status:"completed",completed_at:new Date().toISOString(),ad_copy:{draft,productName:draft.productName,framework:draft.framework,headline:script.hook,cta:script.cta,caption:script.caption,imageEngine:engine,imageModel:engine==="flux"?"fal-ai/flux-pro/kontext/max/multi":"google/gemini-3.1-flash-image",pipelineStage:"done"}}).eq("id",adId); if(saveError) throw new Error("Could not save the completed ad.");
  await sb.from("notifications").insert({user_id:user.id,type:"ad_completed",title:"Your UGC image ad is ready",body:draft.productName,url:`/library?ad=${adId}`});
  return json({adId,generatedImageUrl:url.publicUrl});
 }catch(e){const message=e instanceof Error?e.message:"Generation could not complete."; console.error("ugc-studio failure",{adId,errorType:e instanceof Error?e.name:"unknown"}); if(adId) await sb.from("generated_ads").update({status:"failed"}).eq("id",adId); const status=typeof e==="object"&&e&&"statusCode"in e?Number(e.statusCode):500; return json({error:message,adId},[400,401,402,403,404,429].includes(status)?status:500);}
});
