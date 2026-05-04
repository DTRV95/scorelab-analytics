import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  ScoreLabDataContext,
  loadCoreScoreLabData,
  type ScoreLabDataContextValue,
} from "@/contexts/scoreLabDataCore";
import {
  ANALYSES_UPDATED_EVENT,
} from "@/lib/analysisStorage";
import {
  MULTIPLES_UPDATED_EVENT,
} from "@/lib/multipleStorage";

export function ScoreLabDataProvider({ children }: { children: ReactNode }) {
  const [coreData, setCoreData] = useState(loadCoreScoreLabData);
  const [dataVersion, setDataVersion] = useState(0);

  const refresh = () => {
    setCoreData(loadCoreScoreLabData());
    setDataVersion((version) => version + 1);
  };

  useEffect(() => {
    let refreshTimeout: number | null = null;

    const scheduleRefresh = () => {
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
      }

      refreshTimeout = window.setTimeout(() => {
        setCoreData(loadCoreScoreLabData());
        setDataVersion((version) => version + 1);
        refreshTimeout = null;
      }, 80);
    };

    window.addEventListener(ANALYSES_UPDATED_EVENT, scheduleRefresh);
    window.addEventListener(MULTIPLES_UPDATED_EVENT, scheduleRefresh);
    window.addEventListener("scorelab:persistence-hydrated", scheduleRefresh);
    window.addEventListener("storage", scheduleRefresh);
    window.addEventListener("focus", scheduleRefresh);

    return () => {
      window.removeEventListener(ANALYSES_UPDATED_EVENT, scheduleRefresh);
      window.removeEventListener(MULTIPLES_UPDATED_EVENT, scheduleRefresh);
      window.removeEventListener("scorelab:persistence-hydrated", scheduleRefresh);
      window.removeEventListener("storage", scheduleRefresh);
      window.removeEventListener("focus", scheduleRefresh);
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
      }
    };
  }, []);

  const value = useMemo<ScoreLabDataContextValue>(
    () => ({
      ...coreData,
      dataVersion,
      refresh,
    }),
    [coreData, dataVersion]
  );

  return (
    <ScoreLabDataContext.Provider value={value}>
      {children}
    </ScoreLabDataContext.Provider>
  );
}
