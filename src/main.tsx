import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// O PWA não limpa cache, não desregistra Service Worker e não força
// recarregamentos durante a abertura. Isso evita ERR_FAILED ao abrir,
// atualizar ou iniciar o aplicativo instalado.

function isEditable(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  return false;
}

// Mantém a proteção já existente sem interferir em campos editáveis.
document.addEventListener("contextmenu", (event) => {
  if (!isEditable(event.target)) event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "PrintScreen") event.preventDefault();
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") event.preventDefault();
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "s") {
    event.preventDefault();
  }
});

const style = document.createElement("style");
style.textContent = "@media print { body { display: none !important; } }";
document.head.appendChild(style);

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Elemento #root não encontrado.");

createRoot(rootElement).render(<App />);
