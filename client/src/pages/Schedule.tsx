import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Clock,
  User,
  Briefcase,
  ExternalLink,
  Loader2,
  CalendarDays,
  Bell,
  BellOff,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const NOTIF_KEY = "rq_schedule_notif_enabled";
const NOTIF_LAST_KEY = "rq_schedule_notif_last";

function useScheduleNotification(locale: string) {
  const isPt = locale === "pt";
  const [enabled, setEnabled] = useState(() => {
    return localStorage.getItem(NOTIF_KEY) === "true";
  });

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);

  const toggleNotification = useCallback(async () => {
    if (enabled) {
      setEnabled(false);
      localStorage.setItem(NOTIF_KEY, "false");
      return;
    }
    const granted = await requestPermission();
    if (granted) {
      setEnabled(true);
      localStorage.setItem(NOTIF_KEY, "true");
    }
  }, [enabled, requestPermission]);

  useEffect(() => {
    if (!enabled || !("Notification" in window) || Notification.permission !== "granted") return;

    const checkAndNotify = async () => {
      const now = new Date();
      const hour = now.getHours();
      const todayKey = formatDate(now);
      const lastNotif = localStorage.getItem(NOTIF_LAST_KEY);

      if (hour >= 21 && lastNotif !== todayKey) {
        const tomorrow = addDays(now, 1);
        const tomorrowKey = formatDate(tomorrow);
        try {
          const res = await fetch(`/api/schedule/jobs?start=${tomorrowKey}&end=${tomorrowKey}`);
          if (res.ok) {
            const jobs = await res.json();
            if (jobs.length > 0) {
              new Notification(
                isPt ? "R Quotas - Agenda de Amanhã" : "R Quotas - Tomorrow's Schedule",
                {
                  body: isPt
                    ? `Você tem ${jobs.length} trabalho(s) agendado(s) para amanhã.`
                    : `You have ${jobs.length} job(s) scheduled for tomorrow.`,
                  icon: "/favicon.ico",
                }
              );
            }
            localStorage.setItem(NOTIF_LAST_KEY, todayKey);
          }
        } catch {}
      }
    };

    checkAndNotify();
    const interval = setInterval(checkAndNotify, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [enabled, isPt]);

  return { enabled, toggleNotification, isSupported: "Notification" in window };
}

interface ScheduleJob {
  id: number;
  clientName: string | null;
  address: string | null;
  scheduledAt: string | null;
  status: string;
  notes: string | null;
  doorCode: string | null;
  assignments: { userId: number; username: string }[];
}

type ViewMode = "week" | "month";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function getDaysInRange(start: Date, end: Date): Date[] {
  const days: Date[] = [];
  let current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }
  return days;
}

function getGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  SCHEDULED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  IN_PROGRESS: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  DONE: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

function DayJobCard({ job, locale }: { job: ScheduleJob; locale: string }) {
  const isPt = locale === "pt";
  return (
    <div
      className="border rounded-md p-3 space-y-2 bg-card"
      data-testid={`schedule-job-${job.id}`}
    >
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium truncate" data-testid={`schedule-job-client-${job.id}`}>
            {job.clientName || (isPt ? "Sem cliente" : "No client")}
          </span>
        </div>
        <Badge className={`text-xs shrink-0 ${STATUS_COLORS[job.status] || ""}`} data-testid={`schedule-job-status-${job.id}`}>
          {job.status}
        </Badge>
      </div>

      {job.address && (
        <a
          href={getGoogleMapsUrl(job.address)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          data-testid={`schedule-job-address-${job.id}`}
        >
          <MapPin className="w-3 h-3 shrink-0" />
          <span className="truncate">{job.address}</span>
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
      )}

      {job.scheduledAt && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3 shrink-0" />
          <span>{new Date(job.scheduledAt).toLocaleTimeString(isPt ? "pt-BR" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>
        </div>
      )}

      {job.doorCode && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">{isPt ? "Código:" : "Door code:"}</span> {job.doorCode}
        </div>
      )}

      {job.assignments && job.assignments.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <User className="w-3 h-3 text-muted-foreground shrink-0" />
          {job.assignments.map((a) => (
            <Badge key={a.userId} variant="outline" className="text-xs">
              {a.username}
            </Badge>
          ))}
        </div>
      )}

      {job.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2">{job.notes}</p>
      )}
    </div>
  );
}

function WeekView({
  jobs,
  currentDate,
  locale,
}: {
  jobs: ScheduleJob[];
  currentDate: Date;
  locale: string;
}) {
  const isPt = locale === "pt";
  const weekStart = startOfWeek(currentDate);
  const days = getDaysInRange(weekStart, addDays(weekStart, 6));
  const today = formatDate(new Date());

  const jobsByDay = useMemo(() => {
    const map = new Map<string, ScheduleJob[]>();
    jobs.forEach((job) => {
      if (!job.scheduledAt) return;
      const d = job.scheduledAt.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(job);
    });
    return map;
  }, [jobs]);

  const dayNames = isPt
    ? ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-7 gap-2" data-testid="schedule-week-view">
      {days.map((day) => {
        const key = formatDate(day);
        const dayJobs = jobsByDay.get(key) || [];
        const isToday = key === today;
        return (
          <div
            key={key}
            className={`rounded-md border p-2 min-h-[120px] ${isToday ? "border-primary bg-primary/5" : "bg-card"}`}
            data-testid={`schedule-day-${key}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                {dayNames[day.getDay()]}
              </span>
              <span className={`text-sm font-bold ${isToday ? "text-primary" : ""}`}>
                {day.getDate()}
              </span>
            </div>
            <div className="space-y-1.5">
              {dayJobs.map((job) => (
                <DayJobCard key={job.id} job={job} locale={locale} />
              ))}
              {dayJobs.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {isPt ? "Livre" : "Free"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthView({
  jobs,
  currentDate,
  locale,
}: {
  jobs: ScheduleJob[];
  currentDate: Date;
  locale: string;
}) {
  const isPt = locale === "pt";
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart);
  const today = formatDate(new Date());

  const totalDays = Math.ceil((monthEnd.getTime() - calStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const weeks = Math.ceil(totalDays / 7);
  const days = getDaysInRange(calStart, addDays(calStart, weeks * 7 - 1));

  const jobsByDay = useMemo(() => {
    const map = new Map<string, ScheduleJob[]>();
    jobs.forEach((job) => {
      if (!job.scheduledAt) return;
      const d = job.scheduledAt.slice(0, 10);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(job);
    });
    return map;
  }, [jobs]);

  const dayNames = isPt
    ? ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div data-testid="schedule-month-view">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayNames.map((name) => (
          <div key={name} className="text-center text-xs font-semibold text-muted-foreground py-1">
            {name}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const key = formatDate(day);
          const dayJobs = jobsByDay.get(key) || [];
          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
          const isToday = key === today;
          return (
            <div
              key={key}
              className={`rounded-md border p-1.5 min-h-[80px] sm:min-h-[100px] ${
                !isCurrentMonth ? "opacity-40" : ""
              } ${isToday ? "border-primary bg-primary/5" : "bg-card"}`}
              data-testid={`schedule-day-${key}`}
            >
              <span className={`text-xs font-bold block mb-1 ${isToday ? "text-primary" : ""}`}>
                {day.getDate()}
              </span>
              <div className="space-y-1">
                {dayJobs.slice(0, 3).map((job) => (
                  <div
                    key={job.id}
                    className={`text-[10px] leading-tight rounded px-1 py-0.5 truncate ${STATUS_COLORS[job.status] || "bg-muted"}`}
                    title={`${job.clientName || ""} - ${job.address || ""}`}
                    data-testid={`schedule-month-job-${job.id}`}
                  >
                    {job.clientName || (isPt ? "Trabalho" : "Job")} #{job.id}
                  </div>
                ))}
                {dayJobs.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{dayJobs.length - 3} {isPt ? "mais" : "more"}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Schedule() {
  const { user } = useAuth();
  const { locale } = useLocale();
  const isPt = locale === "pt";
  const { enabled: notifEnabled, toggleNotification, isSupported: notifSupported } = useScheduleNotification(locale);

  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());

  const rangeStart = useMemo(() => {
    if (viewMode === "week") {
      return startOfWeek(currentDate);
    }
    const ms = startOfMonth(currentDate);
    return startOfWeek(ms);
  }, [viewMode, currentDate]);

  const rangeEnd = useMemo(() => {
    if (viewMode === "week") {
      return addDays(startOfWeek(currentDate), 6);
    }
    const me = endOfMonth(currentDate);
    const totalDays = Math.ceil((me.getTime() - startOfWeek(startOfMonth(currentDate)).getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const weeks = Math.ceil(totalDays / 7);
    return addDays(startOfWeek(startOfMonth(currentDate)), weeks * 7 - 1);
  }, [viewMode, currentDate]);

  const { data: jobs = [], isLoading } = useQuery<ScheduleJob[]>({
    queryKey: ["/api/schedule/jobs", formatDate(rangeStart), formatDate(rangeEnd)],
    queryFn: async () => {
      const res = await fetch(`/api/schedule/jobs?start=${formatDate(rangeStart)}&end=${formatDate(rangeEnd)}`);
      if (!res.ok) throw new Error("Failed to load schedule");
      return res.json();
    },
  });

  const navigatePrev = () => {
    if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  const goToday = () => setCurrentDate(new Date());

  const headerLabel = useMemo(() => {
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate);
      const we = addDays(ws, 6);
      const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
      const loc = isPt ? "pt-BR" : "en-US";
      return `${ws.toLocaleDateString(loc, opts)} – ${we.toLocaleDateString(loc, opts)}, ${we.getFullYear()}`;
    }
    const loc = isPt ? "pt-BR" : "en-US";
    return currentDate.toLocaleDateString(loc, { month: "long", year: "numeric" });
  }, [viewMode, currentDate, isPt]);

  const totalJobs = jobs.length;

  if (!user) return null;

  return (
    <div className="space-y-4" data-testid="page-schedule">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap pb-3">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-muted-foreground" />
            {isPt ? "Agenda" : "Schedule"}
          </CardTitle>
          <div className="flex items-center gap-3">
            {notifSupported && (
              <label className="flex items-center gap-1.5 cursor-pointer" data-testid="toggle-schedule-notif">
                {notifEnabled ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4 text-muted-foreground" />}
                <Switch checked={notifEnabled} onCheckedChange={toggleNotification} data-testid="switch-schedule-notif" />
              </label>
            )}
            <div className="flex items-center gap-1.5">
              <Button
                variant={viewMode === "week" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("week")}
                data-testid="button-view-week"
                className={`toggle-elevate ${viewMode === "week" ? "toggle-elevated" : ""}`}
              >
                {isPt ? "Semana" : "Week"}
              </Button>
              <Button
                variant={viewMode === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("month")}
                data-testid="button-view-month"
                className={`toggle-elevate ${viewMode === "month" ? "toggle-elevated" : ""}`}
              >
                {isPt ? "Mês" : "Month"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="icon" onClick={navigatePrev} data-testid="button-schedule-prev">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToday} data-testid="button-schedule-today">
                {isPt ? "Hoje" : "Today"}
              </Button>
              <Button variant="outline" size="icon" onClick={navigateNext} data-testid="button-schedule-next">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold" data-testid="text-schedule-header">{headerLabel}</span>
              <Badge variant="outline" className="text-xs" data-testid="text-schedule-count">
                {totalJobs} {isPt ? "trabalhos" : "jobs"}
              </Badge>
            </div>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : viewMode === "week" ? (
            <WeekView jobs={jobs} currentDate={currentDate} locale={locale} />
          ) : (
            <MonthView jobs={jobs} currentDate={currentDate} locale={locale} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
