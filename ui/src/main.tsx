import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Toolbox from "./toolbox/Toolbox";
import "@fontsource-variable/inter";
import "./styles.css";
import "./toolbox/toolhub-theme.css";
import { applyTheme, loadTheme } from "./theme";

applyTheme(loadTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toolbox />
  </StrictMode>,
);
