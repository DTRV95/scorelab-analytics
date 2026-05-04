import { useContext } from "react";
import { ScoreLabDataContext } from "@/contexts/scoreLabDataCore";

export function useScoreLabData() {
  const context = useContext(ScoreLabDataContext);

  if (!context) {
    throw new Error("useScoreLabData must be used within ScoreLabDataProvider");
  }

  return context;
}
