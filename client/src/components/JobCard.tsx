import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "./ui/card";

type JobCardProps = {
  title: string;
  subtitle?: string;
  priceLabel?: string;
  rightTag?: string;
  onClick?: () => void;
};

export default function JobCard({
  title,
  subtitle,
  priceLabel,
  rightTag,
  onClick,
}: JobCardProps) {
  return (
    <Card
      className={`cursor-${onClick ? "pointer" : "default"} hover:shadow-md transition`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return;
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      <CardHeader className="flex-row items-start justify-between space-y-0">
        <div className="min-w-0">
          <CardTitle className="truncate">{title}</CardTitle>
          {subtitle ? <CardDescription className="truncate">{subtitle}</CardDescription> : null}
        </div>

        {rightTag ? (
          <span className="ml-3 shrink-0 rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-700">
            {rightTag}
          </span>
        ) : null}
      </CardHeader>

      {(priceLabel) ? (
        <CardContent>
          <div className="text-sm text-slate-700">
            <span className="font-medium">{priceLabel}</span>
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}
