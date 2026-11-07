import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The timetable is read from disk at runtime, so ship it with the server
  // functions that read it (the home page's getStaticProps and the departures API)
  outputFileTracingIncludes: {
    '/': ['./data/schedule.json'],
    '/api/departures': ['./data/schedule.json'],
  },
};

export default nextConfig;
