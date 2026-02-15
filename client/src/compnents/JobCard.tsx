import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, ArrowRight } from "lucide-react";
import { type Job } from "@shared/schema";
import { Link } from "wouter";
import { format } from "date-fns";
import { useLocale } from "@/hooks/use-locale";

interface JobCardProps {
  job: Job;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  DRAFT: "secondary",
  SENT: "default",
  APPROVED: "default",
  SCHEDULED: "outline",
  IN_PROGRESS: "default",
  DONE: "secondary",
};

export function JobCard({ job }: JobCardProps) {
  const { t } = useLocale();

  const statusKey = (job.status || "DRAFT").toLowerCase();
  const statusLabel = t(statusKey as any) || job.status || "DRAFT";

  return (
    <Card className="group hover-elevate flex flex-col" data-testid={`card-job-${job.id}`}>
      <CardContent className="p-4 flex flex-col flex-1 gap-3">
        <div className="flex justify-between items-center gap-2">
          <Badge variant={STATUS_VARIANT[job.status || "DRAFT"] || "secondary"}>
            {statusLabel.toUpperCase()}
          </Badge>
          <span className="text-[11px] text-muted-foreground font-mono">
            #{job.id}
          </span>
        </div>

        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-foreground truncate">
            {job.clientName || `Job #${job.id}`}
          </h3>
        </div>

        <div className="space-y-1.5 mt-auto">
          {job.address && (
            <button
              type="button"
              className="flex items-center text-[12px] text-muted-foreground hover:text-primary transition-colors text-left"
              data-testid={`button-job-location-${job.id}`}
              onClick={(e) => {
                e.stopPropagation();
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address!)}`, "_blank", "noopener,noreferrer");
              }}
            >
              <MapPin className="w-3 h-3 mr-1.5 shrink-0" />
              <span className="truncate">{job.address}</span>
            </button>
          )}
          <div className="flex items-center text-[12px] text-muted-foreground">
            <Calendar className="w-3 h-3 mr-1.5 text-muted-foreground shrink-0" />
            <span>{format(new Date(job.createdAt || new Date()), "MMM d, yyyy")}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-border/50">
          <Link href={`/jobs/${job.id}`} className="w-full">
            <Button variant="ghost" className="w-full justify-between text-[13px]" data-testid={`button-open-job-${job.id}`}>
              {t("openDetails")}
              <ArrowRight className="w-3.5 h-3.5 ml-2" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
