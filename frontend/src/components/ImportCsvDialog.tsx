import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Check, Download, FileUp } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import { apiErrorText } from "@/lib/errors";
import { csvToDevices, CSV_TEMPLATE, type ParsedRow } from "@/lib/csv";
import type { ImportResult } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export default function ImportCsvDialog({ open, onOpenChange, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headerError, setHeaderError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const valid = rows.filter((r) => !r.error);
  const invalid = rows.filter((r) => r.error);

  const reparse = (value: string) => {
    setText(value);
    setResult(null);
    if (!value.trim()) {
      setRows([]);
      setHeaderError("");
      return;
    }
    const parsed = csvToDevices(value);
    setRows(parsed.rows);
    setHeaderError(parsed.headerError);
  };

  const importMut = useMutation({
    mutationFn: () => apiPost<ImportResult>("/devices/import", { items: valid.map((r) => r.values) }),
    onSuccess: (res) => {
      setResult(res);
      onImported();
      if (res.created > 0) toast.success(`${res.created} perangkat diimpor`);
      else toast.info("Tidak ada perangkat baru yang diimpor");
    },
    onError: (err) => toast.error(apiErrorText(err)),
  });

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    reparse(await file.text());
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-inventaris-ftth.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const close = (next: boolean) => {
    if (!next) {
      setText("");
      setRows([]);
      setHeaderError("");
      setResult(null);
    }
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent
        data-testid="import-csv-dialog"
        className="max-h-[90svh] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Impor Inventaris dari CSV</DialogTitle>
          <DialogDescription>
            Unggah file CSV atau tempel isinya. Kolom wajib: <span className="font-mono">nama</span>,{" "}
            <span className="font-mono">host</span>. Opsional:{" "}
            <span className="font-mono">tipe, lokasi, port_pon, catatan</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              data-testid="import-csv-file-input"
              onChange={(e) => void pickFile(e.target.files?.[0])}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              data-testid="import-csv-pick-file-btn"
            >
              <FileUp className="h-4 w-4" /> Pilih File CSV
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadTemplate}
              data-testid="import-csv-template-btn"
            >
              <Download className="h-4 w-4" /> Unduh Template
            </Button>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="import-csv-text">Isi CSV</Label>
            <Textarea
              id="import-csv-text"
              rows={6}
              value={text}
              onChange={(e) => reparse(e.target.value)}
              placeholder={CSV_TEMPLATE}
              className="font-mono text-xs"
              data-testid="import-csv-textarea"
            />
          </div>

          {headerError && (
            <p
              data-testid="import-csv-header-error"
              className="rounded-md border border-red-900/60 bg-[#7F1D1D]/20 px-3 py-2 text-sm text-red-300"
            >
              {headerError}
            </p>
          )}

          {rows.length > 0 && (
            <div className="space-y-2" data-testid="import-csv-preview">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="outline"
                  data-testid="import-csv-valid-count"
                  className="border-emerald-800/70 bg-[#064E3B] font-mono text-[11px] text-[#6EE7B7]"
                >
                  {valid.length} baris siap
                </Badge>
                {invalid.length > 0 && (
                  <Badge
                    variant="outline"
                    data-testid="import-csv-invalid-count"
                    className="border-amber-700 bg-[#78350F] font-mono text-[11px] text-[#FCD34D]"
                  >
                    {invalid.length} baris bermasalah
                  </Badge>
                )}
              </div>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-[#27354A]">
                {rows.map((r) => (
                  <div
                    key={r.row}
                    data-testid={`import-csv-row-${r.row}`}
                    className="flex items-center gap-3 border-b border-[#1F2937] px-3 py-2 text-xs last:border-0"
                  >
                    <span className="w-8 shrink-0 font-mono text-muted-foreground">{r.row}</span>
                    {r.error ? (
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" />
                    ) : (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{r.values.name || "(tanpa nama)"}</span>
                    <span className="shrink-0 font-mono text-muted-foreground">{r.values.host}</span>
                    {r.error && <span className="shrink-0 text-amber-300">{r.error}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result && (
            <div
              data-testid="import-csv-result"
              className="rounded-lg border border-[#27354A] bg-[#151E2E]/60 px-3 py-2.5 text-sm"
            >
              <p>
                <span className="font-semibold text-emerald-300">{result.created}</span> ditambahkan ·{" "}
                <span className="font-semibold text-slate-300">{result.skipped}</span> duplikat dilewati ·{" "}
                <span className="font-semibold text-red-300">{result.failed}</span> gagal
              </p>
              {result.errors.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 font-mono text-xs text-amber-300">
                  {result.errors.slice(0, 5).map((e) => (
                    <li key={e.row}>
                      Baris {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)} data-testid="import-csv-close-btn">
            Tutup
          </Button>
          <Button
            disabled={valid.length === 0 || importMut.isPending}
            onClick={() => importMut.mutate()}
            data-testid="import-csv-submit-btn"
          >
            {importMut.isPending ? "Mengimpor…" : `Impor ${valid.length} Perangkat`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
