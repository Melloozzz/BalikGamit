const TZ = "Asia/Manila";

/** September 26, 2026 */
export const longDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00+08:00` : iso).toLocaleDateString("en-US", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
  });

/** Sep 23, 2026 */
export const shortDate = (iso: string) =>
  new Date(iso.length === 10 ? `${iso}T00:00:00+08:00` : iso).toLocaleDateString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/** Oct 3, 10:22 AM */
export const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

/** October 2, 2026, 9:14 AM */
export const longDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    timeZone: TZ,
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export const timeOfDayGreeting = (d = new Date()) => {
  const h = Number(d.toLocaleString("en-US", { timeZone: TZ, hour: "numeric", hour12: false }));
  return h < 12 ? "Good Morning" : h < 18 ? "Good Afternoon" : "Good Evening";
};

export const todayIso = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
