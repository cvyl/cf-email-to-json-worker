# Email to JSON Worker

This project is a Cloudflare Worker that parses incoming emails, saves the email body and attachments to an R2 bucket, and provides a JSON feed accessible through a `GET` request. You can view a live demo of the output at [https://email-to-json.cvyl.me/](https://email-to-json.cvyl.me/).

## Project Overview

The worker performs the following tasks:

1. Checks if an email sender is in an allowlist.
2. Parses the email body and attachments using `letterparser`.
3. Saves the email data as JSON in an R2 bucket.
4. Stores attachments in the R2 bucket and includes URLs to access them in the JSON.
5. Provides the stored JSON data as a feed accessible through a `GET` request.

## Setup Instructions

1. **Prerequisites**
   - Ensure you have Cloudflare `wrangler` CLI installed and authenticated.
   - Have access to a Cloudflare R2 bucket where email data will be stored.

2. **Project Initialization**
   - Clone the repository.

3. **Configure R2 Bucket**
   - In `wrangler.toml`, add the R2 bucket configuration:

     ```toml
     [[r2_buckets]]
     binding = "R2_BUCKET" # Reference name for the bucket in the code
     bucket_name = "your-r2-bucket-name"
     preview_bucket_name = "your-r2-preview-bucket-name"
     ```

4. **Update Allowlist**
   - In `src/index.ts`, update the `allowList` array in the `email` method to include authorized email addresses:

     ```typescript
     const allowList = ["uremail@example.com", "coworker@example.com"];
     ```

5. **Environment Variables**
   - In your `wrangler.toml`, ensure the R2 bucket is correctly referenced to match the `Env` interface in the code:

     ```typescript
     export interface Env {
       R2_BUCKET: R2Bucket;
     }
     ```

6. **Deploy the Worker**
   - Use the `wrangler` CLI to deploy:

     ```bash
     npx wrangler deploy
     ```

## Usage

### Email Parsing

When an email is received, the worker:

- Verifies the sender’s email address.
- Parses the email content (body and attachments).
- Saves the parsed email data as JSON, storing attachments in the R2 bucket.

### JSON Feed Access

The JSON data can be accessed via a `GET` request to the worker’s URL. This endpoint provides a JSON array of all received emails, each with:

- `id`: A sequential numeric identifier.
- `date`: Timestamp of the email receipt.
- `text`: Body of the email.
- `files`: Array of any attachments, including metadata and R2 URLs.

## Notes

- Only emails from addresses in the allowlist are processed.
- Attachments are stored in the R2 bucket and linked in the JSON feed.
