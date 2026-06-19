/** Session key used to restore mobile layout after Google OAuth (full page reload). */
export const MOBILE_OAUTH_KEY = "cq-mobile-oauth-return";

export type MobileOAuthState = {
  tab: "map" | "courts" | "active";
  sheet: "hidden" | "peek" | "open";
  forceMobile?: boolean;
};

export function saveMobileOAuthState(state: MobileOAuthState) {
  if (typeof window === "undefined" || window.innerWidth >= 768) return;
  sessionStorage.setItem(
    MOBILE_OAUTH_KEY,
    JSON.stringify({ ...state, forceMobile: true })
  );
}

export function consumeMobileOAuthState(): MobileOAuthState | null {
  if (typeof window === "undefined") return null;
  const raw = sessionStorage.getItem(MOBILE_OAUTH_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(MOBILE_OAUTH_KEY);
  try {
    return JSON.parse(raw) as MobileOAuthState;
  } catch {
    return null;
  }
}
