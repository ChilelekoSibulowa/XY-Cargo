import { PageHeader } from "@/components/shared/PageHeader";
import { FormCard } from "@/components/shared/FormCard";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const BackupDatabase = () => {
  const handleRequestBackup = () => {
    toast.message("Backup request queued. Use Supabase backups in Production for downloads.");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader title="Backup Database"  />
      <FormCard title="Backups">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Automated backups are managed in Supabase project settings. For production downloads,
            use Supabase backup exports or connect with a PostgreSQL client.
          </p>
          <p>
            You can request a manual backup as a reminder. This does not create a file automatically.
          </p>
        </div>
        <div className="mt-4">
          <Button onClick={handleRequestBackup}>Request Backup</Button>
        </div>
      </FormCard>
    </div>
  );
};

export default BackupDatabase;

