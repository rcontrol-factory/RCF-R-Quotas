import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLocale } from "@/hooks/use-locale";
import { Home, TreePine, ArrowLeft, AlertTriangle, Check } from "lucide-react";

type StairType = "interior" | "exterior";

const STAIR_DEFAULTS: Record<StairType, { riser: number; tread: number; maxRiser: number; minTread: number; maxTread: number; minRiser: number }> = {
  interior: { riser: 7.5, tread: 10, maxRiser: 7.75, minTread: 10, maxTread: 14, minRiser: 5 },
  exterior: { riser: 7.25, tread: 11.5, maxRiser: 7.5, minTread: 11, maxTread: 12, minRiser: 7 },
};

export default function Stairs() {
  const [stairType, setStairType] = useState<StairType | null>(null);
  const { t } = useLocale();

  if (!stairType) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-stair-title">{t("stairCalculator")}</h1>
          <p className="text-muted-foreground mt-1">{t("stairSubtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("selectStairType")}</CardTitle>
            <CardDescription>{t("selectStairTypeDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setStairType("interior")}
                className="flex flex-col items-center gap-3 p-5 border rounded-md hover-elevate cursor-pointer text-center"
                data-testid="button-interior-stairs"
              >
                <Home className="w-10 h-10 text-primary" />
                <div>
                  <div className="text-lg font-semibold">{t("interiorStairs")}</div>
                  <div className="text-sm text-muted-foreground mt-1">{t("interiorDesc")}</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setStairType("exterior")}
                className="flex flex-col items-center gap-3 p-6 border rounded-md hover-elevate cursor-pointer text-center"
                data-testid="button-exterior-stairs"
              >
                <TreePine className="w-10 h-10 text-primary" />
                <div>
                  <div className="text-lg font-semibold">{t("exteriorStairs")}</div>
                  <div className="text-sm text-muted-foreground mt-1">{t("exteriorDesc")}</div>
                </div>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <StairCalculator type={stairType} onChangeType={() => setStairType(null)} />;
}

function StairCalculator({ type, onChangeType }: { type: StairType; onChangeType: () => void }) {
  const defaults = STAIR_DEFAULTS[type];
  const { t } = useLocale();

  const [totalRise, setTotalRise] = useState<number>(108);
  const [targetRiserHeight, setTargetRiserHeight] = useState<number>(defaults.riser);
  const [treadDepth, setTreadDepth] = useState<number>(defaults.tread);
  const [nosing, setNosing] = useState<number>(0);

  const numberOfRisers = Math.max(1, Math.round(totalRise / targetRiserHeight));
  const actualRiserHeight = totalRise / numberOfRisers;
  const numberOfTreads = numberOfRisers - 1;
  const totalRun = numberOfTreads * treadDepth;
  const stringerLength = Math.sqrt(Math.pow(totalRun, 2) + Math.pow(totalRise, 2));
  const angle = totalRun > 0 ? Math.atan(totalRise / totalRun) * (180 / Math.PI) : 0;

  const riserTooHigh = actualRiserHeight > defaults.maxRiser;
  const riserTooLow = actualRiserHeight < defaults.minRiser;
  const treadTooShort = treadDepth < defaults.minTread;
  const treadTooDeep = treadDepth > defaults.maxTread;
  const riserViolation = riserTooHigh || riserTooLow;
  const treadViolation = treadTooShort || treadTooDeep;
  const isCompliant = !riserViolation && !treadViolation;

  const isInterior = type === "interior";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-stair-title">{t("stairCalculator")}</h1>
          <p className="text-muted-foreground mt-1">{t("stairSubtitle")}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={isInterior ? "default" : "secondary"} data-testid="badge-stair-type">
            {isInterior ? <Home className="w-3 h-3 mr-1" /> : <TreePine className="w-3 h-3 mr-1" />}
            {isInterior ? t("interiorStairs") : t("exteriorStairs")}
          </Badge>
          <Button variant="outline" size="sm" onClick={onChangeType} data-testid="button-change-type">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            {t("changeType")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>{t("dimensions")}</CardTitle>
            <CardDescription>{t("enterMeasurements")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rise">{t("totalRise")}</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="rise"
                    type="number"
                    value={totalRise}
                    onChange={(e) => setTotalRise(Number(e.target.value))}
                    className="max-w-[120px]"
                    data-testid="input-total-rise"
                  />
                  <Slider
                    value={[totalRise]}
                    min={10}
                    max={200}
                    step={1}
                    onValueChange={(val) => setTotalRise(val[0])}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target">{t("targetRiserHeight")}</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="target"
                    type="number"
                    value={targetRiserHeight}
                    onChange={(e) => setTargetRiserHeight(Number(e.target.value))}
                    className="max-w-[120px]"
                    step="0.125"
                    min={defaults.minRiser}
                    max={defaults.maxRiser}
                    data-testid="input-riser-height"
                  />
                  <span className="text-xs text-muted-foreground w-32">
                    {isInterior ? t("standardRangeInterior") : t("standardRangeExterior")}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="tread">{t("treadDepth")}</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="tread"
                    type="number"
                    value={treadDepth}
                    onChange={(e) => setTreadDepth(Number(e.target.value))}
                    className="max-w-[120px]"
                    min={defaults.minTread}
                    max={defaults.maxTread}
                    data-testid="input-tread-depth"
                  />
                  <span className="text-xs text-muted-foreground w-32">
                    {isInterior ? t("minTreadInterior") : t("minTreadExterior")}
                  </span>
                </div>
              </div>

              {isInterior && (
                <div className="space-y-2">
                  <Label htmlFor="nosing">{t("nosing")}</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="nosing"
                      type="number"
                      value={nosing}
                      onChange={(e) => setNosing(Number(e.target.value))}
                      className="max-w-[120px]"
                      step="0.125"
                      min={0}
                      max={1.5}
                      data-testid="input-nosing"
                    />
                    <span className="text-xs text-muted-foreground w-32">{t("nosingOptional")}</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <CardTitle>{t("calculationResults")}</CardTitle>
              <Badge variant={isCompliant ? "default" : "destructive"} data-testid="badge-compliance">
                {isCompliant ? <Check className="w-3 h-3 mr-1" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                {isCompliant ? t("codeCompliant") : t("codeViolation")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-md border" data-testid="result-risers">
                <div className="text-sm text-muted-foreground">{t("numberOfRisers")}</div>
                <div className="text-3xl font-bold text-foreground">{numberOfRisers}</div>
              </div>
              <div className={`p-4 rounded-md border ${riserViolation ? "bg-destructive/10 border-destructive/30" : "bg-muted/50"}`} data-testid="result-riser-height">
                <div className="text-sm text-muted-foreground">{t("actualRiserHeight")}</div>
                <div className={`text-3xl font-bold font-mono ${riserViolation ? "text-destructive" : "text-foreground"}`}>
                  {actualRiserHeight.toFixed(3)}"
                </div>
                {riserTooHigh && <div className="text-xs text-destructive mt-1">{t("warningRiserHigh")}</div>}
                {riserTooLow && <div className="text-xs text-destructive mt-1">{t("warningRiserLow")}</div>}
              </div>
              <div className="p-4 bg-muted/50 rounded-md border" data-testid="result-treads">
                <div className="text-sm text-muted-foreground">{t("numberOfTreads")}</div>
                <div className="text-3xl font-bold text-foreground">{numberOfTreads}</div>
              </div>
              <div className={`p-4 rounded-md border ${treadViolation ? "bg-destructive/10 border-destructive/30" : "bg-muted/50"}`} data-testid="result-tread-depth">
                <div className="text-sm text-muted-foreground">{t("treadDepth")}</div>
                <div className={`text-3xl font-bold font-mono ${treadViolation ? "text-destructive" : "text-foreground"}`}>
                  {treadDepth.toFixed(2)}"
                </div>
                {treadTooShort && <div className="text-xs text-destructive mt-1">{t("warningTreadShort")}</div>}
                {treadTooDeep && <div className="text-xs text-destructive mt-1">{t("warningTreadDeep")}</div>}
              </div>
              <div className="p-4 bg-muted/50 rounded-md border" data-testid="result-total-run">
                <div className="text-sm text-muted-foreground">{t("totalRun")}</div>
                <div className="text-3xl font-bold font-mono">{(totalRun / 12).toFixed(2)}'</div>
                <div className="text-xs text-muted-foreground">{totalRun.toFixed(1)}" total</div>
              </div>
              <div className="p-4 bg-muted/50 rounded-md border" data-testid="result-stringer">
                <div className="text-sm text-muted-foreground">{t("stringerLength")}</div>
                <div className="text-3xl font-bold font-mono">{(stringerLength / 12).toFixed(2)}'</div>
                <div className="text-xs text-muted-foreground">{stringerLength.toFixed(1)}" total</div>
              </div>
            </div>

            {isInterior && nosing > 0 && (
              <div className="p-3 bg-muted/50 rounded-md border text-sm">
                <span className="font-medium">{t("nosing")}:</span>{" "}
                <span className="font-mono">{nosing.toFixed(3)}"</span>
                <span className="text-muted-foreground ml-2">({t("nosingOptional")})</span>
              </div>
            )}

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium">{t("stairVisualizer")}</h4>
              <div className="relative h-48 w-full border rounded-md bg-muted/30 overflow-hidden p-4 flex items-end" data-testid="stair-visualizer">
                {Array.from({ length: Math.min(numberOfRisers, 10) }).map((_, i) => (
                  <div
                    key={i}
                    className={`${isInterior ? "bg-primary/15 border-primary/40" : "bg-amber-500/15 border-amber-500/40"} border-r border-t absolute bottom-0 left-0`}
                    style={{
                      height: `${(i + 1) * 10}%`,
                      width: `${(i + 1) * 10}%`,
                      zIndex: 10 - i,
                    }}
                  />
                ))}
                <div className="absolute top-2 right-2 text-xs text-muted-foreground">
                  {t("angle")}: {angle.toFixed(1)}°
                </div>
                <div className="absolute bottom-2 right-2">
                  <Badge variant="outline" className="text-xs">
                    {isInterior ? t("interiorStairs") : t("exteriorStairs")}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
