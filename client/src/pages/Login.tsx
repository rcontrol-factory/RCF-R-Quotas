import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { RQuotasLogo } from "@/components/RQuotasLogo";
import { useLocale } from "@/hooks/use-locale";
import { getHeroDashboardImage } from "@/lib/trade-images";

export default function Login() {
  const { login } = useAuth();
  const { t } = useLocale();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    login.mutate(
      { username, password },
      {
        onError: () => {
          setError(t("invalidCredentials"));
        },
      }
    );
  };

  const heroImage = getHeroDashboardImage();

  return (
    <div className="min-h-screen flex flex-col safe-area bg-background">
      <div className="relative overflow-hidden">
        <div
          className="h-48 sm:h-56 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/60 to-black/80" />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
          <RQuotasLogo size={52} />
          <div className="flex flex-col items-center">
            <span className="font-bold text-xl tracking-tight text-white" data-testid="text-login-title">
              {t("appName")}
            </span>
            <span className="text-[11px] tracking-[0.2em] uppercase text-white/50 mt-1">
              {t("tagline")}
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 -mt-6 relative z-10">
        <div className="w-full max-w-[380px]">
          <Card className="shadow-lg">
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <h2 className="text-base font-semibold text-center text-foreground">
                  {t("signIn")}
                </h2>
                {error && (
                  <div className="text-[13px] text-center py-2.5 px-3 rounded-md bg-destructive/10 text-destructive" data-testid="text-login-error">
                    {error}
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-muted-foreground" htmlFor="username">
                    {t("username")}
                  </label>
                  <Input
                    id="username"
                    data-testid="input-username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t("enterUsername")}
                    autoComplete="username"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[13px] font-medium text-muted-foreground" htmlFor="password">
                    {t("password")}
                  </label>
                  <Input
                    id="password"
                    data-testid="input-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("enterPassword")}
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  data-testid="button-login"
                  disabled={login.isPending || !username || !password}
                  className="w-full mt-1"
                >
                  {login.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    t("signIn")
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
