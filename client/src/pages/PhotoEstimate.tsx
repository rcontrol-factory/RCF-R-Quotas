import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { useTrades, useSpecialties, useRegions, usePricingRules } from "@/hooks/use-catalog";
import { useJobs } from "@/hooks/use-jobs";
import { useToast } from "@/hooks/use-toast";
import { MATERIAL_TIERS, COMPLEXITY_LEVELS, type MaterialTier, type ComplexityLevel, type PricingRule } from "@shared/schema";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Camera, ImageIcon, Ruler, DollarSign, Save, Trash2, Link2, ArrowLeft
} from "lucide-react";
import { Link } from "wouter";

export default function PhotoEstimate() {
  const { user } = useAuth();
  const { t } = useLocale();
  const { toast } = useToast();

  const { data: tradesData } = useTrades();
  const { data: specialtiesData } = useSpecialties();
  const { data: regionsData } = useRegions();
  const { data: jobsData } = useJobs();

  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [selectedTradeId, setSelectedTradeId] = useState<string>("");
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState<string>("");
  const [selectedRegionId, setSelectedRegionId] = useState<string>("");
  const [selectedUnit, setSelectedUnit] = useState<string>("SF");
  const [materialTier, setMaterialTier] = useState<MaterialTier>("standard");
  const [complexity, setComplexity] = useState<ComplexityLevel>("normal");
  const [length, setLength] = useState<string>("");
  const [width, setWidth] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [linkedJobId, setLinkedJobId] = useState<string>("");
  const [saved, setSaved] = useState(false);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const trades = tradesData || [];
  const allSpecialties = specialtiesData || [];
  const regions = regionsData || [];
  const jobs = jobsData?.items || [];

  const filteredSpecialties = selectedTradeId
    ? allSpecialties.filter(s => s.tradeId === Number(selectedTradeId))
    : [];

  const { data: pricingRules = [] } = usePricingRules({
    regionId: selectedRegionId ? Number(selectedRegionId) : undefined,
    tradeId: selectedTradeId ? Number(selectedTradeId) : undefined,
    specialtyId: selectedSpecialtyId ? Number(selectedSpecialtyId) : undefined,
    unit: selectedUnit || undefined,
  });

  const matchingRule: PricingRule | undefined = pricingRules.length > 0 ? pricingRules[0] : undefined;

  const calculatedArea = useMemo(() => {
    const l = parseFloat(length) || 0;
    const w = parseFloat(width) || 0;
    const h = parseFloat(height) || 0;

    if (selectedUnit === "SF") {
      return l * w;
    } else if (selectedUnit === "LF") {
      return l;
    } else if (selectedUnit === "EA" || selectedUnit === "JOB") {
      return 1;
    } else if (selectedUnit === "HR") {
      return l || 1;
    }
    return l * w;
  }, [length, width, height, selectedUnit]);

  const priceCalc = useMemo(() => {
    if (!matchingRule) return null;

    const basePrice = parseFloat(String(matchingRule.basePrice)) || 0;
    const anchorMult = parseFloat(String(matchingRule.anchorMultiplier)) || 1.15;
    const matMults = matchingRule.materialMultiplier as Record<string, number>;
    const compMults = matchingRule.complexityMultiplier as Record<string, number>;
    const matMult = matMults[materialTier] || 1.0;
    const compMult = compMults[complexity] || 1.0;

    const unitPrice = basePrice * anchorMult * matMult * compMult;
    const totalEstimate = unitPrice * calculatedArea;

    const lowMult = (matMults["basic"] || 1.0) * (compMults["normal"] || 1.0);
    const highMult = (matMults["premium"] || 1.35) * (compMults["hard"] || 1.2);
    const lowPrice = basePrice * anchorMult * lowMult * calculatedArea;
    const highPrice = basePrice * anchorMult * highMult * calculatedArea;

    return { basePrice, anchorMult, matMult, compMult, unitPrice, totalEstimate, lowPrice, highPrice };
  }, [matchingRule, materialTier, complexity, calculatedArea]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!photoDataUrl) throw new Error("No photo");
      const res = await apiRequest("POST", "/api/estimate-photos", {
        jobId: linkedJobId ? Number(linkedJobId) : null,
        url: photoDataUrl,
        notes: JSON.stringify({
          tradeId: selectedTradeId ? Number(selectedTradeId) : null,
          specialtyId: selectedSpecialtyId ? Number(selectedSpecialtyId) : null,
          regionId: selectedRegionId ? Number(selectedRegionId) : null,
          unit: selectedUnit,
          materialTier,
          complexity,
          length: parseFloat(length) || 0,
          width: parseFloat(width) || 0,
          height: parseFloat(height) || 0,
          area: calculatedArea,
          unitPrice: priceCalc?.unitPrice || 0,
          totalEstimate: priceCalc?.totalEstimate || 0,
        }),
      });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: t("estimateSaved" as any) });
      setSaved(true);
      if (linkedJobId) {
        queryClient.invalidateQueries({ queryKey: ["/api/jobs", Number(linkedJobId), "photos"] });
      }
    },
    onError: () => {
      toast({ title: "Error saving estimate", variant: "destructive" });
    },
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Photo must be under 5MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoDataUrl(reader.result as string);
      setSaved(false);
    };
    reader.readAsDataURL(file);
  }

  function resetForm() {
    setPhotoDataUrl(null);
    setLength("");
    setWidth("");
    setHeight("");
    setLinkedJobId("");
    setSaved(false);
  }

  const areaLabel = selectedUnit === "LF"
    ? (t("lnft" as any) || "ln ft")
    : (t("sqft" as any) || "sq ft");

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-photo-estimate-title">
            {t("photoEstimateBeta" as any)}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("photoEstimateDesc" as any)}</p>
        </div>
        <Link href="/">
          <Button variant="outline" size="sm" data-testid="button-back-dashboard">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            {t("back")}
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="w-5 h-5" />
                {t("photoPreview" as any) || "Photo"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {photoDataUrl ? (
                <div className="relative">
                  <img
                    src={photoDataUrl}
                    alt="Estimate photo"
                    className="w-full rounded-md border object-cover max-h-64"
                    data-testid="img-photo-preview"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 bg-background/80"
                    onClick={() => { setPhotoDataUrl(null); setSaved(false); }}
                    data-testid="button-remove-photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="border-2 border-dashed rounded-md p-8 text-center" data-testid="photo-drop-zone">
                  <ImageIcon className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">{t("noPhotoSelected" as any)}</p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => cameraInputRef.current?.click()}
                      data-testid="button-take-photo"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      {t("takePhoto" as any)}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => galleryInputRef.current?.click()}
                      data-testid="button-choose-gallery"
                    >
                      <ImageIcon className="w-4 h-4 mr-2" />
                      {t("chooseFromGallery" as any)}
                    </Button>
                  </div>
                </div>
              )}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-camera"
              />
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileSelect}
                data-testid="input-gallery"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ruler className="w-5 h-5" />
                {t("manualMeasurements" as any) || "Measurements"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("selectTrade" as any)}</Label>
                  <Select value={selectedTradeId} onValueChange={(v) => { setSelectedTradeId(v); setSelectedSpecialtyId(""); }}>
                    <SelectTrigger data-testid="select-trade">
                      <SelectValue placeholder={t("selectTrade" as any)} />
                    </SelectTrigger>
                    <SelectContent>
                      {trades.map(tr => (
                        <SelectItem key={tr.id} value={String(tr.id)}>{tr.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("category" as any) || "Specialty"}</Label>
                  <Select value={selectedSpecialtyId} onValueChange={setSelectedSpecialtyId} disabled={filteredSpecialties.length === 0}>
                    <SelectTrigger data-testid="select-specialty">
                      <SelectValue placeholder={filteredSpecialties.length === 0 ? "N/A" : t("selectCategory" as any)} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredSpecialties.map(sp => (
                        <SelectItem key={sp.id} value={String(sp.id)}>{sp.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("region" as any)}</Label>
                  <Select value={selectedRegionId} onValueChange={setSelectedRegionId}>
                    <SelectTrigger data-testid="select-region">
                      <SelectValue placeholder={t("selectRegion" as any)} />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map(r => (
                        <SelectItem key={r.id} value={String(r.id)}>{r.name} ({r.code})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("unit" as any)}</Label>
                  <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                    <SelectTrigger data-testid="select-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SF">SF (sq ft)</SelectItem>
                      <SelectItem value="LF">LF (linear ft)</SelectItem>
                      <SelectItem value="EA">EA (each)</SelectItem>
                      <SelectItem value="HR">HR (hour)</SelectItem>
                      <SelectItem value="JOB">JOB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>{t("length" as any)}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={length}
                    onChange={(e) => setLength(e.target.value)}
                    placeholder="0"
                    data-testid="input-length"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("width" as any)}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={width}
                    onChange={(e) => setWidth(e.target.value)}
                    placeholder="0"
                    disabled={selectedUnit === "LF" || selectedUnit === "EA" || selectedUnit === "JOB" || selectedUnit === "HR"}
                    data-testid="input-width"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("height" as any)}</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    placeholder="0"
                    data-testid="input-height"
                  />
                </div>
              </div>

              {calculatedArea > 0 && (
                <div className="p-3 bg-muted/50 rounded-md border">
                  <span className="text-sm text-muted-foreground">{t("areaCalculated" as any)}:</span>
                  <span className="ml-2 font-bold font-mono text-foreground" data-testid="text-area-calc">
                    {calculatedArea.toFixed(1)} {areaLabel}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t("materialTier" as any)}</Label>
                  <Select value={materialTier} onValueChange={(v) => setMaterialTier(v as MaterialTier)}>
                    <SelectTrigger data-testid="select-material">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_TIERS.map(tier => (
                        <SelectItem key={tier} value={tier}>{t(tier as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t("complexityLevel" as any)}</Label>
                  <Select value={complexity} onValueChange={(v) => setComplexity(v as ComplexityLevel)}>
                    <SelectTrigger data-testid="select-complexity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPLEXITY_LEVELS.map(level => (
                        <SelectItem key={level} value={level}>{t(level as any)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                {t("estimateResult" as any)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {priceCalc ? (
                <>
                  <div className="p-4 bg-primary/5 rounded-md border border-primary/20 text-center" data-testid="result-total-estimate">
                    <div className="text-sm text-muted-foreground">{t("suggestedPrice" as any)}</div>
                    <div className="text-4xl font-bold text-primary mt-1">
                      ${priceCalc.totalEstimate.toFixed(2)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-2">
                      {t("priceRange" as any)}: ${priceCalc.lowPrice.toFixed(2)} - ${priceCalc.highPrice.toFixed(2)}
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2 text-sm">
                    <h4 className="font-medium">{t("formulaBreakdown" as any)}</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 bg-muted/50 rounded-md border">
                        <div className="text-muted-foreground text-xs">{t("basePriceLabel" as any)}</div>
                        <div className="font-mono font-bold">${priceCalc.basePrice.toFixed(2)}</div>
                      </div>
                      <div className="p-2 bg-muted/50 rounded-md border">
                        <div className="text-muted-foreground text-xs">{t("anchorHigh" as any)}</div>
                        <div className="font-mono font-bold">{priceCalc.anchorMult}x</div>
                      </div>
                      <div className="p-2 bg-muted/50 rounded-md border">
                        <div className="text-muted-foreground text-xs">{t("materialLabel" as any)}</div>
                        <div className="font-mono font-bold">{priceCalc.matMult}x ({materialTier})</div>
                      </div>
                      <div className="p-2 bg-muted/50 rounded-md border">
                        <div className="text-muted-foreground text-xs">{t("complexityLabel" as any)}</div>
                        <div className="font-mono font-bold">{priceCalc.compMult}x ({complexity})</div>
                      </div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-md border">
                      <div className="text-muted-foreground text-xs">Unit Price</div>
                      <div className="font-mono font-bold">${priceCalc.unitPrice.toFixed(2)} / {selectedUnit}</div>
                    </div>
                    <div className="p-2 bg-muted/50 rounded-md border">
                      <div className="text-muted-foreground text-xs">{t("areaCalculated" as any)}</div>
                      <div className="font-mono font-bold">{calculatedArea.toFixed(1)} {areaLabel}</div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {selectedTradeId && selectedRegionId
                      ? (t("noRulesFound" as any))
                      : "Select trade, region, and unit to see pricing"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="w-5 h-5" />
                {t("linkToJob" as any)}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Select value={linkedJobId} onValueChange={setLinkedJobId}>
                <SelectTrigger data-testid="select-link-job">
                  <SelectValue placeholder={t("selectJob" as any)} />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map(j => (
                    <SelectItem key={j.id} value={String(j.id)}>
                      #{j.id} - {j.clientName || `Job #${j.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {linkedJobId
                  ? `Linked to Job #${linkedJobId}`
                  : (t("noJobLinked" as any))}
              </p>
            </CardContent>
          </Card>

          <div className="flex flex-col gap-3">
            {saved ? (
              <Button variant="outline" onClick={resetForm} className="w-full" data-testid="button-new-estimate">
                {t("startNewEstimate" as any)}
              </Button>
            ) : (
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!photoDataUrl || saveMutation.isPending}
                className="w-full"
                data-testid="button-save-estimate"
              >
                <Save className="w-4 h-4 mr-2" />
                {saveMutation.isPending ? "..." : (t("saveEstimate" as any))}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
