import { useJobs } from "@/hooks/use-jobs";
import { JobCard } from "@/components/JobCard";
import { Button } from "@/components/ui/button";
import { Plus, Search, Briefcase, FileCheck, Send, CheckCircle2, PlayCircle, Camera } from "lucide-react";
import { Link } from "wouter";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/hooks/use-locale";
import { getHeroDashboardImage } from "@/lib/trade-images";

type StatusFilter = "all" | "DRAFT" | "SENT" | "APPROVED" | "SCHEDULED" | "IN_PROGRESS" | "DONE";

export default function Dashboard() {
  const { data, isLoading } = useJobs();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { t } = useLocale();

  const jobs = data?.items || [];
  const stats = data?.stats || { total: 0, drafts: 0, sent: 0, approved: 0, inProgress: 0, done: 0 };

  const filteredJobs = jobs.filter(job => {
    const matchesSearch =
      (job.clientName || "").toLowerCase().includes(search.toLowerCase()) ||
      String(job.id).includes(search);
    const matchesStatus =
      statusFilter === "all" ||
      job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const showingLabel = t("showingOf")
    .replace("{visible}", String(filteredJobs.length))
    .replace("{total}", String(stats.total));

  const statCards = [
    { key: "all" as StatusFilter, count: stats.total, label: t("total"), icon: Briefcase, color: "text-foreground" },
    { key: "DRAFT" as StatusFilter, count: stats.drafts, label: t("drafts"), icon: FileCheck, color: "text-amber-600" },
    { key: "SENT" as StatusFilter, count: stats.sent, label: t("sent"), icon: Send, color: "text-blue-600" },
    { key: "IN_PROGRESS" as StatusFilter, count: stats.inProgress, label: t("inProgress" as any) || "In Progress", icon: PlayCircle, color: "text-violet-600" },
    { key: "DONE" as StatusFilter, count: stats.done, label: t("done" as any) || "Done", icon: CheckCircle2, color: "text-emerald-600" },
  ];

  const heroImage = getHeroDashboardImage();

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div
        className="relative rounded-lg overflow-hidden -mx-4 sm:-mx-6 -mt-5"
        data-testid="dashboard-hero-banner"
      >
        <div
          className="h-40 sm:h-48 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/40 to-black/15" />
        <div className="absolute inset-0 flex items-end">
          <div className="px-5 sm:px-7 pb-5 sm:pb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 w-full">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white" data-testid="text-dashboard-title">
                {t("dashboard")}
              </h1>
              <p className="text-sm text-white/65 mt-1">{t("dashboardSubtitle")}</p>
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <Link href="/photo-estimate">
                <Button variant="outline" data-testid="button-photo-estimate" className="shadow-lg bg-white/10 border-white/20 text-white hover:bg-white/20 no-default-hover-elevate backdrop-blur-sm">
                  <Camera className="w-4 h-4" />
                  {t("photoEstimateBeta" as any)}
                </Button>
              </Link>
              <Link href="/jobs/new">
                <Button data-testid="button-new-job" className="shadow-lg">
                  <Plus className="w-4 h-4" />
                  {t("newJob")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {statCards.map((stat) => {
          const active = statusFilter === stat.key;
          return (
            <button
              key={stat.key}
              onClick={() => setStatusFilter(stat.key)}
              className="text-left"
              data-testid={`button-filter-${stat.key.toLowerCase()}`}
            >
              <Card className={`transition-all cursor-pointer ${active ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "hover-elevate"}`}>
                <CardContent className="p-3.5">
                  <div className="flex items-center gap-2.5">
                    <stat.icon className={`w-4 h-4 flex-shrink-0 ${active ? "text-primary" : stat.color}`} />
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-foreground leading-none" data-testid={`text-stat-${stat.key.toLowerCase()}`}>{stat.count}</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5 truncate">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchJobs")}
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-jobs"
          />
        </div>
        <p className="text-xs text-muted-foreground" data-testid="text-showing-count">
          {showingLabel}
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[180px] w-full rounded-lg" />
          ))}
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="text-center py-16">
            <div className="mx-auto h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Plus className="h-5 w-5 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{t("noJobsYet")}</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-5">{t("createFirstEstimate")}</p>
            <Link href="/jobs/new">
              <Button data-testid="button-create-first-job">{t("createJob")}</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
