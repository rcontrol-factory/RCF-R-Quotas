import { Link, useLocation } from "wouter";
import {
  Briefcase,
  FilePlus,
  Settings,
  LogOut,
  Shield,
  User,
  HeadsetIcon,
  Calculator,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { RQuotasLogo } from "@/components/RQuotasLogo";
import { useLocale } from "@/hooks/use-locale";

export function Navigation() {
  const [location] = useLocation();
  const { user, isAdminOrOwner, isSupport, logout } = useAuth();
  const { locale, t } = useLocale();
  const canAccessSupport = isAdminOrOwner || isSupport;

  const isActive = (path: string) =>
    path === "/" ? location === "/" : location.startsWith(path);

  const baseItems = [
    { href: "/", label: t("jobs" as any) || "Jobs", icon: Briefcase },
    { href: "/jobs/new", label: t("newQuote" as any) || "New Quote", icon: FilePlus },
    { href: "/schedule", label: locale === "pt" ? "Agenda" : "Schedule", icon: CalendarDays },
    { href: "/stairs", label: t("stairCalculator" as any) || "Calculator", icon: Calculator },
    { href: "/settings", label: t("settings"), icon: Settings },
  ];

  const mobileItems = canAccessSupport
    ? [...baseItems, { href: "/support", label: t("supportPanel" as any) || "Support", icon: HeadsetIcon }]
    : baseItems;

  return (
    <>
      <header
        className="sticky top-0 z-50"
        style={{
          paddingTop: "var(--safe-top)",
          background: "hsl(var(--topbar))",
          color: "hsl(var(--topbar-foreground))",
        }}
        data-testid="header-topbar"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14 gap-4">
            <Link href="/" className="flex items-center gap-2.5" data-testid="link-home-logo">
              <RQuotasLogo size={28} />
              <span className="font-bold text-[15px] tracking-tight" data-testid="text-app-name">
                {t("appName")}
              </span>
            </Link>

            <div className="hidden sm:flex items-center gap-0.5">
              {mobileItems.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-testid={`link-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                    className={`
                      inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors duration-150
                      ${active
                        ? "bg-white/15 text-white"
                        : "text-white/55 hover:text-white hover:bg-white/8"
                      }
                    `}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-md bg-white/8">
                {isAdminOrOwner ? (
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <User className="w-3.5 h-3.5 text-white/50" />
                )}
                <span className="text-[12px] font-medium text-white/75" data-testid="text-username">
                  {user?.username}
                </span>
                <span
                  className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                    isAdminOrOwner
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-white/10 text-white/50"
                  }`}
                  data-testid="text-user-role"
                >
                  {user?.role}
                </span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => logout.mutate()}
                data-testid="button-logout"
                className="text-white/50 hover:text-white hover:bg-white/10 no-default-hover-elevate"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card"
        style={{ paddingBottom: "calc(0.25rem + var(--safe-bottom))" }}
        data-testid="nav-bottom-bar"
      >
        <div className="flex justify-around pt-2">
          {mobileItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`link-mobile-nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className="flex flex-col items-center gap-0.5 min-w-[64px]"
              >
                <div className={`p-1.5 rounded-lg transition-colors ${active ? "bg-primary/10" : ""}`}>
                  <item.icon className={`w-5 h-5 ${active ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <span className={`text-[10px] font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
