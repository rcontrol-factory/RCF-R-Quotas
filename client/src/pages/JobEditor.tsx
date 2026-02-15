import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocation, useRoute } from "wouter";
import { z } from "zod";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { useJob, useCreateJob, useUpdateJob, useDeleteJob } from "@/hooks/use-jobs";
import { useSettings } from "@/hooks/use-settings";
import { useTrades, useServices, useSpecialties, useServicesBySpecialty, useRegions, usePricingRules } from "@/hooks/use-catalog";
import { useAuth } from "@/hooks/use-auth";
import { insertJobSchema, JOB_STATUSES, type Service, type Trade, type Specialty, type JobItem, type Permissions, DEFAULT_EMPLOYEE_PERMISSIONS, type PricingRule, MATERIAL_TIERS, COMPLEXITY_LEVELS, type MaterialTier, type ComplexityLevel, PRICING_UNITS } from "@shared/schema";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Switch } from "@/components/ui/switch";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Trash2, Plus, Save, ArrowLeft, ArrowRight, Printer, Loader2,
  ClipboardList, Wrench, FileText, Check, Search, Pencil,
  Phone, Mail, MessageSquare, MapPin, Lock, Users, Eye, EyeOff, UserPlus,
  Camera, Image
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/hooks/use-locale";
import { getSpecialtyImage, getTradeImage } from "@/lib/trade-images";

import type { StringKey } from "@/lib/i18n";

const STEP_KEYS = [
  { id: 0, key: "jobInfo" as const, icon: ClipboardList },
  { id: 1, key: "services" as const, icon: Wrench },
  { id: 2, key: "summary" as const, icon: FileText },
  { id: 3, key: "pdf" as const, icon: Printer },
];

interface LocalJobItem {
  tempId: string;
  serviceId: number;
  qty: string;
  unitPrice: string;
  serviceName: string;
  serviceUnit: string;
  serviceCategory: string;
}

const jobFormSchema = insertJobSchema.omit({ companyId: true, createdBy: true });
type JobFormValues = z.infer<typeof jobFormSchema>;

function formatPhoneDigits(phone: string): string {
  return phone.replace(/\D/g, "");
}

const PERMISSION_KEYS: { key: keyof Permissions; label: StringKey }[] = [
  { key: "canManageUsers", label: "permManageUsers" },
  { key: "canViewAllSpecialties", label: "permViewAllSpecialties" },
  { key: "canViewPrices", label: "permViewPrices" },
  { key: "canEditPrices", label: "permEditPrices" },
  { key: "canAudit", label: "permAudit" },
];

function TeamManagement({ jobId, t }: { jobId: number; t: (k: StringKey | string) => string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const { data: assignments = [] } = useQuery({
    queryKey: ["/api/jobs", jobId, "assignments"],
    queryFn: async () => {
      const res = await fetch(`/api/jobs/${jobId}/assignments`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      return res.json();
    },
  });

  const addAssignment = useMutation({
    mutationFn: async (userId: number) => {
      const res = await fetch(`/api/jobs/${jobId}/assignments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error("Failed to add assignment");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "assignments"] });
      toast({ title: t("employeeAdded") });
      setAddDialogOpen(false);
      setSelectedUserId("");
    },
  });

  const updatePermission = useMutation({
    mutationFn: async ({ userId, permKey, value }: { userId: number; permKey: string; value: boolean }) => {
      const res = await fetch(`/api/jobs/${jobId}/assignments/${userId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [permKey]: value }),
      });
      if (!res.ok) throw new Error("Failed to update permission");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/jobs", jobId, "assignments"] });
    },
  });

  const existingUserIds = assignments.map((a: any) => a.userId);
  const availableUsers = allUsers.filter((u: any) => !existingUserIds.includes(u.id));

  return (
    <Card data-testid="card-team-management">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            {t("teamMembers")}
          </CardTitle>
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" data-testid="button-add-employee">
                <UserPlus className="w-3.5 h-3.5" />
                {t("addEmployee")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("addEmployee")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                  <SelectTrigger data-testid="select-employee">
                    <SelectValue placeholder={t("selectEmployee")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((u: any) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.username}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full"
                  disabled={!selectedUserId || addAssignment.isPending}
                  onClick={() => addAssignment.mutate(Number(selectedUserId))}
                  data-testid="button-confirm-add-employee"
                >
                  {addAssignment.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                  {t("addEmployee")}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {assignments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3" data-testid="text-no-employees">
            {t("noEmployeesAssigned")}
          </p>
        ) : (
          assignments.map((a: any) => {
            const perms: Permissions = a.permissions || DEFAULT_EMPLOYEE_PERMISSIONS;
            const companyPerms: Permissions | undefined = a.companyPermissions;
            return (
              <div key={a.id} className="border rounded-md p-3 space-y-2" data-testid={`member-${a.userId}`}>
                <span className="text-sm font-medium block">{a.username || `User #${a.userId}`}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PERMISSION_KEYS.map(({ key, label }) => {
                    const blockedByCompany = companyPerms && !companyPerms[key];
                    return (
                      <label key={key} className={`flex items-center gap-2 text-sm ${blockedByCompany ? "opacity-50" : "cursor-pointer"}`}>
                        <Switch
                          checked={blockedByCompany ? false : !!perms[key]}
                          disabled={!!blockedByCompany}
                          onCheckedChange={(checked) =>
                            updatePermission.mutate({ userId: a.userId, permKey: key, value: checked })
                          }
                          data-testid={`switch-${key}-${a.userId}`}
                        />
                        <span className="text-muted-foreground">
                          {t(label)}
                          {blockedByCompany && <Lock className="w-3 h-3 inline ml-1" />}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function QuickActions({ phone, email, address, jobId, t }: { phone?: string | null; email?: string | null; address?: string | null; jobId?: number; t: (k: StringKey | string) => string }) {
  const digits = phone ? formatPhoneDigits(phone) : "";
  const hasPhone = digits.length >= 10;
  const hasEmail = !!email;
  const hasAddress = !!address;
  if (!hasPhone && !hasEmail && !hasAddress) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {hasPhone && (
        <>
          <a href={`tel:+1${digits}`} data-testid="link-call">
            <Button variant="outline" size="sm" className="gap-1.5">
              <Phone className="w-3.5 h-3.5" />
              {t("call")}
            </Button>
          </a>
          <a href={`sms:+1${digits}`} data-testid="link-sms">
            <Button variant="outline" size="sm" className="gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              {t("sms")}
            </Button>
          </a>
          <a href={`https://wa.me/1${digits}?text=${encodeURIComponent(`R Quotas - Job #${jobId || ""}`)}`} target="_blank" rel="noopener noreferrer" data-testid="link-whatsapp">
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
              <MessageSquare className="w-3.5 h-3.5" />
              {t("whatsApp")}
            </Button>
          </a>
        </>
      )}
      {hasEmail && (
        <a href={`mailto:${email}?subject=${encodeURIComponent(`R Quotas - Job #${jobId || ""}`)}`} data-testid="link-email">
          <Button variant="outline" size="sm" className="gap-1.5">
            <Mail className="w-3.5 h-3.5" />
            {t("email")}
          </Button>
        </a>
      )}
      {hasAddress && (
        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address!)}`} target="_blank" rel="noopener noreferrer" data-testid="link-directions">
          <Button variant="outline" size="sm" className="gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            {t("getDirections")}
          </Button>
        </a>
      )}
    </div>
  );
}

function PhotoEstimateForm({
  tradeId,
  onAdd,
  services,
}: {
  tradeId: number;
  onAdd: (item: LocalJobItem) => void;
  services: Service[];
}) {
  const { t } = useLocale();
  const { toast } = useToast();
  const { data: regions } = useRegions();
  const { data: allTrades } = useTrades();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<string>("EA");
  const [materialTier, setMaterialTier] = useState<MaterialTier>("standard");
  const [complexity, setComplexity] = useState<ComplexityLevel>("normal");
  const [qty, setQty] = useState("1");
  const [overridePrice, setOverridePrice] = useState("");
  const [notes, setNotes] = useState("");

  const settings = useSettings();
  const regionId = (settings.data as any)?.regionId || (regions && regions.length > 0 ? regions[0].id : undefined);

  const { data: rules } = usePricingRules({
    regionId: regionId || undefined,
    tradeId,
    unit: selectedUnit,
  });

  const matchingRule = rules && rules.length > 0 ? rules[0] : null;

  const computePrice = useMemo(() => {
    if (!matchingRule) return null;
    const basePrice = Number(matchingRule.basePrice);
    const anchor = Number(matchingRule.anchorMultiplier);
    const matMults = (matchingRule.materialMultiplier || { basic: 1.0, standard: 1.15, premium: 1.35 }) as Record<string, number>;
    const compMults = (matchingRule.complexityMultiplier || { normal: 1.0, hard: 1.2 }) as Record<string, number>;
    const matMult = matMults[materialTier] || 1.0;
    const compMult = compMults[complexity] || 1.0;
    const suggested = basePrice * anchor * matMult * compMult;
    return {
      basePrice,
      anchor,
      matMult,
      compMult,
      suggested: Math.round(suggested * 100) / 100,
      low: Math.round(suggested * 0.90 * 100) / 100,
      high: Math.round(suggested * 1.15 * 100) / 100,
    };
  }, [matchingRule, materialTier, complexity]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!computePrice) return;
    const finalPrice = overridePrice ? Number(overridePrice) : computePrice.suggested;
    const tradeName = allTrades?.find(t => t.id === tradeId)?.name || "Photo Estimate";
    const customService = services.find(s => s.name.includes("Custom Item"));
    const serviceId = customService?.id || services[0]?.id;
    if (!serviceId) {
      toast({ title: "No service available", variant: "destructive" });
      return;
    }

    const pricingMeta = JSON.stringify({
      tradeId,
      unit: selectedUnit,
      materialTier,
      complexity,
      basePrice: computePrice.basePrice,
      anchorMultiplier: computePrice.anchor,
      materialMultiplier: computePrice.matMult,
      complexityMultiplier: computePrice.compMult,
      suggestedPrice: computePrice.suggested,
      finalPrice,
      userNotes: notes,
    });

    if (photoPreview) {
      try {
        await fetch("/api/estimate-photos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: photoPreview, notes: pricingMeta }),
        });
      } catch { /* photo save is best-effort */ }
    }

    onAdd({
      tempId: `photo-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      serviceId,
      qty,
      unitPrice: finalPrice.toFixed(2),
      serviceName: `${tradeName} (Photo Est.)`,
      serviceUnit: selectedUnit,
      serviceCategory: "Photo Estimate",
    });
    toast({ title: t("photoAdded") });
  };

  const currentTradeName = allTrades?.find(t => t.id === tradeId)?.name || "";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Camera className="w-4 h-4" />
        <span>{t("photoEstimateDesc")}</span>
      </div>

      <div>
        <label className="text-sm font-medium">{t("uploadPhoto")}</label>
        <div className="mt-1">
          {photoPreview ? (
            <div className="relative rounded-md overflow-hidden border">
              <img src={photoPreview} alt="Estimate" className="w-full max-h-48 object-cover" />
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-1 right-1 bg-background/80"
                onClick={() => setPhotoPreview(null)}
                data-testid="button-remove-photo"
              >
                <Trash2 className="w-3.5 h-3.5 text-destructive" />
              </Button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed rounded-md p-6 cursor-pointer hover-elevate" data-testid="label-upload-photo">
              <Image className="w-8 h-8 text-muted-foreground mb-2" />
              <span className="text-sm text-muted-foreground">{t("uploadPhoto")}</span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} data-testid="input-photo-upload" />
            </label>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">{t("trade")}</label>
        <div className="mt-1 px-3 py-2 rounded-md border bg-muted/30 text-sm" data-testid="text-photo-trade">
          {currentTradeName}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium">{t("unit")}</label>
        <div className="flex gap-2 mt-1 flex-wrap">
          {PRICING_UNITS.map(u => (
            <Button
              key={u}
              type="button"
              variant={selectedUnit === u ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedUnit(u)}
              data-testid={`button-photo-unit-${u.toLowerCase()}`}
              className="toggle-elevate"
            >
              {u}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium">{t("materialTier")}</label>
          <Select value={materialTier} onValueChange={(v) => setMaterialTier(v as MaterialTier)}>
            <SelectTrigger data-testid="select-material-tier">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MATERIAL_TIERS.map(tier => (
                <SelectItem key={tier} value={tier}>{t(tier as any)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm font-medium">{t("complexityLevel")}</label>
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

      <div>
        <label className="text-sm font-medium">{t("qty")}</label>
        <Input
          type="number"
          min="0"
          step="0.01"
          value={qty}
          onChange={e => setQty(e.target.value)}
          data-testid="input-photo-qty"
        />
      </div>

      {!matchingRule && (
        <div className="text-sm text-muted-foreground text-center py-3 border rounded-md" data-testid="text-no-rules">
          {t("noRulesFound")}
        </div>
      )}

      {computePrice && (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("basePriceLabel")}</span>
                <span className="font-mono">${computePrice.basePrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("anchorHigh")}</span>
                <span className="font-mono">x{computePrice.anchor}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("materialLabel")} ({t(materialTier as any)})</span>
                <span className="font-mono">x{computePrice.matMult.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("complexityLabel")} ({t(complexity as any)})</span>
                <span className="font-mono">x{computePrice.compMult.toFixed(2)}</span>
              </div>
            </div>
            <Separator />
            <div className="flex justify-between items-center">
              <span className="font-medium text-sm">{t("suggestedPrice")}</span>
              <span className="text-lg font-bold font-mono" data-testid="text-suggested-price">${computePrice.suggested.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t("priceRange")}</span>
              <span className="font-mono">${computePrice.low.toFixed(2)} – ${computePrice.high.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium pt-1">
              <span className="text-muted-foreground">Line Total</span>
              <span className="font-mono">${((overridePrice ? Number(overridePrice) : computePrice.suggested) * Number(qty)).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {computePrice && (
        <div>
          <label className="text-sm font-medium">{t("overridePrice")}</label>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={overridePrice}
            onChange={e => setOverridePrice(e.target.value)}
            placeholder={computePrice.suggested.toFixed(2)}
            data-testid="input-override-price"
          />
        </div>
      )}

      <Textarea
        placeholder={t("notesOptional")}
        value={notes}
        onChange={e => setNotes(e.target.value)}
        className="resize-none"
        data-testid="input-photo-notes"
      />

      <Button
        className="w-full"
        onClick={handleSubmit}
        disabled={!computePrice || !qty || Number(qty) <= 0}
        data-testid="button-add-photo-estimate"
      >
        <Camera className="w-4 h-4 mr-2" />
        {t("addPhotoEstimate")}
      </Button>
    </div>
  );
}

function AddServiceForm({
  services,
  onAdd,
  editItem,
  canViewPrices = true,
}: {
  services: Service[];
  onAdd: (item: LocalJobItem) => void;
  editItem?: LocalJobItem;
  canViewPrices?: boolean;
}) {
  const { t } = useLocale();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(editItem?.serviceId || null);
  const [qty, setQty] = useState(editItem?.qty || "1");
  const [unitPrice, setUnitPrice] = useState(editItem?.unitPrice || "");
  const [overrideUnit, setOverrideUnit] = useState(editItem?.serviceUnit || "");

  const selectedService = services.find(s => s.id === selectedServiceId);

  const categories = useMemo(() => {
    const cats = new Set<string>();
    services.forEach(s => cats.add(s.category));
    return Array.from(cats).sort();
  }, [services]);

  const [selectedCategory, setSelectedCategory] = useState(editItem?.serviceCategory || "");

  const filteredServices = useMemo(() => {
    let list = services.filter(s => s.active);
    if (selectedCategory) list = list.filter(s => s.category === selectedCategory);
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(lower));
    }
    return list;
  }, [services, selectedCategory, searchTerm]);

  const handleSelectService = (svc: Service) => {
    setSelectedServiceId(svc.id);
    setUnitPrice(svc.unitPrice ? Number(svc.unitPrice).toFixed(2) : "0.00");
    setOverrideUnit(svc.pricingUnit || "EA");
  };

  const handleSubmit = () => {
    if (!selectedServiceId || !selectedService) return;
    onAdd({
      tempId: editItem?.tempId || `item-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      serviceId: selectedServiceId,
      qty,
      unitPrice,
      serviceName: selectedService.name,
      serviceUnit: overrideUnit || selectedService.pricingUnit,
      serviceCategory: selectedService.category,
    });
  };

  return (
    <div className="space-y-4">
      {!selectedServiceId && (
        <>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger data-testid="select-service-category">
              <SelectValue placeholder={t("selectCategory")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("all")}</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t("searchServices")}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
              data-testid="input-search-services"
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredServices.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">{t("noServicesInCategory")}</p>
            ) : (
              filteredServices.map(svc => (
                <button
                  key={svc.id}
                  type="button"
                  className="w-full text-left px-3 py-2 rounded-md border text-sm hover-elevate"
                  onClick={() => handleSelectService(svc)}
                  data-testid={`button-pick-service-${svc.id}`}
                >
                  <div className="font-medium">{svc.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {svc.pricingUnit}{canViewPrices && svc.unitPrice != null ? ` · $${Number(svc.unitPrice).toFixed(2)}` : ""}
                  </div>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {selectedServiceId && selectedService && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium text-sm">{selectedService.name}</p>
              <p className="text-xs text-muted-foreground">{selectedService.category} &middot; {overrideUnit || selectedService.pricingUnit}</p>
            </div>
            {!editItem && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedServiceId(null)} data-testid="button-change-service">
                {t("changeService")}
              </Button>
            )}
          </div>

          <div>
            <label className="text-sm font-medium">{t("unit")}</label>
            <div className="flex gap-2 mt-1">
              {["EA", "LF", "SF", "HR", "JOB"].map(u => (
                <Button
                  key={u}
                  type="button"
                  variant={overrideUnit === u ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOverrideUnit(u)}
                  data-testid={`button-unit-${u.toLowerCase()}`}
                  className="toggle-elevate"
                >
                  {u}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">{t("qty")}</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={qty}
                onChange={e => setQty(e.target.value)}
                data-testid="input-qty"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t("unitPriceDollar")}</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={unitPrice}
                onChange={e => setUnitPrice(e.target.value)}
                data-testid="input-unit-price"
              />
            </div>
          </div>

          <div className="flex justify-between text-sm pt-1">
            <span className="text-muted-foreground">{("lineTotal" as any)}</span>
            <span className="font-mono font-medium">${(Number(qty) * Number(unitPrice)).toFixed(2)}</span>
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!qty || Number(qty) <= 0}
            data-testid="button-confirm-add-item"
          >
            {editItem ? t("updateItem") : t("addItem")}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function JobEditor() {
  const [, params] = useRoute("/jobs/:id");
  const isNew = params?.id === "new";
  const jobId = isNew ? undefined : parseInt(params!.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useLocale();
  const { isAdminOrOwner } = useAuth();
  const [step, setStep] = useState(0);
  const [items, setItems] = useState<LocalJobItem[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [photoEstimateOpen, setPhotoEstimateOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { data: job, isLoading: isLoadingJob } = useJob(jobId || 0);
  const { data: settings } = useSettings();
  const { data: trades } = useTrades();
  const { data: jobPhotos = [] } = useQuery<any[]>({
    queryKey: [`/api/jobs/${jobId}/photos`],
    enabled: !!jobId,
  });

  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();

  const form = useForm<JobFormValues>({
    resolver: zodResolver(jobFormSchema),
    defaultValues: {
      tradeId: 0,
      specialtyId: null,
      clientName: "",
      clientPhone: "",
      clientEmail: "",
      address: "",
      doorCode: "",
      notes: "",
      status: "DRAFT",
      scheduledAt: "",
      addressLocked: true,
    },
  });

  useEffect(() => {
    if (trades && trades.length > 0 && isNew) {
      form.setValue("tradeId", trades[0].id);
    }
  }, [trades, isNew]);

  const selectedTradeId = form.watch("tradeId");
  const selectedSpecialtyId = form.watch("specialtyId");
  const companyTrade = trades?.find(t => t.id === selectedTradeId);
  const isCarpentry = companyTrade?.slug === "carpentry";
  const { data: specialtiesList } = useSpecialties(isCarpentry ? selectedTradeId : undefined);
  const { data: specialtyServices } = useServicesBySpecialty(selectedSpecialtyId || undefined);
  const { data: tradeServices } = useServices(selectedTradeId || undefined);
  const servicesList = (isCarpentry && selectedSpecialtyId) ? specialtyServices : tradeServices;
  const servicesMap = useMemo(() => {
    const map = new Map<number, Service>();
    (servicesList || []).forEach(s => map.set(s.id, s));
    return map;
  }, [servicesList]);

  const myRole: string = (job as any)?.myRole || (isAdminOrOwner ? "OWNER" : "USER");
  const isOwnerOrAdmin = myRole === "OWNER" || myRole === "ADMIN" || isAdminOrOwner;
  const jobPerms: Permissions = (job as any)?.permissions || DEFAULT_EMPLOYEE_PERMISSIONS;
  const canViewPrices = isNew || isOwnerOrAdmin || jobPerms.canViewPrices;
  const canEditJob = isNew || isOwnerOrAdmin;

  useEffect(() => {
    if (isNew) {
      form.reset({
        tradeId: 0,
        specialtyId: null,
        clientName: "",
        clientPhone: "",
        clientEmail: "",
        address: "",
        doorCode: "",
        notes: "",
        status: "DRAFT",
        scheduledAt: "",
        addressLocked: true,
      });
      setItems([]);
      return;
    }
    if (job) {
      form.reset({
        tradeId: job.tradeId,
        specialtyId: job.specialtyId || null,
        clientName: job.clientName || "",
        clientPhone: job.clientPhone || "",
        clientEmail: job.clientEmail || "",
        address: job.address || "",
        doorCode: job.doorCode || "",
        notes: job.notes || "",
        status: job.status || "DRAFT",
        scheduledAt: job.scheduledAt || "",
        addressLocked: job.addressLocked ?? true,
      });
      setItems(
        (job.items || []).map((item: any) => ({
          tempId: `existing-${item.id}`,
          serviceId: item.serviceId,
          qty: item.qty?.toString() || "1",
          unitPrice: item.unitPrice?.toString() || "0",
          serviceName: item.service?.name || item.serviceName || `Service #${item.serviceId}`,
          serviceUnit: item.pricingUnit || item.service?.pricingUnit || item.serviceUnit || "EA",
          serviceCategory: item.service?.category || item.serviceCategory || "",
        }))
      );
    }
  }, [job, isNew, form]);

  const subtotal = useMemo(() =>
    items.reduce((sum, item) => sum + (Number(item.qty) * Number(item.unitPrice)), 0), [items]);
  const taxRate = Number(settings?.taxRate) || 0;
  const overheadRate = Number(settings?.overheadRate) || 0;
  const profitRate = Number(settings?.profitRate) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const overheadAmount = subtotal * (overheadRate / 100);
  const profitAmount = subtotal * (profitRate / 100);
  const total = subtotal + taxAmount + overheadAmount + profitAmount;

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, LocalJobItem[]> = {};
    items.forEach(item => {
      const cat = item.serviceCategory || "Other";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(item);
    });
    return grouped;
  }, [items]);

  const onSave = async () => {
    const valid = await form.trigger();
    if (!valid) {
      setStep(0);
      toast({ title: "Missing info", description: "Please fill in the required job fields.", variant: "destructive" });
      return;
    }
    const data = form.getValues();
    const payload = {
      ...data,
      items: items.map(item => ({
        serviceId: item.serviceId,
        qty: item.qty,
        unitPrice: item.unitPrice,
        lineTotal: String(Number(item.qty) * Number(item.unitPrice)),
        pricingUnit: item.serviceUnit || "EA",
      })),
    };
    try {
      if (isNew) {
        const result = await createJob.mutateAsync(payload as any);
        setLocation(`/jobs/${result.id}`);
      } else if (jobId) {
        await updateJob.mutateAsync({ id: jobId, ...payload } as any);
      }
    } catch {
    }
  };

  const handleDelete = async () => {
    if (confirm("Are you sure you want to delete this job?")) {
      if (jobId) {
        await deleteJob.mutateAsync(jobId);
        setLocation("/");
      }
    }
  };

  const addItem = (item: LocalJobItem) => {
    if (editingIndex !== null) {
      setItems(prev => prev.map((it, i) => i === editingIndex ? item : it));
      setEditingIndex(null);
    } else {
      setItems(prev => [...prev, item]);
    }
    setAddDialogOpen(false);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const editItem = (index: number) => {
    setEditingIndex(index);
    setAddDialogOpen(true);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const vals = form.getValues();
    const tradeName = trades?.find(tr => tr.id === vals.tradeId)?.name || "";
    const specialtyName = specialtiesList?.find(s => s.id === vals.specialtyId)?.name || "";

    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("R Quotas", 14, 18);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text("ESTIMATE", 14, 24);
    doc.setTextColor(0);

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 14, 30);
    if (tradeName) doc.text(`Trade: ${tradeName}${specialtyName ? ` - ${specialtyName}` : ""}`, 14, 35);
    if (vals.clientName) doc.text(`Client: ${vals.clientName}`, 14, 40);
    if (vals.address) doc.text(`Address: ${vals.address}`, 14, 45);

    let startY = 55;
    const categories = Object.keys(itemsByCategory);
    categories.forEach(cat => {
      const catItems = itemsByCategory[cat];
      const catSubtotal = catItems.reduce((s, i) => s + Number(i.qty) * Number(i.unitPrice), 0);

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(40);
      doc.text(cat, 14, startY);
      startY += 2;

      const body = catItems.map(item => [
        item.serviceName,
        `${Number(item.qty)} ${item.serviceUnit}`,
        `$${Number(item.unitPrice).toFixed(2)}`,
        `$${(Number(item.qty) * Number(item.unitPrice)).toFixed(2)}`,
      ]);

      body.push([
        { content: `${cat} Subtotal`, colSpan: 3, styles: { fontStyle: 'bold' as const, halign: 'right' as const } },
        { content: `$${catSubtotal.toFixed(2)}`, styles: { fontStyle: 'bold' as const } },
      ] as any);

      autoTable(doc, {
        startY,
        head: [['Service', 'Qty', 'Unit Price', 'Total']],
        body,
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2 },
        margin: { left: 14 },
      });

      startY = (doc as any).lastAutoTable.finalY + 8;
    });

    startY += 4;
    doc.setDrawColor(200);
    doc.line(120, startY, 196, startY);
    startY += 6;

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text("Subtotal:", 140, startY);
    doc.text(`$${subtotal.toFixed(2)}`, 180, startY, { align: "right" });

    if (taxRate > 0) {
      startY += 5;
      doc.text(`Tax (${taxRate}%):`, 140, startY);
      doc.text(`$${taxAmount.toFixed(2)}`, 180, startY, { align: "right" });
    }
    if (overheadRate > 0) {
      startY += 5;
      doc.text(`Overhead (${overheadRate}%):`, 140, startY);
      doc.text(`$${overheadAmount.toFixed(2)}`, 180, startY, { align: "right" });
    }
    if (profitRate > 0) {
      startY += 5;
      doc.text(`Profit (${profitRate}%):`, 140, startY);
      doc.text(`$${profitAmount.toFixed(2)}`, 180, startY, { align: "right" });
    }

    startY += 7;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text("Total:", 140, startY);
    doc.text(`$${total.toFixed(2)}`, 180, startY, { align: "right" });

    if (vals.notes) {
      startY += 12;
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text("Notes:", 14, startY);
      const splitNotes = doc.splitTextToSize(vals.notes || "", 170);
      doc.text(splitNotes, 14, startY + 5);
    }

    doc.save(`Estimate_${vals.clientName || "Job"}_${jobId || "new"}.pdf`);
    toast({ title: t("pdfGenerated"), description: t("estimateDownloaded") });
  };

  if (isLoadingJob && !isNew) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const isPending = createJob.isPending || updateJob.isPending;

  const selectedSpecialty = specialtiesList?.find(s => s.id === selectedSpecialtyId);
  const editorHeroImage = selectedSpecialty
    ? getSpecialtyImage(selectedSpecialty.slug, companyTrade?.slug)
    : getTradeImage(companyTrade?.slug);

  return (
    <div className="max-w-4xl mx-auto pb-24 animate-in fade-in duration-300">
      <div
        className="relative rounded-md overflow-hidden mb-6 -mx-4 sm:mx-0"
        data-testid="job-editor-hero"
      >
        <div
          className="h-28 sm:h-32 bg-cover bg-center"
          style={{ backgroundImage: `url(${editorHeroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/15" />
        <div className="absolute inset-0 flex items-center justify-between px-4 sm:px-5">
          <div className="flex items-center gap-3">
            <Button type="button" variant="ghost" size="icon" onClick={() => setLocation("/")} data-testid="button-back" className="text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-sm" data-testid="text-page-title">
              {isNew ? t("newJob") : `${t("editJob")} #${jobId}`}
            </h1>
          </div>
          <div className="flex gap-2">
            {!isNew && (
              <Button type="button" variant="ghost" size="icon" onClick={handleDelete} data-testid="button-delete-job" className="text-white">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center mb-8 overflow-x-auto" data-testid="stepper-nav">
        {STEP_KEYS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === i;
          const isCompleted = step > i;
          return (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setStep(i)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors w-full
                  ${isActive ? "bg-primary text-primary-foreground" : ""}
                  ${isCompleted ? "text-primary" : ""}
                  ${!isActive && !isCompleted ? "text-muted-foreground" : ""}
                `}
                data-testid={`button-step-${i}`}
              >
                <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2
                  ${isActive ? "border-primary-foreground bg-primary-foreground/20" : ""}
                  ${isCompleted ? "border-primary bg-primary/10" : ""}
                  ${!isActive && !isCompleted ? "border-muted-foreground/30" : ""}
                `}>
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className="hidden sm:inline truncate">{t(s.key)}</span>
              </button>
              {i < STEP_KEYS.length - 1 && <div className="w-4 h-px bg-border flex-shrink-0 mx-1" />}
            </div>
          );
        })}
      </div>

      {step === 0 && (
        <div className="space-y-6">
          <Card data-testid="step-job-info">
            <CardHeader>
              <CardTitle>{t("jobInformation")}</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <div className="space-y-4">
                  {companyTrade && (
                    <div className="space-y-1" data-testid="display-trade">
                      <p className="text-sm font-medium">{t("trade")}</p>
                      <p className="text-sm text-muted-foreground">{companyTrade.name}</p>
                    </div>
                  )}

                  {isCarpentry && specialtiesList && specialtiesList.length > 0 && (
                    <FormField
                      control={form.control}
                      name="specialtyId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("specialty") || "Specialty"}</FormLabel>
                          <Select
                            onValueChange={(val) => field.onChange(val === "none" ? null : Number(val))}
                            value={field.value ? String(field.value) : "none"}
                          >
                            <FormControl>
                              <SelectTrigger data-testid="select-specialty">
                                <SelectValue placeholder={t("selectSpecialty") || "Select specialty"} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">{t("allSpecialties") || "All Specialties"}</SelectItem>
                              {specialtiesList.map(spec => (
                                <SelectItem key={spec.id} value={String(spec.id)}>{spec.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="clientName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("clientName")}</FormLabel>
                          <FormControl>
                            <Input placeholder="John Smith" {...field} value={field.value || ""} data-testid="input-client-name" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("status")}</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || "DRAFT"}>
                            <FormControl>
                              <SelectTrigger data-testid="select-status">
                                <SelectValue placeholder={t("selectStatus")} />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {JOB_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>{s}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="clientPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("clientPhone")}</FormLabel>
                            <FormControl>
                              <Input placeholder="(555) 123-4567" {...field} value={field.value || ""} data-testid="input-client-phone" disabled={!canEditJob} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="clientEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t("clientEmail")}</FormLabel>
                            <FormControl>
                              <Input type="email" placeholder="client@email.com" {...field} value={field.value || ""} data-testid="input-client-email" disabled={!canEditJob} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("clientAddress")}</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Main St, City, State" {...field} value={field.value || ""} data-testid="input-address" disabled={!canEditJob} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="doorCode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1.5">
                            <Lock className="w-3 h-3 text-muted-foreground" />
                            {t("doorCode")}
                          </FormLabel>
                          <FormControl>
                            <Input placeholder="1234" {...field} value={field.value || ""} data-testid="input-door-code" disabled={!canEditJob} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    <FormField
                      control={form.control}
                      name="scheduledAt"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{("Scheduled Date" as any)}</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} data-testid="input-scheduled-at" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("notesPrivate")}</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Details..." className="min-h-[80px]" {...field} value={field.value || ""} data-testid="input-notes" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </Form>
            </CardContent>
          </Card>

          {!isNew && (
            <Card data-testid="card-quick-actions">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">{t("quickActions")}</CardTitle>
              </CardHeader>
              <CardContent>
                <QuickActions
                  phone={form.getValues("clientPhone")}
                  email={form.getValues("clientEmail")}
                  address={form.getValues("address")}
                  jobId={jobId}
                  t={t as any}
                />
              </CardContent>
            </Card>
          )}

          {!isNew && isOwnerOrAdmin && jobId && (
            <TeamManagement jobId={jobId} t={t as any} />
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4" data-testid="step-services">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">{t("lineItems")} ({items.length})</h2>
            <div className="flex gap-2 flex-wrap">
              <Dialog open={photoEstimateOpen} onOpenChange={setPhotoEstimateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" data-testid="button-photo-estimate">
                    <Camera className="w-4 h-4 mr-2" />
                    {t("photoEstimateBeta")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{t("photoEstimate")}</DialogTitle>
                  </DialogHeader>
                  <PhotoEstimateForm
                    tradeId={selectedTradeId}
                    services={servicesList || []}
                    onAdd={(item) => {
                      addItem(item);
                      setPhotoEstimateOpen(false);
                    }}
                  />
                </DialogContent>
              </Dialog>
              <Dialog open={addDialogOpen} onOpenChange={(open) => { setAddDialogOpen(open); if (!open) setEditingIndex(null); }}>
                <DialogTrigger asChild>
                  <Button data-testid="button-add-service">
                    <Plus className="w-4 h-4 mr-2" />
                    {t("addService")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingIndex !== null ? t("editService") : t("addService")}</DialogTitle>
                  </DialogHeader>
                  <AddServiceForm
                    services={servicesList || []}
                    onAdd={addItem}
                    editItem={editingIndex !== null ? items[editingIndex] : undefined}
                    canViewPrices={canViewPrices}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {!selectedTradeId && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              </CardContent>
            </Card>
          )}

          {selectedTradeId && items.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Wrench className="w-10 h-10 mx-auto mb-3 opacity-40" />
                <p>{t("noServicesAdded")}</p>
                <p className="text-sm">{t("clickAddService")}</p>
              </CardContent>
            </Card>
          )}

          {items.length > 0 && (
            <div className="space-y-4">
              {Object.entries(itemsByCategory).map(([cat, catItems]) => (
                <div key={cat}>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">{cat}</h3>
                  <div className="space-y-1">
                    {catItems.map((item) => {
                      const globalIndex = items.indexOf(item);
                      const lineTotal = Number(item.qty) * Number(item.unitPrice);
                      return (
                        <div
                          key={item.tempId}
                          className="flex items-center gap-2 px-3 py-2 rounded-md border bg-card hover-elevate"
                          data-testid={`line-item-${globalIndex}`}
                        >
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-sm truncate" data-testid={`text-item-name-${globalIndex}`}>{item.serviceName}</span>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {item.qty} {item.serviceUnit}{canViewPrices ? ` x $${Number(item.unitPrice).toFixed(2)}` : ""}
                            </div>
                          </div>
                          {canViewPrices && (
                            <span className="font-mono text-sm font-medium whitespace-nowrap" data-testid={`text-item-total-${globalIndex}`}>
                              ${lineTotal.toFixed(2)}
                            </span>
                          )}
                          <Button type="button" variant="ghost" size="icon" onClick={() => editItem(globalIndex)} data-testid={`button-edit-item-${globalIndex}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(globalIndex)} data-testid={`button-remove-item-${globalIndex}`}>
                            <Trash2 className="w-3.5 h-3.5 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6" data-testid="step-summary">
          <Card>
            <CardHeader>
              <CardTitle>{t("estimateSummary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-sm space-y-1 text-muted-foreground">
                {form.getValues("clientName") && <p><span className="font-medium text-foreground">{t("client")}:</span> {form.getValues("clientName")}</p>}
                {form.getValues("address") && <p><span className="font-medium text-foreground">{t("clientAddress")}:</span> {form.getValues("address")}</p>}
                <p><span className="font-medium text-foreground">{t("status")}:</span> {form.getValues("status")}</p>
              </div>

              <Separator />

              {Object.keys(itemsByCategory).length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-4">{t("noLineItems")}</p>
              ) : (
                Object.entries(itemsByCategory).map(([cat, catItems]) => {
                  const catSubtotal = catItems.reduce((s, i) => s + Number(i.qty) * Number(i.unitPrice), 0);
                  return (
                    <div key={cat}>
                      <h3 className="font-semibold text-sm mb-2">{cat}</h3>
                      <div className="space-y-1 mb-2">
                        {catItems.map((item, i) => (
                          <div key={item.tempId} className="flex justify-between text-sm" data-testid={`summary-item-${cat}-${i}`}>
                            <span className="text-muted-foreground">{item.serviceName} ({item.qty} {item.serviceUnit})</span>
                            {canViewPrices && <span className="font-mono">${(Number(item.qty) * Number(item.unitPrice)).toFixed(2)}</span>}
                          </div>
                        ))}
                      </div>
                      {canViewPrices && (
                        <div className="flex justify-between text-sm font-medium border-t pt-1 mb-4">
                          <span>{cat} {t("subtotal")}</span>
                          <span className="font-mono">${catSubtotal.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {canViewPrices && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{t("subtotal")}</span>
                      <span className="font-mono">${subtotal.toFixed(2)}</span>
                    </div>
                    {taxRate > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{t("tax")} ({taxRate}%)</span>
                        <span className="font-mono">${taxAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {overheadRate > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{("Overhead" as any)} ({overheadRate}%)</span>
                        <span className="font-mono">${overheadAmount.toFixed(2)}</span>
                      </div>
                    )}
                    {profitRate > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{("Profit" as any)} ({profitRate}%)</span>
                        <span className="font-mono">${profitAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-bold pt-2" data-testid="text-grand-total">
                      <span>{t("totalLabel")}</span>
                      <span className="font-mono text-foreground">${total.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {jobPhotos.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  {t("photoEstimate" as any)} ({jobPhotos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {jobPhotos.map((photo: any) => (
                    <div key={photo.id} className="relative rounded-md overflow-hidden border" data-testid={`photo-preview-${photo.id}`}>
                      <img
                        src={photo.url}
                        alt={`Estimate photo ${photo.id}`}
                        className="w-full h-32 object-cover"
                      />
                      {photo.notes && (() => {
                        try {
                          const meta = JSON.parse(photo.notes);
                          return meta.totalEstimate ? (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                              <span className="text-white text-xs font-mono">${Number(meta.totalEstimate).toFixed(2)}</span>
                            </div>
                          ) : null;
                        } catch { return null; }
                      })()}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-6" data-testid="step-pdf">
          <Card>
            <CardHeader>
              <CardTitle>{t("generatePdf")}</CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8 space-y-4">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground">{t("readyToExport")}</p>
              <p className="text-xs text-muted-foreground">
                Items grouped by category with subtotals. Tax: {taxRate}%. Overhead: {overheadRate}%. Profit: {profitRate}%.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
                <Button onClick={generatePDF} className="gap-2" data-testid="button-generate-pdf">
                  <Printer className="w-4 h-4" />
                  {t("downloadPdf")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-3 flex justify-between items-center z-40 sm:static sm:mt-6 sm:border-0 sm:p-0 sm:bg-transparent">
        <Button
          type="button"
          variant="outline"
          disabled={step === 0}
          onClick={() => setStep(s => s - 1)}
          data-testid="button-prev-step"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          {t("back")}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onSave} disabled={isPending} data-testid="button-save-job">
            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
            {t("save")}
          </Button>
          {step < STEP_KEYS.length - 1 && (
            <Button type="button" onClick={() => setStep(s => s + 1)} data-testid="button-next-step">
              {t("next")}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
