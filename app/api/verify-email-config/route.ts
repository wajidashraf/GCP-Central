/**
 * Email Configuration Verification Script
 * 
 * Run this in your Node.js console to verify email setup:
 * 
 * In Next.js:
 * 1. Create a route file: app/api/verify-email-config/route.ts
 * 2. Paste the code below
 * 3. Visit: http://localhost:3000/api/verify-email-config
 * 
 * Or run directly in your terminal with:
 * node -r dotenv/config lib/email/verify-email.js dotenv_config_path=.env.local
 */

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { verifyEmailConfig } from '@/lib/email/email-service';

export async function GET(req: NextRequest) {
  try {
    console.log('\n' + '='.repeat(70));
    console.log('EMAIL CONFIGURATION VERIFICATION');
    console.log('='.repeat(70));

    // Check environment variables
    console.log('\n📋 CHECKING ENVIRONMENT VARIABLES:\n');

    const envVars = {
      'EMAIL_SERVICE': env.EMAIL_SERVICE,
      'EMAIL_USER': env.EMAIL_USER,
      'EMAIL_PASSWORD': env.EMAIL_PASSWORD ? '***hidden***' : '❌ NOT SET',
      'EMAIL_FROM_EMAIL': env.EMAIL_FROM_EMAIL,
      'EMAIL_FROM_NAME': env.EMAIL_FROM_NAME,
      'NEXT_PUBLIC_APP_URL': process.env.NEXT_PUBLIC_APP_URL,
    };

    let allSet = true;
    for (const [key, value] of Object.entries(envVars)) {
      if (!value || value === '') {
        console.log(`  ❌ ${key}: NOT SET`);
        allSet = false;
      } else if (value === '***hidden***') {
        console.log(`  ✅ ${key}: SET (hidden for security)`);
      } else {
        console.log(`  ✅ ${key}: ${value}`);
      }
    }

    if (!allSet) {
      console.log('\n' + '='.repeat(70));
      return NextResponse.json(
        {
          success: false,
          message: 'Missing required environment variables. See console output above.',
          status: 'INCOMPLETE',
        },
        { status: 400 }
      );
    }

    // Check for proper Gmail App Password
    console.log('\n📧 GMAIL APP PASSWORD CHECK:\n');
    if (env.EMAIL_SERVICE === 'gmail') {
      const isAppPassword = (env.EMAIL_PASSWORD || '').length > 15;
      if (isAppPassword) {
        console.log('  ✅ Password length looks like an App Password (16+ characters)');
      } else {
        console.log(
          '  ⚠️  WARNING: Password might not be a Gmail App Password'
        );
        console.log('     Gmail App Passwords are typically 16 characters');
        console.log('     Regular Gmail passwords may not work with Nodemailer');
      }
    }

    // Test connection to email service
    console.log('\n🔌 TESTING EMAIL SERVICE CONNECTION:\n');
    const verification = await verifyEmailConfig();

    if (verification.isValid) {
      console.log('  ✅ EMAIL SERVICE CONNECTED SUCCESSFULLY!');
      console.log(`     Message: ${verification.message}`);
    } else {
      console.log('  ❌ EMAIL SERVICE CONNECTION FAILED');
      console.log(`     Error: ${verification.message}`);
    }

    // Test email sending (optional, commented out)
    console.log('\n📨 TEST EMAIL SENDING:\n');
    console.log('  To test sending an actual email, uncomment the code in this');
    console.log('  verification script and add your test email address.');
    console.log('  See NODEMAILER_SETUP.md for test email instructions.');

    console.log('\n' + '='.repeat(70));
    console.log('VERIFICATION COMPLETE');
    console.log('='.repeat(70) + '\n');

    return NextResponse.json(
      {
        success: verification.isValid,
        message: verification.message,
        status: verification.isValid ? 'READY' : 'FAILED',
        environment: {
          emailService: env.EMAIL_SERVICE,
          emailUser: env.EMAIL_USER,
          emailFrom: env.EMAIL_FROM_EMAIL,
          appUrl: process.env.NEXT_PUBLIC_APP_URL,
        },
      },
      { status: verification.isValid ? 200 : 500 }
    );
  } catch (error) {
    console.error('\n❌ VERIFICATION ERROR:', error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Unknown error during verification',
        status: 'ERROR',
      },
      { status: 500 }
    );
  }
}

/**
 * MANUAL TEST EMAIL SENDING
 * 
 * Uncomment and modify the code below to test sending a real email.
 * Then visit: http://localhost:3000/api/verify-email-config
 * 
 * This will:
 * 1. Verify configuration
 * 2. Send a test email to your address
 * 3. Show the result
 * 
 * Code below:
 * 
 * import { sendEmail } from '@/lib/email/email-service';
 * import { getCustomTemplate, htmlToPlainText } from '@/lib/email/email-templates';
 * 
 * // After verifyEmailConfig check, add:
 * if (verification.isValid) {
 *   console.log('\n📨 SENDING TEST EMAIL:\n');
 *   
 *   const testEmail = 'your-email@gmail.com'; // Change this to your email
 *   
 *   const html = getCustomTemplate(
 *     'Email Configuration Test',
 *     'If you received this email, your Nodemailer configuration is working correctly!',
 *     'View Your Dashboard',
 *     process.env.NEXT_PUBLIC_APP_URL
 *   );
 *   
 *   const emailResult = await sendEmail({
 *     to: testEmail,
 *     subject: 'GCP Central - Email Configuration Test',
 *     html,
 *     text: htmlToPlainText(html),
 *   });
 *   
 *   if (emailResult.success) {
 *     console.log('  ✅ TEST EMAIL SENT SUCCESSFULLY!');
 *     console.log(`     To: ${testEmail}`);
 *     console.log(`     Message ID: ${emailResult.messageId}`);
 *   } else {
 *     console.log('  ❌ FAILED TO SEND TEST EMAIL');
 *     console.log(`     Error: ${emailResult.error}`);
 *   }
 * }
 */
