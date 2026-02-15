import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSettings, useUpdateSettings } from "@/hooks/use-settings";
import { insertCompanySettingsSchema, type InsertCompanySettings, type Permissions, type Trade, type Specialty } from "@shared/schema";
import { useRegions } from "@/hooks/use-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Loader2, Shield, MapPin, Wrench, Check, UserPlus, Link2, Copy, Power, PowerOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StringKey } from "@/lib/i18n";

const PERM_KEYS: { key: keyof Permissions; label: StringKey }[] = [
  { key: "canManageUsers", label: "permManageUsers" },
  { key: "canViewAllSpecialties", label: "permViewAllSpecialties" },
  { key: "canViewPrices", label: "permViewPrices" },
  { key: "canEditPrices", label: "permEditPrices" },
  { key: "canAudit", label: "permAudit" },
];

function CompanyEmployeePermissions({ t }: { t: (k: StringKey) => string }) {
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const updatePerm = useMutation({
    mutationFn: async ({ userId, permKey, value }: { userId: number; permKey: string; value: boolean }) => {
      await apiRequest("PATCH", `/api/admin/users/${userId}/permissions`, { [permKey]: value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      toast({ title: t("companyPermUpdated") });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-company-permissions">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-muted-foreground" />
          {t("companyPermissions")}
        </CardTitle>
        <CardDescription>{t("companyPermissionsDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {employees.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4" data-testid="text-no-employees">
            {t("noEmployees")}
          </p>
        ) : (
          employees.map((emp: any) => {
            const perms: Permissions = emp.permissions;
            return (
              <div key={emp.id} className="border rounded-md p-4 space-y-3" data-testid={`company-member-${emp.id}`}>
                <span className="text-sm font-medium block">{emp.username}</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {PERM_KEYS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Switch
                        checked={!!perms[key]}
                        onCheckedChange={(checked) =>
                          updatePerm.mutate({ userId: emp.id, permKey: key, value: checked })
                        }
                        data-testid={`switch-company-${key}-${emp.id}`}
                      />
                      <span className="text-muted-foreground">{t(label)}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function UserSpecialtyEditor({ userId, username, t }: { userId: number; username: string; t: (k: StringKey) => string }) {
  const { toast } = useToast();
  const { data: allSpecialties = [] } = useQuery<Specialty[]>({ queryKey: ["/api/specialties"] });
  const { data: trades = [] } = useQuery<Trade[]>({ queryKey: ["/api/trades"] });
  const { data: userSpecs = [], isLoading } = useQuery<Specialty[]>({
    queryKey: ["/api/admin/users", userId, "specialties"],
  });

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (userSpecs.length > 0 && !initialized) {
      setSelected(new Set(userSpecs.map(s => s.id)));
      setInitialized(true);
    }
  }, [userSpecs, initialized]);

  useEffect(() => {
    setInitialized(false);
  }, [userId]);

  const saveMutation = useMutation({
    mutationFn: async (specialtyIds: number[]) => {
      await apiRequest("PUT", `/api/admin/users/${userId}/specialties`, { specialtyIds });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", userId, "specialties"] });
      toast({ title: t("specialtiesUpdated") });
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

  const handleSave = () => {
    if (selected.size === 0) return;
    saveMutation.mutate(Array.from(selected));
  };

  const tradeMap = new Map<number, Trade>();
  trades.forEach(tr => tradeMap.set(tr.id, tr));

  const grouped = new Map<number, { trade: Trade; specs: Specialty[] }>();
  allSpecialties.forEach(sp => {
    if (!grouped.has(sp.tradeId)) {
      const trade = tradeMap.get(sp.tradeId);
      if (trade) grouped.set(sp.tradeId, { trade, specs: [] });
    }
    grouped.get(sp.tradeId)?.specs.push(sp);
  });

  if (isLoading) return <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />;

  return (
    <div className="border rounded-md p-4 space-y-3" data-testid={`specialty-editor-${userId}`}>
      <span className="text-sm font-medium block">{username}</span>
      {Array.from(grouped.values()).map(({ trade, specs }) => (
        <div key={trade.id} className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{trade.name}</span>
          <div className="flex flex-wrap gap-1.5">
            {specs.map(sp => {
              const isSelected = selected.has(sp.id);
              return (
                <Button
                  key={sp.id}
                  type="button"
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  data-testid={`button-spec-${userId}-${sp.slug}`}
                  onClick={() => toggle(sp.id)}
                  className={`toggle-elevate ${isSelected ? "toggle-elevated" : ""}`}
                >
                  {isSelected && <Check className="w-3 h-3" />}
                  {sp.name}
                </Button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <Button
          size="sm"
          disabled={selected.size === 0 || saveMutation.isPending}
          onClick={handleSave}
          data-testid={`button-save-specs-${userId}`}
        >
          {saveMutation.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />}
          {saveMutation.isPending ? t("saving") : t("saveChanges")}
        </Button>
      </div>
    </div>
  );
}

function ManageSpecialties({ t }: { t: (k: StringKey) => string }) {
  const { data: employees = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const { user } = useAuth();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const allMembers = user ? [{ id: user.id, username: user.username }, ...employees.filter(e => e.id !== user.id)] : employees;

  return (
    <Card data-testid="card-manage-specialties">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="w-5 h-5 text-muted-foreground" />
          {t("manageSpecialties")}
        </CardTitle>
        <CardDescription>{t("manageSpecialtiesDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {allMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("noEmployees")}</p>
        ) : (
          allMembers.map((emp: any) => (
            <UserSpecialtyEditor key={emp.id} userId={emp.id} username={emp.username} t={t} />
          ))
        )}
      </CardContent>
    </Card>
  );
}

function EmployeeManagement({ locale }: { locale: string }) {
  const { toast } = useToast();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteRole, setInviteRole] = useState("USER");
  const [inviteLink, setInviteLink] = useState("");

  const { data: employees = [], isLoading: loadingEmployees } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  const { data: inviteTokens = [], isLoading: loadingTokens } = useQuery<any[]>({
    queryKey: ["/api/invite/list"],
  });

  const toggleActive = useMutation({
    mutationFn: async ({ userId, isActive }: { userId: number; isActive: boolean }) => {
      await apiRequest("PUT", `/api/employees/${userId}/active`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: locale === "pt" ? "Status atualizado" : "Status updated" });
    },
  });

  const generateInvite = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/invite/create", { role: inviteRole, expiresDays: 7 });
      return res.json();
    },
    onSuccess: (data: any) => {
      const link = `${window.location.origin}/signup/${data.token}`;
      setInviteLink(link);
      queryClient.invalidateQueries({ queryKey: ["/api/invite/list"] });
      toast({ title: locale === "pt" ? "Link gerado" : "Link generated" });
    },
  });

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast({ title: locale === "pt" ? "Link copiado" : "Link copied" });
  };

  const getTokenStatus = (token: any) => {
    if (token.usedByUserId) return locale === "pt" ? "Usado" : "Used";
    if (token.expiresAt && new Date(token.expiresAt) < new Date()) return locale === "pt" ? "Expirado" : "Expired";
    return locale === "pt" ? "Ativo" : "Active";
  };

  if (loadingEmployees) {
    return (
      <Card>
        <CardContent className="flex justify-center p-8">
          <Loader2 className="animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-employee-management">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-muted-foreground" />
          {locale === "pt" ? "Gerenciar Funcionarios" : "Employee Management"}
        </CardTitle>
        <CardDescription>
          {locale === "pt" ? "Convide novos funcionarios e gerencie a equipe." : "Invite new employees and manage your team."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h3 className="text-sm font-medium">
              {locale === "pt" ? "Funcionarios" : "Employees"}
            </h3>
            <Button
              size="sm"
              variant={showInviteForm ? "secondary" : "default"}
              onClick={() => { setShowInviteForm(!showInviteForm); setInviteLink(""); }}
              data-testid="button-invite-employee"
            >
              <UserPlus className="w-4 h-4 mr-1.5" />
              {locale === "pt" ? "Convidar Funcionario" : "Invite Employee"}
            </Button>
          </div>

          {showInviteForm && (
            <div className="border rounded-md p-4 space-y-3">
              <div className="flex items-end gap-2 flex-wrap">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">
                    {locale === "pt" ? "Cargo" : "Role"}
                  </label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="w-[140px]" data-testid="select-invite-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">{locale === "pt" ? "Usuario" : "User"}</SelectItem>
                      <SelectItem value="ADMIN">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="default"
                  onClick={() => generateInvite.mutate()}
                  disabled={generateInvite.isPending}
                  data-testid="button-generate-invite"
                >
                  {generateInvite.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  <Link2 className="w-4 h-4 mr-1.5" />
                  {locale === "pt" ? "Gerar Link" : "Generate Link"}
                </Button>
              </div>
              {inviteLink && (
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={inviteLink}
                    className="flex-1 text-xs"
                    data-testid="input-invite-link"
                  />
                  <Button size="icon" variant="outline" onClick={copyLink} data-testid="button-copy-invite">
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {employees.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {locale === "pt" ? "Nenhum funcionario ainda." : "No employees yet."}
            </p>
          ) : (
            <div className="space-y-2">
              {employees.map((emp: any) => (
                <div
                  key={emp.id}
                  className="border rounded-md p-3 flex items-center justify-between gap-2 flex-wrap"
                  data-testid={`employee-row-${emp.id}`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium" data-testid={`text-employee-username-${emp.id}`}>{emp.username}</span>
                    <span className="text-xs text-muted-foreground" data-testid={`text-employee-role-${emp.id}`}>{emp.role}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs ${emp.isActive !== false ? "text-green-600" : "text-muted-foreground"}`} data-testid={`text-employee-status-${emp.id}`}>
                      {emp.isActive !== false
                        ? (locale === "pt" ? "Ativo" : "Active")
                        : (locale === "pt" ? "Inativo" : "Inactive")}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleActive.mutate({ userId: emp.id, isActive: emp.isActive === false })}
                      data-testid={`button-toggle-employee-${emp.id}`}
                    >
                      {emp.isActive !== false ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loadingTokens && inviteTokens.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium">
              {locale === "pt" ? "Convites" : "Invitations"}
            </h3>
            {inviteTokens.map((token: any, idx: number) => (
              <div
                key={token.id || idx}
                className="border rounded-md p-3 flex items-center justify-between gap-2 flex-wrap"
                data-testid={`invite-token-${token.id || idx}`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-xs font-mono text-muted-foreground">{token.token?.slice(0, 12)}...</span>
                  <span className="text-xs text-muted-foreground">{token.role}</span>
                </div>
                <span className={`text-xs font-medium ${
                  getTokenStatus(token) === "Active" || getTokenStatus(token) === "Ativo"
                    ? "text-green-600"
                    : getTokenStatus(token) === "Used" || getTokenStatus(token) === "Usado"
                    ? "text-blue-600"
                    : "text-muted-foreground"
                }`} data-testid={`text-token-status-${token.id || idx}`}>
                  {getTokenStatus(token)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SettingsForm() {
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { locale, setLocale, t } = useLocale();
  const { isAdminOrOwner } = useAuth();
  const { data: regions } = useRegions();

  const form = useForm<InsertCompanySettings>({
    resolver: zodResolver(insertCompanySettingsSchema),
    defaultValues: {
      taxRate: "0",
      overheadRate: "0",
      profitRate: "0",
      regionId: undefined,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        companyId: settings.companyId,
        taxRate: settings.taxRate?.toString() || "0",
        overheadRate: settings.overheadRate?.toString() || "0",
        profitRate: settings.profitRate?.toString() || "0",
        defaultLanguage: settings.defaultLanguage || "en",
        theme: settings.theme || "premium_dark",
        regionId: (settings as any).regionId || undefined,
      });
    }
  }, [settings, form]);

  const onSubmit = (data: InsertCompanySettings) => {
    updateSettings.mutate(data);
  };

  if (isLoading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" data-testid="text-settings-title">{t("settings")}</h1>
        <p className="text-muted-foreground mt-1">{t("configureDefaults")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("interfaceLanguage")}</CardTitle>
          <CardDescription>{t("interfaceLanguageDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={locale === "en" ? "default" : "outline"}
              onClick={() => setLocale("en")}
              data-testid="button-lang-en"
            >
              EN
            </Button>
            <Button
              type="button"
              variant={locale === "pt" ? "default" : "outline"}
              onClick={() => setLocale("pt")}
              data-testid="button-lang-pt"
            >
              PT
            </Button>
          </div>
        </CardContent>
      </Card>

      {isAdminOrOwner && regions && regions.length > 0 && (
        <Card data-testid="card-region-pricing">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              {t("regionPricing")}
            </CardTitle>
            <CardDescription>{t("regionPricingDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="regionId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("region")}</FormLabel>
                      <Select
                        value={field.value?.toString() || ""}
                        onValueChange={(v) => field.onChange(v ? parseInt(v) : undefined)}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-region">
                            <SelectValue placeholder={t("selectRegion")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {regions.map((r: any) => (
                            <SelectItem key={r.id} value={r.id.toString()}>
                              {r.name} ({r.code})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>{t("regionDescription")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={updateSettings.isPending} data-testid="button-save-region">
                    {updateSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t("saveChanges")}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {isAdminOrOwner && <ManageSpecialties t={t} />}

      {isAdminOrOwner && <EmployeeManagement locale={locale} />}

      {isAdminOrOwner && <CompanyEmployeePermissions t={t} />}

      {isAdminOrOwner && (
        <Card>
          <CardHeader>
            <CardTitle>{t("generalConfiguration")}</CardTitle>
            <CardDescription>{t("settingsApplyDefault")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="taxRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("defaultTaxRate")}</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} value={field.value ?? ""} data-testid="input-tax-rate" />
                      </FormControl>
                      <FormDescription>{t("taxRateDescription")}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="overheadRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("overheadRate" as any) || "Overhead Rate (%)"}</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} value={field.value ?? ""} data-testid="input-overhead-rate" />
                      </FormControl>
                      <FormDescription>{t("overheadRateDescription" as any) || "Applied to subtotal for overhead costs"}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="profitRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("profitRate" as any) || "Profit Rate (%)"}</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} value={field.value ?? ""} data-testid="input-profit-rate" />
                      </FormControl>
                      <FormDescription>{t("profitRateDescription" as any) || "Profit margin percentage"}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end pt-4">
                  <Button type="submit" disabled={updateSettings.isPending} data-testid="button-save-settings">
                    {updateSettings.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {t("saveChanges")}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Settings() {
  return <SettingsForm />;
}
