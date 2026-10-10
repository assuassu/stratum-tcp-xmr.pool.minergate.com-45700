import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DEVICE_TYPE_LABELS, type Device, type DeviceCreate, type DeviceType } from "@/lib/types";

const TYPES = Object.keys(DEVICE_TYPE_LABELS) as DeviceType[];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: Device | null;
  pending: boolean;
  onSubmit: (values: DeviceCreate) => void;
}

export default function DeviceFormDialog({ open, onOpenChange, initial, pending, onSubmit }: Props) {
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [type, setType] = useState<DeviceType>("ont");
  const [location, setLocation] = useState("");
  const [ponPort, setPonPort] = useState("");
  const [notes, setNotes] = useState("");
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setHost(initial?.host ?? "");
      setType(initial?.type ?? "ont");
      setLocation(initial?.location ?? "");
      setPonPort(initial?.pon_port ?? "");
      setNotes(initial?.notes ?? "");
      setEnabled(initial?.enabled ?? true);
    }
  }, [open, initial]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit({ name, host, type, location, pon_port: ponPort, notes, enabled });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="device-form-dialog" className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{initial ? "Edit Perangkat" : "Tambah Perangkat"}</DialogTitle>
            <DialogDescription>
              Perangkat akan di-ping otomatis oleh monitor latar belakang sesuai interval.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="device-name">Nama Perangkat</Label>
            <Input
              id="device-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ONT ZTE F660 - ODP KMY-01"
              data-testid="device-name-input"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="device-host">Host / IP</Label>
            <Input
              id="device-host"
              required
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="192.168.1.1"
              className="font-mono"
              data-testid="device-host-input"
            />
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="device-type">Tipe Perangkat</Label>
              <Select value={type} onValueChange={(v: string) => setType(v as DeviceType)}>
                <SelectTrigger id="device-type" data-testid="device-type-select">
                  <SelectValue>{(v: string) => DEVICE_TYPE_LABELS[v as DeviceType] ?? "ONT"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DEVICE_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="device-pon">Port PON / LAN</Label>
              <Input
                id="device-pon"
                value={ponPort}
                onChange={(e) => setPonPort(e.target.value)}
                placeholder="PON 1/2"
                data-testid="device-pon-port-input"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="device-location">Lokasi (ODP / ODC / Rack)</Label>
            <Input
              id="device-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="ODP KMY-01 Port 3"
              data-testid="device-location-input"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="device-notes">Catatan</Label>
            <Textarea
              id="device-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Paket 30 Mbps, pelanggan Kalimaya…"
              data-testid="device-notes-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="device-enabled"
              checked={enabled}
              onCheckedChange={(c) => setEnabled(c === true)}
              data-testid="device-enabled-checkbox"
            />
            <Label htmlFor="device-enabled" className="font-normal">
              Aktifkan monitoring ping
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="device-form-cancel-btn"
            >
              Batal
            </Button>
            <Button type="submit" disabled={pending} data-testid="device-form-submit-btn">
              {initial ? "Simpan Perubahan" : "Tambah Perangkat"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
