// Parser CSV minimal (mendukung kutip ganda) + pemetaan kolom ke DeviceCreate.
import { DEVICE_TYPE_LABELS, type DeviceCreate, type DeviceType } from "@/lib/types";

const TYPES = Object.keys(DEVICE_TYPE_LABELS) as DeviceType[];

export const CSV_TEMPLATE =
  "nama,host,tipe,lokasi,port_pon,catatan\n" +
  "ONT Pelanggan Budi,10.20.30.41,ont,ODP KMY-02 Port 4,PON 1/2,Paket 30 Mbps\n" +
  "ONT Pelanggan Siti,10.20.30.42,ont,ODP KMY-02 Port 5,PON 1/2,Paket 50 Mbps\n";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === "," || ch === ";") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const HEADER_ALIASES: Record<string, string> = {
  nama: "name",
  name: "name",
  perangkat: "name",
  host: "host",
  ip: "host",
  "ip/host": "host",
  alamat: "host",
  tipe: "type",
  type: "type",
  jenis: "type",
  lokasi: "location",
  location: "location",
  odp: "location",
  port_pon: "pon_port",
  "port pon": "pon_port",
  pon: "pon_port",
  pon_port: "pon_port",
  catatan: "notes",
  notes: "notes",
  keterangan: "notes",
};

export interface ParsedRow {
  row: number;
  values: DeviceCreate;
  error: string;
}

// Maps a CSV text blob to candidate devices. Row 1 must be the header.
export function csvToDevices(text: string): { rows: ParsedRow[]; headerError: string } {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], headerError: "File CSV kosong" };

  const header = table[0].map((h) => h.trim().toLowerCase());
  const fields = header.map((h) => HEADER_ALIASES[h] ?? "");
  if (!fields.includes("name") || !fields.includes("host")) {
    return {
      rows: [],
      headerError:
        "Header wajib memuat kolom 'nama' dan 'host'. Contoh: nama,host,tipe,lokasi,port_pon,catatan",
    };
  }

  const rows: ParsedRow[] = table.slice(1).map((cols, idx) => {
    const get = (field: string) => {
      const at = fields.indexOf(field);
      return at >= 0 ? (cols[at] ?? "").trim() : "";
    };
    const name = get("name");
    const host = get("host");
    const rawType = get("type").toLowerCase();
    const type = (TYPES.includes(rawType as DeviceType) ? rawType : "ont") as DeviceType;

    let error = "";
    if (!name) error = "Kolom nama kosong";
    else if (!host) error = "Kolom host kosong";
    else if (!/^[A-Za-z0-9._:-]+$/.test(host)) error = `Host "${host}" tidak valid`;
    else if (rawType && !TYPES.includes(rawType as DeviceType))
      error = `Tipe "${rawType}" tidak dikenal — gunakan: ${TYPES.join(", ")}`;

    return {
      row: idx + 2,
      error,
      values: {
        name,
        host,
        type,
        location: get("location"),
        pon_port: get("pon_port"),
        notes: get("notes"),
        enabled: true,
        parent_id: "",
      },
    };
  });

  return { rows, headerError: "" };
}
