import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
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

    const reviewers = await prisma.user.findMany({
      where: {
        roles: { has: 'reviewer' },
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json(reviewers);
  } catch (error) {
    console.error('Error fetching reviewers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
