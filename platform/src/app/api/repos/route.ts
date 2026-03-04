import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/api/auth/[...nextauth]/route';
import {
  createRepository,
  listUserRepositories,
  listTeamRepositories,
  getRepository,
  deleteRepository,
  getLatestAnalysis,
} from '@/lib/db';
import { planLimits, MVP_FREE_ONLY } from '@/lib/plans';
import { randomUUID } from 'crypto';

// GET /api/repos - List repositories
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get('teamId');

    let repos;
    if (teamId) {
      // TODO: Verify user is a member of the team
      repos = await listTeamRepositories(teamId);
    } else {
      repos = await listUserRepositories(session.user.id);
    }

    // Attach latest analysis to each repo
    const reposWithAnalysis = await Promise.all(
      repos.map(async (repo) => {
        const latestAnalysis = await getLatestAnalysis(repo.id);
        return { ...repo, latestAnalysis };
      })
    );

    const maxRepos = planLimits.free.maxRepos; // 3 repos for free tier (default)

    return NextResponse.json({
      repos: reposWithAnalysis,
      limits: {
        maxRepos,
        currentCount: repos.length,
        remaining: maxRepos - repos.length,
      },
    });
  } catch (error) {
    console.error('Error listing repositories:', error);
    return NextResponse.json(
      { error: 'Failed to list repositories' },
      { status: 500 }
    );
  }
}

// POST /api/repos - Create a new repository
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, url, description, defaultBranch = 'main', teamId } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'Name and URL are required' },
        { status: 400 }
      );
    }

    // Validate URL is a valid git repository URL
    const urlPattern = /^(https?:\/\/|git@)[\w.@:\/-]+$/;
    if (!urlPattern.test(url)) {
      return NextResponse.json(
        { error: 'Invalid repository URL' },
        { status: 400 }
      );
    }

    // Check repo limit
    let existingRepos;
    if (teamId) {
      existingRepos = await listTeamRepositories(teamId);
    } else {
      existingRepos = await listUserRepositories(session.user.id);
    }

    const maxRepos = planLimits.free.maxRepos; // 3 repos for free tier

    if (existingRepos.length >= maxRepos) {
      return NextResponse.json(
        {
          error: `Limit reached. You have ${existingRepos.length} repositories.`,
          code: 'REPO_LIMIT_REACHED',
          currentCount: existingRepos.length,
          maxRepos,
          upgradeUrl: 'https://getaiready.dev/pricing',
        },
        { status: 403 }
      );
    }

    const repo = await createRepository({
      id: randomUUID(),
      userId: session.user.id,
      teamId,
      name,
      url,
      description,
      defaultBranch,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Return repo with remaining count
    return NextResponse.json(
      {
        repo,
        reposRemaining: maxRepos - existingRepos.length - 1,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating repository:', error);
    return NextResponse.json(
      { error: 'Failed to create repository' },
      { status: 500 }
    );
  }
}

// DELETE /api/repos?id=<repoId> - Delete a repository
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const repoId = searchParams.get('id');

    if (!repoId) {
      return NextResponse.json(
        { error: 'Repository ID is required' },
        { status: 400 }
      );
    }

    // Verify ownership
    const repo = await getRepository(repoId);
    if (!repo) {
      return NextResponse.json(
        { error: 'Repository not found' },
        { status: 404 }
      );
    }

    if (repo.userId !== session.user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await deleteRepository(repoId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting repository:', error);
    return NextResponse.json(
      { error: 'Failed to delete repository' },
      { status: 500 }
    );
  }
}
