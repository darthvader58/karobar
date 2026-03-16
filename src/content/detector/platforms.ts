export interface KnownPlatformPattern {
  platform: string;
  hostname: RegExp;
  pathPattern: RegExp;
}

export const KNOWN_PLATFORM_PATTERNS: KnownPlatformPattern[] = [
  {
    platform: "linkedin",
    hostname: /(?:^|\.)linkedin\.com$/i,
    pathPattern: /\/jobs?(?:\/|$)/i,
  },
  {
    platform: "greenhouse",
    hostname: /(?:^|\.)greenhouse\.io$/i,
    pathPattern: /.*/,
  },
  {
    platform: "icims",
    hostname: /\.icims\.com$/i,
    pathPattern: /\/jobs?(?:\/|$)/i,
  },
  {
    platform: "workday",
    hostname: /(?:\.myworkdayjobs\.com|\.workday\.com)$/i,
    pathPattern: /.*/,
  },
  {
    platform: "ripplematch",
    hostname: /(?:^|\.)ripplematch\.com$/i,
    pathPattern: /\/(?:job|apply|jobs|v2\/public\/job)(?:\/|$)/i,
  },
  {
    platform: "tesla",
    hostname: /(?:^|\.)tesla\.com$/i,
    pathPattern: /\/careers\/search\/job(?:\/|$)/i,
  },
  {
    platform: "lever",
    hostname: /^jobs\.lever\.co$/i,
    pathPattern: /.*/,
  },
  {
    platform: "smartrecruiters",
    hostname: /^jobs\.smartrecruiters\.com$/i,
    pathPattern: /.*/,
  },
];

export function matchKnownPlatform(url: string): { platform: string } | null {
  try {
    const parsedUrl = new URL(url);
    for (const entry of KNOWN_PLATFORM_PATTERNS) {
      if (
        entry.hostname.test(parsedUrl.hostname) &&
        entry.pathPattern.test(parsedUrl.pathname)
      ) {
        return { platform: entry.platform };
      }
    }
    return null;
  } catch {
    return null;
  }
}
