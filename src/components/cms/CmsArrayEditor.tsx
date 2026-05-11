import { Button } from "@/components/ui/button";
import { Plus, Trash2, GripVertical } from "lucide-react";
import { CmsTextField } from "./CmsTextField";
import { CmsImageUpload } from "./CmsImageUpload";
import { Card, CardContent } from "@/components/ui/card";

interface CmsArrayEditorProps<T> {
  items: T[];
  onChange: (items: T[]) => void;
  renderFields: (
    item: T,
    index: number,
    updateItem: (field: keyof T, value: T[keyof T]) => void
  ) => React.ReactNode;
  defaultItem: T;
  addLabel?: string;
}

export function CmsArrayEditor<T extends Record<string, unknown>>({
  items,
  onChange,
  renderFields,
  defaultItem,
  addLabel = "Add Item",
}: CmsArrayEditorProps<T>) {
  const updateItem = (index: number, field: keyof T, value: T[keyof T]) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    onChange(newItems);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const addItem = () => {
    onChange([...items, { ...defaultItem }]);
  };

  const moveItem = (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const newItems = [...items];
    const [item] = newItems.splice(from, 1);
    newItems.splice(to, 0, item);
    onChange(newItems);
  };

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <Card key={index} className="border-border/50 bg-muted/20">
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="flex flex-col gap-1 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => moveItem(index, index - 1)}
                  disabled={index === 0}
                >
                  <GripVertical className="h-4 w-4 rotate-90" />
                </Button>
              </div>
              <div className="flex-1 space-y-3">
                {renderFields(item, index, (field, value) =>
                  updateItem(index, field, value)
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => removeItem(index)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
      <Button
        type="button"
        variant="outline"
        onClick={addItem}
        className="w-full border-dashed"
      >
        <Plus className="mr-2 h-4 w-4" />
        {addLabel}
      </Button>
    </div>
  );
}

// Export helper components for common field types
export const ArrayTextField = CmsTextField;
export const ArrayImageUpload = CmsImageUpload;
