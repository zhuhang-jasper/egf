import { useEffect } from "react";

import { SITE_COPY } from "@/lib/constants";

export function AppIntro() {
  const copy = SITE_COPY;

  useEffect(() => {
    document.title = copy.title;
    const description = document.querySelector('meta[name="description"]');
    if (description) {
      description.setAttribute("content", copy.metaDescription);
    }
  }, [copy.title, copy.metaDescription]);

  return (
    <header className="w-full text-center mb-4">
      <h1 className="text-balance text-2xl font-extrabold tracking-tight text-black sm:text-[1.65rem] sm:leading-tight">{copy.title}</h1>
      <p className="mx-auto mt-2.5 max-w-[36rem] text-pretty text-sm leading-relaxed text-foreground sm:text-[15px]">
        {copy.tagline}
        <br />
        {copy.detail}
      </p>
      <p className="mt-2 text-xs text-muted-foreground sm:text-sm">{copy.byline}</p>
    </header>
  );
}
