export const googleAnalyticsId = 'G-XJ33LRDG0G';

export const googleAnalyticsSetup = String.raw`
  window.dataLayer = window.dataLayer || [];
  function gtag(){window.dataLayer.push(arguments);}
  gtag('js', new Date());

  {
    const plannerPath = '/yol-tarifi';
    const isPlannerPath = (pathname) => pathname.replace(/\/+$/, '') === plannerPath;
    const { origin, pathname } = window.location;
    const referrer = document.referrer ? new URL(document.referrer) : null;
    const parameters = {};

    if (isPlannerPath(pathname)) {
      parameters.page_location = origin + plannerPath;
      parameters.page_path = plannerPath;
    }
    if (referrer?.origin === origin && isPlannerPath(referrer.pathname)) {
      parameters.page_referrer = origin + plannerPath;
    }

    if (Object.keys(parameters).length > 0) {
      gtag('config', '${googleAnalyticsId}', parameters);
    } else {
      gtag('config', '${googleAnalyticsId}');
    }
  }
`;
