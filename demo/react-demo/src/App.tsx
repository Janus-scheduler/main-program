import { useState, useCallback } from "react";
import "./App.css";

import { Sidebar } from "./components/Sidebar";
import { SchedulerView } from "./components/SchedulerView";
import type { ViewType } from "@janus-scheduler/react";
import { ErrorToast } from "./components/ErrorToast";
import { useSchedulerManager } from "./hooks/useSchedulerManager";
import type { HookError } from "./hooks/useSchedulerManager";
import { secureApiClient } from "@janus-scheduler/core";

/**
 * App — root component and state coordinator.
 *
 * Owns three pieces of UI state:
 *  - currentView    : which Janus view is active (Timeline | Month)
 *  - showScheduler  : whether the event editor modal is open
 *  - hookError      : the last async hook failure (triggers ErrorToast)
 *
 * Data state (events, resources, assignments) lives in the Zustand store
 * managed by SchedulerManager — not in React state at all.
 */
function App() {
  const [currentView, setCurrentView] = useState<ViewType>("Month");
  const [showScheduler, setShowScheduler] = useState(false);
  const [hookError, setHookError] = useState<HookError | null>(null);
  // null = creating a new event; string = editing the event with this ID
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  // Security Toggle State
  const [isSecure, setIsSecure] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Auto-dismiss the error toast after 6 seconds
  const handleHookError = useCallback((err: HookError) => {
    setHookError(err);
    setTimeout(() => setHookError(null), 6000);
  }, []);

  // SchedulerManager is stable (created once via useMemo inside the hook)
  // We pass isSecure so the hook can use the correct fetch path
  const manager = useSchedulerManager(handleHookError, isSecure);

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError("");
    const formData = new FormData(e.currentTarget);
    const username = formData.get("username");
    const password = formData.get("password");

    try {
      const res = await fetch("http://localhost:3001/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) throw new Error("Invalid credentials");
      const data = await res.json();

      // Initialize the core package's secure client!
      secureApiClient.init(data.token, data.sharedSecret);
      setIsAuthenticated(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setLoginError(err.message);
    }
  };

  const handleToggleSecurity = () => {
    setIsSecure(!isSecure);
    // If turning off security, clear the login state for next time it's turned on
    if (isSecure) {
      secureApiClient.clear();
      setIsAuthenticated(false);
    }
  };

  return (
    <div className="app-shell">
      <Sidebar />

      <main className="app-main" style={{ position: "relative" }}>
        {/* Security Demonstration Toggle */}
        <div
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            zIndex: 100,
            display: "flex",
            gap: "10px",
            alignItems: "center",
            background: "#f8f9fa",
            padding: "8px 16px",
            borderRadius: "8px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          <span style={{ fontWeight: 600 }}>🛡️ Secure Sync:</span>
          <button
            onClick={handleToggleSecurity}
            style={{
              background: isSecure ? "#10b981" : "#ef4444",
              color: "white",
              border: "none",
              padding: "4px 12px",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            {isSecure ? "ON" : "OFF"}
          </button>
        </div>

        {/* Login Screen Overlay if Secure Mode is ON but not logged in */}
        {isSecure && !isAuthenticated ? (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                background: "white",
                padding: "32px",
                borderRadius: "8px",
                boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                width: "300px",
              }}
            >
              <h2 style={{ marginTop: 0, marginBottom: "16px" }}>
                Login to Secure Sync
              </h2>
              <p
                style={{
                  fontSize: "12px",
                  color: "#666",
                  marginBottom: "16px",
                }}
              >
                Use admin / password
              </p>
              <form
                onSubmit={handleLogin}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px",
                }}
              >
                <input
                  name="username"
                  type="text"
                  placeholder="Username"
                  defaultValue="admin"
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                  }}
                />
                <input
                  name="password"
                  type="password"
                  placeholder="Password"
                  defaultValue="password"
                  style={{
                    padding: "8px",
                    borderRadius: "4px",
                    border: "1px solid #ccc",
                  }}
                />
                {loginError && (
                  <div style={{ color: "red", fontSize: "12px" }}>
                    {loginError}
                  </div>
                )}
                <button
                  type="submit"
                  style={{
                    padding: "10px",
                    background: "#3b82f6",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  Authenticate
                </button>
              </form>
            </div>
          </div>
        ) : (
          <SchedulerView
            currentView={currentView}
            showScheduler={showScheduler}
            schedulerError={null}
            selectedEventId={selectedEventId}
            manager={manager}
            onViewChange={setCurrentView}
            onOpenScheduler={(eventId) => {
              setSelectedEventId(eventId ?? null);
              setShowScheduler(true);
            }}
            onCloseScheduler={() => {
              setShowScheduler(false);
              setSelectedEventId(null);
            }}
          />
        )}

        {hookError && (
          <ErrorToast
            operation={hookError.operation}
            message={hookError.message}
            onDismiss={() => setHookError(null)}
          />
        )}
      </main>
    </div>
  );
}

export default App;
