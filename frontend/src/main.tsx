import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import GaleriDetail from "./pages/GaleriDetail";
import { I18nProvider } from "./i18n";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <I18nProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/galeri/:slug" element={<GaleriDetail />} />
        </Routes>
      </BrowserRouter>
    </I18nProvider>
  </React.StrictMode>,
);
