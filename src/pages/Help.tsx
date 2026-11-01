import FAQ from "@/components/FAQ";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
export default function Help() { return <div className="mx-auto max-w-5xl px-6 py-10"><h1 className="text-3xl">Help Center</h1><div className="mt-8 flex flex-wrap gap-3"><Button asChild><Link to="/create">Open Studio</Link></Button><Button asChild variant="outline"><Link to="/library">Ad Library</Link></Button><Button asChild variant="outline"><Link to="/account">Account & Billing</Link></Button></div><FAQ /></div>; }
