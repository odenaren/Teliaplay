import type { NextConfig } from "next";

const config: NextConfig = {
  // Omslagsbilder kommer från TMDB, kanallogotyper från tv.nu och Telia.
  // Vanliga <img> i stället för next/image gör att vi slipper hålla en lista
  // över tillåtna domäner uppdaterad varje gång en tjänst byter CDN.
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
};

export default config;
