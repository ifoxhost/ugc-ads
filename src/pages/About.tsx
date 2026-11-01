import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
export default function About() { return <><section className="mx-auto max-w-4xl px-6 py-32"><p className="mb-4 text-sm text-primary">ABOUT UGC ADS STUDIO</p><h1 className="mb-8 text-4xl">A creative workspace for your brand.</h1><p className="max-w-2xl text-lg leading-relaxed text-muted-foreground">Bring together your product, audience, script, and creator direction to develop product-focused AI creative. UGC Ads Studio is built for ecommerce brands, agencies, and media buyers who want more room to explore their next ad angle.</p><Button asChild className="mt-10"><Link to="/create">Create UGC Ad</Link></Button></section><Footer /></>; }
