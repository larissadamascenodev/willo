import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Reopening the app should land on the top of the screen, not halfway down where it
// was left. The browser restores the old offset before anything renders, which left
// the home screen's pinned header already blurred and faded, as if it had been
// scrolled past, the moment it appeared.
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

createRoot(document.getElementById("root")!).render(<App />);
