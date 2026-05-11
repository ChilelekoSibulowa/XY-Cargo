import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";

interface FormCardProps {
  title?: string;
  subtitle?: string;
  backLink?: string;
  children: React.ReactNode;
  className?: string;
  onSubmit?: () => void;
  isLoading?: boolean;
  submitLabel?: string;
}

export const FormCard = ({
  title,
  subtitle,
  backLink,
  children,
  className,
  onSubmit,
  isLoading,
  submitLabel = "Save",
}: FormCardProps) => {
  return (
    <div className="space-y-4">
      {backLink && (
        <Link to={backLink} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
      )}
      <Card className={className}>
        {title && (
          <CardHeader>
            <CardTitle>{title}</CardTitle>
          </CardHeader>
        )}
        <CardContent className={title ? "" : "pt-6"}>
          <div className="space-y-6">
            {children}
            {onSubmit && (
              <div className="flex gap-3 pt-2">
                <Button onClick={onSubmit} disabled={isLoading} size="sm">
                  {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  {submitLabel}
                </Button>
                {backLink && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to={backLink}>Cancel</Link>
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
