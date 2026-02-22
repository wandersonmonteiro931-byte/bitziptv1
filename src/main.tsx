import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Helper: check if the event target is an editable field
function isEditable(el: EventTarget | null): boolean {
  if (!el || !(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return true;
  if (el.isContentEditable) return true;
  return false;
}

// Block copy, paste, cut only outside editable fields
document.addEventListener("copy", (e) => { if (!isEditable(e.target)) e.preventDefault(); });
document.addEventListener("cut", (e) => { if (!isEditable(e.target)) e.preventDefault(); });
document.addEventListener("paste", (e) => { if (!isEditable(e.target)) e.preventDefault(); });

// Block context menu (right-click)
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Block print screen / screen recording attempts
document.addEventListener("keydown", (e) => {
  if (e.key === "PrintScreen") e.preventDefault();
  if ((e.ctrlKey || e.metaKey) && e.key === "p") e.preventDefault();
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "s" || e.key === "S")) e.preventDefault();
  // Block Ctrl+C/X/V only outside editable fields
  if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "x" || e.key === "v")) {
    if (!isEditable(e.target)) e.preventDefault();
  }
});

// CSS-based screenshot protection on game pages
const style = document.createElement("style");
style.textContent = `
  @media print { body { display: none !important; } }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(<App />);
