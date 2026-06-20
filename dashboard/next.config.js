/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    // api/resolve proxies to this; default to the public testnet aggregator so the
    // dashboard works without extra config.
    WALRUS_AGGREGATOR:
      process.env.WALRUS_AGGREGATOR || "https://aggregator.walrus-testnet.walrus.space",
  },
};

module.exports = nextConfig;
