import path from "node:path";
import { Readable } from "node:stream";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import {
  ALLOWED_ZIP_EXTENSIONS,
  ZIP_MAX_COMPRESSION_RATIO,
  ZIP_MAX_ENTRIES,
  ZIP_MAX_UNCOMPRESSED_BYTES,
} from "@offsprint/shared";

export interface ExtractedFile {
  path: string;
  buffer: Buffer;
  size: number;
}

export class ZipExtractionError extends Error {}

export async function extractZip(zipBuffer: Buffer): Promise<ExtractedFile[]> {
  const zipFile = await openZip(zipBuffer);
  let files: ExtractedFile[];
  try {
    files = await readEntries(zipFile);
  } finally {
    zipFile.close();
  }
  files = stripCommonRoot(files);
  if (!files.some((f) => f.path.toLowerCase() === "index.html")) {
    throw new ZipExtractionError("zip must contain index.html at root");
  }
  return files;
}

function stripCommonRoot(files: ExtractedFile[]): ExtractedFile[] {
  if (files.length === 0) return files;
  const firstSegment = (p: string) => p.split("/")[0] ?? "";
  const root = firstSegment(files[0]!.path);
  if (!root || !files[0]!.path.includes("/")) return files;
  for (const f of files) {
    if (firstSegment(f.path) !== root) return files;
    if (!f.path.startsWith(root + "/")) return files;
  }
  return files.map((f) => ({ ...f, path: f.path.slice(root.length + 1) }));
}

function openZip(buf: Buffer): Promise<ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buf, { lazyEntries: true }, (err, zip) => {
      if (err || !zip) return reject(err ?? new ZipExtractionError("failed to open zip"));
      resolve(zip);
    });
  });
}

function readEntries(zip: ZipFile): Promise<ExtractedFile[]> {
  return new Promise((resolve, reject) => {
    const out: ExtractedFile[] = [];
    let totalUncompressed = 0;
    let entryCount = 0;

    zip.on("error", reject);
    zip.on("end", () => resolve(out));
    zip.on("entry", (entry: Entry) => {
      entryCount++;
      if (entryCount > ZIP_MAX_ENTRIES) {
        return reject(new ZipExtractionError(`too many entries (max ${ZIP_MAX_ENTRIES})`));
      }

      const raw = entry.fileName;
      if (raw.endsWith("/")) {
        zip.readEntry();
        return;
      }

      if (raw.includes("\\") || raw.includes("\0")) {
        return reject(new ZipExtractionError(`invalid entry path: ${raw}`));
      }
      const normalized = path.posix.normalize(raw);
      if (normalized.startsWith("..") || normalized.startsWith("/") || normalized.includes("/..") || path.isAbsolute(normalized)) {
        return reject(new ZipExtractionError(`zip-slip detected: ${raw}`));
      }

      if (shouldSkip(normalized)) {
        zip.readEntry();
        return;
      }

      const ext = path.posix.extname(normalized).toLowerCase();
      if (!ALLOWED_ZIP_EXTENSIONS.has(ext)) {
        zip.readEntry();
        return;
      }

      const uncompressed = Number(entry.uncompressedSize ?? 0);
      const compressed = Number(entry.compressedSize ?? 0);
      if (compressed > 0 && uncompressed / compressed > ZIP_MAX_COMPRESSION_RATIO) {
        return reject(new ZipExtractionError(`suspicious compression ratio for ${normalized}`));
      }
      totalUncompressed += uncompressed;
      if (totalUncompressed > ZIP_MAX_UNCOMPRESSED_BYTES) {
        return reject(
          new ZipExtractionError(`uncompressed size exceeds limit (${ZIP_MAX_UNCOMPRESSED_BYTES} bytes)`),
        );
      }

      zip.openReadStream(entry, (err, readStream) => {
        if (err || !readStream) return reject(err ?? new ZipExtractionError(`failed to read ${normalized}`));
        collect(readStream)
          .then((buffer) => {
            if (buffer.byteLength > ZIP_MAX_UNCOMPRESSED_BYTES) {
              return reject(new ZipExtractionError(`entry too large: ${normalized}`));
            }
            out.push({ path: normalized, buffer, size: buffer.byteLength });
            zip.readEntry();
          })
          .catch(reject);
      });
    });

    zip.readEntry();
  });
}

const SKIP_BASENAMES = new Set([
  ".ds_store",
  "thumbs.db",
  ".gitignore",
  ".gitattributes",
  ".gitmodules",
  ".npmignore",
  ".dockerignore",
  ".editorconfig",
  ".env",
]);

function shouldSkip(p: string): boolean {
  const lower = p.toLowerCase();
  if (lower.startsWith("__macosx/") || lower.includes("/__macosx/")) return true;
  const base = path.posix.basename(lower);
  if (base.startsWith("._")) return true; // macOS resource forks
  return SKIP_BASENAMES.has(base);
}

function collect(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}
