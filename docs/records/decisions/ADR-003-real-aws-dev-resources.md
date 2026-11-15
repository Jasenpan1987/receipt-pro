# ADR-003: DynamoDB and S3, With Local Development Against Real AWS Dev Resources

**Date:** 2026-11-15
**Status:** superseded in part by ADR-005 (separate dev and prod resources); the rest stands
**Decision makers:** Builder
**Supersedes:** none

## Context

The app needs a database and photo storage that cost close to nothing when idle and work
from Lambda. The local version has to run before anything is deployed. Two ways to run it
locally were offered: emulators in Docker (DynamoDB Local, an S3 emulator), or the real
services in the builder's AWS account.

## Decision

- Data in DynamoDB (one table, on-demand billing); photos in S3 (one private bucket).
- The local version connects straight to real dev resources in the builder's personal AWS account. No Docker, no emulators.
- Dev resources (`receipt-pro-dev`, `receipt-pro-dev-photos-<account-id>`) are separate from the production resources created at deployment.

## Consequences

- One code path from day one; no emulator differences to discover at deployment.
- Local development needs internet access and the builder's personal AWS credentials on the Mac.
- **This Mac also holds other AWS profiles, and the shell sets `AWS_PROFILE` to one of them.** The app must never rely on `AWS_PROFILE` or the default profile. See `docs/knowledge/tech-conventions.md#aws-account-safety`.
- Dev usage is tiny and expected to stay within or near AWS free-tier limits.

## Alternatives Considered

- **Docker emulators.** Fully offline, but the Mac's Docker is 20.10.22 (2022), and emulator behaviour can differ from the real services. Rejected by the builder as unnecessary.

## Evidence

- Builder, in chat, 2026-11-15: use the cloud services directly, no Docker, connect from local.
- `aws configure list-profiles` and `echo $AWS_PROFILE` on the builder's Mac, 2026-11-15.
