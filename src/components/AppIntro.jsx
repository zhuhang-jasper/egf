import { SITE_COPY } from "@/lib/constants";

export function AppIntro() {
  return (
    <header className="w-full text-center">
      <h1 className="text-balance text-2xl font-extrabold tracking-tight text-black sm:text-[1.65rem] sm:leading-tight">{SITE_COPY.title}</h1>
      <p className="mx-auto mt-2.5 max-w-[36rem] text-pretty text-sm leading-relaxed text-foreground sm:text-[15px]">
        {SITE_COPY.tagline}
        <br />
        {SITE_COPY.detail}
      </p>
      <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{SITE_COPY.byline}</p>
    </header>
  );
}
