import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useCustomerRecord } from "@/hooks/useCustomerRecord";

export const CustomerProfileGate = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { customer, isLoading } = useCustomerRecord();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Loading</h1>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!customer && (
        <Card className="border-border/70 bg-card">
          <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">Complete your customer profile</p>
              <p className="text-xs text-muted-foreground">
                Add your phone, address, and preferred warehouse in Profile Management.
              </p>
            </div>
            <Button asChild>
              <a href="/customer/profile">Update Profile</a>
            </Button>
          </CardContent>
        </Card>
      )}
      {children}
    </div>
  );
};
