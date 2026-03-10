import type { Metadata } from "next";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";

export const metadata: Metadata = { title: "Schedule" };

export default function SchedulePage() {
  return <ScheduleCalendar />;
}
