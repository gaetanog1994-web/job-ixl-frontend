import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import App from "./App";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { AuthProvider } from "./lib/AuthContext";
import { SidebarProvider } from "./lib/SidebarContext";
import { AvailabilityProvider } from "./lib/AvailabilityContext";
import GlobalSidebar from "./components/GlobalSidebar";

import "leaflet/dist/leaflet.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <SidebarProvider>
        <BrowserRouter>
          <AvailabilityProvider>
          {/* GlobalSidebar is mounted once at root level, works across all routes */}
          <GlobalSidebar />

          <Routes>
            {/* PUBLIC — no auth required */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/signup" element={<RegisterPage />} />

            {/* PRIVATE / APP */}
            <Route path="/*" element={<App />} />
          </Routes>
          </AvailabilityProvider>
        </BrowserRouter>
      </SidebarProvider>
    </AuthProvider>
  </React.StrictMode>
);
