export function EtchWordmark({
  size = "md",
}: {
  size?: "sm" | "md" | "lg";
}) {
  const classes =
    size === "sm"
      ? "text-xl"
      : size === "lg"
        ? "text-6xl md:text-8xl"
        : "text-3xl";

  return (
    <div className={`inline-flex items-end ${classes} font-bold tracking-tight leading-none`}>
      <span className="lowercase">etch</span>
      <span className="ml-1 mb-[0.12em] inline-block h-[0.08em] w-[0.55em] bg-black" />
    </div>
  );
}
