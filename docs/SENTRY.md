# Sentry Error Monitoring

This document describes the Sentry integration for error monitoring and performance tracking in Facets API.

## Overview

Sentry provides:

- **Error Tracking**: Automatic capture of unhandled exceptions
- **Performance Monitoring**: Transaction and span tracing
- **Profiling**: Code-level performance insights

## Configuration

### Environment Variables

| Variable     | Required | Description                                                                        |
| ------------ | -------- | ---------------------------------------------------------------------------------- |
| `SENTRY_DSN` | No       | Sentry Data Source Name. If not set, Sentry is disabled.                           |
| `NODE_ENV`   | No       | Environment name (`development`, `production`, `test`). Defaults to `development`. |

### Sample Rates

| Environment | Traces | Profiling |
| ----------- | ------ | --------- |
| Production  | 10%    | 10%       |
| Development | 100%   | 100%      |

## Architecture

```
src/
├── instrument.ts          # Sentry initialization (imported FIRST in main.ts)
├── main.ts                # Imports instrument.ts before anything else
├── app.module.ts          # SentryModule.forRoot() as first import
└── common/
    └── filters/
        └── all-exceptions.filter.ts  # Uses @SentryExceptionCaptured()
```

## How It Works

1. **Initialization**: `instrument.ts` is imported FIRST in `main.ts` to ensure Sentry instruments all modules
2. **Module Setup**: `SentryModule.forRoot()` integrates Sentry with NestJS
3. **Exception Capture**: `@SentryExceptionCaptured()` decorator on the global exception filter sends errors to Sentry

## Local Development

Sentry is disabled when `SENTRY_DSN` is not set, so you can develop without it.

To test Sentry locally:

```bash
# Add to .env
SENTRY_DSN=your-dsn-here
```

## Verifying Integration

1. Trigger an error in your application
2. Check the Sentry dashboard for the captured error
3. Verify performance traces are being recorded

## Release Tracking

Releases are automatically tagged as `facets-api@{version}` using the version from `package.json`.
