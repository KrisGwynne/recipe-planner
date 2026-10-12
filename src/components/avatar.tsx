import Image from "next/image";
import { cx } from "@/lib/cx";

/** First letter of the name (or email), for when there's no photo. */
export function initial(name: string | null | undefined): string {
  return name?.trim().charAt(0).toUpperCase() || "?";
}

/** A person's Google photo, or their initial in a circle (onboarding design). */
export function Avatar({
  name,
  image,
  size = 56,
  className,
}: {
  name: string | null | undefined;
  image?: string | null;
  size?: number;
  className?: string;
}) {
  const classes = cx("rounded-full bg-surface-2 border border-line", className);
  if (image) {
    return <Image src={image} alt="" width={size} height={size} className={cx(classes, "object-cover")} />;
  }
  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={cx(classes, "text-ink grid place-items-center font-semibold")}
    >
      {initial(name)}
    </span>
  );
}
