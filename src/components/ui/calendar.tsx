import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/** Native-app-style month picker: dark surface, roomy cells, willo-green selected day. */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-1 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col",
        month: "space-y-3",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-[15px] font-bold text-white capitalize",
        nav: "space-x-1 flex items-center",
        nav_button: "h-8 w-8 flex items-center justify-center bg-white/[0.07] text-white/70 active:opacity-60 rounded-full transition-opacity",
        nav_button_previous: "absolute left-0",
        nav_button_next: "absolute right-0",
        table: "w-full border-collapse mt-1",
        head_row: "flex",
        head_cell: "text-white/35 rounded-md w-10 font-semibold text-[11px] uppercase",
        row: "flex w-full mt-1",
        cell: "h-10 w-10 text-center text-[14px] p-0 relative focus-within:relative focus-within:z-20",
        day: "h-10 w-10 p-0 font-medium text-[14px] text-white/85 aria-selected:opacity-100 rounded-full hover:bg-white/[0.08] active:scale-95 transition-transform",
        day_range_end: "day-range-end",
        day_selected: "bg-willo-green text-[#0B0B0B] hover:bg-willo-green hover:text-[#0B0B0B] focus:bg-willo-green focus:text-[#0B0B0B] font-bold",
        day_today: "border border-white/25 font-bold text-white",
        day_outside: "day-outside text-white/20 aria-selected:opacity-30",
        day_disabled: "text-white/15",
        day_range_middle: "aria-selected:bg-white/10 aria-selected:text-white",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
