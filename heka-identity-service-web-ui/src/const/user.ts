export const connectionLabel = 'Agency Demo';

export const mainDidMethod = 'key';

/**
 * Pre-provisioned demo account used by the public demo pages without signing in.
 * The access token is baked in at build time; the demo-token broker (plan phase 6)
 * replaces it with a short-lived token fetched at runtime.
 */
export const demoUser = {
  did: process.env.REACT_APP_DEMO_USER_DID ?? '',
  accessToken: process.env.REACT_APP_DEMO_USER_ACCESS_TOKEN ?? '',
};

export const baseDisplayMetadata = {
  background_color: '#171717',
  logo: {
    url: 'https://cdn.theorg.com/fda49f46-96e2-49b8-99aa-0ff5165953b7_medium.jpg',
  },
};
