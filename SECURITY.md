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

## Repository failure-classification controls

The required `failure-triage` check is an unprivileged `pull_request`
adapter to the organization-wide failure-declaration action, pinned by full
commit SHA. It validates the PR's remediation declaration; it is separate from
automatic CI failure classification.

The trusted `Failure classification` workflow is loaded from the default
branch and runs after tracked workflows complete. It reconstructs active
failures for the exact PR HEAD and upserts one sticky
`CI Failure Classification` comment. The reporter treats workflow logs and
metadata as untrusted data, never checks out or executes PR code, never
executes downloaded artifacts, and limits write authority to its job-local PR
comment scope.

Because GitHub loads `workflow_run` workflows from the default branch, the PR
that first introduces the reporter cannot prove that reporter against its own
pull-request runs. Full rollout therefore requires a later PR, after the
reporter is present on `main`, whose exact final HEAD passes the ordinary
required checks and receives exactly one sticky classification report for that
same HEAD. With no active failed or pending tracked workflow, the report must
reach `CLEAR`.

`CANDIDATE` and `UNKNOWN` remain fail-closed and never authorize
remediation.

