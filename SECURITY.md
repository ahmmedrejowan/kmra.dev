# Security

kmra.dev's tools run in the browser and promise that files stay on the device. Anything that
could break that promise, or put visitors at risk, is a security issue.

## Reporting

Please don't open a public issue. Instead, either:

- use GitHub's [private vulnerability reporting](https://github.com/ahmmedrejowan/kmra.dev/security/advisories/new), or
- email **ping@kmra.dev**.

Include the affected page, steps to reproduce and what an attacker could do. You'll get a reply
within a few days, and a fix will be released as soon as it's ready. Reporters are credited
unless they prefer not to be.

## In scope

- Anything that sends file contents or names to another host
- Cross-site scripting or injection through file names, file contents or pasted text
- Problems with the cross-site file handoff (`/handoff`)
- Weaknesses in the security headers or Content Security Policy

Issues in third-party libraries are welcome too; they'll be passed on upstream.
