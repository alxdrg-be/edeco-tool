import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Toolbox from "./toolbox/Toolbox";
import "./styles.css";
import { applyTheme, loadTheme } from "./theme";

applyTheme(loadTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toolbox />
  </StrictMode>,
);
