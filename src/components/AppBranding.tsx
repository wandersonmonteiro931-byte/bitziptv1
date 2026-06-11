import { useAppBranding } from "@/hooks/useAppBranding";
import { cn } from "@/lib/utils";

type AppBrandingProps = {
  className?: string;
  logoClassName?: string;
  textClassName?: string;
  showText?: boolean;
  showLogo?: boolean;
  size?: "sm" | "md" | "lg";
};

const SIZE_MAP = {
  sm: { logo: "h-8 w-8", text: "text-sm" },
  md: { logo: "h-10 w-10", text: "text-base" },
  lg: { logo: "h-16 w-16", text: "text-xl" },
};

export function AppBranding({
  className,
  logoClassName,
  textClassName,
  showText = true,
  showLogo = true,
  size = "md",
}: AppBrandingProps) {
  const branding = useAppBranding();
  const sizes = SIZE_MAP[size];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {showLogo && (
        <div
          className={cn(
            "overflow-hidden rounded-xl bg-muted flex items-center justify-center shrink-0",
            sizes.logo,
            logoClassName,
          )}
        >
          {branding.logoUrl ? (
            <img
              src={branding.logoUrl}
              alt={branding.appName}
              className="h-full w-full object-cover"
              loading="eager"
            />
          ) : (
            <span className="text-xs font-bold text-muted-foreground">
              {branding.appShortName?.slice(0, 2).toUpperCase() || "AP"}
            </span>
          )}
        </div>
      )}
      {showText && (
        <span className={cn("font-bold text-foreground truncate", sizes.text, textClassName)}>
          {branding.appName}
        </span>
      )}
    </div>
  );
}

export default AppBranding;
