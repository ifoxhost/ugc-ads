import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  BarChart3, 
  Users, 
  Loader2, 
  AlertCircle, 
  CheckCircle,
  Eye,
  X,
  TrendingUp,
  Palette,
  Download,
  FileText,
  FileSpreadsheet,
  CalendarIcon,
  Filter
} from "lucide-react";
import { 
  Area, 
  AreaChart, 
  XAxis, 
  YAxis, 
  ResponsiveContainer, 
  Tooltip,
  Bar,
  BarChart,
  Cell
} from "recharts";
import { format, subDays, startOfDay, endOfDay, eachDayOfInterval, parseISO, isWithinInterval, startOfMonth } from "date-fns";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { cn } from "@/lib/utils";

interface GeneratedAd {
  id: string;
  user_id: string;
  email: string;
  status: string;
  created_at: string;
  style_template: string;
}

interface AdminStatsPanelProps {
  ads: GeneratedAd[];
  impersonatedUserId: string | null;
  onImpersonate: (userId: string | null) => void;
  currentUserId?: string;
}

type TimeRange = "7d" | "14d" | "30d";

export const AdminStatsPanel = ({ 
  ads, 
  impersonatedUserId, 
  onImpersonate,
  currentUserId 
}: AdminStatsPanelProps) => {
  const [timeRange, setTimeRange] = useState<TimeRange>("14d");
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);

  // Filter ads by date range
  const filteredAds = useMemo(() => {
    if (!startDate && !endDate) return ads;
    
    return ads.filter(ad => {
      const adDate = parseISO(ad.created_at);
      
      if (startDate && endDate) {
        return isWithinInterval(adDate, { 
          start: startOfDay(startDate), 
          end: endOfDay(endDate) 
        });
      }
      if (startDate) {
        return adDate >= startOfDay(startDate);
      }
      if (endDate) {
        return adDate <= endOfDay(endDate);
      }
      return true;
    });
  }, [ads, startDate, endDate]);

  const clearDateFilter = () => {
    setStartDate(undefined);
    setEndDate(undefined);
  };

  // Quick filter presets
  const applyPreset = (preset: "today" | "7d" | "30d" | "month") => {
    const today = new Date();
    switch (preset) {
      case "today":
        setStartDate(startOfDay(today));
        setEndDate(today);
        break;
      case "7d":
        setStartDate(subDays(today, 6));
        setEndDate(today);
        break;
      case "30d":
        setStartDate(subDays(today, 29));
        setEndDate(today);
        break;
      case "month":
        setStartDate(startOfMonth(today));
        setEndDate(today);
        break;
    }
  };

  // Check which preset is currently active
  const activePreset = useMemo(() => {
    if (!startDate || !endDate) return null;
    const today = startOfDay(new Date());
    const startDayStr = format(startOfDay(startDate), "yyyy-MM-dd");
    const endDayStr = format(startOfDay(endDate), "yyyy-MM-dd");
    const todayStr = format(today, "yyyy-MM-dd");
    
    if (startDayStr === todayStr && endDayStr === todayStr) return "today";
    if (startDayStr === format(subDays(today, 6), "yyyy-MM-dd") && endDayStr === todayStr) return "7d";
    if (startDayStr === format(subDays(today, 29), "yyyy-MM-dd") && endDayStr === todayStr) return "30d";
    if (startDayStr === format(startOfMonth(today), "yyyy-MM-dd") && endDayStr === todayStr) return "month";
    return null;
  }, [startDate, endDate]);

  const isDateFilterActive = startDate || endDate;

  // Calculate stats
  const stats = useMemo(() => {
    const totalAds = filteredAds.length;
    const uniqueUsers = [...new Set(filteredAds.map(ad => ad.user_id))];
    const userCount = uniqueUsers.length;
    
    const statusBreakdown = filteredAds.reduce((acc, ad) => {
      acc[ad.status] = (acc[ad.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Get user list with email and ad count
    const userStats = filteredAds.reduce((acc, ad) => {
      if (!acc[ad.user_id]) {
        acc[ad.user_id] = { email: ad.email, count: 0 };
      }
      acc[ad.user_id].count++;
      return acc;
    }, {} as Record<string, { email: string; count: number }>);

    // Style template breakdown
    const styleBreakdown = filteredAds.reduce((acc, ad) => {
      const style = ad.style_template || "Unknown";
      acc[style] = (acc[style] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    return {
      totalAds,
      userCount,
      statusBreakdown,
      userStats,
      styleBreakdown,
    };
  }, [filteredAds]);

  // Style template chart data
  const styleChartData = useMemo(() => {
    return Object.entries(stats.styleBreakdown)
      .map(([name, count]) => ({
        name: name.replace(/-/g, " ").replace(/\b\w/g, l => l.toUpperCase()),
        count,
        percentage: Math.round((count / stats.totalAds) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8); // Top 8 styles
  }, [stats.styleBreakdown, stats.totalAds]);

  // Colors for the bar chart
  const STYLE_COLORS = [
    "hsl(var(--primary))",
    "hsl(221, 83%, 53%)", // blue
    "hsl(142, 71%, 45%)", // green
    "hsl(45, 93%, 47%)",  // amber
    "hsl(280, 87%, 65%)", // purple
    "hsl(338, 68%, 51%)", // pink
    "hsl(173, 80%, 40%)", // teal
    "hsl(24, 94%, 50%)",  // orange
  ];

  // Calculate trend data
  const trendData = useMemo(() => {
    const days = timeRange === "7d" ? 7 : timeRange === "14d" ? 14 : 30;
    const today = startOfDay(new Date());
    const rangeStart = subDays(today, days - 1);
    
    // Create date range
    const dateRange = eachDayOfInterval({ start: rangeStart, end: today });
    
    // Group filtered ads by date
    const adsByDate = filteredAds.reduce((acc, ad) => {
      const dateKey = format(startOfDay(parseISO(ad.created_at)), "yyyy-MM-dd");
      acc[dateKey] = (acc[dateKey] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Build chart data
    return dateRange.map(date => {
      const dateKey = format(date, "yyyy-MM-dd");
      return {
        date: format(date, "MMM d"),
        fullDate: dateKey,
        count: adsByDate[dateKey] || 0,
      };
    });
  }, [filteredAds, timeRange]);

  // Calculate trend percentage
  const trendPercentage = useMemo(() => {
    const midpoint = Math.floor(trendData.length / 2);
    const firstHalf = trendData.slice(0, midpoint).reduce((sum, d) => sum + d.count, 0);
    const secondHalf = trendData.slice(midpoint).reduce((sum, d) => sum + d.count, 0);
    
    if (firstHalf === 0) return secondHalf > 0 ? 100 : 0;
    return Math.round(((secondHalf - firstHalf) / firstHalf) * 100);
  }, [trendData]);

  // Get impersonated user info
  const impersonatedUser = impersonatedUserId 
    ? stats.userStats[impersonatedUserId] 
    : null;

  // Export functions
  const exportToCSV = () => {
    try {
      // Summary section
      let csvContent = "LIBRARY STATISTICS REPORT\n";
      csvContent += `Generated on: ${format(new Date(), "PPpp")}\n\n`;
      
      // Overview stats
      csvContent += "=== OVERVIEW ===\n";
      csvContent += `Total Ads,${stats.totalAds}\n`;
      csvContent += `Total Users,${stats.userCount}\n`;
      csvContent += `Completed,${stats.statusBreakdown.completed || 0}\n`;
      csvContent += `Processing,${stats.statusBreakdown.processing || 0}\n`;
      csvContent += `Failed,${stats.statusBreakdown.failed || 0}\n\n`;
      
      // Style breakdown
      csvContent += "=== STYLE TEMPLATES ===\n";
      csvContent += "Style,Count,Percentage\n";
      styleChartData.forEach(item => {
        csvContent += `"${item.name}",${item.count},${item.percentage}%\n`;
      });
      csvContent += "\n";
      
      // Generation trends
      csvContent += "=== GENERATION TRENDS ===\n";
      csvContent += "Date,Count\n";
      trendData.forEach(item => {
        csvContent += `${item.fullDate},${item.count}\n`;
      });
      csvContent += "\n";
      
      // User breakdown
      csvContent += "=== USER STATISTICS ===\n";
      csvContent += "Email,Ad Count\n";
      Object.entries(stats.userStats)
        .sort((a, b) => b[1].count - a[1].count)
        .forEach(([_, data]) => {
          csvContent += `"${data.email}",${data.count}\n`;
        });

      // Create and download
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `library-stats-${format(new Date(), "yyyy-MM-dd")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success("CSV report exported successfully");
    } catch (error) {
      console.error("CSV export error:", error);
      toast.error("Failed to export CSV");
    }
  };

  const exportToPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;
      
      // Title
      doc.setFontSize(20);
      doc.setFont("helvetica", "bold");
      doc.text("Library Statistics Report", pageWidth / 2, yPos, { align: "center" });
      yPos += 10;
      
      // Date
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Generated on: ${format(new Date(), "PPpp")}`, pageWidth / 2, yPos, { align: "center" });
      doc.setTextColor(0);
      yPos += 15;
      
      // Overview section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Overview", 14, yPos);
      yPos += 8;
      
      autoTable(doc, {
        startY: yPos,
        head: [["Metric", "Value"]],
        body: [
          ["Total Ads", stats.totalAds.toString()],
          ["Total Users", stats.userCount.toString()],
          ["Completed", (stats.statusBreakdown.completed || 0).toString()],
          ["Processing", (stats.statusBreakdown.processing || 0).toString()],
          ["Failed", (stats.statusBreakdown.failed || 0).toString()],
        ],
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241] },
        margin: { left: 14, right: 14 },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
      
      // Style Templates section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Popular Style Templates", 14, yPos);
      yPos += 8;
      
      autoTable(doc, {
        startY: yPos,
        head: [["Style", "Count", "Percentage"]],
        body: styleChartData.map(item => [
          item.name,
          item.count.toString(),
          `${item.percentage}%`
        ]),
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241] },
        margin: { left: 14, right: 14 },
      });
      
      yPos = (doc as any).lastAutoTable.finalY + 15;
      
      // Check if we need a new page
      if (yPos > 240) {
        doc.addPage();
        yPos = 20;
      }
      
      // User Statistics section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("User Statistics", 14, yPos);
      yPos += 8;
      
      const userRows = Object.entries(stats.userStats)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 20) // Top 20 users
        .map(([_, data]) => [data.email, data.count.toString()]);
      
      autoTable(doc, {
        startY: yPos,
        head: [["Email", "Ad Count"]],
        body: userRows,
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241] },
        margin: { left: 14, right: 14 },
      });
      
      // Check for new page
      yPos = (doc as any).lastAutoTable.finalY + 15;
      if (yPos > 200) {
        doc.addPage();
        yPos = 20;
      }
      
      // Daily Trends section
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Generation Trends (Last 14 Days)", 14, yPos);
      yPos += 8;
      
      autoTable(doc, {
        startY: yPos,
        head: [["Date", "Ads Generated"]],
        body: trendData.slice(-14).map(item => [item.date, item.count.toString()]),
        theme: "striped",
        headStyles: { fillColor: [99, 102, 241] },
        margin: { left: 14, right: 14 },
      });
      
      // Save
      doc.save(`library-stats-${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF report exported successfully");
    } catch (error) {
      console.error("PDF export error:", error);
      toast.error("Failed to export PDF");
    }
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Header with Date Filter and Export */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Admin Statistics</h2>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Filter Presets */}
          <div className="flex items-center gap-1 border rounded-md p-0.5">
            <Button
              variant={activePreset === "today" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => applyPreset("today")}
              className="h-7 px-2 text-xs"
            >
              Today
            </Button>
            <Button
              variant={activePreset === "7d" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => applyPreset("7d")}
              className="h-7 px-2 text-xs"
            >
              7 days
            </Button>
            <Button
              variant={activePreset === "30d" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => applyPreset("30d")}
              className="h-7 px-2 text-xs"
            >
              30 days
            </Button>
            <Button
              variant={activePreset === "month" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => applyPreset("month")}
              className="h-7 px-2 text-xs"
            >
              This month
            </Button>
          </div>

          {/* Date Range Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "MMM d, yyyy") : "Start date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  disabled={(date) => date > new Date() || (endDate ? date > endDate : false)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            
            <span className="text-muted-foreground text-sm">to</span>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    "justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "MMM d, yyyy") : "End date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  disabled={(date) => date > new Date() || (startDate ? date < startDate : false)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            
            {isDateFilterActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearDateFilter}
                className="h-8 px-2"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {isDateFilterActive && (
            <Badge variant="secondary" className="text-xs">
              Filtered: {filteredAds.length} of {ads.length} ads
            </Badge>
          )}

          {/* Export Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Export Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportToCSV} className="gap-2 cursor-pointer">
                <FileSpreadsheet className="h-4 w-4" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToPDF} className="gap-2 cursor-pointer">
                <FileText className="h-4 w-4" />
                Export as PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalAds}</p>
                <p className="text-xs text-muted-foreground">Total Ads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.userCount}</p>
                <p className="text-xs text-muted-foreground">Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.statusBreakdown.completed || 0}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Loader2 className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.statusBreakdown.processing || 0}</p>
                <p className="text-xs text-muted-foreground">Processing</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generation Trends Chart */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Generation Trends</span>
              {trendPercentage !== 0 && (
                <Badge 
                  variant="secondary" 
                  className={trendPercentage > 0 
                    ? "bg-green-500/10 text-green-600 border-green-500/20" 
                    : "bg-red-500/10 text-red-600 border-red-500/20"
                  }
                >
                  {trendPercentage > 0 ? "+" : ""}{trendPercentage}%
                </Badge>
              )}
            </div>
            <Select value={timeRange} onValueChange={(val) => setTimeRange(val as TimeRange)}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">7 days</SelectItem>
                <SelectItem value="14d">14 days</SelectItem>
                <SelectItem value="30d">30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="h-[180px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  interval="preserveStartEnd"
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  allowDecimals={false}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: "hsl(var(--popover))", 
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    boxShadow: "0 4px 12px hsl(var(--foreground) / 0.1)"
                  }}
                  labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                  formatter={(value: number) => [`${value} ads`, "Generated"]}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  fill="url(#colorCount)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Style Templates Chart */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Popular Style Templates</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {Object.keys(stats.styleBreakdown).length} styles
            </Badge>
          </div>
          {styleChartData.length > 0 ? (
            <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={styleChartData} 
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
                >
                  <XAxis 
                    type="number"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      boxShadow: "0 4px 12px hsl(var(--foreground) / 0.1)"
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                    formatter={(value: number, name: string, props: any) => [
                      `${value} ads (${props.payload.percentage}%)`, 
                      "Count"
                    ]}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {styleChartData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={STYLE_COLORS[index % STYLE_COLORS.length]} 
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
              No style data available
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Status Distribution</span>
            <div className="flex gap-4 text-xs">
              {stats.statusBreakdown.failed && stats.statusBreakdown.failed > 0 && (
                <span className="flex items-center gap-1 text-destructive">
                  <AlertCircle className="h-3 w-3" />
                  {stats.statusBreakdown.failed} Failed
                </span>
              )}
            </div>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden flex">
            {stats.totalAds > 0 && (
              <>
                <div 
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${((stats.statusBreakdown.completed || 0) / stats.totalAds) * 100}%` }}
                />
                <div 
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${((stats.statusBreakdown.processing || 0) / stats.totalAds) * 100}%` }}
                />
                <div 
                  className="h-full bg-destructive transition-all"
                  style={{ width: `${((stats.statusBreakdown.failed || 0) / stats.totalAds) * 100}%` }}
                />
              </>
            )}
          </div>
          <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Completed
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              Processing
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-destructive" />
              Failed
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Impersonation Panel */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">View as User</span>
            </div>
            
            <div className="flex-1 flex items-center gap-2">
              <Select 
                value={impersonatedUserId || "all"} 
                onValueChange={(val) => onImpersonate(val === "all" ? null : val)}
              >
                <SelectTrigger className="w-full md:w-[300px]">
                  <SelectValue placeholder="Select a user to impersonate" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <span className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      All Users (Admin View)
                    </span>
                  </SelectItem>
                  {Object.entries(stats.userStats)
                    .sort((a, b) => a[1].email.localeCompare(b[1].email))
                    .map(([userId, data]) => (
                      <SelectItem key={userId} value={userId}>
                        <span className="flex items-center justify-between gap-2 w-full">
                          <span className="truncate">{data.email}</span>
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {data.count} ads
                          </Badge>
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {impersonatedUserId && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => onImpersonate(null)}
                  className="shrink-0"
                >
                  <X className="h-4 w-4 mr-1" />
                  Exit
                </Button>
              )}
            </div>

            {impersonatedUser && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                <Eye className="h-3 w-3 mr-1" />
                Viewing as: {impersonatedUser.email}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};