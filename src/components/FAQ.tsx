import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
export const UGC_FAQS = [
 ["What is UGC Ads Studio?", "A product-focused creative workspace for AI-powered UGC ads. Start with your product, shape the script, choose a creator direction, and review your generated creative."],
 ["Can I use my ads in paid TikTok and Meta campaigns?", "Review the applicable generation-provider terms and each platform’s advertising policies. You are responsible for rights to uploaded assets, disclosures, and the accuracy of product claims."],
 ["Do videos include captions?", "You can edit and export your ad script and social caption. Only outputs that explicitly show aligned subtitles support subtitle export; captions are not guaranteed on every render."],
 ["Which aspect ratio should I choose?", "9:16 is the default for TikTok, Reels, and Shorts. Square and landscape creative can be selected where the generation workflow supports them. Actual output dimensions are shown with your result."],
 ["Can I customize the creator and setting?", "Choose creator appearance, tone, and a setting in the studio. These guide generation; AI results can vary."],
 ["How do credits work?", "Your existing paid plan and monthly credit allowance remain unchanged. Generation uses your plan’s credits; the Dashboard shows your remaining balance. Draft editing does not submit a generation job."],
 ["Where are my saved projects?", "Your Library keeps your saved media, status, and campaign notes. Previous projects remain accessible. Use Trash to restore recently deleted items."],
];
export default function FAQ() { return <section className="mx-auto max-w-3xl px-6 py-20"><p className="mb-3 text-xs font-semibold text-primary">A FEW GOOD QUESTIONS</p><h2 className="mb-8 text-3xl">Before your next campaign.</h2><Accordion type="single" collapsible>{UGC_FAQS.map(([q,a],i) => <AccordionItem key={q} value={String(i)}><AccordionTrigger className="text-left">{q}</AccordionTrigger><AccordionContent className="leading-relaxed text-muted-foreground">{a}</AccordionContent></AccordionItem>)}</Accordion></section>; }
