import { useRef } from "react";
import { Loader2, Paperclip, Send, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SupportTicketComposerProps = {
  title?: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isSending?: boolean;
  disabled?: boolean;
  placeholder?: string;
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  allowInternal?: boolean;
  isInternal?: boolean;
  onInternalChange?: (checked: boolean) => void;
};

export const SupportTicketComposer = ({
  title = "Reply",
  value,
  onChange,
  onSend,
  isSending = false,
  disabled = false,
  placeholder = "Write your message...",
  selectedFile,
  onFileChange,
  allowInternal = false,
  isInternal = false,
  onInternalChange,
}: SupportTicketComposerProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="support-ticket-message">Message</Label>
          <Textarea
            id="support-ticket-message"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            rows={6}
            disabled={disabled || isSending}
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(event) => onFileChange(event.target.files?.[0] || null)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || isSending}
          >
            <Paperclip className="mr-2 h-4 w-4" />
            Attach File
          </Button>

          {selectedFile ? (
            <div className="inline-flex items-center gap-2 rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm">
              <span className="max-w-[260px] truncate">{selectedFile.name}</span>
              <button
                type="button"
                onClick={() => onFileChange(null)}
                className="text-muted-foreground transition-colors hover:text-foreground"
                disabled={disabled || isSending}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : null}

          {allowInternal && onInternalChange ? (
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={isInternal}
                onChange={(event) => onInternalChange(event.target.checked)}
                disabled={disabled || isSending}
              />
              Internal note only
            </label>
          ) : null}
        </div>

        <div className="flex justify-end">
          <Button onClick={onSend} disabled={disabled || isSending}>
            {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
