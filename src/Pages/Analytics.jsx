// src/pages/Analytics.jsx
import React, { useEffect, useState, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import Sidebar from "../Components/Sidebar";
import "../Style/Analytics.css";
import StatCard from "../Components/StatCard";
import Chart from "../Components/Chart";
const API_URL = import.meta.env.VITE_API_URL;

function Analytics() {
  const [date, setDate] = useState(new Date());
  const [info, setInfo] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);

  const initialRenderRef = useRef(true);

  // Fetch analysis endpoint. Accept fallback only on initial load.
  const fetchInfo = async (selectedDate, isInitialLoad = false) => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/logs/analysis?year=${year}&month=${month}`);
      const data = await res.json();

      // If backend returned no year/month (no logs at all), set empty
      const returnedYear = data && data.year ? Number(data.year) : null;
      const returnedMonth = data && data.month ? Number(data.month) : null;
      const isFallback = !!data?.isFallback;

      // If initial load: accept fallback — update date & show returned data
      if (isInitialLoad) {
        if (returnedYear && returnedMonth) {
          // If backend used a different month, reflect in date picker
          if (returnedYear !== year || returnedMonth !== Number(month)) {
            setDate(new Date(returnedYear, returnedMonth - 1, 1));
          }
        }
        // Set info (may be null/empty if no logs)
        setInfo(data && (data.totalRequests !== undefined || data.uptimePercent !== undefined) ? data : null);
      } else {
        // User-initiated selection: DO NOT accept backend fallback
        if (isFallback && (returnedYear !== year || returnedMonth !== Number(month))) {
          // backend fell back: treat as "no data for this month"
          setInfo(null);
        } else {
          // backend returned data for requested month (or returned null explicitly)
          setInfo(data && (data.totalRequests !== undefined || data.uptimePercent !== undefined) ? data : null);
        }
      }
    } catch (err) {
      console.error("fetchInfo error:", err);
      setInfo(null);
    } finally {
      setLoading(false);
    }
  };

  // Fetch uptime/chart endpoint. Accept fallback only on initial load.
  const fetchChart = async (selectedDate, isInitialLoad = false) => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");

    try {
      const res = await fetch(`${API_URL}/api/logs/chart?year=${year}&month=${month}`);
      const data = await res.json(); // expects { data: [...], year, month, isFallback }

      const returnedYear = data && data.year ? Number(data.year) : null;
      const returnedMonth = data && data.month ? Number(data.month) : null;
      const isFallback = !!data?.isFallback;
      const payload = data && data.data ? data.data : [];

      if (isInitialLoad) {
        setChartData(Array.isArray(payload) ? payload : []);
        // date update handled in fetchInfo which is primary
      } else {
        if (isFallback && (returnedYear !== year || returnedMonth !== Number(month))) {
          // backend fell back for user selected month -> ignore fallback, show empty
          setChartData([]);
        } else {
          setChartData(Array.isArray(payload) ? payload : []);
        }
      }
    } catch (err) {
      console.error("fetchChart error:", err);
      setChartData([]);
    }
  };

  // Initial mount: accept fallback from backend
  useEffect(() => {
    (async () => {
      await Promise.all([fetchInfo(date, true), fetchChart(date, true)]);
      initialRenderRef.current = false;
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When user changes date: do NOT accept fallback
  useEffect(() => {
    if (initialRenderRef.current) return;
    (async () => {
      await Promise.all([fetchInfo(date, false), fetchChart(date, false)]);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const formatNumber = (num) => {
    if (num === null || num === undefined) return "-";
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    } else {
      return num.toString();
    }
  };

  return (
    <div className="app-container">
      <Sidebar />
      <div className="main-content">
        <p className="heading">Analysis</p>

        <div className="calendar-card">
          <label className="calendar-label">
            System Status &nbsp;:&nbsp;&nbsp;&lt;&nbsp;
          </label>
          <DatePicker
            selected={date}
            onChange={(d) => setDate(d)}
            dateFormat="MMM yyyy"
            showMonthYearPicker
            className="month-picker"
          />
          <span>&nbsp;&gt;</span>
        </div>

        {/* Dashboard Stats */}
        <div className="dashboard">
          {loading ? (
            <p>Loading...</p>
          ) : info ? (
            <>
              <StatCard
                title="Uptime (Per Month)"
                value={info?.uptimePercent || 0}
                displayText={`${Math.round(info?.uptimePercent * 10) / 10}%`}
                extra={
                  info?.lastErrorTimestamp
                    ? `Last downtime: ${new Date(
                        info.lastErrorTimestamp
                      ).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}`
                    : "Last downtime: -"
                }
                color="#00FFA3"
              />

              <StatCard
                title="Total Response Time"
                value={Math.min(info?.totalResponseTime || 0, 100)}
                displayText={
                  info?.totalResponseTime
                    ? `${formatNumber(Math.round(info.totalResponseTime * 10) / 10)} ms`
                    : "-"
                }
                extra={
                  info?.avgResponseTime
                    ? `Average Response Time: ${Math.round(info.avgResponseTime * 10) / 10} ms`
                    : "-"
                }
                color="#0080FF"
              />

              <StatCard
                title="Request Volume (Per Month)"
                value={Math.min((info?.totalRequests || 0) / 10, 100)}
                displayText={formatNumber(info?.totalRequests) ?? 0}
                extra={
                  info?.totalRequests
                    ? `Request per week :  ${Math.round(info.totalRequests / 4)} requests`
                    : "-"
                }
                color="#FFD700"
              />

              <StatCard
                title="Error Rate (Per Month)"
                value={info?.errorPercent || 0}
                displayText={`${Math.round(info?.errorPercent * 10) / 10}%`}
                extra={`Most common error: ${info?.maxErrorStatus?._id ?? "-"} (${info?.maxErrorStatus?.count ?? "-" } Times)`}
                color="#FF4C4C"
              />
            </>
          ) : (
            <p>No data available for selected month.</p>
          )}
        </div>

        {/* Chart Section */}
        <div className="chart-section">
          <h3 className="chart-sectionh3">Uptime Percentage Over Time</h3>
          <Chart data={chartData} />
        </div>
      </div>
    </div>
  );
}

export default Analytics;
