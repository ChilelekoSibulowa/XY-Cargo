import { useParams } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";

const SettingsPlaceholder = () => {
  const { sectionId } = useParams();

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Settings"

      />
      <FormCard>
        <p className="text-sm text-muted-foreground">
          This settings module is queued for setup. Tell me what should be enabled here and I will wire it.
        </p>
      </FormCard>
    </div>
  );
};

export default SettingsPlaceholder;


