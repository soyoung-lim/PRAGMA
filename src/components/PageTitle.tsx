import { cn } from "@/lib/utils";

interface PageTitleProps {
  title: string;
  description?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

/**
 * Page-level title with a yellow (#FAD338) left accent bar.
 * Mirrors the dark-header accent pattern inside the page body
 * to anchor the page's primary visual hierarchy.
 */
export const PageTitle = ({ title, description, right, className }: PageTitleProps) => {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="flex items-stretch gap-3">
        <span
          aria-hidden
          className="mt-1 w-[5px] shrink-0 self-stretch rounded-sm bg-[#FAD338]"
        />
        <div>
          <h1 className="text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {right}
    </div>
  );
};

export default PageTitle;