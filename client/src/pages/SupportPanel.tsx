import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useLocale } from "@/hooks/use-locale";
import { useTrades, useSpecialties } from "@/hooks/use-catalog";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, Shield, User, KeyRound, PenLine, Power, PowerOff,
  Wrench, AlertTriangle, Check, X, Loader2, ShieldAlert,
  UserPlus, Link2, Copy,
} from "lucide-react";
import type { Permissions, Trade, Specialty } from "@shared/schema";

interface SupportUser {
  id: number;
  username: string;
  role: string;
  isActive: boolean;
  permissions: Permissions;
  specialtyIds: number[];
}

const PERM_LABELS: { key: keyof Permissions; en: string; pt: string }[] = [
  { key: "canManageUsers", en: "Manage Users", pt: "Gerenciar Usuarios" },
  { key: "canViewAllSpecialties", en: "View All Specialties", pt: "Ver Todas Especialidades" },
  { key: "canViewPrices", en: "View Prices", pt: "Ver Precos" },
  { key: "canEditPrices", en: "Edit Prices", pt: "Editar Precos" },
  { key: "canAudit", en: "Audit Log", pt: "Log de Auditoria" },
];

export default function SupportPanel() {
  const { t, locale } = useLocale();
  const { user: authUser, isAdminOrOwner, isSupport, isSupportAdmin } = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");
  const [foundUser, setFoundUser] = useState<SupportUser | null>(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);

  const [resetPw, setResetPw] = useState("");
  const [renameVal, setRenameVal] = useState("");
  const [editingSpecs, setEditingSpecs] = useState(false);
  const [selectedSpecs, setSelectedSpecs] = useState<Set<number>>(new Set());

  const [testUsername, setTestUsername] = useState("");
  const [testPassword, setTestPassword] = useState("");
  const [testRole, setTestRole] = useState("USER");

  const [signupRole, setSignupRole] = useState("USER");
  const [signupExpireDays, setSignupExpireDays] = useState("7");
  const [generatedLink, setGeneratedLink] = useState("");

  const { data: trades } = useTrades();
  const { data: allSpecialties } = useSpecialties();

  const carpentryTrade = trades?.find((tr: Trade) => tr.slug === "carpentry");
  const carpentrySpecialties = allSpecialties?.filter((s: Specialty) => carpentryTrade && s.tradeId === carpentryTrade.id) || [];

  const resetPasswordMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/support/reset-password", { userId: foundUser!.id, newPassword: resetPw });
    },
    onSuccess: () => {
      toast({ title: t("passwordResetSuccess") });
      setResetPw("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const renameMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/support/users/${foundUser!.id}/rename`, { newUsername: renameVal });
    },
    onSuccess: () => {
      toast({ title: t("renameSuccess") });
      if (foundUser) {
        setFoundUser({ ...foundUser, username: renameVal });
      }
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/support/users/${foundUser!.id}/active`, { isActive: !foundUser!.isActive });
    },
    onSuccess: () => {
      const newActive = !foundUser!.isActive;
      toast({ title: newActive ? t("activateSuccess") : t("deactivateSuccess") });
      setFoundUser({ ...foundUser!, isActive: newActive });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const saveSpecsMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("PUT", `/api/support/users/${foundUser!.id}/specialties`, { specialtyIds: Array.from(selectedSpecs) });
    },
    onSuccess: () => {
      toast({ title: t("specialtiesUpdated") });
      setFoundUser({ ...foundUser!, specialtyIds: Array.from(selectedSpecs) });
      setEditingSpecs(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const createTestUserMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/support/create-test-user", {
        username: testUsername,
        password: testPassword,
        role: testRole,
      });
    },
    onSuccess: () => {
      toast({ title: locale === "pt" ? "Usuario de teste criado" : "Test user created" });
      setTestUsername("");
      setTestPassword("");
      setTestRole("USER");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const generateSignupLinkMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/support/generate-signup-link", {
        role: signupRole,
        expiresDays: parseInt(signupExpireDays, 10) || 7,
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      const link = `${window.location.origin}/signup/${data.token}`;
      setGeneratedLink(link);
      toast({ title: locale === "pt" ? "Link gerado com sucesso" : "Link generated successfully" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(generatedLink);
      toast({ title: locale === "pt" ? "Link copiado" : "Link copied" });
    } catch {
      toast({ title: "Error", description: locale === "pt" ? "Falha ao copiar" : "Failed to copy", variant: "destructive" });
    }
  };

  const isAuthenticated = !!authUser;

  if (!isAuthenticated) {
    return (
      <div className="py-12 text-center" data-testid="support-access-denied">
        <ShieldAlert className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold text-foreground">{t("accessDenied")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t("adminOnly")}</p>
      </div>
    );
  }

  if (!isSupportAdmin) {
    return (
      <div className="py-12 text-center" data-testid="support-contact-admin">
        <Shield className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold text-foreground">
          {locale === "pt" ? "Contato de Suporte" : "Contact Support"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {locale === "pt" ? "Entre em contato com seu administrador para obter suporte." : "Contact your admin for support."}
        </p>
      </div>
    );
  }

  const handleSearch = async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    setSearchError("");
    setFoundUser(null);
    setEditingSpecs(false);
    try {
      const res = await fetch(`/api/support/users/search?username=${encodeURIComponent(q)}`, { credentials: "include" });
      if (res.status === 404) {
        setSearchError(t("userNotFound"));
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setSearchError(data.message || "Error");
        return;
      }
      const data: SupportUser = await res.json();
      setFoundUser(data);
      setRenameVal(data.username);
      setResetPw("");
      setSelectedSpecs(new Set(data.specialtyIds));
    } catch {
      setSearchError("Network error");
    } finally {
      setSearching(false);
    }
  };

  const toggleSpec = (specId: number) => {
    const next = new Set(selectedSpecs);
    if (next.has(specId)) {
      next.delete(specId);
    } else {
      next.add(specId);
    }
    setSelectedSpecs(next);
  };

  const getSpecName = (specId: number) => {
    const spec = allSpecialties?.find((s: Specialty) => s.id === specId);
    return spec?.name || `#${specId}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground" data-testid="text-support-title">
          {t("supportPanel")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-support-desc">
          {t("supportPanelDesc")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="w-4 h-4" />
            {t("searchByLogin")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              data-testid="input-search-user"
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="flex-1"
            />
            <Button
              data-testid="button-search-user"
              onClick={handleSearch}
              disabled={searching || !searchQuery.trim()}
            >
              {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
              {!searching && t("search")}
            </Button>
          </div>
          {searchError && (
            <div className="mt-3 flex items-center gap-2 text-sm text-destructive" data-testid="text-search-error">
              <AlertTriangle className="w-4 h-4" />
              {searchError}
            </div>
          )}
        </CardContent>
      </Card>

      {foundUser && (
        <Card data-testid="card-user-result">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="w-4 h-4" />
              {t("userInfo")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">{t("username")}</Label>
                <p className="font-medium text-foreground" data-testid="text-user-username">{foundUser.username}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("role")}</Label>
                <div className="mt-0.5">
                  <Badge variant={foundUser.role === "OWNER" ? "default" : "secondary"} data-testid="badge-user-role">
                    {foundUser.role === "OWNER" || foundUser.role === "ADMIN" ? (
                      <Shield className="w-3 h-3 mr-1" />
                    ) : null}
                    {foundUser.role}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">{t("statusLabel")}</Label>
                <div className="mt-0.5">
                  <Badge variant={foundUser.isActive ? "default" : "destructive"} data-testid="badge-user-status">
                    {foundUser.isActive ? t("activeStatus") : t("inactiveStatus")}
                  </Badge>
                </div>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">{t("permissions")}</Label>
              <div className="flex flex-wrap gap-2">
                {PERM_LABELS.map((p) => {
                  const val = foundUser.permissions[p.key];
                  return (
                    <Badge
                      key={p.key}
                      variant={val ? "default" : "outline"}
                      className={val ? "" : "opacity-50"}
                      data-testid={`badge-perm-${p.key}`}
                    >
                      {val ? <Check className="w-3 h-3 mr-1" /> : <X className="w-3 h-3 mr-1" />}
                      {locale === "pt" ? p.pt : p.en}
                    </Badge>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">{t("specialtiesLabel")}</Label>
              {foundUser.specialtyIds.length === 0 ? (
                <p className="text-sm text-muted-foreground" data-testid="text-no-specialties">{t("noSpecialties")}</p>
              ) : (
                <div className="flex flex-wrap gap-2" data-testid="list-specialties">
                  {foundUser.specialtyIds.map((id) => (
                    <Badge key={id} variant="secondary" data-testid={`badge-specialty-${id}`}>
                      {getSpecName(id)}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            <div>
              <Label className="text-xs text-muted-foreground mb-3 block">{t("actions")}</Label>
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                  <div className="flex-1 w-full">
                    <Label className="text-xs mb-1 block">{t("resetPassword")}</Label>
                    <Input
                      data-testid="input-reset-password"
                      type="password"
                      placeholder={t("newPassword")}
                      value={resetPw}
                      onChange={(e) => setResetPw(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="button-reset-password"
                    variant="destructive"
                    onClick={() => resetPasswordMutation.mutate()}
                    disabled={resetPw.length < 4 || resetPasswordMutation.isPending}
                  >
                    {resetPasswordMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
                    {t("confirmReset")}
                  </Button>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-end">
                  <div className="flex-1 w-full">
                    <Label className="text-xs mb-1 block">{t("renameUser")}</Label>
                    <Input
                      data-testid="input-rename-user"
                      placeholder={t("newUsername")}
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                    />
                  </div>
                  <Button
                    data-testid="button-rename-user"
                    onClick={() => renameMutation.mutate()}
                    disabled={renameVal.length < 2 || renameVal === foundUser.username || renameMutation.isPending}
                  >
                    {renameMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <PenLine className="w-4 h-4 mr-2" />}
                    {t("confirmRename")}
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    data-testid="button-toggle-active"
                    variant={foundUser.isActive ? "destructive" : "default"}
                    onClick={() => toggleActiveMutation.mutate()}
                    disabled={toggleActiveMutation.isPending || foundUser.id === authUser?.id}
                  >
                    {toggleActiveMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : foundUser.isActive ? (
                      <PowerOff className="w-4 h-4 mr-2" />
                    ) : (
                      <Power className="w-4 h-4 mr-2" />
                    )}
                    {foundUser.isActive ? t("deactivate") : t("activate")}
                  </Button>
                </div>

                <Separator />

                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Label className="text-xs text-muted-foreground">{t("editSpecialties")}</Label>
                    {!editingSpecs && (
                      <Button
                        data-testid="button-edit-specialties"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedSpecs(new Set(foundUser.specialtyIds));
                          setEditingSpecs(true);
                        }}
                      >
                        <Wrench className="w-3.5 h-3.5 mr-1.5" />
                        {t("editSpecialties")}
                      </Button>
                    )}
                  </div>
                  {editingSpecs && (
                    <div className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        {locale === "pt" ? "Selecione as especialidades de carpintaria:" : "Select carpentry specialties:"}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="grid-edit-specialties">
                        {carpentrySpecialties.map((spec: Specialty) => {
                          const active = selectedSpecs.has(spec.id);
                          return (
                            <Button
                              key={spec.id}
                              variant={active ? "default" : "outline"}
                              size="sm"
                              onClick={() => toggleSpec(spec.id)}
                              data-testid={`button-spec-${spec.slug}`}
                              className="justify-start"
                            >
                              {active ? <Check className="w-3.5 h-3.5 mr-1.5" /> : null}
                              {spec.name}
                            </Button>
                          );
                        })}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          data-testid="button-save-specialties"
                          onClick={() => saveSpecsMutation.mutate()}
                          disabled={saveSpecsMutation.isPending}
                        >
                          {saveSpecsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
                          {t("save")}
                        </Button>
                        <Button
                          data-testid="button-cancel-specialties"
                          variant="outline"
                          onClick={() => setEditingSpecs(false)}
                        >
                          {locale === "pt" ? "Cancelar" : "Cancel"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card data-testid="card-create-test-user">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4" />
            {locale === "pt" ? "Criar Usuario de Teste" : "Create Test User"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs mb-1 block">{t("username")}</Label>
              <Input
                data-testid="input-test-username"
                placeholder={locale === "pt" ? "Nome de usuario" : "Username"}
                value={testUsername}
                onChange={(e) => setTestUsername(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">{t("password")}</Label>
              <Input
                data-testid="input-test-password"
                type="password"
                placeholder={locale === "pt" ? "Senha" : "Password"}
                value={testPassword}
                onChange={(e) => setTestPassword(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs mb-1 block">{t("role")}</Label>
              <Select value={testRole} onValueChange={setTestRole}>
                <SelectTrigger data-testid="select-test-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">USER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="OWNER">OWNER</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            data-testid="button-create-test-user"
            onClick={() => createTestUserMutation.mutate()}
            disabled={testUsername.length < 2 || testPassword.length < 4 || createTestUserMutation.isPending}
          >
            {createTestUserMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
            {locale === "pt" ? "Criar Usuario" : "Create User"}
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-generate-signup-link">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="w-4 h-4" />
            {locale === "pt" ? "Gerar Link de Cadastro" : "Generate Signup Link"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs mb-1 block">{t("role")}</Label>
              <Select value={signupRole} onValueChange={setSignupRole}>
                <SelectTrigger data-testid="select-signup-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">USER</SelectItem>
                  <SelectItem value="ADMIN">ADMIN</SelectItem>
                  <SelectItem value="OWNER">OWNER</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">
                {locale === "pt" ? "Expira em (dias)" : "Expires in (days)"}
              </Label>
              <Input
                data-testid="input-signup-expire-days"
                type="number"
                min="1"
                max="365"
                value={signupExpireDays}
                onChange={(e) => setSignupExpireDays(e.target.value)}
              />
            </div>
          </div>
          <Button
            data-testid="button-generate-signup-link"
            onClick={() => generateSignupLinkMutation.mutate()}
            disabled={generateSignupLinkMutation.isPending}
          >
            {generateSignupLinkMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Link2 className="w-4 h-4 mr-2" />}
            {locale === "pt" ? "Gerar Link" : "Generate Link"}
          </Button>
          {generatedLink && (
            <div className="space-y-2" data-testid="container-generated-link">
              <Label className="text-xs text-muted-foreground block">
                {locale === "pt" ? "Link gerado:" : "Generated link:"}
              </Label>
              <div className="flex gap-2">
                <Input
                  data-testid="input-generated-link"
                  readOnly
                  value={generatedLink}
                  className="flex-1"
                />
                <Button
                  data-testid="button-copy-link"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyLink}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldAlert className="w-4 h-4" />
            {t("supportNoJobs")}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
