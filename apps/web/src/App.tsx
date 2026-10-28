import { lazy, Suspense, useEffect, useState } from "react";
import { canonicalHash, parseRoute, type Route } from "./route.ts";
import { SitePages } from "./site.tsx";

// The dashboard and its data code load only when a dashboard or Brief route is opened. The landing and
// section pages ship without them, which keeps first paint and main-thread work small on phones.
const Dashboard = lazy(() => import("./dashboard.tsx").then((m) => ({ default: m.Dashboard })));

// One hash router for the whole site. Landing and section pages are static; the dashboard and the Brief share its state.
export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.hash));

  useEffect(() => {
    const onHash = () => {
      const legacy = canonicalHash(window.location.hash);
      if (legacy) window.location.replace(legacy);
      setRoute(parseRoute(window.location.hash));
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (route.kind === "site") return <SitePages page={route.page} />;
  return (
    <Suspense fallback={<p role="status" className="loading">Loading the dashboard…</p>}>
      <Dashboard brief={route.kind === "brief" ? route.scenario : null} />
    </Suspense>
  );
}
