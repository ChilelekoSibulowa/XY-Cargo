import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";

const ReportPlaceholder = () => {
  const { reportId } = useParams();

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Report"

      />
      <FormCard>
        <p className="text-sm text-muted-foreground">
          This report is ready to be wired when data sources are confirmed.
        </p>
      </FormCard>
    </div>
  );
};

export default ReportPlaceholder;


