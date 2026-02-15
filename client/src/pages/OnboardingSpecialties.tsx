import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RQuotasLogo } from "@/components/RQuotasLogo";
import { useLocale } from "@/hooks/use-locale";
import { Loader2, Check } from "lucide-react";
import { getTradeImage } from "@/lib/trade-images";
import type { Trade, Specialty } from "@shared/schema";

export default function OnboardingSpecialties() {
  const { t } = useLocale();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data: trades, isLoading: tradesLoading } = useQuery<Trade[]>({
    queryKey: ["/api/trades"],
  });

  const { data: specialties, isLoading: specsLoading } = useQuery<Specialty[]>({
    queryKey: ["/api/specialties"],
  });

  const saveMutation = useMutation({
    mutationFn: async (specialtyIds: number[]) => {
      await apiRequest("POST", "/api/onboarding/specialties", { specialtyIds });
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/auth/me"], (old: any) => {
        if (!old) return old;
        return { ...old, needsOnboarding: false };
      });
    },
  });

  const toggle = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleContinue = () => {
    saveMutation.mutate(Array.from(selected));
  };

  const isLoading = tradesLoading || specsLoading;

  const tradeMap = new Map<number, Trade>();
  trades?.forEach(tr => tradeMap.set(tr.id, tr));

  const grouped = new Map<number, { trade: Trade; specs: Specialty[] }>();
  specialties?.forEach(sp => {
    if (!grouped.has(sp.tradeId)) {
      const trade = tradeMap.get(sp.tradeId);
      if (trade) grouped.set(sp.tradeId, { trade, specs: [] });
    }
    grouped.get(sp.tradeId)?.specs.push(sp);
  });

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-8 bg-background safe-area">
      <div className="w-full max-w-lg space-y-5">
        <div className="flex flex-col items-center gap-3">
          <RQuotasLogo size={44} />
          <div className="flex flex-col items-center">
            <span className="font-bold text-xl tracking-tight text-foreground" data-testid="text-onboarding-title">
              {t("onboardingTitle")}
            </span>
            <span className="text-sm text-muted-foreground mt-1 text-center max-w-xs">
              {t("onboardingSubtitle")}
            </span>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-3">
            {Array.from(grouped.values()).map(({ trade, specs }) => {
              const tradeImage = getTradeImage(trade.slug);
              return (
                <Card key={trade.id} className="overflow-hidden">
                  <div
                    className="relative h-20"
                    data-testid={`trade-banner-${trade.slug}`}
                  >
                    <div
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ backgroundImage: `url(${tradeImage})` }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/45 to-black/20" />
                    <div className="absolute inset-0 flex items-center px-5">
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider drop-shadow-sm">
                        {trade.name}
                      </h3>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap gap-2">
                      {specs.map(sp => {
                        const isSelected = selected.has(sp.id);
                        return (
                          <Button
                            key={sp.id}
                            type="button"
                            variant={isSelected ? "default" : "outline"}
                            size="sm"
                            data-testid={`button-specialty-${sp.slug}`}
                            onClick={() => toggle(sp.id)}
                            className={`toggle-elevate ${isSelected ? "toggle-elevated" : ""}`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5" />}
                            {sp.name}
                          </Button>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {selected.size === 0 && (
              <p className="text-sm text-muted-foreground text-center py-1" data-testid="text-none-selected">
                {t("onboardingNoneSelected")}
              </p>
            )}

            <Button
              data-testid="button-onboarding-continue"
              onClick={handleContinue}
              disabled={selected.size === 0 || saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t("onboardingSaving")}
                </>
              ) : (
                t("onboardingContinue")
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
