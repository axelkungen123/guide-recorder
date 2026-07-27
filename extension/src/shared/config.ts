/**
 * Where the extension sends recordings. The api/ workspace listens on 8787 by
 * default. Reachable from the service worker because manifest host_permissions
 * includes <all_urls> (which covers http://localhost).
 */
export const API_BASE_URL = "http://localhost:8787";
