Key Features Implemented
1. /pr <url> slash command - Validates URL, checks for duplicates, fetches PR details from GitHub, posts formatted message, adds eyes reaction, saves mapping.
2. GitHub webhook handler (POST /github/webhooks) with signature verification:
- pull_request_review.submitted (approved → white_check_mark, changes_requested → x)
- pull_request_review_comment.created / issue_comment.created → speech_balloon
- pull_request.closed → twisted_rightwards_arrows (merged) or no_entry_sign (closed)
3. Reaction state management - Removes conflicting reactions (e.g., removes x before adding white_check_mark on re-approval).
4. Edge cases - Duplicate PR detection, invalid URL handling, PR not found, graceful webhook failures.
To Run
1. Copy .env.example to .env and fill in credentials
2. npm run build && npm start (or npm run dev for development)
3. Configure your GitHub App webhook URL to https://<your-host>/github/webhooks