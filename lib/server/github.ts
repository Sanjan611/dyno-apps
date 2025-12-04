const GITHUB_API_BASE = "https://api.github.com";

const GITHUB_ORG_NAME = process.env.GITHUB_ORG_NAME;
const GITHUB_PAT = process.env.GITHUB_PAT;

type GitHubActionResult = {
  ok: boolean;
  status: number;
  message?: string;
  notFound?: boolean;
  repositoryUrl?: string;
};

function ensureGitHubConfig(): void {
  if (!GITHUB_ORG_NAME) {
    throw new Error("GITHUB_ORG_NAME is not set");
  }
  if (!GITHUB_PAT) {
    throw new Error("GITHUB_PAT is not set");
  }
}

function getAuthHeaders() {
  ensureGitHubConfig();

  return {
    Authorization: `Bearer ${GITHUB_PAT}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "dyno-apps-server",
  };
}

/**
 * Constructs the GitHub repository URL for a given project ID
 */
export function getRepositoryUrl(projectId: string): string {
  if (!GITHUB_ORG_NAME) {
    throw new Error("GITHUB_ORG_NAME is not set");
  }
  const repoName = `dyno-apps-${projectId}`;
  return `https://github.com/${GITHUB_ORG_NAME}/${repoName}`;
}

export async function createProjectRepo(params: {
  projectId: string;
}): Promise<GitHubActionResult> {
  ensureGitHubConfig();

  const repoName = `dyno-apps-${params.projectId}`;

  // Add timeout to prevent hanging on network issues
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/orgs/${GITHUB_ORG_NAME}/repos`,
      {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: repoName,
          private: true,
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const repositoryUrl = getRepositoryUrl(params.projectId);
      return {
        ok: true,
        status: response.status,
        message: `Created GitHub repo ${GITHUB_ORG_NAME}/${repoName}`,
        repositoryUrl,
      };
    }

    let errorMessage = `GitHub repo creation failed with status ${response.status}`;
    try {
      const body = await response.json();
      if (body && typeof body.message === "string") {
        errorMessage = body.message;
      }
    } catch {
      // ignore JSON parse errors
    }

    return {
      ok: false,
      status: response.status,
      message: errorMessage,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    
    // Handle timeout or network errors
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        message: "GitHub API request timed out",
      };
    }
    
    // Re-throw other errors to be handled by the caller
    throw error;
  }
}

export async function deleteProjectRepo(params: {
  projectId: string;
}): Promise<GitHubActionResult> {
  ensureGitHubConfig();

  const repoName = `dyno-apps-${params.projectId}`;

  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${GITHUB_ORG_NAME}/${repoName}`,
    {
      method: "DELETE",
      headers: getAuthHeaders(),
    }
  );

  if (response.status === 404) {
    return {
      ok: true,
      status: response.status,
      notFound: true,
      message: `GitHub repo ${GITHUB_ORG_NAME}/${repoName} already missing`,
    };
  }

  if (response.ok) {
    return {
      ok: true,
      status: response.status,
      message: `Deleted GitHub repo ${GITHUB_ORG_NAME}/${repoName}`,
    };
  }

  let errorMessage = `GitHub repo deletion failed with status ${response.status}`;
  try {
    const body = await response.json();
    if (body && typeof body.message === "string") {
      errorMessage = body.message;
    }
  } catch {
    // ignore JSON parse errors
  }

  return {
    ok: false,
    status: response.status,
    message: errorMessage,
  };
}


