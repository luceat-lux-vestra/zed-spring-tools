# Security policy

## Current status

There is no released or supported product version yet. This repository contains
experimental research harnesses that may intentionally exercise local loopback
routes, ephemeral credentials, process control, and downloaded development
inputs. Do not deploy spike code as a service or product component.

## Reporting

Do not open a public issue for a suspected vulnerability, exposed credential,
or private-data leak. Once the public GitHub repository is created, use its
private vulnerability reporting form. Include the affected commit and file,
impact, reproduction steps, and whether the report involves a real credential
or only a synthetic spike fixture.

If private vulnerability reporting is unavailable, contact the repository owner
privately through GitHub and wait for a private channel before sending sensitive
details. No project member will ask you to post a credential publicly.

## Scope for the first product preview

Before any installable preview, the project must document supported versions,
artifact provenance and checksums, loopback authentication, log redaction,
route ownership and cleanup, update/rollback behavior, and a response process.
Until then, there is no supported-version table or security-fix SLA.
