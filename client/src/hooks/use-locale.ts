import { createContext, useContext, useState, useCallback, useEffect } from "react";
import { t as translate, type Locale, type StringKey } from "@/lib/i18n";

interface LocaleContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: StringKey) => string;
}

export const LocaleContext = createContext<LocaleContextType>({
  locale: "en",
  setLocale: () => {},
  t: (key) => translate(key, "en"),
});

export function useLocaleState() {
  const [locale, setLocaleState] = useState<Locale>(() => {
    try {
      const stored = localStorage.getItem("rquotas-locale");
      if (stored === "pt" || stored === "en") return stored;
    } catch {}
    return "en";
  });

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem("rquotas-locale", newLocale);
    } catch {}
  }, []);

  const t = useCallback((key: StringKey) => translate(key, locale), [locale]);

  return { locale, setLocale, t };
}

export function useLocale() {
  return useContext(LocaleContext);
}
