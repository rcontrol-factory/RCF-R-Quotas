import { useQuery } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { Trade, Service, Specialty, Region, PricingRule } from "@shared/schema";

export function useTrades() {
  return useQuery<Trade[]>({
    queryKey: [api.trades.list.path],
    queryFn: async () => {
      const res = await fetch(api.trades.list.path);
      if (!res.ok) throw new Error("Failed to fetch trades");
      return res.json();
    },
  });
}

export function useSpecialties(tradeId?: number) {
  return useQuery<Specialty[]>({
    queryKey: [api.specialties.list.path, tradeId],
    queryFn: async () => {
      const url = tradeId
        ? buildUrl(api.specialties.byTrade.path, { tradeId })
        : api.specialties.list.path;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch specialties");
      return res.json();
    },
  });
}

export function useServices(tradeId?: number) {
  return useQuery<Service[]>({
    queryKey: [api.services.list.path, tradeId],
    queryFn: async () => {
      const url = tradeId
        ? buildUrl(api.services.byTrade.path, { tradeId })
        : api.services.list.path;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch services");
      return res.json();
    },
  });
}

export function useServicesBySpecialty(specialtyId?: number) {
  return useQuery<Service[]>({
    queryKey: [api.services.bySpecialty.path, specialtyId],
    queryFn: async () => {
      if (!specialtyId) return [];
      const url = buildUrl(api.services.bySpecialty.path, { specialtyId });
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch services by specialty");
      return res.json();
    },
    enabled: !!specialtyId,
  });
}

export function useRegions() {
  return useQuery<Region[]>({
    queryKey: [api.regions.list.path],
    queryFn: async () => {
      const res = await fetch(api.regions.list.path);
      if (!res.ok) throw new Error("Failed to fetch regions");
      return res.json();
    },
  });
}

export function usePricingRules(opts?: { regionId?: number; tradeId?: number; specialtyId?: number; unit?: string }) {
  const params = new URLSearchParams();
  if (opts?.regionId) params.set("regionId", String(opts.regionId));
  if (opts?.tradeId) params.set("tradeId", String(opts.tradeId));
  if (opts?.specialtyId) params.set("specialtyId", String(opts.specialtyId));
  if (opts?.unit) params.set("unit", opts.unit);
  const queryStr = params.toString();
  const url = queryStr ? `${api.pricingRules.list.path}?${queryStr}` : api.pricingRules.list.path;

  return useQuery<PricingRule[]>({
    queryKey: [api.pricingRules.list.path, opts?.regionId, opts?.tradeId, opts?.specialtyId, opts?.unit],
    queryFn: async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch pricing rules");
      return res.json();
    },
    enabled: !!(opts?.regionId && opts?.tradeId),
  });
}
