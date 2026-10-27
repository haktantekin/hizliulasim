export type RedirectDeployResult = {
  status: number;
  body: {
    accepted: boolean;
    message: string;
    jobId?: string;
  };
};

type RedirectDeployOptions = {
  configuredSecret: string;
  providedSecret: string;
  deployHookUrl: string;
  fetchImpl?: typeof fetch;
};

function isValidVercelDeployHook(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:'
      && url.hostname === 'api.vercel.com'
      && url.port === ''
      && url.pathname.startsWith('/v1/integrations/deploy/');
  } catch {
    return false;
  }
}

export async function triggerRedirectDeploy(
  options: RedirectDeployOptions,
): Promise<RedirectDeployResult> {
  if (
    options.configuredSecret === ''
    || options.providedSecret !== options.configuredSecret
  ) {
    return {
      status: 401,
      body: { accepted: false, message: 'Invalid authorization.' },
    };
  }

  if (!isValidVercelDeployHook(options.deployHookUrl)) {
    return {
      status: 503,
      body: { accepted: false, message: 'Redirect deployment is not configured.' },
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(options.deployHookUrl, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return {
      status: 502,
      body: { accepted: false, message: 'Deployment service could not be reached.' },
    };
  }

  if (!response.ok) {
    return {
      status: 502,
      body: { accepted: false, message: 'Deployment service rejected the request.' },
    };
  }

  const payload = await response.json().catch(() => ({})) as {
    job?: { id?: unknown };
  };
  const jobId = typeof payload.job?.id === 'string' ? payload.job.id : undefined;

  return {
    status: 202,
    body: {
      accepted: true,
      message: 'Redirect deployment started.',
      ...(jobId ? { jobId } : {}),
    },
  };
}
