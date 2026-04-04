# Tech Stack Comparison Report

This document provides a straightforward and simple comparison of two application development options based on difficulty and cost, along with a 5-year cost estimate.

## Option 1: Microsoft Power Pages 
*(Requirement: Fully custom UI, custom logic, NO Power Automate)*

### 1. Difficulty: HIGH
* **Custom Design:** Power Pages makes it very hard to build a modern, fully custom user interface from scratch. You are tied to their template system.
* **Custom Rules without Power Automate:** If you don't use Power Automate, writing complex logic requires using C# server-side plugins or complex JavaScript. It goes against the "low-code" nature of the platform, making development slow and frustrating.

### 2. Monthly Cost: HIGH
* The basic pack for 100 authenticated users costs around **$200 per month**. 

### 5-Year Cost Estimate
* $200/month x 12 months = $2,400 per year.
* **Total 5-Year Cost: ~$12,000 USD** *(This can increase if you run out of database storage).*

---

## Option 2: Next.js + MongoDB + Azure B2C + Cloudinary + Email API
*(Requirement: 100 users/day, Malaysia region, 50 emails/day)*

### 1. Difficulty: MEDIUM
* **Custom Design:** Very easy. Using Next.js gives you 100% control to build any design or user interface you want.
* **Custom Rules:** Very easy. You can write your logic directly into the Next.js backend using standard JavaScript/TypeScript.
* **Setup:** The only challenging part is the initial setup—connecting Next.js to Azure B2C, MongoDB, and your email service. Once connected, managing it is straightforward.

### 2. Monthly Cost: VERY LOW (Almost Free)
* With a maximum of 100 users and 50 emails a day, almost all your services will fall under their **Free Tiers**:
  * **Azure AD B2C:** Free (up to 50,000 users).
  * **MongoDB / Azure Blob / Cloudinary:** Free to $2/month at this small scale.
  * **Email sending (Resend/SendGrid):** Free.
  * **Hosting (Vercel or Azure Web Apps):** $0 to $20/month. Let's assume you pay $20/month for a solid paid hosting plan.

### 5-Year Cost Estimate
* $20/month x 12 months = $240 per year.
* **Total 5-Year Cost: ~$1,200 USD** *(Could be as low as $0 if you stick strictly to free-tier hosting).*

---

## Final Summary

| Feature | Option 1: Power Pages | Option 2: Next.js Stack |
| :--- | :--- | :--- |
| **Development Difficulty** | Very Hard | Standard |
| **Monthly Cost** | ~$200 USD | ~$0 to $20 USD |
| **5-Year Total Cost** | **$12,000 USD** | **Under $1,200 USD** |

### Recommendation
You should **definitely choose Option 2 (Next.js)**. 
Power Pages is a bad fit if you want a fully custom UI and do not want to use Power Automate. By choosing Next.js, you will get exactly the design and features you want while saving over **$10,000 USD** in 5 years.
