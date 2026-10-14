// These are link aliases, not claims that Doodle has an account on each network.
export const SOCIAL_CHANNELS = ["x", "reddit", "pinterest", "instagram", "tiktok", "facebook", "linkedin", "threads", "bluesky"] as const;

export function socialChannelRedirects() {
  return SOCIAL_CHANNELS.map((channel) => ({
    source: `/${channel}`,
    destination: `/?utm_source=${channel}&utm_medium=organic_social&utm_campaign=doodle_web_launch`,
    permanent: false,
  }));
}
