import tradeFinish from "@/assets/images/trade-finish-new.jpg";
import tradeFrame from "@/assets/images/trade-frame-new.jpg";
import tradeRoof from "@/assets/images/trade-roof-new.jpg";
import tradeFloor from "@/assets/images/trade-floor-new.jpg";
import tradeTile from "@/assets/images/trade-tile-new.jpg";
import tradePainting from "@/assets/images/trade-painting-new.jpg";
import tradeHouseCleaning from "@/assets/images/trade-house-cleaning-new.jpg";
import tradeDeck from "@/assets/images/trade-deck-new.jpg";
import tradeStairs from "@/assets/images/trade-stairs-new.jpg";
import tradeDoors from "@/assets/images/trade-doors-new.jpg";
import tradeWindows from "@/assets/images/trade-windows-new.jpg";
import tradeCarpentry from "@/assets/images/trade-carpentry-new.jpg";
import heroDashboard from "@/assets/images/hero-dashboard.jpg";

const SPECIALTY_IMAGE_MAP: Record<string, string> = {
  finish: tradeFinish,
  framing: tradeFrame,
  roofing: tradeRoof,
  flooring: tradeFloor,
  deck: tradeDeck,
  stairs: tradeStairs,
  doors: tradeDoors,
  windows: tradeWindows,
  baseboard: tradeFinish,
  general: tradeHouseCleaning,
};

const TRADE_IMAGE_MAP: Record<string, string> = {
  carpentry: tradeCarpentry,
  painting: tradePainting,
  tile: tradeTile,
  house_cleaning: tradeHouseCleaning,
};

export function getTradeImage(tradeSlug?: string | null): string {
  if (!tradeSlug) return tradeCarpentry;
  return TRADE_IMAGE_MAP[tradeSlug] || tradeCarpentry;
}

export function getSpecialtyImage(specialtySlug?: string | null, tradeSlug?: string | null): string {
  if (specialtySlug && SPECIALTY_IMAGE_MAP[specialtySlug]) {
    return SPECIALTY_IMAGE_MAP[specialtySlug];
  }
  return getTradeImage(tradeSlug);
}

export function getHeroDashboardImage(): string {
  return heroDashboard;
}

export {
  tradeFinish,
  tradeFrame,
  tradeRoof,
  tradeFloor,
  tradeTile,
  tradePainting,
  tradeHouseCleaning,
  tradeDeck,
  tradeStairs,
  tradeDoors,
  tradeWindows,
  tradeCarpentry,
  heroDashboard,
};
