import React, { useState, useEffect, useRef } from "react";
import "../Style/index.css";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Sidebar from "../Components/Sidebar";
import StatusCard from "../Components/StatusCard";
import "../Style/StatusCard.css";

const API_URL = import.meta.env.VITE_API_URL;

function Home() {
  const [date, setDate] = useState(new Date()); // shown month in the datepicker
  const [logs, setLogs] = useState({}); // grouped logs object keyed by baseEndpoint
  const [loading, setLoading] = useState(false);

  // To prevent the [date] effect from firing on initial mount (we call fetch once manually)
  const initialRenderRef = useRef(true);

  // Ref to store multiple container refs (for horizontal scrolling)
  const containerRefs = useRef({});

  /**
   * Fetch grouped logs for a given date.
   *
   * @param {Date} selectedDate - JS Date object representing month/year to request
   * @param {boolean} isInitialLoad - true for the initial app load (allow backend fallback),
   *                                 false for user-initiated selection (do NOT accept fallback)
   */
  const fetchLogs = async (selectedDate, isInitialLoad = false) => {
    const requestedYear = selectedDate.getFullYear();
    const requestedMonth = selectedDate.getMonth() + 1; // 1..12

    const yearStr = String(requestedYear);
    const monthStr = String(requestedMonth).padStart(2, "0");

    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/logs/time?year=${yearStr}&month=${monthStr}`
      );

      // If backend returns non-JSON (error), this will throw
      const data = await res.json();

      // If backend returns `year` and `month` that it actually used (when it fell back),
      // interpret that. Otherwise fallbackInfo will be null.
      const returnedYear = data && data.year ? Number(data.year) : null;
      const returnedMonth = data && data.month ? Number(data.month) : null;

      const grouped = data && data.data ? data.data : {};

      // CASES:
      // 1) isInitialLoad === true:
      //    - Accept backend fallback: update date (if backend returned a different month),
      //      and set logs to whatever backend returned.
      // 2) isInitialLoad === false (user selected a month):
      //    - If backend returned a different month (i.e. it fell back), IGNORE its fallback:
      //      treat as "no data for this month" -> setLogs({}) so the UI shows the "No data" message.
      //    - Otherwise (backend returned the same requested month or no fallback info),
      //      accept the grouped logs (may be empty).
      if (isInitialLoad) {
        // Accept whatever backend returned (including fallback)
        setLogs(grouped || {});
        if (returnedYear && returnedMonth) {
          // If backend used a different month, reflect that in the datepicker
          if (
            returnedYear !== requestedYear ||
            returnedMonth !== requestedMonth
          ) {
            setDate(new Date(returnedYear, returnedMonth - 1, 1));
          }
        }
      } else {
        // User-initiated selection -> do NOT accept backend fallback
        if (
          returnedYear !== null &&
          returnedMonth !== null &&
          (returnedYear !== requestedYear || returnedMonth !== requestedMonth)
        ) {
          // Backend fell back to a different month — ignore it for user selection.
          // Show "No data for this month."
          setLogs({});
        } else {
          // Either backend didn't fallback or it returned the same month.
          setLogs(grouped || {});
        }
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      // Consider showing an error state in the UI; for now we clear logs
      setLogs({});
    } finally {
      setLoading(false);
    }
  };

  // Run ONCE on page load: allow backend to fallback to latest month with data
  useEffect(() => {
    fetchLogs(date, true).finally(() => {
      initialRenderRef.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Runs when user changes date from DatePicker (explicit user selection)
  // We skip the first automatic mount (handled above) using initialRenderRef
  useEffect(() => {
    if (initialRenderRef.current) {
      // skip — initial load already handled
      return;
    }
    // User changed the date -> do NOT accept backend fallback
    fetchLogs(date, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // When logs update, scroll each container to the end (latest messages to the right)
  useEffect(() => {
    Object.keys(containerRefs.current).forEach((key) => {
      const container = containerRefs.current[key];
      if (container) {
        container.scrollLeft = container.scrollWidth;
      }
    });
  }, [logs]);

  // Convert status to an icon (✔ for 2xx, ❌ otherwise)
  const getStatusIcon = (status) => {
    if (status === undefined || status === null) return "";
    const s = Number(status);
    if (!Number.isFinite(s)) return "";
    if (s >= 200 && s < 300) return "✔️";
    return "❌";
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <p className="heading">Home</p>

        <div className="calendar-card">
          <label className="calendar-label">
            System Status &nbsp;:&nbsp;&nbsp;&lt;&nbsp;
          </label>

          <DatePicker
            selected={date}
            onChange={(d) => {
              // When user selects a different month, setDate -> triggers fetchLogs(date,false)
              setDate(d);
            }}
            dateFormat="MMM yyyy"
            showMonthYearPicker
            className="month-picker"
          />

          <span>&nbsp;&gt;</span>
        </div>

        <div className="display">
          {loading ? (
            <p>Loading...</p>
          ) : Object.keys(logs).length === 0 ||
            Object.values(logs).every((arr) => arr.length === 0) ? (
            // This message will show when the selected month has no logs.
            <p>No data for this month.</p>
          ) : (
            <div>
              {Object.keys(logs).map((baseEndpoint) => (
                <div key={baseEndpoint} className="status-container-wrapper">
                  <p className="date-heading">{baseEndpoint}</p>

                  <div
                    className="status-container"
                    // store a ref per endpoint so we can scroll to end when logs change
                    ref={(el) => {
                      containerRefs.current[baseEndpoint] = el;
                    }}
                  >
                    {logs[baseEndpoint].map((log) => (
                      <StatusCard key={log.traceId + "-" + log.timestamp} log={log} />
                    ))}
                  </div>

                  {logs[baseEndpoint].length > 0 && (
                    <span className="status-icon">
                      {getStatusIcon(
                        logs[baseEndpoint][logs[baseEndpoint].length - 1].status
                      )}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
