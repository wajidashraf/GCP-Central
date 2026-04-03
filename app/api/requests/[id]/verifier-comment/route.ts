import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentUser } from '@/src/lib/auth/get-current-user';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== 'verifier') {
      return NextResponse.json(
        { error: 'Only verifiers can submit verification comments' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { comment, decisionCode } = body;

    if (!comment || !decisionCode) {
      return NextResponse.json(
        { error: 'Comment and decision code are required' },
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

    // Create or update verifier comment
    const verifierComment = await prisma.verifierComment.upsert({
      where: { requestId: id },
      update: {
        comment,
        decisionCode,
        verifiedBy: user.name,
      },
      create: {
        requestId: id,
        verifierId: user.id,
        comment,
        decisionCode,
        verifiedBy: user.name,
      },
    });

    // Update request status based on decision code
    await prisma.request.update({
      where: { id },
      data: {
        status: decisionCode === 'approved' ? 'Acknowledged' : 'Resubmit',
      },
    });

    return NextResponse.json(verifierComment);
  } catch (error) {
    console.error('Error creating verifier comment:', error);
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

    const verifierComment = await prisma.verifierComment.findUnique({
      where: { requestId: id },
    });

    if (!verifierComment) {
      return NextResponse.json(null);
    }

    return NextResponse.json(verifierComment);
  } catch (error) {
    console.error('Error fetching verifier comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
