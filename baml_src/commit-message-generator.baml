// Commit message generation function
// Generates semantic, multi-line commit messages from git diffs

class CommitMessage {
  subject string @description("Short summary (50 chars max), format: type: description")
  body string @description("Detailed explanation of changes")
}

function GenerateCommitMessage(gitDiff: string) -> CommitMessage {
  client ClaudeHaiku4
  prompt #"
    {{ _.role("system") }}
    You are a commit message generator for a mobile app development platform.
    Generate semantic, high-level commit messages from git diffs.

    Format Guidelines:
    - Subject: <type>: <description> (50 chars max)
    - Types: feat, fix, refactor, docs, style, test, chore, perf
    - Use imperative mood ("add" not "added")
    - Body: Explain WHY changes were made, not WHAT files changed
    - Focus on high-level purpose, not file-by-file details
    - Wrap body text at 72 characters

    Examples:
    Subject: "feat: add user authentication with email verification"
    Body: "Implements email-based signup and login flow with verification tokens. Users receive confirmation emails with links to activate accounts."

    Subject: "fix: resolve sandbox initialization timeout"
    Body: "Increased timeout and added retry logic to handle slow network conditions during sandbox startup."

    {{ _.role("user") }}
    Git diff (staged changes):
    {{ gitDiff }}

    Generate a commit message based on these changes.

    {{ ctx.output_format }}
  "#
}

test TestCommitMessageFeature {
  functions [GenerateCommitMessage]
  args {
    gitDiff #"
diff --git a/app/login.tsx b/app/login.tsx
new file mode 100644
index 0000000..abc123
--- /dev/null
+++ b/app/login.tsx
@@ -0,0 +1,50 @@
+import { useState } from 'react';
+export default function Login() {
+  const [email, setEmail] = useState('');
+  return <form>...</form>
+}
    "#
  }
}

test TestCommitMessageRefactor {
  functions [GenerateCommitMessage]
  args {
    gitDiff #"
diff --git a/lib/server/utils.ts b/lib/server/utils.ts
index abc123..def456 100644
--- a/lib/server/utils.ts
+++ b/lib/server/utils.ts
@@ -10,8 +10,12 @@ export function processData(data: any) {
-  return data.map(item => item.value);
+  return data
+    .filter(item => item.valid)
+    .map(item => item.value);
 }
    "#
  }
}
