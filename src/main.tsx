import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.tsx";
// Duas letras, e o par é a ideia: o Archivo tem eixo de largura, e é dele
// que vem a postura de marcador de estádio nos títulos e no dinheiro; o
// Schibsted Grotesk lê o texto corrido. Ambos substituíram o Inter e o
// JetBrains Mono, cujas figuras de máquina de escrever faziam os números
// parecer a saída de um terminal.
//
// O corpo era Instrument Sans, que não tinha nada de errado além de não
// ter nada de seu: é a letra por omissão de metade das interfaces novas.
// O Schibsted foi desenhado para um jornal — aberturas largas, boa aos
// 11px — e é 4% mais largo, que foi medido antes de se trocar; o Chivo,
// o outro candidato, era 11% e partia a linha da liga e da hora.
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/schibsted-grotesk/wght.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>,
);
