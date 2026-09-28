# Security policy

## Current status

There is no Zed Registry-published or supported product release yet. The
repository is public and contains an installable development-extension candidate
plus historical research/spike harnesses. Development-extension success is not a
support or release claim.

Current release/distribution work is governed by release Epic #108 and
`docs/preview-release-gate.md`. Open release blockers, including the publishing
boundary tracked by #159 on current `main`, must be resolved and revalidated
before Registry publication is treated as release evidence.

Historical spike code may intentionally exercise local loopback routes,
ephemeral credentials, process control, and downloaded development inputs. Do
not deploy spike code as a service or product component.

## Reporting

Do not open a public issue for a suspected vulnerability, exposed credential, or
private-data leak. Use GitHub private vulnerability reporting when it is
available for this repository. Include the affected commit and file, impact,
reproduction steps, and whether the report involves a real credential or only a
synthetic fixture.

If private vulnerability reporting is unavailable, contact the repository owner
privately through GitHub and wait for a private channel before sending sensitive
details. No project member will ask you to post a credential publicly.

## Release security boundary

Any Registry release candidate must keep its security claims consistent with the
current release gate and exact reviewed source. At minimum, release-facing
documentation must cover supported versions, artifact provenance and checksums,
credential/log redaction, runtime route and resource ownership/cleanup,
update/rollback behavior, and vulnerability response.

A release-blocking architecture or publishing-policy gap must be resolved or the
release must remain blocked; CI green alone does not establish this boundary.
Until a supported Registry release exists, there is no supported-version table
or security-fix SLA.
