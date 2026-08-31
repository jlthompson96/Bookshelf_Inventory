/** @type {import('next').NextConfig} */
const nextConfig = {
  /* There is a second lockfile above this directory, so Next infers the wrong
     workspace root and traces from there. Naming it explicitly is what keeps
     the font tracing below pointed at this project. */
  outputFileTracingRoot: import.meta.dirname,

  /* The share images read their two typefaces off disk (see app/_og/card.tsx).
     Nothing imports the .ttf files, so without this the tracer cannot see that
     they are needed and the deployed function renders every card in a fallback
     face — or fails outright. */
  outputFileTracingIncludes: {
    "/**": ["./app/_og/*.ttf"],
  },
};

export default nextConfig;
