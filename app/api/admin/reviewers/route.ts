import { NextResponse } from 'next/server';
import { listUsers, parseRoles } from '@/lib/sharepoint/lists';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';

export async function GET() {
  try {
    const user = await getCurrentUser();
    
    if (!user || !hasRole(user, 'admin')) {
      return NextResponse.json(
        { error: 'Only admins can view reviewers' },
        { status: 403 }
      );
    }

    const users = await listUsers();
    const reviewers = users
      .filter((user) => parseRoles(user.roles).includes('reviewer'))
      .map((user) => ({
        id: user.id,
        name: user.Title,
        email: user.email,
      }));

    return NextResponse.json(reviewers);
  } catch (error) {
    console.error('Error fetching reviewers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
