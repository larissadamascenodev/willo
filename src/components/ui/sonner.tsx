import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

/** App-wide toasts: graphite pill at the top, sized for phones. */
const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="dark"
      position="top-center"
      offset="calc(env(safe-area-inset-top, 0px) + 12px)"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:!rounded-[20px] group-[.toaster]:!border group-[.toaster]:!border-white/10 group-[.toaster]:!willo-glass-inset/95 group-[.toaster]:!px-4 group-[.toaster]:!py-3.5 group-[.toaster]:!text-[14px] group-[.toaster]:!font-medium group-[.toaster]:!text-white group-[.toaster]:!shadow-[0_18px_40px_-12px_rgba(0,0,0,0.8)] group-[.toaster]:backdrop-blur-xl",
          description: "group-[.toast]:!text-white/70",
          success: "[&_[data-icon]]:!text-willo-green",
          error: "[&_[data-icon]]:!text-red-400",
          warning: "[&_[data-icon]]:!text-amber-300",
          info: "[&_[data-icon]]:!text-sky-300",
          actionButton: "group-[.toast]:!rounded-full group-[.toast]:!bg-white group-[.toast]:!text-[#0B0B0B]",
          cancelButton: "group-[.toast]:!rounded-full group-[.toast]:!bg-white/10 group-[.toast]:!text-white",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
