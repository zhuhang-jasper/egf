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
    <header className="mb-3 w-full text-center sm:mb-4">
      <h1 className="text-balance text-xl font-extrabold leading-tight tracking-tight text-black sm:text-[1.65rem]">{copy.title}</h1>
      <p className="mx-auto mt-2 max-w-[36rem] text-pretty text-xs leading-relaxed text-foreground sm:mt-2.5 sm:text-[15px]">
        {copy.tagline}
        <br />
        {copy.detail}
      </p>
      <p className="mt-1.5 text-[11px] text-muted-foreground sm:mt-2 sm:text-sm">{copy.byline}</p>
    </header>
  );
}
