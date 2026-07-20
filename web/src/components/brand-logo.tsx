"use client";

import Image from "next/image";

/** CSS toggles visibility via html.dark — avoids wrong logo on hydration. */
export function BrandLogo() {
  return (
    <span className="brand-logo-wrap" aria-hidden={false}>
      <Image
        src="/brand/arwl-logo.png"
        alt="Anand Rathi Wealth"
        width={156}
        height={42}
        className="brand-logo-img brand-logo--light"
        priority
      />
      <Image
        src="/brand/arwl-logo-white.png"
        alt=""
        width={156}
        height={42}
        className="brand-logo-img brand-logo--dark"
        priority
        aria-hidden
      />
    </span>
  );
}
