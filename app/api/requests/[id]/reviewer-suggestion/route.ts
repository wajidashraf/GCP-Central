import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';
import { hasRole } from '@/src/lib/auth/has-role';

const SUGGESTION_ACTIONS = ['accepted', 'no_need', 'pending'] as const;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || !hasRole(user, 'reviewer')) {
      return NextResponse.json(
        { error: 'Only reviewers can submit suggestions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { suggestion } = body;
    const normalizedSuggestion = typeof suggestion === 'string' ? suggestion.trim() : '';

    if (!normalizedSuggestion) {
      return NextResponse.json(
        { error: 'Suggestion is required' },
        { status: 400 }
      );
    }

    // Check if request exists
    const requestRecord = await prisma.request.findUnique({
      where: { id },
    });

    if (!requestRecord) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // Create reviewer suggestion
    const reviewerSuggestion = await prisma.reviewerSuggestion.create({
      data: {
        requestId: id,
        reviewerId: user.id,
        reviewerName: user.name,
        suggestion: normalizedSuggestion,
        status: 'pending',
        action: null,
      },
    });

    return NextResponse.json(reviewerSuggestion);
  } catch (error) {
    console.error('Error creating reviewer suggestion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const reviewerSuggestions = await prisma.reviewerSuggestion.findMany({
      where: { requestId: id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(reviewerSuggestions);
  } catch (error) {
    console.error('Error fetching reviewer suggestions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || (!hasRole(user, 'verifier') && !hasRole(user, 'admin'))) {
      return NextResponse.json(
        { error: 'Only verifiers and admins can update suggestion status' },
        { status: 403 }
      );
    }
    const { id } = await params;

    const body = await request.json();
    const { suggestionId, action } = body;
    const normalizedSuggestionId = typeof suggestionId === 'string' ? suggestionId.trim() : '';
    const normalizedAction = typeof action === 'string' ? action.trim().toLowerCase() : '';

    if (!normalizedSuggestionId || !normalizedAction) {
      return NextResponse.json(
        { error: 'Suggestion ID and action are required' },
        { status: 400 }
      );
    }

    if (!SUGGESTION_ACTIONS.includes(normalizedAction as (typeof SUGGESTION_ACTIONS)[number])) {
      return NextResponse.json(
        { error: 'Invalid action value' },
        { status: 400 }
      );
    }

    const suggestion = await prisma.reviewerSuggestion.findFirst({
      where: {
        id: normalizedSuggestionId,
        requestId: id,
      },
      select: { id: true },
    });

    if (!suggestion) {
      return NextResponse.json(
        { error: 'Suggestion not found for this request' },
        { status: 404 }
      );
    }

    const updatedSuggestion = await prisma.reviewerSuggestion.update({
      where: { id: normalizedSuggestionId },
      data: {
        action: normalizedAction,
        status: normalizedAction === 'pending' ? 'pending' : 'reviewed',
      },
    });

    return NextResponse.json(updatedSuggestion);
  } catch (error) {
    console.error('Error updating reviewer suggestion:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
