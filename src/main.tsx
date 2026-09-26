import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.tsx";
// Archivo carries the width axis, which is what gives the headings and the
// money their broadcast-scoreboard stance. Instrument Sans reads the running
// text. Both replace Inter and JetBrains Mono, whose typewriter figures were
// what made the numbers look like a terminal printout.
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/instrument-sans/600.css";
import "@fontsource/instrument-sans/700.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>,
);
