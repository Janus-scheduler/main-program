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
  // We pass isSecure and isAuthenticated so the hook can fetch the correct data
  const manager = useSchedulerManager(
    handleHookError,
    isSecure,
    isAuthenticated,
  );

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
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
            display: "flex",
            gap: "12px",
            alignItems: "center",
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(12px)",
            padding: "8px 20px",
            borderRadius: "30px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            border: "1px solid rgba(255,255,255,0.4)",
            transition: "all 0.3s ease",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "14px", color: "#374151" }}>
            🛡️ Secure Sync
          </span>
          <button
            onClick={handleToggleSecurity}
            style={{
              background: isSecure ? "#10b981" : "#ef4444",
              color: "white",
              border: "none",
              padding: "6px 16px",
              borderRadius: "20px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "13px",
              letterSpacing: "0.5px",
              boxShadow: isSecure
                ? "0 4px 12px rgba(16, 185, 129, 0.3)"
                : "0 4px 12px rgba(239, 68, 68, 0.3)",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = isSecure
                ? "0 6px 16px rgba(16, 185, 129, 0.4)"
                : "0 6px 16px rgba(239, 68, 68, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = isSecure
                ? "0 4px 12px rgba(16, 185, 129, 0.3)"
                : "0 4px 12px rgba(239, 68, 68, 0.3)";
            }}
            onMouseDown={(e) =>
              (e.currentTarget.style.transform = "translateY(1px)")
            }
            onMouseUp={(e) =>
              (e.currentTarget.style.transform = "translateY(-1px)")
            }
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
