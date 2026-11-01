import { Clapperboard } from "lucide-react";
export default function BrandMark({ compact = false }: { compact?: boolean }) { return <span className="inline-flex min-w-0 items-center gap-2 font-semibold"><Clapperboard className="h-7 w-7 shrink-0 text-primary" />{!compact && <span className="text-base sm:text-lg">UGC Ads <span className="text-primary">Studio</span></span>}</span>; }
