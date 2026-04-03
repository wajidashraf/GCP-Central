import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== 'reviewer') {
      return NextResponse.json(
        { error: 'Only reviewers can submit suggestions' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { suggestion, action } = body;

    if (!suggestion) {
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
        suggestion,
        status: 'pending',
        action: action || null,
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
    
    if (!user || (user.role !== 'verifier' && user.role !== 'admin')) {
      return NextResponse.json(
        { error: 'Only verifiers and admins can update suggestion status' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { suggestionId, action } = body;

    const updatedSuggestion = await prisma.reviewerSuggestion.update({
      where: { id: suggestionId },
      data: { action },
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
