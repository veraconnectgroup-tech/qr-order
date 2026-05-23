import * as Sentry from "@sentry/nextjs";
import { getSentryOptions } from "./src/lib/sentry-options";

Sentry.init(getSentryOptions());
