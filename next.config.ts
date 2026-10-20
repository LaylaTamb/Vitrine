import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // O perfil mudou de `/u/<@>` para `/v/<@>`: link antigo continua valendo.
      // Roda antes do middleware, então funciona também sem login.
      { source: "/u/:username", destination: "/v/:username", permanent: true },
    ];
  },
};

export default nextConfig;
