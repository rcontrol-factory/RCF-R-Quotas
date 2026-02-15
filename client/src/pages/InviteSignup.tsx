import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { UserPlus, Building, Loader2, AlertTriangle } from "lucide-react";

export default function InviteSignup() {
  const [, params] = useRoute("/signup/:token");
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const token = params?.token ?? "";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { data: invite, isLoading, isError, error } = useQuery<{ companyName: string }>({
    queryKey: ["/api/invite/validate", token],
    queryFn: async () => {
      const res = await fetch(`/api/invite/validate/${token}`, { credentials: "include" });
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(text);
      }
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const signup = useMutation({
    mutationFn: async (data: { username: string; password: string }) => {
      const res = await apiRequest("POST", `/api/invite/signup/${token}`, data);
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/auth/me"], user);
      toast({ title: "Account created successfully" });
      if (user?.needsOnboarding) {
        setLocation("/onboarding");
      } else {
        setLocation("/");
      }
    },
    onError: (err: Error) => {
      toast({ title: "Signup failed", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    signup.mutate({ username, password });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Validating invite...</p>
        </div>
      </div>
    );
  }

  if (isError || !invite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-[380px]">
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertTriangle className="w-10 h-10 text-destructive" />
                <p className="text-sm text-destructive" data-testid="text-invite-error">
                  {error instanceof Error ? error.message : "This invite link is invalid or has expired."}
                </p>
                <a href="/login" className="text-sm text-primary underline" data-testid="link-back-login">
                  Back to Login
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-[380px]">
        <Card className="shadow-lg">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <UserPlus className="w-6 h-6 text-primary" />
              <CardTitle className="text-lg">Create Your Account</CardTitle>
            </div>
            <div className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground">
              <Building className="w-4 h-4" />
              <span data-testid="text-company-name">{invite.companyName}</span>
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-4">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-username" className="text-[13px]">Username</Label>
                <Input
                  id="signup-username"
                  data-testid="input-signup-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username"
                  autoComplete="username"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signup-password" className="text-[13px]">Password</Label>
                <Input
                  id="signup-password"
                  data-testid="input-signup-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Choose a password"
                  autoComplete="new-password"
                />
              </div>
              <Button
                type="submit"
                data-testid="button-signup-submit"
                disabled={signup.isPending || !username || !password}
                className="w-full mt-1"
              >
                {signup.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Create Account"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
