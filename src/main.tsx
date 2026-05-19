import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isTtsRelatedErrorMessage } from "@/lib/tts";

window.addEventListener("unhandledrejection", (event) => {
  if (isTtsRelatedErrorMessage(event.reason)) {
    console.error("[TTS] swallowed unhandled rejection:", event.reason);
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
