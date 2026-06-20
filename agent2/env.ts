/**
 * Loads environment variables from the project-root .env.
 *
 * The shared .env lives at the repo root (one level above agent2/), but Node's dotenv only reads from the current working directory and does NOT walk up the tree the way python-dotenv does. Resolving the path from this module's own location makes the load work regardless of where the process is started.
 *
 * Import this first ("./env.js") in every entry point before any code that reads process.env (e.g. MemWal.create).
 */
import { config } from "dotenv";
import dns from "node:dns";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Windows + Node/undici otherwise prefers IPv6 (AAAA) records and intermittently fails with ENOTFOUND / UND_ERR_CONNECT_TIMEOUT against the MemWal relayer and Sui fullnode even though the hosts are reachable over IPv4. Prefer IPv4.
dns.setDefaultResultOrder("ipv4first");

const here = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(here, "..", ".env") });
