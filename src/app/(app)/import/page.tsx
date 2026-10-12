import type { Metadata } from "next";
import { importRecipesAction, reviewImportAction } from "./actions";
import { ImportFlow } from "./import-flow";

export const metadata: Metadata = { title: "Import" };

// Import design (designs/src/import.html): pick files or paste, review, import.
export default function ImportPage() {
  return <ImportFlow review={reviewImportAction} save={importRecipesAction} />;
}
