import { Metadata } from "next";
import InsightsContent from "./insights-content";

export const metadata: Metadata = {
  title: "Insights | State of Deep Tech",
  description:
    "Explore trends and patterns across 100+ deep tech reports. Analyze technology coverage, industry distribution, and geographic focus over time.",
};

export default function InsightsPage() {
  return <InsightsContent />;
}
