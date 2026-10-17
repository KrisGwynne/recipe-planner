import { cx } from "@/lib/cx";
import { approx } from "@/lib/format";
import { macroEnergySplit } from "@/recipes/derive";

/**
 * The share of calories from protein, carbs and fat, as a bar with a key
 * (recipe design; also the plan's nutrition page, meal plans design H, and
 * Compare). `estimated` puts the ~ on the percentages.
 */
export function EnergySplit({
  proteinG,
  carbsG,
  fatG,
  estimated = false,
}: {
  proteinG: number;
  carbsG: number;
  fatG: number;
  estimated?: boolean;
}) {
  const split = macroEnergySplit({ protein_g: proteinG, carbs_g: carbsG, fat_g: fatG });
  const parts = [
    { label: "Protein", value: split.protein, dot: "bg-veg" },
    { label: "Carbs", value: split.carbs, dot: "bg-primary" },
    { label: "Fat", value: split.fat, dot: "bg-warning" },
  ];
  return (
    <>
      <div className="mt-3 flex h-3 rounded-full overflow-hidden bg-surface-2" aria-hidden="true">
        {parts.map((p) => (
          <span key={p.label} className={p.dot} style={{ width: `${p.value}%` }} />
        ))}
      </div>
      <p className="mt-2 flex justify-between text-xs text-ink-muted">
        {parts.map((p) => (
          <span key={p.label}>
            <span className={cx("inline-block size-2 rounded-full mr-1", p.dot)} aria-hidden="true" />
            {p.label} {approx(`${Math.round(p.value)}%`, estimated)}
          </span>
        ))}
      </p>
    </>
  );
}
