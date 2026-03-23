/**
 * Ambient type declarations for jspdf + jspdf-autotable.
 *
 * These packages lack a proper `exports` field in their package.json,
 * which causes TypeScript (moduleResolution: "bundler") to fail resolving
 * their bundled types even though the .d.ts files exist on disk.
 *
 * Declaring the modules here gives the compiler a local, authoritative source
 * that bypasses the broken package resolution entirely.
 */

declare module "jspdf" {
  export interface jsPDFOptions {
    orientation?: "portrait" | "landscape" | "p" | "l";
    unit?: "pt" | "px" | "mm" | "cm" | "in";
    format?: string | [number, number];
    compress?: boolean;
  }

  export class jsPDF {
    constructor(options?: jsPDFOptions);
    setFontSize(size: number): this;
    setFont(fontName: string, fontStyle?: string): this;
    text(
      text: string | string[],
      x: number,
      y: number,
      options?: Record<string, unknown>
    ): this;
    addImage(
      imageData: string | HTMLImageElement,
      format: string,
      x: number,
      y: number,
      width: number,
      height: number,
      alias?: string,
      compression?: string,
      rotation?: number
    ): this;
    addPage(format?: string, orientation?: string): this;
    save(filename: string, options?: { returnPromise?: boolean }): void | Promise<void>;
    output(type?: string, options?: Record<string, unknown>): string | ArrayBuffer;
    // autoTable is patched onto the prototype by jspdf-autotable
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    autoTable(options: Record<string, unknown>): void;
    // Allow arbitrary property access (the library is heavily augmented)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }
}

declare module "jspdf-autotable" {
  import type { jsPDF } from "jspdf";

  export interface UserOptions {
    head?: unknown[][];
    body?: unknown[][];
    foot?: unknown[][];
    startY?: number;
    styles?: Record<string, unknown>;
    headStyles?: Record<string, unknown>;
    bodyStyles?: Record<string, unknown>;
    columnStyles?: Record<string | number, Record<string, unknown>>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    didDrawCell?: (data: any) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  }

  function autoTable(doc: jsPDF, options: UserOptions): void;
  export default autoTable;
}
