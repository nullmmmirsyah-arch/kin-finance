import { SvgXml } from "react-native-svg";
import { getAccountIconName } from "@/constants/accountIcons";
import streamlineData from "@/constants/streamlineIconData.json";

const W = (streamlineData as { width: number }).width ?? 24;
const H = (streamlineData as { height: number }).height ?? 24;
const ICONS = (streamlineData as { icons: Record<string, { body: string }> }).icons;

function getBody(name: string) {
  return ICONS[name]?.body;
}

function resolve(type?: string | null) {
  return getAccountIconName(type ?? undefined);
}

export function AccountIcon({ type, size = 32 }: { type?: string | null; size?: number }) {
  const name = resolve(type);
  const body = getBody(name) ?? getBody("saving-bank-1");
  if (!body) return null;
  const xml = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-icon="${name}">${body}</svg>`;
  return <SvgXml xml={xml} width={size} height={size} />;
}

export function getAccountIconXml(type?: string | null) {
  const name = resolve(type);
  const body = getBody(name) ?? getBody("saving-bank-1") ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" data-icon="${name}">${body}</svg>`;
}
