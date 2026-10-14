import { readProjectFile } from "@/help/claude-project";

/**
 * The help page's downloads (help design B): /import/help/recipe.schema.json
 * and the two examples, exactly as they are in the repo. Anything else is a
 * 404, so the name can't reach other files.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const text = await readProjectFile(file);
  if (text === null) return new Response("Not found", { status: 404 });
  return new Response(text, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${file}"`,
    },
  });
}
