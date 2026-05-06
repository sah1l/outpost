export interface PrintableResult {
  slug: string;
  url: string;
  title: string;
  type?: string;
}

export function printResult(result: PrintableResult, asJson: boolean, verb: "Uploaded" | "Updated" = "Uploaded"): void {
  if (asJson) {
    process.stdout.write(JSON.stringify(result) + "\n");
    return;
  }
  process.stdout.write(`\n  ${verb} "${result.title}"\n`);
  process.stdout.write(`  ${result.url}\n\n`);
}
