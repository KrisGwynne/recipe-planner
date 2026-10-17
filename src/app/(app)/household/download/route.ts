import { listRecipeFiles, requireHousehold } from "@/data";
import { today } from "@/plans/plan";
import { attachment, exportFileName, recipesZip } from "@/recipes/export";

/**
 * "Download all recipes" (PP-164, household design B): the household's
 * recipes as a .zip of `<id>.json` files, for anyone in it. Signed-out
 * visitors go to sign-in and people with no household to /welcome, as pages do.
 */
export async function GET() {
  const { household, ctx } = await requireHousehold();
  const zip = recipesZip(await listRecipeFiles(ctx));
  return new Response(new Blob([zip as Uint8Array<ArrayBuffer>], { type: "application/zip" }), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": attachment(exportFileName(household.name, today())),
      "Cache-Control": "private, no-store",
    },
  });
}
