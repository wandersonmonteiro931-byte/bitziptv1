import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Block copy, paste, cut globally
document.addEventListener("copy", (e) => e.preventDefault());
document.addEventListener("cut", (e) => e.preventDefault());
document.addEventListener("paste", (e) => e.preventDefault());

// Block context menu (right-click)
document.addEventListener("contextmenu", (e) => e.preventDefault());

// Block print screen / screen recording attempts
document.addEventListener("keydown", (e) => {
  // PrintScreen
  if (e.key === "PrintScreen") {
    e.preventDefault();
  }
  // Ctrl+P (print)
  if ((e.ctrlKey || e.metaKey) && e.key === "p") {
    e.preventDefault();
  }
  // Ctrl+Shift+S (screenshot shortcuts)
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "s" || e.key === "S")) {
    e.preventDefault();
  }
  // Ctrl+C / Ctrl+X / Ctrl+V
  if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "x" || e.key === "v")) {
    e.preventDefault();
  }
});

// CSS-based screenshot protection on game pages
const style = document.createElement("style");
style.textContent = `
  @media print { body { display: none !important; } }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")!).render(<App />);
