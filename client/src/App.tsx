import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Navigation } from "@/components/Navigation";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { LocaleContext, useLocaleState } from "@/hooks/use-locale";

import Dashboard from "@/pages/Dashboard";
import JobEditor from "@/pages/JobEditor";
import Stairs from "@/pages/Stairs";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import OnboardingSpecialties from "@/pages/OnboardingSpecialties";
import SupportPanel from "@/pages/SupportPanel";
import PhotoEstimate from "@/pages/PhotoEstimate";
import InviteSignup from "@/pages/InviteSignup";
import Schedule from "@/pages/Schedule";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/jobs/:id" component={JobEditor} />
      <Route path="/stairs" component={Stairs} />
      <Route path="/photo-estimate" component={PhotoEstimate} />
      <Route path="/settings" component={Settings} />
      <Route path="/schedule" component={Schedule} />
      <Route path="/support" component={SupportPanel} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { user, isLoading, isAuthenticated, needsOnboarding } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  if (needsOnboarding) {
    return <OnboardingSpecialties />;
  }

  return (
    <div className="min-h-screen bg-background font-sans" style={{ paddingTop: "var(--safe-top)" }}>
      <Navigation />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-5 pb-24 sm:pb-6">
        <Router />
      </main>
    </div>
  );
}

function AppRouter() {
  const [location] = useLocation();
  if (location.startsWith("/signup/")) {
    return <InviteSignup />;
  }
  return <AuthenticatedApp />;
}

function App() {
  const localeState = useLocaleState();

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LocaleContext.Provider value={localeState}>
          <AppRouter />
          <Toaster />
        </LocaleContext.Provider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
