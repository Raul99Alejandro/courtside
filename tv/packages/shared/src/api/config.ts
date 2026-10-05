import { GENERATED_CONFIG } from '../config.generated';

export interface Config {
  httpApiUrl: string;
  wsUrl: string;
  /** The deployed phone site; the QR code points at `${siteUrl}/phone.html`. */
  siteUrl: string;
}

/** Native builds (Fire OS, Vega) use the bundled config written by scripts/gen-config.mjs. */
export async function loadConfig(): Promise<Config> {
  return GENERATED_CONFIG;
}
