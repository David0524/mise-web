/** @type {import('next').NextConfig} */
const nextConfig = {
  /* The deployed commit, short, for feedback and error reports in the app
     (components/MiseApp.jsx). Vercel sets VERCEL_GIT_COMMIT_SHA at build
     time; anywhere else it's empty and the reports simply leave it out. */
  env: { NEXT_PUBLIC_BUILD: (process.env.VERCEL_GIT_COMMIT_SHA || "").slice(0, 7) },
};
module.exports = nextConfig;
